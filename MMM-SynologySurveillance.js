/* MagicMirror²
 * Module: MMM-SynologySurveillance
 *
 * By Tom Hirschberger
 * MIT Licensed.
 */
Module.register("MMM-SynologySurveillance", {
  defaults: {
    ds: [],
    debug: false,
    order: null,
    noUrlIcon: "fa-video-camera",
    currentBigIcon: "fa-hand-point-up",
    showOneBig: true,
    addBigToNormal: false,
    showBigCamName: false,
    showBigPositions: false,
    showPositions: true,
    showCamName: true,
    showUnreachableCams: true,
    urlRefreshInterval: 60,
    onlyRefreshIfUrlChanges: true,
    animationSpeed: 500,
    changedPositionAnimationSpeed: 0,
    vertical: true,
    updateDomOnShow: true,
    appendTimestampToCamUrl: true,
    provideDummyUrlAfterIterations: -1,
	  imgDecodeCheckInterval: -1,
    minimumTimeBetweenRefreshs: 10000,
    restoreBigAfterProfileChange: true,
    moduleIsDisplayedInEveryProfile: false
  },

  suspend: function () {
		const self = this
	},

	resume: function () {
		const self = this

		if (self.config.updateDomOnShow){
		  self.updateDom(self.config.animationSpeed)
		}
	},

  getStyles: function() {
    const self = this
    if (self.config.vertical) {
      return ["synology-surveillance_v.css", "font-awesome.css"]
    } else {
      return ["synology-surveillance_h.css", "font-awesome.css"]
    }
  },

  start: function() {
    const self = this
    Log.info("Starting module: " + self.name);

    self.imgs = []
    self.imgsTimeouts = []
    self.dsStreamInfo = []
    self.dsPresetInfo = {}
    self.dsPresetCurPosition = {}
    self.order = []
    self.curBigIdx = 0
    self.currentProfile = ""
    self.currentProfilePattern = new RegExp(".*")
    self.bigIdxPerProfile = {}
    self.allModulesStarted = false
    if (typeof self.data.classes !== "undefined"){
      self.allModulesClasses = self.data.classes.split(" ")
    } else {
      self.allModulesClasses = null
    }
    
    if (self.config.order !== null) {
      let nameDsCamIdxMap = {}
      for (let curDsIdx = 0; curDsIdx < self.config.ds.length; curDsIdx++) {
        self.dsPresetInfo[curDsIdx] = {}
        self.dsPresetCurPosition[curDsIdx] = {}
        for (
          let curCamIdx = 0;
          curCamIdx < self.config.ds[curDsIdx].cams.length;
          curCamIdx++
        ) {
            self.dsPresetInfo[curDsIdx][self.config.ds[curDsIdx].cams[curCamIdx].name] = {}
            self.dsPresetCurPosition[curDsIdx][self.config.ds[curDsIdx].cams[curCamIdx].name] = 0
            let curCamName
            if (typeof self.config.ds[curDsIdx].cams[curCamIdx].alias !== "undefined") {
              curCamName = self.config.ds[curDsIdx].cams[curCamIdx].alias
            } else {
              curCamName = self.config.ds[curDsIdx].cams[curCamIdx].name
            }

            nameDsCamIdxMap[curCamName] = [
              curDsIdx,
              curCamIdx,
              self.config.ds[curDsIdx].cams[curCamIdx].name
            ]
        }
      }

      for (
        let curOrderIdx = 0;
        curOrderIdx < self.config.order.length;
        curOrderIdx++
      ) {
        let curOrderName = self.config.order[curOrderIdx]
        if (typeof nameDsCamIdxMap[curOrderName] !== "undefined") {
          let curRes = [
            nameDsCamIdxMap[curOrderName][0],
            nameDsCamIdxMap[curOrderName][1],
            curOrderName,
            nameDsCamIdxMap[curOrderName][2]
          ]

          self.order.push(curRes)
        }
      }
    } else {
      for (let curDsIdx = 0; curDsIdx < self.config.ds.length; curDsIdx++) {
        self.dsPresetInfo[curDsIdx] = {}
        self.dsPresetCurPosition[curDsIdx] = {}
        for (
          let curCamIdx = 0;
          curCamIdx < self.config.ds[curDsIdx].cams.length;
          curCamIdx++
        ) {
            self.dsPresetInfo[curDsIdx][self.config.ds[curDsIdx].cams[curCamIdx].name] = {}
            self.dsPresetCurPosition[curDsIdx][self.config.ds[curDsIdx].cams[curCamIdx].name] = 0
            let curCamName
            if (typeof self.config.ds[curDsIdx].cams[curCamIdx].alias !== "undefined" ) {
              curCamName = self.config.ds[curDsIdx].cams[curCamIdx].alias
            } else {
              curCamName = self.config.ds[curDsIdx].cams[curCamIdx].name
            }
            self.order.push([
              curDsIdx,
              curCamIdx,
              curCamName,
              self.config.ds[curDsIdx].cams[curCamIdx].name
            ]);
        }
      }
    }

    self.sendSocketNotification("CONFIG", self.config)
    self.sendSocketNotification("INIT_DS")

    setTimeout(() => {
      self.sendRefreshUrlRequestAndResetTimer()
    }, self.config.urlRefreshInterval * 1000)
  },

  sendRefreshUrlRequestAndResetTimer: function() {
    const self = this
    self.sendSocketNotification("REFRESH_URLS")
    setTimeout(() => {
      self.sendRefreshUrlRequestAndResetTimer()
    }, self.config.urlRefreshInterval * 1000)
  },

  checkImgSrc: async function (imgIdx) {
    const self = this
    let imgInfo = self.imgs[imgIdx]
    let imgElement = imgInfo[0]
    try {
      await imgElement.decode();
    } catch {
      if (self.config.debug){
        console.log(self.name+": Image with idx: "+imgIdx+" has an undecodeable URL. Refreshing it!")
      }
      let src = imgElement.src;
      imgElement.src = "";
      imgElement.src = src;
      self.sendSocketNotification("REFRESH_URLS")
    }

    if (typeof self.imgs !== "undefined"){
      if (typeof self.imgsTimeouts[imgIdx] !== "undefined"){
        clearTimeout(self.imgsTimeouts[imgIdx])
      }
      self.imgsTimeouts[imgIdx] = setTimeout(() => {
        self.checkImgSrc(imgIdx)
      }, imgInfo[1])
    }
  },

  getCamElement: function(orderIdx, additionalClasses, showCamName, showPositions, addCamEventListener, iconClasses) {
    const self = this
    let camConfig = self.order[orderIdx]

    let curDsIdx = camConfig[0]
    let curCamIdx = camConfig[1]
    let curCamAlias = camConfig[2]
    let curCamGlobalConfig = self.config.ds[curDsIdx].cams[curCamIdx]

    let curCamName = curCamGlobalConfig.name
    let addTimestamp = self.config.appendTimestampToCamUrl
    if (typeof curCamGlobalConfig.appendTimestampToCamUrl !== "undefined"){
      addTimestamp = curCamGlobalConfig.appendTimestampToCamUrl
    }

    let imgDecodeCheckInterval = self.config.imgDecodeCheckInterval
    if (typeof curCamGlobalConfig.imgDecodeCheckInterval !== "undefined"){
      imgDecodeCheckInterval = curCamGlobalConfig.imgDecodeCheckInterval
    }

    imgDecodeCheckInterval = imgDecodeCheckInterval * 1000

    let camWrapper = document.createElement("div")
    camWrapper.className = "camWrapper"
    camWrapper.classList.add(curDsIdx + "_" + curCamIdx)
    camWrapper.classList.add(curCamAlias)
    additionalClasses.forEach(element => camWrapper.classList.add(element))

    if (showCamName) {
      let camNameWrapper = document.createElement("div")
      camNameWrapper.className = "name"
      additionalClasses.forEach(element => camNameWrapper.classList.add(element))
      camNameWrapper.innerHTML = curCamAlias

      if (addCamEventListener) {
        camNameWrapper.addEventListener("click", () => {
          self.notificationReceived("SYNO_SS_CHANGE_CAM", {
            id: orderIdx
          })
        })
      }

      camWrapper.appendChild(camNameWrapper)
    }

    let innerCamWrapper = document.createElement("div")
    innerCamWrapper.className = "innerCamWrapper"
    additionalClasses.forEach(element => innerCamWrapper.classList.add(element))
    let cam
    let camId
    if ( typeof self.dsStreamInfo[curDsIdx] !== "undefined" &&
         typeof self.dsStreamInfo[curDsIdx].camNameIdMapping !== "undefined" &&
         typeof self.dsStreamInfo[curDsIdx].camNameIdMapping[curCamName] !== "undefined"){
      camId = self.dsStreamInfo[curDsIdx].camNameIdMapping[curCamName]
    }
    if (typeof camId !== "undefined" &&
        typeof self.dsStreamInfo[curDsIdx] !== "undefined" &&
        typeof self.dsStreamInfo[curDsIdx].infosPerId !== "undefined" &&
        typeof self.dsStreamInfo[curDsIdx].infosPerId[camId] !== "undefined"
    ){
      cam = document.createElement("img")
      cam.className = "cam"
      if (addTimestamp){
        cam.src = self.dsStreamInfo[curDsIdx].infosPerId[camId].streamInfo+"&timestamp="+Math.floor(Date.now() / 1000)
      } else {
        cam.src = self.dsStreamInfo[curDsIdx].infosPerId[camId].streamInfo
      }
      if (imgDecodeCheckInterval > 0){
        self.imgs.push([cam,imgDecodeCheckInterval])
      }
    } else {
      cam = document.createElement("i")
      cam.className = "cam nourl"
      iconClasses.forEach(element => cam.classList.add(element))
      cam.addEventListener("click", () => {
        self.sendSocketNotification("REFRESH_URLS")
      });
      innerCamWrapper.classList.add("nourl")
    }
    innerCamWrapper.appendChild(cam)
    if (addCamEventListener) {
      innerCamWrapper.addEventListener("click", () => {
        self.notificationReceived("SYNO_SS_CHANGE_CAM", {
          id: orderIdx
        })
      })
    }
    camWrapper.appendChild(innerCamWrapper)

    if (showPositions) {
      let innerPositionWrapper = document.createElement("div")
      innerPositionWrapper.className = "innerPositionWrapper"
      additionalClasses.forEach(element => innerPositionWrapper.classList.add(element))

      if (typeof camId !== "undefined" &&
          typeof self.dsStreamInfo[curDsIdx] !== "undefined" &&
          typeof self.dsStreamInfo[curDsIdx].infosPerId !== "undefined" &&
          typeof self.dsStreamInfo[curDsIdx].infosPerId[camId] !== "undefined" && 
          typeof self.dsStreamInfo[curDsIdx].infosPerId[camId].presets !== "undefined"
      ){
        for (let curPosition = 0; curPosition < self.dsStreamInfo[curDsIdx].infosPerId[camId].presets.length; curPosition++) {
          let position = document.createElement("div");
          position.className = "position"
          additionalClasses.forEach(element => position.classList.add(element))
          if (self.dsPresetCurPosition[curDsIdx][curCamName] === curPosition) {
            let positionSelected = document.createElement("div")
            positionSelected.className = "selected"
            position.appendChild(positionSelected)
          }

          position.addEventListener("click", () => {
            self.sendSocketNotification("DS_CHANGE_POSITION", {
              dsIdx: curDsIdx,
              camName: curCamName,
              position: curPosition
            })
          })
          innerPositionWrapper.appendChild(position)
        }
      }
      camWrapper.appendChild(innerPositionWrapper)
    }

    return camWrapper
  },

  getBigInNormalCamDummyElement: function(orderIdx, additionalClasses, showCamName, showPositions, iconClasses){
    const self = this
    let camConfig = self.order[orderIdx]
    let curDsIdx = camConfig[0]
    let curCamIdx = camConfig[1]
    let curCamAlias = camConfig[2]

    let camWrapper = document.createElement("div")
    camWrapper.className = "camWrapper"
    camWrapper.classList.add(curDsIdx +"_"+ curCamIdx)
    camWrapper.classList.add(curCamAlias)
    additionalClasses.forEach(element => camWrapper.classList.add(element))

    if (showCamName) {
      let camNameWrapper = document.createElement("div")
      camNameWrapper.className = "name"
      additionalClasses.forEach(element => camNameWrapper.classList.add(element))
      camNameWrapper.innerHTML = curCamAlias
      camWrapper.appendChild(camNameWrapper)
    }

    let innerCamWrapper = document.createElement("div")
    innerCamWrapper.className = "innerCamWrapper"
    additionalClasses.forEach(element => innerCamWrapper.classList.add(element))
    let icon = document.createElement("i")
    icon.className = "cam"
    additionalClasses.forEach(element => icon.classList.add(element))
    iconClasses.forEach(element => icon.classList.add(element))
    innerCamWrapper.appendChild(icon)
    camWrapper.appendChild(innerCamWrapper)

    if (showPositions) {
      let innerPositionWrapper = document.createElement("div")
      innerPositionWrapper.className = "innerPositionWrapper"
      additionalClasses.forEach(element => innerPositionWrapper.classList.add(element))
      camWrapper.appendChild(innerPositionWrapper)
    }

    return camWrapper
  },

  getDom: function() {
    const self = this

    const wrapper = document.createElement("div")
    wrapper.className = "synology-surveillance"

    for (let imgIdx = 0; imgIdx < self.imgsTimeouts.length; imgIdx++){
      clearTimeout(self.imgsTimeouts[imgIdx])
    }

    self.imgsTimeouts = []
    self.imgs = []

      //if we are in vertical layout and one cam should be displayed as big one we need to add the big one
      //as first cam
      if (self.config.vertical && self.config.showOneBig) {
        if (typeof self.order[self.curBigIdx] !== "undefined") {
          let camWrapper = self.getCamElement(self.curBigIdx, ["big"], self.config.showBigCamName, self.config.showBigPositions, false, ["fa", self.config.noUrlIcon])
          wrapper.appendChild(camWrapper)
        }
      }

      //now lets check all other cams
      for (let curOrderIdx = 0; curOrderIdx < self.order.length; curOrderIdx++) {
        let curDsIdx = self.order[curOrderIdx][0];
        let curCamIdx = self.order[curOrderIdx][1];
        let curCamName = self.config.ds[curDsIdx].cams[curCamIdx].name;

        //maybe our job for this cam ends here cause a profile string is configured and the current profile does not match
        if (typeof self.config.ds[curDsIdx].cams[curCamIdx].profiles === "undefined" ||
            self.currentProfilePattern.test(self.config.ds[curDsIdx].cams[curCamIdx].profiles)
        ){
          if (self.config.showUnreachableCams ||
                ( typeof self.dsStreamInfo[curDsIdx] !== "undefined" &&
                  typeof self.dsStreamInfo[curDsIdx][curCamName] !== "undefined"
                )
          ){
            //either we should show a dummy for unreachable cams or we do have stream info for this one
            if (!this.config.showOneBig || curOrderIdx !== this.curBigIdx) {
              //the current cam is a "normal" one or we do not display one as big either
              let camWrapper = self.getCamElement(curOrderIdx,[],self.config.showCamName,self.config.showPositions,self.config.showOneBig,["fa", this.config.noUrlIcon])
              wrapper.appendChild(camWrapper)
            } else {
              if (self.config.vertical && self.config.addBigToNormal) {
                //if we are in vertical layout and one camera is shown as big one we can decide if
                //we want to add a dummy element to the "normal" camera list showing a icon
                let camWrapper = self.getBigInNormalCamDummyElement(curOrderIdx, ["currentBig"], self.config.showCamName, self.config.showPositions, ["far", self.config.currentBigIcon])
                wrapper.appendChild(camWrapper)
              } else if (!self.config.vertical) {
                //so we are not in vertical layout (which means we are in horizontal layout currently)
                //And we currently have the order idx of the cam that is the big one
                let camWrapper = self.getCamElement(self.curBigIdx, ["big"], self.config.showBigCamName, self.config.showBigPositions, false, ["fa", self.config.noUrlIcon])
                wrapper.appendChild(camWrapper)
              }
            }
          }
        }
      }

    for (let imgIdx = 0; imgIdx < self.imgs.length; imgIdx++){
      self.checkImgSrc(imgIdx)
    }
    
    return wrapper
  },

  getNextCamId: function (curId, type = 1) {
    const self = this
    let nextCamId = curId
    if (self.config.moduleIsDisplayedInEveryProfile || ((self.allModulesClasses != null) && ((self.currentProfile !== "") && (self.allModulesClasses.includes(self.currentProfile))))) {
    	if (self.config.debug) {
			  console.log(self.name+": Either the moduleIsDisplayedInEveryProfile is set to true or this module is currently displayed. Checking for the current big cam index and recalcualte it if needed.")
		  }
      if (type === 1) {
        //get the next cam id (current + 1)
        nextCamId = curId + 1
        for (let i = 0; i < self.order.length; i++) {
          if (nextCamId >= self.order.length) {
            nextCamId = 0
          }
          let curDsIdx = self.order[nextCamId][0]
          let curCamId = self.order[nextCamId][1]
          if (typeof self.config.ds[curDsIdx].cams[curCamId].profiles === "undefined" ||
              self.currentProfilePattern.test(self.config.ds[curDsIdx].cams[curCamId].profiles)
          ){
            return nextCamId
          }
          nextCamId = nextCamId + 1
        }
      } else if (type === -1) {
        //get the previous cam id (current - 1)
        nextCamId = curId - 1
        for (let i = 0; i < self.order.length; i++) {
          if (nextCamId < 0) {
            nextCamId = self.order.length - 1
          }
          let curDsIdx = self.order[nextCamId][0]
          let curCamId = self.order[nextCamId][1]
          if (typeof self.config.ds[curDsIdx].cams[curCamId].profiles === "undefined" ||
              self.currentProfilePattern.test(self.config.ds[curDsIdx].cams[curCamId].profiles)
          ) {
            return nextCamId
          }
          nextCamId = nextCamId - 1
        }
      } else if (type === 0) {
          //keep the current cam if possible but call the function to find the next one if the profile does not match
          if (curId < 0 || (curId >= self.order.length)){
          curId = 0
          if (self.config.debug){
            console.log(self.name+": Reset big cam idx to 0 as it is either negative or to big")
          }
          }

          if (typeof self.order[curId] !== "undefined"){
          let curDsIdx = self.order[curId][0]
          let curCamId = self.order[curId][1]

          if (typeof self.config.ds[curDsIdx].cams[curCamId].profiles === "undefined" ||
              self.currentProfilePattern.test(self.config.ds[curDsIdx].cams[curCamId].profiles)
          ){
            if (self.config.debug){
              console.log(self.name+": The cam id "+curId+" is valid for profile "+self.currentProfile+". Using it.")
            }
            return curId
          } else {
            if (self.config.debug){
              console.log(self.name+": The cam id "+curId+" is NOT valid for profile "+self.currentProfile+". Trying to find a suitable one.")
            }
            return self.getNextCamId(curId, 1)
          }
          } else {
          if (self.config.debug){
            console.log(self.name+": The order info does not contain the index "+curId+". We try to find the next higher one. If this is not possible it will be resetted!")
          }
          return self.getNextCamId(curId, 1)
          }
      }
    } else {
      if (self.config.debug) {
        console.log(self.name+": Either the this module is currently not displayed or no profiles are used. Using the current big cam idx: "+nextCamId)
      }
    }

    return nextCamId
  },

  getNextPositionIdx: function (dsIdx, camName, type = 1) {
    const self = this
    var nextPostion = self.dsPresetCurPosition[dsIdx][camName]
    if (typeof self.dsPresetInfo[dsIdx] !== "undefined" &&
        typeof self.dsPresetInfo[dsIdx][camName] !== "undefined" &&
        Object.keys(self.dsPresetInfo[dsIdx][camName]).length > 0
    ){
      if (type === 1) {
        nextPostion += 1
        if (nextPostion >= Object.keys(self.dsPresetInfo[dsIdx][camName]).length) {
          nextPostion = 0
        }
      } else if (type === -1) {
        nextPostion -= 1
        if (nextPostion < 0) {
          nextPostion = Object.keys(self.dsPresetInfo[dsIdx][camName]).length - 1
        }
      }
    }
    return nextPostion
  },

  notificationReceived: function (notification, payload) {
    const self = this
    if (notification === "SYNO_SS_NEXT_CAM") {
      self.curBigIdx = self.getNextCamId(self.curBigIdx, 1)
      self.updateDom(self.config.animationSpeed)
    } else if (notification === "SYNO_SS_PREVIOUS_CAM") {
      self.curBigIdx = self.getNextCamId(self.curBigIdx, -1)
      self.updateDom(self.config.animationSpeed)
    } else if (notification === "SYNO_SS_CHANGE_CAM") {
      if (self.config.debug){
        console.log(self.name+": Got notification to change cam to: " + payload.id)
      }
      if (typeof self.order[payload.id] !== "undefined") {
        self.curBigIdx = payload.id
        self.updateDom(self.config.animationSpeed)
      }
    } else if (notification === "SYNO_SS_NEXT_POSITION") {
      let dsIdx
      let camName
      if (typeof payload.dsIdx !== "undefined" &&
          typeof payload.camName !== "undefined"
      ){
        dsIdx = payload.dsIdx
        camName = payload.camName
      } else {
        dsIdx = self.order[self.curBigIdx][0]
        camName = self.order[self.curBigIdx][3]
      }
      let position = self.getNextPositionIdx(dsIdx, camName, 1)
      
      self.sendSocketNotification("DS_CHANGE_POSITION", {
        dsIdx: dsIdx,
        camName: camName,
        position: position,
        oldPosition: self.dsPresetCurPosition[dsIdx][camName]
      })

      self.dsPresetCurPosition[dsIdx][camName] = position
      if (self.config.showBigPositions || self.config.showPositions) {
        self.updateDom(self.config.animationSpeed)
      }
    } else if (notification === "SYNO_SS_PREVIOUS_POSITION") {
      let dsIdx
      let camName
      if (typeof payload.dsIdx !== "undefined" &&
          typeof payload.camName !== "undefined"
      ){
        dsIdx = payload.dsIdx
        camName = payload.camName
      } else {
        dsIdx = self.order[self.curBigIdx][0]
        camName = self.order[self.curBigIdx][3]
      }
      let position = self.getNextPositionIdx(dsIdx, camName, -1)

      self.sendSocketNotification("DS_CHANGE_POSITION", {
        dsIdx: dsIdx,
        camName: camName,
        position: position,
        oldPosition: self.dsPresetCurPosition[dsIdx][camName]
      })

      self.dsPresetCurPosition[dsIdx][camName] = position

      if (self.config.showBigPositions || self.config.showPositions) {
        self.updateDom(self.config.animationSpeed)
      }
    } else if (notification === "SYNO_SS_CHANGE_POSITION") {
      self.sendSocketNotification("DS_CHANGE_POSITION", {
        dsIdx: payload.dsIdx,
        camName: payload.camName,
        position: payload.position,
        oldPosition: self.dsPresetCurPosition[payload.dsIdx][payload.camName]
      })
      self.dsPresetCurPosition[payload.dsIdx][payload.camName] = payload.position;
      if (self.config.showBigPositions || self.config.showPositions) {
        self.updateDom(self.config.animationSpeed)
      }
    } else if (notification === "SYNO_REFRESH_URLS") {
      self.sendSocketNotification("REFRESH_URLS");
    } else if (notification === "CHANGED_PROFILE") {
      if (typeof payload.to !== "undefined"){
        self.currentProfile = payload.to
        self.currentProfilePattern = new RegExp("\\b" + payload.to + "\\b")

        
		  if (typeof payload.from !== "undefined"){
		    if (self.config.restoreBigAfterProfileChange){
		      self.bigIdxPerProfile[payload.from] = self.curBigIdx
		    }

		    if(typeof self.bigIdxPerProfile[self.currentProfile] !== "undefined"){
		      self.curBigIdx = self.bigIdxPerProfile[self.currentProfile]
		      if (self.config.debug){
		        console.log(self.name+": restored big cam idx is: "+self.curBigIdx)
		      }
		    }
		  }
        self.curBigIdx = self.getNextCamId(self.curBigIdx, 0)
        if (self.config.debug){
          console.log(self.name+": after profile check the used big cam idx is: "+self.curBigIdx)
        }
        self.updateDom(self.config.animationSpeed)
      } else {
        if (self.config.debug){
          console.log(self.name+": Got a invalid CHANGED_PROFILE notification with missing \"to\" payload->\n"+JSON.stringify(payload))
        }
      }
    } else if (notification === "SYNO_INVALIDATE_URL"){
      self.sendSocketNotification(notification, payload)
    } else if (notification === "ALL_MODULES_STARTED"){
      self.allModulesStarted = true
    }
  },

  socketNotificationReceived: function (notification, payload) {
    const self = this
    if (notification === "DS_STREAM_INFO") {
      if (self.config.debug){
        console.log("Got new Stream info of all ds.")
      }

      let atLeastOneChange = false
      for(let dsIdx = 0; dsIdx < payload.length; dsIdx++){
        if(self.config.onlyRefreshIfUrlChanges){
          if(
            JSON.stringify(self.dsStreamInfo[dsIdx]) !==
            JSON.stringify(payload[dsIdx].infos)
          ) {
            self.dsStreamInfo[dsIdx] = payload[dsIdx].infos
            atLeastOneChange = true
          }
        } else {
          self.dsStreamInfo[dsIdx] = payload[dsIdx].infos
        }
      }

      if ((!self.config.onlyRefreshIfUrlChanges) || atLeastOneChange){
        self.updateDom(self.config.animationSpeed)
      }
    } else if (notification === "DS_CHANGED_POSITION") {
      if (self.dsPresetCurPosition[payload.dsIdx][payload.camName] !== payload.position ) {
        self.dsPresetCurPosition[payload.dsIdx][payload.camName] = payload.position
        self.updateDom(self.config.changedPositionAnimationSpeed)
      }
    }
  }
});
