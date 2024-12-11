'use strict';
const axios = require('axios');

const xml2js = require('xml2js');
const xml = new xml2js.Parser();
/**
 * Player
 *
 * @description Player class get a player obj to handle player events
 * @author ticaki <https://github.com/ticaki/>
 * @license MIT
 * @version 0.0.1
 */
class Controller {
    /**
     * Constructs a new Player instance.
     *
     * @param {object} adapter - The adapter instance.
     * @param {object} options - The options for the player.
     * @param {string} options.controllerIdentifier - The identifier for the controller.
     * @param {string} options.plexToken - The Plex token for authentication.
     * @param {object} [options.actions] - The actions available for the player.
     * @param {object}  [options.nodes] - The nodes associated with the player.
     * @param {object} [options.playerdetails] - The details of the player.
     * @param {object} library - The library instance.
     */
    constructor(adapter, options, library) {
        this.players = [];
        this._adapter = adapter;
        this.controllerIdentifier = options.controllerIdentifier;
        this.plexToken = options.plexToken;
        this._actions = options.actions || {};
        this._nodes = options.nodes || {};
        this._library = library;
        this._playerdetails = options.playerdetails || {};
        this.noRefresh = this._adapter.config.getPlayerRefresh == 0;
        this.serverUuid = '';
    }
    static garbageExcluded = ['Player', '_Controls'];
    /**
     * Sets the server UUID.
     *
     * @param {string} uuid - The UUID of the server.
     */
    setServerId(uuid) {
        this.serverUuid = uuid;
    }

    /**
     * Gets the server UUID.
     *
     * @returns {string} - The UUID of the server.
     */
    getServerId() {
        return this.serverUuid;
    }
    /**
     * Checks if a player with the given prefix exists.
     *
     * @param {string} [prefix] - The prefix to search for.
     * @returns {object | null} - The player object if found, otherwise null.
     */
    existPlayer(prefix = '') {
        const i = this.players.findIndex(p => p.prefix.toLowerCase() == prefix.toLowerCase());
        return i > -1 ? this.players[i] : null;
    }
    /**
     * Creates a player if it does not already exist.
     *
     * @param {object} options - The options for creating the player.
     * @param {object} options.config - The configuration for the player.
     * @param {string} options.config.title - The title of the player.
     * @param {string} options.config.uuid - The UUID of the player.
     * @returns {object} - The created or existing player object.
     * @throws {error} - Throws an error if the title or UUID is missing.
     */
    createPlayerIfNotExist(options) {
        if (!options.config.title || !options.config.uuid) {
            throw new Error(
                `createPlayerIfNotExist called without title: ${options.config.title} or uuid ${options.config.uuid}`,
            );
        }
        const prefix = `_playing.${this._library.clean(`${options.config.title}`, true)}-${options.config.uuid}`;
        let player = this.existPlayer(prefix);
        if (!player) {
            player = new Player({ ...options, prefix: prefix }, this);
            this.players.push(player);
        }
        return player;
    }

    /**
     * Deletes all players.
     */
    delete() {
        this.players.forEach(p => {
            p.delete;
        });
        this.players = [];
    }
}

/**
 * Player
 *
 * @description Player class get a player obj to handle player events
 * @author ticaki <https://github.com/ticaki/>
 * @license MIT
 * @version 0.0.1
 */
