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
const PlexControl = require('plex-control').PlexControl;
const Tautulli = require('tautulli-api');
//const params = require(__dirname + '/tautulli-parameters.json');
const _NODES = require(__dirname + '/NODES.json');


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
		// verify Plex settings
		if (!adapter.config.plexIp)
		{
			adapter.log.warn('Plex IP not configured! Please go to settings and fill in Plex IP.');
			return;
		}
		
		// initialize Plex API
		plex = new Plex({
			hostname: adapter.config.plexIp,
			port: adapter.config.plexPort || 32400,
			https: adapter.config.plexSecure || false,
			options: {
				identifier: '5cc42810-6dc0-44b1-8c70-747152d4f7f9',
				product: 'Plex for ioBroker',
				version: '1.0',
				deviceName: 'ioBroker'
			}
		});
		
		// test connection
		plex.query('/status/sessions').catch(function(e) {adapter.log.warn(e)})
		
		// verify Tautulli settings
		if (!adapter.config.tautulliIp || !adapter.config.tautulliToken)
		{
			adapter.log.debug('Tautulli IP or API token missing!');
			tautulli = {get: function() {return Promise.reject('Not connected!')}}
		}
		
		// initialize Tautulli API
		else
		{
			tautulli = new Tautulli(
				adapter.config.tautulliIp,
				adapter.config.tautulliPort || 8181,
				adapter.config.tautulliToken
			);
		}
		
		// retrieve data
		retrieveData();
		
		if (adapter.config.refresh !== undefined && adapter.config.refresh > 10)
		{
			setTimeout(function updater()
			{
				retrieveData();
				setTimeout(updater, Math.round(parseInt(adapter.config.refresh)*1000));
				
			}, Math.round(parseInt(adapter.config.refresh)*1000));
		}
		
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
 * Receive event from webhook
 *
 */
function setEvent(data, source)
{
	library.set({node: '_playing', role: 'channel', description: 'Current event being played'}, '');
	
	for (var key in data)
		readData('_playing.' + key, data[key])
}

/**
 * Read and write data received from event
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
	{
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
 * Get Node Description
 *
 */
function get(node)
{
	return _NODES[node.toLowerCase().replace(/ /, '_')] || {description: '', role: 'text'};
}

/**
 * Retrieve data from Plex
 *
 */
