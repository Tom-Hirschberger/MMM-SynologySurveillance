const axios = require("axios").default;
const https = require("https");

const CommonErrorCodes = {
    100: "Unknown error",
    101: "Invalid parameters",
    102: "API does not exist",
    103: "Method does not exist",
    104: "This API version is not supported",
    105: "Insufficient user privilege",
    106: "Connection time out",
    107: "Multiple login detected"
}

const AuthErrorCodes = {
    100: "Unkown error",
    101: "The account parameter is not specified",
    400: "Invalid user or password",
    401: "Guest or diabled account",
    402: "Permission denied",
    403: "One time password not specified",
    404: "One time password authenticate failed",
    405: "App portal incorrect",
    405: "OTP code enforced",
    407: "Max tries (if auto blocking is set to true)",
    408: "Password Expired can not Change",
    409: "Password Expired",
    410: "Password must change (when first time use or after reset password by admin)",
    411: "Account Locked (when account max try exeed)"
}

const CamErrorCodes = {
    400: "Execution failed",
    401: "Parameter invalid",
    402: "Camera disabled"
}

const PTZErrorCodes = {
    400: "Execution failed",
    401: "Parameter invalid",
    402: "Camera disabled"
}

const PTZPresetErroCodes = {
    400: "Operation failed",
    401: "Parameter invalid"
}

class QueryApiVersionError extends Error {
    constructor(message, cause) {
        if (typeof cause.returnCode !== "undefined"){
            if (typeof CommonErrorCodes[cause.returnCode] !== "undefined"){
                message = message + "\n"+CommonErrorCodes[cause.returnCode]
            }
        }

        if (typeof cause.error !== "undefined"){
            message = message + "\n" + cause.error.toString()
        }
        super(message)
        this.cause = cause
        this.name = "QueryApiVersionError"
    }
}

class LoginError extends Error {
    constructor(message, cause) {
        if (typeof cause.returnCode!== "undefined"){
            if (typeof AuthErrorCodes[cause.returnCode] !== "undefined"){
                message = message + "\n"+AuthErrorCodes[cause.returnCode]
            } else if (typeof CommonErrorCodes[cause.returnCode] !== "undefined"){
                message = message + "\n"+CommonErrorCodes[cause.returnCode]
            }
        }
        if (typeof cause.error !== "undefined"){
            message = message + "\n" + cause.error.toString()
        }
        super(message)
        this.cause = cause
        this.name = "LoginError"
    }
}
class LogoutError extends Error {
    constructor(message, cause) {
        if (typeof cause.returnCode !== "undefined"){
            if (typeof AuthErrorCodes[cause.returnCode] !== "undefined"){
                message = message + "\n"+AuthErrorCodes[cause.returnCode]
            } else if (typeof CommonErrorCodes[cause.returnCode] !== "undefined"){
                message = message + "\n"+CommonErrorCodes[cause.returnCode]
            }
        }
        if (typeof cause.error !== "undefined"){
            message = message + "\n" + cause.error.toString()
        }
        super(message)
        this.cause = cause
        this.name = "LogoutError"
    }
}

class ListCameraError extends Error {
    constructor(message, cause) {
        if (typeof cause.returnCode !== "undefined"){
            if (typeof CamErrorCodes[cause.returnCode] !== "undefined"){
                message = message + "\n"+CamErrorCodes[cause.returnCode]
            } else if (typeof CommonErrorCodes[cause.returnCode] !== "undefined"){
                message = message + "\n"+CommonErrorCodes[cause.returnCode]
            }
        }
        if (typeof cause.error !== "undefined"){
            message = message + "\n" + cause.error.toString()
        }
        super(message)
        this.cause = cause
        this.name = "ListCameraError"
    }
}

class GetCameraStreamInfoError extends Error {
    constructor(message, cause) {
        if (typeof cause.returnCode !== "undefined"){
            if (typeof CamErrorCodes[cause.returnCode] !== "undefined"){
                message = message + "\n"+CamErrorCodes[cause.returnCode]
            } else if (typeof CommonErrorCodes[cause.returnCode] !== "undefined"){
                message = message + "\n"+CommonErrorCodes[cause.returnCode]
            }
        }
        if (typeof cause.error !== "undefined"){
            message = message + "\n" + cause.error.toString()
        }
        super(message);
        this.cause = cause
        this.name = "GetCameraStreamInfoError"
    }
}

