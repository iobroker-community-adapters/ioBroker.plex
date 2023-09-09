'use strict';

/**
 * Library
 *
 * @description Library of general functions as well as helping functions handling ioBroker
 * @author Zefau <https://github.com/Zefau/>
 * @license MIT License
 * @version 0.27.1
 * @date 2019-11-17
 *
 */
let newConstant = {}
class Library
{
	static get CONNECTION() {
		return { node: 'info.connection', description: 'Adapter Connection Status', role: 'indicator.connected', type: 'boolean' };
	}
	
	/**
	 * Constructor.
	 *
	 * @param	{object}	adapter		ioBroker adpater object
	 *
	 */
    constructor(adapter, options, plex)
	{
		this.AXIOS_OPTIONS = {}
		
		this._adapter = adapter;
		this.options = options || {};
		
		this._plex = plex
		this._nodes = this.options.nodes || {};
		this._actions = this.options.actions
		this.options.updatesInLog = this.options.updatesInLog || false;
		this.options.updatesExceptions = this.options.updatesExceptions || ['timestamp', 'datetime', 'UTC', 'localtime', 'last_use_date', 'lastSeen'];
		
		this._STATES = {};
		this._SUBCSCRIPT_PLAYING = {}
		
		this.set({ 'node': 'info', 'description': 'Adapter Information', 'role': 'channel' });
		this.set(Library.CONNECTION, false);

		//check nodes for lowercase
		for (let a in this._nodes) if (a != a.toLowerCase()) this._adapter.log.warn(`${a} - ${a.toLowerCase()}`)

    }
	
	/**
	 * Gets a node.
	 *
	 * @param	{string}	node			Node identifier
	 * @return	{object}					Node
	 *
	 */
	getNode(node, lowerCase)
	{
		let result = this._nodes[this.clean(node, lowerCase)] ||
			this._nodes[this.clean(node.replace(RegExp(/\.\d+\./, 'g'), '.'), lowerCase)]
		return JSON.parse(JSON.stringify(
			result ||
			{ 'description': '(no description given)', 'role': 'state', 'type': 'string', 'convert': null, 'notExist': true }
		));
	}
	
	/**
	 * Terminate adapter.
	 *
	 * @param	{string}	[message=Terminating adapter due to error!]			Message to display
	 * @param	{boolean}	[kill=false]										Whether to kill the adapter (red lights) or not (yellow lights)
	 * @param	{integer}	[reason=11]											Reason code for exit
	 * @return	void
	 *
	 */
	terminate(message, kill, reason)
	{
		this.resetStates();
		this.set(Library.CONNECTION, false);
		message = message ? message : 'Terminating adapter due to error!';
		
		// yellow lights
		if (!kill)
			this._adapter.log.warn(message);
		
		// red lights
		else if (kill === true)
		{
			this._adapter.log.error(message);
			
			// delay necessary to actually show the error message
			setTimeout(() => this._adapter && this._adapter.terminate ? this._adapter.terminate(message, reason || 11) : process.exit(reason || 11), 2000);
		}
		
		return false;
	}
	
	/**
	 * Remove specials characters from string.
	 *
	 * @param	{string}	string																												String to proceed
	 * @param	{boolean}	[lowerCase=false]																									If String shall be return in lower case
	 * @param	{string}	[replacement='']																									Characters shall be replaced with this character
	 * @param	{array}		[characters=['<', '>', ' ', ',', ';', '!', '?', '[', ']', '*', '\'', '"', '\\', '&', '^', '$', '(', ')', '/']]		Characters to be removed from string
	 * @return	{string}																														Cleaned String
	 *
	 */
	clean(string, lowerCase, n1, n2)
	{
		if (!string && typeof string != 'string')
			return string;
		if (n1 !== undefined || n2 !== undefined)
			this._adapter.log.warn('library error 101, please create a github issue')
		
		string = string.replace(this._adapter.FORBIDDEN_CHARS, '#')
		
		return lowerCase ? string.toLowerCase() : string;
	}
	replaceDescription(description, a,b) {
		let result = {}
		if (typeof description == 'string') result = description.replace(a, b)
		else for (let obj in description) result[obj] = description[obj].replace(a, b);
		return result;
	}

