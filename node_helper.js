/* MagicMirror²
 * Module: MMM-SynologySurveillance
 *
 * By Tom Hirschberger
 * MIT Licensed.
 */
const NodeHelper = require("node_helper");
const Syno = require("syno");
module.exports = NodeHelper.create({
  start: function () {
    const self = this
    self.lastRefresh = -1
    self.started = false
    self.urlUpdateInProgress = false
    self.ds = {}
    self.iterationCnt = 0
  },

  splitAndReplaceUrlParts: function(orgUrl, newProtocol=null, newHost=null, newPort=null){
    urlObj = new URL(orgUrl)
    let newUrl = newProtocol+"://"

    if(newHost != null){
      newUrl += newHost
    } else {
      newUrl += urlObj.hostname
    }

    newUrl += ":"
    if (newPort != null){
      newUrl += newPort
    } else {
      newUrl += urlObj.port
    }

    newUrl += urlObj.pathname
    newUrl += urlObj.search

    return newUrl
  },

  getStreamUrls: function () {
    const self = this
    self.urlUpdateInProgress = true
    self.iterationCnt += 1
    let dummySend = false

    // console.log(self.name+": Creating "+self.config.ds.length+" DiskStation(s)")

    for (let curDsIdx = 0; curDsIdx < self.config.ds.length; curDsIdx++) {
      let curDs = self.config.ds[curDsIdx]
      let curDsResult = {}
      console.log(self.name + ": Updating information of DS with idx: " + curDsIdx + " and protocol "+curDs.protocol);
      if ((self.config.provideDummyUrlAfterIterations < 1) || (self.iterationCnt < self.config.provideDummyUrlAfterIterations)){
        if ((typeof curDs.protocol !== "undefined") && (curDs.protocol === "mjpeg")){
          console.log(self.name + ": DS is of type mjpeg");
          for (let i = 0; i < curDs.cams.length; i++) {
            let curCam = curDs.cams[i]
            console.log(self.name + ": Updating information of cam "+i+" of DS with idx: " + curDsIdx)
            if (typeof curCam.name !== "undefined"){
              // console.log(self.name + ": name is present")
              let curUrl = curCam.url || null
              
              if (curUrl != null){
                curDsResult[curCam.name] = curUrl
              }
            }
          }

          self.sendSocketNotification("DS_STREAM_INFO", {
            dsIdx: curDsIdx,
            camStreams: curDsResult
          })
        } else {
          let syno = new Syno({
            protocol: curDs.protocol,
            host: curDs.host,
            port: curDs.port,
            account: curDs.user,
            passwd: curDs.password,
            ignoreCertificateErrors: true,
            apiVersion: self.config.apiVersion
          })

          syno.dsIdx = curDsIdx

          // console.log(self.name+": Created DS with id: "+curDsIdx+" and url: "+curDs.protocol+"://"+curDs.host+":"+curDs.port)
          self.ds[curDsIdx] = {}
          self.ds[curDsIdx].syno = syno

          let validCamNames = {}
          for (let i = 0; i < curDs.cams.length; i++) {
            validCamNames[curDs.cams[i].name] = i
          }
          // console.log(self.name+": ValidCamNames of idx: "+curDsIdx+" :"+JSON.stringify(validCamNames))
          syno.ss.listCameras(function (error, data) {
            // console.log(self.name+": Listing Cams of: "+curDsIdx)
            // console.log(self.name+": Error: "+JSON.stringify(error))
            // console.log(self.name+": Data: "+JSON.stringify(data))

            let idNameMap = {}
            let idString = ""
            if (typeof data !== "undefined") {
              let cameras = data["cameras"]
              let notFirst = false
              for (let key in cameras) {
                console.log(self.name + ": Found cam " + cameras[key]["newName"])
                idNameMap[cameras[key]["id"]] = cameras[key]["newName"]
                if (typeof validCamNames[cameras[key]["newName"]] !== "undefined") {
                  if (notFirst) {
                    idString += ","
                  }
                  idString += cameras[key]["id"]
                  notFirst = true
                }
              }

              self.ds[curDsIdx].idNameMap = idNameMap

              self.ds[curDsIdx].ptzPresetInfo = {}
              if (self.config.showPositions || self.config.showBigPositions) {
                for (let curCamId in idNameMap) {
                  self.ds[curDsIdx].ptzPresetInfo[curCamId] = []
                  syno.ss.listPresetPtz(
                    { cameraId: curCamId },
                    function (ptzError, ptzData) {
                      // console.log(self.name +": CurDS: "+ curDsIdx +" curCamId: "+ curCamId +": " +
                      //     JSON.stringify(ptzData, null, 2)
                      // )
                      if (
                        typeof ptzError !== "undefined" &&
                        ptzError !== null &&
                        typeof ptzError["code"] !== "undefined" &&
                        (ptzError["code"] === 105 || ptzError["code"] === 498) &&
                        self.config.skipOnPrivilegeError
                      ) {
                        console.log(self.name +": Got privilege error but skipping is activated!")
                      } else {
                        if (typeof ptzData !== "undefined" &&
                            typeof ptzData.presets !== "undefined"
                        ){
                          self.ds[curDsIdx].ptzPresetInfo[curCamId] = ptzData.presets
                          self.sendSocketNotification("DS_PTZ_PRESET_INFO", {
                            dsIdx: curDsIdx,
                            curCamId: curCamId,
                            camName: idNameMap[curCamId],
                            ptzData: ptzData.presets
                          })
                        }
                      }
                    }
                  );
                }
              }

              if (idString !== "") {
                syno.ss.getLiveViewPathCamera(
                  { idList: idString },
                  function (liveViewError, liveViewData) {
                    // console.log(self.name+": curDsIdx: "+JSON.stringify(curDsIdx))
                    // console.log(self.name+": isNeeded: "+JSON.stringify(idsNeeded))
                    // console.log(self.name+": idNameMap: "+JSON.stringify(idNameMap))
                    if (typeof liveViewData !== "undefined") {
                      // console.log(self.name+": Got url info of DS with id: "+curDsIdx)
                      for (let curResIdx in liveViewData) {
                        let curCamId = liveViewData[curResIdx]["id"]
                        let curCamName = idNameMap[curCamId]
                        if (typeof self.config.ds[curDsIdx].replaceHostPart === "undefined" ||
                            !self.config.ds[curDsIdx].replaceHostPart
                        ){
                          curDsResult[curCamName] = encodeURI(liveViewData[curResIdx]["mjpegHttpPath"])
                        } else {
                          let curUrl = liveViewData[curResIdx]["mjpegHttpPath"]
                          let newHost = self.config.ds[curDsIdx].host
                          let newPort = null
                          if (typeof self.config.ds[curDsIdx].replacePortPart !== "undefined" ||
                              self.config.ds[curDsIdx].replacePortPart
                          ){
                            newPort = self.config.ds[curDsIdx].port
                          }

                          curDsResult[curCamName] = self.splitAndReplaceUrlParts(curUrl, self.config.ds[curDsIdx].protocol, newHost, newPort)
                        }
                      }
                      let curPayload = {
                        dsIdx: curDsIdx,
                        camStreams: curDsResult
                      }

                      console.log( self.name + ": " + JSON.stringify(curPayload, null, 2) )

                      self.urlUpdateInProgress = false
                      self.sendSocketNotification("DS_STREAM_INFO", curPayload)
                    } else {
                      console.log( self.name + ": Got an  error while trying to fetch the live view data" )
                      console.log( self.name + ": " + JSON.stringify(liveViewError, null, 2))
                      if ( typeof liveViewError["code"] !== "undefined" &&
                           (liveViewError["code"] === 105 ||
                            liveViewError["code"] === 498
                           ) && self.config.skipOnPrivilegeError
                      ){
                        console.log(self.name +": Got privilege error but skipping is activated!")
                      } else {
                        self.sendSocketNotification("DS_STREAM_INFO", {
                          dsIdx: curDsIdx,
                          camStreams: {}
                        })
                      }
                    }
                  }
                )
              } else {
                console.log(self.name +": Could not find any valid cam for ds with idx: " +curDsIdx)
                self.sendSocketNotification("DS_STREAM_INFO", {
                  dsIdx: curDsIdx,
                  camStreams: {}
                })
              }
            } else if (error) {
              console.log(self.name +": Problem during fetch of cams of ds with idx: "+ curDsIdx)
              console.log(self.name + ": " + JSON.stringify(error, null, 2))
              if (typeof error["code"] !== "undefined") {
                if (error["code"] === 105 || error["code"] === 498) {
                  if (self.config.skipOnPrivilegeError) {
                    console.log(self.name + ": Got privilege error but skipping is activated!")
                  } else {
                    console.log("Skipping is disabled. Sending empty list of streams!")
                    self.sendSocketNotification("DS_STREAM_INFO", {
                      dsIdx: curDsIdx,
                      camStreams: {}
                    })
                  }
                } else {
                  console.log("Unknown error. Sending empty list of streams!")
                  self.sendSocketNotification("DS_STREAM_INFO", {
                    dsIdx: curDsIdx,
                    camStreams: {}
                  })
                }
              } else {
                self.sendSocketNotification("DS_STREAM_INFO", {
                  dsIdx: curDsIdx,
                  camStreams: {}
                })
              }
            }
          })
        }//end synology part
      } else {
        for (let i = 0; i < curDs.cams.length; i++) {
          let curCam = curDs.cams[i]
          console.log(self.name + ": Sending dummy url for cam "+i+" of DS with idx: " + curDsIdx)
          if (typeof curCam.name !== "undefined"){
            curDsResult[curCam.name] = "http://dummy"
          }

          dummySend = true
        }

        self.sendSocketNotification("DS_STREAM_INFO", {
          dsIdx: curDsIdx,
          camStreams: curDsResult
        })
      }
    }

    if (dummySend){
      self.iterationCnt = 0
      setTimeout(() => {
        self.getStreamUrls();
      }, 1000);
    }
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

  socketNotificationReceived: function (notification, payload) {
    const self = this
    console.log(self.name + ": Received notification " + notification)
    if (notification === "CONFIG" && self.started === false) {
      self.config = payload
      self.started = true
    } else if (notification === "INIT_DS") {
      self.lastRefresh = Date.now()
      self.getStreamUrls()
    } else if (notification === "REFRESH_URLS" && self.started) {
      if ((Date.now() - self.lastRefresh) > self.config.minimumTimeBetweenRefreshs){
        console.log(self.name + ": Refreshing the urls!")
        self.lastRefresh = Date.now()
        self.getStreamUrls()
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
