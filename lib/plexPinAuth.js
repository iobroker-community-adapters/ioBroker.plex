'use strict';

const _axios = require('axios');

const PLEX_TV_BASE = 'https://plex.tv/api/v2';
const TOKEN_CACHE_MAX = 50;
const HEADER_MAP = {
    'X-Plex-Client-Identifier': 'identifier',
    'X-Plex-Product': 'product',
    'X-Plex-Version': 'version',
    'X-Plex-Device': 'device',
    'X-Plex-Device-Name': 'deviceName',
    'X-Plex-Platform': 'platform',
    'X-Plex-Platform-Version': 'platformVersion',
};

/**
 * Plex authentication via the PIN flow against the modern JSON v2 API
 * (https://plex.tv/api/v2/pins). Replaces the legacy XML endpoints.
 */
class PlexPinAuth {
    /**
     * @param options Plex client metadata used to populate the X-Plex-* request headers
     *                (identifier, product, version, device, deviceName, platform, platformVersion)
     */
    constructor(options) {
        this.headers = this._buildHeaders(options || {});
        this.tokens = {};
    }

    /**
     * @param options Plex client metadata
     * @returns Header object with all required X-Plex-* metadata + Accept: application/json
     */
    _buildHeaders(options) {
        const h = {
            Accept: 'application/json',
            'X-Plex-Provides': 'controller',
        };
        for (const key of Object.keys(HEADER_MAP)) {
            const val = options[HEADER_MAP[key]];
            if (val) {
                h[key] = val;
            }
        }
        return h;
    }

    /**
     * Request a new PIN from plex.tv. The response includes the numeric `id`
     * and the user-visible 4-character `code` displayed at https://plex.tv/link.
     *
     * @returns Promise resolving to the pin object (with extra `status: 'RETRIEVED_CODE'`)
     */
    async getPin() {
        // No `strong=true`: we want the human-readable 4-character code that the user
        // enters at https://plex.tv/link (strong codes are long opaque strings for headless flows).
        const res = await _axios.post(`${PLEX_TV_BASE}/pins`, null, {
            headers: this.headers,
            timeout: 10000,
            responseType: 'json',
        });
        return {
            ...res.data,
            token: null,
            status: 'RETRIEVED_CODE',
        };
    }

    /**
     * Poll plex.tv to check whether the user has linked the PIN. Returns a
     * cached token if one was already retrieved for this PIN id.
     *
     * @param pinId The numeric id of a previously-issued PIN
     * @returns Promise resolving to an object describing the PIN status. When the user
     *          has authorized the PIN, `token === true` and `auth_token` carries the X-Plex-Token.
     */
    async getToken(pinId) {
        const cached = this.tokens[pinId];
        if (cached) {
            // Honor expiresAt on cached entries too — a token cached hours ago may already be invalid.
            const cachedExp = cached.expiresAt ? Date.parse(cached.expiresAt) : NaN;
            const cachedExpired = !isNaN(cachedExp) && Date.now() >= cachedExp;
            if (!cachedExpired) {
                return {
                    token: true,
                    status: 'RETRIEVED_TOKEN',
                    auth_token: cached.authToken,
                };
            }
            delete this.tokens[pinId];
        }

        const res = await _axios.get(`${PLEX_TV_BASE}/pins/${pinId}`, {
            headers: this.headers,
            timeout: 10000,
            responseType: 'json',
        });
        const pin = res.data || {};
        const result = {
            ...pin,
            token: null,
            status: 'RETRIEVING_TOKEN',
        };

        const exp = pin.expiresAt ? Date.parse(pin.expiresAt) : NaN;
        if (!isNaN(exp) && Date.now() >= exp) {
            result.token = false;
            result.status = 'TIMEOUT_TOKEN';
        }

        if (pin.authToken) {
            result.token = true;
            result.status = 'RETRIEVED_TOKEN';
            result.auth_token = pin.authToken;
            // Cap cache: drop oldest entry once the limit is hit.
            const keys = Object.keys(this.tokens);
            if (keys.length >= TOKEN_CACHE_MAX) {
                delete this.tokens[keys[0]];
            }
            this.tokens[pinId] = { authToken: pin.authToken, expiresAt: pin.expiresAt };
        }

        return result;
    }
}

module.exports = PlexPinAuth;
