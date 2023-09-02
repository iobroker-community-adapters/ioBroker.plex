'use strict';
const axios = require('axios');
const { time } = require('console');

const xml2js = require('xml2js');
const xml = new xml2js.Parser()

const _PLAYERDETAILS = require(__dirname + '/../_PLAYERDETAILS.js')
const Library = require(__dirname + '/library.js');

let players = []
let _Actions, _nodes



/**
 * Player
 *
 * @description Player class get a player obj to handle player events
 * @author ticaki <https://github.com/ticaki/>
 * @license MIT License
 * @version 0.0.1
 * @date 2023-08-27
 *
 */
class Player
{
	static garbageExcluded = ["Player.localAddress", "Player.port", "Player.protocolCapabilities", "Player.controllable"]

	static existPlayer(id = '', prefix = '') {
		let i = -1
		if (id) { 
			i = players.findIndex((p) => p.id.toLowerCase() == id.toLowerCase()) 
		} else { 
			i = players.findIndex((p) => p.prefix.toLowerCase() == prefix.toLowerCase()) 
		}
		return i > -1 ? players[i] : null
	}
	static createPlayerIfNotExist(adapter, options, library) {
		if (!options.controllerIdentifier || !options.config.uuid) {
			throw new Error(`createPlayerIfNotExist called without controller: ${options.controllerIdentifier} or uuid ${options.config.uuid}`)
		} 
		_nodes = options.nodes || {}
		_Actions = options.actions || {}
		//title part of prefix is lowCase
		let prefix = `_playing.${library.clean(`${options.config.title}`,true)}-${options.config.uuid}`
		let id = `${options.controllerIdentifier}-${options.config.uuid}`
		// if player exist dont add a new one
		let player = Player.existPlayer(id)
		if (!player) {
			player = new Player(adapter, {...options, "prefix":prefix, "id":id}, library)
		 	players.push(player)
		}
		return player
	}
	static deletePlayers(cid) {
		players.forEach((p) => {if (p.id.startsWith(cid)) p.delete})
	}

	/**
	 * Constructor.
	 *
	 * @param	{object}	adapter		ioBroker adpater object
	 *
	 */
    constructor(adapter, options = {}, library)
	{
		this._adapter 				= adapter
		this.config 				= options.config || {}
		//prefix is the id for the obj (name-maschineid)
		this.prefix 				= options.prefix
		this.id 					= options.id
		this._library 				= library
		this.controllerIdentifier 	= options.controllerIdentifier
		this.plexToken 				= this._adapter.config.plexToken
		// work to do: config from Adapter and change default to 0
		this.refresh 				= this._adapter.config.playerRefresh && this._adapter.config.playerRefresh > 1 && this._adapter.config.playerRefresh  || 1
		this.details 				= this._library.getDeviceStateJson(`${this.prefix}.Player.details`) || {}
		this.metadata				= this._library.getDeviceStateJson(`${this.prefix}.Metadata`) || {}
		this.protocolCapabilities 	= this._library.getDeviceState(`${this.prefix}.Player.protocolCapabilities`) || 'none'
		this.address 				= this._library.getDeviceState(`${this.prefix}.Player.localAddress`) || ''
		this.port 					= this._library.getDeviceState(`${this.prefix}.Player.port`) || 0
		this.controllable 			= this._library.getDeviceState(`${this.prefix}.Player.controllable`) || false
		this.config.connected		= true
		this.updatedStates			= true
		this.updateTrys				= 0
		this.PLEX_HEADERS 			= { 
				'X-Plex-Token': this.plexToken,
				'X-Plex-Target-Client-Identifier': this.config.uuid,
				"X-Plex-Client-Identifier": this.controllerIdentifier,
				"X-Plex-Device-Name": this.config.title
		}
		this.commandID 				= 0
		this._library.set({node: '_playing', role: 'channel', description: 'Plex Media being played'});
		this._library.set({node: this.prefix, role: 'channel', description: `Player ${this.config.title}`});
		this._adapter.log.debug('create:' +JSON.stringify(this.address))
    }
	