class Player {
    /**
     * Creates a player if it does not already exist.
     *
     * @param {object} options - The options for creating the player.
     * @param {object} controller - The controller instance.
     * @returns The created or existing player object.
     * @throws {Error} - Throws an error if the title or UUID is missing.
     */
    constructor(options = {}, controller) {
        this.unload = false;
        this._controller = controller;
        this.config = options.config || {};
        //prefix is the id for the obj (name-maschineid)
        this.prefix = options.prefix;
        // work to do: config from Adapter and change default to 0
        this.refresh =
            (this._controller._adapter.config.getPlayerRefresh &&
                this._controller._adapter.config.getPlayerRefresh > 1 &&
                this._controller._adapter.config.getPlayerRefresh) ||
            1;
        this.details = this._controller._library.getDeviceStateJson(`${this.prefix}.Player.details`) || {};
        //this.metadata				= this._controller._library.getDeviceStateJson(`${this.prefix}.Metadata`) || {}
        this.config.protocolCapabilities =
            this._controller._library.getDeviceState(`${this.prefix}.Player.protocolCapabilities`) || 'none';
        this.address =
            options.address || this._controller._library.getDeviceState(`${this.prefix}.Player.localAddress`) || '';
        this.port = options.port || this._controller._library.getDeviceState(`${this.prefix}.Player.port`) || 0;
        this.config.controllable = !!this._controller._library.getDeviceState(`${this.prefix}.Player.controllable`);
        this.refreshDetails =
            !!this._controller._library.getDeviceState(`${this.prefix}._Controls.timeline.refreshDetails`) || true;
        this.details.state = 'stopped';
        this.config.connected = true;
        this.updatedStates = true;
        this.updateTrys = 0;
        this.PLEX_HEADERS = {
            'X-Plex-Token': this._controller._adapter.config.plexToken,
            'X-Plex-Target-Client-Identifier': this.config.uuid,
            'X-Plex-Client-Identifier': this._controller.controllerIdentifier,
            'X-Plex-Device-Name': this.config.title,
        };
        this.commandID = 0;
        this._controller._library.set({
            node: '_playing',
            role: 'channel',
            description: this._controller._library.getNode('playing').description,
        });
        this._controller._library.set({
            node: this.prefix,
            role: 'channel',
            description: `Player ${this.config.title}`,
        });
        this._controller._adapter.log.debug(
            `Create player with prefix "${this.prefix}", localAddress "${this.address || `no ip`}" and port "${this.port || `no port`}"`,
        );
        this._controller._adapter.setTimeout(
            () => {
                this.setControls();
                this.startUpdater();
            },
            400,
            this,
        );
        this.lyric = null;
    }
    /**
     * Sets the notification data for the player.
     *
     * @param {object} data - The notification data.
     */
    setNotificationData(data) {
        if (data && typeof data === 'object') {
            for (const d in data.Player) {
                if (data.Player[d] === 'undefined') {
                    delete data.Player[d];
                }
            }
            this.updateStates(this.cleanUpConfig(data.Player));
            data = this.cleanUpMetadata(data);
            if (!this.refreshDetails) {
                Object.keys({
                    play_switch: (data.event && ['media.play', 'media.resume'].indexOf(data.event) > -1) || false,
                }).forEach(key => {
                    //playerdetails.action
                    const node = this._controller._playerdetails.playerDetails.action[key];
                    let val =
                        node && node.type && this._controller._library.convertToType(this.details[key], node.type);
                    if (node) {
                        val = node.values !== undefined ? node.values.indexOf(val) > -1 : val;
                        if (!node.notDetails) {
                            this.details[key] = val;
                        }
                        this._controller._library.confirmNode({ node: `${this.prefix}._Controls.${node.node}` }, val);
                    }
                });
            }
            for (const key in data) {
                this._controller._library.readData(`${this.prefix}.${key}`, data[key], this.prefix);
            }
            //this.metadata = data.Metadata
            if (!this.config.controllable) {
                this.setControls();
            }
            this.startUpdater();
        }
    }
    cleanUpMetadata(data, ca = false) {
        data = (ca && { Metadata: data }) || data;
        delete data.Player;
        if (data.Metadata) {
            if (data.Metadata.stream) {
                delete data.Metadata.stream.player;
            }
            if (!this._controller._adapter.config.getMetadataTrees) {
                delete data.Metadata.Media;
            }
        }
        return (ca && data.Metadata) || data;
    }

    setClientData(data) {
        if (data && typeof data === 'object') {
            this._controller._adapter.log.debug(
                `setClientData config object from player ${this.prefix} is ${JSON.stringify(data)}`,
            );
            this.cleanUpConfig(data);
            this.config.connected = true;
            this.updateStates(data);
            if (!this.config.controllable) {
                this.setControls();
            }
            this.startUpdater();
        }
    }

    cleanUpConfig(config) {
        const o = { config: config };
        this.config.uuid = o.config.machineIdentifier || config.uuid || this.config.uuid;
        this.config.title = o.config.title || o.config.name || this.config.title;
        if (o.config.address == '127.0.0.1') {
            o.config.address = 0;
        }
        this.address = o.config.address || this.address || this.config.localAddress;
        this.port = o.config.port || this.config.port || this.port;
        this.config.port = this.port;
        this.config.publicAddress = o.config.remotePublicAddress || o.config.publicAddress || this.config.publicAddress;
        delete o.config.address;
        delete o.config.machineIdentifier;
        delete o.config.remotePublicAddress;
        delete o.config.name;
        delete o.config;
        for (const l in o) {
            this[l] = o[l];
        }
    }
    updateStates(data) {
        if (data) {
            Object.assign(this.config, data);
        }
        // for backward compatibility
        this.address = this.address || this.config.localAddress;
        this._controller._library.set(
            {
                node: `${this.prefix}.Player.localAddress`,
                ...this._controller._library.getNode('playing.player.localaddress'),
            },
            this.address,
        );
        this._controller._library.readData(`${this.prefix}.Player`, this.config, `${this.prefix}`, undefined);
    }

