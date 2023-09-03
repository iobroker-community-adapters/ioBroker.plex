'use strict';
const axios = require('axios');

const xml2js = require('xml2js');
const xml = new xml2js.Parser()

const _PLAYERDETAILS = require(__dirname + '/../_PLAYERDETAILS.js')


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
class Controller
{
	/**
	 * Constructor.
	 *
	 * @param	{object}	adapter		ioBroker adpater object
	 *
	 */
    constructor(adapter, options = {}, library)
	{
		this.players 				= []
		this._adapter 				= adapter 
		this.controllerIdentifier 	= options.controllerIdentifier
		this.plexToken			  	= this.plexToken
		this._actions				= options.actions || {}
		this._nodes					= options.nodes   || {}
		this._library				= library
	}
	static garbageExcluded = ["Player.localAddress", "Player.port", "Player.protocolCapabilities", "Player.controllable"]

	existPlayer(prefix = '') { 
		let	i = this.players.findIndex((p) => p.prefix.toLowerCase() == prefix.toLowerCase()) 
		return i > -1 ? this.players[i] : null
	}

	createPlayerIfNotExist(options) {
		if (!options.config.title || !options.config.uuid) {
			throw new Error(`createPlayerIfNotExist called without title: ${options.config.title} or uuid ${options.config.uuid}`)
		} 
		let controller 		= this
		let prefix 			= `_playing.${this._library.clean(`${options.config.title}`,true)}-${options.config.uuid}`
		let player 			= this.existPlayer(prefix)
		if (!player) {
			player = new Player({...options, "prefix":prefix}, controller)
		 	this.players.push(player)
		}
		return player
	}
	delete() {
		this.players.forEach((p) => {
			p.delete
		})
		this.players = null
	}
}

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
	/**
	 * Constructor.
	 *
	 * @param	{object}	adapter		ioBroker adpater object
	 *
	 */
    constructor(options = {}, controller)
	{
		this.unload = false;
		this._controller 			= controller
		this.config 				= options.config || {}
		//prefix is the id for the obj (name-maschineid)
		this.prefix 				= options.prefix
		// work to do: config from Adapter and change default to 0
		this.refresh 				= this._controller._adapter.config.playerRefresh && this._controller._adapter.config.playerRefresh > 1 && this._controller._adapter.config.playerRefresh  || 1
		this.details 				= this._controller._library.getDeviceStateJson(`${this.prefix}.Player.details`) || {}
		//this.metadata				= this._controller._library.getDeviceStateJson(`${this.prefix}.Metadata`) || {}
		this.protocolCapabilities 	= this._controller._library.getDeviceState(`${this.prefix}.Player.protocolCapabilities`) || 'none'
		this.address 				= this.adress || this._controller._library.getDeviceState(`${this.prefix}.Player.localAddress`) || ''
		this.port 					= this.port || this._controller._library.getDeviceState(`${this.prefix}.Player.port`) || 0
		this.config.controllable 	= !!this._controller._library.getDeviceState(`${this.prefix}.Player.controllable`) 
		this.refreshDetails 		= !!this._controller._library.getDeviceState(`${this.prefix}._Controls.timeline.refreshDetails`) || true
		
		this.config.connected		= true
		this.updatedStates			= true
		this.updateTrys				= 0
		this.PLEX_HEADERS 			= { 
				'X-Plex-Token': this._controller._adapter.config.plexToken,
				'X-Plex-Target-Client-Identifier': this.config.uuid,
				"X-Plex-Client-Identifier": this._controller.controllerIdentifier,
				"X-Plex-Device-Name": this.config.title
		}
		this.commandID 				= 0
		this._controller._library.set({node: '_playing', role: 'channel', description: 'Plex Media being played'});
		this._controller._library.set({node: this.prefix, role: 'channel', description: `Player ${this.config.title}`});
		this._controller._adapter.log.debug(`Create player with prefix "${this.prefix}", localAdress "${this.address || `no ip`}" and port "${this.port || `no port`}"`)
		this._controller._adapter.setTimeout((self) => {self.setControls();self.startUpdater()},200,this)
    }
	
	setNotificationData(data) {
		if (data && typeof data === 'object') {
			
			for (let d in data.Player) if (data.Player[d]==="undefined") delete data.Player[d]
			//this._controller._adapter.log.debug(`setNotificationData config object from player ${this.prefix} is ${JSON.stringify(data)}`)
			this.updateStates(this.cleanUpConfig(data.Player))
			data = this.cleanUpMetadata(data)
			if (!this.refreshDetails) {
				Object.keys({	
						"play_switch": data.event && ['media.play', 'media.resume'].indexOf(data.event) > -1 || false
					}).forEach((key) => {
					//_PLAYERDETAILS.action
					let node = _PLAYERDETAILS.playerDetails.action[key]
					let val = node && node.type && this._controller._library.convertToType(this.details[key], node.type)
					if (node) {
						val = node.values !== undefined ? node.values.indexOf(val) > -1 : val
						if (!node.notDetails) this.details[key] = val
						this._controller._library.confirmNode({node: this.prefix + '._Controls.'+node.node}, val)
					}		
				})
			}
			for (let key in data) this._controller._library.readData(`${this.prefix}.${key}`, data[key], this.prefix)
			//this.metadata = data.Metadata
			if (!this.config.controllable) this.setControls()
			this.startUpdater()
			
		}
	}
	cleanUpMetadata(data, ca = false) {
		data = ca && {"Metadata": data} || data
		delete data.Player
		if (data.Metadata) {
			delete data.Metadata.Guid
			if (data.Metadata.stream) {
				delete data.Metadata.stream.player
			}
		}
		return ca && data.Metadata || data
	}

	setClientData(data) {
		if (data && typeof data === 'object') {
			this._controller._adapter.log.debug(`setClientData config object from player ${this.prefix} is ${JSON.stringify(data)}`)
			this.cleanUpConfig(data)
			this.config.connected = true
			this.updateStates(data)
			if (!this.config.controllable) this.setControls()
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
		this._controller._library.set({'node': `${this.prefix}.Player.localAddress`, ...this._controller._library.getNode('playing.player.localaddress') }, this.address);
		this._controller._library.readData(`${this.prefix}.Player`, this.config, `${this.prefix}`, undefined )			
		this.setControls()	
	}

	delete() {
		this.unload = true;
		this._controller._library.runGarbageCollector(this.prefix, true, 1, Controller.garbageExcluded)
		if (this.refreshTimeout) this._controller._adapter.clearTimeout(this.refreshTimeout)
		this.config.connected = false
	}

	init() {
		//work to do
		//create Controls
		//create _playing states
	}
	
	startUpdater() {
		// dont start
		if (!this.refreshDetails) return
		// dont restart while running 0 == off 1 >= is running
		if (this.updateTrys > 0) {
			this.updateTrys = 1
			return
		}
		this.updateTrys++
		this.details = this.details || {}
		this._controller._library.set({node: `${this.prefix}.Player.details`, role: 'channel', description: `Detail Player status`}); 
		this._controller._library.set({node: `${this.prefix}.Player.details.music`, role: 'channel', description: `Detail Player Music status`}); 
		this._controller._library.set({node: `${this.prefix}.Player.details.video`, role: 'channel', description: `Detail Player Video status`}); 
		this._controller._library.set({node: `${this.prefix}.Player.details.photo`, role: 'channel', description: `Detail Player Photo status`}); 

		this.refreshTimeout = this._controller._adapter.setTimeout(async function _updater(self) {			
			try {
				// end this	
				if (!self.refreshDetails || self.unload) return			
				await self.updateTimeline()
				//photo dont work in the right way from plex side
				if (self.details.state == 'stopped' || self.unload) throw new Error ('stop')
				// no error so reset counter
				self.updateTrys = 1
				self.setControls()
				self.latelyActionCall = ''
			} catch (error){
				self.latelyActionCall = ''
				if (error.message != 'timeout' && error.message != 'stop') {
					self._adapter.log.error(`Error 114: ${error.message} `)
					return
				} else {
				// after x timeouts/errors cancel it
					if (self.updateTrys++ > 2) {
						self.updateTrys = 0
						self.updateStates()
						self.setControls()
						if (error.message == 'timeout') {
							self._adapter.log.info(`Player ${self.getReadableID()} is disconnected`)
							await self._library.runGarbageCollector(self.prefix, false, 999, [...Controller.garbageExcluded, '_Controls','Metadata'])
						} else if ( error.message == 'stop') {
							//do nothing just end interval
						} 
						return
					}
				}
			}
			self.refreshTimeout = self._controller._adapter.setTimeout( _updater, self.refresh * 950, self)				
		}, 1000, this)
	}

	async updateTimeline() 
	{	
		//this._controller._adapter.log.debug(`Try to get client details ${this.prefix} - ${this.config.protocolCapabilities} - ${this.address} - ${this.port}`);		
		if (  !this.config.protocolCapabilities 
			|| this.config.protocolCapabilities.indexOf('timeline') == -1 
			|| !this.address 
			|| !this.port ) {
				
				return
			}
		let saveValues = {state: this.details.state, type: this.details.type, metadata: this.details.url}
		let options = {
			'timeout': 700,
			'method': 'GET',
			'url': `http://${this.address}:${this.port}/player/timeline/poll?wait=0&commandID=${this.commandID++}`,
			'headers': {
				...this.PLEX_HEADERS	
			}
		};
		
		this.details = {...this.details, "state": "stopped", "type": "none", "time": 0, "duration": 0, "location": "none", "url": '', "percent": 0}
			
		this.config.connected = false	
	
		try {
			const res = await axios(options)
			try {
				this.config.connected = true;
				this._controller._adapter.log.debug(`Get client details ${this.prefix} - ${this.config.protocolCapabilities} - ${this.address} - ${this.port}`);		
				const result = await xml.parseStringPromise(res.data)

				let r = result && result.MediaContainer && result.MediaContainer || {}
				
				this.details.location = r.$ && r.$.location || "none"
				
				r = r.Timeline || []
				for (let d in r) {
					//if (r[d].$.controllable !== undefined) this.config.controllable = r[d].$.controllable
						//remove this datapoints
					for (let a of ['address','containerKey','guid','machineIdentifier', 'audioStreamID', 'videoStreamID']){
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
					//this._controller._adapter.log.debug(`Write client updates from ${this.config.title} for ${this.config.title}`)
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
						this.details.volume = d.volume || 0
						this.details.percent = this.details.duration ? Math.floor(this.details.time / this.details.duration * 1000)/10 : 0
						break;
					}
					Object.keys(this.details).forEach((key) => {
						if (typeof this.details[key] == 'object') return
						//_PLAYERDETAILS.action
						//_PLAYERDETAILS.node
						for (let mode in _PLAYERDETAILS.playerDetails) {
							let node = _PLAYERDETAILS.playerDetails[mode][key]
							
							if (node) {
								let val = this.details[key]
								val = node.values !== undefined ? node.values.indexOf(val) > -1 : val
								val = node && node.type && this._controller._library.convertToType(val, node.type)
								if (!node.notDetails) this.details[key] = val
								if (this.latelyActionCall != node.node) this._controller._library.confirmNode({node: this.prefix + ( mode == 'action' ? '._Controls.' : '.')+node.node}, val)
							}
						}
					})
				}
				//this._controller._adapter.log.debug(`Write details updates from ${this.config.title} for ${this.getReadableID()}`)
				this._controller._library.readData(`${this.prefix}.Player.details`, this.details, `${this.prefix}`, undefined, true )		
			} catch(err) {
				this._controller._adapter.log.debug('catch() 121: ' + err)
			}
		} catch(error) {
			if (error.code === 'ECONNABORTED') {
				throw new Error('timeout')
			} else {
				this._controller._adapter.log.warn('catch() 122: ' +JSON.stringify(error.toJSON()));
			}						
		}
		try {
			if (saveValues.metadata != this.details.url) {
				this.getMetadataUpdate()
				let data = await this._controller._library.getItem(this.details.url)//"/library/metadata/34679"
				data = this.getMetadataSelection(data, _PLAYERDETAILS.deepVal,"")
				//this._controller._adapter.log.debug('expands2:'+ JSON.stringify(data));
				for (let key in data) {
					this._controller._library.readData(this.prefix +'.'+ key, data[key], this.prefix)
				}
				//this._controller._library.readData(this.prefix, data2, this.prefix)
				//this.test() 
				
				//this._controller._adapter.log.debug('test json- --------' + JSON.stringify(data2))
				}
		} catch(err) {this._controller._adapter.log.error(err)}
		try {
			
			if ( saveValues.type != this.details.type 
				|| saveValues.state != this.details.state ) 
			{
					await this._controller._library.runGarbageCollector(this.prefix, false, 1000, [...Controller.garbageExcluded, '_Controls','Metadata'])
			}
		} catch(err) {this._controller._adapter.log.error(err)}
		//this._controller._adapter.log.debug('Timeline old values:'+ JSON.stringify(saveValues) + ' new:' + JSON.stringify({state:this.details.state, type:this.details.type}));
		
		
	}		

	getReadableID () {
		return `${this.config.title}-${this.config.uuid}`
	}
	
	setControls() {
		let controls = `${this.prefix}._Controls`;
		let a = this.config
		//this._controller._adapter.log.debug(`update Controls ${this.prefix}`);
		this.config.protocolCapabilities && this.config.protocolCapabilities.split(',').forEach(mode => // e.g. "timeline,playback,navigation,mirror,playqueues"
		{
			if(!this.config.controllable) this._controller._library.set({node: controls, role: 'channel', description: 'Playback & Navigation Controls'});
			this.config.controllable = true;
			if (this._controller._actions[mode] === undefined) return;
			this._controller._library.set({node: controls + '.' + mode, role: 'channel', description: this._controller._library.ucFirst(mode) + ' Controls'});
			
			let button;
			for (let key in this._controller._actions[mode])
			{
				let newVal = this._controller._actions[mode][key].default !== undefined ? this._controller._actions[mode][key].default : false;
				button = typeof this._controller._actions[mode][key] == 'string' ? { "key": key, "description": this._controller._actions[mode][key] } : this._controller._actions[mode][key];
				let common = this._controller._actions[mode][key].common || {}
				if (this._controller._library.getDeviceState(controls + '.' + mode + '.' + key) === null) {
					this._controller._library.set({
						'node': controls + '.' + mode + '.' + key,
						'description': mode.slice(0,1).toUpperCase()+mode.slice(1)+' ' + this._controller._library.ucFirst(button.description),
						
						'role': this._controller._actions[mode][key].role !== undefined ? this._controller._actions[mode][key].role : (this._controller._actions[mode][key].attribute !== undefined || this._controller._actions[mode][key].default !== undefined ? (this._controller._actions[mode][key].values || Number.isInteger(this._controller._actions[mode][key].default) ? 'value' : 'text') : 'button'),
						'type': this._controller._actions[mode][key].type !== undefined ? this._controller._actions[mode][key].type : (this._controller._actions[mode][key].attribute !== undefined || this._controller._actions[mode][key].default !== undefined ? (this._controller._actions[mode][key].values || Number.isInteger(this._controller._actions[mode][key].default) ? 'number' : 'string') : 'boolean'),
						
						'common': {
							...common,
							'write': true,
							'read': true,
							'states': this._controller._actions[mode][key].values
						},
					}, newVal)
				}
			}
			
			this._controller._adapter.subscribeStates(controls + '.' + mode + '.*');
		});
	}

	/**
	 * 
	 * @param {string} actionVal.mode 			mode see _ACTIONS (4. dp)
	 * @param {string} actionVal.action 		action "    " (5. dp)
	 * @param {any} actionVal.val 				val value of action
	 * @param {string} actionVal.id 			dp of state (1.+2.+3. dp)
	 */
	async action(actionVal) {
		if (this._controller._actions[actionVal.mode] !== undefined && this._controller._actions[actionVal.mode][actionVal.action] !== undefined && this.address && this.port)
		{
			this._controller._adapter.log.info(`Triggered action -${actionVal.action}- on player ${this.getReadableID()} with ip:${this.address}.`);
			
			let newVal = actionVal.val
			let key = this._controller._actions[actionVal.mode][actionVal.action].key || actionVal.action;
			if (this._controller._actions[actionVal.mode][actionVal.action]["true"] !== undefined)
					key = state.val ? this._controller._actions[actionVal.mode][actionVal.action]["true"] : this._controller._actions[actionVal.mode][actionVal.action]["false"]
			if (this._controller._actions[actionVal.mode][actionVal.action]["convert"] !== undefined) {
				switch(this._controller._actions[actionVal.mode][actionVal.action]["convert"]) {
					case "percent":
						newVal = this.details && this.details.duration ? this.details.duration * newVal / 100 : 0
					break 
				}
			}
			if (this._controller._actions[actionVal.mode][actionVal.action]["saveToPlayer"] == undefined) {
				let attribute = this._controller._actions[actionVal.mode][actionVal.action].attribute;
				let options = {
					...this._controller._library.AXIOS_OPTIONS,
					'method': 'GET',
					// Dont work for me with https:
					//'url': this._controller._library.AXIOS_OPTIONS._protocol + '//' + playerIp + ':' + playerPort + '/player/' + mode + '/' + key + '?' + (attribute != undefined ? attribute + '=' + val + '&' : ''),
					'url': `http://${this.address}:${this.port}/player/${actionVal.mode}/${key}?${(attribute != undefined ? attribute + '=' + newVal + '&' : '')}`,
					//'url': `http://plex.kiemen.com:32400/player/${actionVal.mode}/${key}?${(attribute != undefined ? attribute + '=' + newVal + '&' : '')}`,
					'headers': {
						...this.PLEX_HEADERS
					}
				};

				try {
					this.latelyActionCall = `${actionVal.mode}.${actionVal.action}`
					const result = await axios(options)
					this.config.connected = true
					this._controller._adapter.log.debug(`Successfully triggered ${actionVal.mode} action -${actionVal.action}- on player ${this.getReadableID()} with ip:${this.address}.`);
					// confirm commands
					this._controller._library.confirmNode({node: `${actionVal.id}.${actionVal.mode}.${actionVal.action}`}, actionVal.val)
				} catch(err) {
					this._controller._adapter.log.warn(`Error triggering ${actionVal.mode} action -${actionVal.action}- on player ${this.getReadableID()} with ip:${this.address}.! See debug log for details.`);
					this._controller._adapter.log.debug('catch() 133: ' + err);
					this.latelyActionCall = ''
				}
			} else {
				this[this._controller._actions[actionVal.mode][actionVal.action].key] = newVal
				this.startUpdater()
				this._controller._library.confirmNode({node: `${actionVal.id}.${actionVal.mode}.${actionVal.action}`}, actionVal.val)
			}
		}
		else {
			this._controller._adapter.log.warn(`Error triggering ${actionVal.mode} action -${actionVal.action}- on player ${this.getReadableID()} with ip:${this.address}.! See debug log for details! Action not supported!`);
		}
	}
	
	getMetadataSelection(data, list, k = "", lastData = {})
	{
		if (!data || data !=='object') return {}
		let def = JSON.parse(JSON.stringify(list))
		let result = {}
		
		// result is {key: [{node:val}, {node:val}]}
		result = _findData(data, def, k, lastData)
		//this._controller._adapter.log.debug('test1' + JSON.stringify(result))
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
		//this._controller._adapter.log.debug('test2' + JSON.stringify(res))
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
			//this._controller._adapter.log.debug(await this._controller._library.getItemTest('/status/sessions/0'))
			sessions = await this._controller._library.getItem('/status/sessions')
			//this._controller._adapter.log.debug(JSON.stringify(sessions.Metadata))
			if (!sessions || !sessions.Metadata) return
			for (let s of sessions.Metadata){
				if (s.Player.machineIdentifier === this.config.uuid) {
					this.cleanUpConfig(s.Player)
					s = this.cleanUpMetadata(s, true)
					
					this.media = s.Media
					s.media = undefined
					//this.metadata = s
					//this._controller._adapter.log.debug(`Write client updates from Plex Media Server for ${this.config.title}`)
					this._controller._library.readData(`${this.prefix}.Metadata`, s, `${this.prefix}`, undefined, true )
				}
			}
		} catch(err){this._controller._adapter.log.debug('Error 124: '+err)}
	
	}
}
module.exports = { Controller }