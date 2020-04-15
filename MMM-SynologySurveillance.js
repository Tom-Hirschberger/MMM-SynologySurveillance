Module.register('MMM-SynologySurveillance', {

  defaults: {
    ds: [],
    columns: 2,
    order: null,
    missingIconUrl: "./MMM-SynologySurveillance/camera_icon.svg",
    showOneBig: true,
    showBigCamName: false,
    showCamName: false,
  },

  /**
   * Apply any styles, if we have any.
   */
  getStyles() {
    return ["synology-surveillance.css", "font-awesome.css"];
  },

  start() {
    this.dsStreamInfo = []
    Log.info("Starting module: " + this.name);
    this.order = []
    this.curBigIdx = 0

    if(this.config.order !== null){
      var nameDsCamIdxMap = {}
      for (var curDsIdx = 0; curDsIdx < this.config.ds.length; curDsIdx++){
        for(var curCamIdx = 0; curCamIdx < this.config.ds[curDsIdx].cams.length; curCamIdx++){
          if(typeof this.config.ds[curDsIdx].cams[curCamIdx].alias !== "undefined"){
            var curCamName = this.config.ds[curDsIdx].cams[curCamIdx].alias
          } else {
            var curCamName = this.config.ds[curDsIdx].cams[curCamIdx].name
          }
          console.log("Mapping cam name: "+curCamName+" to ds "+curDsIdx+" and cam id "+curCamIdx)
          nameDsCamIdxMap[curCamName] = [curDsIdx,curCamIdx]
        }
      }

      for(var curOrderIdx = 0; curOrderIdx < this.config.order.length; curOrderIdx++){
        var curOrderName = this.config.order[curOrderIdx]
        if(typeof nameDsCamIdxMap[curOrderName] !== "undefined"){
          var curRes = [nameDsCamIdxMap[curOrderName][0], nameDsCamIdxMap[curOrderName][1], curOrderName]
          console.log("Pushing to order (special): "+JSON.stringify(curRes))
          this.order.push(curRes)
        } else {
          console.log("Skipping unknown cam: "+curOrderName)
        }
      }
    } else {
      for (var curDsIdx = 0; curDsIdx < this.config.ds.length; curDsIdx++){
        for(var curCamIdx = 0; curCamIdx < this.config.ds[curDsIdx].cams.length; curCamIdx++){
          if(typeof this.config.ds[curDsIdx].cams[curCamIdx].alias !== "undefined"){
            var curCamName = this.config.ds[curDsIdx].cams[curCamIdx].alias
          } else {
            var curCamName = this.config.ds[curDsIdx].cams[curCamIdx].name
          }
          var curRes = [curDsIdx, curCamIdx, curCamName]
          console.log("Pushing to order (regular): "+JSON.stringify(curRes))
          this.order.push([curDsIdx, curCamIdx, curCamName])
        }
      }
    }

    this.sendSocketNotification('CONFIG', this.config);
    this.sendSocketNotification("INIT_DS")
  },

  getDom() {
    console.log("Current order: ")
    console.log(JSON.stringify(this.order, null , 2))
    console.log("Current URLs: ")
    console.log(JSON.stringify(this.dsStreamInfo, null , 2))
    const wrapper = document.createElement("table")
      wrapper.className = "synology-surveillance"

    if(this.config.showOneBig){
      if(typeof this.order[this.curBigIdx] !== "undefined"){
        var curDsIdx = this.order[this.curBigIdx][0]
        var curCamIdx = this.order[this.curBigIdx][1]
        var curCamAlias = this.order[this.curBigIdx][2]
        var curCamName = this.config.ds[curDsIdx].cams[curCamIdx].name
        var curRow = document.createElement("tr")
          curRow.className="row big"
        var curCell = document.createElement("td")
          curCell.className = "cell big "+curDsIdx+"_"+curCamIdx+" "+curCamAlias
          curCell.setAttribute("colspan", this.config.columns)
          
          var camWrapper = document.createElement("div")
            camWrapper.className = "camWrapper big"
            if(this.config.showBigCamName){
              var camNameWrapper = document.createElement("span")
                camNameWrapper.className = "name"
                camNameWrapper.innerHTML = curCamAlias + "<br>"
              camWrapper.appendChild(camNameWrapper)
            }
            var cam = document.createElement("img")
              var camClass = "cam "+curDsIdx+"_"+curCamIdx+" "+curCamAlias
              if((typeof this.dsStreamInfo[curDsIdx] !== "undefined") &&
                (typeof this.dsStreamInfo[curDsIdx][curCamName] !== "undefined")
              ){
                cam.src = this.dsStreamInfo[curDsIdx][curCamName]
              } else {
                cam.src = this.config.missingIconUrl
                camClass += " nourl"
              }
              cam.className = camClass
            camWrapper.appendChild(cam)
          curCell.appendChild(camWrapper)
                    
        curRow.appendChild(curCell)
        wrapper.appendChild(curRow)
      }
    }

    for(var curOrderIdx = 0; curOrderIdx < this.order.length; curOrderIdx++){
      var curDsIdx = this.order[curOrderIdx][0]
      var curCamIdx = this.order[curOrderIdx][1]
      var curCamAlias = this.order[curOrderIdx][2]
      var curCamName = this.config.ds[curDsIdx].cams[curCamIdx].name
      if((curOrderIdx % this.config.columns) == 0){
        curRow = document.createElement("tr")
          curRow.className = "row"
        wrapper.appendChild(curRow)
      }

      var curCell = document.createElement("td")
        curCell.className = "cell "+curDsIdx+"_"+curCamIdx+" "+curCamAlias

        if((curOrderIdx !== this.curBigIdx) || (this.config.dummyIcon === null)){
          var camWrapper = document.createElement("div")
            camWrapper.className = "camWrapper "+curDsIdx+"_"+curCamIdx+" "+curCamAlias

            if(this.config.showCamName){
              var camNameWrapper = document.createElement("span")
                camNameWrapper.className = "name"
                camNameWrapper.innerHTML = curCamAlias + "<br>"
              camWrapper.appendChild(camNameWrapper)
            }

            var cam = document.createElement("img")
              var camClass = "cam "+curDsIdx+"_"+curCamIdx+" "+curCamAlias
              if((typeof this.dsStreamInfo[curDsIdx] !== "undefined") &&
                (typeof this.dsStreamInfo[curDsIdx][curCamName] !== "undefined")
              ){
                cam.src = this.dsStreamInfo[curDsIdx][curCamName]
              } else {
                cam.src = this.config.missingIconUrl
                camClass += " nourl"
              }
              cam.className = camClass
            camWrapper.appendChild(cam)
          curCell.appendChild(camWrapper)
        } else {
          var camWrapper = document.createElement("div")
            camWrapper.className = "camWrapper currentBig "+curDsIdx+"_"+curCamIdx+" "+curCamAlias
            var iconWrapper = document.createElement("span")
              iconWrapper.className = "iconWrapper"
              var icon = document.createElement("i")
                icon.className = "far fa-hand-point-up"
              iconWrapper.appendChild(icon)
            camWrapper.appendChild(iconWrapper)
          curCell.appendChild(camWrapper)
        }
        
      curRow.appendChild(curCell)
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
