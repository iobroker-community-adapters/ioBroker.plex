import * as utils from '@iobroker/adapter-core';
import * as fs from 'node:fs';
import type { Server as HttpServer } from 'node:http';
import express, { type Request, type Response } from 'express';
import bodyParser from 'body-parser';
import multer from 'multer';
import axios from 'axios';
import { v1 as uuidv1 } from 'uuid';

import _NODES_RAW from '../_NODES.json';
import _ACTIONS_RAW from '../_ACTIONS.json';
import _PLAYERDETAILS_RAW from '../_PLAYERDETAILS.json';
import _SERVER_COMMANDS_RAW from '../_SERVER_COMMANDS.json';

import { PlexHttp } from './lib/plexHttp';
import { PlexNotifications } from './lib/plexNotifications';
import { PlexPinAuth } from './lib/plexPinAuth';
import { Library } from './lib/library';
import { Controller } from './lib/players';

// tautulli-api ships no types — declare a minimal interface for the surface we use.
interface TautulliLike {
    get(cmd: string, params?: Record<string, unknown>): Promise<any>;
}
// eslint-disable-next-line @typescript-eslint/no-require-imports
const Tautulli: any = require('tautulli-api');

// Collapse inferred-literal JSON types to their declared shapes.
const _NODES: Record<string, any> = _NODES_RAW;
const _ACTIONS: Record<string, Record<string, any>> = _ACTIONS_RAW as any;
const _PLAYERDETAILS: any = _PLAYERDETAILS_RAW;
const _SERVER_COMMANDS: ServerCommandsConfig = _SERVER_COMMANDS_RAW as any;

interface NotificationDef {
    message: string;
    caption: string;
    thumb: string;
}

interface PlayingDeviceEntry {
    prefix: string;
    title: string;
    local?: string | boolean;
    playerIp?: string | number;
    playerPort?: string | number;
    playerIdentifier?: string;
}

interface HistoryEntry {
    id: string;
    timestamp: number;
    datetime: string;
    account?: string;
    player?: string;
    media?: string;
    event?: string;
    thumb?: string;
    message?: string;
    caption?: string;
    source?: string;
    season?: number;
    episode?: number;
    [k: string]: any;
}

/**
 * Pick the best plex.tv connection entry for a discovered resource.
 * Priority follows python-plexapi's `MyPlexResource.preferred_connections()`:
 *   local > remote > relay, then https > http.
 *
 * @param connections Connection array from `https://plex.tv/api/v2/resources`.
 */
function pickBestConnection(connections?: Plex.Tv.Connection[]): Plex.Tv.Connection | undefined {
    if (!connections || !connections.length) {
        return undefined;
    }
    const score = (c: Plex.Tv.Connection): number => {
        let s = 0;
        if (c.local) {
            s += 100;
        } else if (c.relay) {
            s += 10;
        } else {
            s += 50;
        }
        if (c.protocol === 'https') {
            s += 5;
        }
        return s;
    };
    return [...connections].sort((a, b) => score(b) - score(a))[0];
}

/**
 * Network/auth retry backoff in minutes. Adapter retries init() at index 0, 1, 2, …;
 * once exhausted it stays at the last value (60 min). Avoids the previous one-shot
 * 60-min wait that left users staring at an unresponsive adapter.
 */
const RETRY_BACKOFF_MIN = [1, 5, 15, 20, 30, 40, 50, 60] as const;

function nextBackoff(retryIndex: number): number {
    return RETRY_BACKOFF_MIN[Math.min(retryIndex, RETRY_BACKOFF_MIN.length - 1)];
}

const PLEX_OPTIONS = {
    identifier: '5cc42810-6dc0-44b1-8c70-747152d4f7f9',
    product: 'Plex for ioBroker',
    version: '1.0',
    deviceName: 'ioBroker',
    platform: 'ioBroker',
    platformVersion: process.versions.node,
    language: 'en',
} as const;

const WATCHED = ['01-last_24h', '02-last_7d', '03-last_30d', '00-all_time'] as const;

class Plex extends utils.Adapter {
    private library!: Library;
    private controller!: Controller;
    private plex!: PlexHttp;
    private tautulli!: TautulliLike;
    private encryptionKey = '';
    private unloaded = false;
    private lastConnectionOk: boolean | null = null;
    private lastErrorKind: 'unauthorized' | 'network' | null = null;
    private networkRetryCount = 0;
    private authRetryCount = 0;
    private detailsCounter = 0;
    private playing: string[] = [];
    private streams = 0;
    private playingDevice: PlayingDeviceEntry[] = [];
    private playerIds: string[] = [];
    /**
     * UUIDs (Plex `machineIdentifier` / `clientIdentifier`) of players that have been
     * confirmed as players in past adapter runs (object tree carries `native.isPlayer=true`).
     * Loaded once at startup by `loadKnownPlayers()`. Used in `getPlayers()` to promote
     * /devices.xml candidates whose `provides` is empty but who were seen as real players
     * before — so they don't need an active session for re-discovery on every restart.
     */
    private knownPlayerIds: Set<string> = new Set();
    private alertsClient?: PlexNotifications;
    /** Dedupe rapid bursts of `playing` events (Plex sends ~1/s during playback). */
    private alertsRefreshTimer: NodeJS.Timeout | null = null;
    private history: HistoryEntry[] = [];
    private notifications: Record<string, Record<string, NotificationDef>> = {};
    private retryCycle: ioBroker.Timeout | undefined;
    private refreshCycle: ioBroker.Timeout | undefined;
    private settingsRefreshTimer: ioBroker.Timeout | undefined;
    private refreshInterval: ioBroker.Interval | undefined;
    private healthCheckInterval: ioBroker.Interval | undefined;
    private httpServer: HttpServer | null = null;
    private upload: ReturnType<typeof multer>;

    public constructor(options: Partial<utils.AdapterOptions> = {}) {
        super({ ...options, name: 'plex' });
        this.upload = multer({
            dest: '/tmp/',
            limits: { fileSize: 5 * 1024 * 1024, files: 1 },
            fileFilter: (_req, file, cb) => {
                if (!file.mimetype || !file.mimetype.startsWith('image/')) {
                    cb(null, false);
                    return;
                }
                cb(null, true);
            },
        });
        this.on('ready', this.onReady.bind(this));
        this.on('stateChange', this.onStateChange.bind(this));
        this.on('message', this.onMessage.bind(this));
        this.on('unload', this.onUnload.bind(this));
    }

    private async onReady(): Promise<void> {
        this.library = new Library(this, {
            nodes: _NODES,
            actions: _ACTIONS,
            updatesInLog: this.config.debug || false,
        });

        this.unloaded = false;
        this.refreshInterval = this.setInterval(this.refreshViewOffset, 1000);

        // set encryption key
        if (this.config.encryptionKey === undefined || this.config.encryptionKey === '') {
            this.encryptionKey = this.library.getKey(20);
            void this.getForeignObject(`system.adapter.plex.${this.instance}`, (err, obj) => {
                if (err || obj === undefined || !obj) {
                    return;
                }
                obj.native.encryptionKey = this.encryptionKey;
                void this.setForeignObject(obj._id, obj);
            });
            this.log.debug('Generated new encryption key for password encryption.');
        } else {
            this.encryptionKey = this.config.encryptionKey;
        }

        // Secure connection
        this.library.AXIOS_OPTIONS.secureConnection = false;
        this.library.AXIOS_OPTIONS._protocol = 'http:';
        this.library.AXIOS_OPTIONS.timeout = 3000;

        if (this.config.secureConnection) {
            this.log.info('Establishing secure connection to Plex Media Server...');

            // Always trust the PMS over HTTPS – it usually presents a self-signed or plex.direct
            // wildcard certificate that does not validate against the IP/hostname used by ioBroker.
            this.library.AXIOS_OPTIONS.secureConnection = true;
            this.library.AXIOS_OPTIONS._protocol = 'https:';
            this.library.AXIOS_OPTIONS.rejectUnauthorized = false;

            // *Val fields are legacy from the old Materialize admin (resolved cert content).
            // The new jsonConfig admin writes path or PEM directly into the unsuffixed field.
            const certPub = this.config.certPublicVal || this.config.certPublic;
            const certKey = this.config.certPrivateVal || this.config.certPrivate;
            const certCa = this.config.certChainedVal || this.config.certChained;
            if (certPub && certKey) {
                try {
                    this.library.AXIOS_OPTIONS.cert = certPub.indexOf('.') === -1 ? certPub : fs.readFileSync(certPub);
                    this.library.AXIOS_OPTIONS.key = certKey.indexOf('.') === -1 ? certKey : fs.readFileSync(certKey);

                    if (certCa) {
                        this.library.AXIOS_OPTIONS.ca = certCa.indexOf('.') === -1 ? certCa : fs.readFileSync(certCa);
                    }

                    if (
                        typeof this.library.AXIOS_OPTIONS.key === 'string' &&
                        this.library.AXIOS_OPTIONS.key.indexOf('ENCRYPTED') > -1
                    ) {
                        this.library.AXIOS_OPTIONS.passphrase = this.config.passphrase;
                    }
                } catch (err: unknown) {
                    this.log.warn(
                        'Failed loading client certificates! Continuing with HTTPS but without client authentication.',
                    );
                    this.log.debug(err instanceof Error ? err.message : String(err));
                    delete this.library.AXIOS_OPTIONS.cert;
                    delete this.library.AXIOS_OPTIONS.key;
                    delete this.library.AXIOS_OPTIONS.ca;
                    delete this.library.AXIOS_OPTIONS.passphrase;
                }
            }
        } else {
            this.log.info('Establishing insecure connection to Plex Media Server...');
        }

        // get notifications
        if (this.config.notifications) {
            this.config.notifications.forEach(notification => {
                if (!this.notifications[notification.media]) {
                    this.notifications[notification.media] = {};
                }
                this.notifications[notification.media][notification.event] = {
                    message: notification.message,
                    caption: notification.caption,
                    thumb: notification.thumb,
                };
            });
        }

        // verify Plex settings
        if (!this.config.plexIp || !this.config.plexToken) {
            this.library.terminate(
                'Plex IP and Plex Token not configured! Please go to settings, fill in Plex IP and retrieve a Plex Token.',
            );
            return;
        }

        // initialize Plex API
        this.config.plexPort = this.config.plexPort || 32_400;
        this.plex = new PlexHttp({
            hostname: this.config.plexIp,
            port: this.config.plexPort,
            https: this.library.AXIOS_OPTIONS.secureConnection,
            token: this.config.plexToken,
            requestOptions: this.library.AXIOS_OPTIONS,
            options: PLEX_OPTIONS,
        });

        this.library._plex = this.plex;

        this.controller = new Controller(
            this,
            {
                controllerIdentifier: PLEX_OPTIONS.identifier,
                plexToken: this.config.plexToken,
                plex: this.plex,
                actions: _ACTIONS,
                nodes: _NODES,
                playerdetails: _PLAYERDETAILS,
            },
            this.library,
        );

        // retrieve all values from states
        this.getStates(`${this.name}.${this.instance}.*`, async (err, states) => {
            if (err) {
                this.log.warn(`Failed to read adapter states from DB: ${err.message ?? String(err)}`);
            }

            for (const state in states) {
                void this.library.extendState(state);

                if (states[state] !== null && states[state] !== undefined) {
                    this.library.setDeviceState(state.replace(`${this.name}.${this.instance}.`, ''), states[state].val);

                    if (state.indexOf('events.history') > -1) {
                        try {
                            const parsed = JSON.parse(String(states[state].val));
                            this.history = Array.isArray(parsed) ? parsed : [];
                        } catch (err: unknown) {
                            this.log.warn(
                                `Stored history state is corrupted, starting fresh: ${err instanceof Error ? err.message : String(err)}`,
                            );
                            this.history = [];
                        }
                    }
                }
            }

            // Ensure events.settings object exists so the www UI can write to it.
            // extendObject is used intentionally — library.set with undefined converts to '' and
            // would overwrite the persisted value on every adapter restart.
            void this.extendObject('events.settings', {
                type: 'state',
                common: { name: 'WWW UI settings', role: 'json', type: 'string', read: true, write: true },
                native: {},
            });

            if (this.config.resetMedia) {
                void this.library.del('_playing', true, () => this.log.debug('Plex Media flushed!'));
            }
        });
        void this.subscribeForeignStatesAsync('iot.0.services.custom_plex');
        void this.subscribeForeignStatesAsync('cloud.0.services.custom_plex');
        this.log.debug('Initialization complete, starting data retrieval and event listener...');
        this.init();

        this.library.subscribeNode('metadata.viewoffset', (_state, prefix) => {
            this.library.confirmNode({ node: `${prefix}_Control.seekTo` });
        });
    }

