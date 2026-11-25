import axios, { AxiosError, type AxiosAdapter, type AxiosResponse, type InternalAxiosRequestConfig } from 'axios';

export interface StubReply {
    status?: number;
    /** Response body as it would arrive on the wire. Objects are serialized to JSON text. */
    body?: unknown;
    headers?: Record<string, string>;
}

export type Responder = (config: InternalAxiosRequestConfig) => StubReply | Promise<StubReply>;

/**
 * Replaces the transport of the shared axios instance, so that nothing ever reaches the network.
 * Everything above the transport (config merging, header normalization, response transforms,
 * `validateStatus` handling) still runs through the real axios code.
 */
export class AxiosStub {
    public requests: InternalAxiosRequestConfig[] = [];
    private original: typeof axios.defaults.adapter;
    private installed = false;

    install(responder: Responder): void {
        if (!this.installed) {
            this.original = axios.defaults.adapter;
            this.installed = true;
        }
        this.requests = [];
        const adapter: AxiosAdapter = async config => {
            this.requests.push(config);
            const reply = await responder(config);
            const status = reply.status ?? 200;
            const response: AxiosResponse = {
                data:
                    reply.body !== undefined && typeof reply.body !== 'string'
                        ? JSON.stringify(reply.body)
                        : reply.body,
                status,
                statusText: '',
                headers: reply.headers ?? { 'content-type': 'application/json' },
                config,
                request: {},
            };
            // Same decision the real transports make in axios' `settle()`.
            const validate = config.validateStatus;
            if (!validate || validate(status)) {
                return response;
            }
            throw new AxiosError(
                `Request failed with status code ${status}`,
                status >= 500 ? AxiosError.ERR_BAD_RESPONSE : AxiosError.ERR_BAD_REQUEST,
                config,
                response.request,
                response,
            );
        };
        axios.defaults.adapter = adapter;
    }

    restore(): void {
        if (this.installed) {
            axios.defaults.adapter = this.original;
            this.installed = false;
        }
    }

    /** The single request that was sent; fails if there were none or several. */
    get only(): InternalAxiosRequestConfig {
        if (this.requests.length !== 1) {
            throw new Error(`expected exactly one HTTP request, got ${this.requests.length}`);
        }
        return this.requests[0];
    }
}

/**
 * Request header as sent, looked up case-insensitively.
 *
 * @param config - request config handed to the transport
 * @param name - header name
 */
export function header(config: InternalAxiosRequestConfig, name: string): string | undefined {
    const value = config.headers.get(name);
    return value === undefined || value === null ? undefined : String(value);
}

/**
 * An error as axios raises it for a failed socket/DNS operation.
 *
 * @param code - Node error code, e.g. `ECONNREFUSED`
 * @param message - error message
 */
export function transportError(code: string, message: string): AxiosError {
    return new AxiosError(message, code);
}