	appendToDescription(description, app) {
		let result = {}
		if (typeof description == 'string') result = description+app
		else for (let obj in description) result[obj] = description[obj]+app;
		return result;
	}
	/**
	 * set common.type and common.role to predefined values from _NODES.js
	 *
	 * @param	{string}	state		state to extend
	 * @return	void
	 *
	 */
	async extendState(state) {
		// ignore _refresh dp
		if (state.indexOf('._refresh') !== -1) return
		
		let node = undefined
		// _ACTIONS
		if (state.indexOf('._Controls.') !== -1) {
			let appendix = state.substring(state.indexOf('._Controls.') + '._Controls.'.length).split('.')
			if (this._actions[appendix[0]] && this._actions[appendix[0]][appendix[1]] && this._actions[appendix[0]][appendix[1]].type) {
				node = {"type": this._actions[appendix[0]][appendix[1]].type, "role": this._actions[appendix[0]][appendix[1]].role}
			}
		} else {
			// _NODES
			let splitState = state.replace(this._adapter.name + '.' + this._adapter.instance + '.', '').toLowerCase().split('.')
			let prefix = splitState.shift()
			if (prefix == "_playing") {
				prefix = "playing"	
			}
			for (let p of (prefix === 'events' ? ['events','playing'] : [prefix])) {
				prefix = p
				while (0 < splitState.length) {
					let n = prefix + '.' + splitState.join('.')
					node = this.getNode(n)
					if (!node.notExist) {
						break
					}
					splitState.shift()					 
				}
				if (!node.notExist) {
					break
				}
			}
		}
		if (node !== undefined && !node.notExist) { 
			try {	
				await this._adapter.extendObjectAsync(state, {
					common: {
						"type": (node.role !== "device" || node.role !== "channel" ? undefined : node.type), 
						"role": (node.role !== "device" || node.role !== "channel" ? undefined : node.role)
					}
				})
			} catch(error) {
				this._adapter.log.error(error)
			}
		} 
	}
	/**
	 * Waits for a specific time before invoking a callback.
	 *
	 * @param	{number}	time		Time to wait before invoking the callback
	 * @param	{function}	callback	Callback to be invoked
	 * @return	void
	 *
	 */
	wait(time, callback)
	{
		setTimeout(() => callback, time);
	}
	
	/**
	 * Encode a string.
	 *
	 * @param	{string}	key			Key used for encoding
	 * @param	{string}	string		String to encode
	 * @return	{string}				Encoded String
	 *
	 */
	encode(key, string)
	{
		let result = '';
		for (let i = 0; i < string.length; i++)
			result += String.fromCharCode(key[i % key.length].charCodeAt(0) ^ string.charCodeAt(i));
		
		return result;
	}
	
	/**
	 * Decode a string.
	 *
	 * @param	{string}	key			Key used for decoding
	 * @param	{string}	string		String to decode
	 * @return	{string}				Decoded String
	 *
	 */
	decode(key, string)
	{
		return this.encode(key, string);
	}
	
	/**
	 * Get a random key.
	 *
	 * @param	{integer}	length		Length of key
	 * @return	{string}				Key
	 *
	 */
	getKey(length)
	{
		length = length || 8;
		let key = '';
		
		while (key.length < length)
			key += Math.random().toString().substring(2,3) >= 5 ? Math.random().toString(36).substring(2, 4) : Math.random().toString(36).substring(2, 4).toUpperCase();
		
		return key.slice(0, length);
	}
	
	/**
	 * Convert an integer to IP.
	 *
	 * @param	{integer}	number		Number to be converted to IP address
	 * @return	{string}				Converted IP address
	 *
	 */
	getIP(number)
	{
		let ip = [];
		ip.push(number & 255);
		ip.push((number >> 8) & 255);
		ip.push((number >> 16) & 255);
		ip.push((number >> 24) & 255);
		
		ip.reverse();
		return ip.join('.');
	}
	
