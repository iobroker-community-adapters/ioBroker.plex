'use strict';
const ioPackage = require('./io-package.json');
const adapterName = ioPackage.common.name;
const utils = require('@iobroker/adapter-core'); // Get common adapter utils

const _fs = require('fs');
const _http = require('express')();
const _parser = require('body-parser');
const _multer = require('multer');
const _axios = require('axios');
const { v1: _uuid } = require('uuid');

const Plex = require('plex-api');
const Tautulli = require('tautulli-api');

/*
 * internal libraries
 */
const Library = require(`${__dirname}/lib/library.js`);
const PlexPinAuth = require(`${__dirname}/lib/plexPinAuth.js`);
const _NODES = JSON.parse(_fs.readFileSync('./_NODES.json').toString());
const _ACTIONS = JSON.parse(_fs.readFileSync('./_ACTIONS.json').toString());
const _PLAYERDETAILS = JSON.parse(_fs.readFileSync('./_PLAYERDETAILS.json').toString());
const { Controller } = require(`${__dirname}/lib/players.js`);

/*
 * constants & variables initiation
 */
let adapter;
let library;
let controller;
let unloaded;
let retryCycle, refreshCycle;

// Temp Json only for new Data

let encryptionKey;
let plex, tautulli, data;

let detailsCounter = 0;
/**
 * players: 				maschine-id of players
 * playing: 				friendly name of running players
 * streams: 				number of active streams
 * playingDevice: 			object
 * playingDevice.prefix: 	state prefix of runnning players
 * playingDevice.start: 	start date since last update
 */
let playing = [],
    streams = 0,
    playingDevice = [];
const players = [];

let history = [];
const notifications = {};
const upload = _multer({ dest: '/tmp/' });
let refreshInterval = null;

const watched = ['01-last_24h', '02-last_7d', '03-last_30d', '00-all_time'];
const plexOptions = {
    identifier: '5cc42810-6dc0-44b1-8c70-747152d4f7f9',
    product: 'Plex for ioBroker',
    version: '1.0',
    deviceName: 'ioBroker',
    platform: 'ioBroker',
};

/*
 * ADAPTER
 *
 */
