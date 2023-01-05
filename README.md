# MMM-SynologySurveillance

This module queries the "mjpeg" streams of surveillance cams connected to Synology disk stations and displays one or more cams in columns.
One selected cam can be displayed in a big single view.
The cam in the big view can either be switched by notification or by click/touch.
As of version 0.1.0 it is possible to display any kind of mjpeg stream and / or a mix of synology mjpeg and other mjpeg streams.

Profiles are supported as well. Each cam can be configured with a profiles string that is used to decide if the cam will be displayed in the current view or not.

The urls of the cams will be refreshed preiodically.

Attention: The "mpjeg" streams provide worse quality than the rtsp streams but displaying the rtsp streams is much more and needs some extra tools installed on the pi. If you search for an rtsp module try: <https://github.com/shbatm/MMM-RTSPStream> or try to convert the rtsp stream to a mjpeg stream. In my [vlc-rtsp2mjpeg-wrapper](https://github.com/Tom-Hirschberger/vlc-rtsp2mjpeg-wrapper) i provide a wrapper script which uses the vlc player to convert a rtsp stream to a mjpeg stream.

Because the module uses Flexbox Layout instead of Tables there is a lot of css styling possiblity.

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

### MagicMirror configuration

In MagicMirror version 2.16 and above electron is used in a version that prevents Cross-Origin Resource Sharing (CORS). This causes this module to be unable to display the mjpeg stream in the default setup. With a small modification to the default config it will work again:

The default MagicMirror contains a line:

```json5
address: "localhost",
```

which most users change to something like:

```json5
address: "0.0.0.0",
```

to be the mirror be accassable via webbrowser.
Both versions result in the violation of the CORS policy and the cam feed is not visible.

If you change the address to the ip of your mirror it will work, i.e.

```json5
address: "192.168.178.10",
```

### Module configuration

The basic configuration of the module looks like:

```json5
    {
        module: "MMM-SynologySurveillance",
        position: "top_bar",
        config: {
            vertical: true,
            ds: [
                //add your diskstations here
            ],
        },
    },
```

There is a example topic after the description of the different configuration parameters which provides some more or less complex configuration examples and the explains the details.

### General

| Option | Description | Type | Default |
| ------ | ----------- | ---- | ------- |
| ds                      | The array containing the information about the discstations and cams | Array   | [] |
| vertical                | Should the vertical or horizontal layout be used? | Boolean | true |
| showOneBig              | If this option is true an extra big view of the first cam is displayed at the beginning | Boolean | true |
| addBigToNormal          | If this option is true an icon will be displayed in the small views while the cam is visible in the big view | Boolean | false |
| showBigCamName          | Should the name of the cam that is displayed in the big view added to the big view | Boolean | false |
| showCamName             | Should the name of each cam be added the the small view | Boolean | false   |
| showUnreachableCams     | Should cams we can not query the video url of being displayed | Boolean | true |
| order                   | An array of strings containing the names or alias (if you use the same cam name in different stations use the alias) of the cams in the order they should be displayed. If no order is provided the order of the diskstations and cams in the configuration is used.  | Array of Strings  | null |
| showPositions           | If set to true saved positions for this cam will be added as buttons; You can either click them or send an notification to change to this position | Boolean | true |
| showBigPositions        | If set to true the saved positions of the current big cam will be displayed as buttons; You can either click them or change the positions by notification | Boolean | true |
| urlRefreshInterval      | The module connects periodically to the discstations to get the current urls (and refreshes the authentication cookie). This option controls the interval (seconds) | Integer | 60 |
| onlyRefreshIfUrlChanges | Only if some of the urls of the currently visable cams (also the unreachable ones) changed the view is being refreshed if this value is set to true. | Boolean | true |
| animationSpeed          | The refresh of the view can be animated. This options controls the animation speed (milliseconds) | Integer | 500 |
| skipOnPrivilegeError    | Sometimes the disk stations report a privilege error although the user does have valid rights to access the surveillance station. If activated the old urls of this station are kept valid and the module will try to get new urls during the next refresh. | Boolean | true |
| updateDomOnShow | Controls if the dom objects should be recreated if the modules gets shown after hidden status. This is to avoid caching issues (especially with electron versions used in MagicMirror 2.18 and above) | Boolean | true |
| appendTimestampToCamUrl | Controls if the creation timestamp will be added to the cam url. This is to avoid caching issues (especially with electron versions used in MagicMirror 2.18 and above) | Boolean | true |