    delete() {
        this.unload = true;
        this._controller._library.runGarbageCollector(this.prefix, true, 1, Controller.garbageExcluded);
        if (this.refreshTimeout) {
            this._controller._adapter.clearTimeout(this.refreshTimeout), (this.refreshTimeout = null);
        }
        this.config.connected = false;
        if (this.lyric) {
            this.lyric.delete();
        }
    }

    startUpdater() {
        // dont start
        if (!this.refreshDetails || this._controller.noRefresh || !this.config.controllable) {
            return;
        }
        // dont restart while running 0 == off 1 >= is running
        if (this.updateTrys > 0) {
            this.updateTrys = 1;
            return;
        }
        this.updateTrys++;
        this.details = this.details || {};

        this._controller._library.set(
            { ...this._controller._library.getNode('playing.player.details'), node: `${this.prefix}.Player.details` },
            undefined,
        );
        this._controller._library.set(
            {
                ...this._controller._library.getNode('playing.player.details.video'),
                node: `${this.prefix}.Player.details.video`,
            },
            undefined,
        );
        this._controller._library.set(
            {
                ...this._controller._library.getNode('playing.player.details.music'),
                node: `${this.prefix}.Player.details.music`,
            },
            undefined,
        );
        this._controller._library.set(
            {
                ...this._controller._library.getNode('playing.player.details.photo'),
                node: `${this.prefix}.Player.details.photo`,
            },
            undefined,
        );

        this._controller._adapter.log.debug(
            `Start getting client details ${this.prefix} - ${this.config.protocolCapabilities} - ${this.address} - ${this.port}`,
        );
        if (this.refreshTimeout) {
            return;
        }
        this.refreshTimeout = this._controller._adapter.setTimeout(
            async function _updater(self) {
                try {
                    // end this
                    if (!self.refreshDetails || self.unload || self._controller.noRefresh) {
                        return;
                    }
                    await self.updateTimeline();
                    //photo dont work in the right way from plex side
                    if (self.details.state == 'stopped' || self.unload) {
                        throw new Error('stop');
                    }
                    // no error so reset counter
                    self.updateTrys = 1;
                    //self.setControls();
                    self.latelyActionCall = '';
                } catch (error) {
                    self.latelyActionCall = '';
                    if (error.message != 'timeout' && error.message != 'stop') {
                        self._adapter.log.error(`Error 114: ${error.message} `);
                        self.refreshTimeout = null;
                        return;
                    }
                    // after x timeouts/errors cancel it
                    if (self.updateTrys++ > 2) {
                        self.updateTrys = 0;
                        self.updateStates();
                        //self.setControls();
                        if (error.message == 'timeout') {
                            self._controller._adapter.log.info(`Player ${self.getReadableID()} is disconnected`);
                            //await self._controller._library.runGarbageCollector(self.prefix, false, 900, [...Controller.garbageExcluded, '_Controls', 'Metadata']);
                        } else if (error.message == 'stop') {
                            self._controller._adapter.log.debug(
                                `Stop getting client details ${self.prefix} - ${self.config.protocolCapabilities} - ${self.address} - ${self.port}`,
                            );
                        }
                        self.refreshTimeout = null;
                        return;
                    }
                }
                self.refreshTimeout = self._controller._adapter.setTimeout(_updater, self.refresh * 1000, self);
            },
            300,
            this,
        );
    }