function startAdapter(options) {
    options = options || {};
    adapter = new utils.Adapter({ ...options, name: adapterName });

    /*
     * ADAPTER READY
     *
     */
    adapter.on('ready', function ready() {
        library = new Library(adapter, {
            nodes: _NODES,
            actions: _ACTIONS,
            updatesInLog: adapter.config.debug || false,
        });

        unloaded = false;
        refreshInterval = adapter.setInterval(refreshViewOffset, 1000);

        // set encryption key
        if (adapter.config.encryptionKey === undefined || adapter.config.encryptionKey === '') {
            //let key = encryptor.getEncryptionKey();
            encryptionKey = library.getKey(20);
            adapter.getForeignObject(`system.adapter.plex.${adapter.instance}`, (err, obj) => {
                if (err || obj === undefined) {
                    return;
                }

                obj.native.encryptionKey = encryptionKey;
                adapter.setForeignObject(obj._id, obj);
            });

            adapter.log.debug('Generated new encryption key for password encryption.');
        } else {
            encryptionKey = adapter.config.encryptionKey;
        }

        // Secure connection
        library.AXIOS_OPTIONS.secureConnection = false;
        library.AXIOS_OPTIONS._protocol = 'http:';
        library.AXIOS_OPTIONS.timeout = 3000;

        if (adapter.config.secureConnection && adapter.config.certPublicVal && adapter.config.certPrivateVal) {
            adapter.log.info('Establishing secure connection to Plex Media Server...');

            try {
                library.AXIOS_OPTIONS = {
                    ...library.AXIOS_OPTIONS,
                    cert:
                        adapter.config.certPublicVal.indexOf('.') === -1
                            ? adapter.config.certPublicVal
                            : _fs.readFileSync(adapter.config.certPublicVal),
                    key:
                        adapter.config.certPrivateVal.indexOf('.') === -1
                            ? adapter.config.certPrivateVal
                            : _fs.readFileSync(adapter.config.certPrivateVal),
                    rejectUnauthorized: false,
                    secureConnection: true,
                    _protocol: 'https:',
                };

                if (adapter.config.certChainedVal) {
                    library.AXIOS_OPTIONS.ca =
                        adapter.config.certChainedVal.indexOf('.') === -1
                            ? adapter.config.certChainedVal
                            : _fs.readFileSync(adapter.config.certChainedVal);
                }

                if (library.AXIOS_OPTIONS.key.indexOf('ENCRYPTED') > -1) {
                    library.AXIOS_OPTIONS.passphrase = adapter.config.passphrase;
                }
            } catch (err) {
                adapter.log.warn(
                    'Failed loading certificates! Falling back to insecure connection to Plex Media Server...',
                );
                adapter.log.debug(err.message);

                library.AXIOS_OPTIONS.secureConnection = false;
                library.AXIOS_OPTIONS._protocol = 'http:';
            }
        } else {
            adapter.log.info('Establishing insecure connection to Plex Media Server...');
        }

        // get notifications
        if (adapter.config.notifications) {
            adapter.config.notifications.forEach(notification => {
                if (!notifications[notification.media]) {
                    notifications[notification.media] = {};
                }
                notifications[notification.media][notification.event] = {
                    message: notification.message,
                    caption: notification.caption,
                    thumb: notification.thumb,
                };
            });
        } else {
            adapter.config.notifications = ioPackage.native.notifications;
        }

        // verify Plex settings
        if (!adapter.config.plexIp || !adapter.config.plexToken) {
            return library.terminate(
                'Plex IP and Plex Token not configured! Please go to settings, fill in Plex IP and retrieve a Plex Token.',
            );
        }

        // initialize Plex API
        adapter.config.plexPort = adapter.config.plexPort || 32400;
        plex = new Plex({
            hostname: adapter.config.plexIp,
            port: adapter.config.plexPort,
            https: library.AXIOS_OPTIONS.secureConnection,
            token: adapter.config.plexToken,
            requestOptions: library.AXIOS_OPTIONS,
            options: plexOptions,
        });

        library._plex = plex;

        controller = new Controller(
            adapter,
            {
                controllerIdentifier: plexOptions.identifier,
                plexToken: plexOptions.plexToken,
                actions: _ACTIONS,
                nodes: _NODES,
                playerdetails: _PLAYERDETAILS,
            },
            library,
        );

        // retrieve all values from states to avoid message "Unsubscribe from all states, except system's, because over 3 seconds the number of events is over 200 (in last second 0)"
        adapter.getStates(`${adapter.name}.${adapter.instance}.*`, (err, states) => {
            library.set(Library.CONNECTION, true);

            // set current states from objects
            for (const state in states) {
                //Reset own states common.type and common.role
                library.extendState(state);

                if (states[state] !== null && states[state] !== undefined) {
                    library.setDeviceState(
                        state.replace(`${adapter.name}.${adapter.instance}.`, ''),
                        states[state].val,
                    );

                    // set history
                    if (state.indexOf('events.history') > -1) {
                        history = JSON.parse(states[state].val);
                    }
                }
            }

            // empty _playing on start
            if (adapter.config.resetMedia) {
                library.del('_playing', true, () => adapter.log.debug('Plex Media flushed!'));
            }

            // subscribe to remote player
            adapter.subscribeForeignStates('iot.0.services.custom_plex');
            adapter.subscribeForeignStates('cloud.0.services.custom_plex');

            // test connection
            init();
        });
        library.subscribeNode('metadata.viewoffset', (state, prefix) => {
            library.confirmNode({ node: `${prefix}_Control.seekTo` });
        });
        internalConvert(_NODES);
    });

    /*
     * STATE CHANGE
     *
     */
    adapter.on('stateChange', function (id, state) {
        if (!state || state.ack === true) {
            return;
        }

        adapter.log.debug(`State of ${id} has changed ${JSON.stringify(state)}.`);
        let action = id.slice(id.lastIndexOf('.') + 1);
        let val = state.val;

        // Cloud / iot Adapter
        if (action == 'custom_plex') {
            try {
                let playerNamespace;
                if (!state.val || typeof state.val !== 'string') {
                    return;
                }
                [playerNamespace, action, val] = state.val.split('_');
                id = `_playing.${playerNamespace}._Controls.playback.${action}`;
            } catch (err) {
                adapter.log.warn(err.message);
                return;
            }
        }

        // Refresh Library
        if (action == '_refresh') {
            const libId = id.substring(id.indexOf('libraries.') + 10, id.indexOf('-'));
            const options = {
                ...library.AXIOS_OPTIONS,
                url: `${library.AXIOS_OPTIONS._protocol}//${adapter.config.plexIp}:${adapter.config.plexPort}/library/sections/${libId}/refresh?force=1`,
                method: 'POST',
                headers: {
                    'X-Plex-Token': adapter.config.plexToken,
                },
            };

            _axios(options)
                .then(res => {
                    adapter.log.info(`Successfully triggered refresh on library with ID ${libId}.`);
                    adapter.log.debug(JSON.stringify(res));
                })
                .catch(err => {
                    adapter.log.warn(
                        `Error triggering refresh on library with ID ${libId}! See debug log for details.`,
                    );
                    adapter.log.debug(err);
                });
            // Player Controls
        } else {
            const path = id.replace(`${adapter.name}.${adapter.instance}.`, '').split('.');
            action = path.pop() || '';
            const mode = path.pop();

            path.splice(-1);
            const p = controller.existPlayer(path.join('.'));
            if (p) {
                p.action({ mode: mode, action: action, val: val, id: `${path.join('.')}._Controls` });
            }
        }
    });

    /*
     * HANDLE MESSAGES
     *
     */
    adapter.on('message', function (msg) {
        adapter.log.debug(`Message: ${JSON.stringify(msg)}`);
        const plexPin = new PlexPinAuth(plexOptions);

        switch (msg.command) {
            // get PIN
            case 'getPin':
                plexPin
                    .getPin()
                    .then(pin => {
                        adapter.log.debug(`Successfully retrieved PIN: ${pin.code}`);
                        library.msg(msg.from, msg.command, { result: true, pin: pin }, msg.callback);
                    })
                    .catch(err => {
                        adapter.log.warn(err.message);
                        library.msg(msg.from, msg.command, { result: false, error: err.message }, msg.callback);
                    });
                break;

            // get token
            case 'getToken':
                plexPin
                    .getToken(msg.message.pinId)
                    .then(res => {
                        // success getting token
                        if (res.token === true) {
                            adapter.log.debug('Successfully retrieved token.');
                            library.msg(msg.from, msg.command, { result: true, token: res.auth_token }, msg.callback);
                        } else {
                            // failed getting token
                            library.msg(
                                msg.from,
                                msg.command,
                                { result: false, error: 'No token retrieved!' },
                                msg.callback,
                            );
                        }
                    })
                    .catch(err => {
                        adapter.log.warn(err.message);
                        library.msg(msg.from, msg.command, { result: false, error: err.message }, msg.callback);
                    });
                break;
        }
    });

    /*
     * ADAPTER UNLOAD
     *
     */
    adapter.on('unload', function (callback) {
        try {
            adapter.log.info(`Plex Adapter stopped und unloaded.`);

            unloaded = true;

            controller.delete();

            _http.close(() => adapter.log.debug('Server for listener closed.'));
            adapter.clearTimeout(retryCycle);
            adapter.clearTimeout(refreshCycle);
            adapter.clearInterval(refreshInterval);
            callback();
        } catch {
            callback();
        }
    });

    return adapter;
}

