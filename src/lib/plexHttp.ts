import axios, { type AxiosRequestConfig } from 'axios';
import * as https from 'node:https';

import type { PlexClientMetadata } from './plexPinAuth';

const PLEX_DEFAULT_PORT = 32_400;
const PLEX_TV_RESOURCES_URL = 'https://plex.tv/api/v2/resources?includeHttps=1&includeRelay=1';
const PLEX_TV_DEVICES_URL = 'https://plex.tv/devices.xml';
const NETWORK_ERROR_CODES = [
    'ECONNREFUSED',
    'ETIMEDOUT',
    'ECONNABORTED',
    'ENOTFOUND',
    'EHOSTUNREACH',
    'ENETUNREACH',
] as const;

type NetworkErrorCode = (typeof NETWORK_ERROR_CODES)[number];

export interface PlexRequestOptions {
    cert?: string | Buffer;
    key?: string | Buffer;
    ca?: string | Buffer;
    passphrase?: string;
    rejectUnauthorized?: boolean;
    secureConnection?: boolean;
    _protocol?: string;
    timeout?: number;
    [k: string]: unknown;
}

export interface PlexHttpOptions {
    hostname: string;
    port?: number;
    https?: boolean;
    token?: string;
    timeout?: number;
    requestOptions?: PlexRequestOptions;
    options?: PlexClientMetadata;
}

export interface PlexQueryOptions {
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
    headers?: Record<string, string>;
    data?: unknown;
    timeout?: number;
}

interface ErrorWithCode {
    code?: string;
    message?: string;
}

function isErrorWithCode(err: unknown): err is ErrorWithCode {
    return typeof err === 'object' && err !== null;
}

function isNetworkErrorCode(code: string | undefined): code is NetworkErrorCode {
    return code !== undefined && (NETWORK_ERROR_CODES as readonly string[]).includes(code);
}

function makeCodedError(code: string, message: string): Error & { code: string } {
    const e = new Error(message) as Error & { code: string };
    e.code = code;
    return e;
}

function makeStatusError(status: number, text: string): Error & { statusCode: number } {
    const e = new Error(`Plex Server responded with HTTP ${status} (${text})`) as Error & { statusCode: number };
    e.statusCode = status;
    return e;
}

function normalizeError(err: unknown): Error {
    if (!err) {
        return new Error('Unknown error');
    }
    if (isErrorWithCode(err)) {
        const code = err.code;
        // Native Node socket / DNS error codes – pass through with the code embedded in the message
        // so that string-based callers (err.message.indexOf('EHOSTUNREACH') etc.) still match.
        if (isNetworkErrorCode(code)) {
            return makeCodedError(code, `${code}: ${err.message || code}`);
        }
        if (code === 'ERR_CANCELED') {
            return makeCodedError('ETIMEDOUT', 'ETIMEDOUT: request canceled');
        }
        if (code === 'ERR_NETWORK') {
            return makeCodedError('ECONNREFUSED', `ECONNREFUSED: ${err.message || 'network error'}`);
        }
    }
    if (err instanceof Error) {
        return err;
    }
    if (typeof err === 'string' || typeof err === 'number' || typeof err === 'boolean') {
        return new Error(String(err));
    }
    return new Error('Unknown error');
}

function statusText(code: number): string {
    if (code === 401) {
        return 'Unauthorized';
    }
    if (code === 403) {
        return 'Forbidden';
    }
    if (code === 404) {
        return 'Not Found';
    }
    if (code === 500) {
        return 'Internal Server Error';
    }
    if (code === 502) {
        return 'Bad Gateway';
    }
    if (code === 503) {
        return 'Service Unavailable';
    }
    if (code === 504) {
        return 'Gateway Timeout';
    }
    return '';
}

/**
 * Lightweight HTTP client for the Plex Media Server JSON API.
 * API-compatible drop-in for the `query()` method previously provided by the `plex-api` package.
 */
export class PlexHttp {
    private readonly hostname: string;
    private readonly port: number;
    private readonly https: boolean;
    private readonly token?: string;
    private timeout: number;
    private readonly plexHeaders: Record<string, string>;
    private readonly requestOptions: Record<string, unknown>;
    private readonly httpsAgent?: https.Agent;

