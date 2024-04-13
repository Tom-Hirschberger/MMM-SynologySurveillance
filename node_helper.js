/* MagicMirror²
 * Module: MMM-SynologySurveillance
 *
 * By Tom Hirschberger
 * MIT Licensed.
 */
const NodeHelper = require("node_helper")
const MySynoSSClient = require("./MySynoSSClient")
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

  stop: async function(){
    const self = this
    if (self.config.debug){
      console.log(self.name+": Will logout all clients")
    }
    for (let dsIdx = 0; dsIdx < self.ds.length; dsIdx++){
      try{
        await self.ds[dsIdx].client.logout()
        if (self.config.debug){
          console.log(self.name+": Logout of DiskStation with idx: "+dsIdx+" successful")
        }
      } catch {
        if (self.config.debug){
          console.log(self.name+": Logout of DiskStation with idx: "+dsIdx+" failed")
        }
      }
    }
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

    if (self.started){
      while (self.urlUpdateInProgress) {
        self.Sleep(1000);
      }

      if (typeof self.ds[dsIdx] !== "undefined"){
        if(typeof self.ds[dsIdx].infos.camNameIdMapping[camName] !== "undefined"){
          let curCamId = self.ds[dsIdx].infos.camNameIdMapping[camName]
          if (self.config.debug){
            console.log(self.name + ": Id of cam " + camName+" is "+self.ds[dsIdx].infos.camNameIdMapping[camName])
          }

          if (typeof self.ds[dsIdx].infos.infosPerId[curCamId].presets[position] !== "undefined"){
            try {
              await self.ds[dsIdx].client.goPTZPosition(curCamId, self.ds[dsIdx].infos.infosPerId[curCamId].presets[position].position, true)
              self.sendSocketNotification("DS_CHANGED_POSITION", {dsIdx: dsIdx, camName: camName, position: position})
            } catch (goPositionError){
              if ((typeof goPositionError.returnCode !== "undefined") && (goPositionError.returnCode === 105)){
                if (self.config.debug){
                  console.log(self.name + "Got privilege error while changing the position of cam: "+camName+" of DiskStation with idx "+dsIdx+". Trying again without using cached data!")
                }
                try {
                  await self.ds[dsIdx].client.goPTZPosition(curCamId, self.ds[dsIdx].infos.infosPerId[curCamId].presets[position].position, false)
                  self.sendSocketNotification("DS_CHANGED_POSITION", {dsIdx: dsIdx, camName: camName, position: position})
                } catch (goPositionNoCacheError) {
                  console.log(goPositionNoCacheError)
                }
              }
            }
          } else {
            console.log(self.name +": Could not change position of cam: "+ camName +" of ds: "+ dsIdx +" because there exists no position with idx "+position+"!")
          }
        } else {
          console.log(self.name +": Could not change position of cam: "+ camName +" of ds: "+ dsIdx +" because there exists no information about a cam with this name!")
        }
      }
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
            curDs.client = new MySynoSSClient(opts)

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
