'use strict';

/**
 * Library
 *
 * @description Library of general functions as well as helping functions handling ioBroker
 * @author Zefau <https://github.com/Zefau/>
 * @license MIT
 * @version 0.27.1
 */

// eslint-disable-next-line
const newConstant = {};

/**
 * Library class containing various utility functions.
 */
class Library {
    /**
     * Returns the connection status of the adapter.
     *
     * @returns Connection status of the adapter
     */
    static get CONNECTION() {
        return {
            node: 'info.connection',
            description: 'Adapter Connection Status',
            role: 'indicator.connected',
            type: 'boolean',
        };
    }

    static garbageExcluded = [
        'Player.localAddress',
        'Player.port',
        'Player.protocolCapabilities',
        'Player.controllable',
    ];

    /**
     * Constructs a new Library instance.
     *
     * @param {object} adapter - The adapter instance.
     * @param {object} options - The options for the library.
     * @param {object} plex - The Plex instance.
     */
    constructor(adapter, options = {}, plex) {
        this.AXIOS_OPTIONS = {};

        this._adapter = adapter;
        this.options = options || {};

        this._plex = plex;
        this._nodes = this.options.nodes || {};
        this._actions = this.options.actions;
        this.options.updatesInLog = this.options.updatesInLog || false;
        this.options.updatesExceptions = this.options.updatesExceptions || [
            'timestamp',
            'datetime',
            'UTC',
            'localtime',
            'last_use_date',
            'lastSeen',
        ];

        this._STATES = {};
        this._SUBCSCRIPT_PLAYING = {};

        this.set({ node: 'info', description: 'Adapter Information', role: 'channel' });
        this.set(Library.CONNECTION, false);

        // check nodes for lowercase
        for (const a in this._nodes) {
            if (a != a.toLowerCase()) {
                this._adapter.log.warn(`${a} - ${a.toLowerCase()}`);
            }
        }
    }

    /**
     * Gets a node.
     *
     * @param	node			Node identifier
     * @param  [lowerCase] - Whether to convert the node identifier to lowercase.
     * @returns					Node
     */
    getNode(node, lowerCase = false) {
        const result =
            this._nodes[this.clean(node, lowerCase)] ||
            this._nodes[this.clean(node.replace(RegExp(/\.\d+\./, 'g'), '.'), lowerCase)];
        return JSON.parse(
            JSON.stringify(
                result || {
                    description: '(no description given)',
                    role: 'state',
                    type: 'string',
                    convert: null,
                    notExist: true,
                },
            ),
        );
    }

    /**
     * Terminate adapter.
     *
     * @param	[message]			Message to display
     * @param	[kill]										Whether to kill the adapter (red lights) or not (yellow lights)
     * @param	[reason]											Reason code for exit
     * @returns	void
     */
    terminate(message, kill, reason) {
        this.resetStates();
        this.set(Library.CONNECTION, false);
        message = message ? message : 'Terminating adapter due to error!';

        // yellow lights
        if (!kill) {
            this._adapter.log.warn(message);
        } else if (kill === true) {
            // red lights
            this._adapter.log.error(message);

            // delay necessary to actually show the error message
            setTimeout(
                () =>
                    this._adapter && this._adapter.terminate
                        ? this._adapter.terminate(message, reason || 11)
                        : process.exit(reason || 11),
                2000,
            );
        }

        return false;
    }