    private onStateChange(id: string, state: ioBroker.State | null | undefined): void {
        if (!state || state.ack === true) {
            return;
        }

        this.log.debug(`State of ${id} has changed ${JSON.stringify(state)}.`);
        let action = id.slice(id.lastIndexOf('.') + 1);
        let val: any = state.val;
        let stateId = id;

        // Cloud / iot Adapter
        if (action == 'custom_plex') {
            try {
                if (!state.val || typeof state.val !== 'string') {
                    return;
                }
                const parts = state.val.split('_');
                const playerNamespace = parts[0];
                action = parts[1];
                val = parts[2];
                stateId = `_playing.${playerNamespace}._Controls.playback.${action}`;
            } catch (err: unknown) {
                this.log.warn(err instanceof Error ? err.message : String(err));
                return;
            }
        }

        // Refresh Library (bestehend, mit POST force=1)
        if (action == '_refresh') {
            const libId = stateId.substring(stateId.indexOf('libraries.') + 10, stateId.indexOf('-'));
            const options: any = {
                ...this.library.AXIOS_OPTIONS,
                url: `${this.library.AXIOS_OPTIONS._protocol}//${this.config.plexIp}:${this.config.plexPort}/library/sections/${libId}/refresh?force=1`,
                method: 'POST',
                headers: {
                    'X-Plex-Token': this.config.plexToken,
                },
            };

            axios(options)
                .then(res => {
                    this.log.info(`Successfully triggered refresh on library with ID ${libId}.`);
                    this.log.debug(JSON.stringify(res.data));
                })
                .catch((err: unknown) => {
                    this.log.warn(`Error triggering refresh on library with ID ${libId}! See debug log for details.`);
                    this.log.debug(err instanceof Error ? err.message : String(err));
                });
            return;
        }

        // Library-spezifische Commands (scan, emptyTrash, analyze …)
        if (stateId.includes('._commands.') && stateId.includes('libraries.')) {
            void this.handleLibraryCommand(stateId);
            return;
        }

        // Server Maintenance Commands (maintenance.cleanBundles usw.)
        if (stateId.includes(`${this.name}.${this.instance}.maintenance.`)) {
            void this.handleMaintenanceCommand(action);
            return;
        }

        // Butler Tasks (butler.BackupDatabase usw.)
        if (stateId.includes(`${this.name}.${this.instance}.butler.`)) {
            void this.handleButlerTask(action);
            return;
        }

        // Metadata Commands pro laufendem Medium (_playing.X._Commands.Y)
        if (stateId.includes('._Commands.') && stateId.includes('_playing.')) {
            void this.handleMetadataCommand(stateId, action, val);
            return;
        }

        // Settings Write-Back (settings.group.settingId)
        if (stateId.includes(`${this.name}.${this.instance}.settings.`)) {
            void this.handleSettingChange(stateId, val);
            return;
        }

        // Player-Kontrolle (bestehend)
        const path = stateId.replace(`${this.name}.${this.instance}.`, '').split('.');
        action = path.pop() || '';
        const mode = path.pop() || '';

        path.splice(-1);
        const p = this.controller.existPlayer(path.join('.'));
        if (p) {
            void p.action({ mode, action, val, id: `${path.join('.')}._Controls` });
        }
    }

    private createMaintenanceStates(): void {
        void this.library.set({ node: 'maintenance', role: 'channel', description: 'Server Maintenance' });
        for (const [cmdName, cmdDef] of Object.entries(_SERVER_COMMANDS.maintenanceCommands)) {
            const nodeKey = `maintenance.${cmdName}`;
            void this.library.set(
                {
                    node: nodeKey,
                    role: cmdDef.role,
                    type: cmdDef.type as ioBroker.CommonType,
                    description: cmdDef.description,
                },
                false,
            );
            void this.subscribeStatesAsync(nodeKey);
        }

        void this.library.set({ node: 'butler', role: 'channel', description: 'Butler Tasks' });
        for (const [taskName, taskDef] of Object.entries(_SERVER_COMMANDS.butlerTasks)) {
            const nodeKey = `butler.${taskName}`;
            void this.library.set(
                {
                    node: nodeKey,
                    role: taskDef.role,
                    type: taskDef.type as ioBroker.CommonType,
                    description: taskDef.description,
                },
                false,
            );
            void this.subscribeStatesAsync(nodeKey);
        }
    }

    private createMetadataCommandStates(playerPrefix: string, ratingKey: string | undefined): void {
        if (!ratingKey) {
            return;
        }
        void this.library.set({ node: `${playerPrefix}._Commands`, role: 'channel', description: 'Media Commands' });
        for (const [cmdName, cmdDef] of Object.entries(_SERVER_COMMANDS.metadataCommands)) {
            const nodeKey = `${playerPrefix}._Commands.${cmdName}`;
            void this.library.set(
                {
                    node: nodeKey,
                    role: cmdDef.role,
                    type: cmdDef.type as ioBroker.CommonType,
                    description: cmdDef.description,
                    common: cmdDef.common as any,
                },
                cmdDef.type === 'boolean' ? false : 0,
            );
            void this.subscribeStatesAsync(nodeKey);
        }
    }

    private async handleLibraryCommand(stateId: string): Promise<void> {
        const relId = stateId.replace(`${this.name}.${this.instance}.`, '');
        // relId: libraries.{key}-{title}._commands.{cmdName}
        const parts = relId.split('.');
        const libSegment = parts[1]; // z.B. "1-movies"
        const cmdName = parts[3];
        const numericId = libSegment.substring(0, libSegment.indexOf('-'));
        const cmdDef = _SERVER_COMMANDS.libraryCommands[cmdName];
        if (!cmdDef?.pathTemplate) {
            return;
        }
        const apiPath = cmdDef.pathTemplate.replace('{id}', numericId);
        try {
            await this.plex.query(apiPath, { method: cmdDef.method });
            this.log.info(`Library command '${cmdName}' executed on library ${numericId}.`);
        } catch (err: unknown) {
            this.log.warn(`Library command '${cmdName}' failed: ${err instanceof Error ? err.message : String(err)}`);
        }
    }

    private async handleMaintenanceCommand(cmdName: string): Promise<void> {
        const cmdDef = _SERVER_COMMANDS.maintenanceCommands[cmdName];
        if (!cmdDef?.path) {
            return;
        }
        try {
            await this.plex.query(cmdDef.path, { method: cmdDef.method });
            this.log.info(`Maintenance command '${cmdName}' executed.`);
        } catch (err: unknown) {
            this.log.warn(
                `Maintenance command '${cmdName}' failed: ${err instanceof Error ? err.message : String(err)}`,
            );
        }
    }

    private async handleButlerTask(taskName: string): Promise<void> {
        const taskDef = _SERVER_COMMANDS.butlerTasks[taskName];
        if (!taskDef?.path) {
            return;
        }
        try {
            await this.plex.query(taskDef.path, { method: taskDef.method });
            this.log.info(`Butler task '${taskName}' started.`);
        } catch (err: unknown) {
            this.log.warn(`Butler task '${taskName}' failed: ${err instanceof Error ? err.message : String(err)}`);
        }
    }

    private async handleMetadataCommand(stateId: string, cmdName: string, val: any): Promise<void> {
        const relId = stateId.replace(`${this.name}.${this.instance}.`, '');
        const playerPrefix = relId.substring(0, relId.indexOf('._Commands.'));
        // Keys werden von library.readData() lowercase gespeichert
        const ratingKey = this.library.getDeviceState(`${playerPrefix}.Metadata.ratingkey`);
        if (!ratingKey) {
            this.log.warn(`handleMetadataCommand: no ratingKey at ${playerPrefix}.Metadata.ratingkey`);
            return;
        }
        const cmdDef = _SERVER_COMMANDS.metadataCommands[cmdName];
        if (!cmdDef?.pathTemplate) {
            return;
        }
        let apiPath = cmdDef.pathTemplate.replace('{key}', String(ratingKey));
        if (cmdName === 'rate') {
            apiPath = apiPath.replace('{val}', String(val));
        }
        try {
            await this.plex.query(apiPath, { method: cmdDef.method });
            this.log.info(`Metadata command '${cmdName}' executed for key ${ratingKey}.`);
        } catch (err: unknown) {
            this.log.warn(`Metadata command '${cmdName}' failed: ${err instanceof Error ? err.message : String(err)}`);
        }
    }

    private async handleSettingChange(stateId: string, val: any): Promise<void> {
        const relId = stateId.replace(`${this.name}.${this.instance}.`, '');
        const parts = relId.split('.');
        if (parts.length < 3) {
            return;
        }
        const settingId = parts[2];
        try {
            await this.plex.query(`/:/prefs?${encodeURIComponent(settingId)}=${encodeURIComponent(String(val))}`, {
                method: 'PUT',
            });
            this.log.info(`Setting '${settingId}' updated to: ${val}`);
            if (this.config.getSettings) {
                if (this.settingsRefreshTimer) this.clearTimeout(this.settingsRefreshTimer);
                this.settingsRefreshTimer = this.setTimeout(() => {
                    this.settingsRefreshTimer = undefined;
                    this.getSettings();
                    if (this.refreshCycle) {
                        this.clearTimeout(this.refreshCycle);
                        this.refreshCycle = this.setTimeout(this.retrieveDataLoop, this.config.refresh * 1000);
                    }
                }, 1500);
            }
        } catch (err: unknown) {
            this.log.warn(
                `Failed to update setting '${settingId}': ${err instanceof Error ? err.message : String(err)}`,
            );
        }
    }