	setNotificationData(data) {
		if (data && typeof data === 'object') {
			
			for (let d in data.Player) if (data.Player[d]==="undefined") delete data.Player[d]
			
			//this._adapter.log.debug(`setNotificationData config object from player ${this.prefix} is ${JSON.stringify(data)}`)
			this.updateStates(this.cleanUpConfig(data.Player))
			//delete data.Player
			this.metadata = data.Metadata
			this.startUpdater()
		}
	}
	setClientData(data) {
		if (data && typeof data === 'object') {
			this._adapter.log.debug(`setClientData config object from player ${this.prefix} is ${JSON.stringify(data)}`)
			this.cleanUpConfig(data)
			this.config.connected = true
			this.config.controllable = true
			this.updateStates(data)
			this.startUpdater()
		}
	}
	
	
	mergeData(target, source)
	{	
		if (!target) return {}
		if (!source) return target
		_mergeData(target, source)

		function _mergeData(target, source) {
			for (let key in target) {
				if (source[key] === undefined) return target
				if (typeof target[key] === 'object' && typeof target[key] === typeof source[key] ) {
					return target[key] = _mergeData(target[key], source[key], result)
				} if (typeof target[key] !== typeof source[key] || target[key] != source[key]) {
					this.updatedStates = true
					target[key] = source[key]
					delete source[key]
				}
			}
			return target
		}
			 
	}

	cleanUpConfig(config) {
		let o = {"config":config}
		o.config.uuid = o.config.machineIdentifier || config.uuid || this.config.uuid
		o.config.title = o.config.title || o.config.name ||this.config.title
		o.address = o.config.address || this.address || this.config.localAddress
		o.port = o.config.port || this.config.port 
		o.config.publicAddress = o.config.remotePublicAddress || o.config.publicAddress || this.config.publicAddress
		delete o.config.address
		delete o.config.machineIdentifier
		delete o.config.remotePublicAddress
		delete o.config.name
		Object.assign(this.config, o.config)
		delete o.config
		for (let l in o) this[l] = o[l]		
	}
	updateStates(data) {
		if (data) Object.assign(this.config, data)
		// for backward compatibility
		this.adress = this.address || this.config.localAddress
		this._library.set({'node': `${this.prefix}.Player.localAddress`, ...this._library.getNode('playing.player.localaddress') }, this.address);
		
		this._library.readData(`${this.prefix}.Player`, this.config, `${this.prefix}`, undefined )
			
		this.updateControls()	
	}
	delete () {
		this._library.runGarbageCollector(this.prefix, true, 1, Player.garbageExcluded)
		if (this.refreshCycle) this._adapter.clearInterval(this.refreshCycle)
		this.config.connected = false
		let i = players.findIndex((p) => p.id == this.id)
		if (i > -1) players.splice(i, 1)
	}

	init() {
		//work to do
		//create Controls
		//create _playing states
	}
	
	startUpdater() {
		// dont restart while running 0 == off 1 >= is running
		if (this.updateTrys > 0) {
			this.updateTrys = 1
			return
		}
		this.updateTrys++
		this.details = this.details || {}
		this._library.set({node: `${this.prefix}.Player.details`, role: 'channel', description: `Detail Player status`}); 
		this._library.set({node: `${this.prefix}.Player.details.music`, role: 'channel', description: `Detail Player Music status`}); 
		this._library.set({node: `${this.prefix}.Player.details.video`, role: 'channel', description: `Detail Player Video status`}); 
		this._library.set({node: `${this.prefix}.Player.details.photo`, role: 'channel', description: `Detail Player Photo status`}); 

		this._adapter.setTimeout(async function _updater(self) {			
			try {				
				await self.updateTimeline()
				//photo dont work in the right way from plex side
				if (self.details.state == 'stopped') throw new Error ('stop')
				// no error so reset counter
				self.updateTrys = 1
			} catch (err){
				if (err.message != 'timeout' && err.message != 'stop') {
					self._adapter.log.error(err)
					
				} else {
				// after x timeouts/errors cancel it
					if (self.updateTrys++ > 2) {
						self.updateTrys = 0
						self.updateStates()
						if (err.message == 'timeout') await self._library.runGarbageCollector(self.prefix, false, 999, [...Player.garbageExcluded, '_Controls','Metadata'])
						return
					}
				}
			}
			self._adapter.setTimeout( _updater, self.refresh * 999, self)				
		}, 500, this)
	}

