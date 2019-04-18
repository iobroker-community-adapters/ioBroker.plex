'use strict';
const adapterName = require('./io-package.json').common.name;
const utils = require(__dirname + '/lib/utils'); // Get common adapter utils


const _http = require('express')();
const _parser = require('body-parser');
const _multer = require('multer');


/*
 * internal libraries
 */
const Library = require(__dirname + '/lib/library.js');
const Plex = require('plex-api');
const Tautulli = require('tautulli-api');
const params = require(__dirname + '/tautulli-parameters.json');


/*
 * variables initiation
 */
var adapter;
var library;
var plex, tautulli, data;
var upload = _multer({ dest: '/tmp/' });


/*
 * ADAPTER
 *
 */
function startAdapter(options)
{
	options = options || {};
	Object.assign(options,
	{
		name: adapterName
	});
	
	adapter = new utils.Adapter(options);
	library = new Library(adapter);

	/*
	 * ADAPTER READY
	 *
	 */
	adapter.on('ready', function()
	{
		let plex = new PlexAPI({
			hostname: '192.168.178.5',
			port: 32400,
			https: false,
			//username:
			//password,
			//token
			options: {
				identifier
				product: 'Plex for ioBroker',
				version: '1.0',
				deviceName: 'ioBroker'
			}
		});
		
		
		client.query('/').then(function(res)
		{
			adapter.log.debug(JSON.stringify(res))
		});
		
		/*
		
		// initialize Tautulli API
		if (!adapter.config.api_ip || !adapter.config.api_token)
		{
			adapter.log.warn('IP or API token missing! Please go to settings and fill in IP and the API token first!');
			return;
		}
		
		// initialize tautulli class
		tautulli = new Tautulli(adapter.config.api_ip, adapter.config.api_port || '8181', adapter.config.api_token);
		
		retrieveData();
		if (adapter.config.refresh !== undefined && adapter.config.refresh > 10)
			setInterval(function() {retrieveData()}, Math.round(parseInt(adapter.config.refresh)*1000));
		*/
		
		// listen to events from Plex
		_http.use(_parser.json());
		_http.use(_parser.urlencoded({extended: false}));
		
		_http.post('/plex', upload.single('thumb'), function(req, res, next)
		{
			var payload;
			try
			{
				payload = JSON.parse(req.body.payload);
				adapter.log.debug('Received payload from Plex: ' + JSON.stringify(payload));
				setEvent(payload, 'plex');
			}
			catch(e) {adapter.log.warn(e.message)}
		});
		
		// listen to events from Tautulli
		_http.post('/tautulli', function(req, res, next)
		{
			var payload;
			try
			{
				payload = req.body;
				adapter.log.debug('Received payload from Tautulli: ' + JSON.stringify(payload));
				//setEvent(payload, 'tautulli');
			}
			catch(e) {adapter.log.warn(e.message)}
		});
		
		_http.listen(adapter.config.port || 41891);
	});

	/*
	 * STATE CHANGE
	 *
	 */
	adapter.on('stateChange', function(id, state)
	{
		adapter.log.debug('State of ' + id + ' has changed ' + JSON.stringify(state) + '.');
		
	});
	
	/*
	 * ADAPTER UNLOAD
	 *
	 */
	adapter.on('unload', function(callback)
	{
		try
		{
			adapter.log.info('Adapter stopped und unloaded.');
			callback();
		}
		catch(e)
		{
			callback();
		}
	});

	return adapter;	
};

/**
 * Use data received from webhook
 *
 */
function setEvent(data, source)
{
	library.set({node: '_playing', role: 'channel', description: 'Current event being played'}, '');
	
	/*
event
accountThumb
accountName
accountId

serverName
serverId

playerName
playerId
playerIP

     "librarySectionType":"show",
      "ratingKey":"217824",
      "key":"/library/metadata/217824",
      "parentRatingKey":"217823",
      "grandparentRatingKey":"217822",
      "guid":"com.plexapp.agents.thetvdb://79491/14/1?lang=en",
      "librarySectionTitle":"Series",
      "librarySectionID":3,
      "librarySectionKey":"/library/sections/3",
      "type":"episode",
      "title":"Episode 1",
      "grandparentKey":"/library/metadata/217822",
      "parentKey":"/library/metadata/217823",
      "grandparentTitle":"Germany's Next Topmodel",
      "parentTitle":"Season 14",
      "summary":"",
      "index":1,
      "parentIndex":14,
      "viewCount":1,
      "lastViewedAt":1549792603,
      "year":2019,
      "thumb":"/library/metadata/217824/thumb/1549788086",
      "art":"/library/metadata/217822/art/1549785382",
      "grandparentThumb":"/library/metadata/217822/thumb/1549785382",
      "grandparentArt":"/library/metadata/217822/art/1549785382",
      "originallyAvailableAt":"2019-02-07",
      "addedAt":1549785275,
      "updatedAt":1549788086

	*/
	
	adapter.log.debug(JSON.stringify(source));
	adapter.log.debug(JSON.stringify(data));
	
	for (var key in data)
		readData('_playing.' + key, data)
}