    private onMessage(msg: ioBroker.Message): void {
        this.log.debug(`Message: ${JSON.stringify(msg)}`);

        // List all currently known player channels (`_playing.<title>-<uuid>` with native.isPlayer)
        // for the admin Cleanup tab. Pure read, no Plex API call.
        if (msg.command === 'listKnownPlayers') {
            void this.handleListKnownPlayers(msg);
            return;
        }
        // Delete the given player channel subtrees. Used by the admin Cleanup button.
        if (msg.command === 'cleanupPlayers') {
            void this.handleCleanupPlayers(msg);
            return;
        }

        // Lightweight status query for the admin TokenWizard component – no Plex API call.
        if (msg.command === 'getConnectionStatus') {
            this.library.msg(
                msg.from,
                msg.command,
                {
                    connected: this.lastConnectionOk === true,
                    lastError: this.lastErrorKind,
                    hasToken: !!this.config.plexToken,
                    hasIp: !!this.config.plexIp,
                },
                msg.callback,
            );
            return;
        }

        const plexPin = new PlexPinAuth(PLEX_OPTIONS);

        switch (msg.command) {
            case 'getPin':
                plexPin
                    .getPin()
                    .then(pin => {
                        this.log.debug(`Successfully retrieved PIN: ${pin.code}`);
                        this.library.msg(msg.from, msg.command, { result: true, pin }, msg.callback);
                    })
                    .catch((err: unknown) => {
                        const m = err instanceof Error ? err.message : String(err);
                        this.log.warn(m);
                        this.library.msg(msg.from, msg.command, { result: false, error: m }, msg.callback);
                    });
                break;

            case 'getToken':
                plexPin
                    .getToken(msg.message.pinId)
                    .then(res => {
                        if (res.token === true) {
                            this.log.debug('Successfully retrieved token.');
                            this.library.msg(
                                msg.from,
                                msg.command,
                                { result: true, token: res.auth_token },
                                msg.callback,
                            );
                        } else {
                            this.library.msg(
                                msg.from,
                                msg.command,
                                { result: false, error: 'No token retrieved!' },
                                msg.callback,
                            );
                        }
                    })
                    .catch((err: unknown) => {
                        const m = err instanceof Error ? err.message : String(err);
                        this.log.warn(m);
                        this.library.msg(msg.from, msg.command, { result: false, error: m }, msg.callback);
                    });
                break;
        }
    }

    /**
     * Build a list of all `_playing.<title>-<uuid>` channels from the object tree.
     * Returns metadata from `native` (uuid, lastSeenAt, product, platform, device) plus
     * the channel id and human title — enough for the admin UI to render and decide
     * what to delete.
     *
     * @param msg ioBroker message carrying the sendTo request
     */
    private async handleListKnownPlayers(msg: ioBroker.Message): Promise<void> {
        try {
            const objs = await this.getAdapterObjectsAsync();
            const prefix = `${this.name}.${this.instance}._playing.`;
            const players: Array<{
                id: string;
                uuid: string;
                title: string;
                product?: string;
                platform?: string;
                device?: string;
                lastSeenAt?: string;
                lastSeenSource?: string;
            }> = [];
            for (const id in objs) {
                if (!id.startsWith(prefix)) {
                    continue;
                }
                // Player roots are exactly two segments below `_playing.`. Skip nested children.
                const rest = id.slice(prefix.length);
                if (rest.includes('.')) {
                    continue;
                }
                const obj = objs[id];
                if (!obj || obj.type !== 'channel') {
                    continue;
                }
                const native = ((obj as any).native || {}) as Record<string, unknown>;
                if (native.isPlayer !== true || typeof native.uuid !== 'string' || !native.uuid) {
                    continue;
                }
                players.push({
                    id,
                    uuid: native.uuid,
                    title: (typeof obj.common?.name === 'string' ? obj.common.name : rest) || rest,
                    product: typeof native.product === 'string' ? native.product : undefined,
                    platform: typeof native.platform === 'string' ? native.platform : undefined,
                    device: typeof native.device === 'string' ? native.device : undefined,
                    lastSeenAt: typeof native.lastSeenAt === 'string' ? native.lastSeenAt : undefined,
                    lastSeenSource: typeof native.lastSeenSource === 'string' ? native.lastSeenSource : undefined,
                });
            }
            this.library.msg(msg.from, msg.command, { result: true, players }, msg.callback);
        } catch (err: unknown) {
            const m = err instanceof Error ? err.message : String(err);
            this.log.warn(`listKnownPlayers failed: ${m}`);
            this.library.msg(msg.from, msg.command, { result: false, error: m }, msg.callback);
        }
    }

    /**
     * Delete the given player-channel subtrees (`_playing.<title>-<uuid>` and everything below).
     * Idempotent — channels that no longer exist are silently skipped.
     *
     * @param msg ioBroker message carrying the list of player object IDs to delete
     */
    private async handleCleanupPlayers(msg: ioBroker.Message): Promise<void> {
        const ids = (msg.message && msg.message.ids) as string[] | undefined;
        if (!Array.isArray(ids) || ids.length === 0) {
            this.library.msg(msg.from, msg.command, { result: false, error: 'no ids' }, msg.callback);
            return;
        }
        const prefix = `${this.name}.${this.instance}._playing.`;
        let deleted = 0;
        const errors: string[] = [];
        for (const id of ids) {
            if (typeof id !== 'string' || !id.startsWith(prefix) || id.slice(prefix.length).includes('.')) {
                errors.push(`reject: ${id}`);
                continue;
            }
            try {
                const relId = id.slice(`${this.name}.${this.instance}.`.length);
                // Recursive delete: channel + all its states/sub-channels.
                await this.delObjectAsync(relId, { recursive: true });
                this.library.clearStateCache(relId);
                deleted++;
                this.knownPlayerIds.forEach(uuid => {
                    if (id.endsWith(`-${uuid}`)) {
                        this.knownPlayerIds.delete(uuid);
                    }
                });
            } catch (err: unknown) {
                errors.push(`${id}: ${err instanceof Error ? err.message : String(err)}`);
            }
        }
        this.log.info(`Cleanup: deleted ${deleted} player(s)${errors.length ? `, ${errors.length} error(s)` : ''}`);
        if (errors.length > 0) {
            this.log.debug(`Cleanup errors: ${errors.join(' | ')}`);
        }
        this.library.msg(msg.from, msg.command, { result: true, deleted, errors }, msg.callback);
    }

    private onUnload(callback: () => void): void {
        try {
            this.log.info(`Plex Adapter stopped und unloaded.`);

            this.unloaded = true;

            if (this.controller) {
                // controller.delete is commented out in the original; kept as no-op for parity.
            }

            if (this.alertsClient) {
                this.alertsClient.stop();
                this.alertsClient = undefined;
            }
            if (this.alertsRefreshTimer) {
                clearTimeout(this.alertsRefreshTimer);
                this.alertsRefreshTimer = null;
            }
            if (this.retryCycle) {
                this.clearTimeout(this.retryCycle);
            }
            if (this.refreshCycle) {
                this.clearTimeout(this.refreshCycle);
            }
            if (this.healthCheckInterval) {
                this.clearInterval(this.healthCheckInterval);
            }
            if (this.refreshInterval) {
                this.clearInterval(this.refreshInterval);
            }
            if (this.httpServer) {
                const srv = this.httpServer;
                this.httpServer = null;
                // closeAllConnections is Node ≥18.2 – kill keep-alive sockets so close() doesn't hang
                (srv as any).closeAllConnections?.();
                srv.close(() => {
                    this.log.debug('Server for listener closed.');
                    callback();
                });
            } else {
                callback();
            }
        } catch {
            callback();
        }
    }

    /**
     * Sets info.connection and lastConnectionOk. Logs only when the state actually changes:
     * warn on false, info on true.
     *
     * @param ok New connection state
     * @param detail Optional detail appended to the warn message (e.g. the error string)
     */
    private async setConnectionState(ok: boolean, detail?: string): Promise<void> {
        const changed = ok ? this.lastConnectionOk !== true : this.lastConnectionOk !== false;
        this.lastConnectionOk = ok;
        await this.library.set(Library.CONNECTION, ok);
        if (!changed) {
            return;
        }
        if (ok) {
            this.log.info('Plex Media Server connected.');
        } else {
            this.log.warn(`Plex Media Server connection lost${detail ? `: ${detail}` : '.'}`);
        }
    }

    /**
     * Periodic health check against the local Plex Media Server. Sets the CONNECTION state
     * and only logs when the connection state actually changes, to avoid log spam.
     */
    private startHealthCheck(): void {
        if (this.healthCheckInterval) {
            this.clearInterval(this.healthCheckInterval);
        }
        const intervalMs = 5 * 60 * 1000;
        this.healthCheckInterval = this.setInterval(async () => {
            if (this.unloaded) {
                return;
            }
            try {
                await this.plex.query('/');
                const wasDown = this.lastConnectionOk !== true;
                await this.setConnectionState(true);
                if (!wasDown) {
                    this.log.debug('Plex health check OK.');
                }
                this.lastErrorKind = null;
            } catch (err: unknown) {
                const m = err instanceof Error ? err.message : String(err);
                const stillFailing = this.lastConnectionOk === false;
                await this.setConnectionState(false, m);
                if (stillFailing) {
                    this.log.debug(`Plex health check still failing: ${m}`);
                }
                if (m.indexOf('401') > -1 || m.indexOf('Unauthorized') > -1 || m.indexOf('unauthorized') > -1) {
                    this.lastErrorKind = 'unauthorized';
                } else {
                    this.lastErrorKind = 'network';
                }
            }
        }, intervalMs);
    }