	async updateTimeline() 
	{	
		//this._adapter.log.debug(`Try to get client details ${this.prefix} - ${this.config.protocolCapabilities} - ${this.address} - ${this.port}`);		
		if (  !this.config.protocolCapabilities 
			|| this.config.protocolCapabilities.indexOf('timeline') == -1 
			|| !this.address 
			|| !this.port ) {
				
				return
			}
		let saveValues = {state: this.details.state, type: this.details.type, metadata: this.details.url}
		let options = {
			'timeout': 900,
			'method': 'GET',
			'url': `http://${this.address}:${this.port}/player/timeline/poll?wait=0&commandID=${this.commandID++}`,
			'headers': {
				...this.PLEX_HEADERS	
			}
		};
		
		this.details = {...this.details, "state": "stopped", "type": "none", "time": 0, "duration": 0, "location": "none", "url": ''}
		// reset this.details from _PLAYERDETAILS
		//for (let t in _PLAYERDETAILS.playerDetails) {
		//	for (let k in _PLAYERDETAILS.playerDetails[t]) this.details[k] = this._library.convertToType('', _PLAYERDETAILS.playerDetails[t][k].type)
		//}		
		this.config.connected = false	
	
		try {
			const res = await axios(options)
			try {
				this.config.connected = true;
				this._adapter.log.debug(`Get client details ${this.prefix} - ${this.config.protocolCapabilities} - ${this.address} - ${this.port}`);		
				const result = await xml.parseStringPromise(res.data)

				let r = result && result.MediaContainer && result.MediaContainer || {}
				
				this.details.location = r.$ && r.$.location || "none"
				
				r = r.Timeline || []
				for (let d in r) {
					if (r[d].$.controllable !== undefined) this.config.controllable = r[d].$.controllable
						//remove this datapoints
					for (let a of ['address','containerKey','guid','machineIdentifier','controllable', 'audioStreamID', 'videoStreamID']){
						delete r[d].$[a]
					} 

					this.details[r[d].$.type] = r[d].$
				}
				r = r.filter((a) => a.$.state != 'stopped')
				if (r.length == 0) this.details.type = 'all'
				else {
					r = r.sort((a,b) => {
						const def = {'photo':1,'musik':2,'video':3, }
						return def[a.$.type] - def[b.$.type]
					})							
					let data = r[0].$
					//this._adapter.log.debug(`Write client updates from ${this.config.title} for ${this.config.title}`)
					Object.keys(this.details).forEach((key) => {
						if (typeof key == 'object') return
						//_PLAYERDETAILS.action
						let node = _PLAYERDETAILS.playerDetails.action[key]
						let val = node && node.type && this._library.convertToType(data[key], node.type)
						if (node) {
							this.details[key] = val
							this._library.confirmNode({node: this.prefix + '._Controls.'+node.node}, val)
						}
						//_PLAYERDETAILS.node
						node = _PLAYERDETAILS.playerDetails.node[key]
						val = node && node.type && this._library.convertToType(data[key], node.type) 
						if (node) {
							this.details[key] = val
							this._library.readData(this.prefix + '.' + node.node, val, this.prefix);
						}
										
					})
					for (let k in this.details) {
						delete this.details[k].type
						let d = this.details[k]
						if (typeof d != 'object') continue
						//photo dont work in the right way from plex side
						if (d.state == 'stopped' || k == 'photo') continue
						this.details.time = d.time || 0
						this.details.duration = d.duration || 0
						this.details.type = k
						this.details.state = d.state
						this.details.url = d.key
						break;
					}
				}
				//this._adapter.log.debug(`Write details updates from ${this.config.title} for ${this.getReadableID()}`)
				this._library.readData(`${this.prefix}.Player.details`, this.details, `${this.prefix}`, undefined, true )		
			} catch(err) {
				this._adapter.log.debug('catch() 121: ' + err)
			}
		} catch(error) {
			let msg = `Player ${this.getReadableID()} is disconnected`
			if (error.response) {
				this._adapter.log.debug("response");
				// The request was made and the server responded with a status code
				// that falls out of the range of 2xx
				this._adapter.log.debug(error.response.data);
				this._adapter.log.debug(error.response.status);
				this._adapter.log.debug(error.response.headers);
			  } else if (error.request) {
				this._adapter.log.debug("request");
				// The request was made but no response was received
				// `error.request` is an instance of XMLHttpRequest in the browser and an instance of
				// http.ClientRequest in node.js
				this._adapter.log.debug(error.request);
			  } else {
				// Something happened in setting up the request that triggered an Error
				this._adapter.log.debug('Error', error.message);
			  }
			  this._adapter.log.debug(error.config);
			  this._adapter.log.debug(msg)
			throw new Error('timeout')
		}
		try {
			if (saveValues.metadata != this.details.url) {
				this.getMetadataUpdate()
				let data = await this._library.getItem(this.details.url)//"/library/metadata/34679"
				data = this.getMetadataSelection(data, _PLAYERDETAILS.deepVal,"")
				//this._adapter.log.debug('expands2:'+ JSON.stringify(data));
				for (let key in data) {
					this._library.readData(this.prefix +'.'+ key, data[key], this.prefix)
				}
				//this._library.readData(this.prefix, data2, this.prefix)
				//this.test() 
				
				//this._adapter.log.debug('test json- --------' + JSON.stringify(data2))
				}
		} catch(err) {this._adapter.log.error(err)}
		try {
			
			if ( saveValues.type != this.details.type 
				|| saveValues.state != this.details.state ) 
			{
					await this._library.runGarbageCollector(this.prefix, false, 1000, [...Player.garbageExcluded, '_Controls','Metadata'])
			}
		} catch(err) {this._adapter.log.error(err)}
		this._adapter.log.debug('Timeline old values:'+ JSON.stringify(saveValues) + ' new:' + JSON.stringify({state:this.details.state, type:this.details.type}));
		
		
	}		