/*************  ✨ Codeium Command ⭐  *************/
/**
 * Initializes the Plex adapter and sets up connections and configurations.
 * 
 * - Queries the Plex server for session status and retrieves currently playing media.
/******  b350a5c6-373d-49d9-b629-c3b8405c4f02  ******
 * - Sets device states based on retrieved data to avoid excessive event subscriptions.
 * - Configures and creates controllable players based on available player data.
 * - Verifies and initializes Tautulli settings for additional media information.
 * - Sets up a refresh cycle to periodically retrieve data from the Plex server.
 * - Starts a listener for events from the Plex server.
 * - Retrieves and sets the server ID if available.
 * - Handles errors related to server connectivity and retries initialization if necessary.
 */

function init() {
    plex.query('/status/sessions')
        .then(res => {
            adapter.log.debug(
                `Retrieved playing now from plex server: ${(res && res.MediaContainer && JSON.stringify(res.MediaContainer)) || 'empty'}`,
            );
            library.set(Library.CONNECTION, true);
            // retrieve values from states to avoid message "Unsubscribe from all states, except system's, because over 3 seconds the number of events is over 200 (in last second 0)"
            adapter.getStates(`${adapter.name}.${adapter.instance}.*`, (err, states) => {
                if (err || !states) {
                    return;
                }

                for (const state in states) {
                    library.setDeviceState(
                        state.replace(`${adapter.name}.${adapter.instance}.`, ''),
                        states[state] && states[state].val,
                    );
                }

                playing =
                    (library.getDeviceState('_playing.players') &&
                        library.getDeviceState('_playing.players').split(',')) ||
                    [];
                streams = library.getDeviceState('_playing.streams') || 0;

                //create all controllable players
                const playerConfig = {};
                for (const state in states) {
                    for (const end of [
                        { text: '.Player.localAddress', key: 'address' },
                        { text: '.Player.port', key: 'port' },
                        { text: '.Player.protocolCapabilities', key: 'protocolCapabilities' },
                        { text: '.Player.uuid', key: 'uuid' },
                        { text: '.Player.title', key: 'title' },
                    ]) {
                        if (state.endsWith(end.text) && state.indexOf(`Metadata${end.text}`) == -1) {
                            const prefix = state
                                .replace(`${adapter.name}.${adapter.instance}.`, '')
                                .replace(end.text, '');
                            playerConfig[prefix] = playerConfig[prefix] || {};
                            playerConfig[prefix][end.key] = (states[state] && states[state].val) || '';
                        }
                    }
                }
                for (const prefix in playerConfig) {
                    const c = playerConfig[prefix];
                    if (
                        c !== undefined &&
                        c.protocolCapabilities !== undefined &&
                        c.protocolCapabilities.split(',').indexOf('timeline') &&
                        c.port !== undefined &&
                        c.address !== undefined &&
                        c.uuid !== undefined &&
                        c.title !== undefined
                    ) {
                        if (`_playing.${library.clean(c.title, true)}-${c.uuid}` !== prefix) {
                            continue;
                        }
                        controller.createPlayerIfNotExist({
                            address: c.address,
                            port: c.port,
                            config: {
                                title: c.title,
                                uuid: c.uuid,
                            },
                        });
                    }
                }
            });

            // verify Tautulli settings
            if (!adapter.config.tautulliIp || !adapter.config.tautulliToken) {
                adapter.log.info(
                    `Tautulli ${!adapter.config.tautulliIp ? ' IP/ ' : ''}${!adapter.config.tautulliToken ? 'API token ' : ''}missing!`,
                );
                tautulli = { get: () => Promise.reject('Not connected!') };
            } else {
                // initialize Tautulli API
                try {
                    tautulli = new Tautulli(
                        adapter.config.tautulliIp,
                        adapter.config.tautulliPort || 8181,
                        library.decode(encryptionKey, adapter.config.tautulliToken),
                    );
                } catch {
                    adapter.log.error(
                        `Tautulli configuration is incorrect. IP:${adapter.config.tautulliIp} Port:${adapter.config.tautulliPort} Api-Key:${library.decode(encryptionKey, adapter.config.tautulliToken)}`,
                    );
                }
            }

            // retrieve data
            if (!adapter.config.refresh) {
                adapter.config.refresh = 0;
            } else if (adapter.config.refresh > 0 && adapter.config.refresh < 10) {
                adapter.log.warn(
                    'Due to performance reasons, the refresh rate can not be set to less than 10 seconds. Using 10 seconds now.',
                );
                adapter.config.refresh = 10;
            }

            refreshCycle = adapter.setTimeout(function updater() {
                retrieveData();
                if (adapter.config.refresh > 0 && !unloaded) {
                    refreshCycle = adapter.setTimeout(updater, Math.floor(parseInt(adapter.config.refresh) * 1000));
                }
            }, 1000);

            // listen to events from Plex
            startListener();
            // connection is ok get server id
            plex.query('/')
                .then(res => {
                    if (res && res.MediaContainer && res.MediaContainer.machineIdentifier) {
                        controller.setServerId(res.MediaContainer.machineIdentifier);
                    }
                })
                .catch(err => {
                    adapter.log.debug(err);
                });
        })
        .catch(err => {
            adapter.log.debug(`Configuration: ${JSON.stringify(adapter.config)}`);
            adapter.log.debug(`Request-Options: ${JSON.stringify(library.AXIOS_OPTIONS)}`);
            adapter.log.debug(`Stack-Trace: ${JSON.stringify(err.stack)}`);

            if (err.message.indexOf('EHOSTUNREACH') > -1) {
                adapter.config.retry = 60;
                adapter.log.info(
                    `Plex Media Server(${adapter.config.plexIp}:${adapter.config.plexPort}) not reachable! Will try again in ${adapter.config.retry} minutes...`,
                );

                library.set(Library.CONNECTION, false);
                retryCycle = adapter.setTimeout(init, adapter.config.retry * 60 * 1000);
            } else {
                library.terminate(err.message);
            }
        });
}