/**
 * Use data received from webhook
 *
 */
function readData(key, data)
{
	// loop nested data
	if (typeof data == 'object')
	{
		for (var nestedKey in data)
		{
			library.set({node: key + '.' + nestedKey, role: 'channel', description: nestedKey}, '');
			readData(key + '.' + nestedKey, data[nestedKey])
		}
	}
	
	// read data
	else
		library.set(
			{
				node: key,
				type: typeof data,
				role: typeof data == 'boolean' ? 'indicator' : (typeof data == 'number' ? 'value' : 'text'),
				description: ''
			},
			data
		);
	
}

/**
 * Verify if API response is successful.
 *
 */
function is(res)
{
	if (res === undefined || res.response === undefined || res.response.result === undefined || res.response.result !== 'success')
	{
		adapter.log.warn('API response invalid!');
		adapter.log.debug(JSON.stringify(res));
		return false;
	}
	else if (res.response.message === 'Invalid apikey')
	{
		adapter.log.warn('Invalid API key. No results retrieved!');
		return false;
	}
	
	else
		return true;
}

/**
 * Retrieve data from the Tautulli API.
 *
 * Available API methods:
 *	- add_newsletter_config
 *	- add_notifier_config
 *	- arnold
 *	- backup_config
 *	- backup_db
 *	- delete_all_library_history
 *	- delete_all_user_history
 *	- delete_cache
 *	- delete_hosted_images
 *	- delete_image_cache
 *	- delete_library
 *	- delete_login_log
 *	- delete_lookup_info
 *	- delete_media_info_cache
 *	- delete_mobile_device
 *	- delete_newsletter
 *	- delete_newsletter_log
 *	- delete_notification_log
 *	- delete_notifier
 *	- delete_temp_sessions
 *	- delete_user
 *	- docs
 *	- docs_md
 *	- download_config
 *	- download_database
 *	- download_log
 *	- download_plex_log
 *	- edit_library
 *	- edit_user
 *	- get_activity
 *	- get_apikey
 *	- get_date_formats						not required
 *	- get_geoip_lookup						not required
 *	- get_history
 *	- get_home_stats
 *	- get_libraries							IMPLEMENTED
 *	- get_libraries_table
 *	- get_library							same as -get_libraries-
 *	- get_library_media_info
 *	- get_library_names						reduced set of -get_libraries-
 *	- get_library_user_stats
 *	- get_library_watch_time_stats			IMPLEMENTED
 *	- get_logs
 *	- get_metadata
 *	- get_new_rating_keys
 *	- get_newsletter_config
 *	- get_newsletter_log
 *	- get_newsletters
 *	- get_notification_log
 *	- get_notifier_config
 *	- get_notifier_parameters
 *	- get_notifiers
 *	- get_old_rating_keys
 *	- get_plays_by_date
 *	- get_plays_by_dayofweek
 *	- get_plays_by_hourofday
 *	- get_plays_by_source_resolution
 *	- get_plays_by_stream_resolution
 *	- get_plays_by_stream_type
 *	- get_plays_by_top_10_platforms
 *	- get_plays_by_top_10_users
 *	- get_plays_per_month
 *	- get_plex_log
 *	- get_pms_token
 *	- get_pms_update
 *	- get_recently_added
 *	- get_server_friendly_name				not required
 *	- get_server_id
 *	- get_server_identity
 *	- get_server_list
 *	- get_server_pref
 *	- get_servers_info						IMPLEMENTED
 *	- get_settings
 *	- get_stream_data
 *	- get_stream_type_by_top_10_platforms
 *	- get_stream_type_by_top_10_users
 *	- get_synced_items
 *	- get_user								same as -get_users-
 *	- get_user_ips
 *	- get_user_logins
 *	- get_user_names						reduced set of -get_users-
 *	- get_user_player_stats
 *	- get_user_watch_time_stats				IMPLEMENTED
 *	- get_users								IMPLEMENTED
 *	- get_users_table
 *	- get_whois_lookup
 *	- import_database
 *	- install_geoip_db
 *	- notify
 *	- notify_newsletter
 *	- notify_recently_added
 *	- pms_image_proxy
 *	- refresh_libraries_list
 *	- refresh_users_list
 *	- register_device
 *	- restart
 *	- search
 *	- set_mobile_device_config
 *	- set_newsletter_config
 *	- set_notifier_config
 *	- sql
 *	- terminate_session
 *	- undelete_library
 *	- undelete_user
 *	- uninstall_geoip_db
 *	- update
 *	- update_chec
 *	- update_metadata_details
 *
 */