    /**
     * Remove specials characters from string.
     *
     * @param	string																												String to proceed
     * @param	lowerCase =false																									If String shall be return in lower case
     * @param    [n1] - Optional parameter n1
     * @param    [n2] - Optional parameter n2
     * @returns																														Cleaned String
     */
    clean(string, lowerCase, n1, n2) {
        if (!string && typeof string != 'string') {
            return string;
        }
        if (n1 !== undefined || n2 !== undefined) {
            this._adapter.log.warn('library error 101, please create a github issue');
        }

        string = string.replace(this._adapter.FORBIDDEN_CHARS, '#');

        return lowerCase ? string.toLowerCase() : string;
    }
    /**
     * Replaces a substring in the given description with another substring.
     *
     * @param {string|object} description - The description to be modified. Can be a string or an object with string values.
     * @param {string|RegExp} a - The substring or regular expression to be replaced.
     * @param {string} b - The substring to replace with.
     * @returns {string | object} - The modified description.
     */
    replaceDescription(description, a, b) {
        let result = {};
        if (typeof description == 'string') {
            result = description.replace(a, b);
        } else {
            for (const obj in description) {
                result[obj] = description[obj].replace(a, b);
            }
        }
        return result;
    }
    /**
     * Appends a substring to the given description.
     *
     * @param {string|object} description - The description to be modified. Can be a string or an object with string values.
     * @param {string} app - The substring to append.
     * @returns {string|object} - The modified description with the appended substring.
     */
    appendToDescription(description, app) {
        let result = {};
        if (typeof description == 'string') {
            result = description + app;
        } else {
            for (const obj in description) {
                result[obj] = description[obj] + app;
            }
        }
        return result;
    }
    /**
     * set common.type and common.role to predefined values from _NODES.js
     *
     * @param	state		state to extend
     * @returns	void
     */
    async extendState(state) {
        // ignore _refresh dp
        if (state.indexOf('._refresh') !== -1) {
            return;
        }

        let node = undefined;
        // _ACTIONS
        if (state.indexOf('._Controls.') !== -1) {
            const appendix = state.substring(state.indexOf('._Controls.') + '._Controls.'.length).split('.');
            if (
                this._actions[appendix[0]] &&
                this._actions[appendix[0]][appendix[1]] &&
                this._actions[appendix[0]][appendix[1]].type
            ) {
                node = {
                    type: this._actions[appendix[0]][appendix[1]].type,
                    role: this._actions[appendix[0]][appendix[1]].role,
                };
            }
        } else {
            // _NODES
            const splitState = state
                .replace(`${this._adapter.name}.${this._adapter.instance}.`, '')
                .toLowerCase()
                .split('.');
            let prefix = splitState.shift();
            if (prefix == '_playing') {
                prefix = 'playing';
            }
            for (const p of prefix === 'events' ? ['events', 'playing'] : [prefix]) {
                prefix = p;
                while (0 < splitState.length) {
                    const n = `${prefix}.${splitState.join('.')}`;
                    node = this.getNode(n);
                    if (!node.notExist) {
                        break;
                    }
                    splitState.shift();
                }
                if (!node.notExist) {
                    break;
                }
            }
        }
        if (node !== undefined && !node.notExist) {
            try {
                await this._adapter.extendObjectAsync(state, {
                    common: {
                        type: node.role !== 'device' || node.role !== 'channel' ? undefined : node.type,
                        role: node.role !== 'device' || node.role !== 'channel' ? undefined : node.role,
                    },
                });
            } catch (error) {
                this._adapter.log.error(error);
            }
        }
    }
    /**
     * Waits for a specific time before invoking a callback.
     *
     * @param	time		Time to wait before invoking the callback
     * @param	callback	Callback to be invoked
     * @returns	void
     */
    wait(time, callback) {
        return setTimeout(() => callback(), time);
    }

    /**
     * Encode a string.
     *
     * @param	key			Key used for encoding
     * @param	string		String to encode
     * @returns				Encoded String
     */
    encode(key, string) {
        let result = '';
        for (let i = 0; i < string.length; i++) {
            result += String.fromCharCode(key[i % key.length].charCodeAt(0) ^ string.charCodeAt(i));
        }

        return result;
    }

    /**
     * Decode a string.
     *
     * @param	key			Key used for decoding
     * @param	string		String to decode
     * @returns				Decoded String
     */
    decode(key, string) {
        return this.encode(key, string);
    }

