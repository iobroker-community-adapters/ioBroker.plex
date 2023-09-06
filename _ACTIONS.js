module.exports =
{
	"playback": {
		"play": { "key": "play", "description": "Start / Resume", "role": "button.play", "type": "boolean" },
		"play_switch": { "key": "play_switch", "description": "Start / Pause", "role": "media.state", "type": "boolean", "true": "play", "false": "pause" },
		"pause": { "key": "pause", "description": "Pause", "role": "button.pause", "type": "boolean" },
		"stop": { "key": "stop", "description": "Stop", "role": "button.stop", "type": "boolean" },
		"skipPrevious": { "key": "skipPrevious", "description": "Skip to previous item" },
		"skipNext": { "key": "skipNext", "description": "Skip to next item" },
		"stepBack": { "key": "stepBack", "description": "seeks back 15 seconds (or the expected platform value)", "role": "button.next", "type": "boolean" },
		"stepForward": { "key": "stepForward", "description": "seeks forward 30 seconds (or the expected platform value)", "role": "button.prev", "type": "boolean" },
		"setVolume": { "key": "setParameters", "attribute": "volume", "default": 0, "description": "set Volume", "role": "level.volume", "type": "number", "common": { "unit": '%', "min": 0, "max": 100 } },
		"setShuffle": { "key": "setParameters", "attribute": "shuffle", "type":"boolean", "role":"media.mode.shuffle", "default": false, "fromPlex": { "0": false, "1": true }, "description": "set Shuffle" },
		"setRepeat": { "key": "setParameters", "role":"media.mode.repeat", "type":"number", "attribute": "repeat", "default": 0, "common": { "states": { "0": "off", "1": "item", "2": "all" } }, "description": "set Repeat" },
		"setRepeatAll": { "key": "setParameters", "role":"indicator", "type":"boolean", "attribute": "repeat", "default": false, "fromPlex": { "0": false, "2": true}, "description": "set Repeat All" },
		"seekTo": { "attribute": "offset", "default": 0, "description": "set Offset (in milliseconds)" },
		"seekToPercent": { "key": "seekTo", "attribute": "offset", "default": 0, "role": "media.seek", "type": "number", "description": "set Offset (in %)", "convert": 'percent', "common": { "unit": '%', "min": 0, "max": 100 } },
		"playLast": { "key": "playMedia", "description": "Start / Resume last played media", "role": "button.play", "type": "boolean", "convert": 'lastPlayed'},
		"playKey": { "key": "playMedia", "default":"", "description": "Start / Resume media by key#offset", "role": "text", "type": "string", "convert": 'playKey'},
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
	},

	"timeline": {
		"refreshDetails": { "key": "refreshDetails", "saveToPlayer": true, "default": false, "common": { "type": "boolean", "role": "indicator", }, "description": "activate auto refresh" }
	}
}