    constructor(opts: PlexHttpOptions) {
        this.hostname = opts.hostname;
        this.port = opts.port || PLEX_DEFAULT_PORT;
        this.https = opts.https === true || (opts.https === undefined && this.port === 443);
        this.token = opts.token;
        this.timeout = opts.timeout || 10_000;
        this.plexHeaders = this.buildPlexHeaders(opts.options || {});

        // Strip TLS-related fields out of requestOptions; they belong on an https.Agent, not on the
        // axios config root. Plex Media Server typically ships a self-signed / plex.direct cert
        // that doesn't validate against an IP, so we default to rejectUnauthorized=false.
        const reqOpts: Record<string, unknown> = { ...(opts.requestOptions || {}) };
        const cert = reqOpts.cert as string | Buffer | undefined;
        const key = reqOpts.key as string | Buffer | undefined;
        const ca = reqOpts.ca as string | Buffer | undefined;
        const passphrase = reqOpts.passphrase as string | undefined;
        const rejectUnauthorized = reqOpts.rejectUnauthorized as boolean | undefined;
        delete reqOpts.cert;
        delete reqOpts.key;
        delete reqOpts.ca;
        delete reqOpts.passphrase;
        delete reqOpts.rejectUnauthorized;
        delete reqOpts.secureConnection;
        delete reqOpts._protocol;
        if (typeof reqOpts.timeout === 'number') {
            this.timeout = reqOpts.timeout;
            delete reqOpts.timeout;
        }
        this.requestOptions = reqOpts;

        if (this.https) {
            const agentOpts: https.AgentOptions = { rejectUnauthorized: rejectUnauthorized === true };
            if (cert) {
                agentOpts.cert = cert;
            }
            if (key) {
                agentOpts.key = key;
            }
            if (ca) {
                agentOpts.ca = ca;
            }
            if (passphrase) {
                agentOpts.passphrase = passphrase;
            }
            this.httpsAgent = new https.Agent(agentOpts);
        }

        if (typeof this.hostname !== 'string' || this.hostname === '') {
            throw new TypeError('Invalid Plex Server hostname');
        }
    }

    private buildPlexHeaders(o: PlexClientMetadata): Record<string, string> {
        const h: Record<string, string> = {
            // python-plexapi sends X-Plex-Provides on every request; "controller" tells Plex
            // we control players but don't expose one ourselves.
            'X-Plex-Provides': 'controller',
        };
        if (o.identifier) {
            h['X-Plex-Client-Identifier'] = o.identifier;
        }
        if (o.product) {
            h['X-Plex-Product'] = o.product;
        }
        if (o.version) {
            h['X-Plex-Version'] = o.version;
        }
        if (o.deviceName) {
            h['X-Plex-Device-Name'] = o.deviceName;
        }
        if (o.platform) {
            h['X-Plex-Platform'] = o.platform;
        }
        if (o.platformVersion) {
            h['X-Plex-Platform-Version'] = o.platformVersion;
        }
        if (o.device) {
            h['X-Plex-Device'] = o.device;
        }
        if (o.language) {
            h['X-Plex-Language'] = o.language;
        }
        return h;
    }

    private buildUrl(path: string): string {
        const proto = this.https ? 'https' : 'http';
        return `${proto}://${this.hostname}:${this.port}${path}`;
    }

    private buildHeaders(extra?: Record<string, string>): Record<string, string> {
        const h: Record<string, string> = {
            Accept: 'application/json',
            ...this.plexHeaders,
            ...(extra || {}),
        };
        if (this.token) {
            h['X-Plex-Token'] = this.token;
        }
        return h;
    }

