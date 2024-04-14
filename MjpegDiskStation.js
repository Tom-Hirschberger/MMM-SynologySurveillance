class MjpegDiskStationError extends Error {
    constructor(message, cause) {
        super(message)
        this.cause = cause
        this.name = "MjpegDiskStationError"
    }
}
class MjpegDiskStation {
    #dsIdx = -1
    #camInfos = {}

    constructor(dsIdx, opts) {
        this.#dsIdx = dsIdx
        this._init(opts);
    }

    _init(opts) {
        if ((typeof opts !== "undefined") && (Array.isArray(opts))){
            let camIds = []
            let camNameIdMapping = {}
            let camIdNameMapping = {}
            let infosPerId = {}
            for (let camIdx = 0; camIdx < opts.length; camIdx++) {
                camIds.push(camIdx)
                if( typeof opts[camIdx].name !== "undefined"){
                    camNameIdMapping[opts[camIdx].name] = camIdx
                    camIdNameMapping[camIdx] = opts[camIdx].name
                } else if (typeof opts.alias !== "undefined"){
                    camNameIdMapping[opts[camIdx].alias] = camIdx
                    camIdNameMapping[camIdx] = opts[camIdx].alias
                }

                infosPerId[camIdx] = {
                    presets: []
                }
                if (typeof opts[camIdx].url !== "undefined"){
                    infosPerId[camIdx].streamInfo = opts[camIdx].url
                } else {
                    throw new MjpegDiskStationError("Cam "+camIdNameMapping[camIdx]+" of DiskStation with idx: "+this.#dsIdx+ " is missing the URL information!")
                }
            }

            this.#camInfos = {
                camIds: camIds,
                camNameIdMapping: camNameIdMapping,
                camIdNameMapping: camIdNameMapping,
                infosPerId: infosPerId
            }
        } else {
            throw new MjpegDiskStationError("No cam info set for DiskStation with idx: "+this.#dsIdx)
        }
    }

    logout(useCachedData) {
        return new Promise(function(myResolve) {
            myResolve(true)
        });
    }

    getStreamInfoOfAllCams(){
        const self = this
        return this.getAllInfosOfAllCams()
    }

    getAllInfosOfAllCams(){
        const self = this
        
        return new Promise(function(myResolve) {
            myResolve(self.#camInfos)
        });
    }
}

module.exports = MjpegDiskStation;