    private init(): void {
        this.plex
            .query('/status/sessions')
            .then(async (res: any) => {
                const mc = res && res.MediaContainer;
                const sessions = (mc && Array.isArray(mc.Metadata) ? mc.Metadata : []) as any[];
                const summary =
                    sessions.length === 0
                        ? 'empty'
                        : sessions
                              .map(s => {
                                  const p = s && s.Player;
                                  return p ? `${p.title || '?'}/${p.product || '?'}/${p.state || '?'}` : '?';
                              })
                              .join(', ');
                this.log.debug(`Retrieved playing now from plex server: ${sessions.length} sessions [${summary}]`);
                await this.setConnectionState(true);
                this.getStates(`${this.name}.${this.instance}.*`, async (err, states) => {
                    if (err || !states) {
                        return;
                    }

                    for (const state in states) {
                        this.library.setDeviceState(
                            state.replace(`${this.name}.${this.instance}.`, ''),
                            states[state] && states[state].val,
                        );
                    }

                    const playersState = this.library.getDeviceState('_playing.players');
                    this.playing = (typeof playersState === 'string' && playersState.split(',')) || [];
                    this.streams = this.library.getDeviceState('_playing.streams') || 0;
                });

                // verify Tautulli settings
                if ((this.config as any).tautulliEnabled === undefined) {
                    this.config.tautulliEnabled = !!(this.config.tautulliIp && this.config.tautulliToken);
                }
                let tautulliReady = false;
                if (!this.config.tautulliEnabled) {
                    this.log.debug('Tautulli integration is disabled in adapter settings.');
                    this.tautulli = { get: () => Promise.reject(new Error('Tautulli disabled')) };
                } else if (!this.config.tautulliIp || !this.config.tautulliToken) {
                    this.log.info(
                        `Tautulli ${!this.config.tautulliIp ? ' IP/ ' : ''}${!this.config.tautulliToken ? 'API token ' : ''}missing!`,
                    );
                    this.tautulli = { get: () => Promise.reject(new Error('Not connected!')) };
                } else {
                    let tautulliApiKey: string = this.config.tautulliToken;
                    if (typeof tautulliApiKey === 'string' && /[^\x20-\x7e]/.test(tautulliApiKey)) {
                        this.log.warn(
                            'Tautulli token appears to be in the legacy XOR-encrypted format. Decoding once — please open the adapter settings and save the configuration so the token is stored as plain text.',
                        );
                        tautulliApiKey = this.library.decode(this.encryptionKey, tautulliApiKey);
                    }
                    try {
                        this.tautulli = new Tautulli(
                            this.config.tautulliIp,
                            this.config.tautulliPort || 8181,
                            tautulliApiKey,
                        );
                        tautulliReady = true;
                    } catch {
                        this.log.error(
                            `Tautulli configuration is incorrect. IP:${this.config.tautulliIp} Port:${this.config.tautulliPort} Api-Key:[REDACTED]`,
                        );
                    }
                }
                this.config.getUsers = this.config.getUsers && tautulliReady;
                this.config.getStatistics = this.config.getStatistics && tautulliReady;

                // retrieve data
                const refreshSec = parseInt(String(this.config.refresh), 10);
                if (!refreshSec || isNaN(refreshSec) || refreshSec <= 0) {
                    this.config.refresh = 0;
                } else if (refreshSec < 10) {
                    this.log.warn(
                        'Due to performance reasons, the refresh rate can not be set to less than 10 seconds. Using 10 seconds now.',
                    );
                    this.config.refresh = 10;
                } else {
                    this.config.refresh = refreshSec;
                }

                // Restore the set of previously confirmed players from the object tree before
                // the first discovery tick — getPlayers() uses it to promote /devices.xml
                // candidates whose `provides` is empty but were seen as real players in past runs.
                await this.loadKnownPlayers();

                this.refreshCycle = this.setTimeout(this.retrieveDataLoop, 1000);
                this.createMaintenanceStates();

                // listen to events from Plex
                void this.startListener();
                this.startPlexNotifications();
                this.lastErrorKind = null;
                this.networkRetryCount = 0;
                this.authRetryCount = 0;
                this.startHealthCheck();
                // connection is ok – get server id
                this.plex
                    .query('/')
                    .then((res2: any) => {
                        if (res2 && res2.MediaContainer && res2.MediaContainer.machineIdentifier) {
                            this.controller.setServerId(res2.MediaContainer.machineIdentifier);
                        }
                    })
                    .catch((err: unknown) => {
                        this.log.debug(err instanceof Error ? err.message : String(err));
                    });
            })
            .catch(async (err: unknown) => {
                const safeConfig: Record<string, any> = { ...this.config };
                for (const k of ['plexToken', 'tautulliToken', 'plexPassword', 'passphrase', 'encryptionKey']) {
                    if (safeConfig[k]) {
                        safeConfig[k] = '[REDACTED]';
                    }
                }
                const safeOpts: Record<string, any> = { ...this.library.AXIOS_OPTIONS };
                for (const k of ['cert', 'key', 'ca', 'passphrase']) {
                    if (safeOpts[k]) {
                        safeOpts[k] = '[REDACTED]';
                    }
                }
                this.log.debug(`Configuration: ${JSON.stringify(safeConfig)}`);
                this.log.debug(`Request-Options: ${JSON.stringify(safeOpts)}`);
                this.log.debug(`Stack-Trace: ${JSON.stringify(err instanceof Error ? err.stack : String(err))}`);

                const m = err instanceof Error ? err.message : String(err);
                if (
                    m.indexOf('EHOSTUNREACH') > -1 ||
                    m.indexOf('ECONNREFUSED') > -1 ||
                    m.indexOf('ETIMEDOUT') > -1 ||
                    m.indexOf('ENOTFOUND') > -1 ||
                    m.indexOf('ECONNABORTED') > -1
                ) {
                    const wait = nextBackoff(this.networkRetryCount++);
                    this.config.retry = wait;
                    this.log.info(
                        `Plex Media Server(${this.config.plexIp}:${this.config.plexPort}) not reachable! Will try again in ${wait} minute(s)...`,
                    );
                    await this.setConnectionState(false);
                    this.lastErrorKind = 'network';
                    this.retryCycle = this.setTimeout(() => this.init(), wait * 60 * 1000);
                } else if (
                    m.indexOf('Permission denied') > -1 ||
                    m.indexOf('401') > -1 ||
                    m.indexOf('Unauthorized') > -1 ||
                    m.indexOf('unauthorized') > -1
                ) {
                    // Auth error from PMS. Don't terminate – stay offline and retry so the adapter recovers
                    // automatically once the token works again (e.g. after the user updates it in settings).
                    const wait = nextBackoff(this.authRetryCount++);
                    this.config.retry = wait;
                    this.log.warn(
                        `Plex Media Server rejected the request as unauthorized. If this persists, retrieve a new token in the adapter settings. Will retry in ${wait} minute(s).`,
                    );
                    await this.setConnectionState(false);
                    this.lastErrorKind = 'unauthorized';
                    this.retryCycle = this.setTimeout(() => this.init(), wait * 60 * 1000);
                } else {
                    const wait = nextBackoff(this.networkRetryCount++);
                    this.config.retry = wait;
                    this.log.warn(
                        `Unexpected error connecting to Plex Media Server: ${m}. Will retry in ${wait} minute(s).`,
                    );
                    await this.setConnectionState(false);
                    this.lastErrorKind = 'network';
                    this.retryCycle = this.setTimeout(() => this.init(), wait * 60 * 1000);
                }
            });
    }

    private retrieveDataLoop = (): void => {
        this.retrieveData();
        if (this.config.refresh > 0 && !this.unloaded) {
            this.refreshCycle = this.setTimeout(this.retrieveDataLoop, this.config.refresh * 1000);
        }
    };

    private retrieveData(): void {
        if (this.config.getServers) {
            this.getServers();
        }
        if (this.config.getLibraries) {
            this.getLibraries();
        }
        if (this.config.getUsers) {
            this.getUsers();
        }
        if (this.config.getSettings) {
            this.getSettings();
        }
        if (this.config.getPlaylists) {
            this.getPlaylists();
        }
        void this.getPlayers();
    }

