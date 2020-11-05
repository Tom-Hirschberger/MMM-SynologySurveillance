/* Magic Mirror
 * Module: MMM-SynologySurveillance
 *
 * By Tom Hirschberger
 * MIT Licensed.
 */
const NodeHelper = require("node_helper")
const Syno = require("syno")
module.exports = NodeHelper.create({

  start: function () {
    this.started = false
    this.urlUpdateInProgress = false
    this.ds = {}
  },

  getStreamUrls: function(){
    this.urlUpdateInProgress = true
    const self = this
    let result = []

    // console.log(this.name+": Creating "+self.config.ds.length+" DiskStation(s)")

    for(let curDsIdx = 0; curDsIdx < self.config.ds.length; curDsIdx++) {
      let curDs = self.config.ds[curDsIdx]
      let curDsResult = {}
      let syno = new Syno({
        protocol : curDs.protocol,
        host: curDs.host,
        port: curDs.port,
        account: curDs.user,
        passwd: curDs.password,
        ignoreCertificateErrors: true
      })

      syno.dsIdx = curDsIdx

      // console.log(this.name+": Created DS with id: "+curDsIdx+" and url: "+curDs.protocol+"://"+curDs.host+":"+curDs.port)
      self.ds[curDsIdx] = {}
      self.ds[curDsIdx].syno = syno

      let validCamNames = {}
      for (let i = 0; i <curDs.cams.length; i++){
        validCamNames[curDs.cams[i].name] = i
      }
      
      
      console.log(this.name+": Updating information of DS with idx: "+curDsIdx)
      // console.log(this.name+": ValidCamNames of idx: "+curDsIdx+" :"+JSON.stringify(validCamNames))
      syno.ss.listCameras(function(error,data){
        // console.log(this.name+": Listing Cams of: "+curDsIdx)
        // console.log(this.name+": Error: "+JSON.stringify(error))
        // console.log(this.name+": Data: "+JSON.stringify(data))

        let idNameMap = {}
        let idString = ""
        if(typeof data !== "undefined"){
          let cameras = data["cameras"]
          let notFirst = false
          for (let key in cameras){
	          console.log(this.name+": Found cam "+cameras[key]["newName"])
            idNameMap[cameras[key]["id"]] = cameras[key]["newName"]
            if(typeof validCamNames[cameras[key]["newName"]] !== "undefined"){
              if(notFirst){
                idString+=","
              }
              idString+=cameras[key]["id"]
              notFirst = true;
            }
          }

          self.ds[curDsIdx].idNameMap = idNameMap

          self.ds[curDsIdx].ptzPresetInfo = {}
          if(self.config.showPositions || self.config.showBigPositions){
            for(let curCamId in idNameMap){
              self.ds[curDsIdx].ptzPresetInfo[curCamId] = []
              syno.ss.listPresetPtz({'cameraId':curCamId}, function(ptzError,ptzData){
                console.log(this.name+": CurDS: "+curDsIdx+" curCamId: "+curCamId+": "+JSON.stringify(ptzData,null,2))

                if(typeof ptzData !== "undefined"){
                  self.ds[curDsIdx].ptzPresetInfo[curCamId] = ptzData.presets
                  self.sendSocketNotification("DS_PTZ_PRESET_INFO", {
                    dsIdx: curDsIdx,
                    curCamId: curCamId,
                    camName: idNameMap[curCamId],
                    ptzData: ptzData.presets
                  })
                }
              })
            }             
          }
    
          if(idString !== ""){
            syno.ss.getLiveViewPathCamera({'idList':idString}, function(liveViewError,liveViewData){
              // console.log(this.name+": curDsIdx: "+JSON.stringify(curDsIdx))
              // console.log(this.name+": isNeeded: "+JSON.stringify(idsNeeded))
              // console.log(this.name+": idNameMap: "+JSON.stringify(idNameMap))
              if(typeof liveViewData !== "undefined"){
                // console.log(this.name+": Got url info of DS with id: "+curDsIdx)
                for(let curResIdx in liveViewData){
                  let curCamId = liveViewData[curResIdx]["id"]
                  let curCamName = idNameMap[curCamId]
                  if((typeof self.config.ds[curDsIdx].replaceHostPart === "undefined") ||
                    (!self.config.ds[curDsIdx].replaceHostPart)
                  ){
                    curDsResult[curCamName] = liveViewData[curResIdx]["mjpegHttpPath"]
                  } else {
                    let curUrl = liveViewData[curResIdx]["mjpegHttpPath"]
                    //first : is protocal:
                    let newUrl = curUrl.substring(curUrl.indexOf(":")+1)
                    //second: is port
                    newUrl = newUrl.substring(newUrl.indexOf(":"))
                    newUrl = self.config.ds[curDsIdx].protocol+"://"+self.config.ds[curDsIdx].host+newUrl
                    curDsResult[curCamName] = newUrl
                  }
                }
                let curPayload = {
                  dsIdx: curDsIdx,
                  camStreams: curDsResult,
                }
      
                console.log(this.name+": "+JSON.stringify(curPayload,null,2))
      
                self.urlUpdateInProgress = false
                self.sendSocketNotification("DS_STREAM_INFO",curPayload)
              } else {
                console.log(this.name+": Got an  error while trying to fetch the live view data")
                console.log(this.name+": "+JSON.stringify(liveViewError, null, 2))
                if ((typeof liveViewError["code"] !== "undefined") &&
                    (liveViewError["code"] === 105) &&
                    (self.config.skipOnPrivilegeError)){
                  console.log(this.name+": Got privilege error but skipping is activated!")
                } else {
                  self.sendSocketNotification("DS_STREAM_INFO",{
                    dsIdx: curDsIdx,
                    camStreams: {},
                  })
                }
              }
            });
          } else {
            console.log(this.name+": Could not find any valid cam for ds with idx: "+curDsIdx)
            self.sendSocketNotification("DS_STREAM_INFO",{
              dsIdx: curDsIdx,
              camStreams: {},
            })
          }
        } else if (error){
          console.log(this.name+": Problem during fetch of cams of ds with idx: "+curDsIdx)
          console.log(this.name+": "+JSON.stringify(error, null, 2))
          if ((typeof error["code"] !== "undefined") &&
              (error["code"] === 105) &&
              (self.config.skipOnPrivilegeError)){
            console.log(this.name+": Got privilege error but skipping is activated!")
          } else {
            self.sendSocketNotification("DS_STREAM_INFO",{
              dsIdx: curDsIdx,
              camStreams: {},
            })
          }
        }
      })
    }
  },


  Sleep: function (milliseconds) {
    return new Promise(resolve => setTimeout(resolve, milliseconds));
  },

  goPosition: async function(dsIdx, camName, position){
    const self = this
    let curDsIdx = dsIdx
    let curCamName = camName
    while(self.urlUpdateInProgress){
      Sleep(1000)
    }

    if((typeof self.ds[dsIdx] !== "undefined") && (typeof self.ds[dsIdx].idNameMap !== "undefined")){
      var camId = null
      for(var curCamId in self.ds[dsIdx].idNameMap){
        // console.log(this.name+": Checking if camdId "+curCamId+" with name: "+self.ds[dsIdx].idNameMap[curCamId]+" matches name "+camName)
        if(self.ds[dsIdx].idNameMap[curCamId] === camName){
          console.log(this.name+": Found id of cam: "+camName)
          camId = curCamId
          break
        }
      }

      if(camId){
        if((typeof self.ds[dsIdx].ptzPresetInfo !== "undefined")&& (typeof self.ds[dsIdx].ptzPresetInfo[camId] !== "undefined")){
          if((position >= 0) && (position < Object.keys(self.ds[dsIdx].ptzPresetInfo[camId]).length)){
            console.log(this.name+": Changing position of cam")
            var curRealPosition = self.ds[dsIdx].ptzPresetInfo[camId][position]["position"]
            console.log(this.name+": New position with idx: "+position+" is "+curRealPosition)
            self.ds[dsIdx].syno.ss.goPresetPtz({'cameraId':camId, 'position':curRealPosition}, function(goPtzError,goPtzData){
              self.sendSocketNotification("DS_CHANGED_POSITION", {
                dsIdx: curDsIdx,
                camName: curCamName,
                position: position
              })
            })
          }
        } else {
          console.log(this.name+": Could not change position of cam: "+camName+" of ds: "+dsIdx+" because no ptz preset info is available!")
        }
      } else {
        console.log(this.name+": Could not change postion of cam: "+camName+" because no id of this cam is known!")
      }
    } else {
      console.log(this.name+": Could not change position of cam: "+camName+" because no id name mapping is present for this ds ("+dsIdx+") at the moment.")
    }
  },

  socketNotificationReceived: function (notification, payload) {
    const self = this
    console.log(self.name + ": Received notification "+notification)
    if (notification === "CONFIG" && self.started === false) {
      self.config = payload
      self.started = true
    } else if (notification === "INIT_DS"){
      self.getStreamUrls()
    } else if ((notification === "REFRESH_URLS") && self.started){
      console.log(this.name + ': Refreshing the urls!')
      self.getStreamUrls()
    } else if (notification === "SYNO_SS_CHANGE_CAM"){
      self.sendSocketNotification(notification,payload)
    } else if (notification === "DS_CHANGE_POSITION"){
      console.log(this.name+": Changing position of cam: "+payload.camName+" of ds: "+payload.dsIdx+" to: "+payload.position)
      self.goPosition(payload.dsIdx, payload.camName, payload.position)
    }
  }
})
