'use strict';

const _axios = require('axios');
const _https = require('node:https');

const PLEX_DEFAULT_PORT = 32400;
const NETWORK_ERROR_CODES = ['ECONNREFUSED', 'ETIMEDOUT', 'ECONNABORTED', 'ENOTFOUND', 'EHOSTUNREACH', 'ENETUNREACH'];

/**
 * Lightweight HTTP client for the Plex Media Server JSON API.
 * API-compatible drop-in for the `query()` method previously provided by the `plex-api` package.
 */
class PlexHttp {
    /**
     * @param opts                  Connection options
     * @param opts.hostname         Plex server hostname or IP
     * @param [opts.port]           Plex server port (default 32400)
     * @param [opts.https]          Use HTTPS (default false unless port=443)
     * @param [opts.token]          X-Plex-Token used for authentication
     * @param [opts.timeout]        Per-request timeout in ms (default 10000)
     * @param [opts.requestOptions] Extra axios config (e.g. cert, key, ca, httpsAgent)
     * @param [opts.options]        Plex client metadata headers (identifier, product, version, ...)
     */
    constructor(opts) {
        opts = opts || {};
        this.hostname = opts.hostname;
        this.port = opts.port || PLEX_DEFAULT_PORT;
        this.https = opts.https === true || (opts.https === undefined && this.port === 443);
        this.token = opts.token;
        this.timeout = opts.timeout || 10000;
        this.plexHeaders = this._buildPlexHeaders(opts.options || {});

        // Strip TLS-related fields out of requestOptions; they belong on an https.Agent, not on the
        // axios config root. Plex Media Server typically ships a self-signed / plex.direct cert
        // that doesn't validate against an IP, so we default to rejectUnauthorized=false.
        const reqOpts = { ...(opts.requestOptions || {}) };
        const cert = reqOpts.cert;
        const key = reqOpts.key;
        const ca = reqOpts.ca;
        const passphrase = reqOpts.passphrase;
        const rejectUnauthorized = reqOpts.rejectUnauthorized;
        delete reqOpts.cert;
        delete reqOpts.key;
        delete reqOpts.ca;
        delete reqOpts.passphrase;
        delete reqOpts.rejectUnauthorized;
        delete reqOpts.secureConnection;
        delete reqOpts._protocol;
        if (reqOpts.timeout) {
            this.timeout = reqOpts.timeout;
            delete reqOpts.timeout;
        }
        this.requestOptions = reqOpts;

        if (this.https) {
            const agentOpts = { rejectUnauthorized: rejectUnauthorized === true };
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
            this._httpsAgent = new _https.Agent(agentOpts);
        }

        if (typeof this.hostname !== 'string' || this.hostname === '') {
            throw new TypeError('Invalid Plex Server hostname');
        }
    }

    /**
     * @param o Plex client metadata options (identifier, product, version, deviceName, platform, device)
     * @returns Header object with the X-Plex-* metadata headers populated where given
     */
    _buildPlexHeaders(o) {
        const h = {};
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
        if (o.device) {
            h['X-Plex-Device'] = o.device;
        }
        return h;
    }

    /**
     * @param path Request path relative to the Plex server root (must start with `/`)
     * @returns Absolute URL combining protocol, hostname, port and the given path
     */
    _url(path) {
        const proto = this.https ? 'https' : 'http';
        return `${proto}://${this.hostname}:${this.port}${path}`;
    }

    /**
     * @param [extra] Additional headers to merge in (override defaults)
     * @returns Merged header object including Accept, X-Plex-Token and X-Plex-* metadata
     */
    _headers(extra) {
        return {
            Accept: 'application/json',
            'X-Plex-Token': this.token,
            ...this.plexHeaders,
            ...(extra || {}),
        };
    }

    /**
     * Perform an HTTP request against the Plex server and return the parsed JSON body.
     *
     * @param path        Request path relative to the Plex server root (must start with `/`)
     * @param [opts]      Optional request overrides
     * @param [opts.method]  HTTP method (default GET)
     * @param [opts.headers] Extra request headers to merge in
     * @param [opts.data]    Request body (for POST/PUT)
     * @returns Parsed JSON response body
     */
    async query(path, opts) {
        opts = opts || {};
        const config = {
            ...this.requestOptions,
            method: opts.method || 'GET',
            url: this._url(path),
            headers: this._headers(opts.headers),
            timeout: this.timeout,
            responseType: 'json',
            validateStatus: null,
        };
        if (this._httpsAgent) {
            config.httpsAgent = this._httpsAgent;
        }
        if (opts.data !== undefined) {
            config.data = opts.data;
        }

        let response;
        try {
            response = await _axios(config);
        } catch (err) {
            throw normalizeError(err);
        }

        if (response.status < 200 || response.status > 299) {
            const err = new Error(
                `Plex Server responded with HTTP ${response.status} (${statusText(response.status)})`,
            );
            err.statusCode = response.status;
            throw err;
        }

        return response.data;
    }
}

function normalizeError(err) {
    if (!err) {
        return new Error('Unknown error');
    }
    // Native Node socket / DNS error codes – pass through with the code embedded in the message
    // so that string-based callers (err.message.indexOf('EHOSTUNREACH') etc.) still match.
    if (err.code && NETWORK_ERROR_CODES.includes(err.code)) {
        const e = new Error(`${err.code}: ${err.message || err.code}`);
        e.code = err.code;
        return e;
    }
    // Map axios-specific error codes to the closest equivalent native code
    if (err.code === 'ERR_CANCELED') {
        const e = new Error(`ETIMEDOUT: request canceled`);
        e.code = 'ETIMEDOUT';
        return e;
    }
    if (err.code === 'ERR_NETWORK') {
        const e = new Error(`ECONNREFUSED: ${err.message || 'network error'}`);
        e.code = 'ECONNREFUSED';
        return e;
    }
    return err;
}

function statusText(code) {
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

module.exports = PlexHttp;
