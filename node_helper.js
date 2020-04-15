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

    console.log("Creating "+self.config.ds.length+" DiskStation(s)")

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

      console.log("Created DS with id: "+curDsIdx+" and url: "+curDs.protocol+"://"+curDs.host+":"+curDs.port)
      self.ds[curDsIdx] = syno

     validCamNames = {}
      for (var i = 0; i <curDs.cams.length; i++){
        validCamNames[curDs.cams[i].name] = i
      }

      var innerCallback = function(syno, curDsIdx, idsNeeded, idNameMap){
        syno.ss.getLiveViewPathCamera({'idList':idsNeeded}, function(liveViewError,liveViewData){
          if(typeof liveViewData !== "undefined"){
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
        syno.ss.listCameras(function(error,data){
          idNameMap = {}
          var cameras = data["cameras"]
          for (var key in cameras){
            idNameMap[cameras[key]["id"]] = cameras[key]["newName"]
            var idsNeeded = []
            if(typeof validCamNames[cameras[key]["newName"]] !== "undefined"){
              idsNeeded.push(cameras[key]["id"])
            }
          }
  
          var notFirst = false
          var idString = ""
          for(var curId in idsNeeded){
            if(notFirst){
              idString+=","
            }
  
            idString+=curId
            notFirst = true;
          }
  
          innerCallback(syno, curDsIdx, idsNeeded, idNameMap)
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
      self.getStreamUrls(payload)
    } else if (notification === "REFRESH_COOKIE"){
      for(var curDsIdx in Object.keys(this.ds)){
        this.ds[curDsIdx].dsm.getInfo(function(error,data){
          console.log("Refreshed cookie of ds with index "+curDs)
        })
      }
    }
  }
})
