
# MMM-SynologySurveillance #
This module queries the "mjpeg" streams of surveillance cams connected to Synology disk stations and displays one or more cams in columns.
One selected cam can be displayed in a big single view.
The cam in the big view can either be switched by notification or by click/touch.

Profiles are supported as well. Each cam can be configured with a profiles string that is used to decide if the cam will be displayed in the current view or not.

The urls of the cams will be refreshed preiodically.

Attention: The "mpjeg" streams provide worse quality than the rtsp streams but displaying the rtsp streams is much more and needs some extra tools installed on the pi. If you search for an rtsp module try: https://github.com/shbatm/MMM-RTSPStream.

Because the module uses Flexbox Layout instead of Tables there is a lot of css styling possiblity.

## Screenshots ##
### Horizontal Layout ###
![alt text](https://github.com/Tom-Hirschberger/MMM-SynologySurveillance/raw/master/examples/screenshot-horizontal.png "Horizontal Layout")

### Vertical Layout ###
![alt text](https://github.com/Tom-Hirschberger/MMM-SynologySurveillance/raw/master/examples/screenshot-vertical.png "Vertical Layout")


## Installation
	cd ~/MagicMirror/modules
    git clone https://github.com/Tom-Hirschberger/MMM-SynologySurveillance.git
    cd MMM-SynologySurveillance
    npm install


## Configuration ##
```json5
    	{
			module: "MMM-SynologySurveillance",
			position: "top_bar",
			config: {
				showOneBig: true,
				addBigToNormal: false,
				showCamName: false,
				showBigCamName: false,
				showUnreachableCams: true,
				vertical: true,
				ds: [
					{
						protocol: "https",
						host: "mydiskstation",
						port: "5000",
						user: "dummy",
						password: "dummy123",
						replaceHostPart: true,
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

### General ###
| Option  | Description | Type | Default |
| ------- | --- | --- | --- |
| ds | The array containing the information about the discstations and cams | Array | [] |
| vertical | Should the vertical or horizontal layout be used? | Boolean | true |
| showOneBig | If this option is true an extra big view of the first cam is displayed at the beginning | Boolean | true |
| addBigToNormal | If this option is true an icon will be displayed in the small views while the cam is visible in the big view | Boolean | false |
| showBigCamName | Should the name of the cam that is displayed in the big view added to the big view | Boolean | false |
| showCamName | Should the name of each cam be added the the small view | Boolean | false |
| showUnreachableCams | Should cams we can not query the video url of being displayed | Boolean | true |
| order | An string containing the names or alias (if you use the same cam name in different stations use the alias) of the cams in the order they should be displayed. If no order is provided the order of the diskstations and cams in the configuration is used. | String | null |
| urlRefreshInterval | The module connects periodically to the discstations to get the current urls (and refreshes the authentication cookie). This option controls the interval (seconds) | Integer | 60 |
| onlyRefreshIfUrlChanges | Only if some of the urls of the currently visable cams (also the unreachable ones) changed the view is being refreshed if this value is set to true. | Boolean | true |
| animationSpeed | The refresh of the view can be animated. This options controls the animation speed (milliseconds) | Integer | 500 |

### DiskStations ###
| Option  | Description | Type |
| ------- | --- | --- |
| host | The hostname or ip address of the diskstation to connect to | true |
| port | The port of the diskstation (not the survaillance redirect!) | true |
| user | The username to login to the diskstation | true |
| password | The password used for the login | true |
| cams | The array containing the information about the cams to query | true |
| replaceHostPart | If this option is set to true the host and protocol part in the stream url will be replaced with the values of the config file. I introduce this option because i access my cam with an public url (dynamic dns) but the disk station returns the private ip of the camera in the result. | Boolean | false |

### Cams ###
| Option  | Description | Type |
| ------- | --- | --- |
| name | The name this camera is listed in the diskstation | true |
| alias | An alias to use in the module for this camera | false |
| profiles | An profile string to specify if this cam only should be displayed in specific profiles. If no profile string is provided the camera is visible in all profiles| false |


## Supported Notifications ##
| Notification | Payload | Description |
| ------------ | ------- | ----------- |
| SYNO_SS_NEXT_CAM | nothing | Switch to the next cam in the order in the big view |
| SYNO_SS_PREVIOUS_CAM | nothing | Switch to the previous cam in the order in the big view |
| SYNO_SS_CHANGE_CAM | id | Switch to the cam with the specific id. The id is either the one of the position in the order string or if no order string is used the position in the config (starting with 0) |