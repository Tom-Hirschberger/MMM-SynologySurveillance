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
    provideDummyUrlAfterIterations: -1
  },

  /**
   * Apply any styles, if we have any.
   */
  getStyles: function() {
    const self = this
    if (self.config.vertical) {
      return ["synology-surveillance_v.css", "font-awesome.css"];
    } else {
      return ["synology-surveillance_h.css", "font-awesome.css"];
    }
  },

  start: function() {
    const self = this
    self.dsStreamInfo = [];
    self.dsPresetInfo = {};
    self.dsPresetCurPosition = {};
    Log.info("Starting module: " + self.name);
    self.order = [];
    self.curBigIdx = 0;
    self.currentProfile = "";
    self.currentProfilePattern = new RegExp(".*");

    if (self.config.order !== null) {
      var nameDsCamIdxMap = {};
      for (var curDsIdx = 0; curDsIdx < self.config.ds.length; curDsIdx++) {
        self.dsPresetInfo[curDsIdx] = {};
        self.dsPresetCurPosition[curDsIdx] = {};
        for (
          var curCamIdx = 0;
          curCamIdx < self.config.ds[curDsIdx].cams.length;
          curCamIdx++
        ) {
          self.dsPresetInfo[curDsIdx][
            self.config.ds[curDsIdx].cams[curCamIdx].name
          ] = {};
          self.dsPresetCurPosition[curDsIdx][
            self.config.ds[curDsIdx].cams[curCamIdx].name
          ] = 0;
          if (
            typeof self.config.ds[curDsIdx].cams[curCamIdx].alias !==
            "undefined"
          ) {
            var curCamName = self.config.ds[curDsIdx].cams[curCamIdx].alias;
          } else {
            var curCamName = self.config.ds[curDsIdx].cams[curCamIdx].name;
          }
          // console.log("Mapping cam name: "+curCamName+" to ds "+curDsIdx+" and cam id "+curCamIdx)
          nameDsCamIdxMap[curCamName] = [
            curDsIdx,
            curCamIdx,
            self.config.ds[curDsIdx].cams[curCamIdx].name
          ];
        }
      }

      for (
        var curOrderIdx = 0;
        curOrderIdx < self.config.order.length;
        curOrderIdx++
      ) {
        var curOrderName = self.config.order[curOrderIdx];
        if (typeof nameDsCamIdxMap[curOrderName] !== "undefined") {
          var curRes = [
            nameDsCamIdxMap[curOrderName][0],
            nameDsCamIdxMap[curOrderName][1],
            curOrderName,
            nameDsCamIdxMap[curOrderName][2]
          ];
          // console.log("Pushing to order (special): "+JSON.stringify(curRes))
          self.order.push(curRes);
        }
        // else {
        //   console.log("Skipping unknown cam: "+curOrderName)
        // }
      }
    } else {
      for (var curDsIdx = 0; curDsIdx < self.config.ds.length; curDsIdx++) {
        self.dsPresetInfo[curDsIdx] = {};
        self.dsPresetCurPosition[curDsIdx] = {};
        for (
          var curCamIdx = 0;
          curCamIdx < self.config.ds[curDsIdx].cams.length;
          curCamIdx++
        ) {
          self.dsPresetInfo[curDsIdx][
            self.config.ds[curDsIdx].cams[curCamIdx].name
          ] = {};
          self.dsPresetCurPosition[curDsIdx][
            self.config.ds[curDsIdx].cams[curCamIdx].name
          ] = 0;
          if (
            typeof self.config.ds[curDsIdx].cams[curCamIdx].alias !==
            "undefined"
          ) {
            var curCamName = self.config.ds[curDsIdx].cams[curCamIdx].alias;
          } else {
            var curCamName = self.config.ds[curDsIdx].cams[curCamIdx].name;
          }
          var curRes = [curDsIdx, curCamIdx, curCamName];
          // console.log("Pushing to order (regular): "+JSON.stringify(curRes))
          self.order.push([
            curDsIdx,
            curCamIdx,
            curCamName,
            self.config.ds[curDsIdx].cams[curCamIdx].name
          ]);
        }
      }
    }

    self.sendSocketNotification("CONFIG", self.config);
    self.sendSocketNotification("INIT_DS");

    setTimeout(() => {
      self.sendRefreshUrlRequestAndResetTimer();
    }, self.config.urlRefreshInterval * 1000);
  },

  sendRefreshUrlRequestAndResetTimer: function() {
    const self = this
    self.sendSocketNotification("REFRESH_URLS");
    setTimeout(() => {
      self.sendRefreshUrlRequestAndResetTimer();
    }, self.config.urlRefreshInterval * 1000);
  },

  getDom: function() {
    const self = this;
    const wrapper = document.createElement("div");
    wrapper.className = "synology-surveillance";

    if (self.config.vertical && self.config.showOneBig) {
      if (typeof self.order[self.curBigIdx] !== "undefined") {
        let curDsIdx = self.order[self.curBigIdx][0];
        let curCamIdx = self.order[self.curBigIdx][1];
        let curCamAlias = self.order[self.curBigIdx][2];
        let curCamName = self.config.ds[curDsIdx].cams[curCamIdx].name;
        let addTimestamp = self.config.ds[curDsIdx].cams[curCamIdx].appendTimestampToCamUrl || self.config.appendTimestampToCamUrl

        let camWrapper = document.createElement("div");
        camWrapper.className =
          "camWrapper big " + curDsIdx + "_" + curCamIdx + " " + curCamAlias;
        if (self.config.showBigCamName) {
          let camNameWrapper = document.createElement("div");
          camNameWrapper.className = "name";
          camNameWrapper.innerHTML = curCamAlias + "<br>";
          camWrapper.appendChild(camNameWrapper);
        }

        let innerCamWrapper = document.createElement("div");
        let innerCamWrapperClassName = "innerCamWrapper big";
        if (
          typeof self.dsStreamInfo[curDsIdx] !== "undefined" &&
          typeof self.dsStreamInfo[curDsIdx][curCamName] !== "undefined"
        ) {
          var cam = document.createElement("img");
          cam.className = "cam";
          if (addTimestamp){
            cam.src = self.dsStreamInfo[curDsIdx][curCamName]+"&timestamp="+Math.floor(Date.now() / 1000);
          } else {
            cam.src = self.dsStreamInfo[curDsIdx][curCamName];
          }
          
        } else {
          var cam = document.createElement("i");
          cam.className = "cam nourl fa " + self.config.noUrlIcon;
          cam.addEventListener("click", () => {
            self.sendSocketNotification("REFRESH_URLS");
          });
          innerCamWrapperClassName += " nourl";
        }
        innerCamWrapper.className = innerCamWrapperClassName;
        innerCamWrapper.appendChild(cam);
        camWrapper.appendChild(innerCamWrapper);

        if (self.config.showBigPositions) {
          let innerPositionWrapper = document.createElement("div");
          innerPositionWrapper.className = "innerPositionWrapper big";
          //self.dsPresetInfo[curDsIdx][self.config.ds[curDsIdx].cams[curCamIdx].name]
          let curPosition = 0;
          if (
            typeof self.dsPresetInfo[curDsIdx] !== "undefined" &&
            typeof self.dsPresetInfo[curDsIdx][curCamName] !== "undefined"
          ) {
            for (var curPreset in self.dsPresetInfo[curDsIdx][curCamName]) {
              let thisPosition = curPosition;
              console.log(
                "CUR_POS: " +
                  curPosition +
                  " curActive: " +
                  self.dsPresetCurPosition[curDsIdx][curCamName]
              );
              let curPositionName =
                self.dsPresetInfo[curDsIdx][curCamName][curPreset].name;

              var position = document.createElement("div");
              //self.dsPresetCurPosition[curDsIdx][self.config.ds[curDsIdx].cams[curCamIdx].name]
              position.className = "position big";
              if (
                self.dsPresetCurPosition[curDsIdx][curCamName] === thisPosition
              ) {
                var positionSelected = document.createElement("div");
                positionSelected.className = "selected";
                position.appendChild(positionSelected);
              }

              position.addEventListener("click", () => {
                self.dsPresetCurPosition[curDsIdx][curCamName] = thisPosition;
                self.updateDom(self.config.animationSpeed);
                self.sendSocketNotification("DS_CHANGE_POSITION", {
                  dsIdx: curDsIdx,
                  camName: curCamName,
                  position: thisPosition
                });
              });
              innerPositionWrapper.appendChild(position);
              curPosition += 1;
            }
          }
          camWrapper.appendChild(innerPositionWrapper);
        }
        wrapper.appendChild(camWrapper);
      }
    }

    for (let curOrderIdx = 0; curOrderIdx < self.order.length; curOrderIdx++) {
      let curDsIdx = self.order[curOrderIdx][0];
      let curCamIdx = self.order[curOrderIdx][1];
      let curCamAlias = self.order[curOrderIdx][2];
      let curCamName = self.config.ds[curDsIdx].cams[curCamIdx].name;
      let addTimestamp = self.config.ds[curDsIdx].cams[curCamIdx].appendTimestampToCamUrl || self.config.appendTimestampToCamUrl

      if (
        typeof self.config.ds[curDsIdx].cams[curCamIdx].profiles ===
          "undefined" ||
        self.currentProfilePattern.test(
          self.config.ds[curDsIdx].cams[curCamIdx].profiles
        )
      ) {
        if (
          self.config.showUnreachableCams ||
          (typeof self.dsStreamInfo[curDsIdx] !== "undefined" &&
            typeof self.dsStreamInfo[curDsIdx][curCamName] !== "undefined")
        ) {
          if (!self.config.showOneBig || curOrderIdx !== self.curBigIdx) {
            var camWrapper = document.createElement("div");
            camWrapper.className =
              "camWrapper " + curDsIdx + "_" + curCamIdx + " " + curCamAlias;

            if (self.config.showCamName) {
              var camNameWrapper = document.createElement("div");
              camNameWrapper.className = "name";
              camNameWrapper.innerHTML = curCamAlias;
              if (self.config.showOneBig) {
                camNameWrapper.addEventListener("click", () => {
                  self.sendSocketNotification("SYNO_SS_CHANGE_CAM", {
                    id: curOrderIdx
                  });
                });
              }

              camWrapper.appendChild(camNameWrapper);
            }

            var innerCamWrapper = document.createElement("div");
            var innerCamWrapperClassName = "innerCamWrapper";
            if (self.config.showOneBig) {
              innerCamWrapper.addEventListener("click", () => {
                self.sendSocketNotification("SYNO_SS_CHANGE_CAM", {
                  id: curOrderIdx
                });
              });
            }
            if (
              typeof self.dsStreamInfo[curDsIdx] !== "undefined" &&
              typeof self.dsStreamInfo[curDsIdx][curCamName] !== "undefined"
            ) {
              var cam = document.createElement("img");
              cam.className = "cam";
              if (addTimestamp){
                cam.src = self.dsStreamInfo[curDsIdx][curCamName]+"&timestamp="+Math.floor(Date.now() / 1000);
              } else {
                cam.src = self.dsStreamInfo[curDsIdx][curCamName];
              }
            } else {
              var cam = document.createElement("i");
              cam.className = "cam nourl fa " + self.config.noUrlIcon;
              cam.addEventListener("click", () => {
                self.sendSocketNotification("REFRESH_URLS");
              });
              innerCamWrapperClassName += " nourl";
            }
            innerCamWrapper.className = innerCamWrapperClassName;
            innerCamWrapper.appendChild(cam);
            camWrapper.appendChild(innerCamWrapper);

            if (self.config.showPositions) {
              let innerPositionWrapper = document.createElement("div");
              innerPositionWrapper.className = "innerPositionWrapper";
              let curPosition = 0;
              if (
                typeof self.dsPresetInfo[curDsIdx] !== "undefined" &&
                typeof self.dsPresetInfo[curDsIdx][curCamName] !== "undefined"
              ) {
                for (var curPreset in self.dsPresetInfo[curDsIdx][curCamName]) {
                  let thisPosition = curPosition;
                  let curPositionName =
                    self.dsPresetInfo[curDsIdx][curCamName][curPreset].name;

                  var position = document.createElement("div");
                  position.className = "position";
                  if (
                    self.dsPresetCurPosition[curDsIdx][curCamName] ===
                    curPosition
                  ) {
                    var positionSelected = document.createElement("div");
                    positionSelected.className = "selected";
                    position.appendChild(positionSelected);
                  }
                  position.addEventListener("click", () => {
                    self.dsPresetCurPosition[curDsIdx][curCamName] =
                      thisPosition;
                    self.updateDom(self.config.animationSpeed);
                    self.sendSocketNotification("DS_CHANGE_POSITION", {
                      dsIdx: curDsIdx,
                      camName: curCamName,
                      position: thisPosition
                    });
                  });
                  innerPositionWrapper.appendChild(position);
                  curPosition += 1;
                }
              }
              camWrapper.appendChild(innerPositionWrapper);
            }
            wrapper.appendChild(camWrapper);
          } else {
            if (self.config.vertical && self.config.addBigToNormal) {
              var camWrapper = document.createElement("div");
              camWrapper.className =
                "camWrapper currentBig " +
                curDsIdx +
                "_" +
                curCamIdx +
                " " +
                curCamAlias;

              if (self.config.showCamName) {
                var camNameWrapper = document.createElement("div");
                camNameWrapper.className = "name";
                camNameWrapper.innerHTML = curCamAlias;
                camWrapper.appendChild(camNameWrapper);
              }

              var innerCamWrapper = document.createElement("div");
              innerCamWrapper.className = "innerCamWrapper currentBig";
              var icon = document.createElement("i");
              icon.className =
                "cam currentBig far " + self.config.currentBigIcon;
              innerCamWrapper.appendChild(icon);
              camWrapper.appendChild(innerCamWrapper);
              wrapper.appendChild(camWrapper);
            } else if (!self.config.vertical) {
              var camWrapper = document.createElement("div");
              camWrapper.className =
                "camWrapper big " +
                curDsIdx +
                "_" +
                curCamIdx +
                " " +
                curCamAlias;
              if (self.config.showBigCamName) {
                var camNameWrapper = document.createElement("div");
                camNameWrapper.className = "name";
                camNameWrapper.innerHTML = curCamAlias + "<br>";
                camWrapper.appendChild(camNameWrapper);
              }

              var innerCamWrapper = document.createElement("div");
              var innerCamWrapperClassName = "innerCamWrapper big";
              if (
                typeof self.dsStreamInfo[curDsIdx] !== "undefined" &&
                typeof self.dsStreamInfo[curDsIdx][curCamName] !== "undefined"
              ) {
                var cam = document.createElement("img");
                cam.className = "cam";
                if (addTimestamp){
                  cam.src = self.dsStreamInfo[curDsIdx][curCamName]+"&timestamp="+Math.floor(Date.now() / 1000);
                } else {
                  cam.src = self.dsStreamInfo[curDsIdx][curCamName];
                }
              } else {
                var cam = document.createElement("i");
                cam.className = "cam nourl fa " + self.config.noUrlIcon;
                cam.addEventListener("click", () => {
                  self.sendSocketNotification("REFRESH_URLS");
                });
                innerCamWrapperClassName += " nourl";
              }
              innerCamWrapper.className = innerCamWrapperClassName;
              innerCamWrapper.appendChild(cam);
              camWrapper.appendChild(innerCamWrapper);

              if (self.config.showBigPositions) {
                let innerPositionWrapper = document.createElement("div");
                innerPositionWrapper.className = "innerPositionWrapper big";
                //self.dsPresetInfo[curDsIdx][self.config.ds[curDsIdx].cams[curCamIdx].name]
                let curPosition = 0;
                if (
                  typeof self.dsPresetInfo[curDsIdx] !== "undefined" &&
                  typeof self.dsPresetInfo[curDsIdx][curCamName] !== "undefined"
                ) {
                  for (var curPreset in self.dsPresetInfo[curDsIdx][
                    curCamName
                  ]) {
                    // let curPosition = self.dsPresetInfo[curDsIdx][curCamName][curPreset].position
                    // console.log("CUR_POS: "+curPosition + " curActive: "+self.dsPresetCurPosition[curDsIdx][curCamName])
                    let curPositionName =
                      self.dsPresetInfo[curDsIdx][curCamName][curPreset].name;

                    var position = document.createElement("div");
                    //self.dsPresetCurPosition[curDsIdx][self.config.ds[curDsIdx].cams[curCamIdx].name]
                    position.className = "position big";
                    if (
                      self.dsPresetCurPosition[curDsIdx][curCamName] ===
                      curPosition
                    ) {
                      var positionSelected = document.createElement("div");
                      positionSelected.className = "selected";
                      position.appendChild(positionSelected);
                    }
                    let thisPosition = curPosition;
                    position.addEventListener("click", () => {
                      self.dsPresetCurPosition[curDsIdx][curCamName] =
                        thisPosition;
                      self.updateDom(self.config.animationSpeed);
                      self.sendSocketNotification("DS_CHANGE_POSITION", {
                        dsIdx: curDsIdx,
                        camName: curCamName,
                        position: thisPosition
                      });
                    });
                    innerPositionWrapper.appendChild(position);
                    curPosition += 1;
                  }
                }
                camWrapper.appendChild(innerPositionWrapper);
              }
              wrapper.appendChild(camWrapper);
            }
          }
        }
      }
    }

    return wrapper;
  },

  resume: function () {
    const self = this
    if (self.config.updateDomOnShow){
      self.updateDom();
    }
  },

  getNextCamId: function (curId, type = 1) {
    const self = this
    var nextCamId = curId;
    if (type === 1) {
      for (var i = 0; i < self.order.length; i++) {
        nextCamId = curId + 1;
        if (nextCamId >= self.order.length) {
          nextCamId = 0;
        }
        var curDsIdx = self.order[nextCamId][0];
        var curCamId = self.order[nextCamId][1];
        if (
          typeof self.config.ds[curDsIdx].cams[curCamId].profiles ===
            "undefined" ||
          self.currentProfilePattern.test(
            self.config.ds[curDsIdx].cams[curCamId].profiles
          )
        ) {
          return nextCamId;
        }
      }
    } else if (type === -1) {
      for (var i = 0; i < self.order.length; i++) {
        nextCamId = curId - 1;
        if (nextCamId < 0) {
          nextCamId = self.order.length - 1;
        }
        var curDsIdx = self.order[nextCamId][0];
        var curCamId = self.order[nextCamId][1];
        if (
          typeof self.config.ds[curDsIdx].cams[curCamId].profiles ===
            "undefined" ||
          self.currentProfilePattern.test(
            self.config.ds[curDsIdx].cams[curCamId].profiles
          )
        ) {
          return nextCamId;
        }
      }
    } else if (type === 0) {
      var curDsIdx = self.order[curId][0];
      var curCamId = self.order[curId][1];
      if (
        typeof self.config.ds[curDsIdx].cams[curCamId].profiles ===
          "undefined" ||
        self.currentProfilePattern.test(
          self.config.ds[curDsIdx].cams[curCamId].profiles
        )
      ) {
        return curId;
      } else {
        return self.getNextCamId(curId, 1);
      }
    }

    return nextCamId;
  },

  getNextPositionIdx: function (dsIdx, camName, type = 1) {
    const self = this
    var nextPostion = self.dsPresetCurPosition[dsIdx][camName];
    if (
      typeof self.dsPresetInfo[dsIdx] !== "undefined" &&
      typeof self.dsPresetInfo[dsIdx][camName] !== "undefined" &&
      Object.keys(self.dsPresetInfo[dsIdx][camName]).length > 0
    ) {
      if (type === 1) {
        nextPostion += 1;
        if (
          nextPostion >= Object.keys(self.dsPresetInfo[dsIdx][camName]).length
        ) {
          nextPostion = 0;
        }
      } else if (type === -1) {
        nextPostion -= 1;
        if (nextPostion < 0) {
          nextPostion =
            Object.keys(self.dsPresetInfo[dsIdx][camName]).length - 1;
        }
      }
    }
    return nextPostion;
  },

  notificationReceived: function (notification, payload) {
    const self = this
    if (notification === "SYNO_SS_NEXT_CAM") {
      self.curBigIdx = self.getNextCamId(self.curBigIdx, 1);
      self.updateDom(self.config.animationSpeed);
    } else if (notification === "SYNO_SS_PREVIOUS_CAM") {
      self.curBigIdx = self.getNextCamId(self.curBigIdx, -1);
      self.updateDom(self.config.animationSpeed);
    } else if (notification === "SYNO_SS_CHANGE_CAM") {
      console.log("Got notification to change cam to: " + payload.id);
      if (typeof self.order[payload.id] !== "undefined") {
        self.curBigIdx = self.payload.id;
        self.updateDom(self.config.animationSpeed);
      }
    } else if (notification === "SYNO_SS_NEXT_POSITION") {
      if (
        typeof payload.dsIdx !== "undefined" &&
        typeof payload.camName !== "undefined"
      ) {
        var dsIdx = payload.dsIdx;
        var camName = payload.camName;
      } else {
        var dsIdx = self.order[self.curBigIdx][0];
        var camName = self.order[self.curBigIdx][3];
      }
      var position = self.getNextPositionIdx(dsIdx, camName, 1);
      self.dsPresetCurPosition[dsIdx][camName] = position;

      self.sendSocketNotification("DS_CHANGE_POSITION", {
        dsIdx: dsIdx,
        camName: camName,
        position: position
      });
      if (self.config.showBigPositions || self.config.showPositions) {
        self.updateDom(self.config.animationSpeed);
      }
    } else if (notification === "SYNO_SS_PREVIOUS_POSITION") {
      if (
        typeof payload.dsIdx !== "undefined" &&
        typeof payload.camName !== "undefined"
      ) {
        var dsIdx = payload.dsIdx;
        var camName = payload.camName;
      } else {
        var dsIdx = self.order[self.curBigIdx][0];
        var camName = self.order[self.curBigIdx][3];
      }
      var position = self.getNextPositionIdx(dsIdx, camName, -1);
      self.dsPresetCurPosition[dsIdx][camName] = position;

      self.sendSocketNotification("DS_CHANGE_POSITION", {
        dsIdx: dsIdx,
        camName: camName,
        position: position
      });
      if (self.config.showBigPositions || self.config.showPositions) {
        self.updateDom(self.config.animationSpeed);
      }
    } else if (notification === "SYNO_SS_CHANGE_POSITION") {
      self.sendSocketNotification("DS_CHANGE_POSITION", {
        dsIdx: payload.dsIdx,
        camName: payload.camName,
        position: payload.position
      });
      self.dsPresetCurPosition[payload.dsIdx][payload.camName] =
        payload.position;
      if (self.config.showBigPositions || self.config.showPositions) {
        self.updateDom(self.config.animationSpeed);
      }
    } else if (notification === "SYNO_REFRESH_URLS") {
      self.sendSocketNotification("REFRESH_URLS");
    } else if (notification === "CHANGED_PROFILE") {
      if (typeof payload.to !== "undefined") {
        self.currentProfile = payload.to;
        self.currentProfilePattern = new RegExp("\\b" + payload.to + "\\b");
        self.curBigIdx = self.getNextCamId(self.curBigIdx, 0);
        self.updateDom(self.config.animationSpeed);
      }
    } else if (notification === "SYNO_INVALIDATE_URL"){
      self.sendSocketNotification(notification, payload)
    }
  },

  socketNotificationReceived: function (notification, payload) {
    const self = this
    if (notification === "DS_STREAM_INFO") {
      console.log("Got new Stream info of ds with id: " + payload.dsIdx);
      console.log(JSON.stringify(payload, null, 3))
      if (
        typeof self.dsStreamInfo[payload.dsIdx] !== "undefined" &&
        self.config.onlyRefreshIfUrlChanges
      ) {
        if (
          JSON.stringify(self.dsStreamInfo[payload.dsIdx]) !==
          JSON.stringify(payload.camStreams)
        ) {
          self.dsStreamInfo[payload.dsIdx] = payload.camStreams;
          self.updateDom(self.config.animationSpeed);
          console.log(
            "Some urls of ds with id " +
              payload.dsIdx +
              " changed. Updating view!"
          );
        } else {
          console.log(
            "No urls of ds with id " +
              payload.dsIdx +
              " changed. Skipping update of the view!"
          );
        }
      } else {
        console.log(
          "Did not have any url information of ds with id: " +
            payload.dsIdx +
            ". Updating view!"
        );
        self.dsStreamInfo[payload.dsIdx] = payload.camStreams;
        self.updateDom(self.config.animationSpeed);
      }
    } else if (notification === "SYNO_SS_CHANGE_CAM") {
      console.log("Got notification to change cam to: " + payload.id);
      if (typeof self.order[payload.id] !== "undefined") {
        self.curBigIdx = payload.id;
        self.updateDom(self.config.animationSpeed);
      }
    } else if (notification === "DS_PTZ_PRESET_INFO") {
      if (self.config.onlyRefreshIfUrlChanges) {
        if (
          JSON.stringify(self.dsPresetInfo[payload.dsIdx][payload.camName]) !==
          JSON.stringify(payload.ptzData)
        ) {
          self.dsPresetInfo[payload.dsIdx][payload.camName] = payload.ptzData;
          if (self.config.showBigPositions || self.config.showPositions) {
            self.updateDom(self.config.animationSpeed);
          }
        } else {
          console.log(
            "Skipping position updates of ds with id: " +
              payload.dsIdx +
              " because no values changed!"
          );
        }
      } else {
        self.dsPresetInfo[payload.dsIdx][payload.camName] = payload.ptzData;
        if (self.config.showBigPositions || self.config.showPositions) {
          self.updateDom(self.config.animationSpeed);
        }
      }
    } else if (notification === "DS_CHANGED_POSITION") {
      if (
        self.dsPresetCurPosition[payload.dsIdx][payload.camName] !==
        payload.position
      ) {
        self.dsPresetCurPosition[payload.dsIdx][payload.camName] =
          payload.position;
        self.updateDom(self.config.animationSpeed);
      }
    }
  }
});
