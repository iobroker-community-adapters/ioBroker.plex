'use strict';
const adapterName = require('./io-package.json').common.name;
const utils = require('@iobroker/adapter-core'); // Get common adapter utils

const _http = require('express')();
const _parser = require('body-parser');
const _multer = require('multer');
const _request = require('request-promise');

const Plex = require('plex-api');
const Tautulli = require('tautulli-api');


/*
 * internal libraries
 */
const Library = require(__dirname + '/lib/library.js');
const _NODES = require(__dirname + '/_NODES.js');
const _EVENTS = require(__dirname + '/_EVENTS.js');
const _ACTIONS = require(__dirname + '/_ACTIONS.js');


/*
 * variables initiation
 */
let adapter;
let library;
let unloaded;
let dutyCycle, refreshCycle;

let plex, tautulli, data;
let players = [];
let upload = _multer({ dest: '/tmp/' });


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
	unloaded = false;

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
				if (err || obj === undefined) return;
				
				obj.native.encryptionKey = key;
				adapter.setForeignObject(obj._id, obj);
			});
			
			adapter.log.debug('Generated new encryption key for password encryption.');
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
			library.terminate('Plex IP not configured! Please go to settings and fill in Plex IP.');
		
		// initialize Plex API
		plex = new Plex({
			hostname: adapter.config.plexIp,
			port: adapter.config.plexPort || 32400,
			https: adapter.config.plexSecure || false,
			username: adapter.config.plexUser || '',
			password: adapter.config.plexPassword ? library.decode(key, adapter.config.plexPassword) : '',
			options: {
				identifier: '5cc42810-6dc0-44b1-8c70-747152d4f7f9',
				product: 'Plex for ioBroker',
				version: '1.0',
				deviceName: 'ioBroker',
				platform: 'ioBroker'
			}
		});
		
		// test connection
		plex.query('/status/sessions').catch(function(e)
		{
			library.terminate(e.message);
		});
		
		// start duty cycle (deletion of old states, which have not been updated recently)
		clearTimeout(dutyCycle);
		dutyCycle = setTimeout(function dutyCycleRun()
		{
			if (!unloaded)
			{
				adapter.log.debug('Running Duty Cycle...');
				library.runDutyCycle('_playing', Math.floor(Date.now()/1000));
				adapter.log.debug('Duty Cycle finished.');
				dutyCycle = setTimeout(dutyCycleRun, 60*60*1000); // run every 1h
			}
			
		}, 60*1000);
		
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
				library.decode(key, adapter.config.tautulliToken)
			);
		}
		
		// retrieve data once
		retrieveData();
		
		// regulary retrieve data
		if (adapter.config.refresh === undefined || adapter.config.refresh === null)
			adapter.config.refresh = 0;
		
		else if (adapter.config.refresh > 0 && adapter.config.refresh < 10)
		{
			adapter.log.warn('Due to performance reasons, the refresh rate can not be set to less than 10 seconds. Using 10 seconds now.');
			adapter.config.refresh = 10;
		}
		
		if (adapter.config.refresh > 0 && !unloaded)
		{
			refreshCycle = setTimeout(function updater()
			{
				retrieveData();
				if (!unloaded)
					refreshCycle = setTimeout(updater, Math.round(parseInt(adapter.config.refresh)*1000));
				
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
				res.sendStatus(200);
				
				adapter.log.info('Received payload from Plex: ' + JSON.stringify(payload));
				
				// index event of payload
				// events.history
				// events.last
				
				// write payload to states
				if (Object.keys(_EVENTS.playback).indexOf(payload.event) > -1)
					setEvent(payload, 'plex');
			}
			catch(e) {
				adapter.log.warn(e.message);
				//res.sendStatus(500);
			}
		});
		
		// listen to events from Tautulli
		_http.post('/tautulli', function(req, res, next)
		{
			let payload;
			try
			{
				payload = req.body;
				res.sendStatus(200);
				
				adapter.log.info('Received payload from Tautulli: ' + JSON.stringify(payload));
				
				// index event of payload
				// events.history
				// events.last
				
				// write payload to states
				if (Object.keys(_EVENTS.playback).indexOf(payload.event) > -1)
					setEvent(payload, 'tautulli');
			}
			catch(e) {
				adapter.log.warn(e.message);
				//res.sendStatus(500);
			}
		});
		
		_http.listen(adapter.config.port || 41891);
	});

	/*
	 * STATE CHANGE
	 *
	 */
	adapter.on('stateChange', function(id, state)
	{
		if (!state || state.ack === true) return;
		
		adapter.log.debug('State of ' + id + ' has changed ' + JSON.stringify(state) + '.');
		let action = id.substr(id.lastIndexOf('.')+1);
		
		// Refresh Library
		if (action == '_refresh')
		{
			let libId = id.substring(id.indexOf('libraries.')+10, id.indexOf('-'));
			let url = 'http://' + adapter.config.plexIp + ':' + adapter.config.plexPort + '/library/sections/' + libId + '/refresh?force=1';
			adapter.log.debug(url);
			
			_request(url).then(function(res)
			{
				adapter.log.info('Successfully triggered refresh on library with ID ' + libId + '.');
				adapter.log.debug(JSON.stringify(res));
			})
			.catch(function(err)
			{
				adapter.log.warn('Error triggering refresh on library with ID ' + libId + '! See debug log for details.');
				adapter.log.debug(err);
			});
		}
		
		// Player Controls
		else
		{
			adapter.getObject(id, function(err, obj)
			{
				if (err !== null || !obj || !obj.common) return;
				
				let mode = obj.common.mode;
				let playerIp = obj.common.playerIp;
				let playerPort = obj.common.playerPort;
				let playerIdentifier = obj.common.playerIdentifier;
				
				if (_ACTIONS[mode] !== undefined && _ACTIONS[mode][action] !== undefined)
				{
					adapter.log.info('Triggered action -' + action + '- on player ' + playerIp + '.');
					
					let key = obj.common.key || action;
					let attribute = obj.common.attribute;
					
					let url = 'http://' + playerIp + ':' + playerPort + '/player/' + mode + '/' + key + '?' + (attribute != undefined ? attribute + '=' + state.val + '&' : '') + 'X-Plex-Target-Client-Identifier=' + playerIdentifier;
					adapter.log.debug(url);
					
					_request(url).then(function(res)
					{
						adapter.log.info('Successfully triggered ' + mode + ' action -' + action + '- on player ' + playerIp + '.');
						adapter.log.debug(JSON.stringify(res));
					})
					.catch(function(err)
					{
						adapter.log.warn('Error triggering ' + mode + ' action -' + action + '- on player ' + playerIp + '! See debug log for details.');
						adapter.log.debug(err);
					});
				}
				else
					adapter.log.warn('Error triggering ' + mode + ' action -' + action + '- on player ' + playerIp + '! Action not supported!');
			});
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
			
			unloaded = true;
			clearTimeout(refreshCycle);
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
	
	// create player
	library.set({node: '_playing', role: 'channel', description: 'Plex Media being played'}, '');
	library.set({node: '_playing.' + groupBy, role: 'channel', description: 'Player ' + (data['Player']['title'] || 'unknown')}, '');
	
	// add player controls
	if (data['Player'] && data['Player']['uuid'] && players.indexOf(data['Player']['uuid']) == -1)
		getPlayers();
	
	// add meta data
	data.source = source;
	data.timestamp = Math.floor(Date.now()/1000);
	data.datetime = library.getDateTime(Date.now());
	
	for (let key in data)
		readData('_playing.' + groupBy + '.' + key, data[key]);
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
	if (!adapter.config.getAllItems)
		return;
	
	plex.query(path).then(function(res)
	{
		//library.set({node: node + '.items', type: get(key + '.items').type, role: get(key + '.items').role, description: get(key + '.items').description}, JSON.stringify(res.MediaContainer.Metadata));
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
	
	// GET SERVERS
	if (adapter.config.getServers)
		getServers();
	
	// GET LIBRARIES
	if (adapter.config.getLibraries)
		getLibraries();
	
	// GET USERS (https://github.com/Tautulli/Tautulli/blob/master/API.md#get_users)
	if (adapter.config.getUsers)
		getUsers();
	
	// GET SETTINGS
	if (adapter.config.getSettings)
		getSettings();
	
	// GET PLAYLISTS
	if (adapter.config.getPlaylists)
		getPlaylists();
	
	// GET CLIENTS / PLAYERS
	getPlayers();
}

/**
 * Retrieve Server from Plex
 *
 */
function getServers()
{
	plex.query('/servers').then(function(res)
	{
		adapter.log.debug('Retrieved Servers from Plex.');
		library.set({node: 'servers', role: get('servers').role, description: get('servers').description}, '');
		
		let data = res.MediaContainer.Server || [];
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
}

/**
 * Retrieve Libraries from Plex
 *
 */
function getLibraries()
{
	plex.query('/library/sections').then(function(res)
	{
		adapter.log.debug('Retrieved Libraries from Plex.');
		library.set({node: 'libraries', role: get('libraries').role, description: get('libraries').description}, '');
		
		let data = res.MediaContainer.Directory || [];
		data.forEach(function(entry)
		{
			let libId = entry['key'] + '-' + entry['title'].toLowerCase();
			library.set({node: 'libraries.' + libId, role: get('library').role, description: get('library').description.replace(/%library%/gi, entry['title'])}, '');
			
			// refresh button
			library.set(
				{
					node: 'libraries.' + libId + '._refresh',
					type: 'boolean', 
					role: 'button',
					description: 'Scan Library Files'
				},
				false
			);
			adapter.subscribeStates('libraries.' + libId + '._refresh');
			
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
			if (adapter.config.getStatistics)
			{
				tautulli.get('get_library_watch_time_stats', {'section_id': entry['key']}).then(function(res)
				{
					if (!is(res)) return; else data = res.response.data || [];
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
			}
			
		});
	})
	.catch(function(e)
	{
		adapter.log.debug('Could not retrieve Libraries from Plex!');
		adapter.log.debug(e);
	});
}

/**
 * Retrieve Users from Plex
 *
 */
function getUsers()
{
	tautulli.get('get_users').then(function(res)
	{
		if (!is(res)) return; else data = res.response.data || [];
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
			if (adapter.config.getStatistics)
			{
				tautulli.get('get_user_watch_time_stats', {'user_id': entry['user_id']}).then(function(res)
				{
					if (!is(res)) return; else data = res.response.data || [];
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
			}
			
		});
	})
	.catch(function(e)
	{
		adapter.log.debug('Could not retrieve Users from Tautulli!');
		adapter.log.debug(e);
	});
}

/**
 * Retrieve Settings from Plex
 *
 */
function getSettings()
{
	plex.query('/:/prefs').then(function(res)
	{
		let data = res.MediaContainer.Setting || [];
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
}

/**
 * Retrieve Playlists from Plex
 *
 */
function getPlaylists()
{
	plex.query('/playlists').then(function(res)
	{
		let data = res.MediaContainer.Metadata || [];
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
}

/**
 * Retrieve Players from Plex
 *
 */
function getPlayers()
{
	plex.query('/clients').then(function(res)
	{
		let data = res.MediaContainer.Server || [];
		adapter.log.debug('Retrieved Players from Plex.');
		
		data.forEach(function(player)
		{
			// group by player
			players.push(player.machineIdentifier);
			let groupBy = library.clean(player.name, true) + '-' + player.machineIdentifier;
			
			// create player
			library.set({node: '_playing', role: 'channel', description: 'Plex Media being played'}, '');
			library.set({node: '_playing.' + groupBy, role: 'channel', description: 'Player ' + player.name}, '');
			
			// add player controls
			let controls = '_playing.' + groupBy + '._Controls';
			library.set({node: controls, role: 'channel', description: 'Playback & Navigation Controls'}, '');
			
			player.protocolCapabilities.split(',').forEach(function(mode) // e.g. "timeline,playback,navigation,mirror,playqueues"
			{
				if (_ACTIONS[mode] === undefined) return;
				
				library.set({node: controls + '.' + mode, role: 'channel', description: library.ucFirst(mode) + ' Controls'}, '');
				
				let button;
				for (let key in _ACTIONS[mode])
				{
					button = typeof _ACTIONS[mode][key] == 'string' ? { "key": key, "description": _ACTIONS[mode][key] } : _ACTIONS[mode][key];
					
					library.set({
						node: controls + '.' + mode + '.' + key,
						description: 'Playback ' + library.ucFirst(button.description),
						
						role: _ACTIONS[mode][key].attribute !== undefined ? (_ACTIONS[mode][key].values ? 'value' : 'text') : 'button',
						type: _ACTIONS[mode][key].attribute !== undefined ? (_ACTIONS[mode][key].values ? 'number' : 'string') : 'boolean',
						
						common: {
							write: true,
							states: _ACTIONS[mode][key].values,
							
							mode: mode,
							key: _ACTIONS[mode][key].key,
							attribute: _ACTIONS[mode][key].attribute,
							
							playerIp: player.address,
							playerPort: player.port,
							playerIdentifier: player.machineIdentifier
						}
					}, _ACTIONS[mode][key].default !== undefined ? _ACTIONS[mode][key].default : false);
				}
				
				adapter.subscribeStates(controls + '.' + mode + '.*');
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
