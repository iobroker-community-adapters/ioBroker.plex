import WebSocket from 'ws';

const WS_PATH = '/:/websockets/notifications';
const RECONNECT_DELAYS_MS = [1000, 2000, 5000, 15_000, 30_000] as const;
/**
 * If no frame arrives for this long, the connection is presumed dead and we force
 * a reconnect. PMS sends frames only during active playback; at idle it can be silent
 * for extended periods. 30 min is conservative enough to catch a truly dead socket
 * without causing spurious reconnects during idle phases.
 * Application-level idle check instead of `ws.ping()`: PMS does not reliably respond
 * to WebSocket protocol pings.
 */
const IDLE_TIMEOUT_MS = 30 * 60_000;

export interface PlexNotificationsOptions {
    hostname: string;
    port: number;
    https: boolean;
    token: string;
    log: {
        debug: (msg: string) => void;
        info: (msg: string) => void;
        warn: (msg: string) => void;
        error: (msg: string) => void;
    };
    rejectUnauthorized?: boolean;
    /** Extra headers for the upgrade request — typically the same X-Plex-* identity headers we send on REST calls. */
    headers?: Record<string, string>;
}

/**
 * One notification frame as delivered by PMS over `/:/websockets/notifications`.
 * Plex always wraps the payload in `NotificationContainer.type` plus a type-specific
 * sub-array. Only the types we actually handle are typed below.
 */
export interface PlayingNotification {
    sessionKey: string;
    guid?: string;
    ratingKey?: string;
    url?: string;
    key?: string;
    viewOffset?: number;
    playQueueItemID?: number;
    state?: 'buffering' | 'playing' | 'paused' | 'stopped';
    transcodeSession?: string;
    clientIdentifier?: string;
}

export type NotificationHandler = (event: { type: string; payload: any }) => void;

/**
 * Long-lived client for the Plex Media Server WebSocket notification stream.
 *
 * `/status/sessions` polling is the legacy way to learn about player state changes;
 * the WebSocket pushes the same information event-driven. Used by python-plexapi's
 * `PlexServer.startAlertListener()` and Home Assistant's Plex integration.
 *
 * Lifecycle:
 *   - `start()` opens the connection and re-opens it with a backoff on disconnect.
 *   - `stop()` closes deliberately and cancels reconnect.
 *   - The `onEvent` callback receives a normalized `{ type, payload }` shape per frame.
 *     `type` is the value of `NotificationContainer.type` (e.g. `playing`, `activity`,
 *     `progress`, `transcodeSession.start`, `transcodeSession.update`, `library.update`);
 *     `payload` is the type-specific sub-array, unwrapped (so `payload` for `playing`
 *     is the `PlaySessionStateNotification` array).
 */
export class PlexNotifications {
    private readonly opts: PlexNotificationsOptions;
    private ws?: WebSocket;
    private reconnectAttempt = 0;
    private reconnectTimer?: NodeJS.Timeout;
    private idleTimer?: NodeJS.Timeout;
    private framesSeen = 0;
    private stopped = false;
    private onEvent: NotificationHandler = () => {};

    constructor(opts: PlexNotificationsOptions) {
        this.opts = opts;
    }

    setHandler(handler: NotificationHandler): void {
        this.onEvent = handler;
    }

    start(): void {
        this.stopped = false;
        this.connect();
    }