	/**
	 * Sends a message to another adapter.
	 *
	 * @param	{string}	receiver	
	 * @param	{string}	command		
	 * @param	{*}			message		Message to send to receiver, shall be an object and will be converted to such if another is given
	 * @param	{function}	(optional)	Callback
	 * @return	void
	 *
	 */
	msg(receiver, command, message, callback)
	{
		this._adapter.sendTo(
			receiver,
			command,
			typeof message !== 'object' ? {message: message} : message,
			callback === undefined ? function() {} : callback
		);
	}
	
	/**
	 * Capitalize first letter of a string
	 *
	 * @param	{string}	str			String to capitalize
	 * @return	{string}
	 *
	 */
	ucFirst(str)
	{
		return str.charAt(0).toUpperCase() + str.slice(1);
	}
	
	/**
	 * Convert a date to timestamp.
	 *
	 * @param	{date}		date		Datetime to parse
	 * @return	{integer}					parsed Timestamp
	 *
	 */
	getTimestamp(date)
	{
		if (date === undefined || !date)
			return 0;
		
		let ts = new Date(date).getTime();
		return isNaN(ts) ? 0 : ts;
	}

	/**
	 * Convert a timestamp to datetime.
	 *
	 * @param	{integer}	ts			Timestamp to be converted to date-time format (in ms)
	 * @return	{string}				Timestamp in date-time format
	 *
	 */
	getDateTime(ts)
	{
		if (ts === undefined || ts <= 0 || ts == '')
			return '';
		
		let date    = new Date(ts);
		let day     = '0' + date.getDate();
		let month   = '0' + (date.getMonth() + 1);
		let year    = date.getFullYear();
		let hours   = '0' + date.getHours();
		let minutes = '0' + date.getMinutes();
		let seconds = '0' + date.getSeconds();
		return day.slice(-2) + '.' + month.slice(-2) + '.' + year + ' ' + hours.slice(-2) + ':' + minutes.slice(-2) + ':' + seconds.slice(-2);
	}

	/**
	 * Get all instances of an adapter.
	 *
	 * @param	{string}	adapter		Adapter to get instances of
	 * @param	{function}	callback	Callback to invoke
	 * @return	void
	 *
	 */
	getAdapterInstances(adapter, callback)
	{
		this._adapter.objects.getObjectView('system', 'instance', { 'startkey': 'system.adapter.' + adapter + '.', 'endkey': 'system.adapter.' + adapter + '.\u9999'}, (err, instances) =>
		{
			if (instances && instances.rows)
			{
				let result = [];
				instances.rows.forEach(instance => result.push({ 'id': instance.id.replace('system.adapter.', ''), 'config': instance.value.native.type }));
				callback(null, result);
			}
			else
				callback('Could not retrieve ' + adapter + ' instances!');
		});
	}

	/**
	 * Run Garbage Collector and delete outdated states / objects.
	 *
	 * @param	{object}	state					Selected state
	 * @param	{number}	[ts=null]				Objects older than this timespan will be deleted (in milliseconds)
	 * @param	{boolean}	[del=true]				Whether to delete the object (or only empty its value)
	 * @param	{number}	[offset=60]				Offset for the timespan in seconds
	 * @return	void
	 *
	 */
	runGarbageCollector = async(state, del = false, offset = 60000, whitelist = []) =>
	{
		this._adapter.log.debug('Running Garbage Collector for ' + state + '...');
		return new Promise((resolve, reject) => 
		{ 
			this._adapter.getStates(state + '.*', async (err, states) =>
			{
				try
				{
					if (err || !states) resolve(false);
					
					// loop through states
					let key;
					for (let state in states)
					{
						key = state.replace(this._adapter.name + '.' + this._adapter.instance + '.', '');
						
						if (this._STATES[key] && this._STATES[key].ts < Date.now()-offset && !(whitelist.length > 0 && RegExp(whitelist.join('|')).test(state)))
						{
							// apply deletion
							this._adapter.log.debug('Garbage Collector: ' + (del ? 'Deleted ' : 'Emptied ') + state + '!');
							
							if (del)
							{
								try {
									this._STATES[key] = undefined;
									await this._adapter.delObjectAsync(state);
								} catch (error) { this._adapter.log.warn(JSON.stringify(error))}
							}
							else {
								try {
									const val = await this._adapter.getObjectAsync(key)
									let emptyVal
									switch (val.common.type) {
										case 'string':
											emptyVal = ''
										break
										case 'number':
											emptyVal = 0
										break
										case 'boolean':
											emptyVal = false
										break
										default:
											emptyVal = null

									}
									this._setValue(key, emptyVal, { 'force': true });
								} catch (error) { this._adapter.log.warn(error)}
							}
						}
					}
				} catch(error) { this._adapter.log.warn('error 123' + error)}

				return resolve(true); 
			})
		})
	}
	
