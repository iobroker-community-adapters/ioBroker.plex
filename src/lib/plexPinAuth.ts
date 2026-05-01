import axios from 'axios';

const PLEX_TV_BASE = 'https://plex.tv/api/v2';
const TOKEN_CACHE_MAX = 50;

const HEADER_MAP: Record<string, keyof PlexClientMetadata> = {
    'X-Plex-Client-Identifier': 'identifier',
    'X-Plex-Product': 'product',
    'X-Plex-Version': 'version',
    'X-Plex-Device': 'device',
    'X-Plex-Device-Name': 'deviceName',
    'X-Plex-Platform': 'platform',
    'X-Plex-Platform-Version': 'platformVersion',
    'X-Plex-Language': 'language',
};

export interface PlexClientMetadata {
    identifier?: string;
    product?: string;
    version?: string;
    device?: string;
    deviceName?: string;
    platform?: string;
    platformVersion?: string;
    language?: string;
}

interface PinResponseData {
    id: number;
    code: string;
    expiresAt?: string;
    authToken?: string | null;
    [k: string]: unknown;
}

export interface GetPinResult extends PinResponseData {
    token: null;
    status: 'RETRIEVED_CODE';
}

export interface GetTokenResult {
    id?: number;
    code?: string;
    expiresAt?: string;
    token: boolean | null;
    status: 'RETRIEVING_TOKEN' | 'RETRIEVED_TOKEN' | 'TIMEOUT_TOKEN';
    auth_token?: string;
    [k: string]: unknown;
}

interface CachedToken {
    authToken: string;
    expiresAt?: string;
}

/**
 * Plex authentication via the PIN flow against the modern JSON v2 API
 * (https://plex.tv/api/v2/pins). Replaces the legacy XML endpoints.
 */
export class PlexPinAuth {
    private headers: Record<string, string>;
    private tokens: Map<number, CachedToken> = new Map();

    constructor(options?: PlexClientMetadata) {
        this.headers = this.buildHeaders(options || {});
    }

    private buildHeaders(options: PlexClientMetadata): Record<string, string> {
        const h: Record<string, string> = {
            Accept: 'application/json',
            'X-Plex-Provides': 'controller',
        };
        for (const key of Object.keys(HEADER_MAP)) {
            const optKey = HEADER_MAP[key];
            const val = options[optKey];
            if (val) {
                h[key] = val;
            }
        }
        return h;
    }

    /**
     * Request a new PIN from plex.tv. The response includes the numeric `id`
     * and the user-visible 4-character `code` displayed at https://plex.tv/link.
     */
    async getPin(): Promise<GetPinResult> {
        // No `strong=true`: we want the human-readable 4-character code that the user
        // enters at https://plex.tv/link (strong codes are long opaque strings for headless flows).
        const res = await axios.post<PinResponseData>(`${PLEX_TV_BASE}/pins`, null, {
            headers: this.headers,
            timeout: 10_000,
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
     */
    async getToken(pinId: number): Promise<GetTokenResult> {
        const cached = this.tokens.get(pinId);
        if (cached) {
            const cachedExp = cached.expiresAt ? Date.parse(cached.expiresAt) : NaN;
            const cachedExpired = !isNaN(cachedExp) && Date.now() >= cachedExp;
            if (!cachedExpired) {
                return {
                    token: true,
                    status: 'RETRIEVED_TOKEN',
                    auth_token: cached.authToken,
                };
            }
            this.tokens.delete(pinId);
        }

        const res = await axios.get<PinResponseData>(`${PLEX_TV_BASE}/pins/${pinId}`, {
            headers: this.headers,
            timeout: 10_000,
            responseType: 'json',
        });
        const pin: PinResponseData = res.data || ({} as PinResponseData);
        const result: GetTokenResult = {
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
            if (this.tokens.size >= TOKEN_CACHE_MAX) {
                const oldestKey = this.tokens.keys().next().value;
                if (oldestKey !== undefined) {
                    this.tokens.delete(oldestKey);
                }
            }
            this.tokens.set(pinId, { authToken: pin.authToken, expiresAt: pin.expiresAt });
        }

        return result;
    }
}
