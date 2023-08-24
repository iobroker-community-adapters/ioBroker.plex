'use strict';
const ioPackage = require('./io-package.json');
const adapterName = ioPackage.common.name;
const utils = require('@iobroker/adapter-core'); // Get common adapter utils

const _fs = require('fs');
const _http = require('express')();
const _parser = require('body-parser');
const _multer = require('multer');
const _axios = require('axios')
const { v1: _uuid } = require('uuid');

const Plex = require('plex-api');
const Tautulli = require('tautulli-api');

/*
 * internal libraries
 */
const Library = require(__dirname + '/lib/library.js');
const PlexPinAuth = require(__dirname + '/lib/plexPinAuth.js');
const _NODES = require(__dirname + '/_NODES.js');
const _ACTIONS = require(__dirname + '/_ACTIONS.js');


/*
 * constants & variables initiation
 */
let adapter;
let library;
let unloaded;
let retryCycle, refreshCycle;

let encryptionKey;
let plex, tautulli, data;


/**
 * players: 				maschine-id of players
 * playing: 				friendly name of running players
 * streams: 				number of active streams
 * playingDevice: 			object
 * playingDevice.prefix: 	state prefix of runnning players
 * playingDevice.start: 	start date since last update
 */
let players = [], playing = [], streams = 0, playingDevice = [];
let history = [];
let notifications = {};
let upload = _multer({ dest: '/tmp/' });
let refreshInterval = null

