'use strict';
const adapterName = require('./io-package.json').common.name;
const utils = require('@iobroker/adapter-core'); // Get common adapter utils

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
const _ACTIONS = require(__dirname + '/ACTIONS.json');


/*
 * variables initiation
 */
let adapter;
let library;
let plex, tautulli, data;
let players = {};
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
		// set encryption key
		let key;
		if (adapter.config.encryptionKey === undefined || adapter.config.encryptionKey === '')
		{
			//let key = encryptor.getEncryptionKey();
			key = library.getKey(20);
			adapter.getForeignObject('system.adapter.plex.' + adapter.instance, function(err, obj)
			{
				obj.native.encryptionKey = key;
				adapter.setForeignObject(obj._id, obj);
			});
			
			adapter.log.debug('Generated new encryption key for password encryption.');
			adapter.log.debug(key);
		}
		else
			key = adapter.config.encryptionKey;
		
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
			username: adapter.config.plexUser || '',
			password: adapter.config.plexPassword || '',
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
		
		// retrieve data once
		retrieveData();
		
		// regulary retrieve data
		if (adapter.config.refresh === undefined || adapter.config.refresh === null)
			adapter.config.refresh = 0;
		
		else if (adapter.config.refresh > 0 && adapter.config.refresh < 10)
		{
			adapter.log.info('Due to performance reasons, the refresh rate can not be set to less than 10 seconds. Using 10 seconds now.');
			adapter.config.refresh = 10;
		}
		
		if (adapter.config.refresh > 0)
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
		
		let action = id.substr(id.lastIndexOf('.')+1);
		
		// Playback
		if (_ACTIONS.playback.indexOf(action) && state && state.ack !== true)
		{
			let playerId = '';
			//let player = new PlexControl(adapter.config.plexIp, playerId);
			
			// add player instance
			//players[] = ;
			
			// log
			//adapter.log.info('Triggered action -' + action + '- on Player ' + playerId + '.');
			adapter.log.info('Not yet implemented!');
			
			/*
			// apply playback action
			player.playback[action]().then(function()
			{
				// moveUp was successfully communicated to Plex
				adapter.log.info('Successfully triggered action.');
				
				
			},
			function(err)
			{
				adapter.log.warn('Error triggering action -' + action + '- on Player ' + playerId + '. See debug log for details.');
			});
			*/
			
			
		}
		
		// Navigation
		else if (_ACTIONS.navigation.indexOf(action) && state && state.ack !== true)
		{
			adapter.log.info('Not yet implemented!');
			
			
		}
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
	let groupBy = data['Player']['title'] && data['Player']['uuid'] ? library.clean(data['Player']['title'], true) + '-' + data['Player']['uuid'] : 'unknown';
	library.set({node: '_playing.' + groupBy, role: 'channel', description: 'Plex Player ' + data['Player']['title']});
	
	/*
	// create player
	library.set({node: '_playing', role: 'channel', description: 'Plex Media being played'}, '');
	library.set({node: '_playing.' + groupBy, role: 'channel', description: 'Player ' + (data['Player']['title'] || 'unknown')}, '');
	
	// add player controls
	let controls = '_playing.' + groupBy + '._Controls';
	library.set({node: controls, role: 'channel', description: 'Playback & Navigation Controls'}, '');
	library.set({node: controls + '.playback', role: 'channel', description: 'Playback Controls'}, '');
	library.set({node: controls + '.navigation', role: 'channel', description: 'Navigation Controls'}, '');
	adapter.subscribeStates(controls + '.*');
	
	// Playback controls
	_ACTIONS.playback.forEach(function(button)
	{
		library.set({node: controls + '.playback.' + button, role: 'button', description: 'Playback ' + library.ucFirst(button), common: {playerId: ''}}, '');
	});
	
	// Navigation controls
	_ACTIONS.navigation.forEach(function(button)
	{
		library.set({node: controls + '.navigation.' + button, role: 'button', description: 'Navigation ' + library.ucFirst(button)}, '');
	});
	*/
	
	// add meta data
	data.source = source;
	data.timestamp = Math.floor(Date.now()/1000);
	data.datetime = library.getDateTime(Date.now());
	
	for (let key in data)
		readData('_playing.' + groupBy + '.' + key, data[key]);
	
	// delete old states (which were not updated in the current payload)
	clearTimeout(dutyCycle);
	dutyCycle = setTimeout(function() {library.runDutyCycle('_playing.' + groupBy, data.timestamp)}, 60000);
}

/**
 * Read and write data received from event
 *
 */