	getReadableID () {
		return `${this.config.title}-${this.config.uuid}`
	}

	updateControls() {
		if (!this.config.controllable) return

		let controls = `${this.prefix}._Controls`;

		this._library.set({node: controls, role: 'channel', description: 'Playback & Navigation Controls'});

		//this._adapter.log.debug(`update Controls ${this.prefix}`);
		this.config.protocolCapabilities.split(',').forEach(mode => // e.g. "timeline,playback,navigation,mirror,playqueues"
		{
			if (_Actions[mode] === undefined) return;
			this._library.set({node: controls + '.' + mode, role: 'channel', description: this._library.ucFirst(mode) + ' Controls'});
			
			let button;
			for (let key in _Actions[mode])
			{
				let newVal = _Actions[mode][key].default !== undefined ? _Actions[mode][key].default : false;
				if (_Actions[mode][key]["convert"] !== undefined) {
					switch(_Actions[mode][key]["convert"]) {
						case "percent":
							newVal = this.details && this.details.duration ? Math.floor(this.details.time / this.details.duration*1000)/10 : 0						
						break 
					}
				}
				button = typeof _Actions[mode][key] == 'string' ? { "key": key, "description": _Actions[mode][key] } : _Actions[mode][key];
				let common = _Actions[mode][key].common || {}
				this._library.set({
					'node': controls + '.' + mode + '.' + key,
					'description': 'Playback ' + this._library.ucFirst(button.description),
					
					'role': _Actions[mode][key].role !== undefined ? _Actions[mode][key].role : (_Actions[mode][key].attribute !== undefined || _Actions[mode][key].default !== undefined ? (_Actions[mode][key].values || Number.isInteger(_Actions[mode][key].default) ? 'value' : 'text') : 'button'),
					'type': _Actions[mode][key].type !== undefined ? _Actions[mode][key].type : (_Actions[mode][key].attribute !== undefined || _Actions[mode][key].default !== undefined ? (_Actions[mode][key].values || Number.isInteger(_Actions[mode][key].default) ? 'number' : 'string') : 'boolean'),
					
					'common': {
						...common,
						'write': true,
						'read': true,
						'states': _Actions[mode][key].values
					},
				}, newVal)
			}
			
			this._adapter.subscribeStates(controls + '.' + mode + '.*');
		});
	}

	/**
	 * 
	 * @param {string} actionVal.mode 			mode see _ACTIONS
	 * @param {string} actionVal.action 		action "    "
	 * @param {any} actionVal.val 				val value of action
	 * @param {string} actionVal.id 			dp of state
	 */
	async action(actionVal) {
		if (_Actions[actionVal.mode] !== undefined && _Actions[actionVal.mode][actionVal.action] !== undefined && this.address && this.port)
		{
			this._adapter.log.info(`Triggered action -${actionVal.action}- on player ${this.getReadableID()} with ip:${this.address}.`);
			
			let newVal = actionVal.val
			let key = _Actions[actionVal.mode][actionVal.action].key || actionVal.action;
			if (_Actions[actionVal.mode][actionVal.action]["true"] !== undefined)
					key = state.val ? _Actions[actionVal.mode][actionVal.action]["true"] : _Actions[actionVal.mode][actionVal.action]["false"]
			if (_Actions[actionVal.mode][actionVal.action]["convert"] !== undefined) {
				switch(_Actions[actionVal.mode][actionVal.action]["convert"]) {
					case "percent":
						newVal = this.details && this.details.duration ? this.details.duration * newVal / 100 : 0
					break 
				}
			}
			let attribute = _Actions[actionVal.mode][actionVal.action].attribute;
			let options = {
				...this._library.AXIOS_OPTIONS,
				'method': 'POST',
				// Dont work for me with https:
				//'url': this._library.AXIOS_OPTIONS._protocol + '//' + playerIp + ':' + playerPort + '/player/' + mode + '/' + key + '?' + (attribute != undefined ? attribute + '=' + val + '&' : ''),
				'url': `http://${this.address}:${this.port}/player/${actionVal.mode}/${key}?${(attribute != undefined ? attribute + '=' + newVal + '&' : '')}`,
				//'url': `http://plex.kiemen.com:32400/player/${actionVal.mode}/${key}?${(attribute != undefined ? attribute + '=' + newVal + '&' : '')}`,
				'headers': {
					...this.PLEX_HEADERS
				}
			};

			try {
				const result = await axios(options)
				this.config.connected = true
				this._adapter.log.debug(`Successfully triggered ${actionVal.mode} action -${actionVal.action}- on player ${this.getReadableID()} with ip:${this.address}.`);
				// confirm commands
				this._library.confirmNode({node: actionVal.id}, actionVal.val)
			} catch(err) {
				this._adapter.log.warn(`Error triggering ${actionVal.mode} action -${actionVal.action}- on player ${this.getReadableID()} with ip:${this.address}.! See debug log for details.`);
				this._adapter.log.debug(err);
			}
			// this._adapter.log.debug(options.url)
		}
		else {
			this._adapter.log.warn(`Error triggering ${actionVal.mode} action -${actionVal.action}- on player ${this.getReadableID()} with ip:${this.address}.! See debug log for details! Action not supported!`);
		}
	}
	
