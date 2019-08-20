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
const PlexPinAuth = require(__dirname + '/lib/plexPinAuth.js');
const _NODES = require(__dirname + '/_NODES.js');
const _EVENTS = require(__dirname + '/_EVENTS.js');
const _ACTIONS = require(__dirname + '/_ACTIONS.js');


/*
 * variables initiation
 */
let adapter;
let library;
let unloaded;
let retryCycle, dutyCycle, refreshCycle;

let encryptionKey;
let plex, plexAuth, tautulli, data;
let players = [], playing = [];
let history = [];
let upload = _multer({ dest: '/tmp/' });

const plexOptions = {
	identifier: '5cc42810-6dc0-44b1-8c70-747152d4f7f9',
	product: 'Plex for ioBroker',
	version: '1.0',
	deviceName: 'ioBroker',
	platform: 'ioBroker'
};


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
	library = new Library(adapter, { updatesInLog: true });
	unloaded = false;

	/*
	 * ADAPTER READY
	 *
	 */
	adapter.on('ready', function ready()
	{
		// set encryption key
		if (adapter.config.encryptionKey === undefined || adapter.config.encryptionKey === '')
		{
			//let key = encryptor.getEncryptionKey();
			encryptionKey = library.getKey(20);
			adapter.getForeignObject('system.adapter.plex.' + adapter.instance, function(err, obj)
			{
				if (err || obj === undefined) return;
				
				obj.native.encryptionKey = encryptionKey;
				adapter.setForeignObject(obj._id, obj);
			});
			
			adapter.log.debug('Generated new encryption key for password encryption.');
		}
		else
			encryptionKey = adapter.config.encryptionKey;
		
		// get history
		adapter.getState('events.history', function(err, state)
		{
			if (!err && state && state.val)
				history = JSON.parse(state.val);
		});
		
		// empty _playing on start
		if (adapter.config.resetMedia)
		{
			library.del('_playing', true, function()
			{
				adapter.log.debug('Plex Media flushed!');
			});
		}
		
		// verify Plex settings
		if (!adapter.config.plexIp || !adapter.config.plexToken)
			return library.terminate('Plex IP and Plex Token not configured! Please go to settings, fill in Plex IP and retrieve a Plex Token.');
		
		// initialize Plex API
		plex = new Plex({
			hostname: adapter.config.plexIp,
			port: adapter.config.plexPort || 32400,
			https: adapter.config.plexSecure || false,
			token: adapter.config.plexToken,
			//username: adapter.config.plexUser || '',
			//password: adapter.config.plexPassword ? library.decode(encryptionKey, adapter.config.plexPassword) : '',
			options: plexOptions
		});
		
		// test connection
		testConnection();
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
	 * HANDLE MESSAGES
	 *
	 */
	adapter.on('message', function(msg)
	{
		adapter.log.debug('Message: ' + JSON.stringify(msg));
		const plexPin = new PlexPinAuth(plexOptions);
		
		switch(msg.command)
		{
			// get PIN
			case 'getPin':
				plexPin.getPin().then(pin =>
				{
					adapter.log.debug('Successfully retrieved PIN: ' + pin.code);
					library.msg(msg.from, msg.command, {result: true, pin: pin}, msg.callback);
				})
				.catch(err =>
				{
					adapter.log.warn(err.message);
					library.msg(msg.from, msg.command, {result: false, error: err.message}, msg.callback);
				});
				break;
			
			// get token
			case 'getToken':
				plexPin.getToken(msg.message.pinId).then(res =>
				{
					// success getting token
					if (res.token === true)
					{
						adapter.log.debug('Successfully retrieved token.');
						library.msg(msg.from, msg.command, {result: true, token: res.auth_token}, msg.callback);
					}
					
					// failed getting token
					else
						library.msg(msg.from, msg.command, {result: false, error: 'No token retrieved!'}, msg.callback);
				})
				.catch(err =>
				{
					adapter.log.warn(err.message);
					library.msg(msg.from, msg.command, {result: false, error: err.message}, msg.callback);
				});
				break;
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
			clearTimeout(retryCycle);
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
 * Test connection
 *
 */
function testConnection()
{
	plex.query('/status/sessions')
		.then(function(res)
		{
			library.set(Library.CONNECTION, true);
			
			// retrieve values from states to avoid message "Unsubscribe from all states, except system's, because over 3 seconds the number of events is over 200 (in last second 0)"
			adapter.getStates(adapterName + '.' + adapter.instance + '.*', function(err, states)
			{
				if (err || !states) return;
				
				for (let state in states)
					library.setDeviceState(state.replace(adapterName + '.' + adapter.instance + '.', ''), states[state] && states[state].val);
			});
			
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
					library.decode(encryptionKey, adapter.config.tautulliToken)
				);
			}
			
			// start duty cycle
			startDutyCycle();
			
			// retrieve data
			if (!adapter.config.refresh)
				adapter.config.refresh = 0;
			
			else if (adapter.config.refresh > 0 && adapter.config.refresh < 10)
			{
				adapter.log.warn('Due to performance reasons, the refresh rate can not be set to less than 10 seconds. Using 10 seconds now.');
				adapter.config.refresh = 10;
			}
			
			refreshCycle = setTimeout(function updater()
			{
				retrieveData();
				if (adapter.config.refresh > 0 && !unloaded)
					refreshCycle = setTimeout(updater, Math.round(parseInt(adapter.config.refresh)*1000));
				
			}, 1000);
			
			// listen to events from Plex
			startListener();
			
		})
		.catch(function(err)
		{
			if (err.message.indexOf('EHOSTUNREACH') > -1)
			{
				adapter.config.retry = 60;
				adapter.log.error('Plex Media Server not reachable! Will try again in ' + adapter.config.retry + ' minutes..');
				
				library.set(Library.CONNECTION, false);
				retryCycle = setTimeout(testConnection, adapter.config.retry*60*1000);
			}
			else
				library.terminate(err.message);
		});
}

/**
 * Receive event from webhook
 *
 */
function setEvent(data, source, prefix)
{
	adapter.log.debug('Received playload -' + (data['event'] || 'unknown') + '- from ' + source + ': ' + JSON.stringify(data));
	
	// PLAYING
	if (prefix == '_playing')
	{
		// group by player
		data['Player'] = data['Player'] !== undefined ? data['Player'] : {};
		let groupBy = data['Player']['title'] && data['Player']['uuid'] ? library.clean(data['Player']['title'], true) + '-' + data['Player']['uuid'] : 'unknown';
		
		// channel by player
		library.set({node: prefix, role: 'channel', description: 'Plex Players'});
		library.set({node: prefix + '.' + groupBy, role: 'channel', description: 'Player ' + (data['Player']['title'] || 'unknown')});
		
		// index current playing players
		if (data['event'] && data['Player'] && data['Player']['title'])
		{
			if (['media.play', 'media.resume'].indexOf(data['event']) > -1 && playing.indexOf(data['Player']['title']) == -1)
				playing.push(data['Player']['title']);
			
			if (['media.stop', 'media.pause'].indexOf(data['event']) > -1)
				playing = playing.filter(player => player !== data['Player']['title']);
			
			library.set({node: '_playing.playing', role: 'text', type: 'string', description: 'Players currently playing'}, playing.join(','));
		}
		
		// add player controls
		if (data['Player'] && data['Player']['uuid'] && players.indexOf(data['Player']['uuid']) == -1)
			getPlayers();
		
		// adapt prefix
		prefix = prefix + '.' + groupBy;
	
		// add meta data
		data.source = source;
		data.timestamp = Math.floor(Date.now()/1000);
		data.datetime = library.getDateTime(Date.now());
	}
	
	// EVENTS
	else if (prefix == 'events')
	{
		// channel
		library.set({node: prefix, role: 'channel', description: 'Plex Events'});
		
		// description
		let message = {
			title: data.event,
			subtitle: ''
		};
		
		['playback', 'server', 'new', 'tautulli'].forEach(type =>
		{
			if (Object.keys(_EVENTS[type]).indexOf(data.event) > -1)
			{
				message.title = _EVENTS[type][data.event].title;
				message.subtitle = _EVENTS[type][data.event].subtitle;
			}
		});
		
		// replace variables with state values
		let pos, variable, placeholder, tmp, index;
		['title', 'subtitle'].forEach(msg =>
		{
			while (message[msg].indexOf('%') > -1)
			{
				pos = message[msg].indexOf('%');
				variable = message[msg].substring(pos+1, message[msg].indexOf('%', pos+1));
				placeholder = variable;
				
				// go through data
				tmp = Object.assign({}, data);
				while (variable.indexOf('.') > -1)
				{
					try
					{
						index = variable.substr(0, variable.indexOf('.'));
						variable = variable.substr(variable.indexOf('.')+1);
						tmp = tmp[index];
					}
					catch(err) {adapter.log.debug(err.message);}
				}
				
				// check value
				if (tmp === undefined || tmp[variable] === undefined)
					return;
				
				// replace variable with value
				message[msg] = message[msg].replace(RegExp('%' + placeholder + '%', 'gi'), tmp[variable]);
			}
		});
		
		// structure event
		let event = {
			timestamp: Math.floor(Date.now()/1000),
			datetime: library.getDateTime(Date.now()),
			event: data.event,
			source: source,
			title: message.title,
			subtitle: message.subtitle
		}
		
		// add event to history
		history.push(event);
		
		data = Object.assign({}, event); // copy object
		data.history = JSON.stringify(history.slice(-250));
	}
	
	for (let key in data)
		readData(prefix + '.' + key, data[key], prefix);
}

/**
 * Read and write data received from event
 *
 */
function readData(key, data, prefix)
{
	// only proceed if data is given
	if (data === undefined || data === 'undefined' || data == '')
		return false;
	
	// get node details
	let node = get(prefix + '.' + key.replace(prefix + '.', '').substr(key.replace(prefix + '.', '').indexOf('.')+1).replace(RegExp('\.[0-9][0-9][0-9]\.', ''), '.'));
	
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
	})
	.catch(function(e)
	{
		adapter.log.debug('Could not retrieve Players from Plex!');
		adapter.log.debug(e);
	});
}

/**
 * Start Duty Cycle
 *
 */
function startDutyCycle()
{
	// start duty cycle (deletion of old states, which have not been updated recently)
	if (adapter.config.dutyCycle === undefined || adapter.config.dutyCycle === null)
		adapter.config.dutyCycle = 0;
	
	else if (adapter.config.dutyCycle > 0 && adapter.config.dutyCycle < 10)
	{
		adapter.log.warn('Due to performance reasons, the duty cycle rate can not be set to less than 10 minutes. Using 10 minutes now.');
		adapter.config.dutyCycle = 10;
	}
	
	clearTimeout(dutyCycle);
	dutyCycle = setTimeout(function dutyCycleRun()
	{
		if (!unloaded && adapter.config.dutyCycle > 0)
		{
			adapter.log.debug('Running Duty Cycle...');
			library.runDutyCycle('_playing', Math.floor(Date.now()/1000));
			adapter.log.debug('Duty Cycle finished.');
			dutyCycle = setTimeout(dutyCycleRun, adapter.config.dutyCycle*60*1000); // run every 1h
		}
		
	}, 60*1000);
}

/**
 * Start Listener for Events
 *
 */
function startListener()
{
	_http.use(_parser.json());
	_http.use(_parser.urlencoded({extended: false}));
	
	_http.post('/plex', upload.single('thumb'), function(req, res, next)
	{
		let payload;
		try
		{
			payload = JSON.parse(req.body.payload);
			res.sendStatus(200);
			
			// write payload to states
			if (Object.keys(_EVENTS.playback).indexOf(payload.event) > -1)
				setEvent(payload, 'plex', '_playing');
			
			setEvent(payload, 'plex', 'events');
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
			
			// write payload to states
			if (Object.keys(_EVENTS.playback).indexOf(payload.event) > -1)
				setEvent(payload, 'tautulli', '_playing');
			
			setEvent(payload, 'tautulli', 'events');
		}
		catch(e) {
			adapter.log.warn(e.message);
			//res.sendStatus(500);
		}
	});
	
	_http.listen(adapter.config.port || 41891);
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
