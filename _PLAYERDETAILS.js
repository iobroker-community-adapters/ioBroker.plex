module.exports = 
{
    "playerDetails": {
        "node":{
            "time": {
                "node": "Metadata.viewOffset",
                "type": "number"        
            }
        },
        "action": {
            "volume": {
                "node": "playback.setVolume",
                "type": "number"
            },
            "time": {
                "node": "playback.seekTo",
                "type": "number",        
            },
            "percent": {
                "node": "playback.seekToPercent",
                "type": "number",
                "notDetails": true         
            },
            "state": {
                "node": "playback.play_switch",
                "type": "boolean",
                "values": ['playing'],
                "notDetails": true        
            },
            "shuffle": {
                "node": "playback.setShuffle",
                "type": "boolean"               
            },
            "repeat": {
                "node": "playback.setRepeat",
                "type": "number"
            },
        }
    }, 
    "deepVal":{
        "Metadata.Media.Part.Stream.streamType": [{
            // nodes: gehe einen Datenpunkt höher und lese dort die daten von key in node
            "nodes":[{"node":".url", "key":"key"},{"node":".codec", "key":"codec"}],
            // mache nur weiter wenn value == datenwert ist
            "value": 4,
            // wenn nodes nicht definert ist lade daten in diesen datenpunkt
            "node": "Metadata.Music.Lyric"
        }],
        "Metadata.type": [{
            "call":{"Metadata.Media.Part.key": [{"node": ".Media", "app": ".mediaurl",}],
                    "Metadata.Media.Part.codec": [{"node": ".Media", "app": ".codec",}]},
            
            // Benutze Value als key z.B. Metadata.key
            "valueAsKey": true,
            // wenn nodes nicht definert ist lade daten in diesen datenpunkt
            "node": "Metadata"
        }]
    }
}