import type { PlexHttp } from './plexHttp';

export interface NodeDef {
    description?: string;
    role?: string;
    type?: ioBroker.CommonType;
    convert?: any;
    notExist?: boolean;
    states?: Record<string, string>;
    common?: any;
    key?: string;
    nodeKey?: string;
    [k: string]: any;
}

export interface SetNode {
    node: string;
    description?: string;
    name?: string;
    role?: string;
    type?: ioBroker.CommonType;
    common?: Record<string, any>;
    native?: Record<string, any>;
    [k: string]: any;
}

export interface LibraryOptions {
    nodes?: Record<string, NodeDef>;
    actions?: Record<string, Record<string, any>>;
    updatesInLog?: boolean;
    updatesExceptions?: string[];
    [k: string]: any;
}

interface StateEntry {
    val?: any;
    ts?: number;
    [k: string]: any;
}

interface SetValueOptions {
    force?: boolean;
    [k: string]: any;
}

type SubscribeCallback = (state: string, prefix: string, val: any, oldval: any) => void;

/**
 * Library class containing various utility functions.
 */
export class Library {
    static get CONNECTION(): SetNode {
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

    public AXIOS_OPTIONS: Record<string, any> = {};
    public _adapter: ioBroker.Adapter;
    public options: LibraryOptions;
    public _plex: PlexHttp | undefined;
    public _nodes: Record<string, NodeDef>;
    public _actions: Record<string, Record<string, any>>;
    public _STATES: Record<string, StateEntry | null | undefined> = {};
    public _SUBCSCRIPT_PLAYING: Record<string, SubscribeCallback> = {};

    constructor(adapter: ioBroker.Adapter, options: LibraryOptions = {}, plex?: PlexHttp) {
        this._adapter = adapter;
        this.options = options || {};
        this._plex = plex;
        this._nodes = this.options.nodes || {};
        this._actions = this.options.actions || {};
        this.options.updatesInLog = this.options.updatesInLog || false;
        this.options.updatesExceptions = this.options.updatesExceptions || [
            'timestamp',
            'datetime',
            'UTC',
            'localtime',
            'last_use_date',
            'lastSeen',
        ];

        void this.set({ node: 'info', description: 'Adapter Information', role: 'channel' });
        void this.set(Library.CONNECTION, false);

        for (const a in this._nodes) {
            if (a != a.toLowerCase()) {
                this._adapter.log.warn(`${a} - ${a.toLowerCase()}`);
            }
        }
    }

    /**
     * Gets a node.
     *
     * @param node Node identifier
     * @param lowerCase Whether to convert the node identifier to lowercase
     */
    getNode(node: string, lowerCase = false): NodeDef {
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
     * @param message Message to display
     * @param kill Whether to kill the adapter (red lights) or not (yellow lights)
     * @param reason Reason code for exit
     */
    terminate(message?: string, kill?: boolean, reason?: number): boolean {
        this.resetStates();
        void this.set(Library.CONNECTION, false);
        const msg = message ? message : 'Terminating adapter due to error!';

        if (!kill) {
            this._adapter.log.warn(msg);
        } else if (kill === true) {
            this._adapter.log.error(msg);
            setTimeout(() => this._adapter.terminate(msg, reason || 11), 5000);
        }

        return false;
    }

    /**
     * Remove special characters from string.
     *
     * @param string String to proceed
     * @param lowerCase If String shall be returned in lower case
     * @param n1 deprecated
     * @param n2 deprecated
     */
    clean(string: string, lowerCase = false, n1?: unknown, n2?: unknown): string {
        if (!string && typeof string != 'string') {
            return string;
        }
        if (n1 !== undefined || n2 !== undefined) {
            this._adapter.log.warn('library error 101, please create a github issue');
        }

        const cleaned = string.replace((this._adapter as any).FORBIDDEN_CHARS, '#');
        return lowerCase ? cleaned.toLowerCase() : cleaned;
    }

    replaceDescription(
        description: string | Record<string, string>,
        a: string | RegExp,
        b: string,
    ): string | Record<string, string> {
        if (typeof description == 'string') {
            return description.replace(a, b);
        }
        const result: Record<string, string> = {};
        for (const obj in description) {
            result[obj] = description[obj].replace(a, b);
        }
        return result;
    }

    appendToDescription(description: string | Record<string, string>, app: string): string | Record<string, string> {
        if (typeof description == 'string') {
            return description + app;
        }
        const result: Record<string, string> = {};
        for (const obj in description) {
            result[obj] = description[obj] + app;
        }
        return result;
    }

    async extendState(state: string): Promise<void> {
        if (state.indexOf('._refresh') !== -1) {
            return;
        }

        let node: NodeDef | undefined = undefined;
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
            const splitState = state
                .replace(`${this._adapter.name}.${this._adapter.instance}.`, '')
                .toLowerCase()
                .split('.');
            let prefix = splitState.shift() ?? '';
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
                if (node && !node.notExist) {
                    break;
                }
            }
        }
        if (node !== undefined && !node.notExist) {
            try {
                // The two-branch ternary below is a long-standing tautology (always undefined).
                // Per CLAUDE.md, do not "fix" no-op lines; preserved verbatim from the JS source.
                const roleAny = node.role as any;
                await this._adapter.extendObjectAsync(state, {
                    common: {
                        type: roleAny !== 'device' || roleAny !== 'channel' ? undefined : node.type,
                        role: roleAny !== 'device' || roleAny !== 'channel' ? undefined : node.role,
                    } as any,
                });
            } catch (error: unknown) {
                this._adapter.log.error(error instanceof Error ? error.message : String(error));
            }
        }
    }

