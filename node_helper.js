/* MagicMirror²
 * Module: MMM-SynologySurveillance
 *
 * By Tom Hirschberger
 * MIT Licensed.
 */
const NodeHelper = require("node_helper")
const SynologySurveillanceStationClient = require("./SynologySurveillanceStationClient")
const MjpegDiskStation = require("./MjpegDiskStation")

module.exports = NodeHelper.create({
  start: function () {
    const self = this
    self.lastRefresh = -1
    self.started = false
    self.urlUpdateInProgress = false
    self.ds = []
    self.iterationCnt = 0
    self.mjpegDs = {}
  },

  replaceUrlParts: function(url, newProtocol=null, newHost=null, newPort=null){
    let newUrl = new URL(url)
    if(newProtocol != null){
      url.protocol = newProtocol
    }

    if(newHost != null){
      url.hostname = newHost
    }

    if(newPort != null){
      url.port = newPort
    }

    return encodeURI(newUrl.toString())
  },

  getInfoOfAllDs: async function(){
    const self = this
    console.log(self.name + "Trying to get infos of all "+self.ds.length+" DiskStations!")

    for(let dsIdx = 0; dsIdx < self.ds.length; dsIdx++){
      if (self.config.debug){
        console.log(self.name + "Trying to get infos of ds with idx: "+dsIdx)
      }
      self.ds[dsIdx].infos = {
        camIds: [],
        camNameIdMapping: {},
        camIdNameMapping: {},
        infosPerId: {}
      }

      try {
        if (self.config.showPositions || self.config.showBigPositions) {
          self.ds[dsIdx].infos = await self.ds[dsIdx].client.getAllInfosOfAllCams(true)
        } else {
          self.ds[dsIdx].infos = await self.ds[dsIdx].client.getStreamInfoOfAllCams(true)
        }
        
      } catch (getInfosErr) {
        if ((typeof getInfosErr.returnCode !== "undefined") && (getInfosErr.returnCode === 105)){
          if (self.config.debug){
            console.log(self.name + "Got privilege error while fetching the info for DiskStation with idx "+dsIdx+". Trying again without using cached data!")
          }
          try {
            if (self.config.showPositions || self.config.showBigPositions) {
              self.ds[dsIdx].infos = await self.ds[dsIdx].client.getAllInfosOfAllCams(false)
            } else {
              self.ds[dsIdx].infos = await self.ds[dsIdx].client.getStreamInfoOfAllCams(false)
            }
          } catch (getInfosNoCacheErr) {
            console.log(getInfosNoCacheErr)
          }
        } else {
          console.log(getInfosErr)
        }
      }

      if (self.config.debug){
        console.log(self.name + "New infos of DiskStation with idx: "+dsIdx)
        console.log(JSON.stringify(self.ds[dsIdx].infos,null,2))
      }
      let newProtocol = null
      let newHost = null
      let newPort = null
      
      if (self.ds[dsIdx].replaceHostPart){
        newProtocol = self.config.ds[dsIdx].protocol
        newHost = self.config.ds[dsIdx].host
      }

      if(self.ds[dsIdx].replacePortPart){
        newPort = self.config.ds[dsIdx].port
      }

      for (let camId in self.ds[dsIdx].camIds){
        self.ds[dsIdx].infosPerId[camId].streamInfo = self.replaceUrlParts(
                                                        self.ds[dsIdx].infosPerId[camId].streamInfo,
                                                        newProtocol,
                                                        newHost,
                                                        newPort
                                                      )
      }
    }

    self.sendSocketNotification("DS_STREAM_INFO", self.ds)
  },

  Sleep: function (milliseconds) {
    return new Promise((resolve) => setTimeout(resolve, milliseconds));
  },

  goPosition: async function (dsIdx, camName, position) {
    const self = this
    let curDsIdx = dsIdx
    let curCamName = camName
    while (self.urlUpdateInProgress) {
      self.Sleep(1000);
    }

    if (typeof self.ds[dsIdx] !== "undefined" &&
        typeof self.ds[dsIdx].idNameMap !== "undefined"
    ){
      let camId = null
      for (let curCamId in self.ds[dsIdx].idNameMap) {
        if (self.ds[dsIdx].idNameMap[curCamId] === camName) {
          console.log(self.name + ": Found id of cam: " + camName)
          camId = curCamId
          break
        }
      }

      if (camId) {
        if (typeof self.ds[dsIdx].ptzPresetInfo !== "undefined" &&
            typeof self.ds[dsIdx].ptzPresetInfo[camId] !== "undefined"
        ){
          if (position >= 0 &&
              position < Object.keys(self.ds[dsIdx].ptzPresetInfo[camId]).length
          ){
            console.log(self.name + ": Changing position of cam")
            let curRealPosition = self.ds[dsIdx].ptzPresetInfo[camId][position]["position"]
            console.log(self.name +": New position with idx: "+ position +" is "+ curRealPosition)
            self.ds[dsIdx].syno.ss.goPresetPtz(
              { cameraId: camId, position: curRealPosition },
              function (goPtzError, goPtzData) {
                self.sendSocketNotification("DS_CHANGED_POSITION", {
                  dsIdx: curDsIdx,
                  camName: curCamName,
                  position: position
                })
              }
            )
          }
        } else {
          console.log(self.name +": Could not change position of cam: "+ camName +" of ds: "+ dsIdx +" because no ptz preset info is available!")
        }
      } else {
        console.log(self.name +": Could not change postion of cam: " + camName +" because no id of this cam is known!")
      }
    } else {
      console.log(self.name +": Could not change position of cam: "+ camName +" because no id name mapping is present for this ds ("+ dsIdx +") at the moment.")
    }
  },

  socketNotificationReceived: async function (notification, payload) {
    const self = this

    if ((typeof self.config !== "undefined") && (self.config.debug)) {
      console.log(self.name + ": Received notification " + notification)
    }
    
    if (notification === "CONFIG" && self.started === false) {
      self.config = payload

      if ((typeof self.config.ds !== "undefined") && (Array.isArray(self.config.ds))){
        if (self.config.debug){
          console.log(self.name + "At least one DiskStation is configured")
        }
        for (let dsIdx = 0; dsIdx < self.config.ds.length; dsIdx++) {
          if (self.config.debug){
            console.log(self.name + "Prepare datastructures for DiskStation with idx: "+dsIdx)
          }
          let curDs = {}
          let curDsConfig = self.config.ds[dsIdx]

          if (curDsConfig.protocol === "mjpeg"){
            curDs.client = new MjpegDiskStation(dsIdx, curDsConfig.cams)
            curDs.infos = await curDs.client.getAllInfosOfAllCams()
          } else {
            curDs.infos = {
              camIds: [],
              camNameIdMapping: {},
              camIdNameMapping: {},
              infosPerId: {}
            }
            let opts = {
              protocol: curDsConfig.protocol || "http",
              host: curDsConfig.host || null,
              port: curDsConfig.port || 5000,
              ignoreCertErrors: curDsConfig.ignoreCertErrors || true,
              user: curDsConfig.user || null,
              password: curDsConfig.password || null
            }
            curDs.client = new SynologySurveillanceStationClient(opts)

            if ((typeof curDsConfig.replaceHostPart !== "undefined") && (!curDsConfig.replaceHostPart)) {
              curDs.replaceHostPart = false
            } else {
              curDs.replaceHostPart = true
            }

            if ((typeof curDsConfig.replacePortPart !== "undefined") && (!curDsConfig.replacePortPart)) {
              curDs.replacePortPart = false
            } else {
              curDs.replacePortPart = true
            }
          }

          self.ds.push(curDs)
        }
      } else {
        console.log(self.name + ": Could not find some DiskStation information in the config (option ds is missing or not an array)!")
      }
      self.started = true
    } else if (notification === "INIT_DS") {
      self.lastRefresh = Date.now()
      self.urlUpdateInProgress = true
      self.getInfoOfAllDs()
      self.urlUpdateInProgress = false
    } else if (notification === "REFRESH_URLS" && self.started) {
      if ((Date.now() - self.lastRefresh) > self.config.minimumTimeBetweenRefreshs){
        if (self.config.debug){
          console.log(self.name + ": Refreshing the URLs of all DiskStations!")
        }
        self.lastRefresh = Date.now()
        self.urlUpdateInProgress = true
        self.getInfoOfAllDs()
        self.urlUpdateInProgress = false
      }
    } else if (notification === "SYNO_SS_CHANGE_CAM") {
      self.sendSocketNotification(notification, payload)
    } else if (notification === "DS_CHANGE_POSITION") {
      console.log(self.name +": Changing position of cam: "+ payload.camName +" of ds: "+ payload.dsIdx +" to: "+ payload.position)
      self.goPosition(payload.dsIdx, payload.camName, payload.position)
    } else if (notification === "SYNO_INVALIDATE_URL"){
      self.iterationCnt = self.config.iterationCnt+10
      self.getStreamUrls()
    }
  }
});
