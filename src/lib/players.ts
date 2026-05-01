import axios from 'axios';

import type { PlexHttp } from './plexHttp';

export interface ControllerOptions {
    controllerIdentifier: string;
    plexToken: string;
    plex: PlexHttp;
    actions?: Record<string, Record<string, ActionDef>>;
    nodes?: Record<string, unknown>;
    playerdetails?: PlayerDetailsConfig;
}

interface ActionDef {
    key?: string;
    description?: string;
    default?: unknown;
    role?: string;
    type?: ioBroker.CommonType;
    attribute?: string;
    values?: unknown[];
    convert?: string;
    fromPlex?: Record<string, unknown>;
    saveToPlayer?: unknown;
    common?: Record<string, unknown>;
    true?: string;
    false?: string;
    [k: string]: unknown;
}

interface PlayerDetailsConfig {
    playerDetails?: Record<string, Record<string, PlayerDetailsNode>>;
    deepVal?: unknown;
    [k: string]: unknown;
}

interface PlayerDetailsNode {
    node: string;
    type?: ioBroker.CommonType;
    values?: unknown[];
    notDetails?: boolean;
    [k: string]: unknown;
}

export interface PlayerCreateInput {
    address?: string;
    port?: number | string;
    config: PlayerConfig;
    prefix?: string;
}

export interface PlayerConfig {
    title: string;
    uuid: string;
    name?: string;
    machineIdentifier?: string;
    address?: string | number;
    port?: number | string;
    localAddress?: string;
    publicAddress?: string;
    remotePublicAddress?: string;
    protocolCapabilities?: string;
    controllable?: boolean;
    connected?: boolean;
    [k: string]: unknown;
}

export interface PlayerActionInput {
    id: string;
    mode: string;
    action: string;
    val: ioBroker.StateValue;
}

/**
 * Controller — manages all known Plex players for the adapter instance.
 */
export class Controller {
    static garbageExcluded = ['Player', '_Controls'];

    public players: Player[] = [];
    public serverUuid = '';
    public controllerIdentifier: string;
    public plexToken: string;
    public plex: PlexHttp;
    // Internal references — the surrounding adapter / library types are deliberately loose
    // because Library is migrated separately and its surface is JSON-driven.
    public _adapter: ioBroker.Adapter;
    public _library: any;
    public _actions: Record<string, Record<string, ActionDef>>;
    public _nodes: Record<string, unknown>;
    public _playerdetails: PlayerDetailsConfig;
    public noRefresh: boolean;

    constructor(adapter: ioBroker.Adapter, options: ControllerOptions, library: any) {
        this._adapter = adapter;
        this.controllerIdentifier = options.controllerIdentifier;
        this.plexToken = options.plexToken;
        this.plex = options.plex;
        this._actions = options.actions || {};
        this._nodes = options.nodes || {};
        this._library = library;
        this._playerdetails = options.playerdetails || {};
        this.noRefresh = this._adapter.config.getPlayerRefresh == 0;
    }

    setServerId(uuid: string): void {
        this.serverUuid = uuid;
    }

    getServerId(): string {
        return this.serverUuid;
    }

    existPlayer(prefix = ''): Player | null {
        const i = this.players.findIndex(p => p.prefix.toLowerCase() == prefix.toLowerCase());
        return i > -1 ? this.players[i] : null;
    }

    /**
     * Creates a player if it does not already exist.
     *
     * @param options Player options
     */
    createPlayerIfNotExist(options: PlayerCreateInput): Player {
        if (!options.config.title || !options.config.uuid) {
            throw new Error(
                `createPlayerIfNotExist called without title: ${options.config.title} or uuid ${options.config.uuid}`,
            );
        }
        const prefix = `_playing.${this._library.clean(`${options.config.title}`, true)}-${options.config.uuid}`;
        let player = this.existPlayer(prefix);
        if (!player) {
            player = new Player({ ...options, prefix }, this);
            this.players.push(player);
        }
        return player;
    }
}

/**
 * Player — single Plex player instance, drives state polling and command dispatch.
 */