function retrieveData()
{
	var watched = ['01-last_24h', '02-last_7d', '03-last_30d', '00-all_time'];
	adapter.log.debug('Retrieving data from Plex..');
	
	//
	// GET SERVERS
	//
	plex.query('/servers').then(function(res)
	{
		adapter.log.debug('Retrieved Servers from Plex.');
		library.set({node: 'servers', role: get('servers').role, description: get('servers').description}, '');
		
		let data = res.MediaContainer.Server;
		data.forEach(function(entry)
		{
			var serverId = entry['name'].toLowerCase();
			library.set({node: 'servers.' + serverId, role: get('server').role, description: get('server').description.replace(/%server%/gi, entry['name'])}, '');
			
			for (var key in entry)
				library.set(
					{
						node: 'servers.' + serverId + '.' + key,
						role: get('servers.' + key).role,
						description: get('servers.' + key).description
					},
					entry[key]
				);
		});
	})
	.catch(function(e)
	{
		adapter.log.debug('Could not retrieve Servers from Plex!');
		adapter.log.debug(e);
	});
	
	//
	// GET LIBRARIES
	//
	plex.query('/library/sections').then(function(res)
	{
		adapter.log.debug('Retrieved Libraries from Plex.');
		library.set({node: 'libraries', role: get('libraries').role, description: get('libraries').description}, '');
		
		let data = res.MediaContainer.Directory;
		data.forEach(function(entry)
		{
			var libId = entry['key'] + '-' + entry['title'].toLowerCase();
			library.set({node: 'libraries.' + libId, role: get('library').role, description: get('library').description.replace(/%library%/gi, entry['title'])}, '');
			
			for (var key in entry)
			{
				library.set(
					{
						node: 'libraries.' + libId + '.' + key.toLowerCase(),
						type: get('libraries.' + key).type, 
						role: get('libraries.' + key).role,
						description: get('libraries.' + key).description
					},
					typeof entry[key] == 'object' ? JSON.stringify(entry[key]) : entry[key]
				);
			}
			
			// get library content
			plex.query('/library/sections/' + entry['key'] + '/all').then(function(res)
			{
				library.set({node: 'libraries.' + libId + '.items', type: get('libraries.items').type, role: get('libraries.items').role, description: get('libraries.items').description}, JSON.stringify(res.MediaContainer.Metadata));
				library.set({node: 'libraries.' + libId + '.itemsCount', type: get('libraries.itemscount').type, role: get('libraries.itemscount').role, description: get('libraries.itemscount').description}, JSON.stringify(res.MediaContainer.size));
			});
			
			// get statistics / watch time
			// https://github.com/Tautulli/Tautulli/blob/master/API.md#get_library_watch_time_stats
			tautulli.get('get_library_watch_time_stats', {'section_id': entry['key']}).then(function(res)
			{
				if (!is(res)) return; else data = res.response.data;
				adapter.log.debug('Retrieved Watch Statistics for Library ' + entry['title'] + ' from Tautulli.');
				
				library.set({node: 'statistics', role: get('statistics').role, description: get('statistics').description}, '');
				library.set({node: 'statistics.libraries', role: get('statistics.libraries').role, description: get('statistics.libraries').description.replace(/%library%/gi, '')}, '');
				library.set({node: 'statistics.libraries.' + libId, role: get('statistics.libraries').role, description: get('statistics.libraries').description.replace(/%library%/gi, entry['title'])}, '');
				
				data.forEach(function(entry, i)
				{
					var id = watched[i];
					library.set({node: 'statistics.libraries.' + libId + '.' + id, type: get('statistics.' + id).type, role: get('statistics.' + id).role, description: get('statistics.' + id).description}, '');
						
					for (var key in entry)
						library.set({node: 'statistics.libraries.' + libId + '.' + id + '.' + key, type: get('statistics.' + key).type, role: get('statistics.' + key).role, description: get('statistics.' + key).description}, entry[key]);
				});
			})
			.catch(function(e) {});
			
		});
	})
	.catch(function(e)
	{
		adapter.log.debug('Could not retrieve Libraries from Plex!');
		adapter.log.debug(e);
	});
	
	//
	// GET USERS
	// https://github.com/Tautulli/Tautulli/blob/master/API.md#get_users
	//
	tautulli.get('get_users').then(function(res)
	{
		if (!is(res)) return; else data = res.response.data;
		adapter.log.debug('Retrieved Users from Tautulli.');
		library.set({node: 'users', role: get('users').role, description: get('users').description}, '');
		
		data.forEach(function(entry)
		{
			var userId = entry['friendly_name'].toLowerCase().replace(/ /gi, '_');
			if (userId === 'local') return;
			
			library.set({node: 'users.' + userId, role: get('user').role, description: get('user').description.replace(/%user%/gi, entry['friendly_name'])}, '');
			
			// fill user information
			for (var key in entry)
			{
				if (key === 'server_token') continue;
				library.set({node: 'users.' + userId + '.' + key, role: get('users.' + key).role, description: get('users.' + key).description}, entry[key]);
			}
			
			// get statistics / watch time
			//
			// https://github.com/Tautulli/Tautulli/blob/master/API.md#get_user_watch_time_stats
			tautulli.get('get_user_watch_time_stats', {'user_id': entry['user_id']}).then(function(res)
			{
				if (!is(res)) return; else data = res.response.data;
				adapter.log.debug('Retrieved Watch Statistics for User ' + entry['friendly_name'] + ' from Tautulli.');
				
				library.set({node: 'statistics.users', role: get('statistics.users').role, description: get('statistics.users').description.replace(/%user%/gi, '')}, '');
				library.set({node: 'statistics.users.' + userId, role: get('statistics.users').role, description: get('statistics.users').description.replace(/%user%/gi, entry['friendly_name'])}, '');
				
				data.forEach(function(entry, i)
				{
					var id = watched[i];
					library.set({node: 'statistics.users.' + userId + '.' + id, type: get('statistics.' + id).type, role: get('statistics.' + id).role, description: get('statistics.' + id).description}, '');
					
					for (var key in entry)
						library.set({node: 'statistics.users.' + userId + '.' + id + '.' + key, type: get('statistics.' + key).type, role: get('statistics.' + key).role, description: get('statistics.' + key).description}, entry[key]);
				});
			})
			.catch(function(e) {});
			
		});
	})
	.catch(function(e)
	{
		adapter.log.debug('Could not retrieve Users from Tautulli!');
		adapter.log.debug(e);
	});
	
	//
	// GET SETTINGS
	//
	plex.query('/:/prefs').then(function(res)
	{
		let data = res.MediaContainer.Setting;
		adapter.log.debug('Retrieved Settings from Plex.');
		library.set({node: 'settings', role: get('settings').role, description: get('settings').description}, '');
		
		data.forEach(function(entry)
		{
			entry['group'] = !entry['group'] ? 'other' : entry['group'];
			library.set({node: 'settings.' + entry['group'], role: 'channel', description: 'Settings ' + library.ucFirst(entry['group'])}, '');
			library.set(
				{
					node: 'settings.' + entry['group'] + '.' + entry['id'],
					type: entry['type'] == 'bool' ? 'boolean' : (entry['type'] == 'int' ? 'number' : entry['type']),
					role: entry['type'] == 'bool' ? 'indicator' : (entry['type'] == 'int' ? 'value' : 'text'),
					description: entry['label']
				},
				entry['value']
			);
		});
	})
	.catch(function(e)
	{
		adapter.log.debug('Could not retrieve Settings from Plex!');
		adapter.log.debug(e);
	});
	
	//
	// GET CLIENTS
	//
	plex.query('https://plex.tv/devices.xml').then(function(res)
	{
		adapter.log.debug(JSON.stringify(res));
		
		
		
	});
	
	//
	// GET HISTORY
	//
	/*
	plex.query('/status/sessions/history/all').then(function(res)
	{
		adapter.log.debug('/status/sessions/history/all')
		adapter.log.debug(JSON.stringify(res))
	});
	
	// PLAYLISTS
	plex.query('/playlists').then(function(res)
	{
		adapter.log.debug('/playlists')
		adapter.log.debug(JSON.stringify(res))
	});
	
	// RECENTLY ADDED
	plex.query('/library/recentlyAdded').then(function(res)
	{
		adapter.log.debug('/playlists')
		adapter.log.debug(JSON.stringify(res))
	});
	
	// ON_DECK
	plex.query('/library/onDeck').then(function(res)
	{
		adapter.log.debug('/library/onDeck')
		adapter.log.debug(JSON.stringify(res))
	});
	*/
	
	// PLAYING
	
	
	// COMMANDS
	
	
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
