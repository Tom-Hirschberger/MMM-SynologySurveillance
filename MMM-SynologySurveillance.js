Module.register('MMM-SynologySurveillance', {

  defaults: {
    ds: [],
    columns: 2,
    order: null,
    missingIconUrl: "./MMM-SynologySurveillance/camera_icon.svg",
    showOneBig: true,
    addBigToNormal: true,
    showBigCamName: false,
    showCamName: false,
    urlRefreshInterval: 60,
    onlyRefreshIfUrlChanges: true,
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
          // console.log("Mapping cam name: "+curCamName+" to ds "+curDsIdx+" and cam id "+curCamIdx)
          nameDsCamIdxMap[curCamName] = [curDsIdx,curCamIdx]
        }
      }

      for(var curOrderIdx = 0; curOrderIdx < this.config.order.length; curOrderIdx++){
        var curOrderName = this.config.order[curOrderIdx]
        if(typeof nameDsCamIdxMap[curOrderName] !== "undefined"){
          var curRes = [nameDsCamIdxMap[curOrderName][0], nameDsCamIdxMap[curOrderName][1], curOrderName]
          // console.log("Pushing to order (special): "+JSON.stringify(curRes))
          this.order.push(curRes)
        } 
        // else {
        //   console.log("Skipping unknown cam: "+curOrderName)
        // }
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
          // console.log("Pushing to order (regular): "+JSON.stringify(curRes))
          this.order.push([curDsIdx, curCamIdx, curCamName])
        }
      }
    }

    this.sendSocketNotification('CONFIG', this.config);
    this.sendSocketNotification("INIT_DS")

    setTimeout(()=>{
      this.sendRefreshUrlRequestAndResetTimer()
    }, this.config.urlRefreshInterval * 1000)
  },

  sendRefreshUrlRequestAndResetTimer(){
    this.sendSocketNotification("REFRESH_URLS")
    setTimeout(()=>{
      this.sendRefreshUrlRequestAndResetTimer()
    }, this.config.urlRefreshInterval * 1000)
  },

  getDom() {
    const self = this
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

    var skippedCams = 0;
    for(let curOrderIdx = 0; curOrderIdx < this.order.length; curOrderIdx++){
      var curDsIdx = this.order[curOrderIdx][0]
      var curCamIdx = this.order[curOrderIdx][1]
      var curCamAlias = this.order[curOrderIdx][2]
      var curCamName = this.config.ds[curDsIdx].cams[curCamIdx].name
      if(((curOrderIdx-skippedCams) % this.config.columns) == 0){
        curRow = document.createElement("tr")
          curRow.className = "row"
        wrapper.appendChild(curRow)
      }

      var curCell = document.createElement("td")
        curCell.className = "cell "+curDsIdx+"_"+curCamIdx+" "+curCamAlias

        if(!this.config.showOneBig || (curOrderIdx !== this.curBigIdx) || (this.config.dummyIcon === null)){
          var camWrapper = document.createElement("div")
            camWrapper.className = "camWrapper "+curDsIdx+"_"+curCamIdx+" "+curCamAlias
            if(this.config.showOneBig){
              camWrapper.addEventListener("click", ()=>{self.sendSocketNotification("SYNO_SS_CHANGE_CAM", {id: curOrderIdx})})
            }

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
          if(this.config.addBigToNormal){
            var camWrapper = document.createElement("div")
            camWrapper.className = "camWrapper currentBig "+curDsIdx+"_"+curCamIdx+" "+curCamAlias
            var iconWrapper = document.createElement("span")
              iconWrapper.className = "iconWrapper"
              var icon = document.createElement("i")
                icon.className = "far fa-hand-point-up"
              iconWrapper.appendChild(icon)
            camWrapper.appendChild(iconWrapper)
            curCell.appendChild(camWrapper)
          } else {
            skippedCams += 1
          }
        }
        
      curRow.appendChild(curCell)
    }

    return wrapper;
  },

  getNextCamId: function(curCamId, type=1){
    var nextCamId = curCamId
    if(type === 1){
      nextCamId = curCamId + 1
      if(nextCamId >= this.order.length){
        nextCamId = 0
      }
    } else if(type === -1){
      nextCamId = curCamId - 1
      if(nextCamId < 0){
        nextCamId = this.order.length - 1
      }
    }

    return nextCamId
  },

  notificationReceived: function(notification,payload) {
    if(notification === "SYNO_SS_NEXT_CAM"){
      this.curBigIdx = this.getNextCamId(this.curBigIdx, 1)
      this.updateDom()
    } else if (notification === "SYNO_SS_PREVIOUS_CAM"){
      this.curBigIdx = this.getNextCamId(this.curBigIdx, -1)
      this.updateDom()
    } else if (notification === "SYNO_SS_CHANGE_CAM"){
      console.log("Got notification to change cam to: "+payload.id)
      if(typeof this.order[payload.id] !== "undefined"){
        this.curBigIdx = this.payload.id
        this.updateDom()
      }
    }
  },

  socketNotificationReceived: function (notification, payload) {
    if(notification === "DS_STREAM_INFO"){
      console.log("Got new Stream info of ds with id: "+payload.dsIdx)
      if(typeof this.dsStreamInfo[payload.dsIdx] !== "undefined") {
        for(var curKey in Object.keys(this.dsStreamInfo[payload.dsIdx])){
          if(this.dsStreamInfo[payload.dsIdx][curKey] !== payload.camStreams[curKey]){
            this.dsStreamInfo[payload.dsIdx] = payload.camStreams
            this.updateDom()
            break
          }
        }

        for(var curKey in payload.camStreams){
          if(this.dsStreamInfo[payload.dsIdx][curKey] !== payload.camStreams[curKey]){
            this.dsStreamInfo[payload.dsIdx] = payload.camStreams
            this.updateDom()
            break
          }
        }
      } else {
        this.dsStreamInfo[payload.dsIdx] = payload.camStreams
        this.updateDom()
      }
    } else if (notification === "SYNO_SS_CHANGE_CAM"){
      console.log("Got notification to change cam to: "+payload.id)
      if(typeof this.order[payload.id] !== "undefined"){
        this.curBigIdx = payload.id
        this.updateDom()
      }
    }
  },

});