let REQUEST_OPTIONS = {};
const watched = ['01-last_24h', '02-last_7d', '03-last_30d', '00-all_time'];
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
	adapter = new utils.Adapter({ ...options, name: adapterName });

	/*
	 * ADAPTER READY
	 *
	 */
	adapter.on('ready', function ready()
	{
		library = new Library(adapter, { nodes: _NODES, actions: _ACTIONS, updatesInLog: adapter.config.debug || false });
		unloaded = false;
		refreshInterval = setInterval(refreshViewOffset,1000)
		// Check Node.js Version
		let version = parseInt(process.version.substr(1, process.version.indexOf('.')-1));
		if (version <= 6)
			return library.terminate('This Adapter is not compatible with your Node.js Version ' + process.version + ' (must be >= Node.js v7).', true);
		
		// set encryption key
		if (adapter.config.encryptionKey === undefined || adapter.config.encryptionKey === '')
		{
			//let key = encryptor.getEncryptionKey();
			encryptionKey = library.getKey(20);
			adapter.getForeignObject('system.adapter.plex.' + adapter.instance, (err, obj) =>
			{
				if (err || obj === undefined) return;
				
				obj.native.encryptionKey = encryptionKey;
				adapter.setForeignObject(obj._id, obj);
			});
			
			adapter.log.debug('Generated new encryption key for password encryption.');
		}
		else
			encryptionKey = adapter.config.encryptionKey;
		
		// Secure connection
		REQUEST_OPTIONS.secureConnection = false;
		REQUEST_OPTIONS._protocol = 'http:';
		REQUEST_OPTIONS.timeout = 1000;

		if (adapter.config.secureConnection && adapter.config.certPublicVal && adapter.config.certPrivateVal)
		{
			adapter.log.info('Establishing secure connection to Plex Media Server...');
			
			try
			{
				REQUEST_OPTIONS = {
					...REQUEST_OPTIONS,
					'cert': adapter.config.certPublicVal.indexOf('.') === -1 ? adapter.config.certPublicVal : _fs.readFileSync(adapter.config.certPublicVal),
					'key': adapter.config.certPrivateVal.indexOf('.') === -1 ? adapter.config.certPrivateVal : _fs.readFileSync(adapter.config.certPrivateVal),
					'rejectUnauthorized': false,
					'secureConnection': true,
					'_protocol': 'https:'
				};
				
				if (adapter.config.certChainedVal) {
					REQUEST_OPTIONS.ca = adapter.config.certChainedVal.indexOf('.') === -1 ? adapter.config.certChainedVal : _fs.readFileSync(adapter.config.certChainedVal);
				}
				
				if (REQUEST_OPTIONS.key.indexOf('ENCRYPTED') > -1) {
					REQUEST_OPTIONS.passphrase = adapter.config.passphrase;
				}
			}
			catch(err)
			{
				adapter.log.warn('Failed loading certificates! Falling back to insecure connection to Plex Media Server...');
				adapter.log.debug(err.message);
				
				REQUEST_OPTIONS.secureConnection = false;
				REQUEST_OPTIONS._protocol = 'http:';
			}
		}
		else
			adapter.log.info('Establishing insecure connection to Plex Media Server...');
		
		// get notifications
		if (adapter.config.notifications)
		{
			adapter.config.notifications.forEach(notification =>
			{
				if (!notifications[notification.media]) notifications[notification.media] = {};
				notifications[notification.media][notification.event] = { 'message': notification.message, 'caption': notification.caption, 'thumb': notification.thumb }
			});
		}
		else
			adapter.config.notifications = ioPackage.native.notifications;
		
		// verify Plex settings
		if (!adapter.config.plexIp || !adapter.config.plexToken)
			return library.terminate('Plex IP and Plex Token not configured! Please go to settings, fill in Plex IP and retrieve a Plex Token.');
		
		// initialize Plex API
		adapter.config.plexPort = adapter.config.plexPort || 32400;
		plex = new Plex({
			'hostname': adapter.config.plexIp,
			'port': adapter.config.plexPort,
			'https': REQUEST_OPTIONS.secureConnection,
			'token': adapter.config.plexToken,
			'requestOptions': REQUEST_OPTIONS,
			'options': plexOptions
		});
		
		// retrieve all values from states to avoid message "Unsubscribe from all states, except system's, because over 3 seconds the number of events is over 200 (in last second 0)"
		adapter.getStates(adapterName + '.' + adapter.instance + '.*', (err, states) => {
			library.set(Library.CONNECTION, true);
			
			// set current states from objects
			for (let state in states) {
				//Reset own states common.type and common.role
				library.extendState(state)

				if (states[state] !== null) {
					library.setDeviceState(state.replace(adapter.name + '.' + adapter.instance + '.', ''), states[state] && states[state].val);
				
					// set history
					if (state.indexOf('events.history') > -1) {
						history = JSON.parse(states[state].val);
					}
				}
			}
			
			// empty _playing on start
			if (adapter.config.resetMedia)
				library.del('_playing', true, () => adapter.log.debug('Plex Media flushed!'));
			
			// subscribe to remote player
			adapter.subscribeForeignStates('iot.0.services.custom_plex');
			adapter.subscribeForeignStates('cloud.0.services.custom_plex');
			
			// test connection
			init();
		});
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
		let val = state.val;
		
		// Cloud / iot Adapter
		if (action == 'custom_plex')
		{
			try
			{
				let playerNamespace;
				[ playerNamespace, action, val ] = state.val.split('_');
				id = '_playing.' + playerNamespace + '._Controls.playback.' + action;
			}
			catch(err)
			{
				adapter.log.warn(err.message);
				return;
			}
		}
		
		// Refresh Library
		if (action == '_refresh')
		{
			let libId = id.substring(id.indexOf('libraries.')+10, id.indexOf('-'));
			let options = {
				...REQUEST_OPTIONS,
				'url': REQUEST_OPTIONS._protocol + '//' + adapter.config.plexIp + ':' + adapter.config.plexPort + '/library/sections/' + libId + '/refresh?force=1',
				'method': 'POST',
				'headers': {
					'X-Plex-Token': adapter.config.plexToken
				}
			};
			
			_axios(options).then(res =>
			{
				adapter.log.info('Successfully triggered refresh on library with ID ' + libId + '.');
				adapter.log.debug(JSON.stringify(res));
			})
			.catch(err =>
			{
				adapter.log.warn('Error triggering refresh on library with ID ' + libId + '! See debug log for details.');
				adapter.log.debug(err);
			});
		}
		
		// Player Controls
		else
		{
			let path = id.replace(adapter.name + '.' + adapter.instance + '.', '').split('.');
			action = path.pop();
			let mode = path.pop();
			
			path.splice(-1);
			let playerIdentifier = library.getDeviceState(path.join('.') + '.Player.uuid');
			let playerTitle = library.getDeviceState(path.join('.') + '.Player.title');
			let playerIp = library.getDeviceState(path.join('.') + '.Player.localaddress');
			let playerPort = library.getDeviceState(path.join('.') + '.Player.port');
			
			if (_ACTIONS[mode] !== undefined && _ACTIONS[mode][action] !== undefined)
			{
				adapter.log.info('Triggered action -' + action + '- on player ' + playerIp + '.');
				
				let key = _ACTIONS[mode][action].key || action;
				if (_ACTIONS[mode][action]["true"] !== undefined)
						key = state.val ? _ACTIONS[mode][action]["true"] : _ACTIONS[mode][action]["false"]
				let attribute = _ACTIONS[mode][action].attribute;
				let url = 'http:' + '//' + playerIp + ':' + playerPort + '/player/' + mode + '/' + key + '?' + (attribute != undefined ? attribute + '=' + val + '&' : '')
				
				let options = {
					...REQUEST_OPTIONS,
					'method': 'POST',
					// Dont work for me with https:
					//'url': REQUEST_OPTIONS._protocol + '//' + playerIp + ':' + playerPort + '/player/' + mode + '/' + key + '?' + (attribute != undefined ? attribute + '=' + val + '&' : ''),
					'url': url,
					'headers': {
						'X-Plex-Token': adapter.config.plexToken,
						'X-Plex-Target-Client-Identifier': playerIdentifier
					}
				};

				_axios(options).then(res =>
				{
					adapter.log.info('Successfully triggered ' + mode + ' action -' + action + '- on player ' + playerIp + '.');
					// confirm commands
					library.confirmNode({node: id}, state.val)
				})
				.catch(err =>
				{
					adapter.log.warn('Error triggering ' + mode + ' action -' + action + '- on player ' + playerIp + '! See debug log for details.');
					adapter.log.debug(err);
				});
				adapter.log.debug('http:' + '//' + playerIp + ':' + playerPort + '/player/' + mode + '/' + key + '?' + (attribute != undefined ? attribute + '=' + val + '&' : '')
					)
			}
			else
				adapter.log.warn('Error triggering ' + mode + ' action -' + action + '- on player ' + playerIp + '! Action not supported!');
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
			adapter.log.info('Plex Adapter stopped und unloaded.');
			
			unloaded = true;
			
			_http.close(() => adapter.log.debug('Server for listener closed.'));
			clearTimeout(retryCycle);
			clearTimeout(refreshCycle);
			clearInterval(refreshInterval)
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
function init()
{
	plex.query('/status/sessions')
		.then(res =>
		{
			library.set(Library.CONNECTION, true);
			
			// retrieve values from states to avoid message "Unsubscribe from all states, except system's, because over 3 seconds the number of events is over 200 (in last second 0)"
			adapter.getStates(adapterName + '.' + adapter.instance + '.*', (err, states) =>
			{
				if (err || !states) return;
				
				for (let state in states)
					library.setDeviceState(state.replace(adapterName + '.' + adapter.instance + '.', ''), states[state] && states[state].val);
				
				playing = library.getDeviceState('_playing.players') && library.getDeviceState('_playing.players').split(',') || [];
				streams = library.getDeviceState('_playing.streams') || 0;
			});
			
			// verify Tautulli settings
			if (!adapter.config.tautulliIp || !adapter.config.tautulliToken)
			{
				adapter.log.debug('Tautulli IP or API token missing!');
				tautulli = { get: () => Promise.reject('Not connected!') }
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
		.catch(err =>
		{
			adapter.log.debug('Configuration: ' + JSON.stringify(adapter.config));
			adapter.log.debug('Request-Options: ' + JSON.stringify(REQUEST_OPTIONS));
			adapter.log.debug('Stack-Trace: ' + JSON.stringify(err.stack));
			
			if (err.message.indexOf('EHOSTUNREACH') > -1)
			{
				adapter.config.retry = 60;
				adapter.log.info('Plex Media Server not reachable! Will try again in ' + adapter.config.retry + ' minutes..');
				
				library.set(Library.CONNECTION, false);
				retryCycle = setTimeout(init, adapter.config.retry*60*1000);
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
	adapter.log.debug('Received ' + prefix + ' playload -' + (data['event'] || 'unknown') + '- from ' + source + ': ' + JSON.stringify(data));
	
	// empty payload
	if (Object.keys(data).length === 0 || !data['event']) {
		adapter.log.warn('Empty payload received from ' + source + '! Please go to ' + source + ' and configure payload!');
		return false;
	}
	
	// add meta data
	data.media = data.Metadata && data.Metadata.type;
	data.player = data.Player && data.Player.title;
	data.account = data.Account && data.Account.title;
	data.source = source;
	data.timestamp = Math.floor(Date.now()/1000);
	data.datetime = library.getDateTime(Date.now());
	data.playing = data.event.indexOf('play') > -1 || data.event.indexOf('resume') > -1;
	
	// PLAYING
	if (prefix == '_playing')
	{
		// update latest player
		if (data.Player && data.Player.title != '_recent') {
			setEvent({ ...data, 'Player': { 'title': '_recent', 'uuid': 'player' } }, source, prefix);
		}
		
		// group by player
		data.Player = data.Player !== undefined ? data.Player : {};
		let groupBy = data.Player.title && data.Player.uuid !== undefined ? library.clean(data.Player.title, true) + '-' + data.Player.uuid : 'unknown';
		
		// channel by player
		library.set({node: prefix, role: 'channel', description: 'Plex Players'});
		library.set({node: prefix + '.' + groupBy, role: 'channel', description: 'Player ' + (data.Player.title || 'unknown')});
		
		// adapt prefix
		prefix = prefix + '.' + groupBy;
    
		// index current playing players
		if (data.event && data.Player && data.Player.title != '_recent')
		{
			if (['media.play', 'media.resume'].indexOf(data.event) > -1)
			{
				if (playing.indexOf(data.Player.title) == -1) playing.push(data.Player.title);
				if (playingDevice.findIndex((player) => player.prefix == prefix) == -1) playingDevice.push({"prefix":prefix, "start": Date.now()});
				streams++;
			}
			else if (['media.stop', 'media.pause'].indexOf(data.event) > -1)
			{
				playing = playing.filter(player => player !== data.Player.title);
				playingDevice = playingDevice.filter(player => player.prefix !== prefix);
				streams > 0 && streams--;
			}
			
			library.set({node: '_playing.players', role: 'text', type: 'string', description: 'Players currently playing'}, playing.join(','));
			library.set({node: '_playing.streams', role: 'value', type: 'number', description: 'Number of players currently playing'}, streams);
		}

		// add player controls
		if (data.Player && data.Player.uuid && players.indexOf(data.Player.uuid) == -1 && data.Player.title != '_recent') {
			getPlayers();
		// update play_switch control 
		} else if (data.Player.title != '_recent' && ['media.play', 'media.resume', 'media.stop', 'media.pause'].indexOf(data.event) > -1){	
			library.confirmNode({node: prefix + '._Controls.playback.play_switch'}, (['media.play', 'media.resume'].indexOf(data.event) > -1))
		}	
	}
	
	// EVENTS
	else if (prefix == 'events')
	{
		// channel
		library.set({node: prefix, role: 'channel', description: 'Plex Events'});
		
		// replace placeholders in notification message
		let event = data.event && data.event.replace('media.', '');
		
		let message = notifications[data.media] && notifications[data.media][event] ||
						notifications['any'] && notifications['any'][event] ||
						notifications[data.media] && notifications[data.media]['any'] ||
						notifications['any'] && notifications['any']['any'] ||
						{ 'message': '', 'caption': '', 'thumb': '', 'notExist':true };
		
		if (!message.notExist) {
			// structure event
			let eventData = JSON.parse(JSON.stringify(data));
			let notification = {
				'id': _uuid(),
				'timestamp': data.timestamp,
				'datetime': data.datetime,
				'account': data.account,
				'player': data.player,
				'media': data.media,
				'event': event,
				'thumb': message.thumb ? (REQUEST_OPTIONS._protocol + '//' + adapter.config.plexIp + ':' + adapter.config.plexPort + '' + replacePlaceholders(message.thumb, eventData) + '?X-Plex-Token=' + adapter.config.plexToken) : '',
				'message': replacePlaceholders(message.message, eventData),
				'caption': replacePlaceholders(message.caption, eventData),
				'source': data.source
			}
			
			// add event to history
			history.push(notification);
			
			data = Object.assign({}, notification); // copy object
			data.history = JSON.stringify(history.slice(-1000));
		} else {
			adapter.log.debug('No message defined for ' + data.media + ' ' + event)
		}
	}
	
	// write states
	for (let key in data) {
		readData(prefix + '.' + key, data[key], prefix);
	}
	
	// cleanup old states when playing something new
	if (prefix.indexOf('_playing') > -1 && data.event == 'media.play') {
		library.runGarbageCollector(prefix, false, 30, ['_Controls']);
	}
}

/**
 * Read and write data received from event
 *
 */
function readData(key, data, prefix, properties)
{
	// only proceed if data is given
	if (data === undefined || data === 'undefined')
		return false;
	
		// get node details	
	let node = library.getNode(key.indexOf('_playing') > -1 ? 'playing' + key.substr(key.indexOf('.', prefix.length)) : key, true);

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
						'node': key,
						'type': node.type,
						'role': node.role,
						'description': node.description
					},
					data.map(item => item.tag ? item.tag : item.name).join(', '),
					properties
				);
			}
			
			key = key + 'Tree';
		}
		
		// create channel
		if (Object.keys(data).length > 0 && (key.indexOf('Tree') === -1 || (key.indexOf('Tree') > -1 && adapter.config.getMetadataTrees)))
		{
			// channel
			library.set(
				{
					'node': key,
					'role': 'channel',
					'description': RegExp('\.[0-9]{3}$').test(key.substr(-4)) ? 'Index ' + key.substr(key.lastIndexOf('.')+1) : library.ucFirst(key.substr(key.lastIndexOf('.')+1).replace('Tree', '')) + ' Information'
				},
				undefined,
				properties
			);
			
			// read nested data
			let indexKey;
			for (let nestedKey in data)
			{
				indexKey = nestedKey >= 0 && nestedKey < 100 ? (nestedKey >= 0 && nestedKey < 10 ? '00' + nestedKey : '0' + nestedKey) : nestedKey;
				
				if (data[nestedKey] !== undefined && data[nestedKey] !== 'undefined')
				{
					if (typeof data[nestedKey] == 'object' && (!Array.isArray(data[nestedKey]) || (Array.isArray(data[nestedKey]) && adapter.config.getMetadataTrees)))
					{
						library.set({
							'node': key + '.' + (Array.isArray(data[nestedKey]) ? nestedKey + 'Tree' : indexKey) + '._data',
							'role': 'json',
							'description': 'Data of this folder in JSON format'}, JSON.stringify(data[nestedKey]), properties);
					}
					
					readData(key + '.' + indexKey, data[nestedKey], prefix);
				}
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
				'node': key,
				'type': node.type,
				'role': node.role,
				'description': node.description
			},
			data,
			properties
		);
	}
}

/**
 *
 *
 */
function replacePlaceholders(message, data)
{
	let pos, variable, tmp, path, index;
	while (message.indexOf('%') > -1)
	{
		pos = message.indexOf('%');
		variable = message.substring(pos, message.indexOf('%', pos+1)+1).replace(/%/g, '');
		
		// get value for placeholders
		tmp = JSON.parse(JSON.stringify(data));
		path = variable;
		
		while (path.indexOf('.') > -1)
		{
			try
			{
				index = path.substr(0, path.indexOf('.'));
				path = path.substr(path.indexOf('.')+1);
				tmp = tmp[index];
			}
			catch(err) {adapter.log.debug(err.message)}
		}
		
		// check value
		if (tmp === undefined || tmp[path] === undefined || tmp === null || tmp[path] === null)
			message = message.replace(RegExp('%' + variable + '%', 'gi'), '(' + variable + ' not found!)');
		
		else
			message = message.replace(RegExp('%' + variable + '%', 'gi'), tmp[path]);
	}
	
	return message; // .replace(/ /g, '');
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
	if (!(node && node.convert)) return data
	switch(node.convert.func)
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
					'node': node.key + 'Date',
					'type': 'string',
					'role': 'text',
					'description': node.description.replace('Timestamp', 'Date')
				},
				date
			);
			break;
		case "seconds-readable":
			let d = new Date(data)
			let value = (d.getHours()-1) ? (d.getHours()-1).toString() : '' 
			value += value ? ':'+('0'+d.getMinutes()).substr(-2) : d.getMinutes().toString() + ':' + ('0'+d.getSeconds()).substr(-2)
			library.set(
				{
					'node': node.key + 'human',
					'type': 'string',
					'role': 'text',
					'description': 'Last viewing position'
				},
				value
			)
			library.set(
				{
					'node': node.key + 'Seconds',
					'type': 'number',
					'role': 'media.elapsed',
					'description': 'Last viewing position in seconds(refresh)'

				},
				Math.floor(data/1000)
			)
			break;
		
		case "ms-min":
			let duration = data/1000;
			library.set(
				{
					'node': node.key + 'Seconds',
					'type': 'number',
					'role': 'media.duration',
					'description': node.description.replace('in minutes', 'in seconds')
				},
				duration < 1 ? data * 60 : Math.floor(duration)
			)
			return duration < 1 ? data : Math.floor(duration/60);
			break;
		case "create-link":
			let link = data ? (REQUEST_OPTIONS._protocol + '//' + adapter.config.plexIp + ':' + adapter.config.plexPort + '' + data + '?X-Plex-Token=' + adapter.config.plexToken) : ''
			library.set(
				{
					'node': node.key + node.convert.key,
					'type': node.convert.type,
					'role': node.convert.role,
					'description': (node.description + ' (link)')
				},
				link
			)
			break;
	}
	
	return data;
}

/**
 * Get Items from Plex
 *
 */
function getItems(path, key, node)
{
	if (!adapter.config.getAllItems)
		return;
	
	plex.query(path).then(res =>
	{
		//library.set({node: node + '.items', type: library.getNode(key.toLowerCase() + '.items').type, role: library.getNode(key.toLowerCase() + '.items').role, description: library.getNode(key.toLowerCase() + '.items').description}, JSON.stringify(res.MediaContainer.Metadata));
		library.set(
			{
				'node': node + '.itemsCount',
				'type': library.getNode(key.toLowerCase() + '.itemscount').type,
				'role': library.getNode(key.toLowerCase() + '.itemscount').role,
				'description': library.getNode(key.toLowerCase() + '.itemscount').description
			},
			res.MediaContainer.size
		);
	})
	.catch(err =>
	{
		adapter.log.debug('Could not retrieve items for ' + key + ' from Plex!');
		adapter.log.debug(err);
	});
}

/**
 * Retrieve data from Plex
 *
 */
function retrieveData()
{
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
	plex.query('/servers').then(res =>
	{
		adapter.log.debug('Retrieved Servers from Plex.');
		library.set({node: 'servers', role: library.getNode('servers').role, description: library.getNode('servers').description});
		
		let data = res.MediaContainer.Server || [];
		data.forEach(entry =>
		{
			let serverId = entry['name'].toLowerCase();
			library.set({node: 'servers.' + serverId, role: library.getNode('server').role, description: library.getNode('server').description.replace(/%server%/gi, entry['name'])});
			
			// index all keys as states
			for (let key in entry)
			{
				library.set(
					{
						'node': 'servers.' + serverId + '.' + key,
						'role': library.getNode('servers.' + key.toLowerCase()).role,
						'type': library.getNode('servers.' + key.toLowerCase()).type,
						'description': library.getNode('servers.' + key.toLowerCase()).description
					},
					entry[key]
				);
			}
		});
	})
	.catch(err =>
	{
		adapter.log.debug('Could not retrieve Servers from Plex!');
		adapter.log.debug(err);
	});
}

/**
 * Retrieve Libraries from Plex
 *
 */
function getLibraries()
{
	plex.query('/library/sections').then(res =>
	{
		adapter.log.debug('Retrieved Libraries from Plex.');
		library.set({node: 'libraries', role: library.getNode('libraries').role, description: library.getNode('libraries').description});
		
		let data = res.MediaContainer.Directory || [];
		data.forEach(entry =>
		{
			let libId = entry['key'] + '-' + entry['title'].toLowerCase();
			library.set({node: 'libraries.' + libId, role: library.getNode('library').role, description: library.getNode('library').description.replace(/%library%/gi, entry['title'])});
			
			// refresh button
			library.set(
				{
					'node': 'libraries.' + libId + '._refresh',
					'type': 'boolean', 
					'role': 'button',
					'description': 'Scan Library Files'
				},
				false
			);
			adapter.subscribeStates('libraries.' + libId + '._refresh');
			
			// index all keys as states
			for (let key in entry)
			{
				library.set(
					{
						'node': 'libraries.' + libId + '.' + key.toLowerCase(),
						'type': library.getNode('libraries.' + key.toLowerCase()).type, 
						'role': library.getNode('libraries.' + key.toLowerCase()).role,
						'description': library.getNode('libraries.' + key.toLowerCase()).description
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
				tautulli.get('get_library_watch_time_stats', {'section_id': entry['key']}).then(res =>
				{
					if (!is(res)) return; else data = res.response.data || [];
					adapter.log.debug('Retrieved Watch Statistics for Library ' + entry['title'] + ' from Tautulli.');
					
					library.set({node: 'statistics', role: library.getNode('statistics').role, description: library.getNode('statistics').description});
					library.set({node: 'statistics.libraries', role: library.getNode('statistics.libraries').role, description: library.getNode('statistics.libraries').description.replace(/%library%/gi, '')});
					library.set({node: 'statistics.libraries.' + libId, role: library.getNode('statistics.libraries').role, description: library.getNode('statistics.libraries').description.replace(/%library%/gi, entry['title'])});
					
					data.forEach((entry, i) =>
					{
						let id = watched[i];
						library.set({node: 'statistics.libraries.' + libId + '.' + id, type: library.getNode('statistics.' + id).type, role: library.getNode('statistics.' + id).role, description: library.getNode('statistics.' + id).description});
						
						for (let key in entry)
							library.set({node: 'statistics.libraries.' + libId + '.' + id + '.' + key, type: library.getNode('statistics.' + key).type, role: library.getNode('statistics.' + key).role, description: library.getNode('statistics.' + key).description}, entry[key]);
					});
				})
				.catch(err => {});
			}
			
		});
	})
	.catch(err =>
	{
		adapter.log.debug('Could not retrieve Libraries from Plex!');
		adapter.log.debug(err);
	});
}

/**
 * Retrieve Users from Plex
 *
 */
function getUsers()
{
	tautulli.get('get_users').then(res =>
	{
		if (!is(res)) return; else data = res.response.data || [];
		adapter.log.debug('Retrieved Users from Tautulli.');
		library.set({node: 'users', role: library.getNode('users').role, description: library.getNode('users').description});
		
		data.forEach(entry =>
		{
			let userName = entry['username'] || entry['friendly_name'] || entry['email'] || entry['user_id'];
			let userId = library.clean(userName, true).replace(/\./g, '');
			if (userId === 'local') return;
			
			library.set({node: 'users.' + userId, role: library.getNode('user').role, description: library.getNode('user').description.replace(/%user%/gi, userName)});
			
			// index all keys as states
			for (let key in entry)
			{
				if (key === 'server_token') continue;
				library.set({node: 'users.' + userId + '.' + key, role: library.getNode('users.' + key.toLowerCase()).role, type: library.getNode('users.' + key.toLowerCase()).type, description: library.getNode('users.' + key.toLowerCase()).description}, entry[key]);
			}
			
			// get statistics / watch time
			//
			// https://github.com/Tautulli/Tautulli/blob/master/API.md#get_user_watch_time_stats
			if (adapter.config.getStatistics)
			{
				tautulli.get('get_user_watch_time_stats', {'user_id': entry['user_id']}).then(res =>
				{
					if (!is(res)) return; else data = res.response.data || [];
					adapter.log.debug('Retrieved Watch Statistics for User ' + userName + ' from Tautulli.');
					
					library.set({node: 'statistics.users', role: library.getNode('statistics.users').role, description: library.getNode('statistics.users').description.replace(/%user%/gi, '')});
					library.set({node: 'statistics.users.' + userId, role: library.getNode('statistics.users').role, description: library.getNode('statistics.users').description.replace(/%user%/gi, userName)});
					
					data.forEach((entry, i) =>
					{
						let id = watched[i];
						library.set({node: 'statistics.users.' + userId + '.' + id, type: library.getNode('statistics.' + id).type, role: library.getNode('statistics.' + id).role, description: library.getNode('statistics.' + id).description});
						
						for (let key in entry)
							library.set({node: 'statistics.users.' + userId + '.' + id + '.' + key, type: library.getNode('statistics.' + key).type, role: library.getNode('statistics.' + key).role, description: library.getNode('statistics.' + key).description}, entry[key]);
					});
				})
				.catch(err => {});
			}
			
		});
	})
	.catch(err =>
	{
		adapter.log.debug('Could not retrieve Users from Tautulli!');
		adapter.log.debug(err);
	});
}

/**
 * Retrieve Settings from Plex
 *
 */
function getSettings()
{
	plex.query('/:/prefs').then(res =>
	{
		let data = res.MediaContainer.Setting || [];
		adapter.log.debug('Retrieved Settings from Plex.');
		library.set({node: 'settings', role: library.getNode('settings').role, description: library.getNode('settings').description});
		
		data.forEach(entry =>
		{
			entry['group'] = !entry['group'] ? 'other' : entry['group'];
			library.set({node: 'settings.' + entry['group'], role: 'channel', description: 'Settings ' + library.ucFirst(entry['group'])});
			library.set(
				{
					'node': 'settings.' + entry['group'] + '.' + entry['id'],
					'type': entry['type'] == 'bool' ? 'boolean' : (entry['type'] == 'int' ? 'number' : 'string'),
					'role': entry['type'] == 'bool' ? 'indicator' : (entry['type'] == 'int' ? 'value' : 'text'),
					'description': entry['label']
				},
				entry['value']
			);
		});
	})
	.catch(err =>
	{
		adapter.log.debug('Could not retrieve Settings from Plex!');
		adapter.log.debug(err);
	});
}

/**
 * Retrieve Playlists from Plex
 *
 */
function getPlaylists()
{
	plex.query('/playlists').then(res =>
	{
		let data = res.MediaContainer.Metadata || [];
		adapter.log.debug('Retrieved Playlists from Plex.');
		library.set({node: 'playlists', role: library.getNode('playlists').role, description: library.getNode('playlists').description});
		
		data.forEach(entry =>
		{
			let playlistId = library.clean(entry['title'], true);
			library.set({node: 'playlists.' + playlistId, role: 'channel', description: 'Playlist ' + entry['title']});
			
			// index all keys as states
			for (let key in entry)
			{
				let node = library.getNode('playlists.' + key.toLowerCase());
				node.key = 'playlists.' + playlistId + '.' + key;
				entry[key] = convertNode(node, entry[key]);
				
				library.set(
					{
						'node': 'playlists.' + playlistId + '.' + key,
						'type': node.type,
						'role': node.role,
						'description': node.description
					},
					entry[key]
				);
			}
			
			// get playlist content
			getItems(entry['key'], 'playlists', 'playlists.' + playlistId);
		});
	})
	.catch(err =>
	{
		adapter.log.debug('Could not retrieve Playlists from Plex!');
		adapter.log.debug(err);
	});
}

/**
 * Retrieve Players from Plex
 *
 */
function getPlayers()
{
	plex.query('/clients').then(res =>
	{
		let data = res.MediaContainer.Server || [];
		adapter.log.debug('Retrieved Players from Plex.');
		data.forEach(player =>
		{
			// group by player
			players.push(player.machineIdentifier);
			let groupBy = library.clean(player.name, true) + '-' + player.machineIdentifier;
			
			// create player
			library.set({node: '_playing', role: 'channel', description: 'Plex Media being played'});
			library.set({node: '_playing.' + groupBy, role: 'channel', description: 'Player ' + player.name});
			
			// add player controls
			library.set({'node': '_playing.' + groupBy + '.Player.localaddress', ...library.getNode('playing.player.localaddress') }, player.address);
			library.set({'node': '_playing.' + groupBy + '.Player.port', ...library.getNode('playing.player.port') }, player.port);
			
			let controls = '_playing.' + groupBy + '._Controls';
			library.set({node: controls, role: 'channel', description: 'Playback & Navigation Controls'});
			//library.set({node: controls + '.remotePlayer', role: 'switch', type: 'boolean', write: true, description: 'Use remote/public instead of local player IP'}, false);
			
			player.protocolCapabilities.split(',').forEach(mode => // e.g. "timeline,playback,navigation,mirror,playqueues"
			{
				if (_ACTIONS[mode] === undefined) return;
				
				library.set({node: controls + '.' + mode, role: 'channel', description: library.ucFirst(mode) + ' Controls'});
				
				let button;
				for (let key in _ACTIONS[mode])
				{
					button = typeof _ACTIONS[mode][key] == 'string' ? { "key": key, "description": _ACTIONS[mode][key] } : _ACTIONS[mode][key];
					
					library.set({
						'node': controls + '.' + mode + '.' + key,
						'description': 'Playback ' + library.ucFirst(button.description),
						
						'role': _ACTIONS[mode][key].role !== undefined ? _ACTIONS[mode][key].role : (_ACTIONS[mode][key].attribute !== undefined || _ACTIONS[mode][key].default !== undefined ? (_ACTIONS[mode][key].values || Number.isInteger(_ACTIONS[mode][key].default) ? 'value' : 'text') : 'button'),
						'type': _ACTIONS[mode][key].type !== undefined ? _ACTIONS[mode][key].type : (_ACTIONS[mode][key].attribute !== undefined || _ACTIONS[mode][key].default !== undefined ? (_ACTIONS[mode][key].values || Number.isInteger(_ACTIONS[mode][key].default) ? 'number' : 'string') : 'boolean'),
						
						'common': {
							'write': true,
							'read': true,
							'states': _ACTIONS[mode][key].values
						},
					}, _ACTIONS[mode][key].default !== undefined ? _ACTIONS[mode][key].default : false);
				}
				
				adapter.subscribeStates(controls + '.' + mode + '.*');
			});
		});
	})
	.catch(err =>
	{
		adapter.log.debug('Could not retrieve Players from Plex!');
		adapter.log.debug(err);
	});
}

/**
 * Start Listener for Events
 *
 */
function startListener()
{
	_http.use(_parser.json());
	_http.use(_parser.urlencoded({ extended: false }));
	
	_http.post('/plex', upload.single('thumb'), (req, res, next) =>
	{
		let payload;
		try
		{
			adapter.log.debug('Incoming data from plex with ip: ' + req.ip.replace('::ffff:', ''))
			payload = JSON.parse(req.body.payload);
			res.sendStatus(200);
			res.end();
			
			// write payload to states
			if (['media.play', 'media.pause', 'media.stop', 'media.resume', 'media.rate', 'media.scrobble'].indexOf(payload.event) > -1)
				setEvent(payload, 'plex', '_playing');
			
			setEvent(payload, 'plex', 'events');
		}
		catch(e) {
			adapter.log.warn(e.message);
			//res.sendStatus(500);
		}
	});
	
	// listen to events from Tautulli
	_http.post('/tautulli', (req, res, next) =>
	{
		let payload;
		try
		{
			adapter.log.debug('Incoming data from tautulli with ip: ' + req.ip.replace('::ffff:', ''))
			payload = req.body;
			res.sendStatus(200);
			res.end();
			
			// write payload to states
			if (['media.play', 'media.pause', 'media.stop', 'media.resume', 'media.rate', 'media.scrobble'].indexOf(payload.event) > -1)
				setEvent(payload, 'tautulli', '_playing');
			
			setEvent(payload, 'tautulli', 'events');
		}
		catch(e) {
			adapter.log.warn('Tautulli notification ' + e.message + ' - check the webhook data configuration page in Tautulli. https://forum.iobroker.net/post/1029571 ');
			//res.sendStatus(500);
		}
	});
	
	_http.listen(adapter.config.webhookPort || 41891, adapter.config.webhookIp);
}

/**
 * Refresh runtime states while media is playing
 */
function refreshViewOffset() {
	if (!unloaded) {
		playingDevice.forEach((player) => {
			let state =  player.prefix + '.Metadata.viewOffset' ;		
			let value = Math.floor((library.getDeviceState(state) + Date.now() - player.start)/1000)
			state += 'Seconds'
			//adapter.log.debug(Math.floor((Date.now() - player.start)/1000))
			library.set(
				{
					'node': state,
					'type': 'number',
					'role': 'media.elapsed',
					'description': 'Last viewing position in seconds(refresh)'
				},
				value
			)
		}) 
	}
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
