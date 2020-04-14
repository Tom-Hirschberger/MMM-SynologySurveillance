
# MMM-SynologySurveillance #

## Screenshots ##

## Installation
	cd ~/MagicMirror/modules
    git clone https://github.com/Tom-Hirschberger/MMM-SynologySurveillance.git
    cd MMM-MplayerRadio
    npm install


## Configuration ##
```json5
    	{
			module: "MMM-SynologySurveillance",
			position: "top_bar",
			config: {
				ds: [
					{
						protocol: "http",
						host: "192.168.0.2",
						port: "5000",
						user: "dummy",
						password: "dummyPass",
						cams: [
							{
								alias: "Cam1",
								name: "Parking Lot",
							}
						]
					}
				],
			}
		},
```

### General ###

### DiskStations ###

## Supported Notifications ##
