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
    var result = []

    // console.log("Creating "+self.config.ds.length+" DiskStation(s)")

    for(var curDsIdx = 0; curDsIdx < self.config.ds.length; curDsIdx++) {
      var curDs = self.config.ds[curDsIdx]
      var curDsResult = {}
      var syno = new Syno({
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

     validCamNames = {}
      for (var i = 0; i <curDs.cams.length; i++){
        validCamNames[curDs.cams[i].name] = i
      }

      var innerCallback = function(syno, curDsIdx, idString, idNameMap){
        // console.log("Quering for urls of cams: "+idString)
        syno.ss.getLiveViewPathCamera({'idList':idString}, function(liveViewError,liveViewData){
          // console.log("curDsIdx: "+JSON.stringify(curDsIdx))
          // console.log("isNeeded: "+JSON.stringify(idsNeeded))
          // console.log("idNameMap: "+JSON.stringify(idNameMap))
          if(typeof liveViewData !== "undefined"){
            // console.log("Got url info of DS with id: "+curDsIdx)
            // console.log(JSON.stringify(liveViewData,null,2))
            for(var curResIdx in liveViewData){
              var curCamId = liveViewData[curResIdx]["id"]
              var curCamName = idNameMap[curCamId]
              curDsResult[curCamName] = liveViewData[curResIdx]["mjpegHttpPath"]
            }
            self.sendSocketNotification("DS_STREAM_INFO",{
              dsIdx: curDsIdx,
              camStreams: curDsResult,
            })
          } else {
            console.log(JSON.stringify(liveViewError))
          }    
        });
      }
      
      var outerCallback = function(syno, curDsIdx, validCamNames){
        console.log("Updating information of DS with idx: "+curDsIdx)
        // console.log("ValidCamNames of idx: "+curDsIdx+" :"+JSON.stringify(validCamNames))
        syno.ss.listCameras(function(error,data){
          if(typeof data !== "undefined"){
            idNameMap = {}
            var cameras = data["cameras"]
            var notFirst = false
            var idString = ""
            for (var key in cameras){
              idNameMap[cameras[key]["id"]] = cameras[key]["newName"]
              if(typeof validCamNames[cameras[key]["newName"]] !== "undefined"){
                if(notFirst){
                  idString+=","
                }
      
                idString+=cameras[key]["id"]
                notFirst = true;
              }
            }
    
            innerCallback(syno, curDsIdx, idString, idNameMap)
          }
        })
      }
      outerCallback(syno, curDsIdx, validCamNames)
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