/**
 * Receive event from webhook
 *
 * @param data - The event data received from the webhook
 * @param source - The source of the event
 * @param prefix - The prefix of the event
 */
function setEvent(data, source, prefix) {
    adapter.log.debug(
        `Received ${prefix} playload - ${data['event'] || 'unknown'} - from ${source}: ${JSON.stringify(data)}`,
    );

    // empty payload
    if (Object.keys(data).length === 0 || !data['event']) {
        adapter.log.warn(`Empty payload received from ${source}! Please go to ${source} and configure payload!`);
        return false;
    }

    // add meta data
    data.media = data.Metadata && data.Metadata.type;
    data.player = data.Player && data.Player.title;
    data.account = data.Account && data.Account.title;
    data.source = source;
    data.timestamp = Math.floor(Date.now() / 1000);
    data.datetime = library.getDateTime(Date.now());
    data.playing = data.event.indexOf('play') > -1 || data.event.indexOf('resume') > -1;
    if (!adapter.config.getMetadataTrees && data.Metadata) {
        delete data.Metadata.Media;
    }
    // PLAYING
    if (prefix == '_playing') {
        // update latest player
        if (data.Player && data.Player.title != '_recent') {
            setEvent({ ...data, Player: { title: '_recent', uuid: 'player' } }, source, prefix);
        }

        // group by player
        data.Player = data.Player !== undefined ? data.Player : {};
        const groupBy =
            data.Player.title && data.Player.uuid !== undefined
                ? `${library.clean(data.Player.title, true)}-${data.Player.uuid}`
                : 'unknown';

        // channel by player
        library.set({
            node: prefix,
            role: library.getNode('plexplayers', true).role,
            description: library.getNode('plexplayers', true).description,
        });
        library.set({
            node: `${prefix}.${groupBy}`,
            role: 'channel',
            description: library.appendToDescription(
                library.getNode('plex.player', true).description,
                ` ${data.Player.title || library.getNode('plex.player.unknown', true).description}`,
            ),
        });

        // adapt prefix
        prefix = `${prefix}.${groupBy}`;
        let playerTemp;
        // index current playing players
        if (data.event && data.Player && data.Player.title != '_recent') {
            const playerIp = library.getDeviceState(`${prefix}.Player.localAddress`);
            const playerPort = library.getDeviceState(`${prefix}.Player.port`);
            playerTemp = controller.createPlayerIfNotExist({
                address: playerIp,
                port: playerPort,
                config: {
                    title: data.Player.title,
                    uuid: data.Player.uuid,
                },
            });

            if (['media.play', 'media.resume'].indexOf(data.event) > -1) {
                if (playing.indexOf(data.Player.title) == -1) {
                    playing.push(data.Player.title);
                }
                if (playingDevice.findIndex(player => player.prefix == prefix) == -1) {
                    playingDevice.push({
                        prefix: prefix,
                        title: data.Player.title,
                        local: data.Player.local,
                        playerIp: playerIp,
                        playerPort: playerPort,
                        playerIdentifier: data.Player.uuid,
                    });
                }
                streams++;
            } else if (['media.stop', 'media.pause'].indexOf(data.event) > -1) {
                playing = playing.filter(player => player !== data.Player.title);
                playingDevice = playingDevice.filter(player => player.prefix !== prefix);
                streams > 0 && streams--;
            }

            library.set(
                {
                    node: '_playing.players',
                    role: library.getNode('playing.players', true).role,
                    type: library.getNode('playing.players', true).type,
                    description: library.getNode('playing.players', true).description,
                },
                playing.join(','),
            );
            library.set(
                {
                    node: '_playing.streams',
                    role: library.getNode('playing.streams', true).role,
                    type: library.getNode('playing.streams', true).type,
                    description: library.getNode('plex.player', true).description,
                },
                streams,
            );
        }

        // add player controls
        if (
            data.Player &&
            data.Player.uuid &&
            players.indexOf(data.Player.uuid) == -1 &&
            data.Player.title != '_recent'
        ) {
            getPlayers();
            // update play_switch control
        } else if (
            data.Player &&
            data.Player.title != '_recent' &&
            ['media.play', 'media.resume', 'media.stop', 'media.pause'].indexOf(data.event) > -1
        ) {
            library.confirmNode(
                { node: `${prefix}._Controls.playback.play_switch` },
                ['media.play', 'media.resume'].indexOf(data.event) > -1,
            );
        }
        // get library details plex.0._playing.ipad-10A88133-3762-4948-AF10-9503A37517AC.Metadata.key
        //if (adapter.config.getAllItem && data.Player.title != '_recent') getItemDetails(data.Metadata && data.Metadata.key, prefix)
        if (data.event && data.Player && data.Player.title != '_recent' && playerTemp) {
            playerTemp.setNotificationData(JSON.parse(JSON.stringify(data))), 100;
            data = {};
        }
    } else if (prefix == 'events') {
        // EVENTS
        // channel
        library.set(
            {
                node: prefix,
                role: library.getNode('plex.events', true).role,
                description: library.getNode('plex.events', true).description,
            },
            undefined,
        );

        // replace placeholders in notification message
        const event = data.event && data.event.replace('media.', '');

        const message = (notifications[data.media] && notifications[data.media][event]) ||
            (notifications['any'] && notifications['any'][event]) ||
            (notifications[data.media] && notifications[data.media]['any']) ||
            (notifications['any'] && notifications['any']['any']) || {
                message: '',
                caption: '',
                thumb: '',
                notExist: true,
            };

        if (!message.notExist) {
            // structure event
            const eventData = JSON.parse(JSON.stringify(data));
            const notification = {
                id: _uuid(),
                timestamp: data.timestamp,
                datetime: data.datetime,
                account: data.account,
                player: data.player,
                media: data.media,
                event: event,
                thumb: message.thumb
                    ? `${library.AXIOS_OPTIONS._protocol}//${adapter.config.plexIp}:${adapter.config.plexPort}${replacePlaceholders(message.thumb, eventData)}?X-Plex-Token=${adapter.config.plexToken}`
                    : '',
                message: replacePlaceholders(message.message, eventData),
                caption: replacePlaceholders(message.caption, eventData),
                source: data.source,
            };
            // dont add events with same media, account, and event (within 1 sec)
            let addNotification = true;
            for (let i = history.length - 1; i >= 0; i--) {
                const lastItem = history[i];
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
                // add event to history
                history.push(notification);

                data = Object.assign({}, notification); // copy object
                data.history = JSON.stringify(history.slice(-1000));
            }
        } else {
            adapter.log.debug(`No message defined for ${data.media} ${event}`);
        }
    }

    // write states
    for (const key in data) {
        library.readData(`${prefix}.${key}`, data[key], prefix);
    }

    // cleanup old states when playing something new
    if (prefix.indexOf('_playing') > -1 && data.event == 'media.play') {
        library.runGarbageCollector(prefix, false, 30000, [...Controller.garbageExcluded, '_Controls']);
    }
}