    /**
     * Receive event from webhook.
     *
     * @param dataIn The event data received from the webhook
     * @param source The source of the event
     * @param prefixIn The prefix of the event
     */
    private async setEvent(dataIn: Plex.Event.Payload, source: string, prefixIn: string): Promise<boolean> {
        let data: Plex.Event.Payload | null = dataIn;
        let prefix = prefixIn;
        this.log.debug(
            `Received ${prefix} playload - ${data.event || 'unknown'} - from ${source}: ${JSON.stringify(data)}`,
        );

        if (Object.keys(data).length === 0 || !data.event) {
            this.log.warn(`Empty payload received from ${source}! Please go to ${source} and configure payload!`);
            return false;
        }

        // add meta data
        data.media = data.Metadata && data.Metadata.type;
        data.source = source;
        data.timestamp = Math.floor(Date.now() / 1000);
        data.datetime = this.library.getDateTime(Date.now());
        data.playing = data.event.indexOf('play') > -1 || data.event.indexOf('resume') > -1;
        this.log.debug(`Enriched payload [${data.event ?? 'no-event'}]: ${JSON.stringify(data.Metadata?.Media || {})}`);
        if (!this.config.getMetadataTrees && data.Metadata) {
            delete data.Metadata.Media;
        }
        // PLAYING
        if (prefix == '_playing') {
            // update latest player
            if (data.Player && data.Player.title != '_recent') {
                await this.setEvent(
                    { ...data, Player: { title: '_recent', uuid: 'player', local: false, publicAddress: '' } },
                    source,
                    prefix,
                );
            }

            // group by player
            const groupBy =
                data.Player && data.Player.title && data.Player.uuid !== undefined
                    ? `${this.library.clean(data.Player.title, true)}-${data.Player.uuid}`
                    : 'unknown';

            void this.library.set({
                node: prefix,
                role: this.library.getNode('plexplayers', true).role,
                description: this.library.getNode('plexplayers', true).description,
            });
            void this.library.set({
                node: `${prefix}.${groupBy}`,
                role: 'channel',
                description: this.library.appendToDescription(
                    this.library.getNode('plex.player', true).description ?? '',
                    ` ${data.Player?.title || this.library.getNode('plex.player.unknown', true).description}`,
                ) as string,
            });

            prefix = `${prefix}.${groupBy}`;
            let playerTemp: any;
            if (data?.event && data.Player && data.Player.title != '_recent') {
                const playerIp = this.library.getDeviceState(`${prefix}.Player.localAddress`);
                const playerPort = this.library.getDeviceState(`${prefix}.Player.port`);
                playerTemp = this.controller.createPlayerIfNotExist({
                    address: playerIp,
                    port: playerPort,
                    config: {
                        title: data.Player.title,
                        uuid: data.Player.uuid,
                    },
                });

                if (['media.play', 'media.resume'].indexOf(data.event) > -1) {
                    if (this.playing.indexOf(data.Player.title) == -1) {
                        this.playing.push(data.Player.title);
                    }
                    if (this.playingDevice.findIndex(player => player.prefix == prefix) == -1) {
                        this.playingDevice.push({
                            prefix,
                            title: data.Player.title,
                            local: data.Player.local,
                            playerIp,
                            playerPort,
                            playerIdentifier: data.Player.uuid,
                        });
                    }
                    this.streams++;
                } else if (['media.stop', 'media.pause'].indexOf(data.event) > -1) {
                    this.playing = this.playing.filter(player => player !== data?.Player?.title);
                    this.playingDevice = this.playingDevice.filter(player => player.prefix !== prefix);
                    if (this.streams > 0) {
                        this.streams--;
                    }
                }

                void this.library.set(
                    {
                        node: '_playing.players',
                        role: this.library.getNode('playing.players', true).role,
                        type: this.library.getNode('playing.players', true).type,
                        description: this.library.getNode('playing.players', true).description,
                    },
                    this.playing.join(','),
                );
                await this.library.set(
                    {
                        node: '_playing.streams',
                        role: this.library.getNode('playing.streams', true).role,
                        type: this.library.getNode('playing.streams', true).type,
                        description: this.library.getNode('plex.player', true).description,
                    },
                    this.streams,
                );
            }

            // add player controls
            if (
                data.Player &&
                data.Player.uuid &&
                this.playerIds.indexOf(data.Player.uuid) == -1 &&
                data.Player.title != '_recent'
            ) {
                void this.getPlayers();
            } else if (
                data.Player &&
                data.Player.title != '_recent' &&
                ['media.play', 'media.resume', 'media.stop', 'media.pause'].indexOf(data.event) > -1
            ) {
                this.library.confirmNode(
                    { node: `${prefix}._Controls.playback.play_switch` },
                    ['media.play', 'media.resume'].indexOf(data.event) > -1,
                );
            }
            if (data.event && data.Player && data.Player.title != '_recent' && playerTemp) {
                playerTemp.setNotificationData(JSON.parse(JSON.stringify(data)));

                // /clients liefert auf modernen PMS oft size=0 → der Player wird nie als
                // controllable erkannt → startUpdater() läuft nicht → keine Metadata-
                // Polling-Updates. Webhook ist nur Trigger; die eigentlichen Felder
                // (Stream/Codec/Director/…) holen wir hier einmalig aus /status/sessions.
                if (['media.play', 'media.resume'].indexOf(data.event) > -1) {
                    playerTemp
                        .getMetadataUpdate()
                        .catch((err: unknown) =>
                            this.log.debug(
                                `getMetadataUpdate failed: ${err instanceof Error ? err.message : String(err)}`,
                            ),
                        );
                }

                data = null;
            }
        } else if (prefix == 'events') {
            await this.library.set(
                {
                    node: prefix,
                    role: this.library.getNode('plex.events', true).role,
                    description: this.library.getNode('plex.events', true).description,
                },
                undefined,
            );

            const event = data.event && data.event.replace('media.', '');

            // Notification entries can be keyed two ways depending on when the user saved
            // their config: the current admin UI stores `media.play`, an older variant
            // stored just `play`. Try the full event name first, then the stripped form,
            // before falling back to the any/event/media wildcards.
            const lookup = (mediaKey: string, eventKey: string): NotificationDef | undefined =>
                this.notifications[mediaKey] && this.notifications[mediaKey][eventKey];
            const message: any = lookup(data.media, data.event) ||
                lookup(data.media, event) ||
                lookup('any', data.event) ||
                lookup('any', event) ||
                lookup(data.media, 'any') ||
                lookup('any', 'any') || {
                    message: '',
                    caption: '',
                    thumb: '',
                    notExist: true,
                };

            if (!message.notExist) {
                const eventData = JSON.parse(JSON.stringify(data));
                const notification: HistoryEntry = {
                    id: uuidv1(),
                    timestamp: data.timestamp,
                    datetime: data.datetime,
                    account: data.Account?.title,
                    player: data.Player?.title,
                    media: data.media,
                    event,
                    ...(data.media === 'episode' && data.Metadata?.parentIndex != null
                        ? { season: data.Metadata.parentIndex }
                        : {}),
                    ...(data.media === 'episode' && data.Metadata?.index != null
                        ? { episode: data.Metadata.index }
                        : {}),
                    thumb: message.thumb
                        ? `${this.library.AXIOS_OPTIONS._protocol}//${this.config.plexIp}:${this.config.plexPort}${this.replacePlaceholders(message.thumb, eventData)}?X-Plex-Token=${this.config.plexToken}`
                        : '',
                    message: this.replacePlaceholders(message.message, eventData),
                    caption: this.replacePlaceholders(message.caption, eventData),
                    source: data.source,
                };
                let addNotification = true;
                for (let i = this.history.length - 1; i >= 0; i--) {
                    const lastItem = this.history[i];
                    if (
                        lastItem.source != notification.source &&
                        lastItem.media == notification.media &&
                        lastItem.account == notification.account
                    ) {
                        addNotification =
                            lastItem.media != notification.media || lastItem.timestamp + 1000 <= notification.timestamp;
                        break;
                    }
                }

                if (addNotification) {
                    this.history.push(notification);
                    if (this.history.length > 1000) {
                        this.history = this.history.slice(-1000);
                    }

                    const combined: Record<string, unknown> = {
                        ...notification,
                        history: JSON.stringify(this.history),
                    };
                    for (const key in combined) {
                        await this.library.readData(`${prefix}.${key}`, combined[key], prefix);
                    }
                }
            } else {
                this.log.debug(`No message defined for ${data.media} ${event}`);
            }
        }

        // write states
        if (data) {
            for (const key in data) {
                await this.library.readData(`${prefix}.${key}`, (data as any)[key], prefix);
            }
        }

        // cleanup old states when playing something new
        if (prefix.indexOf('_playing') > -1 && data?.event == 'media.play') {
            void this.library.runGarbageCollector(prefix, false, 30_000, [
                ...Controller.garbageExcluded,
                '_Controls',
                '_Commands',
            ]);
        }

        // create per-media command states (markWatched, rate, etc.)
        if (prefix.indexOf('_playing') > -1 && ['media.play', 'media.resume'].indexOf(data?.event ?? '') > -1) {
            this.createMetadataCommandStates(prefix, data?.Metadata?.ratingKey);
        }
        return true;
    }

    private replacePlaceholders(message: string, data: any): string {
        let pos: number;
        let variable: string;
        let tmp: any;
        let path: string;
        let index: string;
        while (message.indexOf('%') > -1) {
            pos = message.indexOf('%');
            variable = message.substring(pos, message.indexOf('%', pos + 1) + 1).replace(/%/g, '');
            tmp = JSON.parse(JSON.stringify(data));
            path = variable;
            while (path.indexOf('.') > -1) {
                try {
                    index = path.slice(0, path.indexOf('.'));
                    path = path.slice(path.indexOf('.') + 1);
                    tmp = tmp[index];
                } catch (err: unknown) {
                    this.log.debug(`catch: 30 ${err instanceof Error ? err.message : String(err)}`);
                }
            }
            if (tmp === undefined || tmp[path] === undefined || tmp === null || tmp[path] === null) {
                message = message.replace(RegExp(`%${variable}%`, 'gi'), `(${variable} not found!)`);
            } else {
                message = message.replace(RegExp(`%${variable}%`, 'gi'), tmp[path]);
            }
        }
        return message;
    }

    private isValidApiResponse(res: any): boolean {
        if (
            res === undefined ||
            res.response === undefined ||
            res.response.result === undefined ||
            res.response.result !== 'success'
        ) {
            this.log.warn('API response invalid!');
            this.log.debug(`debug 23 ${JSON.stringify(res)}`);
            return false;
        } else if (res.response.message === 'Invalid apikey') {
            this.log.warn('Invalid API key. No results retrieved!');
            return false;
        }
        return true;
    }

    private getItems(path: string, key: string, node: string): void {
        if (!this.config.getAllItems) {
            return;
        }
        this.plex
            .query(path)
            .then(async (res: any) => {
                await this.library.set(
                    {
                        node: `${node}.itemsCount`,
                        type: this.library.getNode(`${key.toLowerCase()}.itemscount`).type,
                        role: this.library.getNode(`${key.toLowerCase()}.itemscount`).role,
                        description: this.library.getNode(`${key.toLowerCase()}.itemscount`).description,
                    },
                    res.MediaContainer.size,
                );
            })
            .catch((err: unknown) => {
                this.log.debug(`Could not retrieve items for ${key} from Plex!`);
                this.log.debug(err instanceof Error ? err.message : String(err));
            });
    }

    private getServers(): void {
        this.plex
            .query('/servers')
            .then((res: any) => {
                this.log.debug('Retrieved Servers from Plex.');
                void this.library.set(
                    {
                        node: 'servers',
                        role: this.library.getNode('servers').role,
                        description: this.library.getNode('servers').description,
                    },
                    undefined,
                );

                const data = res.MediaContainer.Server || [];
                data.forEach((entry: any) => {
                    const serverId = entry.name.toLowerCase();
                    void this.library.set(
                        {
                            node: `servers.${serverId}`,
                            role: this.library.getNode('server').role,
                            description: this.library.replaceDescription(
                                this.library.getNode('server').description ?? '',
                                '%server%',
                                entry.name,
                            ) as string,
                        },
                        undefined,
                    );
                    for (const key in entry) {
                        void this.library.set(
                            {
                                node: `servers.${serverId}.${key}`,
                                role: this.library.getNode(`servers.${key.toLowerCase()}`).role,
                                type: this.library.getNode(`servers.${key.toLowerCase()}`).type,
                                description: this.library.getNode(`servers.${key.toLowerCase()}`).description,
                            },
                            entry[key],
                        );
                    }
                });
            })
            .catch((err: unknown) => {
                this.log.debug('Could not retrieve Servers from Plex!');
                this.log.debug(err instanceof Error ? err.message : String(err));
            });
    }