class ListPTZInfoError extends Error {
    constructor(message, cause) {
        if (typeof cause.returnCode !== "undefined"){
            if (typeof PTZPresetErroCodes[cause.returnCode] !== "undefined"){
                message = message + "\n"+PTZPresetErroCodes[cause.returnCode]
            } else if (typeof CommonErrorCodes[cause.returnCode] !== "undefined"){
                message = message + "\n"+CommonErrorCodes[cause.returnCode]
            }
        }
        if (typeof cause.error !== "undefined"){
            message = message + "\n" + cause.error.toString()
        }
        super(message)
        this.cause = cause
        this.name = "ListPTZInfoError"
    }
}

class GoPTZPositionError extends Error {
    constructor(message, cause) {
        if (typeof cause.returnCode !== "undefined"){
            if (typeof PTZErrorCodes[cause.returnCode] !== "undefined"){
                message = message + "\n"+PTZErrorCodes[cause.returnCode]
            } else if (typeof CommonErrorCodes[cause.returnCode] !== "undefined"){
                message = message + "\n"+CommonErrorCodes[cause.returnCode]
            }
        }
        if (typeof cause.error !== "undefined"){
            message = message + "\n" + cause.error.toString()
        }
        super(message)
        this.cause = cause
        this.name = "GoPTZPositionError"
    }
}

class MySynoSSClient {
    //Look-at: https://global.download.synology.com/download/Document/Software/DeveloperGuide/Package/SurveillanceStation/All/enu/Surveillance_Station_Web_API.pdf

    //webapi/query.cgi?api=SYNO.API.Info&method=Query&version=1
    #queryClient;

    //webapi/entry.cgi?api=SYNO.API.Auth
    //webapi/entry.cgi?api=SYNO.SurveillanceStation.Camera
    //webapi/entry.cgi?api=SYNO.SurveillanceStation.PTZ
    //webapi/entry.cgi?api=SYNO.SurveillanceStation.PTZ.Preset
    #entryClient;

    #apiVersions = null

    //The login object containing the sid and token
    #loginInfo

    //The inital options set during construction
    #opts

    #debug

    constructor(opts) {
        this._init(opts);
    }

    _init(opts) {
        this.#loginInfo = null
        this.#opts = opts
        this.#debug = opts.debug

        let baseURL = opts.host+":"+opts.port+"/webapi"
        if (opts.protocol === "http"){
            this.#queryClient = axios.create({
                baseURL: "http://"+baseURL+"/query.cgi?api=SYNO.API.Info&method=Query&version=1",
            });