    async updateTimeline() {
        //this._controller._adapter.log.debug(`Try to get client details ${this.prefix} - ${this.config.protocolCapabilities} - ${this.address} - ${this.port}`);
        if (!this.config.controllable || !this.address || this.address == '127.0.0.1' || !this.port) {
            return;
        }
        const saveValues = { state: this.details.state, type: this.details.type, metadata: this.details.key };
        const options = {
            timeout: 700,
            method: 'GET',
            url: `http://${this.address}:${this.port}/player/timeline/poll?wait=0&commandID=${this.commandID++}`,
            headers: {
                ...this.PLEX_HEADERS,
            },
        };
        // reset Player.details
        this.details = {
            ...this.details,
            state: 'stopped',
            type: 'none',
            time: 0,
            duration: 0,
            location: 'none',
            url: '',
            percent: 0,
        };
        // set connection to false
        this.config.connected = false;

        try {
            const res = await axios(options);
            try {
                // set connection to true
                this.config.connected = true;
                const result = await xml.parseStringPromise(res.data);

                let r = (result && result.MediaContainer && result.MediaContainer) || {};

                this.details.location = (r.$ && r.$.location) || 'none';

                r = r.Timeline || [];
                for (const d in r) {
                    //remove this datapoints
                    for (const a of [
                        'address',
                        'containerKey',
                        'guid',
                        'machineIdentifier',
                        'audioStreamID',
                        'videoStreamID',
                    ]) {
                        delete r[d].$[a];
                    }

                    this.details[r[d].$.type] = r[d].$;
                }
                r = r.filter(a => a.$.state != 'stopped');
                if (r.length == 0) {
                    this.details.type = 'all';
                } else {
                    r = r.sort((a, b) => {
                        const def = { photo: 1, musik: 2, video: 3 };
                        return def[a.$.type] - def[b.$.type];
                    });
                    //set Player.details
                    for (const k in this.details) {
                        delete this.details[k].type;
                        const d = this.details[k];
                        if (typeof d != 'object') {
                            continue;
                        }
                        //photo dont work in the right way from plex side
                        if (d.state == 'stopped' || k == 'photo') {
                            continue;
                        }
                        this.details.time = d.time || 0;
                        this.details.duration = d.duration || 0;
                        this.details.type = k;
                        this.details.state = d.state;
                        this.details.key = d.key;
                        this.details.volume = d.volume || 0;
                        this.details.shuffle = d.shuffle != 0 || false;
                        this.details.repeat = d.repeat || 0;
                        this.details.percent = this.details.duration
                            ? Math.floor((this.details.time / this.details.duration) * 100)
                            : 0;
                        break;
                    }
                    // set lyric time or end it
                    if (this.details.type == 'music') {
                        if (this.details.music.state === 'playing' && this.lyric) {
                            this.lyric.updateTime(this.details.time);
                        }
                    } else {
                        if (this.lyric) {
                            this.lyric.stop();
                        }
                    }
                    //set playerdetails and confirm
                    Object.keys(this.details).forEach(key => {
                        if (typeof this.details[key] == 'object') {
                            return;
                        }
                        //_playerdetails.action
                        //_playerdetails.node
                        for (const mode in this._controller._playerdetails.playerDetails) {
                            const node = this._controller._playerdetails.playerDetails[mode][key];

                            if (node) {
                                let val = this.details[key];
                                val = node.values !== undefined ? node.values.indexOf(val) > -1 : val;
                                val = node && node.type && this._controller._library.convertToType(val, node.type);
                                if (!node.notDetails) {
                                    this.details[key] = val;
                                }
                                if (this.latelyActionCall != node.node) {
                                    this._controller._library.confirmNode(
                                        { node: this.prefix + (mode == 'action' ? '._Controls.' : '.') + node.node },
                                        val,
                                    );
                                }
                            }
                        }
                    });
                }
                this._controller._library.readData(
                    `${this.prefix}.Player.details`,
                    this.details,
                    `${this.prefix}`,
                    undefined,
                    true,
                );
            } catch (err) {
                this._controller._adapter.log.debug(`catch() 121: ${err}`);
            }
        } catch (error) {
            if (error.code === 'ECONNABORTED') {
                throw new Error('timeout');
            } else if (error.code === 'ECONNRESET') {
                this._controller._adapter.log.debug(
                    `catch() 122 no problem when player is gone: ${JSON.stringify(error.toJSON())}`,
                );
                throw new Error('timeout');
            } else {
                this._controller._adapter.log.debug(`catch() 122: ${JSON.stringify(error.toJSON())}`);
                throw new Error('timeout');
            }
        }
        try {
            //media has changed or state goes from stopped to ... update Lyric
            if (
                saveValues.metadata != this.details.key ||
                (saveValues.state == 'stopped' && saveValues.state != this.details.state)
            ) {
                this.getMetadataUpdate();
                let data = await this._controller._library.getItem(this.details.key); //"/library/metadata/34679"
                data = this.getMetadataSelection(data, this._controller._playerdetails.deepVal, '');

                for (const key in data) {
                    const node = this._controller._library.getNode(`playing.${key}`, true);
                    if (node && node.convert && node.convert.complex) {
                        const complex = node.convert.complex;
                        switch (complex.func) {
                            case 'lyric': {
                                let dp = complex.data.split('.').slice(1).join('.');
                                const keys = Object.keys(data);
                                const index = keys.findIndex(i => i.toLowerCase() == dp);
                                if (index > -1) {
                                    dp = keys[index];
                                    if (data[key] && data[dp]) {
                                        if (this.lyric) {
                                            this.lyric.updateData(
                                                data[dp],
                                                `${this.prefix}.${dp.split('.').slice(0, -1).join('.')}`,
                                            );
                                        } else {
                                            this.lyric = new Lyric(
                                                this._controller._adapter,
                                                this._controller._library,
                                                data[dp],
                                                `${this.prefix}.${dp.split('.').slice(0, -1).join('.')}`,
                                            );
                                        }
                                    }
                                }
                            }
                        }
                    }
                    this._controller._library.readData(`${this.prefix}.${key}`, data[key], this.prefix);
                }
            }
        } catch (err) {
            this._controller._adapter.log.error(err);
        }
    }