    private getLibraries(): void {
        this.plex
            .query('/library/sections')
            .then((res: any) => {
                this.log.debug('Retrieved Libraries from Plex.');
                void this.library.set({
                    node: 'libraries',
                    role: this.library.getNode('libraries').role,
                    description: this.library.getNode('libraries').description,
                });

                const data = res.MediaContainer.Directory || [];
                data.forEach((entry: any) => {
                    const libId = `${entry.key}-${entry.title.toLowerCase()}`;
                    void this.library.set(
                        {
                            node: `libraries.${libId}`,
                            role: this.library.getNode('library').role,
                            description: this.library.replaceDescription(
                                this.library.getNode('library').description ?? '',
                                '%library%',
                                entry.title,
                            ) as string,
                        },
                        undefined,
                    );

                    void this.library.set(
                        {
                            node: `libraries.${libId}._refresh`,
                            type: 'boolean',
                            role: 'button.refresh',
                            description: 'Scan + force refresh metadata',
                            common: { write: true, read: false },
                        },
                        false,
                    );
                    void this.subscribeStatesAsync(`libraries.${libId}._refresh`);

                    void this.library.set({
                        node: `libraries.${libId}._commands`,
                        role: 'channel',
                        description: 'Library Commands',
                    });
                    for (const [cmdName, cmdDef] of Object.entries(_SERVER_COMMANDS.libraryCommands)) {
                        const nodeKey = `libraries.${libId}._commands.${cmdName}`;
                        void this.library.set(
                            {
                                node: nodeKey,
                                role: cmdDef.role,
                                type: cmdDef.type as ioBroker.CommonType,
                                description: cmdDef.description,
                            },
                            false,
                        );
                        void this.subscribeStatesAsync(nodeKey);
                    }

                    for (const key in entry) {
                        void this.library.set(
                            {
                                node: `libraries.${libId}.${key.toLowerCase()}`,
                                type: this.library.getNode(`libraries.${key.toLowerCase()}`).type,
                                role: this.library.getNode(`libraries.${key.toLowerCase()}`).role,
                                description: this.library.getNode(`libraries.${key.toLowerCase()}`).description,
                            },
                            typeof entry[key] == 'object' ? JSON.stringify(entry[key]) : entry[key],
                        );
                    }

                    this.getItems(`/library/sections/${entry.key}/all`, 'libraries', `libraries.${libId}`);

                    if (this.config.getStatistics) {
                        this.tautulli
                            .get('get_library_watch_time_stats', { section_id: entry.key })
                            .then((res2: any) => {
                                if (!this.isValidApiResponse(res2)) {
                                    return;
                                }
                                const stats = res2.response.data || [];
                                this.log.debug(`Retrieved Watch Statistics for Library ${entry.title} from Tautulli.`);

                                void this.library.set({
                                    node: 'statistics',
                                    role: this.library.getNode('statistics').role,
                                    description: this.library.getNode('statistics').description,
                                });
                                void this.library.set({
                                    node: 'statistics.libraries',
                                    role: this.library.getNode('statistics.libraries').role,
                                    description: this.library.replaceDescription(
                                        this.library.getNode('statistics.libraries').description ?? '',
                                        '%library%',
                                        '',
                                    ) as string,
                                });
                                void this.library.set({
                                    node: `statistics.libraries.${libId}`,
                                    role: this.library.getNode('statistics.libraries').role,
                                    description: this.library.replaceDescription(
                                        this.library.getNode('statistics.libraries').description ?? '',
                                        '%library%',
                                        entry.title,
                                    ) as string,
                                });

                                stats.forEach((statEntry: any, i: number) => {
                                    const id = WATCHED[i];
                                    void this.library.set({
                                        node: `statistics.libraries.${libId}.${id}`,
                                        type: this.library.getNode(`statistics.${id}`).type,
                                        role: this.library.getNode(`statistics.${id}`).role,
                                        description: this.library.getNode(`statistics.${id}`).description,
                                    });

                                    for (const key in statEntry) {
                                        void this.library.set(
                                            {
                                                node: `statistics.libraries.${libId}.${id}.${key}`,
                                                type: this.library.getNode(`statistics.${key}`).type,
                                                role: this.library.getNode(`statistics.${key}`).role,
                                                description: this.library.getNode(`statistics.${key}`).description,
                                            },
                                            statEntry[key],
                                        );
                                    }
                                });
                            })
                            .catch((err: unknown) => {
                                this.log.debug(
                                    `Could not retrieve library watch statistics from Tautulli (${this.config.tautulliIp}:${this.config.tautulliPort}): ${err instanceof Error ? err.message : String(err)}`,
                                );
                            });
                    }
                });
            })
            .catch((err: unknown) => {
                this.log.debug('Could not retrieve Libraries from Plex!');
                this.log.debug(err instanceof Error ? err.message : String(err));
            });
    }

    private getUsers(): void {
        this.tautulli
            .get('get_users')
            .then((res: any) => {
                if (!this.isValidApiResponse(res)) {
                    return;
                }
                const data = res.response.data || [];
                this.log.debug('Retrieved Users from Tautulli.');
                void this.library.set({
                    node: 'users',
                    role: this.library.getNode('users').role,
                    description: this.library.getNode('users').description,
                });

                data.forEach((entry: any) => {
                    const userName = entry.username || entry.friendly_name || entry.email || entry.user_id;
                    const userId = this.library.clean(userName, true).replace(/\./g, '');
                    if (userId === 'local') {
                        return;
                    }

                    void this.library.set({
                        node: `users.${userId}`,
                        role: this.library.getNode('user').role,
                        description: this.library.replaceDescription(
                            this.library.getNode('user').description ?? '',
                            '%user%',
                            userName,
                        ) as string,
                    });

                    for (const key in entry) {
                        if (key === 'server_token') {
                            continue;
                        }
                        void this.library.set(
                            {
                                node: `users.${userId}.${key}`,
                                role: this.library.getNode(`users.${key.toLowerCase()}`).role,
                                type: this.library.getNode(`users.${key.toLowerCase()}`).type,
                                description: this.library.getNode(`users.${key.toLowerCase()}`).description,
                            },
                            entry[key],
                        );
                    }

                    if (this.config.getStatistics) {
                        this.tautulli
                            .get('get_user_watch_time_stats', { user_id: entry.user_id })
                            .then((res2: any) => {
                                if (!this.isValidApiResponse(res2)) {
                                    return;
                                }
                                const stats = res2.response.data || [];
                                this.log.debug(`Retrieved Watch Statistics for User ${userName} from Tautulli.`);

                                void this.library.set({
                                    node: 'statistics.users',
                                    role: this.library.getNode('statistics.users').role,
                                    description: this.library.replaceDescription(
                                        this.library.getNode('statistics.users').description ?? '',
                                        '%user%',
                                        '',
                                    ) as string,
                                });
                                void this.library.set({
                                    node: `statistics.users.${userId}`,
                                    role: this.library.getNode('statistics.users').role,
                                    description: this.library.replaceDescription(
                                        this.library.getNode('statistics.users').description ?? '',
                                        '%user%',
                                        userName,
                                    ) as string,
                                });

                                stats.forEach((statEntry: any, i: number) => {
                                    const id = WATCHED[i];
                                    void this.library.set({
                                        node: `statistics.users.${userId}.${id}`,
                                        type: this.library.getNode(`statistics.${id}`).type,
                                        role: this.library.getNode(`statistics.${id}`).role,
                                        description: this.library.getNode(`statistics.${id}`).description,
                                    });

                                    for (const key in statEntry) {
                                        void this.library.set(
                                            {
                                                node: `statistics.users.${userId}.${id}.${key}`,
                                                type: this.library.getNode(`statistics.${key}`).type,
                                                role: this.library.getNode(`statistics.${key}`).role,
                                                description: this.library.getNode(`statistics.${key}`).description,
                                            },
                                            statEntry[key],
                                        );
                                    }
                                });
                            })
                            .catch((err: unknown) => {
                                this.log.debug(
                                    `Could not retrieve user watch statistics from Tautulli (${this.config.tautulliIp}:${this.config.tautulliPort}): ${err instanceof Error ? err.message : String(err)}`,
                                );
                            });
                    }
                });
            })
            .catch((err: unknown) => {
                this.log.debug('Could not retrieve Users from Tautulli!');
                this.log.debug(err instanceof Error ? err.message : String(err));
            });
    }

    private getSettings(): void {
        this.plex
            .query('/:/prefs')
            .then((res: any) => {
                const data = res.MediaContainer.Setting || [];
                this.log.debug('Retrieved Settings from Plex.');
                void this.library.set({
                    node: 'settings',
                    role: this.library.getNode('settings').role,
                    description: this.library.getNode('settings').description,
                });

                data.forEach((entry: any) => {
                    entry.group = !entry.group ? 'other' : entry.group;
                    void this.library.set({
                        node: `settings.${entry.group}`,
                        role: 'channel',
                        description: `Settings ${this.library.ucFirst(entry.group)}`,
                    });
                    const settingId = `settings.${entry.group}.${entry.id}`;
                    const settingType =
                        entry.type == 'bool' ? 'boolean' : entry.type == 'int' ? 'number' : 'string';
                    const settingRole = entry.type == 'bool' ? 'switch' : entry.type == 'int' ? 'value' : 'text';
                    // extendObjectAsync bypasses _STATES cache so write:true is persisted even for existing objects
                    void this.extendObjectAsync(settingId, {
                        type: 'state',
                        common: {
                            name: entry.label,
                            role: settingRole,
                            type: settingType,
                            write: true,
                            read: true,
                        } as any,
                        native: {},
                    }).then(() => {
                        const converted =
                            settingType === 'boolean'
                                ? Boolean(entry.value)
                                : settingType === 'number'
                                  ? Number(entry.value)
                                  : String(entry.value);
                        void this.setStateAsync(settingId, { val: converted, ack: true });
                    });
                    void this.subscribeStatesAsync(settingId);
                });
            })
            .catch((err: unknown) => {
                this.log.debug('Could not retrieve Settings from Plex!');
                this.log.debug(err instanceof Error ? err.message : String(err));
            });
    }

    private getPlaylists(): void {
        this.plex
            .query('/playlists')
            .then((res: any) => {
                const data = res.MediaContainer.Metadata || [];
                this.log.debug('Retrieved Playlists from Plex.');
                void this.library.set({
                    node: 'playlists',
                    role: this.library.getNode('playlists').role,
                    description: this.library.getNode('playlists').description,
                });

                data.forEach((entry: any) => {
                    const playlistId = this.library.clean(entry.title, true);
                    void this.library.set({
                        node: `playlists.${playlistId}`,
                        role: 'channel',
                        description: `Playlist ${entry.title}`,
                    });
                    for (const key in entry) {
                        const node = this.library.getNode(`playlists.${key.toLowerCase()}`);
                        node.key = `playlists.${playlistId}.${key}`;
                        entry[key] = this.library.convertNode(node, entry[key]);

                        void this.library.set(
                            {
                                node: `playlists.${playlistId}.${key}`,
                                type: node.type,
                                role: node.role,
                                description: node.description,
                            },
                            entry[key],
                        );
                    }

                    this.getItems(entry.key, 'playlists', `playlists.${playlistId}`);
                });
            })
            .catch((err: unknown) => {
                this.log.debug('Could not retrieve Playlists from Plex!');
                this.log.debug(err instanceof Error ? err.message : String(err));
            });
    }