    /**
     * Perform an HTTP request against the Plex server and return the parsed JSON body.
     *
     * @param path Request path relative to the Plex server root (must start with `/`)
     * @param opts Optional request overrides (method, headers, data)
     */
    async query(path: string, opts?: PlexQueryOptions): Promise<unknown> {
        const merged = opts || {};
        const config: AxiosRequestConfig = {
            ...this.requestOptions,
            method: merged.method || 'GET',
            url: this.buildUrl(path),
            headers: this.buildHeaders(merged.headers),
            timeout: merged.timeout ?? this.timeout,
            responseType: 'json',
            validateStatus: null,
        };
        if (this.httpsAgent) {
            config.httpsAgent = this.httpsAgent;
        }
        if (merged.data !== undefined) {
            config.data = merged.data;
        }

        let response;
        try {
            response = await axios(config);
        } catch (err: unknown) {
            throw normalizeError(err);
        }

        if (response.status < 200 || response.status > 299) {
            throw makeStatusError(response.status, statusText(response.status));
        }

        return response.data;
    }

    /**
     * Fetch the user's resources (servers + clients) from plex.tv. Used for player
     * discovery — `/clients` on the local PMS is GDM-only and returns size:0 for
     * modern Plex apps (Plexamp, mobile, newer TVs), so plex.tv is the canonical source.
     *
     * On 401/403 throws a coded error `PLEX_TV_UNAUTHORIZED` so callers can fall back to
     * PMS-only discovery without crashing the adapter.
     *
     * @param token X-Plex-Token of the account whose resources to enumerate.
     */
    async fetchPlexTvResources(token: string): Promise<Plex.Tv.Resource[]> {
        if (!token) {
            throw makeCodedError('PLEX_TV_UNAUTHORIZED', 'plex.tv token is empty');
        }
        let response;
        try {
            response = await axios({
                method: 'GET',
                url: PLEX_TV_RESOURCES_URL,
                headers: {
                    Accept: 'application/json',
                    ...this.plexHeaders,
                    'X-Plex-Token': token,
                },
                timeout: this.timeout,
                responseType: 'json',
                validateStatus: null,
            });
        } catch (err: unknown) {
            throw normalizeError(err);
        }

        if (response.status === 401 || response.status === 403) {
            throw makeCodedError(
                'PLEX_TV_UNAUTHORIZED',
                `plex.tv rejected token (HTTP ${response.status}). Discovery falls back to PMS endpoints.`,
            );
        }
        if (response.status < 200 || response.status > 299) {
            throw makeStatusError(response.status, statusText(response.status));
        }
        const data: unknown = response.data;
        if (!Array.isArray(data)) {
            return [];
        }
        return data as Plex.Tv.Resource[];
    }

    /**
     * Fetch ALL account-attached devices from plex.tv — including Companion-only apps
     * (Plex iOS/Android, Plexamp, PlexHTPC) that don't appear in /api/v2/resources.
     * The legacy `/devices.xml` endpoint is what python-plexapi's `MyPlexAccount.devices()`
     * uses; it's the only Plex.tv source that lists Companion players.
     *
     * Returns minimal device descriptors normalized to a JSON shape regardless of whether
     * Plex responds with JSON or XML (defensive — Plex sometimes ignores Accept header).
     *
     * Throws `PLEX_TV_UNAUTHORIZED` on 401/403, mirroring `fetchPlexTvResources()`.
     *
     * @param token X-Plex-Token of the account whose devices to enumerate.
     */
    async fetchPlexTvDevices(token: string): Promise<Plex.Tv.Device[]> {
        if (!token) {
            throw makeCodedError('PLEX_TV_UNAUTHORIZED', 'plex.tv token is empty');
        }
        let response;
        try {
            response = await axios({
                method: 'GET',
                url: PLEX_TV_DEVICES_URL,
                headers: {
                    Accept: 'application/json',
                    ...this.plexHeaders,
                    'X-Plex-Token': token,
                },
                timeout: this.timeout,
                responseType: 'text',
                validateStatus: null,
                transformResponse: [(d: unknown) => d],
            });
        } catch (err: unknown) {
            throw normalizeError(err);
        }

        if (response.status === 401 || response.status === 403) {
            throw makeCodedError(
                'PLEX_TV_UNAUTHORIZED',
                `plex.tv rejected token (HTTP ${response.status}) at /devices.xml.`,
            );
        }
        if (response.status < 200 || response.status > 299) {
            throw makeStatusError(response.status, statusText(response.status));
        }

        const body = typeof response.data === 'string' ? response.data : '';
        const ct = String(response.headers?.['content-type'] || '').toLowerCase();
        if (ct.includes('json') && body.trim().startsWith('{')) {
            return parseDevicesJson(body);
        }
        return parseDevicesXml(body);
    }
}

