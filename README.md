# MMM-SynologySurveillance

:warning:
**As i changed from version 9.1.4.11002 to version 9.2.0-11289 of the Surveillance Station package i noticed that the user i use in this module needs to be in the "Manager" role at least, now. The "Viewer" role is not enough anymore. To change the setting open the webpage of the DiskStation->SurveillanceStation->Menu->Users and select the user you want to use. Then click on Edit->Permissions in the top bar. Select "Manager of all objects" and save. You are ready now!**

This module queries the "mjpeg" streams of surveillance cams connected to Synology DiskStations and displays one or more cams in columns.
As of version 0.1.0 it is possible to display any kind of mjpeg stream and / or a mix of synology mjpeg and other mjpeg streams.

One selected cam can be displayed in a big single view.
The cam in the big view can either be switched by notification or by click/touch.

Profiles are supported as well. Each cam can be configured with a profiles string that is used to decide if the cam will be displayed in the current view or not.

The urls of the cams will be refreshed periodically.

Attention: The "mpjeg" streams provide worse quality than the rtsp streams but displaying the rtsp streams is much more affort and needs some extra tools installed on the pi. If you search for an rtsp module try: <https://github.com/shbatm/MMM-RTSPStream> or try to convert the rtsp stream to a mjpeg stream. In my [vlc-rtsp2mjpeg-wrapper](https://github.com/Tom-Hirschberger/vlc-rtsp2mjpeg-wrapper) i provide a wrapper script which uses the vlc player to convert a rtsp stream to a mjpeg stream.

Because the module uses Flexbox Layout instead of tables there is a lot of css styling possiblity.

## Screenshots

### Horizontal Layout

