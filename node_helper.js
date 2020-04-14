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
        idx: curDsIdx,
        protocol : curDs.protocol,
        host: curDs.host,
        port: curDs.port,
        account: curDs.user,
        passwd: curDs.password,
        ignoreCertificateErrors: true
      })

      console.log("Created DS with id: "+syno.idx+" and url: "+curDs.protocol+"://"+curDs.host+":"+curDs.port)
      self.ds.push(syno)

      syno.validCamNames = {}
      for (var i = 0; i <curDs.cams.length; i++){
        syno.validCamNames[curDs.cams[i].name] = i
      }

      console.log("Valid Cam names: "+JSON.stringify(syno.validCamNames))
      syno.ss.listCameras(function(error,data){
        syno.idNameMap = {}
        console.log("Getting list of cameras")
        var cameras = data["cameras"]
        for (var key in cameras){
          syno.idNameMap[cameras[key]["id"]] = cameras[key]["newName"]
          var idsNeeded = []
          if(typeof syno.validCamNames[cameras[key]["newName"]] !== "undefined"){
            idsNeeded.push(cameras[key]["id"])
          }
        }

        console.log("Mapping the following ids to names: ")
        console.log(JSON.stringify(syno.idNameMap))

        var notFirst = false
        var idString = ""
        for(var curId in idsNeeded){
          if(notFirst){
            idString+=","
          }

          idString+=curId
          notFirst = true;
        }

        syno.ss.getLiveViewPathCamera({'idList':idsNeeded}, function(liveViewError,liveViewData){
          if(typeof liveViewData !== "undefined"){
            for(var curResIdx in liveViewData){
              var curCamId = liveViewData[curResIdx]["id"]
              var curCamName = syno.idNameMap[curCamId]
              curDsResult[curCamName] = liveViewData[curResIdx]["mjpegHttpPath"]
            }
        
            console.log("Send DS info of ds: "+syno.idx)
            self.sendSocketNotification("DS_STREAM_INFO",{
              dsIdx: syno.idx,
              camStreams: curDsResult,
            })
          } else {
            console.log(JSON.stringify(liveViewError))
          }    
        });
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
      self.getStreamUrls(payload)
    } else if (notification === "REFRESH_COOKIE"){
      for(var curDsIdx in this.ds){
        this.ds[curDsIdx].dsm.getInfo(function(error,data){
          console.log("Refreshed cookie of ds with index "+curDs)
        })
      }
    }
  }
})