	/**
	 * Get a device state.
	 *
	 *
	 */
	getDeviceState(state, property = 'val')
	{
		return this._STATES[state] !== undefined && this._STATES[state] ? (this._STATES[state][property] || false) : null;
	}

	/**
	 * Get a device state json, to read last state after restart.
	 *
	 *
	 */
	getDeviceStateJson(state, property = 'val')
	{
		let result = {}
		for (let id in this._STATES) {
			if (id.startsWith(`${state}.`)) {
				let val = this._STATES[id] !== undefined && this._STATES[id] ? (this._STATES[id][property] || false) : null; 
				Object.assign(result, _helper(result, id.replace(`${state}.`,'').split('.'), val) )
			}
		}
		return result
		function _helper(res, key, val, deep=0) {
			if (key.length > 1) {
				let k = key.splice(0,1)	
				res[k] = res[k] || {}	
				try { Object.assign(res[k], _helper(res[k], key, val, deep + 1) )}
				catch(error){
					res[k] = res[k] || {}	
				}						
			} else {
				if (key == '_data') 
							res = JSON.parse(val)
				else if (deep == 0) res[key] = val
			}
			return res 
		}
	}
	
	/**
	 * Set a device state.
	 *
	 *
	 */
	setDeviceState(state, value)
	{
		if ((this._STATES[state] === null || this._STATES[state] === undefined || this._STATES[state].val != value) &&
				this._adapter && this._adapter.log && (
					(this.options.updatesInLog && !this.options.updatesExceptions) ||
					(this.options.updatesInLog && this.options.updatesExceptions && Array.isArray(this.options.updatesExceptions) && this.options.updatesExceptions.indexOf(state.slice(state.lastIndexOf('.')+1)) == -1)
		))
			this._adapter.log.debug('Updated state ' + state + ' to value ' + value + ' (from ' + (this._STATES[state] && this._STATES[state].val) + ').');
		
		
		return this.setDeviceProperties(state, {
			'val': value
		});
	}
	
	/**
	 * Set a device properties.
	 *
	 *
	 */
	setDeviceProperties(state, properties)
	{
		let oldval = this._STATES[state] && this._STATES[state].val
		this._STATES[state] = { ...this._STATES[state] || {}, ...properties || {}, 'ts': Date.now() };
		this.checkSubscribeNode(state, this._STATES[state].val, oldval )
		return true;
	}

	checkSubscribeNode(state, val, oldval) {
		if (!state || this._STATES[state] === undefined || !state.startsWith('_playing') || state.indexOf('_recent') !== -1) return false

		// player name can have dots and - so split at name-uuid and remove _playing.name, then uuid		
		let node = state.split('-').pop().split('.').slice(1).join('.')
		let lowNode = node.toLowerCase()
		if (oldval != val && this._SUBCSCRIPT_PLAYING[lowNode] !== undefined) {
			let prefix = state.replace('.'+node)
			this._SUBCSCRIPT_PLAYING[lowNode](state, prefix, val, oldval)
			this._adapter.log.debug('Internal subscripted node:'+lowNode+' state: '+state+' change from: ' + oldval + ' to: ' + val)
			return true
		}
		return false
	}