            this.#entryClient = axios.create({
                baseURL: "http://"+baseURL+"/",
            });
        } else {
            this.#queryClient = axios.create({
                baseURL: "https://"+baseURL+"/query.cgi?api=SYNO.API.Info&method=Query&version=1",
                httpsAgent: new https.Agent({
                    // This setting disables SSL certificate errors and reduces security
                    rejectUnauthorized: !opts.ignoreCertErrors
                })
            });

            this.#entryClient = axios.create({
                baseURL: "https://"+baseURL+"/",
                httpsAgent: new https.Agent({
                    // This setting disables SSL certificate errors and reduces security
                    rejectUnauthorized: !opts.ignoreCertErrors
                })
            });
        }
    }

    setDebugFlag(flag){
        if(flag === true){
            debug = true
        } else {
            debug = false
        }
    }

    queryApiVersions(useCachedData){
        const self = this

        if (typeof useCachedData === "undefined"){
            useCachedData = true
        }
        
        if (useCachedData && (self.#apiVersions != null)){
            if (self.#debug){
                console.log("Cached information about the api versions available. Using it.")
            }
            return new Promise(function(myResolve, myReject) {
                    myResolve(self.#apiVersions)
                });
        } else {
            if (self.#debug){
                console.log("Either no cached api version information is available or we should not use it. Query the api version information.")
            }
            return self.#queryClient.get()
                .then((response) => {
                    let newVersionInfo = {}
                    for (let curApi in response.data.data){
                        newVersionInfo[curApi] = { version: response.data.data[curApi].maxVersion, path: response.data.data[curApi].path}
                    }
                    self.#apiVersions = newVersionInfo
                    return newVersionInfo
                })
                .catch(error => {
                    if (!error instanceof QueryApiVersionError){
                        throw new QueryApiVersionError("Could not query the version information of the apis", { error: error})
                    } else {
                        throw error
                    }
                })
        }
    }

    login(useCachedData) {
        const self = this
        
        if (typeof useCachedData === "undefined"){
            useCachedData = true
        }
        
        if (useCachedData && (self.#loginInfo != null)){
            if (self.#debug){
                console.log("Login not neccessary. Using cached login information.")
            }
            return new Promise(function(myResolve, myReject) {
                myResolve(self.#loginInfo)
            });
        } else {
            if (self.#debug){
                console.log("Either no cached information is available or should be used. Trying to login.")
            }

            return self.logout(useCachedData).then( () => 
                self.queryApiVersions(true).then(
                    (apiVersions) => {
                        let api = "SYNO.API.Auth"
                        let loginObj = {
                            api: api,
                            version: apiVersions[api].version,
                            method: "login",
                            account: self.#opts.user,
                            passwd: self.#opts.password,
                            session: "SurveillanceStation",
                            format: "sid",
                            enable_syno_token: "yes"
                        }

                        return self.#entryClient
                            .get(
                                apiVersions[api].path,{
                                    params: loginObj
                                })
                                .then((response) => {
                                    if (response.data.success){
                                        self.#loginInfo = {sid: response.data.data.sid, synotoken: response.data.data.synotoken}
                                        return self.#loginInfo
                                    } else {
                                        throw new LoginError("Login not possible",{response: response, returnCode: response.data.error.code})
                                    }
                                }).catch(error => {
                                    if (!error instanceof LoginError){
                                        throw new LoginError("Login not possible", { error:error})
                                    } else {
                                        throw error
                                    }
                                })
                    }
                )
            )
        }
    }

    logout(useCachedData) {
        if (typeof useCachedData === "undefined"){
            useCachedData = true
        }
        const self = this
        if (self.#loginInfo != null){
            if (self.#debug){
                console.log("Trying to logout.")
            }

            return self.queryApiVersions(useCachedData).then(
                (apiVersions) => {
                    let api = "SYNO.API.Auth" 
                    let logoutObj = {
                        api: api,
                        version: apiVersions[api].version,
                        method: "logout",
                        session: "SurveillanceStation",
                        _sid: self.#loginInfo.sid,
                        SynoToken: self.#loginInfo.synotoken
                    }

                    return self.#entryClient
                        .get(
                            apiVersions[api].path,{
                                params: logoutObj
                            })
                            .then((response) => {
                                if (response.data.success){
                                    self.#loginInfo = null
                                    return new Promise(function(myResolve, myReject) {
                                        myResolve(true)
                                    });
                                } else {
                                    throw new LogoutError("Logout not possible. API retured with error.",{response: response, returnCode: response.data.error.code})
                                }
                            }).catch(error => {
                                if (!error instanceof LogoutError){
                                    throw new LogoutError("Could not logout", { error:error})
                                } else {
                                    throw error
                                }
                            })
                }
            )
        } else {
            return new Promise(function(myResolve) {
                myResolve(true)
            });
        }
    }

    getCamIds(useCachedData){
        const self = this

        if (typeof useCachedData === "undefined"){
            useCachedData = true
        }

        return self.login(useCachedData).then(
            () => self.queryApiVersions(true).then( 
                (apiVersions) => {
                    let api = "SYNO.SurveillanceStation.Camera"
                    let camListObj = {
                        api: api,
                        method: "List",
                        version: apiVersions[api].version,
                        _sid: this.#loginInfo.sid,
                        SynoToken: this.#loginInfo.synotoken
                    }

                    return this.#entryClient
                        .get(
                            apiVersions[api].path,{
                                params: camListObj,
                            })
                            .then((response) => {
                                if (response.data.success){
                                    let camIds = []
                                    let camIdNameMapping = {}
                                    let camNameIdMapping = {}
                                    for (let camIdx = 0; camIdx < response.data.data.cameras.length; camIdx ++){
                                        let camObj = response.data.data.cameras[camIdx]
                                        camNameIdMapping[camObj.newName] = camObj.id
                                        camIdNameMapping[camObj.id] = camObj.newName
                                        camIds.push(camObj.id)
                                    }

                                    return {camIds: camIds, nameIdMapping: camNameIdMapping,idNameMapping:camIdNameMapping}
                                } else {
                                    throw new ListCameraError("Could not list cameras", {response: response, returnCode: response.data.error.code})
                                }
                            }).catch(error => {
                                if (!error instanceof ListCameraError){
                                    throw new ListCameraError("Could not list cameras", { error:error})
                                } else {
                                    throw error
                                }
                            }
                        )
                }
            )
        )
    }

    getCamStreamInfo(camIds, useCachedData){
        const self = this

        if (typeof useCachedData === "undefined"){
            useCachedData = true
        }

        if ((typeof camIds === "undefined") || (!Array.isArray(camIds)) || (camIds.length < 1)){
            throw new GetCameraStreamInfoError("Could not get stream info of the cameras. The list of camera ids is missing!")
        }

        camIds = camIds.join(",")

        return self.login(useCachedData).then(
            () => self.queryApiVersions(true).then( 
                (apiVersions) => {
                    let api = "SYNO.SurveillanceStation.Camera"
                    let camStreamInfoObj = {
                        api: api,
                        method: "GetLiveViewPath",
                        idList: camIds,
                        version: apiVersions[api].version,
                        _sid: this.#loginInfo.sid,
                        SynoToken: this.#loginInfo.synotoken
                    }

                    return this.#entryClient
                        .get(
                            apiVersions[api].path,{
                                params: camStreamInfoObj,
                            })
                            .then((response) => {
                                if (response.data.success){
                                    let camIdStreamMapping = {}

                                    for (let camIdx = 0; camIdx < response.data.data.length; camIdx ++){
                                        let camObj = response.data.data[camIdx]

                                        camIdStreamMapping[camObj.id] = camObj.mjpegHttpPath
                                    }

                                    return camIdStreamMapping
                                } else {
                                    throw new GetCameraStreamInfoError("Could not get stream info of the cameras", {response: response, returnCode: response.data.error.code})
                                }
                            }).catch(error => {
                                if (!error instanceof GetCameraStreamInfoError){
                                    throw new GetCameraStreamInfoError("Could not get stream info of the cameras", { error: error})
                                } else {
                                    throw error
                                }
                            }
                        )
                }
            )
        )
    }

    getPTZPresetInfoOfOneCam(camId, useCachedData){
        const self = this

        if (typeof useCachedData === "undefined"){
            useCachedData = true
        }

        if (typeof camId === "undefined"){
            throw new ListPTZInfoError("Could not get PTZ info of the camera. The camera id is missing!")
        }

        return self.login(useCachedData).then(
            () => self.queryApiVersions(true).then( 
                (apiVersions) => {
                    let api = "SYNO.SurveillanceStation.PTZ.Preset"
                    let camPTZInfoObj = {
                        api: api,
                        method: "Enum",
                        cameraId: camId,
                        version: apiVersions[api].version,
                        _sid: this.#loginInfo.sid,
                        SynoToken: this.#loginInfo.synotoken
                    }

                    return this.#entryClient
                        .get(
                            apiVersions[api].path,{
                                params: camPTZInfoObj,
                            })
                            .then((response) => {
                                if (response.data.success){
                                    return response.data.data.preset
                                } else {
                                    throw new ListPTZInfoError("Could not get PTZ info of camera with id "+camId, {response: response, returnCode: response.data.error.code})
                                }
                            }).catch(error => {
                                if (!error instanceof ListPTZInfoError){
                                    throw new ListPTZInfoError("Could not get PTZ info of camera with id "+camId, { error: error})
                                } else {
                                    throw error
                                }
                            }
                        )
                }
            )
        )
    }

    getPTZPresetInfoOfCams(camIds, useCachedData){
        const self = this
        if((typeof camIds !== "undefined") && Array.isArray(camIds) && (camIds.length > 0)){
            let presetInfos = {}
            let chain = Promise.resolve()
            for (let camId of camIds){
                chain = chain.then(() => self.getPTZPresetInfoOfOneCam(camId, useCachedData).then((camResult) => {
                    presetInfos[camId] = camResult
                }))
            }
            return chain.then(() => {
                return  new Promise(function(myResolve) {
                    myResolve(presetInfos)
                });
            })
        } else {
            throw new ListPTZInfoError("Could not list PTZ preset infos of the cameras. The camera IDs are missing!")
        }
    }

    goPTZPosition(camId, position, useCachedData){
        const self = this

        if (typeof useCachedData === "undefined"){
            useCachedData = true
        }

        if (typeof camId === "undefined"){
            throw new GoPTZPositionError("Could not set PTZ preset of the camera. The camera id is missing!")
        }

        if (typeof position === "undefined"){
            throw new GoPTZPositionError("Could not set PTZ preset of the camera. The position id is missing!")
        }

        return self.login(useCachedData).then(
            () => self.queryApiVersions(true).then( 
                (apiVersions) => {
                    let api = "SYNO.SurveillanceStation.PTZ"
                    let camPTZInfoObj = {
                        api: api,
                        method: "GoPreset",
                        cameraId: camId,
                        position: position,
                        version: apiVersions[api].version,
                        _sid: this.#loginInfo.sid,
                        SynoToken: this.#loginInfo.synotoken
                    }

                    return this.#entryClient
                        .get(
                            apiVersions[api].path,{
                                params: camPTZInfoObj,
                            })
                            .then((response) => {
                                if (response.data.success){
                                    return true
                                } else {
                                    throw new GoPTZPositionError("Could not set PTZ preset of camera with id "+camId, {response: reponse, returnCode: response.data.error.code})
                                }
                            }).catch(error => {
                                if (!error instanceof GoPTZPositionError){
                                    throw new GoPTZPositionError("Could not set PTZ preset of camera with id "+camId, { error: error})
                                } else {
                                    throw error
                                }
                            }
                        )
                }
            )
        )
    }
    
    getStreamInfoOfAllCams(useCachedData){
        const self = this
        let result = {}

        if (typeof useCachedData === "undefined"){
            useCachedData = true
        }

        return self.getCamIds(useCachedData).then((camIdInfo) => {
            result.camIds = camIdInfo.camIds
            result.camNameIdMapping = camIdInfo.nameIdMapping
            result.camIdNameMapping = camIdInfo.idNameMapping
            result.infosPerId = {}

            for (let camId of result.camIds){
                result.infosPerId[camId] = {}
            }

            return self.getCamStreamInfo(result.camIds, useCachedData).then((camIdStreamMapping) => {
                for (let camId in camIdStreamMapping){
                    result.infosPerId[camId].streamInfo = camIdStreamMapping[camId]
                }

                return  new Promise(function(myResolve) {
                    myResolve(result)
                })
            })
        })
    }

    getAllInfosOfAllCams(useCachedData){
        const self = this
        let result = {}

        if (typeof useCachedData === "undefined"){
            useCachedData = true
        }

        return self.getCamIds(useCachedData).then((camIdInfo) => {
            result.camIds = camIdInfo.camIds
            result.camNameIdMapping = camIdInfo.nameIdMapping
            result.camIdNameMapping = camIdInfo.idNameMapping
            result.infosPerId = {}

            for (let camId of result.camIds){
                result.infosPerId[camId] = {}
            }

            return self.getCamStreamInfo(result.camIds, useCachedData).then((camIdStreamMapping) => {
                for (let camId in camIdStreamMapping){
                    result.infosPerId[camId].streamInfo = camIdStreamMapping[camId]
                }

                return self.getPTZPresetInfoOfCams(result.camIds, useCachedData).then((presetInfo) => {
                    for (let camId in presetInfo){
                        result.infosPerId[camId].presets = presetInfo[camId]
                    }

                    return  new Promise(function(myResolve) {
                        myResolve(result)
                    });
                })
            })
        })
    }
}

module.exports = MySynoSSClient;