![alt text](https://github.com/Tom-Hirschberger/MMM-SynologySurveillance/raw/master/examples/screenshot-horizontal.png "Horizontal Layout")

### Vertical Layout

![alt text](https://github.com/Tom-Hirschberger/MMM-SynologySurveillance/raw/master/examples/screenshot-vertical.png "Vertical Layout")

![alt text](https://github.com/Tom-Hirschberger/MMM-SynologySurveillance/raw/master/examples/screenshot-vertical-positions.png "Vertical Layout with positions")

## Installation

```bash
cd ~/MagicMirror/modules
git clone https://github.com/Tom-Hirschberger/MMM-SynologySurveillance.git
cd MMM-SynologySurveillance
npm install
```

## Configuration

### Module configuration

The basic configuration of the module looks like:

```json5
    {
        module: "MMM-SynologySurveillance",
        position: "top_bar",
        config: {
            vertical: true,
            ds: [
                //add your DiskStations here
            ],
        },
    },
```

There is a example topic after the description of the different configuration parameters which provides some more or less complex configuration examples and the explains the details.

### General

| Option | Description | Type | Default |
| ------ | ----------- | ---- | ------- |
| debug                   | If this option is set to true the module prints a lot more output to the console. May be helpful to debug some problems | Boolean | false |
| ds                      | The array containing the information about the DiskStations and cams | Array   | [] |
| vertical                | Should the vertical or horizontal layout be used? | Boolean | true |
| showOneBig              | If this option is true an extra big view of the first cam is displayed at the beginning | Boolean | true |
| addBigToNormal          | If this option is true an icon will be displayed in the small views while the cam is visible in the big view | Boolean | false |
| showBigCamName          | Should the name of the cam that is displayed in the big view added to the big view | Boolean | false |
| showCamName             | Should the name of each cam be added the the small view | Boolean | false   |
| showUnreachableCams     | Should cams we can not query the video url of being displayed | Boolean | true |
| order                   | An array of strings containing the names or alias (if you use the same cam name in different stations use the alias) of the cams in the order they should be displayed. If no order is provided the order of the DiskStations and cams in the configuration is used.  | Array of Strings  | null |
| showPositions           | If set to true saved positions for this cam will be added as buttons; You can either click them or send an notification to change to this position | Boolean | true |
| showBigPositions        | If set to true the saved positions of the current big cam will be displayed as buttons; You can either click them or change the positions by notification | Boolean | true |
| urlRefreshInterval      | The module connects periodically to the DiskStations to get the current urls (and refreshes the authentication cookie). This option controls the interval (seconds) | Integer | 60 |
| onlyRefreshIfUrlChanges | Only if some of the urls of the currently visable cams (also the unreachable ones) changed the view is being refreshed if this value is set to true. | Boolean | true |
| animationSpeed          | The refresh of the view can be animated. This options controls the animation speed (milliseconds) | Integer | 500 |
| changedPositionAnimationSpeed | The refresh of the view can be animated. In case of position changes this animation speed is used. To reduce flickering this is set to 0 in default | Integer | 0 |
| updateDomOnShow | Controls if the dom objects should be recreated if the modules gets shown after hidden status. This is to avoid caching issues (especially with electron versions used in MagicMirror 2.18 and above) | Boolean | true |
| appendTimestampToCamUrl | Controls if the creation timestamp will be added to the cam url. This is to avoid caching issues (especially with electron versions used in MagicMirror 2.18 and above) | Boolean | true |
| imgDecodeCheckInterval | If set to a value greater 0 the module will check if the images can decoded in a interval of this value in seconds. If a image can not be decoded the URL will be refreshed. This is to avoid empty cam boxes. The value can be set for each cam indiviually, too. If both this and value for the camera is set the one of the camera is used. | Integer | -1 |
| minimumTimeBetweenRefreshs | It may happen that there are a lot of requests to refresh the URLs of the cams in a short time. This value prevents the requests to fire to quickly. The module waits at least this amount of milliseconds till it requests new URLs of the DiskStations again. | Integer | 10000 |
| restoreBigAfterProfileChange | If multiple profiles are used and not all cams are visiable in all profiles it may happen that the cam that is displayed big changes on a profile change. If this setting is set to true the module tries to restore the previous state if the user returns to a previously selected profile. | Boolean | true |

### DiskStations

As of version 0.1.0 of the module there are two types of DiskStations. Either ones of type Synology or dummies which can be used to show mjpeg streams.

As of version 0.2.0 of the module the option "skipOnPrivilegeError" is not used anymore and will be ignored.

#### Synology

| Option                |Description | Type | Default/Mandatory |
| -------------------- | -------- | ------- | --------- |
| protocol             | The protocol to use. Either http, https. | String | http/false |
| host                 | The hostname or ip address of the DiskStation to connect to | String | Empty/true |
| port                 | The port of the DiskStation (not the survaillance redirect!). It is 5000 for http and 5001 for https usally.  | Integer | -1/true |
| user                 | The username to login to the DiskStation  | String  | Empty/true |
| password             | The password used for the login | String | Empty/true |
| cams                 | The array containing the information about the cams to query | Array | Empty/true |
| replaceHostPart      | If this option is set to true the host and protocol part in the stream url will be replaced with the values of the config file. I introduce this option because i access my cam with an public url (dynamic dns) but the DiskStation returns the private ip of the camera in the result. | Boolean | false |
| replacePortPart      | If this option is set to true the prort part in the stream url will be replaced with the values of the config file. I introduce this option because i access my cam with https (port 50001)) but the DiskStation returns port of http (5000). | Boolean | false |

#### Dummie

Only if the protocol of the DiskStation is set to "mjpeg" a dummy DiskStation will be used!

| Option                |Description | Type | Default/Mandatory |
| -------------------- | -------- | ------- | --------- |
| protocol             | The protocol to use. Use mjpeg if you want to create a dummy station. | String | http/false |
| cams                 | The array containing the information about the cams to query | Array | Empty/true |

### Cams

| Option   | Description | Mandatory  |
| -------- | ----------- | ----- |
| name     | The name this camera is listed in the DiskStation  | true  |
| alias    | An alias to use in the module for this camera | false |
| profiles | An profile string to specify if this cam only should be displayed in specific profiles. If no profile string is provided the camera is visible in all profiles | false |
| appendTimestampToCamUrl | If set the global option is ignored and the value of this option is used. If set to true the current timestamp will be added at the end of the url to avoid caching issues. | false |
| imgDecodeCheckInterval | If set to a value greater 0 the module will check if the img of this cam can decoded in a interval of this value in seconds. If the image can not be decoded the URLs of all cams will be refreshed. This is to avoid empty cam boxes. The value can be set for each cam indiviually or in the global config section. If both this and the global value are set this value is used. | Integer | unset |
| url      | If the cam is part of a dummy DiskStation you need to specify the url of the mjpeg stream here! | true if part of dummy station |

### Configuration examples

Let's look at different configurations with examples...

The base configuration starts with one DiskStation containing one cam.
The DiskStation is accessed in the browser with the url `http://mydiskstation:5000`. The `host` is "mydiskstation" and the `port` is "5000" in this case. Additionally we provide the `user` and `password`.

As we want to use vertical layout we set `vertical` to `true`. As we only want to add one cam at this point this does not really make any difference.

The cam we want to add has the name "NAME_IN_DS" in the DiskStation but we want to module to use the alias "Cam1" for it. If the `showCamName` is set to `true` (which is not the default case) the alias is displayed instead of the name then. If you want to provide a `order` for your cameras the alias will be used instead of the name, too.

```json5
    {
        module: "MMM-SynologySurveillance",
        position: "top_bar",
        config: {
            vertical: true,
            ds: [
                {
                    protocol: "http",
                    host: "mydiskstation",
                    port: "5000",
                    user: "dummy",
                    password: "dummy123",
                    cams: [
                        {
                            alias: "Cam1",
                            name: "NAME_IN_DS",
                        }
                    ]
                },
            ],
        },
    },
```

Now we expand the example of above with a second DiskStation with `host` "myds2" with `protocol` "https" and two more cameras. As "https" is used we set the `port` to "5001". If you changed the port settings of your NAS you need the values as set in the NAS.

```json5
    {
        module: "MMM-SynologySurveillance",
        position: "top_bar",
        config: {
            vertical: true,
            ds: [
                {
                    protocol: "http",
                    host: "mydiskstation",
                    port: "5000",
                    user: "dummy",
                    password: "dummy123",
                    cams: [
                        {
                            alias: "Cam1",
                            name: "NAME_IN_DS",
                        }
                    ]
                },
                {
                    protocol: "https",
                    host: "myds2",
                    port: "5001",
                    user: "dummy",
                    password: "dummy123",
                    cams: [
                        {
                            alias: "Cam 3",
                            name: "NAME_IN_DS",
                        },
                        {
                            name: "My Cam2",
                        }
                    ]
                },
            ],
        },
    },
```

We now diplay the camera "NAME_IN_DS" of the first DiskStation and the cameras "NAME_IN_DS" and "My Cam2" of the second DiskStation. As both "NAME_IN_DS" cameras do have a alias set we can change the order of the cameras with the setting:

```json5
order: ["My Cam2", "Cam 3", "Cam1"]
```

If we do want to add two more cameras now which are not connected to any DiskStation but provide a mjpeg-stream instead we can add them as well:

```json5
    {
        module: "MMM-SynologySurveillance",
        position: "top_bar",
        config: {
            vertical: true,
            ds: [
                {
                    protocol: "http",
                    host: "mydiskstation",
                    port: "5000",
                    user: "dummy",
                    password: "dummy123",
                    cams: [
                        {
                            alias: "Cam1",
                            name: "NAME_IN_DS",
                        }
                    ]
                },
                {
                    protocol: "https",
                    host: "myds2",
                    port: "5001",
                    user: "dummy",
                    password: "dummy123",
                    cams: [
                        {
                            alias: "Cam 3",
                            name: "NAME_IN_DS",
                        },
                        {
                            name: "My Cam2",
                        }
                    ]
                },
                {
                    protocol: "mjpeg",
                    cams: [
                        {
                            alias: "Cam4",
                            url: "http://mycam4:8000"
                        },
                        {
                            alias: "Cam5",
                            url: "http://myuser:mypass@mycam5:8888/stream"
                        }
                    ]
                },
            ],
        },
    },
```

Make sure to add the new cams to the `order` option if you set a alternative order:

```json5
order: ["My Cam2", "Cam 3", "Cam1", "Cam4", "Cam5"]
```

The `url` of "Cam5" is more complex as the camera requires a username (myuser) and password (mypass) to be accessed.

## Supported Notifications

| Notification | Payload | Description  |
| ------------ | ------- | ----------- |
| SYNO_SS_NEXT_CAM          | nothing | Switch to the next cam in the order in the big view |
| SYNO_SS_PREVIOUS_CAM      | nothing | Switch to the previous cam in the order in the big view |
| SYNO_SS_CHANGE_CAM        | id | Switch to the cam with the specific id. The id is either the one of the position in the order string or if no order string is used the position in the config (starting with 0) |
| SYNO_SS_NEXT_POSITION     | nothing or dsIdx = index of the datastation in the configuration; camName = the name of the cam as in the configuration                                           | The cam will with the specified id and name will be moved to the next position; If no information is provided the current big cam will be used                                  |
| SYNO_SS_PREVIOUS_POSITION | nothing or dsIdx = index of the datastation in the configuration; camName = the name of the cam as in the configuration                                           | The cam will with the specified id and name will be moved to the next position; If no information is provided the current big cam will be used                                  |
| SYNO_SS_CHANGE_POSITION   | dsIdx = index of the datastation in the configuration; camName = the name of the cam as in the configuration; position = the id of the position (starting with 0) | The cam will with the specified id and name will be moved to the specified position                                                                                             |