/**
 * Ersetzt Platzhalter im übergebenen Nachrichtentext durch die entsprechenden Werte aus den Daten.
 *
 * @param message - Die Nachricht mit Platzhaltern.
 * @param data - Die Daten, die zum Ersetzen der Platzhalter verwendet werden.
 * @returns - Die Nachricht mit ersetzten Platzhaltern.
 */
function replacePlaceholders(message, data) {
    let pos, variable, tmp, path, index;
    while (message.indexOf('%') > -1) {
        pos = message.indexOf('%');
        variable = message.substring(pos, message.indexOf('%', pos + 1) + 1).replace(/%/g, '');

        // get value for placeholders
        tmp = JSON.parse(JSON.stringify(data));
        path = variable;

        while (path.indexOf('.') > -1) {
            try {
                index = path.slice(0, path.indexOf('.'));
                path = path.slice(path.indexOf('.') + 1);
                tmp = tmp[index];
            } catch (err) {
                adapter.log.debug(`catch: 30 ${err.message}`);
            }
        }

        // check value
        if (tmp === undefined || tmp[path] === undefined || tmp === null || tmp[path] === null) {
            message = message.replace(RegExp(`%${variable}%`, 'gi'), `(${variable} not found!)`);
        } else {
            message = message.replace(RegExp(`%${variable}%`, 'gi'), tmp[path]);
        }
    }

    return message; // .replace(/ /g, '');
}

/**
 * Checks if the API response is valid.
 *
 * @param res - The API response to be checked.
 * @returns - Returns true if the response is valid, otherwise false.
 */
function is(res) {
    if (
        res === undefined ||
        res.response === undefined ||
        res.response.result === undefined ||
        res.response.result !== 'success'
    ) {
        adapter.log.warn('API response invalid!');
        adapter.log.debug(`debug 23 ${JSON.stringify(res)}`);
        return false;
    } else if (res.response.message === 'Invalid apikey') {
        adapter.log.warn('Invalid API key. No results retrieved!');
        return false;
    }

    return true;
}

/**
 * Retrieves items from the specified path and updates the library with the item count.
 *
 * @param path - The path to query items from.
 * @param key - The key used to identify the items.
 * @param node - The node to update with the item count.
 */
function getItems(path, key, node) {
    if (!adapter.config.getAllItems) {
        return;
    }

    plex.query(path)
        .then(res => {
            //library.set({node: node + '.items', type: library.getNode(key.toLowerCase() + '.items').type, role: library.getNode(key.toLowerCase() + '.items').role, description: library.getNode(key.toLowerCase() + '.items').description}, JSON.stringify(res.MediaContainer.Metadata));
            library.set(
                {
                    node: `${node}.itemsCount`,
                    type: library.getNode(`${key.toLowerCase()}.itemscount`).type,
                    role: library.getNode(`${key.toLowerCase()}.itemscount`).role,
                    description: library.getNode(`${key.toLowerCase()}.itemscount`).description,
                },
                res.MediaContainer.size,
            );
        })
        .catch(err => {
            adapter.log.debug(`Could not retrieve items for ${key} from Plex!`);
            adapter.log.debug(err);
        });
}