    /**
     * Multi-source player discovery. Plex deprecated local GDM client registration:
     * `/clients` on PMS returns size:0 for modern apps (Plexamp, Plex iOS/Android,
     * PlexHTPC, newer TVs). The canonical pattern (used by python-plexapi and
     * Home Assistant) merges three sources, dedupliziert über `machineIdentifier`:
     *   1. plex.tv/api/v2/resources — primary, account-scoped
     *   2. /status/sessions on PMS — picks up actively streaming devices
     *   3. /clients on PMS — legacy GDM-only devices
     */
    /**
     * Read the object tree once at startup to figure out which players were confirmed in past
     * adapter runs. Populates `knownPlayerIds` from `_playing.*` channels carrying
     * `native.isPlayer=true`. Idempotent — safe to call again, but really only needed once.
     */
    /**
     * Open the PMS WebSocket notifications stream (`/:/websockets/notifications`).
     *
     * Replaces per-player `/player/timeline/poll` for Companion devices, where the legacy
     * endpoint returns 404. PMS pushes `playing` events whenever a session changes state
     * (play/pause/seek/stop) — we react by re-running `getPlayers()` (which reads
     * `/status/sessions`) so the existing player-update plumbing picks up the new state.
     *
     * No-op if the notifications client is already running.
     */
    private startPlexNotifications(): void {
        if (this.alertsClient) {
            return;
        }
        if (!this.config.plexIp || !this.config.plexToken) {
            return;
        }
        this.alertsClient = new PlexNotifications({
            hostname: this.config.plexIp,
            port: this.config.plexPort || 32_400,
            https: !!this.library.AXIOS_OPTIONS.secureConnection,
            token: this.config.plexToken,
            log: {
                debug: m => this.log.debug(m),
                info: m => this.log.info(m),
                warn: m => this.log.warn(m),
                error: m => this.log.error(m),
            },
            rejectUnauthorized: this.library.AXIOS_OPTIONS.rejectUnauthorized === true,
            // Identity headers — same set we send on REST. Some Plex setups (especially behind
            // reverse proxies) don't deliver notifications without a recognizable client identity.
            headers: {
                'X-Plex-Client-Identifier': PLEX_OPTIONS.identifier,
                'X-Plex-Product': PLEX_OPTIONS.product,
                'X-Plex-Version': PLEX_OPTIONS.version,
                'X-Plex-Device-Name': PLEX_OPTIONS.deviceName,
                'X-Plex-Platform': PLEX_OPTIONS.platform,
                'X-Plex-Platform-Version': PLEX_OPTIONS.platformVersion,
                'X-Plex-Provides': 'controller',
            },
        });
        this.alertsClient.setHandler(({ type, payload }) => this.handlePlexNotification(type, payload));
        this.alertsClient.start();
    }

    /**
     * Dispatch a single `NotificationContainer` to the relevant downstream handler.
     * Keep this fast — Plex sends `playing` ~1/s during active playback, plus library
     * updates can be heavy. We schedule a debounced sessions refresh rather than
     * reacting per frame.
     *
     * @param type Notification type string from the PMS WebSocket (e.g. `playing`, `activity`)
     * @param _payload Raw notification payload (currently unused)
     */
    private handlePlexNotification(type: string, _payload: unknown): void {
        if (this.unloaded) {
            return;
        }
        switch (type) {
            case 'playing': {
                // Debounce: a single getPlayers() call within 500ms of the latest event
                // covers any number of intervening playing/state changes.
                if (this.alertsRefreshTimer) {
                    return;
                }
                this.alertsRefreshTimer = setTimeout(() => {
                    this.alertsRefreshTimer = null;
                    void this.getPlayers();
                }, 500);
                break;
            }
            // Other types (activity, progress, transcodeSession.*, library.update) — currently
            // not consumed. Add cases here when we wire them up.
            default:
                break;
        }
    }

    private async loadKnownPlayers(): Promise<void> {
        try {
            const objs = await this.getAdapterObjectsAsync();
            this.knownPlayerIds.clear();
            const prefix = `${this.name}.${this.instance}._playing.`;
            for (const id in objs) {
                if (!id.startsWith(prefix)) {
                    continue;
                }
                const obj = objs[id];
                if (!obj || obj.type !== 'channel') {
                    continue;
                }
                const native = (obj as any).native || {};
                if (native.isPlayer === true && typeof native.uuid === 'string' && native.uuid) {
                    this.knownPlayerIds.add(native.uuid);
                }
            }
            this.log.debug(`loadKnownPlayers: ${this.knownPlayerIds.size} known player(s) restored from object tree`);
        } catch (err: unknown) {
            this.log.debug(`loadKnownPlayers failed: ${err instanceof Error ? err.message : String(err)}`);
        }
    }

    private async getPlayers(): Promise<void> {
        const found = new Map<string, Plex.DiscoveredPlayer>();
        // Devices from /devices.xml that lack a `provides` attribute (Plex returns empty
        // for mobile/web apps). Only promoted to `found` if a later source (/status/sessions
        // or /clients) confirms the identifier as an actual player. This prevents zombie
        // Plex Web entries that were never used from polluting the object tree.
        const candidates = new Map<string, Plex.Tv.Device>();

        // 1) plex.tv resources — primary
        try {
            const resources = await this.plex.fetchPlexTvResources(this.config.plexToken);
            this.log.debug(`plex.tv/resources returned ${resources.length} entries`);
            const provideSummary: string[] = [];
            let acceptedCount = 0;
            let droppedNoProvides = 0;
            let droppedNotPlayer = 0;
            let droppedNoConn = 0;
            for (const r of resources) {
                if (!r || !r.clientIdentifier || !r.provides) {
                    droppedNoProvides++;
                    continue;
                }
                provideSummary.push(`${r.name || r.device || '?'}=[${r.provides}]`);
                const provides = r.provides.split(',').map(s => s.trim());
                if (!provides.includes('player') && !provides.includes('pubsub-player')) {
                    droppedNotPlayer++;
                    continue;
                }
                const conn = pickBestConnection(r.connections);
                if (!conn) {
                    droppedNoConn++;
                    continue;
                }
                acceptedCount++;
                found.set(r.clientIdentifier, {
                    uuid: r.clientIdentifier,
                    title: r.name || r.device || 'Plex Player',
                    address: conn.address,
                    port: conn.port,
                    provides: r.provides,
                    // /resources doesn't expose protocolCapabilities. Companion-only players
                    // (Plexamp, mobile, newer TVs) reach PMS via pubsub-websocket, not the
                    // HTTP `/player/...` proxy — only `playback` commands are reliably
                    // forwarded that way. `navigation`/`mirror`/`playqueues` would create
                    // ghost folders that never get populated, so synthesize the minimal set.
                    // `timeline` stays in for the internal `refreshDetails` flag.
                    // `/clients` discoveries below override this with the real value when
                    // available; that path keeps full capability coverage for GDM devices.
                    protocolCapabilities: 'timeline,playback',
                    sources: ['plex.tv/resources'],
                    raw: { ...r },
                    publicAddress: r.publicAddress,
                    local: conn.local,
                    relay: conn.relay,
                    product: r.product,
                    platform: r.platform,
                    device: r.device,
                });
            }
            this.log.debug(
                `plex.tv/resources filter: accepted=${acceptedCount}, ` +
                    `droppedNoProvides=${droppedNoProvides}, droppedNotPlayer=${droppedNotPlayer}, ` +
                    `droppedNoConn=${droppedNoConn}`,
            );
            if (provideSummary.length > 0) {
                this.log.debug(`plex.tv/resources provides: ${provideSummary.join(' | ')}`);
            }
        } catch (err: unknown) {
            const code = (err as { code?: string }).code;
            if (code === 'PLEX_TV_UNAUTHORIZED') {
                this.log.info(
                    'plex.tv rejected the token for /api/v2/resources — falling back to PMS-only discovery. ' +
                        'If modern Plex apps are missing, regenerate the token via the wizard.',
                );
            } else {
                this.log.debug(`plex.tv/resources unavailable: ${err instanceof Error ? err.message : String(err)}`);
            }
        }

        // 1b) plex.tv/devices.xml — Companion-only apps (iPad, Plexamp, mobile) only show up
        // here, not in /api/v2/resources. /devices.xml typically has no Connection block for
        // Companion devices — they're reachable only via PMS-Pubsub-Proxy, so address/port=0
        // is fine; setClientData() and action() route through PMS via X-Plex-Target-Client-Identifier.
        try {
            const devices = await this.plex.fetchPlexTvDevices(this.config.plexToken);
            this.log.debug(`plex.tv/devices returned ${devices.length} entries`);
            const acceptedSummary: string[] = [];
            const candidateSummary: string[] = [];
            const droppedSummary: string[] = [];
            let acceptedCount = 0;
            let candidateCount = 0;
            let droppedNotPlayer = 0;
            let droppedDuplicate = 0;
            for (const d of devices) {
                if (!d || !d.clientIdentifier) {
                    continue;
                }
                const desc = `${d.name || d.device || '?'}/${d.product || '?'}=[${d.provides || ''}]`;
                if (!d.provides) {
                    // Empty `provides` — could be a real player (mobile/web app) or junk.
                    // Hold as candidate; only promote if /status/sessions or /clients confirm it.
                    candidates.set(d.clientIdentifier, d);
                    candidateSummary.push(desc);
                    candidateCount++;
                    continue;
                }
                const provides = d.provides.split(',').map(s => s.trim());
                const isPlayer = provides.includes('player') || provides.includes('pubsub-player');
                if (!isPlayer) {
                    droppedNotPlayer++;
                    droppedSummary.push(desc);
                    continue;
                }
                if (found.has(d.clientIdentifier)) {
                    const existing = found.get(d.clientIdentifier)!;
                    if (!existing.sources.includes('plex.tv/devices')) {
                        existing.sources.push('plex.tv/devices');
                    }
                    droppedDuplicate++;
                    continue;
                }
                acceptedSummary.push(desc);
                const conn = d.connections.find(c => c.local) || d.connections[0];
                found.set(d.clientIdentifier, {
                    uuid: d.clientIdentifier,
                    title: d.name || d.device || 'Plex Player',
                    address: conn?.address || '',
                    port: conn?.port || 0,
                    protocolCapabilities: 'timeline,playback',
                    sources: ['plex.tv/devices'],
                    raw: { ...d },
                    publicAddress: d.publicAddress,
                    local: conn?.local,
                    product: d.product,
                    platform: d.platform,
                    device: d.device,
                    provides: d.provides,
                });
                acceptedCount++;
            }
            this.log.debug(
                `plex.tv/devices filter: accepted=${acceptedCount}, candidates=${candidateCount}, ` +
                    `droppedNotPlayer=${droppedNotPlayer}, droppedDuplicate=${droppedDuplicate}`,
            );
            if (acceptedSummary.length > 0) {
                this.log.debug(`plex.tv/devices accepted: ${acceptedSummary.join(' | ')}`);
            }
            if (candidateSummary.length > 0) {
                this.log.debug(
                    `plex.tv/devices candidates (need session confirmation): ${candidateSummary.join(' | ')}`,
                );
            }
            if (droppedSummary.length > 0) {
                this.log.debug(`plex.tv/devices dropped: ${droppedSummary.join(' | ')}`);
            }
        } catch (err: unknown) {
            const code = (err as { code?: string }).code;
            if (code === 'PLEX_TV_UNAUTHORIZED') {
                this.log.debug('plex.tv/devices rejected token (already logged for /resources).');
            } else {
                this.log.debug(`plex.tv/devices unavailable: ${err instanceof Error ? err.message : String(err)}`);
            }
        }

        // 2) /status/sessions — secondary
        try {
            const sess: any = await this.plex.query('/status/sessions');
            const items: any[] = (sess && sess.MediaContainer && sess.MediaContainer.Metadata) || [];
            for (const m of items) {
                const p = m && m.Player;
                if (!p || !p.machineIdentifier) {
                    continue;
                }
                const existing = found.get(p.machineIdentifier);
                if (existing) {
                    if (!existing.address && p.address) {
                        existing.address = p.address;
                    }
                    if (existing.local === undefined && typeof p.local === 'boolean') {
                        existing.local = p.local;
                    }
                    if (!existing.sources.includes('/status/sessions')) {
                        existing.sources.push('/status/sessions');
                    }
                } else {
                    // Promote a /devices.xml candidate if its identifier matches an active session.
                    const cand = candidates.get(p.machineIdentifier);
                    const sources = cand ? ['plex.tv/devices', '/status/sessions'] : ['/status/sessions'];
                    found.set(p.machineIdentifier, {
                        uuid: p.machineIdentifier,
                        title: (cand && cand.name) || p.title || 'Plex Player',
                        address: p.address || '',
                        port: 0,
                        protocolCapabilities: 'timeline,playback',
                        sources,
                        raw: cand ? { ...cand, ...p } : { ...p },
                        publicAddress: (cand && cand.publicAddress) || p.remotePublicAddress,
                        local: p.local,
                        product: (cand && cand.product) || p.product,
                        platform: (cand && cand.platform) || p.platform,
                        device: (cand && cand.device) || p.device,
                        // Promoted candidates inherit the (empty) provides from /devices.xml — keep it
                        // explicitly so isControllable() can decide. Pure /status/sessions players
                        // also have no `provides`, which is correct: they're Companion-only.
                        provides: cand ? cand.provides : '',
                    });
                    if (cand) {
                        candidates.delete(p.machineIdentifier);
                    }
                }
            }
        } catch (err: unknown) {
            this.log.debug(
                `/status/sessions unavailable during getPlayers: ${err instanceof Error ? err.message : String(err)}`,
            );
        }

        // 3) /clients — tertiary, legacy GDM
        try {
            const cli: any = await this.plex.query('/clients');
            const items: any[] = (cli && cli.MediaContainer && cli.MediaContainer.Server) || [];
            for (const c of items) {
                if (!c || !c.machineIdentifier) {
                    continue;
                }
                const existing = found.get(c.machineIdentifier);
                if (existing) {
                    // /clients is the only source that exposes real protocolCapabilities;
                    // prefer it over the synthesized default.
                    if (c.protocolCapabilities) {
                        existing.protocolCapabilities = c.protocolCapabilities;
                    }
                    if (!existing.address && c.address) {
                        existing.address = c.address;
                    }
                    if (!existing.port && c.port) {
                        existing.port = Number(c.port);
                    }
                    if (!existing.sources.includes('/clients')) {
                        existing.sources.push('/clients');
                    }
                    Object.assign(existing.raw, c);
                } else {
                    const cand = candidates.get(c.machineIdentifier);
                    const sources = cand ? ['plex.tv/devices', '/clients'] : ['/clients'];
                    found.set(c.machineIdentifier, {
                        uuid: c.machineIdentifier,
                        title: c.name || (cand && cand.name) || 'Plex Player',
                        address: c.address || '',
                        port: Number(c.port) || 0,
                        protocolCapabilities: c.protocolCapabilities || 'none',
                        sources,
                        raw: cand ? { ...cand, ...c } : { ...c },
                        product: c.product || (cand && cand.product),
                        platform: c.platform || (cand && cand.platform),
                        device: c.device || (cand && cand.device),
                        // /clients devices are GDM — implicitly controllable via HTTP regardless of provides.
                        provides: 'player',
                    });
                    if (cand) {
                        candidates.delete(c.machineIdentifier);
                    }
                }
            }
        } catch (err: unknown) {
            this.log.debug(`/clients unavailable: ${err instanceof Error ? err.message : String(err)}`);
        }

        // Promote candidates that were confirmed as players in past adapter runs
        // (object tree carries native.isPlayer=true). Restored once at startup by
        // loadKnownPlayers(). Avoids requiring an active session on every restart.
        if (candidates.size > 0 && this.knownPlayerIds.size > 0) {
            const promoted: string[] = [];
            for (const [uuid, cand] of candidates) {
                if (!this.knownPlayerIds.has(uuid)) {
                    continue;
                }
                const conn = cand.connections.find(c => c.local) || cand.connections[0];
                found.set(uuid, {
                    uuid,
                    title: cand.name || cand.device || 'Plex Player',
                    address: conn?.address || '',
                    port: conn?.port || 0,
                    protocolCapabilities: 'timeline,playback',
                    sources: ['plex.tv/devices', 'native'],
                    raw: { ...cand },
                    publicAddress: cand.publicAddress,
                    local: conn?.local,
                    product: cand.product,
                    platform: cand.platform,
                    device: cand.device,
                    provides: cand.provides,
                });
                promoted.push(`${cand.name || cand.device || '?'}/${cand.product || '?'}`);
                candidates.delete(uuid);
            }
            if (promoted.length > 0) {
                this.log.debug(`plex.tv/devices candidates promoted via known-player history: ${promoted.join(' | ')}`);
            }
        }

        if (candidates.size > 0) {
            const unconfirmed = [...candidates.values()]
                .map(d => `${d.name || d.device || '?'}/${d.product || '?'}`)
                .join(' | ');
            this.log.debug(
                `plex.tv/devices candidates not confirmed by sessions/clients/native (skipped): ${unconfirmed}`,
            );
        }

        this.log.debug(
            `getPlayers: discovered ${found.size} player(s) from ${[...found.values()].map(p => p.sources.join('+')).join(', ') || '(none)'}`,
        );

        this.playerIds.length = 0;
        for (const player of found.values()) {
            if (!player.title || !player.uuid) {
                continue;
            }
            this.playerIds.push(player.uuid);
            const playerTemp = this.controller.createPlayerIfNotExist({
                address: player.address,
                port: player.port,
                config: {
                    title: player.title,
                    uuid: player.uuid,
                    name: player.title,
                    protocolCapabilities: player.protocolCapabilities,
                    publicAddress: player.publicAddress,
                    product: player.product,
                    platform: player.platform,
                    device: player.device,
                },
            });
            // setClientData expects a /clients-style payload. Normalize the merged
            // record so it consumes uniform field names regardless of source.
            playerTemp.setClientData({
                ...player.raw,
                machineIdentifier: player.uuid,
                name: player.title,
                title: player.title,
                address: player.address,
                port: player.port,
                protocolCapabilities: player.protocolCapabilities,
                remotePublicAddress: player.publicAddress,
                _sources: player.sources,
                _provides: player.provides,
            });
            // Persist player metadata in the channel object's `native` block — read on
            // next startup by loadKnownPlayers() so candidates with empty `provides` can
            // be re-promoted without needing an active session every time.
            void this.extendObject(playerTemp.prefix, {
                native: {
                    uuid: player.uuid,
                    isPlayer: true,
                    lastSeenAt: new Date().toISOString(),
                    lastSeenSource: player.sources.join('+'),
                    product: player.product,
                    platform: player.platform,
                    device: player.device,
                },
            } as Partial<ioBroker.Object>);
            this.knownPlayerIds.add(player.uuid);
        }
    }