export class Player {
    public unload = false;
    public prefix: string;
    public address: string | number;
    public port: number | string;
    public config: PlayerConfig;
    public details: any;
    public refresh: number;
    public refreshDetails: boolean;
    /**
     * Discovery sources that found this player (e.g. `['plex.tv/devices', '/status/sessions']`).
     * `/player/timeline/poll` only works for legacy GDM clients (`/clients` source); for
     * Companion devices PMS returns 404 because they're reachable via pubsub-websocket
     * instead. The PMS notifications WebSocket replaces the timeline poll for those.
     */
    public sources: string[] = [];
    /**
     * The Plex `provides` declaration for this device. Empty for Companion-only mobile/web
     * apps (Plex iOS/Android, Plex Web). HTTP control commands only work when this includes
     * `player` or `pubsub-player` (Apple TV, Plexamp Desktop, PMP, PHT) or when the device
     * was discovered via `/clients` (GDM, implicit `provides=player`).
     */
    public provides = '';
    public updatedStates = true;
    public updateTrys = 0;
    public commandID = 0;
    public PLEX_HEADERS: Record<string, string>;
    public refreshTimeout: ioBroker.Timeout | undefined = undefined;
    public latelyActionCall = '';
    public lyric: Lyric | null = null;
    public media: unknown;

    private _controller: Controller;
    private _updater?: () => Promise<void>;