function readData(key, data)
{
	// only proceed if data is given
	if (data === undefined || data === 'undefined' || data == '')
		return false;
	
	// get node details
	let node = get('playing.' + key.replace('_playing.', '').substr(key.replace('_playing.', '').indexOf('.')+1).replace(RegExp('\.[0-9][0-9][0-9]\.', ''), '.'));
	
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
						type:  node.type,
						role: node.role,
						description: node.description
					},
					data.map(function(item) {return item.tag ? item.tag : item.name}).join(', ')
				);
			}
			
			key = key + 'Tree';
		}
		
		// create channel
		if (Object.keys(data).length > 0)
		{
			library.set({node: key, role: 'channel', description: RegExp('\.[0-9]{3}$').test(key.substr(-4)) ? 'Index ' + key.substr(key.lastIndexOf('.')+1) : library.ucFirst(key.substr(key.lastIndexOf('.')+1).replace('Tree', '')) + ' Information'}, '');
		
			// read nested data
			let indexKey;
			for (let nestedKey in data)
			{
				indexKey = nestedKey >= 0 && nestedKey < 100 ? (nestedKey >= 0 && nestedKey < 10 ? '00' + nestedKey : '0' + nestedKey) : nestedKey;
				
				if (data[nestedKey] !== undefined && data[nestedKey] !== 'undefined' && typeof data[nestedKey] == 'object')
				{
					//library.set({node: key + '.' + indexKey, role: 'channel', description: nestedKey}, '');
					library.set({node: key + '.' + (Array.isArray(data[nestedKey]) ? nestedKey + 'Tree' : indexKey) + '._data', role: 'json', description: 'Data of this folder in JSON format'}, JSON.stringify(data[nestedKey]));
				}
				
				readData(key + '.' + indexKey, data[nestedKey]);
			}
		}
	}
	
	// write to states
	else
	{
		// convert data
		node.key = key;
		data = convertNode(node, data);
		
		// set data
		library.set(
			{
				node: key,
				type: node.type,
				role: node.role,
				description: node.description
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
 *
 *
 */
function convertNode(node, data)
{
	switch(node.convert)
	{
		case "date-timestamp":
			
			// convert timestamp to date
			let date;
			if (data.toString().indexOf('-') > -1)
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
					node: node.key + 'Date',
					type: 'string',
					role: 'text',
					description: node.description.replace('Timestamp', 'Date')
				},
				date
			);
			break;
		
		case "ms-min":
			let duration = data/1000/60;
			return duration < 1 ? data : Math.floor(duration);
			break;
	}
	
	return data;
}

/**
 * Get Node Description
 *
 */
function get(node)
{
	return _NODES[library.clean(node, true)] || {description: '', role: 'text', type: 'string', convert: null};
}

/**
 * Get Items from Plex
 *
 */
function getItems(path, key, node)
{
	if (!adapter.config.allItems)
		return;
	
	plex.query(path).then(function(res)
	{
		library.set({node: node + '.items', type: get(key + '.items').type, role: get(key + '.items').role, description: get(key + '.items').description}, JSON.stringify(res.MediaContainer.Metadata));
		library.set({node: node + '.itemsCount', type: get(key + '.itemscount').type, role: get(key + '.itemscount').role, description: get(key + '.itemscount').description}, res.MediaContainer.size);
	})
	.catch(function(e)
	{
		adapter.log.debug('Could not retrieve items for ' + key + ' from Plex!');
		adapter.log.debug(e);
	});
}

/**
 * Retrieve data from Plex
 *
 */
function retrieveData()
{
	let watched = ['01-last_24h', '02-last_7d', '03-last_30d', '00-all_time'];
	
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
			
			// index all keys as states
			for (let key in entry)
			{
				library.set(
					{
						node: 'servers.' + serverId + '.' + key,
						role: get('servers.' + key).role,
						description: get('servers.' + key).description
					},
					entry[key]
				);
			}
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
			
			// index all keys as states
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
			getItems('/library/sections/' + entry['key'] + '/all', 'libraries', 'libraries.' + libId);
			
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
			let userId = library.clean(entry['friendly_name'], true);
			if (userId === 'local') return;
			
			library.set({node: 'users.' + userId, role: get('user').role, description: get('user').description.replace(/%user%/gi, entry['friendly_name'])}, '');
			
			// index all keys as states
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
	// GET PLAYLISTS
	//
	plex.query('/playlists').then(function(res)
	{
		let data = res.MediaContainer.Metadata;
		adapter.log.debug('Retrieved Playlists from Plex.');
		library.set({node: 'playlists', role: get('playlists').role, description: get('playlists').description}, '');
		
		data.forEach(function(entry)
		{
			let playlistId = library.clean(entry['title'], true);
			library.set({node: 'playlists.' + playlistId, role: 'channel', description: 'Playlist ' + entry['title']}, '');
			
			// index all keys as states
			for (let key in entry)
			{
				let node = get('playlists.' + key);
				node.key = 'playlists.' + playlistId + '.' + key;
				entry[key] = convertNode(node, entry[key]);
				
				library.set(
					{
						node: 'playlists.' + playlistId + '.' + key,
						type: node.type,
						role: node.role,
						description: node.description
					},
					entry[key]
				);
			}
			
			// get playlist content
			getItems(entry['key'], 'playlists', 'playlists.' + playlistId);
		});
	})
	.catch(function(e)
	{
		adapter.log.debug('Could not retrieve Playlists from Plex!');
		adapter.log.debug(e);
	});
	
	
	//
	// GET CLIENTS
	//
	/*
	plex.query('/clients').then(function(res)
	{
		adapter.log.debug(JSON.stringify(res));
	})
	.catch(function(e)
	{
		adapter.log.debug(JSON.stringify(e));
	});
	
	//
	// GET HISTORY
	//
	plex.query('/status/sessions/history/all').then(function(res)
	{
		adapter.log.debug('history')
		adapter.log.debug(JSON.stringify(res))
	});
	
	//
	// GET RECENTLY ADDED
	//
	plex.query('/library/recentlyAdded').then(function(res)
	{
		adapter.log.debug('recentlyAdded')
		adapter.log.debug(JSON.stringify(res))
	});
	
	//
	// GET ON_DECK
	//
	plex.query('/library/onDeck').then(function(res)
	{
		adapter.log.debug('onDeck')
		adapter.log.debug(JSON.stringify(res))
	});
	*/
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