    private async startListener(): Promise<void> {
        const app = express();
        app.use(bodyParser.json({ limit: '100kb' }));
        app.use(bodyParser.urlencoded({ extended: false, limit: '100kb' }));

        app.post('/plex', this.upload.single('thumb'), async (req: Request, res: Response) => {
            const cleanupTempFile = (): void => {
                if (req.file && req.file.path) {
                    fs.unlink(req.file.path, () => {
                        /* best-effort cleanup */
                    });
                }
            };
            try {
                this.log.debug(`Incoming data from plex with ip: ${(req.ip || '').replace('::ffff:', '')}`);
                if (!req.body || typeof req.body.payload !== 'string') {
                    res.sendStatus(400);
                    cleanupTempFile();
                    return;
                }
                const payload = JSON.parse(req.body.payload);
                res.sendStatus(200);

                if (!payload || !payload.event) {
                    cleanupTempFile();
                    return;
                }

                if (
                    ['media.play', 'media.pause', 'media.stop', 'media.resume', 'media.rate', 'media.scrobble'].indexOf(
                        payload.event,
                    ) > -1
                ) {
                    await this.setEvent(payload, 'plex', '_playing');
                }

                await this.setEvent(payload, 'plex', 'events');
            } catch (e: unknown) {
                this.log.warn(`startListener: ${e instanceof Error ? e.message : String(e)}`);
                if (!res.headersSent) {
                    res.sendStatus(400);
                }
            } finally {
                cleanupTempFile();
            }
        });

        if (this.config.tautulliEnabled) {
            app.post('/tautulli', (req: Request, res: Response) => {
                try {
                    this.log.debug(`Incoming data from tautulli with ip: ${(req.ip || '').replace('::ffff:', '')}`);
                    const payload = req.body;
                    if (!payload || !payload.event) {
                        res.sendStatus(400);
                        return;
                    }
                    res.sendStatus(200);

                    if (
                        [
                            'media.play',
                            'media.pause',
                            'media.stop',
                            'media.resume',
                            'media.rate',
                            'media.scrobble',
                        ].indexOf(payload.event) > -1
                    ) {
                        void this.setEvent(payload, 'tautulli', '_playing');
                    }

                    void this.setEvent(payload, 'tautulli', 'events');
                } catch (e: unknown) {
                    this.log.warn(
                        `Tautulli notification ${e instanceof Error ? e.message : String(e)} - check the webhook data configuration page in Tautulli. https://forum.iobroker.net/post/1029571`,
                    );
                    if (!res.headersSent) {
                        res.sendStatus(400);
                    }
                }
            });
        }

        if (this.httpServer) {
            this.log.error('HTTP Server already running!');
            const helper = async (params: HttpServer): Promise<void> => {
                await new Promise(resolve => {
                    params?.close(() => {
                        resolve(true);
                    });
                });
            };
            await helper(this.httpServer);
        }
        this.httpServer = app.listen(this.config.webhookPort || 41_891, this.config.webhookIp);
        this.httpServer.on('error', (err: Error) => {
            this.log.error(
                `Failed to start webhook listener on ${this.config.webhookIp || '0.0.0.0'}:${this.config.webhookPort || 41_891} - ${err.message}`,
            );
        });
    }

    private refreshViewOffset = (): void => {
        if (!this.unloaded) {
            if (this.detailsCounter++ > 15) {
                this.detailsCounter = 0;
            }
            this.playingDevice.forEach(player => {
                let state = `${player.prefix}.Metadata.viewOffset`;
                const value = (this.library.getDeviceState(state) || 0) + 1000;
                let node = this.library.getNode('playing.metadata.viewOffset', true);
                void this.library.set(
                    {
                        node: state,
                        type: node.type,
                        role: node.role,
                        description: node.description,
                    },
                    value,
                );
                state += 'Seconds';
                node = this.library.getNode('playing.metadata.viewOffset', true);
                void this.library.set(
                    {
                        node: state,
                        type: node.type,
                        role: node.role,
                        description: node.description,
                    },
                    value / 1000,
                );
            });
        }
    };
}

if (require.main !== module) {
    module.exports = (options: Partial<utils.AdapterOptions> | undefined) => new Plex(options);
} else {
    (() => new Plex())();
}
