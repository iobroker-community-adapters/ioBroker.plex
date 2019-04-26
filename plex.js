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
//const PlexControl = require('plex-control').PlexControl;
const Tautulli = require('tautulli-api');
//const params = require(__dirname + '/tautulli-parameters.json');
const _NODES = require(__dirname + '/NODES.json');


/*
 * variables initiation
 */
let adapter;
let library;
let plex, tautulli, data;
let upload = _multer({ dest: '/tmp/' });
let dutyCycle;


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
		// empty _playing on start
		if (adapter.config.resetMedia)
		{
			library.del('_playing', true, function()
			{
				adapter.log.debug('Plex Media flushed!');
			});
		}
		
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
			let payload;
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
			let payload;
			try
			{
				payload = req.body;
				adapter.log.debug('Received payload from Tautulli: ' + JSON.stringify(payload));
				setEvent(payload, 'tautulli');
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
			clearTimeout(dutyCycle);
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
	// group by player
	data['Player'] = data['Player'] !== undefined ? data['Player'] : {};
	let groupBy = data['Player']['title'] && data['Player']['uuid'] ? data['Player']['title'].toLowerCase().replace(/ /g, '_') + '-' + data['Player']['uuid'] : 'unknown';
	
	// create player
	library.set({node: '_playing', role: 'channel', description: 'Plex Media being played'}, '');
	library.set({node: '_playing.' + groupBy, role: 'channel', description: 'Player ' + (data['Player']['title'] || 'unknown')}, '');
	
	// add meta data
	data.source = source;
	data.timestamp = Math.floor(Date.now()/1000);
	data.datetime = library.getDateTime(Date.now());
	
	for (let key in data)
		readData('_playing.' + groupBy + '.' + key, data[key]);
	
	// delete old states (which were not updated in the current payload)
	clearTimeout(dutyCycle);
	dutyCycle = setTimeout(function() {library.runDutyCycle('_playing.' + groupBy, data.timestamp)}, 10000);
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
		// flatten nested data in one state
 		if (Array.isArray(data))
		{
			if (data.length)
			{
				library.set(
					{
						node: key,
						type:  'string',
						role: 'text',
						description: get('playing.' + key.replace('_playing.', '').substr(key.indexOf('.')+1)).description
					},
					data.map(function(item) {return item.tag}).join(', ')
				);
			}
			
			key = key + 'Tree';
		}
		
		// create channel
		if (Object.keys(data).length > 0)
		{
			library.set({node: key, role: 'channel', description: key.substr(key.lastIndexOf('.')+1)}, '');
		
			// read nested data
			for (let nestedKey in data)
			{
				library.set({node: key + '.' + nestedKey, role: 'channel', description: nestedKey}, '');
				
				if (typeof data[nestedKey] == 'object')
					library.set({node: key + '.' + (Array.isArray(data[nestedKey]) ? nestedKey + 'Tree' : nestedKey) + '._data', role: 'json', description: nestedKey + ' data'}, JSON.stringify(data[nestedKey]));
				
				readData(key + '.' + nestedKey, data[nestedKey])
			}
		}
	}
	
	// read data
	else
	{
		// data given?
		if (data == undefined || data == 'undefined' || !data)
			return;
		
		// convert data
		switch(get('playing.' + key.replace('_playing.', '').substr(key.indexOf('.')+1)).convert)
		{
			case "date-timestamp":
				
				// convert timestamp to date
				let date;
				if (data.indexOf('-') > -1)
				{
					date = data
					data = Math.floor(new Date(data).getTime()/1000)
				}
				
				// or keep date if that is given
				else
				{
					let ts = new Date(data*1000);
					date = ts.getFullYear() + '-' + ('0'+ts.getMonth()).substr(-2) + '-' + ('0'+ts.getDate()).substr(-2);
				}
				
				// set date
				library.set(
					{
						node: key + 'Date',
						type: 'string',
						role: 'text',
						description: get('playing.' + key.replace('_playing.', '').substr(key.indexOf('.')+1)).description.replace('Timestamp', 'Date')
					},
					date
				);
				break;
			
			case "ms-min":
				let duration = data/1000/60;
				data = duration < 1 ? data : Math.floor(duration);
				break;
		}
		
		// set data
		library.set(
			{
				node: key,
				type: typeof data,
				role: typeof data == 'boolean' ? 'indicator' : (typeof data == 'number' ? 'value' : 'text'),
				description: get('playing.' + key.replace('_playing.', '').substr(key.indexOf('.')+1)).description
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
	let watched = ['01-last_24h', '02-last_7d', '03-last_30d', '00-all_time'];
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
			let serverId = entry['name'].toLowerCase();
			library.set({node: 'servers.' + serverId, role: get('server').role, description: get('server').description.replace(/%server%/gi, entry['name'])}, '');
			
			for (let key in entry)
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
			let libId = entry['key'] + '-' + entry['title'].toLowerCase();
			library.set({node: 'libraries.' + libId, role: get('library').role, description: get('library').description.replace(/%library%/gi, entry['title'])}, '');
			
			for (let key in entry)
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
			})
			.catch(function(e)
			{
				adapter.log.debug('Could not retrieve Items for Library ' + entry['title'] + ' from Plex!');
				adapter.log.debug(e);
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
					let id = watched[i];
					library.set({node: 'statistics.libraries.' + libId + '.' + id, type: get('statistics.' + id).type, role: get('statistics.' + id).role, description: get('statistics.' + id).description}, '');
						
					for (let key in entry)
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
			let userId = entry['friendly_name'].toLowerCase().replace(/ /gi, '_');
			if (userId === 'local') return;
			
			library.set({node: 'users.' + userId, role: get('user').role, description: get('user').description.replace(/%user%/gi, entry['friendly_name'])}, '');
			
			// fill user information
			for (let key in entry)
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
					let id = watched[i];
					library.set({node: 'statistics.users.' + userId + '.' + id, type: get('statistics.' + id).type, role: get('statistics.' + id).role, description: get('statistics.' + id).description}, '');
					
					for (let key in entry)
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
		
		
		
	})
	.catch(function(e)
	{
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