    getReadableID() {
        return `${this.config.title}-${this.config.uuid}`;
    }

    /**
     * Sets the controls for the player based on its protocol capabilities.
     */
    setControls() {
        const controls = `${this.prefix}._Controls`;
        this.config.protocolCapabilities &&
            this.config.protocolCapabilities.split(',').forEach(
                (
                    mode, // e.g. "timeline,playback,navigation,mirror,playqueues"
                ) => {
                    if (mode === 'none') {
                        return;
                    }
                    this._controller._library.set({
                        node: controls,
                        role: 'channel',
                        description: 'Playback & Navigation Controls',
                    });
                    this.config.controllable = true;
                    this.updateStates(null);
                    if (this._controller._actions[mode] === undefined) {
                        return;
                    }
                    this._controller._library.set({
                        node: `${controls}.${mode}`,
                        role: 'channel',
                        description: `${this._controller._library.ucFirst(mode)} Controls`,
                    });

                    let button;
                    for (const key in this._controller._actions[mode]) {
                        const newVal =
                            this._controller._actions[mode][key].default !== undefined
                                ? this._controller._actions[mode][key].default
                                : false;
                        button =
                            typeof this._controller._actions[mode][key] == 'string'
                                ? { key: key, description: this._controller._actions[mode][key] }
                                : this._controller._actions[mode][key];
                        const common = this._controller._actions[mode][key].common || {};
                        if (this._controller._library.getDeviceState(`${controls}.${mode}.${key}`) === null) {
                            this._controller._library.set(
                                {
                                    node: `${controls}.${mode}.${key}`,
                                    description: `${mode.slice(0, 1).toUpperCase() + mode.slice(1)} ${this._controller._library.ucFirst(button.description)}`,
                                    role:
                                        this._controller._actions[mode][key].role !== undefined
                                            ? this._controller._actions[mode][key].role
                                            : this._controller._actions[mode][key].attribute !== undefined ||
                                                this._controller._actions[mode][key].default !== undefined
                                              ? this._controller._actions[mode][key].values ||
                                                Number.isInteger(this._controller._actions[mode][key].default)
                                                  ? 'value'
                                                  : 'text'
                                              : 'button',
                                    type:
                                        this._controller._actions[mode][key].type !== undefined
                                            ? this._controller._actions[mode][key].type
                                            : this._controller._actions[mode][key].attribute !== undefined ||
                                                this._controller._actions[mode][key].default !== undefined
                                              ? this._controller._actions[mode][key].values ||
                                                Number.isInteger(this._controller._actions[mode][key].default)
                                                  ? 'number'
                                                  : 'string'
                                              : 'boolean',
                                    common: {
                                        ...common,
                                        write: true,
                                        read: true,
                                        states: this._controller._actions[mode][key].values,
                                    },
                                },
                                newVal,
                            );
                        }
                    }

                    this._controller._adapter.subscribeStates(`${controls}.${mode}.*`);
                },
            );
    }

