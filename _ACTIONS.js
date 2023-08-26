module.exports =
{
	"playback": {
		"play": {"key": "play", "description": "Start / Resume", "role":"button.play", "type": "boolean"},
		"play_switch": {"key": "play_switch", "description": "Start / Pause", "role":"media.state", "type": "boolean", "true":"play","false":"pause"},
		"pause": {"key": "pause", "description": "Pause", "role":"button.pause", "type": "boolean"},
		"stop": {"key": "stop", "description": "Stop", "role":"button.stop", "type": "boolean"},
		"skipPrevious": {"key": "skipPrevious", "description": "Skip to previous item"},
		"skipNext": {"key": "skipNext", "description": "Skip to next item"},
		"stepBack": {"key": "stepBack", "description": "seeks back 15 seconds (or the expected platform value)", "role":"button.next", "type": "boolean"},
		"stepForward": {"key": "stepForward", "description": "seeks forward 30 seconds (or the expected platform value)", "role":"button.prev", "type": "boolean"},
		"setVolume": {"key": "setParameters", "attribute": "volume", "default": 0, "description": "set Volume", "role":"level.volume", "type": "number", "common":{"unit":'%',"min":0,"max":100}},
		"setShuffle": {"key": "setParameters", "attribute": "shuffle", "default": 0, "common":{"states": {"0": "off", "1": "on"}}, "description": "set Shuffle"},
		"setRepeat": {"key": "setParameters", "attribute": "repeat", "default": 0, "common":{"states": {"0": "off", "1": "item", "2": "all"}}, "description": "set Repeat"},
		"seekTo": {"attribute": "offset", "default": 0, "description": "set Offset (in milliseconds)"},
		"seekToSeconds": {"attribute": "offset", "default": 0, "role":"button.seek", "description": "set Offset for vis mediaplayer (in Seconds)", "convert": 'percent', "common":{"unit":'%',"min":0,"max":100}}
	},
	
	"navigation": {
		"moveUp": "Move selection up",
		"moveDown": "Move selection down",
		"moveLeft": "Move selection left",
		"moveRight": "Move selection right",
		"select": "Select focused element",
		"back": "Go back"
	},
	
	"mirror": {
		"details": "Show the pre-play screen for a specific item"
	}
}