module.exports =
{
	"info.notifications": {"node": "info.notifications", "description": "Notification Configuration", "role": "json", "type": "string"},
	
	// EVENTS
	"events.id": {"description": "Generated unique ID", "role": "text", "type": "string"},
	"events.media": {"description": "Media type of last event (movie, show, track, etc.)", "role": "text", "type": "string"},
	"events.history": {"description": "All events historicized", "role": "json", "type": "string"},
	"events.event": {"description": "Last event triggered on Plex", "role": "text", "type": "string"},
	"events.message": {"description": "Message of last event", "role": "text", "type": "string"},
	"events.caption": {"description": "Caption of last event", "role": "text", "type": "string"},
	"events.source": {"description": "Last source an event was received from", "role": "text", "type": "string"},
	"events.datetime": {"description": "DateTime of the event being received", "role": "text", "type": "string"},
	"events.source": {"description": "Source of event (either plex or tautulli)", "role": "text", "type": "string"},
	"events.timestamp": {"description": "Timestamp of the event being received", "role": "value", "type": "number"},
	"events.account": {"description": "Name of Plex User", "role": "text", "type": "string"},
	"events.player": {"description": "Name of Plex Player", "role": "text", "type": "string"},
	"events.thumb": {"description": "Address of server ", "role": "text", "type": "string"},
	
	// PLAYING
	"playing.account": {"description": "Viewing account", "role": "value", "type": "string"},
	"playing.event": {"description": "Event triggered on Plex", "role": "text", "type": "string"},
	"playing.owner": {"description": "Indicator if webhook was set by Plex Owner", "role": "indicator", "type": "boolean"},
	"playing.user": {"description": "Indicator if webhook was set by Plex User", "role": "indicator", "type": "boolean"},
	"playing.datetime": {"description": "DateTime of the event being received", "role": "text", "type": "string"},
	"playing.source": {"description": "Source of event (either plex or tautulli)", "role": "text", "type": "string"},
	"playing.timestamp": {"description": "Timestamp of the event being received", "role": "value", "type": "number"},
	"playing.player": {"description": "Viewing device", "role": "value", "type": "string"},
	"playing.playing": {"description": "Current playing", "role": "value", "type": "boolean"},
	//"playing.server": {"description": "Timestamp of the event being received", "role": "value", "type": "number"},
	"playing.media": {"description": "media type", "role": "value", "type": "string"},
	
	// PLAYING - ACCOUNT
	"playing.account.id": {"description": "Plex ID of Plex User", "role": "value", "type": "number"},
	"playing.account.thumb": {"description": "Avatar of Plex User", "role": "text", "type": "string"},
	"playing.account.title": {"description": "Name of Plex User", "role": "text", "type": "string"},
	"playing.account.userid": {"description": "ID of Plex User", "role": "value", "type": "number"},
	
	// PLAYING - PLAYER
	"playing.player.local": {"description": "Indication whether Player is local", "role": "indicator", "type": "boolean"},
	"playing.player.port": {"description": "Port of Plex Player", "role": "info.port", "type": "string"},
	"playing.player.localaddress": {"description": "Local IP address", "role": "info.ip", "type": "string"},
	"playing.player.publicaddress": {"description": "Public IP address", "role": "info.ip", "type": "string"},
	"playing.player.title": {"description": "Name of Plex Player", "role": "text", "type": "string"},
	"playing.player.uuid": {"description": "ID of Plex Player", "role": "text", "type": "string"},
	
	// PLAYING - SERVER
	"playing.server.title": {"description": "Name of Plex Server", "role": "text", "type": "string"},
	"playing.server.uuid": {"description": "ID of Plex Server", "role": "text", "type": "string"},
	
	// PLAYING - METADATA (SERIES)
	"playing.metadata.grandparentart": {"description": "", "role": "text", "type": "string"},
	"playing.metadata.grandparentguid": {"description": "", "role": "text", "type": "string"},
	"playing.metadata.grandparentkey": {"description": "", "role": "text", "type": "string"},
	"playing.metadata.grandparentratingkey": {"description": "", "role": "value", "type": "string"},
	"playing.metadata.grandparenttheme": {"description": "", "role": "text", "type": "string"},
	"playing.metadata.grandparentthumb": {"description": "", "role": "text", "type": "string"},
	"playing.metadata.grandparenttitle": {"description": "Parent title (e.g of show or artist)", "role": "media.season", "type": "string"},
	"playing.metadata.index": {"description": "", "role": "value", "type": "number"},
	"playing.metadata.parentguid": {"description": "Parent guid (e.g of season or album)", "role": "text", "type": "string"},
	"playing.metadata.parentindex": {"description": "Parent index (e.g of season or album)", "role": "value", "type": "number"},
	"playing.metadata.parentkey": {"description": "Parent key (e.g of season or album)", "role": "text", "type": "string"},
	"playing.metadata.parentratingkey": {"description": "Parent rating key (e.g of season or album)", "role": "value", "type": "string"},
	"playing.metadata.parentthumb": {"description": "Parent thumb (e.g of season or album)", "role": "text", "type": "string"},
	"playing.metadata.parenttitle": {"description": "Parent title (e.g of season or album)", "role": "media.album", "type": "string"},
	"playing.metadata.ratingimage": {"description": "", "role": "text", "type": "string"},
	"playing.metadata.viewcount": {"description": "Number item has been watched", "role": "value", "type": "number"},
	"playing.metadata.viewoffset": {"description": "", "role": "value", "type": "string"},
	"playing.metadata.userRating": {"description": "User Rating", "role": "value", "type": "number"},
	"playing.metadata.originalTitle": {"description": "Original Title", "role": "media.episode", "type": "string"},
	"playing.metadata.subtype": {"description": "Media subtype (e.g. trailer)", "role": "text", "type": "string"},
	
	// PLAYING - METADATA (ALL)
	"playing.metadata.audiencerating": {"description": "Rating", "role": "value", "type": "number"},
	"playing.metadata.audienceratingimage": {"description": "Rating image", "role": "value", "type": "string"},
	"playing.metadata.lastviewedat": {"description": "Timestamp of last watched time", "role": "value", "type": "number", "convert": "date-timestamp"},
	"playing.metadata.updatedat": {"description": "Timestamp of last updated time", "role": "value", "type": "number", "convert": "date-timestamp"},
	"playing.metadata.addedat": {"description": "Timestamp of add media to database", "role": "value", "type": "number", "convert": "date-timestamp"},
	"playing.metadata.addedatdate": {"description": "Date of add media to database", "role": "value", "type": "string", "convert": "date-timestamp"},
	"playing.metadata.lastviewedatdate": {"description": "add media at date", "role": "value", "type": "string", "convert": "date-timestamp"},
	"playing.metadata.updatedatdate": {"description": "Date of last viewed time", "role": "value", "type": "string", "convert": "date-timestamp"},
	"playing.metadata.originallyavailableat": {"description": "Timestamp of last watched time", "role": "text", "type": "string"},
	"playing.metadata.duration": {"description": "The duration (in minutes) for the item", "role": "value", "type": "number", "convert": "ms-min"},
	"playing.metadata.art": {"description": "The artwork of the item", "role": "media.cover", "type": "string"},
	"playing.metadata.chaptersource": {"description": "Source for chapter sections", "role": "text", "type": "string"},
	"playing.metadata.collection": {"description": "Collections as a list", "role": "text", "type": "string"},
	"playing.metadata.contentrating": {"description": "The content rating for the item. (e.g. TV-MA, TV-PG, etc.)", "role": "text", "type": "string"},
	"playing.metadata.country": {"description": "Countries as a list", "role": "text", "type": "string"},
	"playing.metadata.director": {"description": "Directors as a list", "role": "text", "type": "string"},
	"playing.metadata.field": {"description": "Fields as a list", "role": "text", "type": "string"},
	"playing.metadata.genre": {"description": "Genres as a list", "role": "text", "type": "string"},
	"playing.metadata.guid": {"description": "IMDb ID of the item", "role": "text", "type": "string"},
	"playing.metadata.key": {"description": "Key of the item", "role": "text", "type": "string"},
	"playing.metadata.librarysectionid": {"description": "The library ID of the item", "role": "value", "type": "number"},
	"playing.metadata.librarysectionkey": {"description": "The library key of the item", "role": "text", "type": "string"},
	"playing.metadata.librarysectiontitle": {"description": "The library name of the item", "role": "text", "type": "string"},
	"playing.metadata.librarysectiontype": {"description": "The library type of the item", "role": "text", "type": "string"},
	"playing.metadata.primaryextrakey": {"description": "Key (#2) of the item", "role": "text", "type": "string"},
	"playing.metadata.producer": {"description": "Producers as a list", "role": "text", "type": "string"},
	"playing.metadata.rating": {"description": "The rating (out of 10) for the item", "role": "text", "type": "string"},
	"playing.metadata.ratingimage": {"description": "", "role": "text", "type": "string"},
	"playing.metadata.ratingkey": {"description": "The unique identifier for the movie, episode, or track.", "role": "value", "type": "string"},
	"playing.metadata.role": {"description": "Roles as a list", "role": "text", "type": "string"},
	"playing.metadata.similar": {"description": "Similar as a list", "role": "text", "type": "string"},
	"playing.metadata.studio": {"description": "The studio for the item", "role": "text", "type": "string"},
	"playing.metadata.summary": {"description": "A short plot summary for the item", "role": "text", "type": "string"},
	"playing.metadata.tagline": {"description": "A tagline for the media item", "role": "text", "type": "string"},
	"playing.metadata.thumb": {"description": "The thumbnail of the item", "role": "text", "type": "string"},
	"playing.metadata.title": {"description": "The full title of the item", "role": "media.title", "type": "string"},
	"playing.metadata.titlesort": {"description": "The sorting title of the item", "role": "text", "type": "string"},
	"playing.metadata.viewoffset": {"description": "", "role": "value", "type": "number"},
	"playing.metadata.type": {"description": "The type of media. (movie, show, season, episode, artist, album, track, clip)", "role": "text", "type": "string"},
	"playing.metadata.writer": {"description": "Writers as a list", "role": "text", "type": "string"},
	"playing.metadata.year": {"description": "The release year for the item", "role": "text", "type": "number"},
	"playing.metadata.audio.audio_bitrate": {"description": "The audio bitrate of the original media.", "role": "text", "type": "string"},
	"playing.metadata.audio.audio_bitrate_mode": {"description": "The audio bitrate mode of the original media. (cbr or vbr)", "role": "text", "type": "string"},
	"playing.metadata.audio.audio_channel_layout": {"description": "The audio channel layout of the original media.", "role": "text", "type": "string"},
	"playing.metadata.audio.audio_channels": {"description": "The audio channels of the original media.", "role": "text", "type": "string"},
	"playing.metadata.audio.audio_codec": {"description": "The audio codec of the original media.", "role": "text", "type": "string"},
	"playing.metadata.audio.audio_language": {"description": "The audio language of the original media.", "role": "text", "type": "string"},
	"playing.metadata.audio.audio_language_code": {"description": "The audio language code of the original media.", "role": "text", "type": "string"},
	"playing.metadata.audio.audio_sample_rate": {"description": "The audio sample rate (in Hz) of the original media.", "role": "text", "type": "string"},
	"playing.metadata.collectiontree.count": {"description": "Number of items within Plex in that category", "role": "value", "type": "number"},
	"playing.metadata.collectiontree.filter": {"description": "Filter to select this specific category", "role": "text", "type": "string"},
	"playing.metadata.collectiontree.id": {"description": "ID of this category", "role": "value", "type": "number"},
	"playing.metadata.collectiontree.tag": {"description": "Tag / Name of this category", "role": "text", "type": "string"},
	"playing.metadata.countrytree.count": {"description": "Number of items within Plex in that category", "role": "value", "type": "number"},
	"playing.metadata.countrytree.filter": {"description": "Filter to select this specific category", "role": "text", "type": "string"},
	"playing.metadata.countrytree.id": {"description": "ID of this category", "role": "value", "type": "number"},
	"playing.metadata.countrytree.tag": {"description": "Tag / Name of this category", "role": "text", "type": "string"},
	"playing.metadata.directortree.count": {"description": "Number of items within Plex in that category", "role": "value", "type": "number"},
	"playing.metadata.directortree.filter": {"description": "Filter to select this specific category", "role": "text", "type": "string"},
	"playing.metadata.directortree.id": {"description": "ID of this category", "role": "value", "type": "number"},
	"playing.metadata.directortree.tag": {"description": "Tag / Name of this category", "role": "text", "type": "string"},
	"playing.metadata.fieldtree.locked": {"description": "(unknown)", "role": "indicator", "type": "boolean"},
	"playing.metadata.fieldtree.name": {"description": "Name", "role": "text", "type": "string"},
	"playing.metadata.file.name": {"description": "The file name of the item", "role": "text", "type": "string"},
	"playing.metadata.file.path": {"description": "The file path to the item", "role": "text", "type": "string"},
	"playing.metadata.file.size": {"description": "The file size of the item", "role": "text", "type": "string"},
	"playing.metadata.genretree.count": {"description": "Number of items within Plex in that category", "role": "value", "type": "number"},
	"playing.metadata.genretree.filter": {"description": "Filter to select this specific category", "role": "text", "type": "string"},
	"playing.metadata.genretree.id": {"description": "ID of this category", "role": "value", "type": "number"},
	"playing.metadata.genretree.tag": {"description": "Tag / Name of this category", "role": "text", "type": "string"},
	"playing.metadata.producertree.count": {"description": "Number of items within Plex in that category", "role": "value", "type": "number"},
	"playing.metadata.producertree.filter": {"description": "Filter to select this specific category", "role": "text", "type": "string"},
	"playing.metadata.producertree.id": {"description": "ID of this category", "role": "value", "type": "number"},
	"playing.metadata.producertree.tag": {"description": "Tag / Name of this category", "role": "text", "type": "string"},
	"playing.metadata.roletree.count": {"description": "Number of items within Plex in that category", "role": "value", "type": "number"},
	"playing.metadata.roletree.filter": {"description": "Filter to select this specific category", "role": "text", "type": "string"},
	"playing.metadata.roletree.id": {"description": "ID of this category", "role": "value", "type": "number"},
	"playing.metadata.roletree.role": {"description": "Name of role", "role": "text", "type": "string"},
	"playing.metadata.roletree.tag": {"description": "Name of the actor", "role": "text", "type": "string"},
	"playing.metadata.roletree.thumb": {"description": "Thumbnail of the actor", "role": "text", "type": "string"},
	"playing.metadata.similartree.count": {"description": "Number of items within Plex in that category", "role": "value", "type": "number"},
	"playing.metadata.similartree.filter": {"description": "Filter to select this specific category", "role": "text", "type": "string"},
	"playing.metadata.similartree.id": {"description": "ID of this category", "role": "value", "type": "number"},
	"playing.metadata.similartree.tag": {"description": "Tag / Name of this category", "role": "text", "type": "string"},
	"playing.metadata.stream.user.streams": {"description": "The number of concurrent streams.", "role": "text", "type": "string"},
	"playing.metadata.stream.user.user_streams": {"description": "The number of concurrent streams by the person streaming.", "role": "text", "type": "string"},
	"playing.metadata.stream.user.name": {"description": "The friendly name of the person streaming.", "role": "text", "type": "string"},
	"playing.metadata.stream.user.user": {"description": "The username of the person streaming.", "role": "text", "type": "string"},
	"playing.metadata.stream.user.email": {"description": "The email address of the person streaming.", "role": "text", "type": "string"},
	"playing.metadata.stream.player.device": {"description": "The type of client device being used for playback.", "role": "text", "type": "string"},
	"playing.metadata.stream.player.platform": {"description": "The type of client platform being used for playback.", "role": "text", "type": "string"},
	"playing.metadata.stream.player.product": {"description": "The type of client product being used for playback.", "role": "text", "type": "string"},
	"playing.metadata.stream.player.player": {"description": "The name of the player being used for playback.", "role": "text", "type": "string"},
	"playing.metadata.stream.player.ip_address": {"description": "The IP address of the device being used for playback.", "role": "text", "type": "string"},
	"playing.metadata.stream.quality_profile": {"description": "The Plex quality profile of the stream. (e.g. Original, 4 Mbps 720p, etc.)", "role": "text", "type": "string"},
	"playing.metadata.stream.optimized_version": {"description": "If the stream is an optimized version. (0 or 1)", "role": "text", "type": "string"},
	"playing.metadata.stream.optimized_version_profile": {"description": "The optimized version profile of the stream.", "role": "text", "type": "string"},
	"playing.metadata.stream.synced_version": {"description": "If the stream is an synced version. (0 or 1)", "role": "text", "type": "string"},
	"playing.metadata.stream.live": {"description": "If the stream is live TV. (0 or 1)", "role": "text", "type": "string"},
	"playing.metadata.stream.stream_local": {"description": "If the stream is local. (0 or 1)", "role": "text", "type": "string"},
	"playing.metadata.stream.stream_location": {"description": "The network location of the stream. (lan or wan)", "role": "text", "type": "string"},
	"playing.metadata.stream.stream_bandwidth": {"description": "The required bandwidth (in kbps) of the stream. (not the used bandwidth)", "role": "text", "type": "string"},
	"playing.metadata.stream.stream_container": {"description": "The media container of the stream.", "role": "text", "type": "string"},
	"playing.metadata.stream.stream_bitrate": {"description": "The bitrate (in kbps) of the stream.", "role": "text", "type": "string"},
	"playing.metadata.stream.stream_aspect_ratio": {"description": "The aspect ratio of the stream.", "role": "text", "type": "string"},
	"playing.metadata.stream.stream_video_codec": {"description": "The video codec of the stream.", "role": "text", "type": "string"},
	"playing.metadata.stream.stream_video_codec_level": {"description": "The video codec level of the stream.", "role": "text", "type": "string"},
	"playing.metadata.stream.stream_video_bitrate": {"description": "The video bitrate (in kbps) of the stream.", "role": "text", "type": "string"},
	"playing.metadata.stream.stream_video_bit_depth": {"description": "The video bit depth of the stream.", "role": "text", "type": "string"},
	"playing.metadata.stream.stream_video_framerate": {"description": "The video framerate of the stream.", "role": "text", "type": "string"},
	"playing.metadata.stream.stream_video_ref_frames": {"description": "The video reference frames of the stream.", "role": "text", "type": "string"},
	"playing.metadata.stream.stream_video_resolution": {"description": "The video resolution of the stream.", "role": "text", "type": "string"},
	"playing.metadata.stream.stream_video_height": {"description": "The video height of the stream.", "role": "text", "type": "string"},
	"playing.metadata.stream.stream_video_width": {"description": "The video width of the stream.", "role": "text", "type": "string"},
	"playing.metadata.stream.stream_video_language": {"description": "The video language of the stream.", "role": "text", "type": "string"},
	"playing.metadata.stream.stream_video_language_code": {"description": "The video language code of the stream.", "role": "text", "type": "string"},
	"playing.metadata.stream.stream_audio_bitrate": {"description": "The audio bitrate of the stream.", "role": "text", "type": "string"},
	"playing.metadata.stream.stream_audio_bitrate_mode": {"description": "The audio bitrate mode of the stream. (cbr or vbr)", "role": "text", "type": "string"},
	"playing.metadata.stream.stream_audio_codec": {"description": "The audio codec of the stream.", "role": "text", "type": "string"},
	"playing.metadata.stream.stream_audio_channels": {"description": "The audio channels of the stream.", "role": "text", "type": "string"},
	"playing.metadata.stream.stream_audio_channel_layout": {"description": "The audio channel layout of the stream.", "role": "text", "type": "string"},
	"playing.metadata.stream.stream_audio_sample_rate": {"description": "The audio sample rate (in Hz) of the stream.", "role": "text", "type": "string"},
	"playing.metadata.stream.stream_audio_language": {"description": "The audio language of the stream.", "role": "text", "type": "string"},
	"playing.metadata.stream.stream_audio_language_code": {"description": "The audio language code of the stream.", "role": "text", "type": "string"},
	"playing.metadata.stream.stream_subtitle_codec": {"description": "The subtitle codec of the stream.", "role": "text", "type": "string"},
	"playing.metadata.stream.stream_subtitle_container": {"description": "The subtitle container of the stream.", "role": "text", "type": "string"},
	"playing.metadata.stream.stream_subtitle_format": {"description": "The subtitle format of the stream.", "role": "text", "type": "string"},
	"playing.metadata.stream.stream_subtitle_forced": {"description": "If the subtitles are forced. (0 or 1)", "role": "text", "type": "string"},
	"playing.metadata.stream.stream_subtitle_language": {"description": "The subtitle language of the stream.", "role": "text", "type": "string"},
	"playing.metadata.stream.stream_subtitle_language_code": {"description": "The subtitle language code of the stream.", "role": "text", "type": "string"},
	"playing.metadata.stream.stream_subtitle_location": {"description": "The subtitle location of the stream.", "role": "text", "type": "string"},
	"playing.metadata.subtitles.subtitle_codec": {"description": "The subtitle codec of the original media.", "role": "text", "type": "string"},
	"playing.metadata.subtitles.subtitle_container": {"description": "The subtitle container of the original media.", "role": "text", "type": "string"},
	"playing.metadata.subtitles.subtitle_forced": {"description": "If the subtitles are forced. (0 or 1)", "role": "text", "type": "string"},
	"playing.metadata.subtitles.subtitle_format": {"description": "The subtitle format of the original media.", "role": "text", "type": "string"},
	"playing.metadata.subtitles.subtitle_language": {"description": "The subtitle language of the original media.", "role": "text", "type": "string"},
	"playing.metadata.subtitles.subtitle_language_code": {"description": "The subtitle language code of the original media.", "role": "text", "type": "string"},
	"playing.metadata.subtitles.subtitle_location": {"description": "The subtitle location of the original media.", "role": "text", "type": "string"},
	"playing.metadata.transcoding.transcode_decision": {"description": "The transcode decisions of the stream.", "role": "text", "type": "string"},
	"playing.metadata.transcoding.video_decision": {"description": "The video transcode decisions of the stream.", "role": "text", "type": "string"},
	"playing.metadata.transcoding.audio_decision": {"description": "The audio transcode decisions of the stream.", "role": "text", "type": "string"},
	"playing.metadata.transcoding.subtitle_decision": {"description": "The subtitle transcode decisions of the stream.", "role": "text", "type": "string"},
	"playing.metadata.transcoding.transcode_container": {"description": "The media container of the transcoded stream.", "role": "text", "type": "string"},
	"playing.metadata.transcoding.transcode_video_codec": {"description": "The video codec of the transcoded stream.", "role": "text", "type": "string"},
	"playing.metadata.transcoding.transcode_video_width": {"description": "The video width of the transcoded stream.", "role": "text", "type": "string"},
	"playing.metadata.transcoding.transcode_video_height": {"description": "The video height of the transcoded stream.", "role": "text", "type": "string"},
	"playing.metadata.transcoding.transcode_audio_codec": {"description": "The audio codec of the transcoded stream.", "role": "text", "type": "string"},
	"playing.metadata.transcoding.transcode_audio_channels": {"description": "The audio channels of the transcoded stream.", "role": "text", "type": "string"},
	"playing.metadata.transcoding.transcode_hw_requested": {"description": "If hardware decoding/encoding was requested. (0 or 1)", "role": "text", "type": "string"},
	"playing.metadata.transcoding.transcode_hw_decoding": {"description": "If hardware decoding is used. (0 or 1)", "role": "text", "type": "string"},
	"playing.metadata.transcoding.transcode_hw_decode": {"description": "The hardware decoding codec.", "role": "text", "type": "string"},
	"playing.metadata.transcoding.transcode_hw_decode_title": {"description": "The hardware decoding codec title.", "role": "text", "type": "string"},
	"playing.metadata.transcoding.transcode_hw_encoding": {"description": "If hardware encoding is used. (0 or 1)", "role": "text", "type": "string"},
	"playing.metadata.transcoding.transcode_hw_encode": {"description": "The hardware encoding codec.", "role": "text", "type": "string"},
	"playing.metadata.transcoding.transcode_hw_encode_title": {"description": "The hardware encoding codec title.", "role": "text", "type": "string"},
	"playing.metadata.video.aspect_ratio": {"description": "The aspect ratio of the original media.", "role": "text", "type": "string"},
	"playing.metadata.video.bitrate": {"description": "The bitrate of the original media.", "role": "text", "type": "string"},
	"playing.metadata.video.container": {"description": "The media container of the original media.", "role": "text", "type": "string"},
	"playing.metadata.video.video_bit_depth": {"description": "The video bit depth of the original media.", "role": "text", "type": "string"},
	"playing.metadata.video.video_bitrate": {"description": "The video bitrate of the original media.", "role": "text", "type": "string"},
	"playing.metadata.video.video_codec": {"description": "The video codec of the original media.", "role": "text", "type": "string"},
	"playing.metadata.video.video_codec_level": {"description": "The video codec level of the original media.", "role": "text", "type": "string"},
	"playing.metadata.video.video_framerate": {"description": "The video framerate of the original media.", "role": "text", "type": "string"},
	"playing.metadata.video.video_height": {"description": "The video height of the original media.", "role": "text", "type": "string"},
	"playing.metadata.video.video_language": {"description": "The video language of the original media.", "role": "text", "type": "string"},
	"playing.metadata.video.video_language_code": {"description": "The video language code of the original media.", "role": "text", "type": "string"},
	"playing.metadata.video.video_ref_frames": {"description": "The video reference frames of the original media.", "role": "text", "type": "string"},
	"playing.metadata.video.video_resolution": {"description": "The video resolution of the original media.", "role": "text", "type": "string"},
	"playing.metadata.video.video_width": {"description": "The video width of the original media.", "role": "text", "type": "string"},
	"playing.metadata.writertree.count": {"description": "Number of items within Plex in that category", "role": "value", "type": "number"},
	"playing.metadata.writertree.filter": {"description": "Filter to select this specific category", "role": "text", "type": "string"},
	"playing.metadata.writertree.id": {"description": "ID of this category", "role": "value", "type": "number"},
	"playing.metadata.writertree.tag": {"description": "Tag / Name of this category", "role": "text", "type": "string"},
	
	// PLAYLISTS
	"playlists": {"description": "Plex Playlists", "role": "channel"},
	"playlists.lastviewedat": {"description": "Timestamp of last watched time", "role": "value", "type": "number", "convert": "date-timestamp"},
	"playlists.updatedat": {"description": "Timestamp of last watched time", "role": "value", "type": "number", "convert": "date-timestamp"},
	"playlists.addedat": {"description": "Timestamp of last watched time", "role": "value", "type": "number", "convert": "date-timestamp"},
	"playlists.addedatdate": {"description": "Date of add media to database", "role": "value", "type": "string", "convert": "date-timestamp"},
	"playlists.lastviewedatdate": {"description": "add media at date", "role": "value", "type": "string", "convert": "date-timestamp"},
	"playlists.updatedatdate": {"description": "Date of last viewed time", "role": "value", "type": "string", "convert": "date-timestamp"},
	"playlists.leafcount": {"description": "Number unknown", "role": "value", "type": "number"},
	"playlists.viewcount": {"description": "Number Playlist has been watched", "role": "value", "type": "number"},
	"playlists.composite": {"description": "Artwork of the Playlist", "role": "text", "type": "string"},
	"playlists.playlisttype": {"description": "Media Type of the Playlist", "role": "text", "type": "string"},
	"playlists.smart": {"description": "Indicator whether Playlist is smart", "role": "indicator", "type": "boolean"},
	"playlists.summary": {"description": "Summary of the Playlist", "role": "text", "type": "string"},
	"playlists.title": {"description": "Name of the Playlist", "role": "text", "type": "string"},
	"playlists.type": {"description": "Type of the Playlist", "role": "text", "type": "string"},
	"playlists.guid": {"description": "ID of the Playlist", "role": "text", "type": "string"},
	"playlists.key": {"description": "Path to items of the Playlist", "role": "text", "type": "string"},
	"playlists.ratingkey": {"description": "Key of the Playlist", "role": "value", "type": "string"},
	"playlists.duration": {"description": "Total duration (in minutes) for the Playlist", "role": "value", "type": "number", "convert": "ms-min"},
	"playlists.items": {"description": "List of all items in the Playlist", "role": "json"},
	"playlists.itemscount": {"description": "Number of items in the Playlist", "role": "value", "type": "number"},
	
	// LIBRARY
	"library": {"description": "Plex Library %library%", "role": "channel"}, 
	"libraries": {"description": "Plex Libraries", "role": "channel"},
	"libraries.location": {"description": "Storage Locations", "role": "json", "type": "string"},
	"libraries.agent": {"description": "Agent", "role": "text", "type": "string"},
	"libraries.art": {"description": "Picture path", "role": "text", "type": "string"},
	"libraries.allowsync": {"description": "Allow Sync", "role": "indicator", "type": "boolean"},
	"libraries.composite": {"description": "Composite", "role": "text", "type": "string"},
	"libraries.content": {"description": "has content", "role": "indicator", "type": "boolean"},
	"libraries.createdat": {"description": "Timestamp of library creation", "role": "value", "type": "number"},
	"libraries.contentchangedat": {"description": "The date and time when the library content was last changed", "role": "value", "type": "number"},
	"libraries.directory": {"description": "no clue", "role": "indicator", "type": "boolean"},
	"libraries.filters": {"description": "Indicator if filter is applied", "role": "indicator", "type": "boolean"},
	"libraries.hidden": {"description": "no clue", "role": "value", "type":"number"},
	"libraries.items": {"description": "List of all items in the library", "role": "json"},
	"libraries.itemscount": {"description": "Number of items in the library", "role": "value", "type": "number"},
	"libraries.key": {"description": "ID of library", "role": "text", "type": "string"},
	"libraries.language": {"description": "Language", "role": "text", "type": "string"},
	"libraries.refreshing": {"description": "Indicator if currently refreshing", "role": "indicator", "type": "boolean"},
	"libraries.scannedat": {"description": "Timestamp of last scan", "role": "value", "type": "number"},
	"libraries.scanner": {"description": "Used scanner for media", "role": "text", "type": "string"},
	"libraries.thumb": {"description": "Thumbnail of the Library", "role": "text", "type": "string"},
	"libraries.title": {"description": "Name of the Library", "role": "text", "type": "string"},
	"libraries.type": {"description": "Type of Library", "role": "text", "type": "string"},
	"libraries.updatedat": {"description": "Timestamp of last update", "role": "value", "type": "number"},
	"libraries.uuid": {"description": "Unique ID", "role": "text", "type": "string"},
	
	// SERVER
	"server": {"description": "Plex Server %server%", "role": "channel"},
	"servers": {"description": "Plex Servers", "role": "channel"},
	"servers.address": {"description": "Server Address", "role": "text", "type": "string"},
	"servers.host": {"description": "Server Host", "role": "text", "type": "string"},
	"servers.machineidentifier": {"description": "Server Identifier", "role": "text", "type": "string"},
	"servers.name": {"description": "Server Name", "role": "text", "type": "string"},
	"servers.port": {"description": "Server Port", "role": "value", "type": "number"},
	"servers.version": {"description": "Server Software Version", "role": "text", "type": "string"},
	
	// STATISTICS
	"statistics": {"description": "Plex Watch Statistics", "role": "channel"},
	"statistics.libraries": {"description": "Library Watch Statistics %library%", "role": "channel"},
	"statistics.users": {"description": "User Watch Statistics %user%", "role": "channel"},
	"statistics.01-last_24h": {"description": "Watched last 24 hours", "role": "channel"},
	"statistics.02-last_7d": {"description": "Watched last 7 days", "role": "channel"},
	"statistics.03-last_30d": {"description": "Watched last 30 days", "role": "channel"},
	"statistics.00-all_time": {"description": "Watched all time", "role": "channel"},
	"statistics.query_days": {"description": "Days querying", "role": "value", "type": "number"},
	"statistics.total_plays": {"description": "Total plays", "role": "value", "type": "number"},
	"statistics.total_time": {"description": "Total Time", "role": "value", "type": "number"},
	
	// USERS
	"user": {"description": "Plex User %user%", "role": "channel"},
	"users": {"description": "Plex Users", "role": "channel"},
	"users.allow_guest": {"description": "Allow Guest", "role": "indicator", "type": "number"},
	"users.do_notify": {"description": "Do Notify", "role": "indicator", "type": "number"},
	"users.email": {"description": "Email address", "role": "text", "type": "string"},
	"users.filter_all": {"description": "Filter All", "role": "text", "type": "string"},
	"users.filter_movies": {"description": "Filter Movies", "role": "text", "type": "string"},
	"users.filter_music": {"description": "Filter Music", "role": "text", "type": "string"},
	"users.filter_photos": {"description": "Filter Photos", "role": "text", "type": "string"},
	"users.filter_tv": {"description": "Filter TV", "role": "text", "type": "string"},
	"users.friendly_name": {"description": "Friendly Name", "role": "text", "type": "string"},
	"users.is_admin": {"description": "User is admin", "role": "indicator", "type": "number"},
	"users.is_active": {"description": "is active", "role": "indicator", "type": "number"},
	"users.is_allow_sync": {"description": "User may sync media", "role": "indicator", "type": "number"},
	"users.is_home_user": {"description": "User is Home User", "role": "indicator", "type": "number"},
	"users.is_restricted": {"description": "User is restricted", "role": "indicator", "type": "number"},
	"users.keep_history": {"description": "Keep History", "role": "indicator", "type": "number"},
	"users.shared_libraries": {"description": "Shared Libraries", "role": "text", "type": "array"},
	"users.thumb": {"description": "Thumbnail", "role": "text", "type": "string"},
	"users.user_id": {"description": "User ID", "role": "value", "type": "number"},
	"users.row_id": {"description": "Row ID", "role": "value", "type": "number"},
	"users.username": {"description": "Name of User", "role": "text", "type": "string"},
	
	// SETTINGS
	"settings": {"description": "Plex Settings", "role": "channel"},
	"settings.transcoder.transcoderh264minimumcrf": {"description": "no clue", "role": "state", "type": "string"}	
	
}