    /*************  ✨ Codeium Command ⭐  *************/
    /**
     * Executes a specified action on the player.
     *
     * @async
     * @param {object} actionVal - The action details.
     * @param {string} actionVal.mode - The mode of the action (e.g., playback, navigation).
     * @param {string} actionVal.action - The specific action to be triggered.
     * @param {any} actionVal.val - The value associated with the action.
     * @description This function checks if the specified action is supported. If it is, it constructs
     * a request to trigger the action on the player using its IP and port. It handles specific action
     * conversions if needed (e.g., percent, lastPlayed, playKey) and logs the execution process.
     * In case of success or failure, appropriate logs are generated.
     * @throws Will log a warning if the action is not supported or if there is an error in triggering the action.
     */
    /******  14ff80fb-8f44-4c96-bcdf-eaeb29c7bb3a  *******/
    async action(actionVal) {
        if (
            this._controller._actions[actionVal.mode] !== undefined &&
            this._controller._actions[actionVal.mode][actionVal.action] !== undefined &&
            this.address &&
            this.port
        ) {
            let attribute = undefined;
            this._controller._adapter.log.info(
                `Triggered action -${actionVal.action}- on player ${this.getReadableID()} with ip:${this.address}.`,
            );

            let newVal = actionVal.val;
            let key = this._controller._actions[actionVal.mode][actionVal.action].key || actionVal.action;
            if (this._controller._actions[actionVal.mode][actionVal.action]['true'] !== undefined) {
                key = newVal
                    ? this._controller._actions[actionVal.mode][actionVal.action]['true']
                    : this._controller._actions[actionVal.mode][actionVal.action]['false'];
            }
            if (this._controller._actions[actionVal.mode][actionVal.action]['convert'] !== undefined) {
                let json = null;
                switch (this._controller._actions[actionVal.mode][actionVal.action]['convert']) {
                    case 'percent':
                        newVal =
                            this.details !== undefined && this.details.duration > 0
                                ? Math.floor((this.details.duration * newVal) / 100)
                                : 0;
                        break;
                    case 'lastPlayed':
                        attribute =
                            `key=${this.details.key}&address=${this._controller._adapter.config.plexIp}` +
                            `&port=${this._controller._adapter.config.plexPort}&machineIdentifier=${this._controller.getServerId()}&` +
                            `offset=${this.details.time}&`;
                        break;
                    case 'playKey':
                        try {
                            json = JSON.parse(newVal);
                            if (
                                json.key === undefined ||
                                typeof json.key !== 'string' ||
                                json.offset === undefined ||
                                isNaN(json.offset)
                            ) {
                                throw new Error('invalid value');
                            }
                        } catch {
                            this._controller._adapter.log.error(
                                `Error convert json of ${actionVal.id}.${actionVal.mode}.${actionVal.action} should be like {key: "/library/metadata/45156", offset: "123456"} but is ${newVal}!`,
                            );
                            return;
                        }
                        attribute =
                            `key=${json.key}&address=${this._controller._adapter.config.plexIp}` +
                            `&port=${this._controller._adapter.config.plexPort}&machineIdentifier=${this._controller.getServerId()}&` +
                            `offset=${json.offset}`;
                        break;
                }
            }
            if (this._controller._actions[actionVal.mode][actionVal.action]['saveToPlayer'] == undefined) {
                const fromPlex = this._controller._actions[actionVal.mode][actionVal.action].fromPlex;
                if (fromPlex !== undefined) {
                    for (const a in fromPlex) {
                        if (fromPlex[a] === newVal) {
                            newVal = a;
                        }
                    }
                }

                attribute =
                    attribute ||
                    (this._controller._actions[actionVal.mode][actionVal.action].attribute &&
                        `${this._controller._actions[actionVal.mode][actionVal.action].attribute}=${newVal}&`);

                const options = {
                    ...this._controller._library.AXIOS_OPTIONS,
                    method: 'GET',
                    // Dont work for me with https:
                    url: `http://${this.address}:${this.port}/player/${actionVal.mode}/${key}?${attribute != undefined ? `${attribute}` : ''}`,
                    headers: {
                        ...this.PLEX_HEADERS,
                    },
                };

                try {
                    this.latelyActionCall = `${actionVal.mode}.${actionVal.action}`;
                    await axios(options);
                    this.config.connected = true;
                    this._controller._adapter.log.debug(
                        `Successfully triggered ${actionVal.mode} action -${actionVal.action}- on player ${this.getReadableID()} with ip:${this.address}.`,
                    );
                    // confirm commands
                    this._controller._library.confirmNode(
                        { node: `${actionVal.id}.${actionVal.mode}.${actionVal.action}` },
                        actionVal.val,
                    );
                    this._controller._adapter.log.debug(`url: ${options.url}`);
                } catch (err) {
                    this._controller._adapter.log.warn(
                        `Error triggering ${actionVal.mode} action -${actionVal.action}- on player ${this.getReadableID()} with ip:${this.address}.! See debug log for details.`,
                    );
                    this._controller._adapter.log.debug(`catch() 133: ${err.toJSON().message}`);
                    this._controller._adapter.log.debug(`axios.options: ${JSON.stringify(options)}`);
                    this.latelyActionCall = '';
                }
            } else {
                this[this._controller._actions[actionVal.mode][actionVal.action].key] = newVal;
                this.startUpdater();
                this._controller._library.confirmNode(
                    { node: `${actionVal.id}.${actionVal.mode}.${actionVal.action}` },
                    actionVal.val,
                );
            }
        } else {
            this._controller._adapter.log.warn(
                `Error triggering ${actionVal.mode} action -${actionVal.action}- on player ${this.getReadableID()} with ip:${this.address} and port:${this.port}.! See debug log for details! Action not supported!`,
            );
        }
    }

