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
    this.ds = []
  },

  getStreamUrls: function(){
    const self = this
    self.ds = []
    let result = []

    // console.log("Creating "+self.config.ds.length+" DiskStation(s)")

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

      // console.log("Created DS with id: "+curDsIdx+" and url: "+curDs.protocol+"://"+curDs.host+":"+curDs.port)
      self.ds[curDsIdx] = syno

      let validCamNames = {}
      for (let i = 0; i <curDs.cams.length; i++){
        validCamNames[curDs.cams[i].name] = i
      }
      
      
      console.log("Updating information of DS with idx: "+curDsIdx)
      // console.log("ValidCamNames of idx: "+curDsIdx+" :"+JSON.stringify(validCamNames))
      syno.ss.listCameras(function(error,data){
        if(typeof data !== "undefined"){
          let idNameMap = {}
          let cameras = data["cameras"]
          let notFirst = false
          let idString = ""
          for (let key in cameras){
	          console.log("Found cam "+cameras[key]["newName"])
            idNameMap[cameras[key]["id"]] = cameras[key]["newName"]
            if(typeof validCamNames[cameras[key]["newName"]] !== "undefined"){
              if(notFirst){
                idString+=","
              }
      
              idString+=cameras[key]["id"]
              notFirst = true;
            }
          }
    
          syno.ss.getLiveViewPathCamera({'idList':idString}, function(liveViewError,liveViewData){
            // console.log("curDsIdx: "+JSON.stringify(curDsIdx))
            // console.log("isNeeded: "+JSON.stringify(idsNeeded))
            // console.log("idNameMap: "+JSON.stringify(idNameMap))
            if(typeof liveViewData !== "undefined"){
              // console.log("Got url info of DS with id: "+curDsIdx)
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
    
              console.log(JSON.stringify(curPayload,null,2))
    
              self.sendSocketNotification("DS_STREAM_INFO",curPayload)
            }
            //  else {
            //   console.log(JSON.stringify(liveViewError))
            // }    
          });
        }
        //  else if(typeof error != "undefined"){
        //   console.log(JSON.stringify(error, null, 2))
        // }
      })
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
    }
  }
})