function retrieveData()
{
	var watched = {'01-last_24h': 'Watched last 24 hours', '02-last_7d': 'Watched last 7 days', '03-last_30d': 'Watched last month', '00-all_time': 'Watched all times'};
	adapter.log.info('Retrieving information from Tautulli..');
	
	//
	// https://github.com/Tautulli/Tautulli/blob/master/API.md#get_servers_info
	//
	library.set({node: 'servers', role: 'channel', description: 'Plex Server'}, '');
	tautulli.get('get_servers_info').then(function(res)
	{
		if (!is(res)) return; else data = res.response.data;
		
		data.forEach(function(entry)
		{
			var id = entry['name'].toLowerCase();
			for (var key in entry)
				library.set({node: 'servers.' + id + '.' + key}, entry[key]);
		});
	});
	
	//
	// https://github.com/Tautulli/Tautulli/blob/master/API.md#get_libraries
	//
	library.set({node: 'libraries', role: 'channel', description: 'Plex Libraries'}, '');
	tautulli.get('get_libraries').then(function(res)
	{
		if (!is(res)) return; else data = res.response.data;
		
		data.forEach(function(entry)
		{
			var libId = entry['section_id'] + '-' + entry['section_name'].toLowerCase();
			for (var key in entry)
				library.set({node: 'libraries.' + libId + '.' + key, role: 'text', description: key.replace(/_/gi, ' ')}, entry[key]);
			
			// https://github.com/Tautulli/Tautulli/blob/master/API.md#get_library_watch_time_stats
			library.set({node: 'libraries.' + libId + '.watched', role: 'channel', description: 'Library Watch Statistics'}, '');
			tautulli.get('get_library_watch_time_stats', {'section_id': entry['section_id']}).then(function(res)
			{
				if (!is(res)) return; else data = res.response.data;
				
				data.forEach(function(entry, i)
				{
					var id = Object.keys(watched)[i];
					library.set({node: 'libraries.' + libId + '.watched.' + id, role: 'channel', description: watched[id]}, '');
						
					for (var key in entry)
					{
						library.set({node: 'libraries.' + libId + '.watched.' + id + '.' + key, role: 'text', description: key.replace(/_/gi, ' ')}, entry[key]);
					}
				});
			});
		});
	});
	
	//
	// https://github.com/Tautulli/Tautulli/blob/master/API.md#get_users
	//
	library.set({node: 'users', role: 'channel', description: 'Plex Users'}, '');
	tautulli.get('get_users').then(function(res)
	{
		if (!is(res)) return; else data = res.response.data;
		
		data.forEach(function(entry)
		{
			var userId = entry['friendly_name'].toLowerCase().replace(/ /gi, '_');
			if (userId === 'local') return;
			
			library.set({node: 'users.' + userId, role: 'channel', description: 'User ' + entry['friendly_name']}, '');
			library.set({node: 'users.' + userId + '.data', role: 'channel', description: 'User Information'}, '');
			library.set({node: 'users.' + userId + '.watched', role: 'channel', description: 'User Watch Statistics'}, '');
			
			// fill user information
			for (var key in entry)
			{
				if (key === 'server_token') continue;
				library.set({node: 'users.' + userId + '.data.' + key, role: 'text', description: key.replace(/_/gi, ' ')}, entry[key]);
			}
			
			// https://github.com/Tautulli/Tautulli/blob/master/API.md#get_user_watch_time_stats
			tautulli.get('get_user_watch_time_stats', {'user_id': entry['user_id']}).then(function(res)
			{
				if (!is(res)) return; else data = res.response.data;
				
				data.forEach(function(entry, i)
				{
					var id = Object.keys(watched)[i];
					library.set({node: 'users.' + userId + '.watched.' + id, role: 'channel', description: watched[id]}, '');
						
					for (var key in entry)
					{
						library.set({node: 'users.' + userId + '.watched.' + id + '.' + key, role: 'text', description: key.replace(/_/gi, ' ')}, entry[key]);
					}
				});
			});
		});
	});
	
}

/*
 * COMPACT MODE
 * If started as allInOne/compact mode => return function to create instance
 *
 */
if (module && module.parent)
	module.exports = startAdapter;
else
	startAdapter(); // or start the instance directly
