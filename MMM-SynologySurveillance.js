Module.register("MMM-SynologySurveillance", {
  defaults: {
    ds: [],
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
    vertical: true,
    skipOnPrivilegeError: true,
    updateDomOnShow: true,
    appendTimestampToCamUrl: true,
    apiVersion: '6.2.2',
    provideDummyUrlAfterIterations: -1,
	  imgDecodeCheckInterval: -1,
  },

  /**
   * Apply any styles, if we have any.
   */
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
    let imgElement = self.imgs[imgIdx][0]
    try {
      await imgElement.decode();
    } catch {
      console.log("Image with idx: "+imgIdx+" has an undecodeable URL. Refreshing it!")
      let src = imgElement.src;
      imgElement.src = "";
      imgElement.src = src;
      self.sendSocketNotification("REFRESH_URLS")
    }

    self.imgsTimeouts[imgIdx] = setTimeout(() => {
      self.checkImgSrc(imgIdx)
    }, self.imgs[imgIdx][1])
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
          self.sendSocketNotification("SYNO_SS_CHANGE_CAM", {
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
    if (typeof self.dsStreamInfo[curDsIdx] !== "undefined" &&
        typeof self.dsStreamInfo[curDsIdx][curCamName] !== "undefined"
    ){
      cam = document.createElement("img")
      cam.className = "cam"
      if (addTimestamp){
        cam.src = self.dsStreamInfo[curDsIdx][curCamName]+"&timestamp="+Math.floor(Date.now() / 1000)
      } else {
        cam.src = self.dsStreamInfo[curDsIdx][curCamName]
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
        self.sendSocketNotification("SYNO_SS_CHANGE_CAM", {
          id: orderIdx
        })
      })
    }
    camWrapper.appendChild(innerCamWrapper)

    if (showPositions) {
      let innerPositionWrapper = document.createElement("div")
      innerPositionWrapper.className = "innerPositionWrapper"
      additionalClasses.forEach(element => innerPositionWrapper.classList.add(element))

      if (typeof self.dsPresetInfo[curDsIdx] !== "undefined" &&
          typeof self.dsPresetInfo[curDsIdx][curCamName] !== "undefined"
      ){
        for (let curPosition = 0; curPosition < self.dsPresetInfo[curDsIdx][curCamName].length; curPosition++) {
          let position = document.createElement("div");
          position.className = "position"
          additionalClasses.forEach(element => position.classList.add(element))
          if (self.dsPresetCurPosition[curDsIdx][curCamName] === curPosition) {
            let positionSelected = document.createElement("div")
            positionSelected.className = "selected"
            position.appendChild(positionSelected)
          }

          position.addEventListener("click", () => {
            self.dsPresetCurPosition[curDsIdx][curCamName] = curPosition
            self.updateDom(self.config.animationSpeed)
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

  resume: function () {
    const self = this
    if (self.config.updateDomOnShow){
      self.updateDom(self.config.animationSpeed)
    }
  },

  getNextCamId: function (curId, type = 1) {
    const self = this
    let nextCamId = curId
    if (type === 1) {
      for (let i = 0; i < self.order.length; i++) {
        nextCamId = curId + 1
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
      }
    } else if (type === -1) {
      for (let i = 0; i < self.order.length; i++) {
        nextCamId = curId - 1
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
      }
    } else if (type === 0) {
      let curDsIdx = self.order[curId][0]
      let curCamId = self.order[curId][1]
      if (typeof self.config.ds[curDsIdx].cams[curCamId].profiles === "undefined" ||
          self.currentProfilePattern.test(self.config.ds[curDsIdx].cams[curCamId].profiles)
      ){
        return curId
      } else {
        return self.getNextCamId(curId, 1)
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
      console.log("Got notification to change cam to: " + payload.id)
      if (typeof self.order[payload.id] !== "undefined") {
        self.curBigIdx = self.payload.id
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
      self.dsPresetCurPosition[dsIdx][camName] = position

      self.sendSocketNotification("DS_CHANGE_POSITION", {
        dsIdx: dsIdx,
        camName: camName,
        position: position
      })
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
      self.dsPresetCurPosition[dsIdx][camName] = position

      self.sendSocketNotification("DS_CHANGE_POSITION", {
        dsIdx: dsIdx,
        camName: camName,
        position: position
      })
      if (self.config.showBigPositions || self.config.showPositions) {
        self.updateDom(self.config.animationSpeed)
      }
    } else if (notification === "SYNO_SS_CHANGE_POSITION") {
      self.sendSocketNotification("DS_CHANGE_POSITION", {
        dsIdx: payload.dsIdx,
        camName: payload.camName,
        position: payload.position
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
        self.curBigIdx = self.getNextCamId(self.curBigIdx, 0)
        self.updateDom(self.config.animationSpeed)
      }
    } else if (notification === "SYNO_INVALIDATE_URL"){
      self.sendSocketNotification(notification, payload)
    }
  },

  socketNotificationReceived: function (notification, payload) {
    const self = this
    if (notification === "DS_STREAM_INFO") {
      console.log("Got new Stream info of ds with id: " + payload.dsIdx);
      //console.log(JSON.stringify(payload, null, 3))
      if (
        typeof self.dsStreamInfo[payload.dsIdx] !== "undefined" &&
        self.config.onlyRefreshIfUrlChanges
      ){
        if (
          JSON.stringify(self.dsStreamInfo[payload.dsIdx]) !==
          JSON.stringify(payload.camStreams)
        ) {
          self.dsStreamInfo[payload.dsIdx] = payload.camStreams
          self.updateDom(self.config.animationSpeed)
          console.log("Some urls of ds with id " + payload.dsIdx + " changed. Updating view!")
        } else {
          console.log("No urls of ds with id " + payload.dsIdx + " changed. Skipping update of the view!")
        }
      } else {
        console.log("Did not have any url information of ds with id: "+ payload.dsIdx +". Updating view!")
        self.dsStreamInfo[payload.dsIdx] = payload.camStreams
        self.updateDom(self.config.animationSpeed)
      }
    } else if (notification === "SYNO_SS_CHANGE_CAM") {
      console.log("Got notification to change cam to: " + payload.id)
      if (typeof self.order[payload.id] !== "undefined") {
        self.curBigIdx = payload.id
        self.updateDom(self.config.animationSpeed)
      }
    } else if (notification === "DS_PTZ_PRESET_INFO") {
      if (self.config.onlyRefreshIfUrlChanges) {
        if (JSON.stringify(self.dsPresetInfo[payload.dsIdx][payload.camName]) !==
            JSON.stringify(payload.ptzData)
        ){
          self.dsPresetInfo[payload.dsIdx][payload.camName] = payload.ptzData
          if (self.config.showBigPositions || self.config.showPositions){
            self.updateDom(self.config.animationSpeed)
          }
        } else {
          console.log("Skipping position updates of ds with id: "+ payload.dsIdx +" because no values changed!")
        }
      } else {
        self.dsPresetInfo[payload.dsIdx][payload.camName] = payload.ptzData
        if (self.config.showBigPositions || self.config.showPositions) {
          self.updateDom(self.config.animationSpeed)
        }
      }
    } else if (notification === "DS_CHANGED_POSITION") {
      if (self.dsPresetCurPosition[payload.dsIdx][payload.camName] !== payload.position ) {
        self.dsPresetCurPosition[payload.dsIdx][payload.camName] = payload.position
        self.updateDom(self.config.animationSpeed)
      }
    }
  }
});