    getMetadataSelection(data, list, k = '', lastData = {}) {
        if (!data || typeof data !== 'object') {
            return {};
        }
        const def = JSON.parse(JSON.stringify(list));
        let result = {};

        // result is {key: [{node:val}, {node:val}]}
        result = _findData(data, def, k, lastData);
        //this._controller._adapter.log.debug('test1' + JSON.stringify(result))
        const res = {};
        for (const key in result) {
            for (const a in result[key]) {
                for (const n in result[key][a]) {
                    const newkey = n.replace('.track.', '.Music.');
                    res[newkey] = result[key][a][n];
                }
            }
        }
        return res;

        function _findData(data, list, k = '', lastData = {}) {
            //list.tracks.list.media.list.parts.list.lyricStreams.list.key
            //list.tracks.list.media.list.parts.list.lyricStreams.list.streamType

            if (typeof data === 'object') {
                if (Array.isArray(data)) {
                    for (const a in data) {
                        _findData(data[a], list, `${k}`, data);
                    }
                } else {
                    for (const a in data) {
                        _findData(data[a], list, k ? `${k}.${a}` : a, data);
                    }
                }
            } else {
                if (list[k] !== undefined) {
                    /**
                     * value: if value not data go back
                     * nodes: if nodes then save the data from lastData
                     */
                    for (const l of list[k]) {
                        if (l.value && l.value != data) {
                            continue;
                        }
                        if (l.nodes) {
                            const res = {};
                            for (const n of l.nodes) {
                                res[l.node + n.node] = lastData[n.key];
                            }
                            result[l.node] = result[l.node] || [];
                            result[l.node].push(res);
                        } else if (l.call) {
                            const nl = {};
                            for (const n in l.call) {
                                nl[n] = nl[n] || [];
                                for (const m in l.call[n]) {
                                    nl[n].push({
                                        node: `${l.node}${l.valueAsKey ? `.${data}` : ``}${l.call[n][m].node}`,
                                        app: l.call[n][m].app,
                                    });
                                }
                            }
                            _findData(lastData, nl, k.split('.').slice(0, -1).join('.'));
                        } else if (l.node) {
                            const newKey = l.node + (l.app ? l.app : '');
                            result[l.node] = result[l.node] || [];
                            const res = {};
                            res[newKey] = data;
                            result[l.node].push(res);
                        }
                    }
                }
            }
            return result;
        }
    }