### DiskStations

As of version 0.1.0 of the module there are two types of discstations. Either ones of type Synology or dummies which can be used to show mjpeg streams.

#### Synology

| Option                |Description | Type | Default/Mandatory |
| -------------------- | -------- | ------- | --------- |
| protocol             | The protocol to use. Either http, https. | String | http/false |
| host                 | The hostname or ip address of the diskstation to connect to | String | Empty/true |
| port                 | The port of the diskstation (not the survaillance redirect!). It is 5000 for http and 5001 for https usally.  | Integer | -1/true |
| user                 | The username to login to the diskstation  | String  | Empty/true |
| password             | The password used for the login | String | Empty/true |
| cams                 | The array containing the information about the cams to query | Array | Empty/true |
| replaceHostPart      | If this option is set to true the host and protocol part in the stream url will be replaced with the values of the config file. I introduce this option because i access my cam with an public url (dynamic dns) but the disk station returns the private ip of the camera in the result. | Boolean | false |
| replacePortPart      | If this option is set to true the prort part in the stream url will be replaced with the values of the config file. I introduce this option because i access my cam with https (port 50001)) but the disk station returns port of http (5000). | Boolean | false |
| skipOnPrivilegeError | The Diskstation API throws privilage errors randomly. If this option is set to true this errors will be ignored and the last url or position info will be kept. | Boolean | true  |

#### Dummie

Only if the protocol of the discstation is set to "mjpeg" a dummy disc station will be used!

| Option                |Description | Type | Default/Mandatory |
| -------------------- | -------- | ------- | --------- |
| protocol             | The protocol to use. Use mjpeg if you want to create a dummy station. | String | http/false |
| cams                 | The array containing the information about the cams to query | Array | Empty/true |

### Cams

| Option   | Description | Mandatory  |
| -------- | ----------- | ----- |
| name     | The name this camera is listed in the diskstation  | true  |
| alias    | An alias to use in the module for this camera | false |
| profiles | An profile string to specify if this cam only should be displayed in specific profiles. If no profile string is provided the camera is visible in all profiles | false |
| appendTimestampToCamUrl | If set the global option is ignored and the value of this option is used. If set to true the current timestamp will be added at the end of the url to avoid caching issues. | false |
| url      | If the cam is part of a dummy diskstation you need to specify the url of the mjpeg stream here! | true if part of dummy station |

### Configuration examples

Let's look at different configurations with examples...

The base configuration starts with one diskstation containing one cam.
The diskstation is accessed in the browser with the url `http://mydiskstation:5000`. The `host` is "mydiskstation" and the `port` is "5000" in this case. Additionally we provide the `user` and `password`.

As we want to use vertical layout we set `vertical` to `true`. As we only want to add one cam at this point this does not really make any difference.

The cam we want to add has the name "NAME_IN_DS" in the diskstation but we want to module to use the alias "Cam1" for it. If the `showCamName` is set to `true` (which is not the default case) the alias is displayed instead of the name then. If you want to provide a `order` for your cameras the alias will be used instead of the name, too.

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

Now we expand the example of above with a second diskstation with `host` "myds2" with `protocol` "https" and two more cameras. As "https" is used we set the `port` to "5001". If you changed the port settings of your NAS you need the values as set in the NAS.

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

We now diplay the camera "NAME_IN_DS" of the first diskstation and the cameras "NAME_IN_DS" and "My Cam2" of the second diskstation. As both "NAME_IN_DS" cameras do have a alias set we can change the order of the cameras with the setting:

```json5
order: ["My Cam2", "Cam 3", "Cam1"]
```

If we do want to add two more cameras now which are not connected to any diskstation but provide a mjpeg-stream instead we can add them as well:

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