    wait(time: number, callback: () => void): NodeJS.Timeout {
        return setTimeout(() => callback(), time);
    }

    encode(key: string, string: string): string {
        let result = '';
        for (let i = 0; i < string.length; i++) {
            result += String.fromCharCode(key[i % key.length].charCodeAt(0) ^ string.charCodeAt(i));
        }
        return result;
    }

    decode(key: string, string: string): string {
        return this.encode(key, string);
    }

    getKey(length?: number): string {
        const len = length || 8;
        let key = '';
        while (key.length < len) {
            key +=
                parseInt(Math.random().toString().substring(2, 3)) >= 5
                    ? Math.random().toString(36).substring(2, 4)
                    : Math.random().toString(36).substring(2, 4).toUpperCase();
        }
        return key.slice(0, len);
    }

    getIP(num: number): string {
        const ip: number[] = [];
        ip.push(num & 255);
        ip.push((num >> 8) & 255);
        ip.push((num >> 16) & 255);
        ip.push((num >> 24) & 255);
        ip.reverse();
        return ip.join('.');
    }

    msg(receiver: string, command: string, message: any, callback?: ioBroker.MessageCallbackInfo | (() => void)): void {
        this._adapter.sendTo(
            receiver,
            command,
            typeof message !== 'object' ? { message } : message,
            callback === undefined ? () => {} : (callback as any),
        );
    }

    ucFirst(str: string): string {
        return str.charAt(0).toUpperCase() + str.slice(1);
    }

    getTimestamp(date: any): number {
        if (date === undefined || !date) {
            return 0;
        }
        const ts = new Date(date).getTime();
        return isNaN(ts) ? 0 : ts;
    }

    getDateTime(ts: number | string | undefined): string {
        if (ts === undefined || ts === '' || (typeof ts === 'number' && ts <= 0)) {
            return '';
        }
        const date = new Date(ts);
        const day = `0${date.getDate()}`;
        const month = `0${date.getMonth() + 1}`;
        const year = date.getFullYear();
        const hours = `0${date.getHours()}`;
        const minutes = `0${date.getMinutes()}`;
        const seconds = `0${date.getSeconds()}`;
        return `${day.slice(-2)}.${month.slice(-2)}.${year} ${hours.slice(-2)}:${minutes.slice(-2)}:${seconds.slice(-2)}`;
    }