    async getMetadataUpdate(sessions) {
        try {
            //this._controller._adapter.log.debug(await this._controller._library.getItemTest('/status/sessions/0'))
            sessions = await this._controller._library.getItem('/status/sessions');
            //this._controller._adapter.log.debug(JSON.stringify(sessions.Metadata))
            if (!sessions || !sessions.Metadata) {
                return;
            }
            for (let s of sessions.Metadata) {
                if (s.Player.machineIdentifier === this.config.uuid) {
                    //this._controller._adapter.log.debug('..............: ' + JSON.stringify(s.Player));
                    this.cleanUpConfig(s.Player);
                    s = this.cleanUpMetadata(s, true);
                    if (s.Player && s.Player.state) {
                        delete s.Player.state;
                    }
                    this.media = s.Media;
                    s.media = undefined;
                    //this.metadata = s
                    //this._controller._adapter.log.debug(`Write client updates from Plex Media Server for ${this.config.title}`)
                    this._controller._library.readData(`${this.prefix}.Metadata`, s, `${this.prefix}`, undefined);
                }
            }
        } catch (err) {
            this._controller._adapter.log.debug(`Error 124: ${err}`);
        }
    }
}
class Lyric {
    constructor(adapter, library, key, prefix) {
        this._adapter = adapter;
        this._library = library;
        this.prefix = prefix;
        this.key = key;
        this.lyric = [];
        this.fullText = [];
        this.updateData(this.key, this.prefix);
    }

    updateTime(ms) {
        this.time = Date.now() - ms;
        if (this.updaterRef) {
            return;
        }
        this.lasttext = '';
        updater(this);

        function updater(self) {
            if (self.unload || self.stopped) {
                self.updaterRef = null;
                return;
            }
            const ms = Date.now() - self.time;
            const result = self.lyric.filter(l => l.startOffset <= ms && l.endOffset >= ms) || [];
            for (const r in result) {
                result[r] = result[r].text;
            }
            const newtext = result.join(' - ') || '';
            if (self.lasttext !== newtext) {
                self.lasttext = newtext;
                self._library.set(
                    {
                        node: `${self.prefix}.currentText`,
                        role: 'text',
                        type: 'string',
                        description: 'Lyrics currently being played',
                    },
                    self.lasttext,
                );
            }
            self.updaterRef = self._adapter.setTimeout(updater, 100, self);
        }
    }

    stop() {
        this.stopped = true;
        if (this.updaterRef) {
            this._adapter.clearTimeout(this.updaterRef);
        }
        this.updaterRef = null;
        this._library.set(
            {
                node: `${this.prefix}.currentText`,
                role: 'text',
                type: 'string',
                description: 'Lyrics currently being played',
            },
            '',
        );
    }

    delete() {
        this.unload = true;
        this.stop();
    }

    async updateData(key, prefix) {
        this.key = key;
        this.prefix = prefix;
        this.stopped = false;
        if (this.key && this.prefix) {
            this.lyric = [];
            this.fullText = [];
            try {
                const options = {
                    ...this._library.AXIOS_OPTIONS,
                    method: 'GET',
                    // not work with https
                    url: `http://${this._adapter.config.plexIp}:${this._adapter.config.plexPort}${key}?X-Plex-Token=${this._adapter.config.plexToken}`,
                    Accept: 'application/xml',
                };
                this._adapter.log.debug(`${options.url}`);
                const result = await axios(options);
                if (result) {
                    const templyric =
                        (result.data.MediaContainer &&
                            result.data.MediaContainer.Lyrics &&
                            result.data.MediaContainer.Lyrics[0] &&
                            result.data.MediaContainer.Lyrics[0].Line) ||
                        [];
                    // lyrics credits follow after 2 undefined span
                    let counter = 0;
                    this.noTimes = false;
                    for (let c = 0; c < templyric.length; c++) {
                        const o = templyric[c];
                        if (!o.Span) {
                            if (++counter > 1) {
                                break;
                            }
                            continue;
                        }
                        if (o.Span[0]) {
                            this.lyric.push(o.Span[0]);
                            if (o.Span[0].text) {
                                this.fullText.push(o.Span[0].text);
                            }
                            if (o.Span[0].startOffset) {
                                this.noTimes = true;
                            }
                        }
                        counter = 0;
                    }
                    this._library.set(
                        {
                            node: `${this.prefix}.fullText`,
                            role: 'json',
                            type: 'json',
                            description: 'Complete lyrics currently being played as an array',
                        },
                        JSON.stringify(this.fullText),
                    );
                    this._library.set(
                        {
                            node: `${this.prefix}.currentText`,
                            role: 'text',
                            type: 'string',
                            description: 'Lyrics currently being played',
                        },
                        '',
                    );
                    this._adapter.log.debug(`Lyric: ${JSON.stringify(this.lyric)}`);
                }
            } catch (error) {
                this._adapter.log.debug(`Error(141) ${error.toJson()}`);
            }
        }
    }
}
module.exports = { Controller };