	subscribeNode(node, callback) {
		if (node && this._SUBCSCRIPT_PLAYING[node] !== undefined) {
			if (callback !== undefined && typeof callback == 'function') {
				this._SUBCSCRIPT_PLAYING[node] = callback
			} else {
				delete this._SUBCSCRIPT_PLAYING[node]
			}
		}
	}
	
	/**
	 * Deletes a state / object.
	 *
	 * @param	{string}	state			State to be deleted
	 * @param	{boolean}	[nested=false]	Whether to delete nested states as well
	 * @param	{function}	[callback]		Callback to be invoked once finished deleting all states
	 * @return	void
	 *
	 */
	del(state, nested, callback)
	{
		let that = this;
		
		// create state to have at least one deletion (in case no states exist at all)
		this._createNode({ 'node': state, 'description': 'DELETED' }, () =>
		{
			// get state tree
			that._adapter.getStates(nested ? state + '.*' : state, (err, objects) =>
			{
				let deleted = 0;
				objects = Object.keys(objects);
				objects.push(state);
				
				that._adapter.log.silly('Found ' + objects.length + ' objects in state ' + state + ' to delete..');
				objects.forEach(object =>
				{
					that._adapter.delObject(object, err =>
					{
						that._STATES[object.replace(that._adapter.namespace + '.', '')] = undefined;
						deleted++;
						
						if (deleted == objects.length)
						{
							that._adapter.log.debug('Deleted state ' + state + ' with ' + deleted + ' objects.');
							callback && callback();
						}
					});
				});
			});
		});
	}

	/**
	 * Set multiple values and create the necessary nodes for it in case they are missing.
	 *
	 * @param	{object}	values
	 * @param	{object}	nodes
	 * @param	{object}	options
	 * @return	void
	 *
	 */
	setMultiple(nodes, values, options = {})
	{
		for (let key in values)
		{
			if (nodes[key] && nodes[key].node && nodes[key].description)
			{
				let node = nodes[key];
				let value = values[key];
				
				// replace options if given
				options.placeholders = options.placeholders || {};
				for (let placeholder in options.placeholders)
				{
					node.node = node.node.replace(placeholder, options.placeholders[placeholder]);
					node.description = node.description.replace(placeholder, options.placeholders[placeholder]);
				}
				
				// convert data if necessary
				switch(node.convert)
				{
					case "string":
						if (value && Array.isArray(value))
							value = value.join(', '); 
						break;
						
					case "datetime":
						this.set({node: node.node + 'Datetime', description: node.description.replace('Timestamp', 'Date-Time'), common: {"type": "string", "role": "text"}}, value ? this.getDateTime(value * 1000) : '');
						break;
				} 
				
				// set node
				this.set(node, value, options);
			}
		}
	}
	/**
	 * confirm an exist node
	 * 
	 * @param {object} 	node 		node object
	 * @param {string} 	node.node 	Node (= state) to set the value
	 * @param {any}  	value 		Value to set 
	 * @returns void
	 */
	confirmNode(node, value) {
		
		if (!node || node.node === undefined || this._STATES[node.node] === undefined) {
			this._adapter.log.debug('confimNode node.node not exist: ' + (node ? node.node : 'node undefined'))
			return
		}
		this._setValue(node.node, value, {"force": true})
	}