/**
 * Retrieve data from Plex
 *
 */
function retrieveData() {
    // GET SERVERS
    if (adapter.config.getServers) {
        getServers();
    }

    // GET LIBRARIES
    if (adapter.config.getLibraries) {
        getLibraries();
    }

    // GET USERS (https://github.com/Tautulli/Tautulli/blob/master/API.md#get_users)
    if (adapter.config.getUsers) {
        getUsers();
    }

    // GET SETTINGS
    if (adapter.config.getSettings) {
        getSettings();
    }

    // GET PLAYLISTS
    if (adapter.config.getPlaylists) {
        getPlaylists();
    }

    // GET CLIENTS / PLAYERS
    getPlayers();
}

/**
 * Retrieve Server from Plex
 *
 */
function getServers() {
    plex.query('/servers')
        .then(res => {
            adapter.log.debug('Retrieved Servers from Plex.');

            library.set(
                {
                    node: 'servers',
                    role: library.getNode('servers').role,
                    description: library.getNode('servers').description,
                },
                undefined,
            );

            const data = res.MediaContainer.Server || [];
            data.forEach(entry => {
                const serverId = entry['name'].toLowerCase();
                library.set(
                    {
                        node: `servers.${serverId}`,
                        role: library.getNode('server').role,
                        description: library.replaceDescription(
                            library.getNode('server').description,
                            '%server%',
                            entry['name'],
                        ),
                    },
                    undefined,
                );
                // index all keys as states
                for (const key in entry) {
                    library.set(
                        {
                            node: `servers.${serverId}.${key}`,
                            role: library.getNode(`servers.${key.toLowerCase()}`).role,
                            type: library.getNode(`servers.${key.toLowerCase()}`).type,
                            description: library.getNode(`servers.${key.toLowerCase()}`).description,
                        },
                        entry[key],
                    );
                }
            });
        })
        .catch(err => {
            adapter.log.debug('Could not retrieve Servers from Plex!');
            adapter.log.debug(err);
        });
}

/**
 * Retrieve Libraries from Plex
 *
 */
function getLibraries() {
    plex.query('/library/sections')
        .then(res => {
            adapter.log.debug('Retrieved Libraries from Plex.');
            library.set({
                node: 'libraries',
                role: library.getNode('libraries').role,
                description: library.getNode('libraries').description,
            });

            let data = res.MediaContainer.Directory || [];
            data.forEach(entry => {
                const libId = `${entry['key']}-${entry['title'].toLowerCase()}`;
                library.set(
                    {
                        node: `libraries.${libId}`,
                        role: library.getNode('library').role,
                        description: library.replaceDescription(
                            library.getNode('library').description,
                            '%library%',
                            entry['title'],
                        ),
                    },
                    undefined,
                );

                // refresh button
                library.set(
                    {
                        node: `libraries.${libId}._refresh`,
                        type: library.getNode('plex.events', true).type,
                        role: library.getNode('plex.events', true).role,
                        description: library.getNode('plex.events', true).description,
                    },
                    false,
                );
                adapter.subscribeStates(`libraries.${libId}._refresh`);

                // index all keys as states
                for (const key in entry) {
                    library.set(
                        {
                            node: `libraries.${libId}.${key.toLowerCase()}`,
                            type: library.getNode(`libraries.${key.toLowerCase()}`).type,
                            role: library.getNode(`libraries.${key.toLowerCase()}`).role,
                            description: library.getNode(`libraries.${key.toLowerCase()}`).description,
                        },
                        typeof entry[key] == 'object' ? JSON.stringify(entry[key]) : entry[key],
                    );
                }

                // get library content
                getItems(`/library/sections/${entry['key']}/all`, 'libraries', `libraries.${libId}`);

                // get statistics / watch time
                // https://github.com/Tautulli/Tautulli/blob/master/API.md#get_library_watch_time_stats
                if (adapter.config.getStatistics) {
                    tautulli
                        .get('get_library_watch_time_stats', { section_id: entry['key'] })
                        .then(res => {
                            if (!is(res)) {
                                return;
                            }
                            data = res.response.data || [];
                            adapter.log.debug(
                                `Retrieved Watch Statistics for Library ${entry['title']} from Tautulli.`,
                            );

                            library.set({
                                node: 'statistics',
                                role: library.getNode('statistics').role,
                                description: library.getNode('statistics').description,
                            });
                            library.set({
                                node: 'statistics.libraries',
                                role: library.getNode('statistics.libraries').role,
                                description: library.replaceDescription(
                                    library.getNode('statistics.libraries').description,
                                    '%library%',
                                    '',
                                ),
                            });
                            library.set({
                                node: `statistics.libraries.${libId}`,
                                role: library.getNode('statistics.libraries').role,
                                description: library.replaceDescription(
                                    library.getNode('statistics.libraries').description,
                                    '%library%',
                                    entry['title'],
                                ),
                            });

                            data.forEach((entry, i) => {
                                const id = watched[i];
                                library.set({
                                    node: `statistics.libraries.${libId}.${id}`,
                                    type: library.getNode(`statistics.${id}`).type,
                                    role: library.getNode(`statistics.${id}`).role,
                                    description: library.getNode(`statistics.${id}`).description,
                                });

                                for (const key in entry) {
                                    library.set(
                                        {
                                            node: `statistics.libraries.${libId}.${id}.${key}`,
                                            type: library.getNode(`statistics.${key}`).type,
                                            role: library.getNode(`statistics.${key}`).role,
                                            description: library.getNode(`statistics.${key}`).description,
                                        },
                                        entry[key],
                                    );
                                }
                            });
                        })
                        .catch(err => {
                            adapter.log.error(
                                `Tautulli configuration is incorrect. IP: ${adapter.config.tautulliIp} Port: ${adapter.config.tautulliPort} Api-Key: ${library.decode(encryptionKey, adapter.config.tautulliToken)} Error: ${err}`,
                            );
                        });
                }
            });
        })
        .catch(err => {
            adapter.log.debug('Could not retrieve Libraries from Plex!');
            adapter.log.debug(err);
        });
}