	getMetadataSelection(data, list, k = "", lastData = {})
	{
		let def = JSON.parse(JSON.stringify(list))
		let result = {}
		
		// result is {key: [{node:val}, {node:val}]}
		result = _findData(data, def, k, lastData)
		//this._adapter.log.debug('test1' + JSON.stringify(result))
		let res = {}
		for (let key in result) {
			for (let a in result[key]) {
				for (let n in result[key][a]) {
					let newkey = n.replace('.track.', '.Music.')
					res[newkey] = result[key][a][n]
				}
			}
		}
		//result = this.expandNestedData(result)
		//this._adapter.log.debug('test2' + JSON.stringify(res))
		return res

		function _findData(data, list, k = "", lastData = {}) {
			//list.tracks.list.media.list.parts.list.lyricStreams.list.key
			//list.tracks.list.media.list.parts.list.lyricStreams.list.streamType
			
			if (typeof data === 'object') {
				if (Array.isArray(data)) {
					for (let a in data) {
						_findData(data[a], list, `${k}`, data)
					}
				} else {
					for (let a in data) {
						_findData(data[a], list, k ? `${k}.${a}` : a, data)
					}
				}
			} else {
				if (list[k] !== undefined ) {
					/**
					 * value: if value not data go back
					 * nodes: if nodes then save the data from lastData
					 */
					for (let l of list[k]) {
						if (l.value && l.value != data) continue
						if (l.nodes) {
							let res = {}
							for(let n of l.nodes) {
								res[l.node+n.node] = lastData[n.key]
							}
							result[l.node] = result[l.node] || []
							result[l.node].push(res)	
						} else if (l.call) {
							let nl = {}
							for (let n in l.call) {
								nl[n] = nl[n]||[]
								for (let m in l.call[n]) {
									nl[n].push({"node": `${l.node}${l.valueAsKey ? `.${data}` : ``}${l.call[n][m].node}`, "app":l.call[n][m].app})
								}
							}
							_findData(lastData, nl, k.split('.').slice(0,-1).join('.'))
							
						} else if (l.node) {
							let newKey = l.node + (l.app ? l.app : '')
							result[l.node] = result[l.node] || []
							let res = {}
							res[newKey] = data 
							result[l.node].push(res)	
						}
					}
				}
			}
			return result 
		}
	}
	
	async getMetadataUpdate(sessions) {
		try { 
			//this._adapter.log.debug(await this._library.getItemTest('/status/sessions/0'))
			sessions = await this._library.getItem('/status/sessions')
			//this._adapter.log.debug(JSON.stringify(sessions.Metadata))
			if (!sessions || !sessions.Metadata) return
			for (let s of sessions.Metadata){
				if (s.Player.machineIdentifier === this.config.uuid) {
					this.cleanUpConfig(s.Player)
					delete s.Player
					delete s.Guid
					this.media = s.Media
					s.media === undefined
					this.metadata = s
					//this._adapter.log.debug(`Write client updates from Plex Media Server for ${this.config.title}`)
					this._library.readData(`${this.prefix}.Metadata`, this.metadata, `${this.prefix}`, undefined )
				}
			}
		} catch(err){this._adapter.log.debug('Error 124: '+err)}
	
	}
}
module.exports = Player