    /**
     * Get a random key.
     *
     * @param	length		Length of key
     * @returns				Key
     */
    getKey(length) {
        length = length || 8;
        let key = '';

        while (key.length < length) {
            key +=
                parseInt(Math.random().toString().substring(2, 3)) >= 5
                    ? Math.random().toString(36).substring(2, 4)
                    : Math.random().toString(36).substring(2, 4).toUpperCase();
        }

        return key.slice(0, length);
    }

    /**
     * Convert an integer to IP.
     *
     * @param	number		Number to be converted to IP address
     * @returns				Converted IP address
     */
    getIP(number) {
        const ip = [];
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
     * @param	receiver - The name of the adapter to send the message to.
     * @param	{string} command - The command to be sent to the receiver.
     * @param			message		Message to send to receiver, shall be an object and will be converted to such if another is given
     * @param {Function} [callback] - A callback function to be executed after the message is sent.
     */
    msg(receiver, command, message, callback) {
        this._adapter.sendTo(
            receiver,
            command,
            typeof message !== 'object' ? { message: message } : message,
            callback === undefined ? function () {} : callback,
        );
    }

    /**
     * Capitalize first letter of a string
     *
     * @param	str			String to capitalize
     * @returns {string} - The string with the first letter capitalized.
     */
    ucFirst(str) {
        return str.charAt(0).toUpperCase() + str.slice(1);
    }

    /**
     * Convert a date to timestamp.
     *
     * @param		date		Datetime to parse
     * @returns					parsed Timestamp
     */
    getTimestamp(date) {
        if (date === undefined || !date) {
            return 0;
        }

        const ts = new Date(date).getTime();
        return isNaN(ts) ? 0 : ts;
    }

    /**
     * Convert a timestamp to datetime.
     *
     * @param	ts			Timestamp to be converted to date-time format (in ms)
     * @returns				Timestamp in date-time format
     */
    getDateTime(ts) {
        if (ts === undefined || ts <= 0 || ts == '') {
            return '';
        }

        const date = new Date(ts);
        const day = `0${date.getDate()}`;
        const month = `0${date.getMonth() + 1}`;
        const year = date.getFullYear();
        const hours = `0${date.getHours()}`;
        const minutes = `0${date.getMinutes()}`;
        const seconds = `0${date.getSeconds()}`;
        return `${day.slice(-2)}.${month.slice(-2)}.${year} ${hours.slice(-2)}:${minutes.slice(-2)}:${seconds.slice(
            -2,
        )}`;
    }

    /**
     * Get all instances of an adapter.
     *
     * @param	adapter		Adapter to get instances of
     * @param	callback	Callback to invoke
     */
    getAdapterInstances(adapter, callback) {
        this._adapter.objects.getObjectView(
            'system',
            'instance',
            { startkey: `system.adapter.${adapter}.`, endkey: `system.adapter.${adapter}.\u9999` },
            (err, instances) => {
                if (instances && instances.rows) {
                    const result = [];
                    instances.rows.forEach(instance =>
                        result.push({
                            id: instance.id.replace('system.adapter.', ''),
                            config: instance.value.native.type,
                        }),
                    );
                    callback(null, result);
                } else {
                    callback(`Could not retrieve ${adapter} instances!`);
                }
            },
        );
    }

    runGarbageCollector = async (state, del = false, offset = 60000, whitelist = []) => {
        this._adapter.log.debug(`Running Garbage Collector for ${state}...`);
        return new Promise(resolve => {
            this._adapter.getStates(`${state}.*`, async (err, states) => {
                try {
                    if (err || !states) {
                        resolve(false);
                    }

                    // loop through states
                    let key;
                    for (const state in states) {
                        key = state.replace(`${this._adapter.name}.${this._adapter.instance}.`, '');

                        if (
                            this._STATES[key] &&
                            this._STATES[key].ts < Date.now() - offset &&
                            !(whitelist.length > 0 && RegExp(whitelist.join('|')).test(state))
                        ) {
                            // apply deletion
                            this._adapter.log.debug(`Garbage Collector: ${del ? 'Deleted ' : 'Emptied '}${state}!`);

                            if (del) {
                                try {
                                    this._STATES[key] = undefined;
                                    await this._adapter.delObjectAsync(state);
                                } catch (error) {
                                    this._adapter.log.warn(JSON.stringify(error));
                                }
                            } else {
                                try {
                                    const val = await this._adapter.getObjectAsync(key);
                                    let emptyVal;
                                    switch (val.common.type) {
                                        case 'string':
                                            emptyVal = '';
                                            break;
                                        case 'number':
                                            emptyVal = 0;
                                            break;
                                        case 'boolean':
                                            emptyVal = false;
                                            break;
                                        default:
                                            emptyVal = null;
                                    }
                                    this._setValue(key, emptyVal, { force: true });
                                } catch (error) {
                                    this._adapter.log.warn(error);
                                }
                            }
                        }
                    }
                } catch (error) {
                    this._adapter.log.warn(`error 123${error}`);
                }

                return resolve(true);
            });
        });
    };

    /**
     * Get a device state.
     *
     * @param {string} state - The state identifier.
     * @param {string} property - The property to retrieve from the device state.
     */
    getDeviceState(state, property = 'val') {
        return this._STATES[state] !== undefined && this._STATES[state] ? this._STATES[state][property] || false : null;
    }

    /**
     * Get a device state json, to read last state after restart.
     *
     * @param {string} state - The state identifier.
     * @param {string} property - The property to retrieve from the device state.
     */
    getDeviceStateJson(state, property = 'val') {
        const result = {};
        for (const id in this._STATES) {
            if (id.startsWith(`${state}.`)) {
                const val =
                    this._STATES[id] !== undefined && this._STATES[id] ? this._STATES[id][property] || false : null;
                Object.assign(result, _helper(result, id.replace(`${state}.`, '').split('.'), val));
            }
        }
        return result;
        function _helper(res, key, val, deep = 0) {
            if (key.length > 1) {
                const k = key.splice(0, 1);
                res[k] = res[k] || {};
                try {
                    Object.assign(res[k], _helper(res[k], key, val, deep + 1));
                } catch {
                    res[k] = res[k] || {};
                }
            } else {
                if (key == '_data') {
                    res = JSON.parse(val);
                } else if (deep == 0) {
                    res[key] = val;
                }
            }
            return res;
        }
    }

    /**
     * Set a device state.
     *
     * @param {string} state - The state identifier.
     * @param value - The value to be set for the state.
     */
    setDeviceState(state, value) {
        if (
            (this._STATES[state] === null || this._STATES[state] === undefined || this._STATES[state].val != value) &&
            this._adapter &&
            this._adapter.log &&
            ((this.options.updatesInLog && !this.options.updatesExceptions) ||
                (this.options.updatesInLog &&
                    this.options.updatesExceptions &&
                    Array.isArray(this.options.updatesExceptions) &&
                    this.options.updatesExceptions.indexOf(state.slice(state.lastIndexOf('.') + 1)) == -1))
        ) {
            this._adapter.log.debug(
                `Updated state ${state} to value ${value} (from ${this._STATES[state] && this._STATES[state].val}).`,
            );
        }

        return this.setDeviceProperties(state, {
            val: value,
        });
    }

    /**
     * Set a device properties.
     *
     * @param {string} state - The state identifier.
     * @param {object} [properties] - Additional properties for the node.
     */
    setDeviceProperties(state, properties) {
        const oldval = this._STATES[state] && this._STATES[state].val;
        this._STATES[state] = { ...(this._STATES[state] || {}), ...(properties || {}), ts: Date.now() };
        this.checkSubscribeNode(state, this._STATES[state].val, oldval);
        return true;
    }

    /**
     * Checks if a node is subscribed and triggers the callback if the value has changed.
     *
     * @param {string} state - The state of the node.
     * @param {any} val - The new value of the node.
     * @param {any} oldval - The old value of the node.
     * @returns {boolean} - Returns true if the node is subscribed and the callback is triggered, otherwise false.
     */
    checkSubscribeNode(state, val, oldval) {
        if (
            !state ||
            this._STATES[state] === undefined ||
            !state.startsWith('_playing') ||
            state.indexOf('_recent') !== -1
        ) {
            return false;
        }

        // player name can have dots and - so split at name-uuid and remove _playing.name, then uuid
        const stateParts = state.split('-').pop();
        const node = stateParts ? stateParts.split('.').slice(1).join('.') : '';
        const lowNode = node.toLowerCase();
        if (oldval != val && this._SUBCSCRIPT_PLAYING[lowNode] !== undefined) {
            const prefix = state.replace(`.${node}`, '');
            this._SUBCSCRIPT_PLAYING[lowNode](state, prefix, val, oldval);
            this._adapter.log.debug(
                `Internal subscripted node:${lowNode} state: ${state} change from: ${oldval} to: ${val}`,
            );
            return true;
        }
        return false;
    }

    /**
     * Subscribes or unsubscribes a node with a callback function.
     *
     * @param {string} node - The node to subscribe or unsubscribe.
     * @param {Function} [callback] - The callback function to be called when the node value changes. If undefined, the node is unsubscribed.
     */
    subscribeNode(node, callback) {
        if (node && this._SUBCSCRIPT_PLAYING[node] !== undefined) {
            if (callback !== undefined && typeof callback == 'function') {
                this._SUBCSCRIPT_PLAYING[node] = callback;
            } else {
                delete this._SUBCSCRIPT_PLAYING[node];
            }
        }
    }

    /**
     * Deletes the specified state and its associated objects.
     *
     * @param {string} state - The state to be deleted.
     * @param {boolean} nested - If true, delete all nested states under the specified state.
     * @param {Function} callback - A callback function to be executed after the deletion is complete.
     */
    del(state, nested, callback) {
        // create state to have at least one deletion (in case no states exist at all)
        this._createNode({ node: state, description: 'DELETED' }, () => {
            // get state tree
            this._adapter.getStates(nested ? `${state}.*` : state, (err, objects) => {
                let deleted = 0;
                objects = Object.keys(objects);
                objects.push(state);

                this._adapter.log.silly(`Found ${objects.length} objects in state ${state} to delete..`);
                objects.forEach(object => {
                    this._adapter.delObject(object, () => {
                        this._STATES[object.replace(`${this._adapter.namespace}.`, '')] = undefined;
                        deleted++;

                        if (deleted == objects.length) {
                            this._adapter.log.debug(`Deleted state ${state} with ${deleted} objects.`);
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
     * @param {object} values - The values to be set for the nodes.
     * @param {object} nodes - The nodes to be created or updated.
     * @param {object} [options] - Additional options for setting the values.
     */
    setMultiple(values, nodes, options = {}) {
        for (const key in values) {
            if (nodes[key] && nodes[key].node && nodes[key].description) {
                const node = nodes[key];
                let value = values[key];

                // replace options if given
                options.placeholders = options.placeholders || {};
                for (const placeholder in options.placeholders) {
                    node.node = node.node.replace(placeholder, options.placeholders[placeholder]);
                    node.description = node.description.replace(placeholder, options.placeholders[placeholder]);
                }

                // convert data if necessary
                switch (node.convert) {
                    case 'string':
                        if (value && Array.isArray(value)) {
                            value = value.join(', ');
                        }
                        break;

                    case 'datetime':
                        this.set(
                            {
                                node: `${node.node}Datetime`,
                                description: node.description.replace('Timestamp', 'Date-Time'),
                                common: { type: 'string', role: 'text' },
                            },
                            value ? this.getDateTime(value * 1000) : '',
                        );
                        break;
                }

                // set node
                this.set(node, value, options);
            }
        }
    }

    /**
     * Confirms and sets the value of a node if it exists in the current state.
     *
     * @param node - The node object containing node information.
     * @param value - The value to set for the node.
     *
     * Logs a debug message if the node or its state does not exist.
     * If the node exists, its value is set with the option to force the update.
     */
    confirmNode(node, value) {
        if (!node || node.node === undefined || this._STATES[node.node] === undefined) {
            this._adapter.log.debug(`confimNode node.node not exist: ${node ? node.node : 'node undefined'}`);
            return;
        }
        this._setValue(node.node, value, { force: true });
    }

    /**
     * Sets the value of a node. If the node does not exist, it will be created.
     *
     * @param {object} node - The node to set the value for.
     * @param {any} [value] - The value to set for the node.
     * @param {object} [options] - Additional options for setting the value.
     */
    set(node, value, options = {}) {
        // catch error
        if (!node || !node.node || (node.name === undefined && node.description === undefined)) {
            this._adapter.log.error(`Error: State not properly defined (${JSON.stringify(node)})!`);
        }

        // create node
        if (this._STATES[node.node] === undefined) {
            // Do not create empty states - only states with value make sense
            if (value !== '' || node.role == 'channel') {
                this._createNode(node, () => this.set(node, value, options));
            }
        } else {
            // set value
            // dont write to device or channel
            if (node.role == 'device' || node.role == 'channel') {
                return;
            }

            // datatypes change between number and string and bool depend on source
            const type = (node.common && node.common.type) || node.type || 'string';
            value = this.convertToType(value, type);
            this._setValue(node.node, value, options);
        }
    }
    /**
     * Creates an object (channel or state).
     *
     * @param	{object} node - The node object containing node information.
     * @param	callback				Callback function to be invoked
     * @returns	void
     */
    _createNode(node, callback) {
        if (!this._adapter) {
            return Promise.reject('Adapter not defined!');
        }

        // remap properties to common
        const type =
            node.role == 'device' || node.role == 'channel' ? (node.role == 'device' ? 'device' : 'channel') : 'state';
        let common = {
            name: node.name || node.description,
            role: (node.common && node.common.role) || node.role || 'state',
            type: (node.common && node.common.type) || node.type || 'string',
            write: false,
            ...(node.common || {}),
        };

        // special roles
        if (common.role.indexOf('button') > -1) {
            common = { ...common, type: 'boolean', read: false, write: true };
        }

        if (common.role == 'device' || common.role == 'channel') {
            common = { ...common, type: undefined, role: undefined };
        }

        // create object
        this._adapter.setObjectNotExists(
            node.node,
            {
                common: common,
                type: type,
                native: node.native || {},
            },
            () => {
                this._STATES[node.node] = null;
                callback && callback();
            },
        );
    }
    /**
     * Convert a value to the given type
     *
     * @param value 	then value to convert
     * @param type 					the target type
     * @returns {any} - The converted value.
     */
    convertToType(value, type) {
        if (type === undefined) {
            return value;
        }
        if (value === undefined) {
            value = '';
        }
        const old_type = typeof value;

        let newValue = value;
        try {
            if (type !== old_type) {
                switch (type) {
                    case 'string':
                        newValue = value.toString() || '';
                        break;
                    case 'number':
                        newValue = value ? Number(value) : 0;
                        break;
                    case 'boolean':
                        newValue = !!value;
                        break;
                }
            }
        } catch {
            // get a warning message when we try to convert a object/array.
            this._adapter.log.warn(`State has wrong common.typ:${type} should be:${old_type}`);
            return value;
        }
        return newValue;
    }
    /**
     * Sets a value of a state.
     *
     * @param	state					State the value shall be set
     * @param	value					Value to be set
     * @param	{object}[options]			Additional options
     * @returns	void
     */
    async _setValue(state, value, options = {}) {
        if (state !== undefined) {
            try {
                if (
                    value !== undefined &&
                    (options.force ||
                        this._STATES[state] === undefined ||
                        this._STATES[state] === null ||
                        this._STATES[state].val != value)
                ) {
                    //if (state.indexOf('viewOffsethu') != -1) this._adapter.log.debug(`Write new Value ${value} to ${state}`)
                    await this._adapter.setStateAsync(state, {
                        val: typeof value === 'object' ? JSON.stringify(value) : value,
                        ts: Date.now(),
                        ack: true,
                    });
                    this.setDeviceState(state, value);
                } else {
                    this.setDeviceProperties(state);
                }
            } catch {
                //nothing
            }
        }
    }

    /**
     * Reset all states.
     *
     * @returns {void}
     */
    resetStates() {
        this._STATES = {};
    }

    /**
     * Read and write data received from event
     *
     * @param {string} key - The key to read data from.
     * @param {any} data - The data to be read and processed.
     * @param prefix - The prefix to be used for the node.
     * @param {object} properties - Additional properties for the node.
     * @param expandNestedData if true expand json objects
     */
    readData(key, data, prefix, properties, expandNestedData = false) {
        // only proceed if data is given
        if (data === undefined || data === 'undefined') {
            return false;
        }

        // get node details
        let nodeKey = key;
        nodeKey = nodeKey.replace(/\[0-9]{3}\./gi, '.');
        nodeKey = (nodeKey.search(/\.[0-9]{3}/gi) != -1 && `${nodeKey.replace(/\.[0-9]{3}/gi, '')}.list`) || nodeKey;

        nodeKey =
            nodeKey.indexOf('_playing') > -1
                ? `playing${nodeKey.substr(nodeKey.indexOf('.', prefix.length))}`
                : nodeKey;

        let node = this.getNode(nodeKey, true);

        if (node.notExist && prefix == 'events') {
            nodeKey = nodeKey.replace(/^events\./gi, 'playing.');
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
        if (typeof data == 'object') {
            // flatten nested data in one state (tag or name)
            if (Array.isArray(data) && !this._adapter.config.getMetadataTrees) {
                if (data.length) {
                    this.set(
                        {
                            node: key,
                            type: node.type,
                            role: node.role,
                            description: node.description,
                        },
                        data.map(item => (item.tag ? item.tag : item.name)).join(', '),
                        properties,
                    );
                }

                key = `${key}Tree`;
            }

            // create channel
            if (
                Object.keys(data).length > 0 &&
                (key.indexOf('Tree') === -1 || (key.indexOf('Tree') > -1 && this._adapter.config.getMetadataTrees))
            ) {
                // channel
                this.set(
                    {
                        node: key,
                        role: node.notExist ? 'channel' : node.role,
                        // eslint-disable-next-line
                        'description': node.notExist ? RegExp('.[0-9]{3}$').test(key.substr(-4)) ? 'Index ' + key.substr(key.lastIndexOf('.')+1) : this.ucFirst(key.substr(key.lastIndexOf('.')+1).replace('Tree', '')) + ' Information' : node.description
                    },
                    undefined,
                    properties,
                );

                // read nested data
                let indexKey;
                for (const nestedKey1 in data) {
                    const nestedKey = parseInt(nestedKey1);
                    indexKey =
                        nestedKey >= 0 && nestedKey < 100
                            ? nestedKey >= 0 && nestedKey < 10
                                ? `00${nestedKey}`
                                : `0${nestedKey}`
                            : nestedKey;

                    if (data[nestedKey] !== undefined && data[nestedKey] !== 'undefined') {
                        if (
                            typeof data[nestedKey] == 'object' &&
                            (!Array.isArray(data[nestedKey]) ||
                                (Array.isArray(data[nestedKey]) && this._adapter.config.getMetadataTrees)) &&
                            !expandNestedData
                        ) {
                            this.set(
                                {
                                    node: `${key}.${Array.isArray(data[nestedKey]) ? `${nestedKey}Tree` : indexKey}._data`,
                                    role: this.getNode('_data').role,
                                    type: this.getNode('_data').type,
                                    description: this.getNode('_data').description,
                                },
                                JSON.stringify(data[nestedKey]),
                                properties,
                            );
                        }

                        this.readData(`${key}.${indexKey}`, data[nestedKey], prefix, undefined, expandNestedData);
                    }
                }
            }
        } else {
            // write to states
            // convert data
            node.key = key;
            node.nodeKey = nodeKey;
            data = this.convertNode(node, data);

            // set data
            this.set(
                {
                    node: key,
                    type: node.type,
                    role: node.role,
                    description: node.description,
                    common: node.common != undefined ? node.common : undefined,
                },
                data,
                properties,
            );
        }
    }

    /**
     * Converts the node data based on the specified conversion function.
     *
     * @param {object} node - The node to be converted.
     * @param {any} data - The data to be converted.
     * @returns {any} - The converted data.
     */
    convertNode(node, data) {
        if (!(node && node.convert)) {
            return data;
        }
        let date;
        switch (node.convert.func) {
            case 'date-timestamp':
                // convert timestamp to date
                if (data.toString().indexOf('-') > -1) {
                    date = data;
                    data = Math.floor(new Date(data).getTime() / 1000);
                } else {
                    // or keep date if that is given
                    const ts = new Date(data * 1000);
                    date = `${ts.getFullYear()}-${`0${ts.getMonth()}`.substr(-2)}-${`0${ts.getDate()}`.substr(-2)}`;
                }

                // set date
                this.set(
                    {
                        node: `${node.key}Date`,
                        type: 'string',
                        role: 'text',
                        description: this.getNode(`${node.nodeKey}Date`, true).description,
                    },
                    date,
                );
                break;
            case 'seconds-readable': {
                const d = new Date(Number(data));
                let value = d.getUTCHours() > 0 ? d.getUTCHours().toString() : '';
                value += value
                    ? `:${`0${d.getUTCMinutes()}`.slice(-2)}`
                    : `${d.getUTCMinutes().toString()}:${`0${d.getUTCSeconds().toString()}`.slice(-2)}`;
                this.set(
                    {
                        node: `${node.key}human`,
                        type: 'string',
                        role: 'text',
                        description: this.getNode(`${node.nodeKey}human`, true).description,
                    },
                    value,
                );
                this.set(
                    {
                        node: `${node.key}Seconds`,
                        type: 'number',
                        role: 'media.elapsed',
                        description: this.getNode(`${node.nodeKey}Seconds`, true).description,
                    },
                    Math.floor(Number(data) / 1000),
                );
                break;
            }
            case 'ms-min': {
                const duration = data / 1000;
                this.set(
                    {
                        node: `${node.key}Seconds`,
                        type: 'number',
                        role: 'media.duration',
                        description: this.getNode(`${node.nodeKey}Seconds`, true).description,
                    },
                    duration < 1 ? data * 60 : Math.floor(duration),
                );
                return duration < 1 ? data : Math.floor(duration / 60);
            }
            case 'create-link':
            case 'create-link-only': {
                const link = data
                    ? `${this.AXIOS_OPTIONS._protocol}//${this._adapter.config.plexIp}:${this._adapter.config.plexPort}${data}?X-Plex-Token=${this._adapter.config.plexToken}`
                    : '';
                if (node.convert.func == 'create-link-only') {
                    return link;
                }
                this.set(
                    {
                        node: node.key + node.convert.key,
                        type: node.convert.type,
                        role: node.convert.role,
                        description: this.getNode(node.nodeKey + node.convert.key, true).description,
                    },
                    link,
                );
                break;
            }
        }

        return data;
    }

    /**
     * Retrieves an item from the Plex library.
     *
     * @param {string} item - The item path to query.
     * @returns {Promise<object>} - A promise that resolves to the item details.
     */
    getItem(item) {
        if (!item || typeof item !== 'string') {
            return Promise.resolve({});
        }

        return new Promise((resolve, reject) => {
            this._plex.query(item).then(
                function (result) {
                    if (!result || !result.MediaContainer) {
                        return resolve({});
                    }
                    return resolve(result.MediaContainer);
                },
                function (err) {
                    return reject(err);
                },
            );
        });
    }

    /**
     * Clones an object by performing a deep copy.
     *
     * @param {object} obj - The object to be cloned.
     * @returns {object} - The cloned object.
     */
    static cloneObj(obj) {
        return JSON.parse(JSON.stringify(obj));
    }
}

module.exports = Library;