/**
 * Retrieve Users from Plex
 *
 */
function getUsers() {
    tautulli
        .get('get_users')
        .then(res => {
            if (!is(res)) {
                return;
            }
            data = res.response.data || [];
            adapter.log.debug('Retrieved Users from Tautulli.');
            library.set({
                node: 'users',
                role: library.getNode('users').role,
                description: library.getNode('users').description,
            });

            data.forEach(entry => {
                const userName = entry['username'] || entry['friendly_name'] || entry['email'] || entry['user_id'];
                const userId = library.clean(userName, true).replace(/\./g, '');
                if (userId === 'local') {
                    return;
                }

                library.set({
                    node: `users.${userId}`,
                    role: library.getNode('user').role,
                    description: library.replaceDescription(library.getNode('user').description, '%user%', userName),
                });

                // index all keys as states
                for (const key in entry) {
                    if (key === 'server_token') {
                        continue;
                    }
                    library.set(
                        {
                            node: `users.${userId}.${key}`,
                            role: library.getNode(`users.${key.toLowerCase()}`).role,
                            type: library.getNode(`users.${key.toLowerCase()}`).type,
                            description: library.getNode(`users.${key.toLowerCase()}`).description,
                        },
                        entry[key],
                    );
                }

                // get statistics / watch time
                //
                // https://github.com/Tautulli/Tautulli/blob/master/API.md#get_user_watch_time_stats
                if (adapter.config.getStatistics) {
                    tautulli
                        .get('get_user_watch_time_stats', { user_id: entry['user_id'] })
                        .then(res => {
                            if (!is(res)) {
                                return;
                            }
                            data = res.response.data || [];
                            adapter.log.debug(`Retrieved Watch Statistics for User ${userName} from Tautulli.`);

                            library.set({
                                node: 'statistics.users',
                                role: library.getNode('statistics.users').role,
                                description: library.replaceDescription(
                                    library.getNode('statistics.users').description,
                                    '%user%',
                                    '',
                                ),
                            });
                            library.set({
                                node: `statistics.users.${userId}`,
                                role: library.getNode('statistics.users').role,
                                description: library.replaceDescription(
                                    library.getNode('statistics.users').description,
                                    '%user%',
                                    userName,
                                ),
                            });

                            data.forEach((entry, i) => {
                                const id = watched[i];
                                library.set({
                                    node: `statistics.users.${userId}.${id}`,
                                    type: library.getNode(`statistics.${id}`).type,
                                    role: library.getNode(`statistics.${id}`).role,
                                    description: library.getNode(`statistics.${id}`).description,
                                });

                                for (const key in entry) {
                                    library.set(
                                        {
                                            node: `statistics.users.${userId}.${id}.${key}`,
                                            type: library.getNode(`statistics.${key}`).type,
                                            role: library.getNode(`statistics.${key}`).role,
                                            description: library.getNode(`statistics.${key}`).description,
                                        },
                                        entry[key],
                                    );
                                }
                            });
                        })
                        .catch(err => {
                            adapter.log.error(
                                `Tautulli configuration is incorrect. IP:${adapter.config.tautulliIp} Port:${adapter.config.tautulliPort} Api-Key:${library.decode(encryptionKey, adapter.config.tautulliToken)} Error: ${err}`,
                            );
                        });
                }
            });
        })
        .catch(err => {
            adapter.log.debug('Could not retrieve Users from Tautulli!');
            adapter.log.debug(err);
        });
}

/**
 * Retrieve Settings from Plex
 *
 */
function getSettings() {
    plex.query('/:/prefs')
        .then(res => {
            const data = res.MediaContainer.Setting || [];
            adapter.log.debug('Retrieved Settings from Plex.');
            library.set({
                node: 'settings',
                role: library.getNode('settings').role,
                description: library.getNode('settings').description,
            });

            data.forEach(entry => {
                entry['group'] = !entry['group'] ? 'other' : entry['group'];
                library.set({
                    node: `settings.${entry['group']}`,
                    role: 'channel',
                    description: `Settings ${library.ucFirst(entry['group'])}`,
                });
                library.set(
                    {
                        node: `settings.${entry['group']}.${entry['id']}`,
                        type: entry['type'] == 'bool' ? 'boolean' : entry['type'] == 'int' ? 'number' : 'string',
                        role: entry['type'] == 'bool' ? 'indicator' : entry['type'] == 'int' ? 'value' : 'text',
                        description: entry['label'],
                    },
                    entry['value'],
                );
            });
        })
        .catch(err => {
            adapter.log.debug('Could not retrieve Settings from Plex!');
            adapter.log.debug(err);
        });
}

/**
 * Retrieve Playlists from Plex
 *
 */