    constructor(options: PlayerCreateInput, controller: Controller) {
        this._controller = controller;
        this.config = options.config;
        this.prefix = options.prefix || '';
        this.refresh =
            this._controller._adapter.config.getPlayerRefresh > 1
                ? this._controller._adapter.config.getPlayerRefresh
                : 60;
        this.details = this._controller._library.getDeviceStateJson(`${this.prefix}.Player.details`) || {};
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

        // Companion-command headers — same identity that the notifications WebSocket uses,
        // so PMS recognizes us as the controller it just opened a pubsub connection to.
        // `X-Plex-Device-Name` is the *controller's* name (us, ioBroker), not the target
        // player. python-plexapi's PlexClient.sendCommand passes only X-Plex-Target-Client-Identifier
        // and reuses the server's headers for the rest; we mirror that with our own identity.
        this.PLEX_HEADERS = {
            'X-Plex-Token': this._controller._adapter.config.plexToken,
            'X-Plex-Target-Client-Identifier': this.config.uuid,
            'X-Plex-Client-Identifier': this._controller.controllerIdentifier,
            'X-Plex-Device-Name': 'ioBroker',
            'X-Plex-Product': 'Plex for ioBroker',
            'X-Plex-Provides': 'controller',
        };

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
            `Create player with prefix "${this.prefix}", localAddress "${this.address || 'no ip'}" and port "${this.port || 'no port'}"`,
        );
        this._controller._adapter.setTimeout(() => {
            this.setControls();
            this.startUpdater();
        }, 400);
    }

    setNotificationData(data: any): void {
        if (data && typeof data === 'object') {
            for (const d in data.Player) {
                if (data.Player[d] === 'undefined') {
                    delete data.Player[d];
                }
            }
            this.updateStates(this.cleanUpConfig(data.Player));
            data = this.cleanUpMetadata(data);

            if (!this.refreshDetails) {
                const playSwitch = (data.event && ['media.play', 'media.resume'].includes(data.event)) || false;
                const actions = { play_switch: playSwitch };

                Object.keys(actions).forEach(key => {
                    const node = this._controller._playerdetails.playerDetails?.action?.[key];
                    if (node) {
                        let val: any = this._controller._library.convertToType(this.details[key], node.type);
                        val = node.values !== undefined ? node.values.includes(val) : val;
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

            if (!this.config.controllable) {
                this.setControls();
            }
            this.startUpdater();
        }
    }

    cleanUpMetadata(data: any, ca = false): any {
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

    setClientData(data: any): void {
        if (data && typeof data === 'object') {
            this._controller._adapter.log.debug(
                `setClientData ${this.prefix}: addr=${data.address || '?'}:${data.port || '?'} ` +
                    `product=${data.product || '?'} state=${data.state || '?'} ` +
                    `caps=${data.protocolCapabilities || '?'} sources=${(data._sources && data._sources.join('+')) || '?'}`,
            );
            if (Array.isArray(data._sources)) {
                this.sources = data._sources.slice();
            }
            if (typeof data._provides === 'string') {
                this.provides = data._provides;
            }
            this.cleanUpConfig(data);
            this.config.connected = true;
            this.updateStates(data);
            if (!this.config.controllable) {
                this.setControls();
            }
            this.startUpdater();
        }
    }

    cleanUpConfig(config: any): void {
        const o: { config: any } = { config };
        this.config.uuid = o.config.machineIdentifier || config.uuid || this.config.uuid;
        this.config.title = o.config.title || o.config.name || this.config.title;

        if (o.config.address === '127.0.0.1') {
            o.config.address = 0;
        }

        this.address = o.config.address || this.address || this.config.localAddress || '';
        this.port = o.config.port || this.config.port || this.port;
        this.config.port = this.port;
        this.config.publicAddress = o.config.remotePublicAddress || o.config.publicAddress || this.config.publicAddress;

        ['address', 'machineIdentifier', 'remotePublicAddress', 'name', 'config', '_sources', '_provides'].forEach(
            key => delete o.config[key],
        );

        // Merge data into the existing config rather than replacing it. The legacy
        // `Object.assign(this, o)` set `this.config = data`, which dropped any field
        // that wasn't in the incoming payload — including `uuid` (Plex sends only
        // `machineIdentifier`, which we've just deleted). Without `uuid`,
        // `X-Plex-Target-Client-Identifier` ends up undefined and PMS returns 404 on
        // every command. Merging keeps the prior `uuid`/`controllable`/`connected`/etc.
        // and overlays the latest fields from the payload.
        Object.assign(this.config, o.config);
    }

    updateStates(data?: any): void {
        if (data) {
            Object.assign(this.config, data);
        }
        // for backward compatibility
        this.address = this.address || this.config.localAddress || '';
        this._controller._library.set(
            {
                node: `${this.prefix}.Player.localAddress`,
                ...this._controller._library.getNode('playing.player.localaddress'),
            },
            this.address,
        );
        this._controller._library.readData(`${this.prefix}.Player`, this.config, `${this.prefix}`, undefined);
    }

    delete(): void {
        this.unload = true;
        this._controller._library.runGarbageCollector(this.prefix, true, 1, Controller.garbageExcluded);
        if (this.refreshTimeout) {
            this._controller._adapter.clearTimeout(this.refreshTimeout);
            this.refreshTimeout = null;
        }
        this.config.connected = false;
        if (this.lyric) {
            this.lyric.delete();
        }
    }

    startUpdater(): void {
        if (!this.refreshDetails || this._controller.noRefresh || !this.config.controllable) {
            return;
        }
        // Skip the per-player timeline poll for Companion devices — PMS returns 404 there.
        // The PMS notifications WebSocket pushes session-state updates for those instead;
        // the adapter routes the events through getPlayers()/setNotificationData.
        if (this.sources.length > 0 && !this.sources.includes('/clients')) {
            return;
        }
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
        this._updater = async (): Promise<void> => {
            try {
                if (!this.refreshDetails || this.unload || this._controller.noRefresh) {
                    return;
                }
                await this.updateTimeline();
                if (this.details.state == 'stopped' || this.unload) {
                    throw new Error('stop');
                }
                this.updateTrys = 1;
                this.latelyActionCall = '';
            } catch (error: any) {
                this.latelyActionCall = '';
                if (error?.message != 'timeout' && error?.message != 'stop') {
                    this._controller._adapter.log.error(`Error 114: ${error?.message} `);
                    this.refreshTimeout = null;
                    return;
                }
                if (this.updateTrys++ > 2) {
                    this.updateTrys = 0;
                    this.updateStates();
                    if (error?.message == 'timeout') {
                        this._controller._adapter.log.info(`Player ${this.getReadableID()} is disconnected`);
                    } else if (error?.message == 'stop') {
                        this._controller._adapter.log.debug(
                            `Stop getting client details ${this.prefix} - ${this.config.protocolCapabilities} - ${this.address} - ${this.port}`,
                        );
                    }
                    this.refreshTimeout = null;
                    return;
                }
            }
            if (this._updater) {
                this.refreshTimeout = this._controller._adapter.setTimeout(this._updater, this.refresh * 1000);
            }
        };
        this.refreshTimeout = this._controller._adapter.setTimeout(this._updater, 300);
    }

    async updateTimeline(): Promise<void> {
        if (!this.config.controllable) {
            return;
        }
        const saveValues = { state: this.details.state, type: this.details.type, metadata: this.details.key };
        // Plex command dispatch is proxied through the PMS using X-Plex-Target-Client-Identifier
        // (already in PLEX_HEADERS). Modern players (Plexamp, mobile, newer TVs) don't expose a
        // local control port; the legacy direct-to-player path only worked for /clients devices.
        const path = `/player/timeline/poll?wait=0&commandID=${this.commandID++}`;
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
        this.config.connected = false;

        try {
            const data = await this._controller.plex.query(path, {
                headers: this.PLEX_HEADERS,
                timeout: 3000,
            });
            try {
                this.config.connected = true;

                // Plex returns JSON for /player/timeline/poll when Accept: application/json
                // is set. Timeline attributes live directly on each entry — no XML `$` group.
                const container: any = ((data as any) && (data as any).MediaContainer) || {};

                this.details.location = container.location || 'none';

                let timelines: any[] = container.Timeline || [];
                for (const t of timelines) {
                    for (const a of [
                        'address',
                        'containerKey',
                        'guid',
                        'machineIdentifier',
                        'audioStreamID',
                        'videoStreamID',
                    ]) {
                        delete t[a];
                    }

                    this.details[t.type] = t;
                }
                timelines = timelines.filter((a: any) => a.state != 'stopped');
                if (timelines.length == 0) {
                    this.details.type = 'all';
                } else {
                    timelines = timelines.sort((a: any, b: any) => {
                        const def: Record<string, number> = { photo: 1, musik: 2, video: 3 };
                        return def[a.type] - def[b.type];
                    });
                    for (const k in this.details) {
                        delete this.details[k].type;
                        const d = this.details[k];
                        if (typeof d != 'object') {
                            continue;
                        }
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
                    if (this.details.type == 'music') {
                        if (this.details.music?.state === 'playing' && this.lyric) {
                            this.lyric.updateTime(this.details.time);
                        }
                    } else {
                        if (this.lyric) {
                            this.lyric.stop();
                        }
                    }
                    Object.keys(this.details).forEach(key => {
                        if (typeof this.details[key] == 'object') {
                            return;
                        }
                        for (const mode in this._controller._playerdetails.playerDetails) {
                            const node = this._controller._playerdetails.playerDetails[mode]?.[key];

                            if (node) {
                                let val: any = this.details[key];
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
                this._controller._adapter.log.debug(`catch() 121: ${err instanceof Error ? err.message : String(err)}`);
            }
        } catch (error: any) {
            if (error?.code === 'ECONNABORTED') {
                throw new Error('timeout');
            } else if (error?.code === 'ECONNRESET') {
                this._controller._adapter.log.debug(
                    `catch() 122 no problem when player is gone: ${JSON.stringify(error.toJSON ? error.toJSON() : String(error))}`,
                );
                throw new Error('timeout');
            } else {
                this._controller._adapter.log.debug(
                    `catch() 122: ${JSON.stringify(error?.toJSON ? error.toJSON() : String(error))}`,
                );
                throw new Error('timeout');
            }
        }
        try {
            if (
                saveValues.metadata != this.details.key ||
                (saveValues.state == 'stopped' && saveValues.state != this.details.state)
            ) {
                void this.getMetadataUpdate();
                let data: any = await this._controller._library.getItem(this.details.key);
                data = this.getMetadataSelection(data, this._controller._playerdetails.deepVal, '');

                for (const key in data) {
                    const node = this._controller._library.getNode(`playing.${key}`, true);
                    if (node && node.convert && node.convert.complex) {
                        const complex = node.convert.complex;
                        switch (complex.func) {
                            case 'lyric': {
                                let dp: string = complex.data.split('.').slice(1).join('.');
                                const keys = Object.keys(data);
                                const index = keys.findIndex(i => i.toLowerCase() == dp);
                                if (index > -1) {
                                    dp = keys[index];
                                    if (data[key] && data[dp]) {
                                        if (this.lyric) {
                                            void this.lyric.updateData(
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
            this._controller._adapter.log.error(err instanceof Error ? err.message : String(err));
        }
    }

    getReadableID(): string {
        return `${this.config.title}-${this.config.uuid}`;
    }

    /**
     * Whether HTTP `/player/...` commands actually reach this device.
     *
     * Reverse-engineered from real Plex behavior (verified 2026-05-01):
     *   - `/clients` GDM clients (Plex Media Player, Plex Home Theater, older TVs) — yes,
     *     they host their own control endpoint.
     *   - Devices with `provides ∋ player|pubsub-player` (Apple TV, Plexamp Desktop, PHT)
     *     — yes, PMS proxies the HTTP command via Companion pubsub.
     *   - Devices with empty `provides` (Plex iOS, Plex Android, Plex Web) — **no**, HTTP
     *     command paths return 404 even with correct Target-Client-Identifier+commandID+type
     *     because PMS routes those exclusively through pubsub.plex.tv, which is undocumented.
     *
     * State updates still work for non-controllable devices via the WebSocket notifications
     * stream — they just can't be commanded.
     */
    public isCompanionControllable(): boolean {
        if (this.sources.includes('/clients')) {
            return true;
        }
        const tokens = this.provides.split(',').map(s => s.trim());
        return tokens.includes('player') || tokens.includes('pubsub-player');
    }

    setControls(): void {
        const controls = `${this.prefix}._Controls`;
        if (!this.config.protocolCapabilities) {
            return;
        }
        // Companion-only mobile/web apps (Plex iOS/Android/Web): HTTP commands return 404.
        // No control state can ever be populated, so remove the entire `_Controls` subtree
        // — exception to the "states stay forever" rule, justified because they are not
        // states that *can* appear, they're zombies from pre-F adapter versions that
        // assumed every player was controllable.
        if (!this.isCompanionControllable()) {
            this.config.controllable = false;
            this._controller._library.set(
                {
                    node: `${this.prefix}.Player.controllable`,
                    ...this._controller._library.getNode('playing.player.controllable'),
                },
                false,
            );
            this._controller._adapter.log.debug(
                `setControls skipped for ${this.prefix}: not HTTP-controllable (provides="${this.provides}", sources=${this.sources.join('+') || '?'}); pruning _Controls subtree.`,
            );
            void this._controller._adapter
                .delObjectAsync(controls, { recursive: true })
                .catch((err: unknown) => {
                    const m = err instanceof Error ? err.message : String(err);
                    if (!/Not exists/i.test(m)) {
                        this._controller._adapter.log.debug(`prune _Controls failed for ${this.prefix}: ${m}`);
                    }
                });
            return;
        }
        this.config.protocolCapabilities.split(',').forEach(mode => {
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

            let button: any;
            for (const key in this._controller._actions[mode]) {
                const newVal =
                    this._controller._actions[mode][key].default !== undefined
                        ? this._controller._actions[mode][key].default
                        : false;
                button =
                    typeof this._controller._actions[mode][key] == 'string'
                        ? { key, description: this._controller._actions[mode][key] }
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
        });
    }

    /**
     * Executes a specified action on the player.
     *
     * @param actionVal The action details.
     */
    async action(actionVal: PlayerActionInput): Promise<void> {
        if (!this.isCompanionControllable()) {
            this._controller._adapter.log.warn(
                `Ignoring ${actionVal.mode}.${actionVal.action} on ${this.getReadableID()}: ` +
                    `device is Companion-only (provides="${this.provides}"). Plex iOS / Plex Android / ` +
                    `Plex Web don't accept HTTP control via PMS — the only way to control them is from ` +
                    `the Plex app itself.`,
            );
            return;
        }
        if (
            this._controller._actions[actionVal.mode] !== undefined &&
            this._controller._actions[actionVal.mode][actionVal.action] !== undefined
        ) {
            let attribute: string | undefined = undefined;
            this._controller._adapter.log.info(
                `Triggered action -${actionVal.action}- on player ${this.getReadableID()} (proxied via PMS).`,
            );

            let newVal: any = actionVal.val;
            let key: string = this._controller._actions[actionVal.mode][actionVal.action].key || actionVal.action;
            if (this._controller._actions[actionVal.mode][actionVal.action].true !== undefined) {
                key = newVal
                    ? (this._controller._actions[actionVal.mode][actionVal.action].true as string)
                    : (this._controller._actions[actionVal.mode][actionVal.action].false as string);
            }
            if (this._controller._actions[actionVal.mode][actionVal.action].convert !== undefined) {
                let json: any = null;
                switch (this._controller._actions[actionVal.mode][actionVal.action].convert) {
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
            if (this._controller._actions[actionVal.mode][actionVal.action].saveToPlayer == undefined) {
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
                        `${this._controller._actions[actionVal.mode][actionVal.action].attribute}=${newVal}&`) ||
                    undefined;

                // Proxy player commands through the PMS — modern Plex players don't expose a
                // local control port. PMS routes via X-Plex-Target-Client-Identifier (see PLEX_HEADERS).
                //
                // Two parameters are required for Plex Companion routing — without either, PMS
                // returns 404 even with a correct Target-Client-Identifier:
                //   - `type=video|music|photo` — picks the Companion stream class to address.
                //     Defaults to `video` when nothing is currently playing (matches python-plexapi
                //     PlexClient.DEFAULT_MTYPE). For navigation/mirror this is harmless.
                //   - `commandID=N` — monotonically increasing per Companion session; pubsub orders
                //     by it.
                const mtypeRaw = this.details && this.details.type;
                const mtype =
                    mtypeRaw === 'video' || mtypeRaw === 'music' || mtypeRaw === 'photo' ? mtypeRaw : 'video';
                const cid = `commandID=${this.commandID++}`;
                const attr = attribute != undefined ? attribute : '';
                const sep = attr && !attr.endsWith('&') ? '&' : '';
                const path = `/player/${actionVal.mode}/${key}?${attr}${sep}type=${mtype}&${cid}`;

                try {
                    this.latelyActionCall = `${actionVal.mode}.${actionVal.action}`;
                    await this._controller.plex.query(path, { headers: this.PLEX_HEADERS });
                    this.config.connected = true;
                    this._controller._adapter.log.debug(
                        `Successfully triggered ${actionVal.mode} action -${actionVal.action}- on player ${this.getReadableID()}.`,
                    );
                    this._controller._library.confirmNode(
                        { node: `${actionVal.id}.${actionVal.mode}.${actionVal.action}` },
                        actionVal.val,
                    );
                    this._controller._adapter.log.debug(`path: ${path}`);
                } catch (err: any) {
                    this._controller._adapter.log.warn(
                        `Error triggering ${actionVal.mode} action -${actionVal.action}- on player ${this.getReadableID()}! See debug log for details.`,
                    );
                    const dbg = err instanceof Error ? err.message : String(err);
                    this._controller._adapter.log.debug(`catch() 133: ${dbg}`);
                    this._controller._adapter.log.debug(`path: ${path}`);
                    this.latelyActionCall = '';
                }
            } else {
                (this as any)[this._controller._actions[actionVal.mode][actionVal.action].key as string] = newVal;
                this.startUpdater();
                this._controller._library.confirmNode(
                    { node: `${actionVal.id}.${actionVal.mode}.${actionVal.action}` },
                    actionVal.val,
                );
            }
        } else {
            this._controller._adapter.log.warn(
                `Error triggering ${actionVal.mode} action -${actionVal.action}- on player ${this.getReadableID()}! Action not supported!`,
            );
        }
    }

    getMetadataSelection(data: any, list: any, k = '', lastData: any = {}): any {
        if (!data || typeof data !== 'object') {
            return {};
        }
        const def = JSON.parse(JSON.stringify(list));
        let result: any = {};

        result = _findData(data, def, k, lastData);
        const res: any = {};
        for (const key in result) {
            for (const a in result[key]) {
                for (const n in result[key][a]) {
                    const newkey = n.replace('.track.', '.Music.');
                    res[newkey] = result[key][a][n];
                }
            }
        }
        return res;

        function _findData(data: any, list: any, k = '', lastData: any = {}): any {
            if (typeof data === 'object') {
                if (Array.isArray(data)) {
                    data.forEach(item => _findData(item, list, k, data));
                } else {
                    Object.keys(data).forEach(key => _findData(data[key], list, k ? `${k}.${key}` : key, data));
                }
            } else {
                if (list[k] !== undefined) {
                    list[k].forEach((l: any) => {
                        if (l.value && l.value != data) {
                            return;
                        }
                        if (l.nodes) {
                            const res: any = {};
                            l.nodes.forEach((n: any) => {
                                res[l.node + n.node] = lastData[n.key];
                            });
                            result[l.node] = result[l.node] || [];
                            result[l.node].push(res);
                        } else if (l.call) {
                            const nl: any = {};
                            Object.keys(l.call).forEach((n: string) => {
                                nl[n] = nl[n] || [];
                                l.call[n].forEach((m: any) => {
                                    nl[n].push({
                                        node: `${l.node}${l.valueAsKey ? `.${data}` : ''}${m.node}`,
                                        app: m.app,
                                    });
                                });
                            });
                            _findData(lastData, nl, k.split('.').slice(0, -1).join('.'));
                        } else if (l.node) {
                            const newKey = l.node + (l.app ? l.app : '');
                            result[l.node] = result[l.node] || [];
                            const res: any = {};
                            res[newKey] = data;
                            result[l.node].push(res);
                        }
                    });
                }
            }
            return result;
        }
    }

    async getMetadataUpdate(): Promise<void> {
        try {
            const sessions: any = await this._controller._library.getItem('/status/sessions');
            if (!sessions || !sessions.Metadata) {
                return;
            }
            for (let s of sessions.Metadata) {
                if (s.Player.machineIdentifier === this.config.uuid) {
                    this.cleanUpConfig(s.Player);
                    s = this.cleanUpMetadata(s, true);
                    if (s.Player && s.Player.state) {
                        delete s.Player.state;
                    }
                    this.media = s.Media;
                    s.media = undefined;
                    this._controller._library.readData(`${this.prefix}.Metadata`, s, `${this.prefix}`, undefined);
                }
            }
        } catch (err) {
            this._controller._adapter.log.debug(`Error 124: ${err instanceof Error ? err.message : String(err)}`);
        }
    }
}

class Lyric {
    private _adapter: ioBroker.Adapter;
    private _library: any;
    public prefix: string;
    public key: string;
    public lyric: any[] = [];
    public fullText: string[] = [];
    public unload = false;
    public stopped = false;
    public time = 0;
    public lasttext = '';
    public noTimes = false;
    public updaterRef: ioBroker.Timeout | undefined = undefined;
    public updater: () => void = () => {};

    constructor(adapter: ioBroker.Adapter, library: any, key: string, prefix: string) {
        this._adapter = adapter;
        this._library = library;
        this.prefix = prefix;
        this.key = key;
        void this.updateData(this.key, this.prefix);
    }

    updateTime(ms: number): void {
        this.time = Date.now() - ms;
        if (this.updaterRef) {
            return;
        }
        this.lasttext = '';
        this.updater = (): void => {
            if (this.unload || this.stopped) {
                this.updaterRef = null;
                return;
            }
            const elapsed = this.time ? Date.now() - this.time : 1000;
            const result: any[] = this.lyric.filter(l => l.startOffset <= elapsed && l.endOffset >= elapsed) || [];
            const texts: string[] = [];
            for (const r of result) {
                texts.push(r.text);
            }
            const newtext = texts.join(' - ') || '';
            if (this.lasttext !== newtext) {
                this.lasttext = newtext;
                this._library.set(
                    {
                        node: `${this.prefix}.currentText`,
                        role: 'text',
                        type: 'string',
                        description: 'Lyrics currently being played',
                    },
                    this.lasttext,
                );
            }
            this.updaterRef = this._adapter.setTimeout(this.updater, 100);
        };
    }

    stop(): void {
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

    delete(): void {
        this.unload = true;
        this.stop();
    }

    async updateData(key: string, prefix: string): Promise<void> {
        this.key = key;
        this.prefix = prefix;
        this.stopped = false;
        if (this.key && this.prefix) {
            this.lyric = [];
            this.fullText = [];
            try {
                const options = {
                    ...this._library.AXIOS_OPTIONS,
                    method: 'GET' as const,
                    url: `http://${this._adapter.config.plexIp}:${this._adapter.config.plexPort}${key}?X-Plex-Token=${this._adapter.config.plexToken}`,
                    Accept: 'application/xml',
                };
                this._adapter.log.debug(`${options.url}`);
                const result: any = await axios(options);
                if (result) {
                    const templyric =
                        (result.data.MediaContainer &&
                            result.data.MediaContainer.Lyrics &&
                            result.data.MediaContainer.Lyrics[0] &&
                            result.data.MediaContainer.Lyrics[0].Line) ||
                        [];
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
                this._adapter.log.debug(
                    `Error(141) ${error instanceof Error && error.message ? error.message : String(error)}`,
                );
            }
        }
    }
}