/**
 * Parse plex.tv `/devices.xml` JSON response (when Plex honors Accept: application/json).
 * Shape is roughly `{ MediaContainer: { Device: [{ ...attributes, Connection: [{ uri }] }] } }`.
 */
function parseDevicesJson(body: string): Plex.Tv.Device[] {
    try {
        const parsed = JSON.parse(body);
        const mc = parsed && parsed.MediaContainer;
        const list = (mc && (mc.Device as unknown[])) || [];
        if (!Array.isArray(list)) {
            return [];
        }
        return list.map(d => normalizeDevice(d as Record<string, unknown>));
    } catch {
        return [];
    }
}

/**
 * Best-effort XML parser for the small `<Device .../>` subset we need from /devices.xml.
 * Avoids pulling in xml2js for a single endpoint with a stable, well-known shape.
 */
function parseDevicesXml(body: string): Plex.Tv.Device[] {
    const result: Plex.Tv.Device[] = [];
    // Match <Device ...>...</Device> or self-closing <Device .../>.
    const deviceRe = /<Device\b([^>]*?)(?:\/>|>([\s\S]*?)<\/Device>)/g;
    const attrRe = /(\w[\w-]*)\s*=\s*"([^"]*)"/g;
    const connRe = /<Connection\b([^>]*?)\/>/g;
    let m: RegExpExecArray | null;
    while ((m = deviceRe.exec(body)) !== null) {
        const attrs: Record<string, string> = {};
        let am: RegExpExecArray | null;
        while ((am = attrRe.exec(m[1])) !== null) {
            attrs[am[1]] = am[2];
        }
        const inner = m[2] || '';
        const connections: Array<Record<string, string>> = [];
        let cm: RegExpExecArray | null;
        while ((cm = connRe.exec(inner)) !== null) {
            const cAttrs: Record<string, string> = {};
            let cam: RegExpExecArray | null;
            while ((cam = attrRe.exec(cm[1])) !== null) {
                cAttrs[cam[1]] = cam[2];
            }
            connections.push(cAttrs);
        }
        result.push(normalizeDevice({ ...attrs, Connection: connections }));
    }
    return result;
}

function normalizeDevice(d: Record<string, unknown>): Plex.Tv.Device {
    const conns = Array.isArray(d.Connection) ? (d.Connection as Array<Record<string, unknown>>) : [];
    return {
        clientIdentifier: String(d.clientIdentifier || ''),
        name: typeof d.name === 'string' ? d.name : undefined,
        product: typeof d.product === 'string' ? d.product : undefined,
        productVersion: typeof d.productVersion === 'string' ? d.productVersion : undefined,
        platform: typeof d.platform === 'string' ? d.platform : undefined,
        platformVersion: typeof d.platformVersion === 'string' ? d.platformVersion : undefined,
        device: typeof d.device === 'string' ? d.device : undefined,
        model: typeof d.model === 'string' ? d.model : undefined,
        vendor: typeof d.vendor === 'string' ? d.vendor : undefined,
        provides: typeof d.provides === 'string' ? d.provides : '',
        publicAddress: typeof d.publicAddress === 'string' ? d.publicAddress : undefined,
        lastSeenAt: typeof d.lastSeenAt === 'string' ? d.lastSeenAt : undefined,
        connections: conns.map(c => ({
            uri: String(c.uri || ''),
            address: typeof c.address === 'string' ? c.address : undefined,
            port: c.port !== undefined ? Number(c.port) : undefined,
            protocol: typeof c.protocol === 'string' ? c.protocol : undefined,
            local: c.local === '1' || c.local === 1 || c.local === true,
        })),
    };
}