function getPlaylists() {
    plex.query('/playlists')
        .then(res => {
            const data = res.MediaContainer.Metadata || [];
            adapter.log.debug('Retrieved Playlists from Plex.');
            library.set({
                node: 'playlists',
                role: library.getNode('playlists').role,
                description: library.getNode('playlists').description,
            });

            data.forEach(entry => {
                const playlistId = library.clean(entry['title'], true);
                library.set({
                    node: `playlists.${playlistId}`,
                    role: 'channel',
                    description: `Playlist ${entry['title']}`,
                });
                //if (adapter.config.getPlaylistsDetails) getPlaylistsDetails(entry.key, 'playlists.' + playlistId)
                // index all keys as states
                for (const key in entry) {
                    const node = library.getNode(`playlists.${key.toLowerCase()}`);
                    node.key = `playlists.${playlistId}.${key}`;
                    entry[key] = library.convertNode(node, entry[key]);

                    library.set(
                        {
                            node: `playlists.${playlistId}.${key}`,
                            type: node.type,
                            role: node.role,
                            description: node.description,
                        },
                        entry[key],
                    );
                }

                // get playlist content
                getItems(entry['key'], 'playlists', `playlists.${playlistId}`);
            });
        })
        .catch(err => {
            adapter.log.debug('Could not retrieve Playlists from Plex!');
            adapter.log.debug(err);
        });
}
/*
function getPlaylistsDetails(key, prefix) {
	plex.query('/playlists').then(res =>
		{
			if (!res || !res.MediaContainer || !res.MediaContainer.Metadata) return;
			let data = res.MediaContainer.Metadata || [];
			prefix += '.Items'
			adapter.log.debug('Retrieved Playlists Details from Plex.');
			library.set({node: prefix, role: library.getNode('playlists.items').role , description: library.getNode('playlists.items').description});
			data.forEach(entry =>
			{
				let itemsId = library.clean(entry['title'], true);
				library.set({node: prefix + itemsId, role: 'channel', description: 'Item ' + entry['title']});
				let result = {}
				if ()
				// index all keys as states
				for (let key in entry)
				{
					let node = library.getNode('playlists.' + key.toLowerCase());
					node.key = 'playlists.' + playlistId + '.' + key;
					entry[key] = library.convertNode(node, entry[key]);

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
}*/

/**
 * Retrieve Players from Plex
 *
 */
function getPlayers() {
    plex.query('/clients')
        .then(res => {
            const data = res.MediaContainer.Server || [];
            adapter.log.debug(`Retrieved Players from Plex. JSON: ${JSON.stringify(res)}`);
            data.forEach(player => {
                // group by player
                players.push(player.machineIdentifier);
                //let groupBy = library.clean(player.name, true) + '-' + player.machineIdentifier;

                // create player
                const playerTemp = controller.createPlayerIfNotExist({
                    config: {
                        title: player.name,
                        uuid: player.machineIdentifier,
                    },
                });

                playerTemp.setClientData(player);
            });
        })
        .catch(err => {
            adapter.log.debug('Could not retrieve Players from Plex!');
            adapter.log.debug(err);
        });
}

/**
 * Start Listener for Events
 *
 */
function startListener() {
    _http.use(_parser.json());
    _http.use(_parser.urlencoded({ extended: false }));

    _http.post('/plex', upload.single('thumb'), (req, res) => {
        let payload;
        try {
            adapter.log.debug(`Incoming data from plex with ip: ${req.ip.replace('::ffff:', '')}`);
            payload = JSON.parse(req.body.payload);
            res.sendStatus(200);
            res.end();

            // write payload to states

            if (
                ['media.play', 'media.pause', 'media.stop', 'media.resume', 'media.rate', 'media.scrobble'].indexOf(
                    payload.event,
                ) > -1
            ) {
                setEvent(payload, 'plex', '_playing');
            }

            setEvent(payload, 'plex', 'events');
        } catch (e) {
            adapter.log.warn(`startListener: ${e.message}`);
            //res.sendStatus(500);
        }
    });

    // listen to events from Tautulli
    _http.post('/tautulli', (req, res) => {
        let payload;
        try {
            adapter.log.debug(`Incoming data from tautulli with ip: ${req.ip.replace('::ffff:', '')}`);
            payload = req.body;
            res.sendStatus(200);
            res.end();

            // write payload to states
            if (
                ['media.play', 'media.pause', 'media.stop', 'media.resume', 'media.rate', 'media.scrobble'].indexOf(
                    payload.event,
                ) > -1
            ) {
                setEvent(payload, 'tautulli', '_playing');
            }

            setEvent(payload, 'tautulli', 'events');
        } catch (e) {
            adapter.log.warn(
                `Tautulli notification ${e.message} - check the webhook data configuration page in Tautulli. https://forum.iobroker.net/post/1029571`,
            );
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
        if (detailsCounter++ > 15) {
            detailsCounter = 0;
        }
        playingDevice.forEach(player => {
            let state = `${player.prefix}.Metadata.viewOffset`;
            const value = library.getDeviceState(state) + 1000;
            state += 'Seconds';
            //adapter.log.debug(Math.floor((Date.now() - player.start)/1000))
            library.set(
                {
                    node: state,
                    type: 'number',
                    role: 'media.elapsed',
                    description: 'Last viewing position in seconds(refresh)',
                },
                value / 1000,
            );
        });
    }
}

// npm run translate -- -a ./.dataTest/Nodes/admin
// eslint-disable-next-line
function internalConvert(json) {
    if (_fs.existsSync('./.dataTest')) {
        //writeNodes('Nodes', json);
        //covertI18n('Nodes', json);
    }
    return;
}
/*
 * COMPACT MODE
 * If started as allInOne/compact mode => return function to create instance
 *
 */
if (module.parent) {
    // Export startAdapter in compact mode
    module.exports = startAdapter;
} else {
    // otherwise start the instance directly
    startAdapter();
}