	/**
	 * Set a value and create the necessary nodes for it in case it is missing.
	 *
	 * @param	{object}	node					
	 * @param	{string}	node.node				Node (= state) to set the value (and create in case it does not exist)
	 * @param	{string}	node.description		Description of the node (in case it will be created)
	 * @param	{string}	node.role				Role of the node (in case it will be created)
	 * @param	{string}	node.type				Type of the node (in case it will be created)
	 * @param	{object}	node.native	???			Native Details of the node (in case it will be created)
	 * @param	{any}		value					Value to set (in any case)
	 * @param	{object}	[options={}]			Additional options
	 * @return	void
	 *
	 */
	set(node, value, options = {})
	{
		// catch error
		if (!node || !node.node || (node.name === undefined && node.description === undefined))
			this._adapter.log.error('Error: State not properly defined (' + JSON.stringify(node) + ')!');
		
		
		// create node
		if (this._STATES[node.node] === undefined) {
			// Do not create empty states - only states with value make sense
			if (value !== '' || node.role == 'channel') this._createNode(node, () => this.set(node, value, options));
		} 
		else { // set value
			// dont write to device or channel
			if (node.role == 'device' || node.role == 'channel') return
			
			//datatypes change between number and string and bool depend on source
			let type = node.common && node.common.type || node.type  || 'string'
			value = this.convertToType(value, type)
			this._setValue(node.node, value, options);
		}
	}
	
	/**
	 * Creates an object (channel or state).
	 *
	 * @param	{object}	node					
	 * @param	{string}	node.node				Node (= state) to set the value (and create in case it does not exist)
	 * @param	{string}	node.description		Description of the node (in case it will be created)
	 * @param	{object}	node.common				Common Details of the node (in case it will be created)
	 * @param	{string}	node.common.role		Role of the node (in case it will be created)
	 * @param	{string}	node.common.type		Type of the node (in case it will be created)
	 * @param	{object}	node.native				Native Details of the node (in case it will be created)
	 * @param	{function}	callback				Callback function to be invoked
	 * @return	void
	 *
	 */
	_createNode(node, callback)
	{
		if (!this._adapter)
			return Promise.reject('Adapter not defined!');
		
		// remap properties to common
		let type = node.role == 'device' || node.role == 'channel' ? (node.role == 'device' ? 'device' : 'channel') : 'state';
		let common = {
			'name': node.name || node.description,
			'role': node.common && node.common.role || node.role || 'state',
			'type': node.common && node.common.type || node.type || 'string',
			'write': false,
			...node.common || {}
		};
		
		// special roles
		if (common.role.indexOf('button') > -1)
			common = { ...common, 'type': 'boolean', 'read': false, 'write': true };
		
		if (common.role == 'device' || common.role == 'channel')
			common = { ...common, 'type': undefined, 'role': undefined };
		
		// create object
		this._adapter.setObjectNotExists(
			node.node,
			{
				'common': common,
				'type': type,
				'native': node.native || {}
			},
			(err, obj) =>
			{
				this._STATES[node.node] = null;
				callback && callback();
			}
		);
	}
/**
 * Convert a value to the given type
 * @param {string|boolean|number} value 	then value to convert
 * @param {string} type 					the target type
 * @returns 
 */
	convertToType(value, type) 
	{
		if (type === undefined) return value
		if (value === undefined) value = ''
		let old_type = typeof value
	
		let newValue = value
		try {
			if (type !== old_type)
			{
				switch (type) 
				{
					case 'string':
						newValue = value.toString() || ''
						break
					case 'number':
						newValue = value ? Number(value) : 0
						break
					case 'boolean':
						newValue = !!value
						break
				}
			}
		} catch(error) {
			// get a warning message when we try to convert a object/array.
			this._adapter.log.warn('State has wrong common.typ:' + type + ' should be:'+ old_type)
			return value
		}
		return newValue
	}
	/**
	 * Sets a value of a state.
	 *
	 * @param	{string}	state					State the value shall be set
	 * @param	{string}	value					Value to be set
	 * @param	{object}	[options={}]			Additional options
	 * @param	{boolean}	[options.force=false]	Force to set value
	 * @return	void
	 *
	 */
	async _setValue(state, value, options = {})
	{
		if (state !== undefined)
		{
			try {
				if (value !== undefined && (options.force || this._STATES[state] === undefined || this._STATES[state] === null || this._STATES[state].val != value))
				{
					//if (state.indexOf('viewOffsethu') != -1) this._adapter.log.debug(`Write new Value ${value} to ${state}`)
					await this._adapter.setStateAsync(state, { val: (typeof value === 'object' ? JSON.stringify(value) : value), ts: Date.now(), ack: true });
					this.setDeviceState(state, value);				
				}
				else
					this.setDeviceProperties(state);
				
			} catch(error) {
				//nothing
			}
		} 
	}