    stop(): void {
        this.stopped = true;
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = undefined;
        }
        this.clearIdleTimer();
        if (this.ws) {
            try {
                this.ws.removeAllListeners();
                this.ws.close();
            } catch {
                /* ignore */
            }
            this.ws = undefined;
        }
    }

    private buildUrl(): string {
        const proto = this.opts.https ? 'wss' : 'ws';
        return `${proto}://${this.opts.hostname}:${this.opts.port}${WS_PATH}?X-Plex-Token=${encodeURIComponent(this.opts.token)}`;
    }

    private connect(): void {
        if (this.stopped) {
            return;
        }
        const url = this.buildUrl();
        this.opts.log.debug(`PlexNotifications: connecting to ${url.replace(this.opts.token, '***')}`);
        try {
            this.ws = new WebSocket(url, {
                rejectUnauthorized: this.opts.rejectUnauthorized === true,
                handshakeTimeout: 10_000,
                headers: {
                    'X-Plex-Token': this.opts.token,
                    ...(this.opts.headers || {}),
                },
            });
        } catch (err) {
            this.opts.log.warn(
                `PlexNotifications: connect threw — ${err instanceof Error ? err.message : String(err)}`,
            );
            this.scheduleReconnect();
            return;
        }

        this.ws.on('open', () => {
            this.reconnectAttempt = 0;
            this.framesSeen = 0;
            this.opts.log.debug('PlexNotifications: WebSocket connection established.');
            this.armIdleTimer();
        });

        this.ws.on('message', (raw: WebSocket.RawData) => this.handleMessage(raw));

        this.ws.on('error', (err: Error) => {
            this.opts.log.debug(`PlexNotifications: WebSocket error — ${err.message}`);
        });

        this.ws.on('close', (code: number, reason: Buffer) => {
            this.clearIdleTimer();
            const reasonStr = reason && reason.length ? reason.toString() : '';
            this.opts.log.debug(
                `PlexNotifications: WebSocket closed (code=${code}, reason="${reasonStr}", framesSeen=${this.framesSeen})`,
            );
            this.ws = undefined;
            this.scheduleReconnect();
        });
    }

    private handleMessage(raw: WebSocket.RawData): void {
        let text: string;
        if (typeof raw === 'string') {
            text = raw;
        } else if (Buffer.isBuffer(raw)) {
            text = raw.toString('utf8');
        } else if (Array.isArray(raw)) {
            text = Buffer.concat(raw).toString('utf8');
        } else {
            text = Buffer.from(raw).toString('utf8');
        }
        if (!text) {
            return;
        }
        // Any frame counts as liveness, including non-JSON or unrecognized shapes.
        this.framesSeen++;
        this.armIdleTimer();
        let parsed: any;
        try {
            parsed = JSON.parse(text);
        } catch {
            this.opts.log.debug(`PlexNotifications: non-JSON frame ignored (${text.length} bytes)`);
            return;
        }
        const container = parsed && parsed.NotificationContainer;
        if (!container || typeof container.type !== 'string') {
            return;
        }
        const type = container.type;
        // Diagnostic: log the first few frames per connection, and every `playing`/`status`
        // frame at debug. Helps verify we actually receive the events we care about.
        if (this.framesSeen <= 5 || type === 'playing' || type === 'status') {
            this.opts.log.debug(`PlexNotifications: frame #${this.framesSeen} type=${type}`);
        }
        // Plex puts the actual data in a type-specific sub-key. Map to a normalized payload.
        let payload: unknown;
        switch (type) {
            case 'playing':
                payload = container.PlaySessionStateNotification;
                break;
            case 'activity':
                payload = container.ActivityNotification;
                break;
            case 'progress':
                payload = container.ProgressNotification;
                break;
            case 'transcodeSession.start':
            case 'transcodeSession.update':
            case 'transcodeSession.end':
                payload = container.TranscodeSession;
                break;
            case 'status':
                payload = container.StatusNotification;
                break;
            case 'library.update':
                payload = container.LibraryUpdateNotification;
                break;
            case 'timeline':
                payload = container.TimelineEntry;
                break;
            default:
                payload = container;
        }
        try {
            this.onEvent({ type, payload });
        } catch (err) {
            this.opts.log.warn(
                `PlexNotifications: handler threw on type=${type} — ${err instanceof Error ? err.message : String(err)}`,
            );
        }
    }

    /**
     * (Re-)arm the idle timer: if no frame arrives within `IDLE_TIMEOUT_MS`, terminate
     * the socket and let the reconnect path take over. Plex pushes status/activity
     * frames frequently enough at idle that 5min silence reliably means a dead socket.
     */
    private armIdleTimer(): void {
        this.clearIdleTimer();
        this.idleTimer = setTimeout(() => {
            this.opts.log.debug(
                `PlexNotifications: idle timeout (${IDLE_TIMEOUT_MS / 1000}s without frame), forcing reconnect`,
            );
            if (this.ws) {
                try {
                    this.ws.terminate();
                } catch {
                    /* ignore */
                }
            }
        }, IDLE_TIMEOUT_MS);
    }

    private clearIdleTimer(): void {
        if (this.idleTimer) {
            clearTimeout(this.idleTimer);
            this.idleTimer = undefined;
        }
    }

    private scheduleReconnect(): void {
        if (this.stopped) {
            return;
        }
        const delay = RECONNECT_DELAYS_MS[Math.min(this.reconnectAttempt, RECONNECT_DELAYS_MS.length - 1)];
        this.reconnectAttempt++;
        this.opts.log.debug(`PlexNotifications: reconnecting in ${delay}ms (attempt ${this.reconnectAttempt})`);
        this.reconnectTimer = setTimeout(() => {
            this.reconnectTimer = undefined;
            this.connect();
        }, delay);
    }
}
