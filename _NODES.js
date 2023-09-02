module.exports =
{
    "events.account": {
        "description": "Name of Plex User",
        "role": "text",
        "type": "string"
    },
    "events.caption": {
        "description": "Caption of last event",
        "role": "text",
        "type": "string"
    },
    "events.datetime": {
        "description": "DateTime of the event being received",
        "role": "text",
        "type": "string"
    },
    "events.event": {
        "description": "Last event triggered on Plex",
        "role": "text",
        "type": "string"
    },
    "events.history": {
        "description": "All events historicized",
        "role": "json",
        "type": "json"
    },
    "events.id": {
        "description": "Generated unique ID",
        "role": "text",
        "type": "string"
    },
    "events.media": {
        "description": "Media type of last event (movie, show, track, etc.)",
        "role": "text",
        "type": "string"
    },
    "events.message": {
        "description": "Message of last event",
        "role": "text",
        "type": "string"
    },
    "events.player": {
        "description": "Name of Plex Player",
        "role": "text",
        "type": "string"
    },
    "events.source": {
        "description": "Last source an event was received from",
        "role": "text",
        "type": "string"
    },
    "events.source": {
        "description": "Source of event (either plex or tautulli)",
        "role": "text",
        "type": "string"
    },
    "events.thumb": {
        "description": "Address of server ",
        "role": "media.cover",
        "type": "string"
    },
    "events.timestamp": {
        "description": "Timestamp of the event being received",
        "role": "value",
        "type": "number"
    },
    "info.notifications": {
        "description": "Notification Configuration",
        "node": "info.notifications",
        "role": "json",
        "type": "string"
    },
    "libraries": {
        "description": "Plex Libraries",
        "role": "channel"
    },
    "libraries.agent": {
        "description": "Agent",
        "role": "text",
        "type": "string"
    },
    "libraries.allowsync": {
        "description": "Allow Sync",
        "role": "indicator",
        "type": "boolean"
    },
    "libraries.art": {
        "description": "Picture path",
        "role": "text",
        "type": "string"
    },
    "libraries.composite": {
        "description": "Composite",
        "role": "text",
        "type": "string"
    },
    "libraries.content": {
        "description": "has content",
        "role": "indicator",
        "type": "boolean"
    },
    "libraries.contentchangedat": {
        "description": "The date and time when the library content was last changed",
        "role": "value",
        "type": "number"
    },
    "libraries.createdat": {
        "description": "Timestamp of library creation",
        "role": "value",
        "type": "number"
    },
    "libraries.directory": {
        "description": "no clue",
        "role": "indicator",
        "type": "boolean"
    },
    "libraries.filters": {
        "description": "Indicator if filter is applied",
        "role": "indicator",
        "type": "boolean"
    },
    "libraries.hidden": {
        "description": "no clue",
        "role": "value",
        "type": "number"
    },
    "libraries.items": {
        "description": "List of all items in the library",
        "role": "json"
    },
    "libraries.itemscount": {
        "description": "Number of items in the library",
        "role": "value",
        "type": "number"
    },
    "libraries.key": {
        "description": "ID of library",
        "role": "text",
        "type": "string"
    },
    "libraries.language": {
        "description": "Language",
        "role": "text",
        "type": "string"
    },
    "libraries.location": {
        "description": "Storage Locations",
        "role": "json",
        "type": "string"
    },
    "libraries.refreshing": {
        "description": "Indicator if currently refreshing",
        "role": "indicator",
        "type": "boolean"
    },
    "libraries.scannedat": {
        "description": "Timestamp of last scan",
        "role": "value",
        "type": "number"
    },
    "libraries.scanner": {
        "description": "Used scanner for media",
        "role": "text",
        "type": "string"
    },
    "libraries.thumb": {
        "description": "Thumbnail of the Library",
        "role": "text",
        "type": "string"
    },
    "libraries.title": {
        "description": "Name of the Library",
        "role": "text",
        "type": "string"
    },
    "libraries.type": {
        "description": "Type of Library",
        "role": "text",
        "type": "string"
    },
    "libraries.updatedat": {
        "description": "Timestamp of last update",
        "role": "value",
        "type": "number"
    },
    "libraries.uuid": {
        "description": "Unique ID",
        "role": "text",
        "type": "string"
    },
    "library": {
        "description": "Plex Library %library%",
        "role": "channel"
    },
    "playing.account": {
        "description": "Viewing account",
        "role": "value",
        "type": "string"
    },
    "playing.account.id": {
        "description": "Plex ID of Plex User",
        "role": "value",
        "type": "number"
    },
    "playing.account.thumb": {
        "description": "Avatar of Plex User",
        "role": "text",
        "type": "string"
    },
    "playing.account.title": {
        "description": "Name of Plex User",
        "role": "text",
        "type": "string"
    },
    "playing.account.userid": {
        "description": "ID of Plex User",
        "role": "value",
        "type": "number"
    },
    "playing.datetime": {
        "description": "DateTime of the event being received",
        "role": "text",
        "type": "string"
    },
    "playing.event": {
        "description": "Event triggered on Plex",
        "role": "text",
        "type": "string"
    },
    "playing.media": {
        "description": "media type",
        "role": "value",
        "type": "string"
    },
    "playing.metadata.addedat": {
        "convert": {
            "func": "date-timestamp",
            "key": "date",
            "role": "text",
            "type": "string"
        },
        "description": "Timestamp of add media to database",
        "role": "date",
        "type": "number"
    },
    "playing.metadata.addedatdate": {
        "convert": "date-timestamp",
        "description": "Date of add media to database",
        "role": "value",
        "type": "string"
    },
    "playing.metadata.art": {
        "convert": {
            "func": "create-link",
            "key": "_link",
            "role": "media.cover.big",
            "type": "string"
        },
        "description": "The artwork of the item",
        "role": "text",
        "type": "string"
    },
    "playing.metadata.art_link": {
        "convert": {
            "func": "create-link",
            "key": "_link",
            "role": "media.cover.big",
            "type": "string"
        },
        "description": "The artwork of the item",
        "role": "media.cover.big",
        "type": "string"
    },
    "playing.metadata.audiencerating": {
        "description": "Rating",
        "role": "value",
        "type": "number"
    },
    "playing.metadata.audienceratingimage": {
        "description": "Rating image",
        "role": "value",
        "type": "string"
    },
    "playing.metadata.audio": {
        "description": "Metadata audio",
        "type": "channel"
    },
    "playing.metadata.audio.audio_bitrate": {
        "description": "The audio bitrate of the original media.",
        "role": "text",
        "type": "string"
    },
    "playing.metadata.audio.audio_bitrate_mode": {
        "description": "The audio bitrate mode of the original media. (cbr or vbr)",
        "role": "text",
        "type": "string"
    },
    "playing.metadata.audio.audio_channel_layout": {
        "description": "The audio channel layout of the original media.",
        "role": "text",
        "type": "string"
    },
    "playing.metadata.audio.audio_channels": {
        "description": "The audio channels of the original media.",
        "role": "text",
        "type": "string"
    },
    "playing.metadata.audio.audio_codec": {
        "description": "The audio codec of the original media.",
        "role": "text",
        "type": "string"
    },
    "playing.metadata.audio.audio_language": {
        "description": "The audio language of the original media.",
        "role": "text",
        "type": "string"
    },
    "playing.metadata.audio.audio_language_code": {
        "description": "The audio language code of the original media.",
        "role": "text",
        "type": "string"
    },
    "playing.metadata.audio.audio_sample_rate": {
        "description": "The audio sample rate (in Hz) of the original media.",
        "role": "text",
        "type": "string"
    },
    "playing.metadata.chaptersource": {
        "description": "Source for chapter sections",
        "role": "text",
        "type": "string"
    },
    "playing.metadata.collection": {
        "description": "Collections as a list",
        "role": "text",
        "type": "string"
    },
    "playing.metadata.collectiontree.count": {
        "description": "Number of items within Plex in that category",
        "role": "value",
        "type": "number"
    },
    "playing.metadata.collectiontree.filter": {
        "description": "Filter to select this specific category",
        "role": "text",
        "type": "string"
    },
    "playing.metadata.collectiontree.id": {
        "description": "ID of this category",
        "role": "value",
        "type": "number"
    },
    "playing.metadata.collectiontree.tag": {
        "description": "Tag / Name of this category",
        "role": "text",
        "type": "string"
    },
    "playing.metadata.contentrating": {
        "description": "The content rating for the item. (e.g. TV-MA, TV-PG, etc.)",
        "role": "text",
        "type": "string"
    },
    "playing.metadata.country": {
        "description": "Countries as a list",
        "role": "text",
        "type": "string"
    },
    "playing.metadata.countrytree.count": {
        "description": "Number of items within Plex in that category",
        "role": "value",
        "type": "number"
    },
    "playing.metadata.countrytree.filter": {
        "description": "Filter to select this specific category",
        "role": "text",
        "type": "string"
    },
    "playing.metadata.countrytree.id": {
        "description": "ID of this category",
        "role": "value",
        "type": "number"
    },
    "playing.metadata.countrytree.tag": {
        "description": "Tag / Name of this category",
        "role": "text",
        "type": "string"
    },
    "playing.metadata.director": {
        "description": "Directors as a list",
        "role": "text",
        "type": "string"
    },
    "playing.metadata.directortree.count": {
        "description": "Number of items within Plex in that category",
        "role": "value",
        "type": "number"
    },
    "playing.metadata.directortree.filter": {
        "description": "Filter to select this specific category",
        "role": "text",
        "type": "string"
    },
    "playing.metadata.directortree.id": {
        "description": "ID of this category",
        "role": "value",
        "type": "number"
    },
    "playing.metadata.directortree.tag": {
        "description": "Tag / Name of this category",
        "role": "text",
        "type": "string"
    },
    "playing.metadata.duration": {
        "convert": {
            "func": "ms-min"
        },
        "description": "The duration (in minutes) for the item",
        "role": "value",
        "type": "number"
    },
    "playing.metadata.field": {
        "description": "Fields as a list",
        "role": "text",
        "type": "string"
    },
    "playing.metadata.fieldtree.locked": {
        "description": "(unknown)",
        "role": "indicator",
        "type": "boolean"
    },
    "playing.metadata.fieldtree.name": {
        "description": "Name",
        "role": "text",
        "type": "string"
    },
    "playing.metadata.file": {
        "description": "Metadata file",
        "type": "channel"
    },
    "playing.metadata.file.name": {
        "description": "The file name of the item",
        "role": "text",
        "type": "string"
    },
    "playing.metadata.file.path": {
        "description": "The file path to the item",
        "role": "text",
        "type": "string"
    },
    "playing.metadata.file.size": {
        "description": "The file size of the item",
        "role": "text",
        "type": "string"
    },
    "playing.metadata.genre": {
        "description": "Genres as a list",
        "role": "media.genre",
        "type": "string"
    },
    "playing.metadata.genretree.count": {
        "description": "Number of items within Plex in that category",
        "role": "value",
        "type": "number"
    },
    "playing.metadata.genretree.filter": {
        "description": "Filter to select this specific category",
        "role": "text",
        "type": "string"
    },
    "playing.metadata.genretree.id": {
        "description": "ID of this category",
        "role": "value",
        "type": "number"
    },
    "playing.metadata.genretree.tag": {
        "description": "Tag / Name of this category",
        "role": "text",
        "type": "string"
    },
    "playing.metadata.grandparentart": {
        "convert": {
            "func": "create-link",
            "key": "_link",
            "role": "media.cover.big",
            "type": "string"
        },
        "description": "",
        "role": "text",
        "type": "string"
    },
    "playing.metadata.grandparentart_link": {
        "convert": {
            "func": "create-link",
            "key": "_link",
            "role": "media.cover.big",
            "type": "string"
        },
        "description": "",
        "role": "media.cover.big",
        "type": "string"
    },
    "playing.metadata.grandparentguid": {
        "description": "",
        "role": "text",
        "type": "string"
    },
    "playing.metadata.grandparentkey": {
        "description": "",
        "role": "text",
        "type": "string"
    },
    "playing.metadata.grandparentratingkey": {
        "description": "",
        "role": "text",
        "type": "string"
    },
    "playing.metadata.grandparenttheme": {
        "description": "",
        "role": "text",
        "type": "string"
    },
    "playing.metadata.grandparentthumb": {
        "convert": {
            "func": "create-link",
            "key": "_link",
            "role": "media.cover.small",
            "type": "string"
        },
        "description": "",
        "role": "text",
        "type": "string"
    },
    "playing.metadata.grandparentthumb_link": {
        "convert": {
            "func": "create-link",
            "key": "_link",
            "role": "media.cover.small",
            "type": "string"
        },
        "description": "",
        "role": "media.cover.small",
        "type": "string"
    },
    "playing.metadata.grandparenttitle": {
        "description": "Parent title (e.g of show or artist)",
        "role": "media.season",
        "type": "string"
    },
    "playing.metadata.guid": {
        "description": "IMDb ID of the item",
        "role": "text",
        "type": "string"
    },
    "playing.metadata.index": {
        "description": "",
        "role": "value",
        "type": "number"
    },
    "playing.metadata.key": {
        "description": "Key of the item",
        "role": "text",
        "type": "string"
    },
    "playing.metadata.lastviewedat": {
        "convert": {
            "func": "date-timestamp",
            "key": "date",
            "role": "text",
            "type": "string"
        },
        "description": "Timestamp of last watched time",
        "role": "date",
        "type": "number"
    },
    "playing.metadata.lastviewedatdate": {
        "convert": "date-timestamp",
        "description": "add media at date",
        "role": "value",
        "type": "string"
    },
    "playing.metadata.librarysectionid": {
        "description": "The library ID of the item",
        "role": "value",
        "type": "number"
    },
    "playing.metadata.librarysectionkey": {
        "description": "The library key of the item",
        "role": "text",
        "type": "string"
    },
    "playing.metadata.librarysectiontitle": {
        "description": "The library name of the item",
        "role": "text",
        "type": "string"
    },
    "playing.metadata.librarysectiontype": {
        "description": "The library type of the item",
        "role": "text",
        "type": "string"
    },
    "playing.metadata.media": {
        "description": "Metadata Media",
        "type": "channel"
    },
    "playing.metadata.media.aspectratio": {
        "description": "Media aspectRatio",
        "role": "",
        "type": "number"
    },
    "playing.metadata.media.audiochannels": {
        "description": "Media audioChannels",
        "role": "",
        "type": "number"
    },
    "playing.metadata.media.audiocodec": {
        "description": "Media audioCodec",
        "role": "",
        "type": "string"
    },
    "playing.metadata.media.audioprofile": {
        "description": "Media audioProfile",
        "role": "",
        "type": "string"
    },
    "playing.metadata.media.bitrate": {
        "description": "Media bitrate",
        "role": "media.bitrate",
        "type": "number"
    },
    "playing.metadata.media.container": {
        "description": "Media container",
        "role": "",
        "type": "string"
    },
    "playing.metadata.media.duration": {
        "description": "Media duration",
        "role": "",
        "type": "number"
    },
    "playing.metadata.media.has64bitoffsets": {
        "description": "Media has64bitOffsets",
        "role": "",
        "type": "boolean"
    },
    "playing.metadata.media.height": {
        "description": "Media height",
        "role": "",
        "type": "number"
    },
    "playing.metadata.media.id": {
        "description": "Media id",
        "role": "",
        "type": "number"
    },
    "playing.metadata.media.list": {
        "description": "Media list",
        "type": "channel"
    },
    "playing.metadata.media.optimizedforstreaming": {
        "description": "Media optimizedForStreaming",
        "role": "",
        "type": "number"
    },
    "playing.metadata.media.part": {
        "description": "Media Part",
        "type": "channel"
    },
    "playing.metadata.media.part.audioprofile": {
        "description": "Part audioProfile",
        "role": "",
        "type": "string"
    },
    "playing.metadata.media.part.container": {
        "description": "Part container",
        "role": "",
        "type": "string"
    },
    "playing.metadata.media.part.duration": {
        "description": "Part duration",
        "role": "",
        "type": "number"
    },
    "playing.metadata.media.part.file": {
        "description": "Part file",
        "role": "",
        "type": "string"
    },
    "playing.metadata.media.part.has64bitoffsets": {
        "description": "Part has64bitOffsets",
        "role": "",
        "type": "boolean"
    },
    "playing.metadata.media.part.haschaptervideostream": {
        "description": "Part hasChapterVideoStream",
        "role": "",
        "type": "boolean"
    },
    "playing.metadata.media.part.hasthumbnail": {
        "description": "Part hasThumbnail",
        "role": "",
        "type": "string"
    },
    "playing.metadata.media.part.id": {
        "description": "Part id",
        "role": "",
        "type": "number"
    },
    "playing.metadata.media.part.key": {
        "convert": {
            "func": "create-link",
            "key": "_link",
            "role": "media.url",
            "type": "string"
        },
        "description": "Media url",
        "role": "",
        "type": "string"
    },
    "playing.metadata.media.part.list": {
        "description": "Part list",
        "type": "channel"
    },
    "playing.metadata.media.part.optimizedforstreaming": {
        "description": "Part optimizedForStreaming",
        "role": "",
        "type": "boolean"
    },
    "playing.metadata.media.part.size": {
        "description": "Part size",
        "role": "",
        "type": "number"
    },
    "playing.metadata.media.part.stream": {
        "description": "Part Stream",
        "type": "channel"
    },
    "playing.metadata.media.part.stream.albumgain": {
        "description": "Stream albumGain",
        "role": "",
        "type": "string"
    },
    "playing.metadata.media.part.stream.albumpeak": {
        "description": "Stream albumPeak",
        "role": "",
        "type": "string"
    },
    "playing.metadata.media.part.stream.albumrange": {
        "description": "Stream albumRange",
        "role": "",
        "type": "string"
    },
    "playing.metadata.media.part.stream.anamorphic": {
        "description": "Stream anamorphic",
        "role": "",
        "type": "boolean"
    },
    "playing.metadata.media.part.stream.audiochannellayout": {
        "description": "Stream audioChannelLayout",
        "role": "",
        "type": "string"
    },
    "playing.metadata.media.part.stream.bitdepth": {
        "description": "Stream bitDepth",
        "role": "",
        "type": "number"
    },
    "playing.metadata.media.part.stream.bitrate": {
        "description": "Stream bitrate",
        "role": "media.bitrate",
        "type": "number"
    },
    "playing.metadata.media.part.stream.channels": {
        "description": "Stream channels",
        "role": "",
        "type": "number"
    },
    "playing.metadata.media.part.stream.chromalocation": {
        "description": "Stream chromaLocation",
        "role": "",
        "type": "string"
    },
    "playing.metadata.media.part.stream.chromasubsampling": {
        "description": "Stream chromaSubsampling",
        "role": "",
        "type": "string"
    },
    "playing.metadata.media.part.stream.codec": {
        "description": "Stream codec",
        "role": "",
        "type": "string"
    },
    "playing.metadata.media.part.stream.codedheight": {
        "description": "Stream codedHeight",
        "role": "",
        "type": "number"
    },
    "playing.metadata.media.part.stream.codedwidth": {
        "description": "Stream codedWidth",
        "role": "",
        "type": "number"
    },
    "playing.metadata.media.part.stream.colorprimaries": {
        "description": "Stream colorPrimaries",
        "role": "",
        "type": "string"
    },
    "playing.metadata.media.part.stream.colorrange": {
        "description": "Stream colorRange",
        "role": "",
        "type": "string"
    },
    "playing.metadata.media.part.stream.colorspace": {
        "description": "Stream colorSpace",
        "role": "",
        "type": "string"
    },
    "playing.metadata.media.part.stream.colortrc": {
        "description": "Stream colorTrc",
        "role": "",
        "type": "string"
    },
    "playing.metadata.media.part.stream.default": {
        "description": "Stream default",
        "role": "",
        "type": "boolean"
    },
    "playing.metadata.media.part.stream.displaytitle": {
        "description": "Stream displayTitle",
        "role": "",
        "type": "string"
    },
    "playing.metadata.media.part.stream.extendeddisplaytitle": {
        "description": "Stream extendedDisplayTitle",
        "role": "",
        "type": "string"
    },
    "playing.metadata.media.part.stream.format": {
        "description": "Stream format",
        "role": "",
        "type": "string"
    },
    "playing.metadata.media.part.stream.framerate": {
        "description": "Stream frameRate",
        "role": "",
        "type": "number"
    },
    "playing.metadata.media.part.stream.gain": {
        "description": "Stream gain",
        "role": "",
        "type": "string"
    },
    "playing.metadata.media.part.stream.hasscalingmatrix": {
        "description": "Stream hasScalingMatrix",
        "role": "",
        "type": "boolean"
    },
    "playing.metadata.media.part.stream.height": {
        "description": "Stream height",
        "role": "",
        "type": "number"
    },
    "playing.metadata.media.part.stream.id": {
        "description": "Stream id",
        "role": "",
        "type": "number"
    },
    "playing.metadata.media.part.stream.index": {
        "description": "Stream index",
        "role": "",
        "type": "number"
    },
    "playing.metadata.media.part.stream.key": {
        "convert": {
            "func": "create-link",
            "key": "_link",
            "role": "media.url",
            "type": "string"
        },
        "description": "Media url",
        "role": "",
        "type": "string"
    },
    "playing.metadata.media.part.stream.language": {
        "description": "Stream language",
        "role": "",
        "type": "string"
    },
    "playing.metadata.media.part.stream.languagecode": {
        "description": "Stream languageCode",
        "role": "",
        "type": "string"
    },
    "playing.metadata.media.part.stream.languagetag": {
        "description": "Stream languageTag",
        "role": "",
        "type": "string"
    },
    "playing.metadata.media.part.stream.level": {
        "description": "Stream level",
        "role": "",
        "type": "number"
    },
    "playing.metadata.media.part.stream.list": {
        "description": "Stream list",
        "type": "channel"
    },
    "playing.metadata.media.part.stream.loudness": {
        "description": "Stream loudness",
        "role": "",
        "type": "string"
    },
    "playing.metadata.media.part.stream.lra": {
        "description": "Stream lra",
        "role": "",
        "type": "string"
    },
    "playing.metadata.media.part.stream.peak": {
        "description": "Stream peak",
        "role": "",
        "type": "string"
    },
    "playing.metadata.media.part.stream.pixelaspectratio": {
        "description": "Stream pixelAspectRatio",
        "role": "",
        "type": "string"
    },
    "playing.metadata.media.part.stream.profile": {
        "description": "Stream profile",
        "role": "",
        "type": "string"
    },
    "playing.metadata.media.part.stream.provider": {
        "description": "Stream provider",
        "role": "",
        "type": "string"
    },
    "playing.metadata.media.part.stream.refframes": {
        "description": "Stream refFrames",
        "role": "",
        "type": "number"
    },
    "playing.metadata.media.part.stream.samplingrate": {
        "description": "Stream samplingRate",
        "role": "",
        "type": "number"
    },
    "playing.metadata.media.part.stream.scantype": {
        "description": "Stream scanType",
        "role": "",
        "type": "string"
    },
    "playing.metadata.media.part.stream.selected": {
        "description": "Stream selected",
        "role": "",
        "type": "boolean"
    },
    "playing.metadata.media.part.stream.streamidentifier": {
        "description": "Stream streamIdentifier",
        "role": "",
        "type": "string"
    },
    "playing.metadata.media.part.stream.streamtype": {
        "description": "Stream streamType",
        "role": "",
        "type": "number"
    },
    "playing.metadata.media.part.stream.width": {
        "description": "Stream width",
        "role": "",
        "type": "number"
    },
    "playing.metadata.media.part.videoprofile": {
        "description": "Part videoProfile",
        "role": "",
        "type": "string"
    },
    "playing.metadata.media.videocodec": {
        "description": "Media videoCodec",
        "role": "",
        "type": "string"
    },
    "playing.metadata.media.videoframerate": {
        "description": "Media videoFrameRate",
        "role": "",
        "type": "string"
    },
    "playing.metadata.media.videoprofile": {
        "description": "Media videoProfile",
        "role": "",
        "type": "string"
    },
    "playing.metadata.media.videoresolution": {
        "description": "Media videoResolution",
        "role": "",
        "type": "string"
    },
    "playing.metadata.media.width": {
        "description": "Media width",
        "role": "",
        "type": "number"
    },
    "playing.metadata.music.lyric.codec": {
        "description": "Codec for this Lyric",
        "role": "value",
        "type": "string"
    },
    "playing.metadata.music.lyric.url": {
        "description": "Url to lyricfile",
        "func": "convert-link-only",
        "role": "url",
        "type": "string"
    },
    "playing.metadata.music.media.mediaurl": {
        "description": "Url to song",
        "func": "convert-link-only",
        "role": "media.url",
        "type": "string"
    },
    "playing.metadata.originallyavailableat": {
        "description": "Timestamp of last watched time",
        "role": "text",
        "type": "string"
    },
    "playing.metadata.originaltitle": {
        "description": "Original Title",
        "role": "media.episode",
        "type": "string"
    },
    "playing.metadata.originaltitle": {
        "description": "Metadata originalTitle",
        "role": "",
        "type": "string"
    },
    "playing.metadata.parentguid": {
        "description": "Parent guid (e.g of season or album)",
        "role": "text",
        "type": "string"
    },
    "playing.metadata.parentindex": {
        "description": "Parent index (e.g of season or album)",
        "role": "value",
        "type": "number"
    },
    "playing.metadata.parentkey": {
        "description": "Parent key (e.g of season or album)",
        "role": "text",
        "type": "string"
    },
    "playing.metadata.parentratingkey": {
        "description": "Parent rating key (e.g of season or album)",
        "role": "value",
        "type": "string"
    },
    "playing.metadata.parentthumb": {
        "convert": {
            "func": "create-link",
            "key": "_link",
            "role": "media.cover.small",
            "type": "string"
        },
        "description": "Parent thumb (e.g of season or album)",
        "role": "text",
        "type": "string"
    },
    "playing.metadata.parentthumb_link": {
        "convert": {
            "func": "create-link",
            "key": "_link",
            "role": "media.cover.small",
            "type": "string"
        },
        "description": "Parent thumb (e.g of season or album)",
        "role": "media.cover.small",
        "type": "string"
    },
    "playing.metadata.parenttitle": {
        "description": "Parent title (e.g of season or album)",
        "role": "media.album",
        "type": "string"
    },
    "playing.metadata.parentyear": {
        "description": "Metadata parentYear",
        "role": "",
        "type": "number"
    },
    "playing.metadata.posterthumb": {
        "description": "Metadata posterThumb",
        "role": "",
        "type": "string"
    },
    "playing.metadata.primaryextrakey": {
        "description": "Key (#2) of the item",
        "role": "text",
        "type": "string"
    },
    "playing.metadata.producer": {
        "description": "Producers as a list",
        "role": "text",
        "type": "string"
    },
    "playing.metadata.producertree.count": {
        "description": "Number of items within Plex in that category",
        "role": "value",
        "type": "number"
    },
    "playing.metadata.producertree.filter": {
        "description": "Filter to select this specific category",
        "role": "text",
        "type": "string"
    },
    "playing.metadata.producertree.id": {
        "description": "ID of this category",
        "role": "value",
        "type": "number"
    },
    "playing.metadata.producertree.tag": {
        "description": "Tag / Name of this category",
        "role": "text",
        "type": "string"
    },
    "playing.metadata.rating": {
        "description": "The rating (out of 10) for the item",
        "role": "state",
        "type": "number"
    },
    "playing.metadata.ratingcount": {
        "description": "Metadata ratingCount",
        "role": "",
        "type": "number"
    },
    "playing.metadata.ratingimage": {
        "description": "",
        "role": "text",
        "type": "string"
    },
    "playing.metadata.ratingimage": {
        "description": "",
        "role": "text",
        "type": "string"
    },
    "playing.metadata.ratingkey": {
        "description": "The unique identifier for the movie, episode, or track.",
        "role": "value",
        "type": "string"
    },
    "playing.metadata.role": {
        "description": "Roles as a list",
        "role": "text",
        "type": "string"
    },
    "playing.metadata.roletree.count": {
        "description": "Number of items within Plex in that category",
        "role": "value",
        "type": "number"
    },
    "playing.metadata.roletree.filter": {
        "description": "Filter to select this specific category",
        "role": "text",
        "type": "string"
    },
    "playing.metadata.roletree.id": {
        "description": "ID of this category",
        "role": "value",
        "type": "number"
    },
    "playing.metadata.roletree.role": {
        "description": "Name of role",
        "role": "text",
        "type": "string"
    },
    "playing.metadata.roletree.tag": {
        "description": "Name of the actor",
        "role": "text",
        "type": "string"
    },
    "playing.metadata.roletree.thumb": {
        "description": "Thumbnail of the actor",
        "role": "text",
        "type": "string"
    },
    "playing.metadata.similar": {
        "description": "Similar as a list",
        "role": "text",
        "type": "string"
    },
    "playing.metadata.similartree.count": {
        "description": "Number of items within Plex in that category",
        "role": "value",
        "type": "number"
    },
    "playing.metadata.similartree.filter": {
        "description": "Filter to select this specific category",
        "role": "text",
        "type": "string"
    },
    "playing.metadata.similartree.id": {
        "description": "ID of this category",
        "role": "value",
        "type": "number"
    },
    "playing.metadata.similartree.tag": {
        "description": "Tag / Name of this category",
        "role": "text",
        "type": "string"
    },
    "playing.metadata.skipcount": {
        "description": "Metadata skipCount",
        "role": "",
        "type": "number"
    },
    "playing.metadata.stream": {
        "description": "Metadata stream",
        "type": "channel"
    },
    "playing.metadata.stream.live": {
        "description": "If the stream is live TV. (0 or 1)",
        "role": "text",
        "type": "string"
    },
    "playing.metadata.stream.optimized_version": {
        "description": "If the stream is an optimized version. (0 or 1)",
        "role": "text",
        "type": "string"
    },
    "playing.metadata.stream.optimized_version_profile": {
        "description": "The optimized version profile of the stream.",
        "role": "text",
        "type": "string"
    },
    "playing.metadata.stream.player": {
        "description": "stream player",
        "type": "channel"
    },
    "playing.metadata.stream.player.device": {
        "description": "The type of client device being used for playback.",
        "role": "text",
        "type": "string"
    },
    "playing.metadata.stream.player.ip_address": {
        "description": "The IP address of the device being used for playback.",
        "role": "text",
        "type": "string"
    },
    "playing.metadata.stream.player.platform": {
        "description": "The type of client platform being used for playback.",
        "role": "text",
        "type": "string"
    },
    "playing.metadata.stream.player.player": {
        "description": "The name of the player being used for playback.",
        "role": "text",
        "type": "string"
    },
    "playing.metadata.stream.player.product": {
        "description": "The type of client product being used for playback.",
        "role": "text",
        "type": "string"
    },
    "playing.metadata.stream.progress_duration": {
        "description": "stream progress_duration",
        "role": "",
        "type": "string"
    },
    "playing.metadata.stream.progress_percent": {
        "description": "stream progress_percent",
        "role": "",
        "type": "string"
    },
    "playing.metadata.stream.progress_time": {
        "description": "stream progress_time",
        "role": "",
        "type": "string"
    },
    "playing.metadata.stream.quality_profile": {
        "description": "The Plex quality profile of the stream. (e.g. Original, 4 Mbps 720p, etc.)",
        "role": "text",
        "type": "string"
    },
    "playing.metadata.stream.remaining_duration": {
        "description": "stream remaining_duration",
        "role": "",
        "type": "string"
    },
    "playing.metadata.stream.remaining_time": {
        "description": "stream remaining_time",
        "role": "",
        "type": "string"
    },
    "playing.metadata.stream.stream_aspect_ratio": {
        "description": "The aspect ratio of the stream.",
        "role": "text",
        "type": "string"
    },
    "playing.metadata.stream.stream_audio": {
        "description": "stream stream_audio",
        "type": "channel"
    },
    "playing.metadata.stream.stream_audio.stream_audio_bitrate": {
        "description": "stream_audio stream_audio_bitrate",
        "role": "media.bitrate",
        "type": "string"
    },
    "playing.metadata.stream.stream_audio.stream_audio_bitrate_mode": {
        "description": "stream_audio stream_audio_bitrate_mode",
        "role": "",
        "type": "string"
    },
    "playing.metadata.stream.stream_audio.stream_audio_channel_layout": {
        "description": "stream_audio stream_audio_channel_layout",
        "role": "",
        "type": "string"
    },
    "playing.metadata.stream.stream_audio.stream_audio_channels": {
        "description": "stream_audio stream_audio_channels",
        "role": "",
        "type": "string"
    },
    "playing.metadata.stream.stream_audio.stream_audio_codec": {
        "description": "stream_audio stream_audio_codec",
        "role": "",
        "type": "string"
    },
    "playing.metadata.stream.stream_audio.stream_audio_language": {
        "description": "stream_audio stream_audio_language",
        "role": "",
        "type": "string"
    },
    "playing.metadata.stream.stream_audio.stream_audio_language_code": {
        "description": "stream_audio stream_audio_language_code",
        "role": "",
        "type": "string"
    },
    "playing.metadata.stream.stream_audio.stream_audio_sample_rate": {
        "description": "stream_audio stream_audio_sample_rate",
        "role": "",
        "type": "string"
    },
    "playing.metadata.stream.stream_audio_bitrate": {
        "description": "The audio bitrate of the stream.",
        "role": "text",
        "type": "string"
    },
    "playing.metadata.stream.stream_audio_bitrate_mode": {
        "description": "The audio bitrate mode of the stream. (cbr or vbr)",
        "role": "text",
        "type": "string"
    },
    "playing.metadata.stream.stream_audio_channel_layout": {
        "description": "The audio channel layout of the stream.",
        "role": "text",
        "type": "string"
    },
    "playing.metadata.stream.stream_audio_channels": {
        "description": "The audio channels of the stream.",
        "role": "text",
        "type": "string"
    },
    "playing.metadata.stream.stream_audio_codec": {
        "description": "The audio codec of the stream.",
        "role": "text",
        "type": "string"
    },
    "playing.metadata.stream.stream_audio_language": {
        "description": "The audio language of the stream.",
        "role": "text",
        "type": "string"
    },
    "playing.metadata.stream.stream_audio_language_code": {
        "description": "The audio language code of the stream.",
        "role": "text",
        "type": "string"
    },
    "playing.metadata.stream.stream_audio_sample_rate": {
        "description": "The audio sample rate (in Hz) of the stream.",
        "role": "text",
        "type": "string"
    },
    "playing.metadata.stream.stream_bandwidth": {
        "description": "The required bandwidth (in kbps) of the stream. (not the used bandwidth)",
        "role": "text",
        "type": "string"
    },
    "playing.metadata.stream.stream_bitrate": {
        "description": "The bitrate (in kbps) of the stream.",
        "role": "text",
        "type": "string"
    },
    "playing.metadata.stream.stream_container": {
        "description": "The media container of the stream.",
        "role": "text",
        "type": "string"
    },
    "playing.metadata.stream.stream_duration": {
        "description": "stream stream_duration",
        "role": "",
        "type": "string"
    },
    "playing.metadata.stream.stream_local": {
        "description": "If the stream is local. (0 or 1)",
        "role": "text",
        "type": "string"
    },
    "playing.metadata.stream.stream_location": {
        "description": "The network location of the stream. (lan or wan)",
        "role": "text",
        "type": "string"
    },
    "playing.metadata.stream.stream_subtitle": {
        "description": "stream stream_subtitle",
        "type": "channel"
    },
    "playing.metadata.stream.stream_subtitle.stream_subtitle_codec": {
        "description": "stream_subtitle stream_subtitle_codec",
        "role": "",
        "type": "string"
    },
    "playing.metadata.stream.stream_subtitle.stream_subtitle_container": {
        "description": "stream_subtitle stream_subtitle_container",
        "role": "",
        "type": "string"
    },
    "playing.metadata.stream.stream_subtitle.stream_subtitle_forced": {
        "description": "stream_subtitle stream_subtitle_forced",
        "role": "",
        "type": "string"
    },
    "playing.metadata.stream.stream_subtitle.stream_subtitle_format": {
        "description": "stream_subtitle stream_subtitle_format",
        "role": "",
        "type": "string"
    },
    "playing.metadata.stream.stream_subtitle.stream_subtitle_language": {
        "description": "stream_subtitle stream_subtitle_language",
        "role": "",
        "type": "string"
    },
    "playing.metadata.stream.stream_subtitle.stream_subtitle_language_code": {
        "description": "stream_subtitle stream_subtitle_language_code",
        "role": "",
        "type": "string"
    },
    "playing.metadata.stream.stream_subtitle.stream_subtitle_location": {
        "description": "stream_subtitle stream_subtitle_location",
        "role": "",
        "type": "string"
    },
    "playing.metadata.stream.stream_subtitle_codec": {
        "description": "The subtitle codec of the stream.",
        "role": "text",
        "type": "string"
    },
    "playing.metadata.stream.stream_subtitle_container": {
        "description": "The subtitle container of the stream.",
        "role": "text",
        "type": "string"
    },
    "playing.metadata.stream.stream_subtitle_forced": {
        "description": "If the subtitles are forced. (0 or 1)",
        "role": "text",
        "type": "string"
    },
    "playing.metadata.stream.stream_subtitle_format": {
        "description": "The subtitle format of the stream.",
        "role": "text",
        "type": "string"
    },
    "playing.metadata.stream.stream_subtitle_language": {
        "description": "The subtitle language of the stream.",
        "role": "text",
        "type": "string"
    },
    "playing.metadata.stream.stream_subtitle_language_code": {
        "description": "The subtitle language code of the stream.",
        "role": "text",
        "type": "string"
    },
    "playing.metadata.stream.stream_subtitle_location": {
        "description": "The subtitle location of the stream.",
        "role": "text",
        "type": "string"
    },
    "playing.metadata.stream.stream_time": {
        "description": "stream stream_time",
        "role": "",
        "type": "string"
    },
    "playing.metadata.stream.stream_video": {
        "description": "stream stream_video",
        "type": "channel"
    },
    "playing.metadata.stream.stream_video.stream_video_bit_depth": {
        "description": "stream_video stream_video_bit_depth",
        "role": "",
        "type": "string"
    },
    "playing.metadata.stream.stream_video.stream_video_bitrate": {
        "description": "stream_video stream_video_bitrate",
        "role": "media.bitrate",
        "type": "string"
    },
    "playing.metadata.stream.stream_video.stream_video_codec": {
        "description": "stream_video stream_video_codec",
        "role": "",
        "type": "string"
    },
    "playing.metadata.stream.stream_video.stream_video_codec_level": {
        "description": "stream_video stream_video_codec_level",
        "role": "",
        "type": "string"
    },
    "playing.metadata.stream.stream_video.stream_video_framerate": {
        "description": "stream_video stream_video_framerate",
        "role": "",
        "type": "string"
    },
    "playing.metadata.stream.stream_video.stream_video_height": {
        "description": "stream_video stream_video_height",
        "role": "",
        "type": "string"
    },
    "playing.metadata.stream.stream_video.stream_video_language": {
        "description": "stream_video stream_video_language",
        "role": "",
        "type": "string"
    },
    "playing.metadata.stream.stream_video.stream_video_language_code": {
        "description": "stream_video stream_video_language_code",
        "role": "",
        "type": "string"
    },
    "playing.metadata.stream.stream_video.stream_video_ref_frames": {
        "description": "stream_video stream_video_ref_frames",
        "role": "",
        "type": "string"
    },
    "playing.metadata.stream.stream_video.stream_video_resolution": {
        "description": "stream_video stream_video_resolution",
        "role": "",
        "type": "string"
    },
    "playing.metadata.stream.stream_video.stream_video_width": {
        "description": "stream_video stream_video_width",
        "role": "",
        "type": "string"
    },
    "playing.metadata.stream.stream_video_bit_depth": {
        "description": "The video bit depth of the stream.",
        "role": "text",
        "type": "string"
    },
    "playing.metadata.stream.stream_video_bitrate": {
        "description": "The video bitrate (in kbps) of the stream.",
        "role": "text",
        "type": "string"
    },
    "playing.metadata.stream.stream_video_codec": {
        "description": "The video codec of the stream.",
        "role": "text",
        "type": "string"
    },
    "playing.metadata.stream.stream_video_codec_level": {
        "description": "The video codec level of the stream.",
        "role": "text",
        "type": "string"
    },
    "playing.metadata.stream.stream_video_framerate": {
        "description": "The video framerate of the stream.",
        "role": "text",
        "type": "string"
    },
    "playing.metadata.stream.stream_video_height": {
        "description": "The video height of the stream.",
        "role": "text",
        "type": "string"
    },
    "playing.metadata.stream.stream_video_language": {
        "description": "The video language of the stream.",
        "role": "text",
        "type": "string"
    },
    "playing.metadata.stream.stream_video_language_code": {
        "description": "The video language code of the stream.",
        "role": "text",
        "type": "string"
    },
    "playing.metadata.stream.stream_video_ref_frames": {
        "description": "The video reference frames of the stream.",
        "role": "text",
        "type": "string"
    },
    "playing.metadata.stream.stream_video_resolution": {
        "description": "The video resolution of the stream.",
        "role": "text",
        "type": "string"
    },
    "playing.metadata.stream.stream_video_width": {
        "description": "The video width of the stream.",
        "role": "text",
        "type": "string"
    },
    "playing.metadata.stream.synced_version": {
        "description": "If the stream is an synced version. (0 or 1)",
        "role": "text",
        "type": "string"
    },
    "playing.metadata.stream.user": {
        "description": "stream user",
        "type": "channel"
    },
    "playing.metadata.stream.user.email": {
        "description": "The email address of the person streaming.",
        "role": "text",
        "type": "string"
    },
    "playing.metadata.stream.user.name": {
        "description": "The friendly name of the person streaming.",
        "role": "text",
        "type": "string"
    },
    "playing.metadata.stream.user.streams": {
        "description": "The number of concurrent streams.",
        "role": "text",
        "type": "string"
    },
    "playing.metadata.stream.user.user": {
        "description": "The username of the person streaming.",
        "role": "text",
        "type": "string"
    },
    "playing.metadata.stream.user.user_streams": {
        "description": "The number of concurrent streams by the person streaming.",
        "role": "text",
        "type": "string"
    },
    "playing.metadata.studio": {
        "description": "The studio for the item",
        "role": "text",
        "type": "string"
    },
    "playing.metadata.subtitles": {
        "description": "Metadata subtitles",
        "type": "channel"
    },
    "playing.metadata.subtitles.subtitle_codec": {
        "description": "The subtitle codec of the original media.",
        "role": "text",
        "type": "string"
    },
    "playing.metadata.subtitles.subtitle_container": {
        "description": "The subtitle container of the original media.",
        "role": "text",
        "type": "string"
    },
    "playing.metadata.subtitles.subtitle_forced": {
        "description": "If the subtitles are forced. (0 or 1)",
        "role": "text",
        "type": "string"
    },
    "playing.metadata.subtitles.subtitle_format": {
        "description": "The subtitle format of the original media.",
        "role": "text",
        "type": "string"
    },
    "playing.metadata.subtitles.subtitle_language": {
        "description": "The subtitle language of the original media.",
        "role": "text",
        "type": "string"
    },
    "playing.metadata.subtitles.subtitle_language_code": {
        "description": "The subtitle language code of the original media.",
        "role": "text",
        "type": "string"
    },
    "playing.metadata.subtitles.subtitle_location": {
        "description": "The subtitle location of the original media.",
        "role": "text",
        "type": "string"
    },
    "playing.metadata.subtype": {
        "description": "Media subtype (e.g. trailer)",
        "role": "text",
        "type": "string"
    },
    "playing.metadata.summary": {
        "description": "A short plot summary for the item",
        "role": "text",
        "type": "string"
    },
    "playing.metadata.tagline": {
        "description": "A tagline for the media item",
        "role": "text",
        "type": "string"
    },
    "playing.metadata.thumb": {
        "convert": {
            "func": "create-link",
            "key": "_link",
            "role": "media.cover.small",
            "type": "string"
        },
        "description": "The thumbnail of the item",
        "role": "text",
        "type": "string"
    },
    "playing.metadata.thumb_link": {
        "convert": {
            "func": "create-link",
            "key": "_link",
            "role": "media.cover.small",
            "type": "string"
        },
        "description": "The thumbnail of the item",
        "role": "media.cover.small",
        "type": "string"
    },
    "playing.metadata.title": {
        "description": "The full title of the item",
        "role": "media.title",
        "type": "string"
    },
    "playing.metadata.titlesort": {
        "description": "The sorting title of the item",
        "role": "text",
        "type": "string"
    },
    "playing.metadata.transcoding": {
        "description": "Metadata transcoding",
        "type": "channel"
    },
    "playing.metadata.transcoding.audio_decision": {
        "description": "The audio transcode decisions of the stream.",
        "role": "text",
        "type": "string"
    },
    "playing.metadata.transcoding.subtitle_decision": {
        "description": "The subtitle transcode decisions of the stream.",
        "role": "text",
        "type": "string"
    },
    "playing.metadata.transcoding.transcode_audio_channels": {
        "description": "The audio channels of the transcoded stream.",
        "role": "text",
        "type": "string"
    },
    "playing.metadata.transcoding.transcode_audio_codec": {
        "description": "The audio codec of the transcoded stream.",
        "role": "text",
        "type": "string"
    },
    "playing.metadata.transcoding.transcode_container": {
        "description": "The media container of the transcoded stream.",
        "role": "text",
        "type": "string"
    },
    "playing.metadata.transcoding.transcode_decision": {
        "description": "The transcode decisions of the stream.",
        "role": "text",
        "type": "string"
    },
    "playing.metadata.transcoding.transcode_hw_decode": {
        "description": "The hardware decoding codec.",
        "role": "text",
        "type": "string"
    },
    "playing.metadata.transcoding.transcode_hw_decode_title": {
        "description": "The hardware decoding codec title.",
        "role": "text",
        "type": "string"
    },
    "playing.metadata.transcoding.transcode_hw_decoding": {
        "description": "If hardware decoding is used. (0 or 1)",
        "role": "text",
        "type": "string"
    },
    "playing.metadata.transcoding.transcode_hw_encode": {
        "description": "The hardware encoding codec.",
        "role": "text",
        "type": "string"
    },
    "playing.metadata.transcoding.transcode_hw_encode_title": {
        "description": "The hardware encoding codec title.",
        "role": "text",
        "type": "string"
    },
    "playing.metadata.transcoding.transcode_hw_encoding": {
        "description": "If hardware encoding is used. (0 or 1)",
        "role": "text",
        "type": "string"
    },
    "playing.metadata.transcoding.transcode_hw_requested": {
        "description": "If hardware decoding/encoding was requested. (0 or 1)",
        "role": "text",
        "type": "string"
    },
    "playing.metadata.transcoding.transcode_video_codec": {
        "description": "The video codec of the transcoded stream.",
        "role": "text",
        "type": "string"
    },
    "playing.metadata.transcoding.transcode_video_height": {
        "description": "The video height of the transcoded stream.",
        "role": "text",
        "type": "string"
    },
    "playing.metadata.transcoding.transcode_video_width": {
        "description": "The video width of the transcoded stream.",
        "role": "text",
        "type": "string"
    },
    "playing.metadata.transcoding.video_decision": {
        "description": "The video transcode decisions of the stream.",
        "role": "text",
        "type": "string"
    },
    "playing.metadata.type": {
        "description": "The type of media. (movie, show, season, episode, artist, album, track, clip)",
        "role": "text",
        "type": "string"
    },
    "playing.metadata.updatedat": {
        "convert": {
            "func": "date-timestamp",
            "key": "date",
            "role": "text",
            "type": "string"
        },
        "description": "Timestamp of last updated time",
        "role": "date",
        "type": "number"
    },
    "playing.metadata.updatedatdate": {
        "convert": "date-timestamp",
        "description": "Date of last viewed time",
        "role": "value",
        "type": "string"
    },
    "playing.metadata.userrating": {
        "description": "User Rating",
        "role": "value",
        "type": "number"
    },
    "playing.metadata.video": {
        "description": "Metadata video",
        "type": "channel"
    },
    "playing.metadata.video.aspect_ratio": {
        "description": "The aspect ratio of the original media.",
        "role": "text",
        "type": "string"
    },
    "playing.metadata.video.bitrate": {
        "description": "The bitrate of the original media.",
        "role": "text",
        "type": "string"
    },
    "playing.metadata.video.container": {
        "description": "The media container of the original media.",
        "role": "text",
        "type": "string"
    },
    "playing.metadata.video.video_bit_depth": {
        "description": "The video bit depth of the original media.",
        "role": "text",
        "type": "string"
    },
    "playing.metadata.video.video_bitrate": {
        "description": "The video bitrate of the original media.",
        "role": "text",
        "type": "string"
    },
    "playing.metadata.video.video_codec": {
        "description": "The video codec of the original media.",
        "role": "text",
        "type": "string"
    },
    "playing.metadata.video.video_codec_level": {
        "description": "The video codec level of the original media.",
        "role": "text",
        "type": "string"
    },
    "playing.metadata.video.video_framerate": {
        "description": "The video framerate of the original media.",
        "role": "text",
        "type": "string"
    },
    "playing.metadata.video.video_height": {
        "description": "The video height of the original media.",
        "role": "text",
        "type": "string"
    },
    "playing.metadata.video.video_language": {
        "description": "The video language of the original media.",
        "role": "text",
        "type": "string"
    },
    "playing.metadata.video.video_language_code": {
        "description": "The video language code of the original media.",
        "role": "text",
        "type": "string"
    },
    "playing.metadata.video.video_ref_frames": {
        "description": "The video reference frames of the original media.",
        "role": "text",
        "type": "string"
    },
    "playing.metadata.video.video_resolution": {
        "description": "The video resolution of the original media.",
        "role": "text",
        "type": "string"
    },
    "playing.metadata.video.video_width": {
        "description": "The video width of the original media.",
        "role": "text",
        "type": "string"
    },
    "playing.metadata.viewcount": {
        "description": "Number item has been watched",
        "role": "value",
        "type": "number"
    },
    "playing.metadata.viewoffset": {
        "convert": {
            "func": "seconds-readable"
        },
        "description": "Last viewing position in milliseconds",
        "role": "value",
        "type": "number"
    },
    "playing.metadata.viewoffsethuman": {
        "convert": {
            "func": "seconds-readable"
        },
        "description": "Last viewing position",
        "role": "text",
        "type": "string"
    },
    "playing.metadata.viewoffsetseconds": {
        "convert": {
            "func": "seconds-readable"
        },
        "description": "Last viewing position in seconds(refresh)",
        "role": "media.elapsed",
        "type": "number"
    },
    "playing.metadata.writer": {
        "description": "Writers as a list",
        "role": "text",
        "type": "string"
    },
    "playing.metadata.writertree.count": {
        "description": "Number of items within Plex in that category",
        "role": "value",
        "type": "number"
    },
    "playing.metadata.writertree.filter": {
        "description": "Filter to select this specific category",
        "role": "text",
        "type": "string"
    },
    "playing.metadata.writertree.id": {
        "description": "ID of this category",
        "role": "value",
        "type": "number"
    },
    "playing.metadata.writertree.tag": {
        "description": "Tag / Name of this category",
        "role": "text",
        "type": "string"
    },
    "playing.metadata.year": {
        "description": "The release year for the item",
        "role": "text",
        "type": "number"
    },
    "playing.owner": {
        "description": "Indicator if webhook was set by Plex Owner",
        "role": "indicator",
        "type": "boolean"
    },
    "playing.player": {
        "description": "Viewing device",
        "role": "value",
        "type": "string"
    },
    "playing.player.connected": {
        "description": "Player is connected with plex adapter",
        "role": "value",
        "type": "boolean"
    },
    "playing.player.controllable": {
        "description": "Player is controllable from this adapter",
        "role": "value",
        "type": "boolean"
    },
    "playing.player.details": {
        "description": "Details from and for Player",
        "type": "channel"
    },
    "playing.player.details.duration": {
        "description": "Duration of currently playing media",
        "role": "value",
        "type": "string"
    },
    "playing.player.details.location": {
        "description": "Current playback view",
        "role": "value",
        "type": "string"
    },
    "playing.player.details.music": {
        "description": "Details of currently playing music",
        "type": "object"
    },
    "playing.player.details.music.state": {
        "description": "Current music state",
        "role": "value",
        "type": "string"
    },
    "playing.player.details.photo": {
        "description": "Details of currently playing photo",
        "type": "channel"
    },
    "playing.player.details.photo.autoplay": {
        "description": "Photo autoplay",
        "role": "value",
        "type": "string"
    },
    "playing.player.details.photo.duration": {
        "description": "Photo duration",
        "role": "value",
        "type": "string"
    },
    "playing.player.details.photo.key": {
        "description": "Photo library key",
        "role": "value",
        "type": "string"
    },
    "playing.player.details.photo.playqueueid": {
        "description": "Photo play queue id",
        "role": "value",
        "type": "string"
    },
    "playing.player.details.photo.playqueueitemid": {
        "description": "Photo play queue item id",
        "role": "value",
        "type": "string"
    },
    "playing.player.details.photo.playqueueversion": {
        "description": "Photo play queue version",
        "role": "value",
        "type": "string"
    },
    "playing.player.details.photo.port": {
        "description": "Photo port",
        "role": "value",
        "type": "string"
    },
    "playing.player.details.photo.protocol": {
        "description": "",
        "role": "value",
        "type": "string"
    },
    "playing.player.details.photo.provideridentifier": {
        "description": "Photo provider identifier",
        "role": "value",
        "type": "string"
    },
    "playing.player.details.photo.ratingkey": {
        "description": "Photo rating key",
        "role": "value",
        "type": "string"
    },
    "playing.player.details.photo.repeat": {
        "description": "Photo repeat",
        "role": "value",
        "type": "string"
    },
    "playing.player.details.photo.seekrange": {
        "description": "Photo seekTo range ",
        "role": "value",
        "type": "string"
    },
    "playing.player.details.photo.shuffle": {
        "description": "Current photo shuffle state",
        "role": "value",
        "type": "string"
    },
    "playing.player.details.photo.state": {
        "description": "Current photo playing state",
        "role": "value",
        "type": "string"
    },
    "playing.player.details.photo.subtitleposition": {
        "description": "Position of subtitle",
        "role": "value",
        "type": "string"
    },
    "playing.player.details.photo.time": {
        "description": "View offset of media",
        "role": "value",
        "type": "string"
    },
    "playing.player.details.photo.volume": {
        "description": "volumen of photo stream :)",
        "role": "value",
        "type": "string"
    },
    "playing.player.details.state": {
        "description": "Current playback state",
        "role": "value",
        "type": "string"
    },
    "playing.player.details.time": {
        "description": "View offset of media",
        "role": "value",
        "type": "string"
    },
    "playing.player.details.type": {
        "description": "Currently playing media type",
        "role": "value",
        "type": "string"
    },
    "playing.player.details.url": {
        "description": "Currently active media url",
        "func": "convert-link-only",
        "role": "url",
        "type": "string"
    },
    "playing.player.details.video": {
        "description": "Details of currently playing video",
        "type": "channel"
    },
    "playing.player.details.video.audiostreamid": {
        "description": "audioStreamID",
        "role": "value",
        "type": "string"
    },
    "playing.player.details.video.autoplay": {
        "description": "Current video auto play state",
        "role": "value",
        "type": "string"
    },
    "playing.player.details.video.duration": {
        "description": "Current duration of video",
        "role": "value",
        "type": "string"
    },
    "playing.player.details.video.key": {
        "description": "Video library key",
        "role": "value",
        "type": "string"
    },
    "playing.player.details.video.playqueueid": {
        "description": "Video play queue id",
        "role": "value",
        "type": "string"
    },
    "playing.player.details.video.playqueueitemid": {
        "description": "Video play queue item id",
        "role": "value",
        "type": "string"
    },
    "playing.player.details.video.playqueueversion": {
        "description": "Video play queue version",
        "role": "value",
        "type": "string"
    },
    "playing.player.details.video.port": {
        "description": "Video port",
        "role": "value",
        "type": "string"
    },
    "playing.player.details.video.protocol": {
        "description": "Video protocol",
        "role": "value",
        "type": "string"
    },
    "playing.player.details.video.provideridentifier": {
        "description": "Video provider identifier",
        "role": "value",
        "type": "string"
    },
    "playing.player.details.video.ratingkey": {
        "description": "Video rating key",
        "role": "value",
        "type": "string"
    },
    "playing.player.details.video.repeat": {
        "description": "Current video repeat state",
        "role": "value",
        "type": "string"
    },
    "playing.player.details.video.seekrange": {
        "description": "Video seek Range (in milliseconds=",
        "role": "value",
        "type": "string"
    },
    "playing.player.details.video.shuffle": {
        "description": "Current video shuffle state",
        "role": "value",
        "type": "string"
    },
    "playing.player.details.video.state": {
        "description": "Video playing state",
        "role": "value",
        "type": "string"
    },
    "playing.player.details.video.subtitleposition": {
        "description": "Position of subtitle",
        "role": "value",
        "type": "string"
    },
    "playing.player.details.video.time": {
        "description": "View offset of media",
        "role": "value",
        "type": "string"
    },
    "playing.player.details.video.videostreamid": {
        "description": "videoStreamID",
        "role": "value",
        "type": "string"
    },
    "playing.player.details.video.volume": {
        "description": "volumen of video stream",
        "role": "value",
        "type": "string"
    },
    "playing.player.details.volume": {
        "description": "Current volumen of video",
        "role": "value",
        "type": "number"
    },
    "playing.player.deviceclass": {
        "description": "Device Class of Player",
        "role": "value",
        "type": "string"
    },
    "playing.player.host": {
        "description": "Player host name",
        "role": "value",
        "type": "string"
    },
    "playing.player.local": {
        "description": "Indication whether Player is local",
        "role": "indicator",
        "type": "boolean"
    },
    "playing.player.localaddress": {
        "description": "Local IP address",
        "role": "info.ip",
        "type": "string"
    },
    "playing.player.port": {
        "description": "Port of Plex Player",
        "role": "info.port",
        "type": "number"
    },
    "playing.player.product": {
        "description": "Product of Player",
        "role": "value",
        "type": "string"
    },
    "playing.player.protocol": {
        "description": "protocol",
        "role": "value",
        "type": "string"
    },
    "playing.player.protocolcapabilities": {
        "description": "Supported plex protocols of Player",
        "role": "value",
        "type": "string"
    },
    "playing.player.protocolversion": {
        "description": "Supported plex protocolversion of Player",
        "role": "value",
        "type": "string"
    },
    "playing.player.publicaddress": {
        "description": "Public IP address",
        "role": "info.ip",
        "type": "string"
    },
    "playing.player.title": {
        "description": "Name of Plex Player",
        "role": "text",
        "type": "string"
    },
    "playing.player.uuid": {
        "description": "ID of Plex Player",
        "role": "text",
        "type": "string"
    },
    "playing.player.version": {
        "description": "Player software version",
        "role": "value",
        "type": "string"
    },
    "playing.playing": {
        "description": "Current playing",
        "role": "indicator",
        "type": "boolean"
    },
    "playing.server": {
        "description": "playing Server",
        "type": "channel"
    },
    "playing.server.title": {
        "description": "Name of Plex Server",
        "role": "text",
        "type": "string"
    },
    "playing.server.uuid": {
        "description": "ID of Plex Server",
        "role": "text",
        "type": "string"
    },
    "playing.source": {
        "description": "Source of event (either plex or tautulli)",
        "role": "text",
        "type": "string"
    },
    "playing.timestamp": {
        "description": "Timestamp of the event being received",
        "role": "value",
        "type": "number"
    },
    "playing.user": {
        "description": "Indicator if webhook was set by Plex User",
        "role": "indicator",
        "type": "boolean"
    },
    "playlists": {
        "description": "Plex Playlists",
        "role": "channel"
    },
    "playlists.addedat": {
        "convert": {
            "func": "date-timestamp",
            "key": "date",
            "role": "text",
            "type": "string"
        },
        "description": "Timestamp of last watched time",
        "role": "value",
        "type": "number"
    },
    "playlists.addedatdate": {
        "convert": {
            "func": "date-timestamp",
            "key": "date",
            "role": "text",
            "type": "string"
        },
        "description": "Date of add media to database",
        "role": "value",
        "type": "string"
    },
    "playlists.composite": {
        "convert": {
            "func": "create-link",
            "key": "_link",
            "role": "media.cover",
            "type": "string"
        },
        "description": "Artwork of the Playlist",
        "role": "text",
        "type": "string"
    },
    "playlists.composite_link": {
        "convert": {
            "func": "create-link",
            "key": "_link",
            "role": "media.cover",
            "type": "string"
        },
        "description": "Artwork of the Playlist",
        "role": "media.cover",
        "type": "string"
    },
    "playlists.duration": {
        "convert": {
            "func": "ms-min"
        },
        "description": "Total duration (in minutes) for the Playlist",
        "role": "value",
        "type": "number"
    },
    "playlists.guid": {
        "description": "ID of the Playlist",
        "role": "text",
        "type": "string"
    },
    "playlists.items": {
        "description": "List of all items in the Playlist",
        "role": "json"
    },
    "playlists.itemscount": {
        "description": "Number of items in the Playlist",
        "role": "value",
        "type": "number"
    },
    "playlists.key": {
        "description": "Path to items of the Playlist",
        "role": "text",
        "type": "string"
    },
    "playlists.lastviewedat": {
        "convert": {
            "func": "date-timestamp",
            "key": "date",
            "role": "text",
            "type": "string"
        },
        "description": "Timestamp of last watched time",
        "role": "value",
        "type": "number"
    },
    "playlists.lastviewedatdate": {
        "convert": {
            "func": "date-timestamp",
            "key": "date",
            "role": "text",
            "type": "string"
        },
        "description": "add media at date",
        "role": "value",
        "type": "string"
    },
    "playlists.leafcount": {
        "description": "Number unknown",
        "role": "value",
        "type": "number"
    },
    "playlists.playlisttype": {
        "description": "Media Type of the Playlist",
        "role": "text",
        "type": "string"
    },
    "playlists.ratingkey": {
        "description": "Key of the Playlist",
        "role": "value",
        "type": "string"
    },
    "playlists.smart": {
        "description": "Indicator whether Playlist is smart",
        "role": "indicator",
        "type": "boolean"
    },
    "playlists.summary": {
        "description": "Summary of the Playlist",
        "role": "text",
        "type": "string"
    },
    "playlists.title": {
        "description": "Name of the Playlist",
        "role": "text",
        "type": "string"
    },
    "playlists.type": {
        "description": "Type of the Playlist",
        "role": "text",
        "type": "string"
    },
    "playlists.updatedat": {
        "convert": {
            "func": "date-timestamp",
            "key": "date",
            "role": "text",
            "type": "string"
        },
        "description": "Timestamp of last watched time",
        "role": "value",
        "type": "number"
    },
    "playlists.updatedatdate": {
        "convert": {
            "func": "date-timestamp",
            "key": "date",
            "role": "text",
            "type": "string"
        },
        "description": "Date of last viewed time",
        "role": "value",
        "type": "string"
    },
    "playlists.viewcount": {
        "description": "Number Playlist has been watched",
        "role": "value",
        "type": "number"
    },
    "server": {
        "description": "Plex Server %server%",
        "role": "channel"
    },
    "servers": {
        "description": "Plex Servers",
        "role": "channel"
    },
    "servers.address": {
        "description": "Server Address",
        "role": "text",
        "type": "string"
    },
    "servers.host": {
        "description": "Server Host",
        "role": "text",
        "type": "string"
    },
    "servers.machineidentifier": {
        "description": "Server Identifier",
        "role": "text",
        "type": "string"
    },
    "servers.name": {
        "description": "Server Name",
        "role": "text",
        "type": "string"
    },
    "servers.port": {
        "description": "Server Port",
        "role": "value",
        "type": "number"
    },
    "servers.version": {
        "description": "Server Software Version",
        "role": "text",
        "type": "string"
    },
    "settings": {
        "description": "Plex Settings",
        "role": "channel"
    },
    "settings.transcoder.transcoderh264minimumcrf": {
        "description": "transcoderh264minimumcrf",
        "description": "Metadata Media",
        "role": "state",
        "type": "string",
        "type": "channel"
    },
    "statistics": {
        "description": "Plex Watch Statistics",
        "role": "channel"
    },
    "statistics.00-all_time": {
        "description": "Watched all time",
        "role": "channel"
    },
    "statistics.01-last_24h": {
        "description": "Watched last 24 hours",
        "role": "channel"
    },
    "statistics.02-last_7d": {
        "description": "Watched last 7 days",
        "role": "channel"
    },
    "statistics.03-last_30d": {
        "description": "Watched last 30 days",
        "role": "channel"
    },
    "statistics.libraries": {
        "description": "Library Watch Statistics %library%",
        "role": "channel"
    },
    "statistics.query_days": {
        "description": "Days querying",
        "role": "value",
        "type": "number"
    },
    "statistics.total_plays": {
        "description": "Total plays",
        "role": "value",
        "type": "number"
    },
    "statistics.total_time": {
        "description": "Total Time",
        "role": "value",
        "type": "number"
    },
    "statistics.users": {
        "description": "User Watch Statistics %user%",
        "role": "channel"
    },
    "user": {
        "description": "Plex User %user%",
        "role": "channel"
    },
    "users": {
        "description": "Plex Users",
        "role": "channel"
    },
    "users.allow_guest": {
        "description": "Allow Guest",
        "role": "indicator",
        "type": "boolean"
    },
    "users.do_notify": {
        "description": "Do Notify",
        "role": "indicator",
        "type": "boolean"
    },
    "users.email": {
        "description": "Email address",
        "role": "text",
        "type": "string"
    },
    "users.filter_all": {
        "description": "Filter All",
        "role": "text",
        "type": "string"
    },
    "users.filter_movies": {
        "description": "Filter Movies",
        "role": "text",
        "type": "string"
    },
    "users.filter_music": {
        "description": "Filter Music",
        "role": "text",
        "type": "string"
    },
    "users.filter_photos": {
        "description": "Filter Photos",
        "role": "text",
        "type": "string"
    },
    "users.filter_tv": {
        "description": "Filter TV",
        "role": "text",
        "type": "string"
    },
    "users.friendly_name": {
        "description": "Friendly Name",
        "role": "text",
        "type": "string"
    },
    "users.is_active": {
        "description": "is active",
        "role": "indicator",
        "type": "boolean"
    },
    "users.is_admin": {
        "description": "User is admin",
        "role": "indicator",
        "type": "boolean"
    },
    "users.is_allow_sync": {
        "description": "User may sync media",
        "role": "indicator",
        "type": "boolean"
    },
    "users.is_home_user": {
        "description": "User is Home User",
        "role": "indicator",
        "type": "boolean"
    },
    "users.is_restricted": {
        "description": "User is restricted",
        "role": "indicator",
        "type": "boolean"
    },
    "users.keep_history": {
        "description": "Keep History",
        "role": "indicator",
        "type": "boolean"
    },
    "users.row_id": {
        "description": "Row ID",
        "role": "value",
        "type": "number"
    },
    "users.shared_libraries": {
        "description": "Shared Libraries",
        "role": "text",
        "type": "array"
    },
    "users.thumb": {
        "description": "Thumbnail",
        "role": "text",
        "type": "string"
    },
    "users.user_id": {
        "description": "User ID",
        "role": "value",
        "type": "number"
    },
    "users.username": {
        "description": "Name of User",
        "role": "text",
        "type": "string"
    }
}