	/**
	 * Reset all states.
	 *
	 * @param	void
	 * @return	void
	 *
	 */
	resetStates()
	{
		this._STATES = {};
	}
	
	/**
 * Read and write data received from event
 * @param {boolean} expandNestedData if true expand json objects
 */
	readData(key, data, prefix, properties, expandNestedData = false)
	{
		// only proceed if data is given
		if (data === undefined || data === 'undefined')
			return false;
		
		// get node details
		let nodeKey = key
		nodeKey = nodeKey.replace(/\[0-9]{3}\./gi,'.')	
		nodeKey = nodeKey.search(/\.[0-9]{3}/gi) != -1 && nodeKey.replace(/\.[0-9]{3}/gi,'') + '.list' || nodeKey
		
		nodeKey = nodeKey.indexOf('_playing') > -1 ? 'playing' + nodeKey.substr(nodeKey.indexOf('.', prefix.length)) : nodeKey
		
		let node = this.getNode(nodeKey, true);
		
 		if (node.notExist && prefix == 'events') {
			nodeKey = nodeKey.replace(/^events\./gi, "playing.")
			node = this.getNode(nodeKey, true);
		}
		if (node.notExist) {
			/*let testKey = nodeKey.replace(/^events\./gi, "");
			testKey = nodeKey.replace(/\.Metad\./gi, "")
			newConstant[nodeKey] = {
				"type": typeof (data) == 'object' ? undefined : typeof (data),
				"func": (['mediaurl', 'url'].indexOf((nodeKey.split('.').slice(-1))[0].toLowerCase()) != -1) ? "convert-link-only" : undefined,
				"role": (typeof (data) == 'object' ? 'channel' : ((nodeKey.split('.').slice(-1))[0].toLowerCase() == 'mediaurl') ? "media.url" : 
						((nodeKey.split('.').slice(-1))[0].toLowerCase() == 'url') ? "url" : "value"),
				"description": ""
			}
			for (let d in newConstant) if (newConstant[d] == undefined) delete newConstant[d]*/
		}
		// loop nested data
		if (typeof data == 'object')
		{
			// flatten nested data in one state (tag or name)
			if (Array.isArray(data) && !this._adapter.config.getMetadataTrees)
			{
				if (data.length)
				{
					this.set(
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
			if (Object.keys(data).length > 0 && (key.indexOf('Tree') === -1 || (key.indexOf('Tree') > -1 && this._adapter.config.getMetadataTrees)))
			{
				// channel
				this.set(
					{
						'node': key,
						'role': 'channel',
						'description': RegExp('\.[0-9]{3}$').test(key.substr(-4)) ? 'Index ' + key.substr(key.lastIndexOf('.')+1) : this.ucFirst(key.substr(key.lastIndexOf('.')+1).replace('Tree', '')) + ' Information'
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
						if ((typeof data[nestedKey] == 'object' && (!Array.isArray(data[nestedKey]) || (Array.isArray(data[nestedKey]) && this._adapter.config.getMetadataTrees))) && !expandNestedData)
						{
							this.set({
								'node': key + '.' + (Array.isArray(data[nestedKey]) ? nestedKey + 'Tree' : indexKey) + '._data',
								'role': this.getNode('_data').role,
								'type': this.getNode('_data').type,
								'description': this.getNode('_data').description
							}, 
							JSON.stringify(data[nestedKey]), properties);
						}
						
						this.readData(key + '.' + indexKey, data[nestedKey], prefix, undefined, expandNestedData);
					}
				}
			}
		}
		
		// write to states
		else
		{
			// convert data
			node.key = key;
			node.nodeKey = nodeKey
			data = this.convertNode(node, data);
		
			// set data
			this.set(
				{
					'node': key,
					'type': node.type,
					'role': node.role,
					'description': node.description,
					'common': node.common != undefined ? node.common : undefined
				},
				data,
				properties
			);
		}
	}

	

	/** Read data and search for keys give them back
	 * 
	 * @param {string} key 			key of node
	 * @param {json} data 			data of current tree
	 * @param {json} lastData 		parent of current data
	 * @param {json} result 		result json extended
	 * @param {json} nodes 			definition of Nodes
	 * @param {boolean} ifNode 		indicator that node must have a if part 
	 * @returns {json} result
	 */
	readSpecialData(key, data, lastData, result = {}, nodes, ifNode=false) {
		if (typeof data === 'object') {
			if (Array.isArray(data)) {
				for (const a in data) {
					result = readSpecialData(`${key}.list`, data[a], data, result, nodes )
				}
			} else {
				for (const a in data) {
					result = readSpecialData(key && `${key}.${a}` || a, data[a], data, result, nodes)
				}
			}
		} else {
			if (nodes[key]) {
				if (!ifNode && nodes[key].val == data) { 
					result[key] = result[key] || []
					result = {...result, [key]:[...result[key], data]}
					key = key.split('.').slice(0,-1).join('.')
					readSpecialData(`${key}`, data[a], lastData, result, nodes[key], true )
				} else if (!nodes[key].if || !!nodes[key].if == ifNode) {
					result[key] = result[key] || []
					result = {...result, [key]:[...result[key], data]}
				}
			}
		}
		return result
	}
	/**
 *
 *
 */
	convertNode(node, data)
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
				
				this.set(
					{
						'node': node.key + 'Date',
						'type': 'string',
						'role': 'text',
						'description': this.getNode(node.nodeKey+'Date',true).description
					},
					date
				);
				break;
			case "seconds-readable":
				let d = new Date(Number(data))
				let value = d.getHours()-1 > 0 ? (d.getHours()-1).toString() : '' 
				value += value ? ':'+('0'+d.getMinutes()).slice(-2) : d.getMinutes().toString() + ':' + ('0'+d.getSeconds().toString()).slice(-2)
				this.set(
					{
						'node': node.key + 'human',
						'type': 'string',
						'role': 'text',
						'description': this.getNode(node.nodeKey+'human',true).description
					},
					value
				)
				this.set(
					{
						'node': node.key + 'Seconds',
						'type': 'number',
						'role': 'media.elapsed',
						'description': this.getNode(node.nodeKey+'Seconds',true).description

					},
					Math.floor(Number(data)/1000)
				)
				break;
			
			case "ms-min":
				let duration = data/1000;
				this.set(
					{
						'node': node.key + 'Seconds',
						'type': 'number',
						'role': 'media.duration',
						'description': this.getNode(node.nodeKey+'Seconds',true).description
					},
					duration < 1 ? data * 60 : Math.floor(duration)
				)
				return duration < 1 ? data : Math.floor(duration/60);
				break;
			case "create-link":
			case "create-link-only":
				let link = data ? (this.AXIOS_OPTIONS._protocol + '//' + this._adapter.config.plexIp + ':' + this._adapter.config.plexPort + '' + data + '?X-Plex-Token=' + this._adapter.config.plexToken) : ''
				if (node.convert.func == 'create-link-only') {
					return link
				}
				this.set(
					{
						'node': node.key + node.convert.key,
						'type': node.convert.type,
						'role': node.convert.role,
						'description': this.getNode(node.nodeKey+node.convert.key,true).description
					},
					link
				)
				break;
		}
		
		return data;
	}
	getItem(item)//"/library/metadata/34679"
	{ 
	
		if (!item || typeof item !== 'string') return		
		//this._adapter.log.debug(`Retrieved Libary details for ${item} from Plex.`)
		
		return new Promise((resolve, reject) => 
		{
			this._plex.query(item).then(function (result) {
				if (!result || !result.MediaContainer) return resolve({})
				return resolve(result.MediaContainer);
			
			}, function (err) {
				return reject(err);
			});
		})
	}
	static cloneObj(obj) {
		return JSON.parse(JSON.stringify(obj))
	}
}

module.exports = Library;