    getAdapterInstances(adapter: string, callback: (err: any, result?: any[]) => void): void {
        (this._adapter as any).objects.getObjectView(
            'system',
            'instance',
            { startkey: `system.adapter.${adapter}.`, endkey: `system.adapter.${adapter}.香` },
            (err: unknown, instances: any) => {
                if (instances && instances.rows) {
                    const result: any[] = [];
                    instances.rows.forEach((instance: any) =>
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

    runGarbageCollector = async (
        state: string,
        _del = false,
        offset = 60_000,
        whitelist: string[] = [],
    ): Promise<boolean> => {
        this._adapter.log.debug(`Running Garbage Collector for ${state}...`);
        return new Promise(resolve => {
            this._adapter.getStates(`${state}.*`, async (err, states) => {
                try {
                    if (err || !states) {
                        resolve(false);
                        return;
                    }

                    let key: string;
                    for (const stateId in states) {
                        key = stateId.replace(`${this._adapter.name}.${this._adapter.instance}.`, '');

                        const entry = this._STATES[key];
                        if (
                            entry &&
                            entry.ts !== undefined &&
                            entry.ts < Date.now() - offset &&
                            !(whitelist.length > 0 && RegExp(whitelist.join('|')).test(stateId))
                        ) {
                            this._adapter.log.debug(`Garbage Collector: Emptied ${stateId}!`);

                            try {
                                const val = await this._adapter.getObjectAsync(key);
                                let emptyVal: any;
                                switch ((val as any)?.common?.type) {
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
                                void this._setValue(key, emptyVal, { force: true });
                            } catch (error) {
                                this._adapter.log.warn(error instanceof Error ? error.message : String(error));
                            }
                        }
                    }
                } catch (error) {
                    this._adapter.log.warn(`error 123${error instanceof Error ? error.message : String(error)}`);
                }

                resolve(true);
            });
        });
    };

    getDeviceState(state: string, property = 'val'): any {
        const entry = this._STATES[state];
        return entry !== undefined && entry ? entry[property] || false : null;
    }

    getDeviceStateJson(state: string, property = 'val'): any {
        const result: any = {};
        for (const id in this._STATES) {
            if (id.startsWith(`${state}.`)) {
                const entry = this._STATES[id];
                const val = entry !== undefined && entry ? entry[property] || false : null;
                Object.assign(result, _helper(result, id.replace(`${state}.`, '').split('.'), val));
            }
        }
        return result;

        function _helper(res: any, key: string[], val: any, deep = 0): any {
            if (key.length > 1) {
                const k = key.splice(0, 1) as unknown as string;
                res[k as any] = res[k as any] || {};
                try {
                    Object.assign(res[k as any], _helper(res[k as any], key, val, deep + 1));
                } catch {
                    res[k as any] = res[k as any] || {};
                }
            } else {
                if (key[0] == '_data') {
                    res = JSON.parse(val);
                } else if (deep == 0) {
                    res[key[0]] = val;
                }
            }
            return res;
        }
    }

    setDeviceState(state: string, value: any): boolean {
        const entry = this._STATES[state];
        if (
            (entry === null || entry === undefined || entry.val != value) &&
            this._adapter &&
            this._adapter.log &&
            ((this.options.updatesInLog && !this.options.updatesExceptions) ||
                (this.options.updatesInLog &&
                    this.options.updatesExceptions &&
                    Array.isArray(this.options.updatesExceptions) &&
                    this.options.updatesExceptions.indexOf(state.slice(state.lastIndexOf('.') + 1)) == -1))
        ) {
            this._adapter.log.debug(`Updated state ${state} to value ${value} (from ${entry && entry.val}).`);
        }

        return this.setDeviceProperties(state, { val: value });
    }

    setDeviceProperties(state: string, properties?: StateEntry): boolean {
        const oldval = this._STATES[state] && this._STATES[state].val;
        this._STATES[state] = { ...(this._STATES[state] || {}), ...(properties || {}), ts: Date.now() };
        this.checkSubscribeNode(state, this._STATES[state].val, oldval);
        return true;
    }

    checkSubscribeNode(state: string, val: any, oldval: any): boolean {
        if (
            !state ||
            this._STATES[state] === undefined ||
            !state.startsWith('_playing') ||
            state.indexOf('_recent') !== -1
        ) {
            return false;
        }

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

    subscribeNode(node: string, callback?: SubscribeCallback): void {
        if (node && this._SUBCSCRIPT_PLAYING[node] !== undefined) {
            if (callback !== undefined && typeof callback == 'function') {
                this._SUBCSCRIPT_PLAYING[node] = callback;
            } else {
                delete this._SUBCSCRIPT_PLAYING[node];
            }
        }
    }

    clearStateCache(prefix: string): void {
        for (const key of Object.keys(this._STATES)) {
            if (key === prefix || key.startsWith(`${prefix}.`)) {
                this._STATES[key] = undefined;
            }
        }
    }

    async del(state: string, nested?: boolean, callback?: () => void): Promise<void> {
        this._adapter.getStates(nested ? `${state}.*` : state, async (_err, objects) => {
            const objectIds = Object.keys(objects || {});
            for (const objectId of objectIds) {
                const key = objectId.replace(`${this._adapter.namespace}.`, '');
                try {
                    await this._setValue(key, null, { force: true });
                } catch (error) {
                    this._adapter.log.warn(`del: ${error instanceof Error ? error.message : String(error)}`);
                }
            }
            this._adapter.log.debug(`Reset ${objectIds.length} states under ${state}.`);
            if (callback) {
                callback();
            }
        });
    }

    async setMultiple(values: Record<string, any>, nodes: Record<string, any>, options: any = {}): Promise<void> {
        for (const key in values) {
            if (nodes[key] && nodes[key].node && nodes[key].description) {
                const node = nodes[key];
                let value = values[key];

                options.placeholders = options.placeholders || {};
                for (const placeholder in options.placeholders) {
                    node.node = node.node.replace(placeholder, options.placeholders[placeholder]);
                    node.description = node.description.replace(placeholder, options.placeholders[placeholder]);
                }

                switch (node.convert) {
                    case 'string':
                        if (value && Array.isArray(value)) {
                            value = value.join(', ');
                        }
                        break;
                    case 'datetime':
                        await this.set(
                            {
                                node: `${node.node}Datetime`,
                                description: node.description.replace('Timestamp', 'Date-Time'),
                                common: { type: 'string', role: 'text' },
                            },
                            value ? this.getDateTime(value * 1000) : '',
                        );
                        break;
                }

                await this.set(node, value, options);
            }
        }
    }

    confirmNode(node: SetNode, value?: any): void {
        if (!node || node.node === undefined || this._STATES[node.node] === undefined) {
            this._adapter.log.debug(`confimNode node.node not exist: ${node ? node.node : 'node undefined'}`);
            return;
        }
        void this._setValue(node.node, value, { force: true });
    }

    async set(node: SetNode, value?: any, options: SetValueOptions = {}): Promise<void> {
        if (!node || !node.node || (node.name === undefined && node.description === undefined)) {
            this._adapter.log.error(`Error: State not properly defined (${JSON.stringify(node)})!`);
        }

        if (this._STATES[node.node] === undefined) {
            if (value !== '' || node.role == 'channel') {
                await this._createNode(node);
                this._STATES[node.node] = this._STATES[node.node] ?? null;
                await this.set(node, value, options);
            }
        } else {
            if (node.role == 'device' || node.role == 'channel') {
                return;
            }
            const type = (node.common && node.common.type) || node.type || 'string';
            const converted = this.convertToType(value, type);
            await this._setValue(node.node, converted, options);
        }
    }

    async _createNode(node: SetNode): Promise<void> {
        if (!this._adapter) {
            return Promise.reject(new Error('Adapter not defined!'));
        }

        const type =
            node.role == 'device' || node.role == 'channel' ? (node.role == 'device' ? 'device' : 'channel') : 'state';
        let common: any = {
            name: node.name || node.description,
            role: (node.common && node.common.role) || node.role || 'state',
            type: (node.common && node.common.type) || node.type || 'string',
            write: false,
            ...(node.common || {}),
        };

        if (common.role.indexOf('button') > -1) {
            common = { ...common, type: 'boolean', read: false, write: true };
        }

        if (common.role == 'device' || common.role == 'channel') {
            common = { ...common, type: undefined, role: undefined };
        }

        await this._adapter.extendObject(node.node, {
            common,
            type,
            native: node.native || {},
        } as any);
    }

    convertToType(value: any, type?: string): any {
        if (type === undefined) {
            return value;
        }
        if (value == undefined) {
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
            this._adapter.log.warn(`State has wrong common.typ:${type} should be:${old_type}`);
            return value;
        }
        return newValue;
    }

    async _setValue(state: string, value: any, options: SetValueOptions = {}): Promise<void> {
        if (state !== undefined) {
            try {
                const entry = this._STATES[state];
                if (value !== undefined && (options.force || entry == null || entry.val != value)) {
                    await this._adapter.setState(
                        state,
                        value === null
                            ? null
                            : {
                                  val: typeof value === 'object' ? JSON.stringify(value) : value,
                                  ts: Date.now(),
                                  ack: true,
                              },
                    );
                    this.setDeviceState(state, value);
                } else {
                    if (entry?.val !== value) {
                        this.setDeviceProperties(state);
                    }
                }
            } catch (err) {
                this._adapter.log.debug(
                    `_setValue(${state}) failed: ${err instanceof Error ? err.message : String(err)}`,
                );
            }
        }
    }

    resetStates(): void {
        this._STATES = {};
    }

    async readData(
        key: string,
        data: any,
        prefix: string,
        properties?: any,
        expandNestedData = false,
    ): Promise<boolean | void> {
        if (data === undefined || data === 'undefined') {
            return false;
        }

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
        if (typeof data == 'object' && data !== null) {
            if (Array.isArray(data) && !this._adapter.config.getMetadataTrees) {
                if (data.length) {
                    await this.set(
                        {
                            node: key,
                            type: node.type,
                            role: node.role,
                            description: node.description,
                        },
                        data
                            .map((item: any) =>
                                item.url ? item.url : item.id ? item.id : item.tag ? item.tag : item.name,
                            )
                            .join(', '),
                        properties,
                    );
                }

                key = `${key}Tree`;
            }

            if (
                Object.keys(data).length > 0 &&
                (key.indexOf('Tree') === -1 || (key.indexOf('Tree') > -1 && this._adapter.config.getMetadataTrees))
            ) {
                await this.set(
                    {
                        node: key,
                        role: node.notExist ? 'channel' : node.role,
                        description: node.notExist
                            ? RegExp('.[0-9]{3}$').test(key.substr(-4))
                                ? `Index ${key.substr(key.lastIndexOf('.') + 1)}`
                                : `${this.ucFirst(key.substr(key.lastIndexOf('.') + 1).replace('Tree', ''))} Information`
                            : node.description,
                    },
                    undefined,
                    properties,
                );

                let indexKey: string | number;
                for (const nestedKey in data) {
                    indexKey =
                        typeof nestedKey === 'string' && !isNaN(parseInt(nestedKey))
                            ? `00${nestedKey}`.slice(-3)
                            : nestedKey;

                    if (data[nestedKey] !== undefined && data[nestedKey] !== 'undefined') {
                        if (
                            typeof data[nestedKey] == 'object' &&
                            (!Array.isArray(data[nestedKey]) ||
                                (Array.isArray(data[nestedKey]) && this._adapter.config.getMetadataTrees)) &&
                            !expandNestedData
                        ) {
                            await this.set(
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

                        await this.readData(`${key}.${indexKey}`, data[nestedKey], prefix, undefined, expandNestedData);
                    }
                }
            }
        } else {
            node.key = key;
            node.nodeKey = nodeKey;
            const converted = await this.convertNode(node, data);

            await this.set(
                {
                    node: key,
                    type: node.type,
                    role: node.role,
                    description: node.description,
                    common: node.common != undefined ? node.common : undefined,
                },
                converted,
                properties,
            );
        }
    }

    async convertNode(node: NodeDef, data: any): Promise<any> {
        if (!(node && node.convert)) {
            return data;
        }
        let date: any;
        switch (node.convert.func) {
            case 'date-timestamp':
                if (data.toString().indexOf('-') > -1) {
                    date = data;
                    data = Math.floor(new Date(data).getTime() / 1000);
                } else {
                    const ts = new Date(data * 1000);
                    date = `${ts.getFullYear()}-${`0${ts.getMonth()}`.substr(-2)}-${`0${ts.getDate()}`.substr(-2)}`;
                }
                await this.set(
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
                await this.set(
                    {
                        node: `${node.key}human`,
                        type: 'string',
                        role: 'text',
                        description: this.getNode(`${node.nodeKey}human`, true).description,
                    },
                    value,
                );
                await this.set(
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
                await this.set(
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
                const tokenValue =
                    this._adapter.config.tokenInLinks !== false ? this._adapter.config.plexToken : '__PLEX_TOKEN__';
                const link = data
                    ? `${this.AXIOS_OPTIONS._protocol}//${this._adapter.config.plexIp}:${this._adapter.config.plexPort}${data}?X-Plex-Token=${tokenValue}`
                    : '';
                if (node.convert.func == 'create-link-only') {
                    return link;
                }
                await this.set(
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

    async getItem(item: string): Promise<any> {
        if (!item || typeof item !== 'string' || !this._plex) {
            return {};
        }
        const result: any = await this._plex.query(item);
        if (!result || !result.MediaContainer) {
            return {};
        }
        return result.MediaContainer;
    }

    static cloneObj<T>(obj: T): T {
        return JSON.parse(JSON.stringify(obj));
    }
}
