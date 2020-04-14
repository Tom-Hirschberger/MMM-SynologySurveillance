Module.register('MMM-SynologySurveillance', {

  defaults: {
  },

  /**
   * Apply any styles, if we have any.
   */
  getStyles() {
    return ['synology-surveillance.css'];
  },

  /**
   * Pseudo-constructor for our module. Sets the default current page to 0.
   */
  start() {
    this.dsStreamInfo = []

    Log.info("Starting module: " + this.name);
    this.sendSocketNotification('CONFIG', this.config);
    this.sendSocketNotification("INIT_DS")
  },

  /**
   * Render the cicles for each page, and highlighting the page we're on.
   */
  getDom() {
    const self = this
    const wrapper = document.createElement("div")
      wrapper.className = "synology-surveillance"

    console.log("DS_STREAM_INFO")
    console.log(JSON.stringify(this.dsStreamInfo))

    for (var curDsIdx = 0; curDsIdx < this.config.ds.length; curDsIdx++){
      console.log("Creating elements of ds with idx: "+curDsIdx)
      for(var curCamIdx = 0; curCamIdx < this.config.ds[curDsIdx].cams.length; curCamIdx++){
        console.log("Creating elements of cam "+curCamIdx+" of ds "+curDsIdx)
        var curCamName = this.config.ds[curDsIdx].cams[curCamIdx].name
        var camWrapper = document.createElement("img")
        if(typeof this.config.ds[curDsIdx].cams[curCamIdx].alias !== "undefined"){
          camWrapper.className = "camWrapper "+this.config.ds[curDsIdx].cams[curCamIdx].alias
          camWrapper.alt = this.config.ds[curDsIdx].cams[curCamIdx].alias
        } else {
          camWrapper.className = "camWrapper "+curCamName
          camWrapper.alt = curCamName
        }

        if(typeof this.dsStreamInfo[curDsIdx] !== "undefined"){
          if(typeof this.dsStreamInfo[curDsIdx][curCamName] !== "undefined"){
            camWrapper.src = this.dsStreamInfo[curDsIdx][curCamName]
          }
        }

        wrapper.appendChild(camWrapper)
      }
    }
    return wrapper;
  },

  notificationReceived: function(notification,payload) {
    if(notification === "CHANGED_PROFILE") {
      this.sendSocketNotification(notification,payload)
    }
  },

  socketNotificationReceived: function (notification, payload) {
    if(notification === "DS_STREAM_INFO"){
      console.log("Got new Stream info of ds with id: "+payload.dsIdx)
      this.dsStreamInfo[payload.dsIdx] = payload.camStreams
      this.updateDom()
    }
  },

});
