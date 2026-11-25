import { expect } from 'chai';
import { afterEach, describe, it } from 'mocha';
import * as http from 'node:http';
import type { AddressInfo } from 'node:net';

import { PlexHttp, type PlexHttpOptions } from '../../src/lib/plexHttp';
import { AxiosStub, header, transportError } from './helpers/axiosStub';

interface ReceivedRequest {
    method: string;
    url: string;
    headers: http.IncomingHttpHeaders;
    body: string;
}

interface LocalServer {
    port: number;
    requests: ReceivedRequest[];
    close: () => Promise<void>;
}

/**
 * HTTP server on a free port of the loopback interface. `respond` decides what is sent back;
 * if it does nothing, the request stays unanswered (used for the timeout test).
 *
 * @param respond - handler producing the response
 */
async function startServer(respond: (req: ReceivedRequest, res: http.ServerResponse) => void): Promise<LocalServer> {
    const requests: ReceivedRequest[] = [];
    const server = http.createServer((req, res) => {
        const chunks: Buffer[] = [];
        req.on('data', (chunk: Buffer) => chunks.push(chunk));
        req.on('end', () => {
            const received: ReceivedRequest = {
                method: req.method ?? '',
                url: req.url ?? '',
                headers: req.headers,
                body: Buffer.concat(chunks).toString('utf8'),
            };
            requests.push(received);
            respond(received, res);
        });
    });
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
    return {
        port: (server.address() as AddressInfo).port,
        requests,
        close: () =>
            new Promise<void>(resolve => {
                server.close(() => resolve());
                server.closeAllConnections();
            }),
    };
}

function json(res: http.ServerResponse, status: number, body: unknown): void {
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(body));
}

async function rejection(promise: Promise<unknown>): Promise<any> {
    try {
        await promise;
    } catch (err) {
        return err;
    }
    throw new Error('expected the promise to be rejected, but it was fulfilled');
}

const IDENTITY = {
    identifier: 'client-id-1',
    product: 'Plex for ioBroker',
    version: '1.0',
    deviceName: 'ioBroker',
    platform: 'ioBroker',
    platformVersion: '22.0.0',
    device: 'Linux',
    language: 'en',
};

describe('PlexHttp', () => {
    describe('query against a local HTTP server', () => {
        let server: LocalServer | undefined;

        afterEach(async () => {
            await server?.close();
            server = undefined;
        });

        function client(port: number, extra: Partial<PlexHttpOptions> = {}): PlexHttp {
            // `proxy: false` keeps a proxy configured in the environment out of the loopback request.
            return new PlexHttp({
                hostname: '127.0.0.1',
                port,
                token: 'TOKEN-1',
                requestOptions: { proxy: false },
                ...extra,
            });
        }

        it('requests the path including its query string exactly as given', async () => {
            server = await startServer((_req, res) => json(res, 200, { MediaContainer: { size: 0 } }));
            const path = '/library/sections/9/all?X-Plex-Container-Start=0&X-Plex-Container-Size=0';

            await client(server.port).query(path);

            expect(server.requests.map(r => r.url)).to.deep.equal([path]);
            expect(server.requests[0].method).to.equal('GET');
        });

        it('neither double-encodes nor decodes an already encoded query', async () => {
            server = await startServer((_req, res) => json(res, 200, {}));
            const path = '/playQueues?uri=server%3A%2F%2Fabc%2Flibrary%2Fmetadata%2F5&title=a%20b%26c&type=video';

            await client(server.port).query(path);

            expect(server.requests[0].url).to.equal(path);
        });

        it('returns the parsed JSON body', async () => {
            const body = { MediaContainer: { size: 1, Metadata: [{ title: 'Alien', year: 1979 }] } };
            server = await startServer((_req, res) => json(res, 200, body));

            expect(await client(server.port).query('/library/metadata/5')).to.deep.equal(body);
        });

        it('resolves for a successful response without body (player commands)', async () => {
            server = await startServer((_req, res) => {
                res.writeHead(200);
                res.end();
            });

            expect(await client(server.port).query('/player/playback/play?type=video&commandID=1')).to.equal('');
        });

        it('sends token, JSON accept header and the client identity', async () => {
            server = await startServer((_req, res) => json(res, 200, {}));

            await client(server.port, { options: IDENTITY }).query('/');

            expect(server.requests[0].headers).to.include({
                accept: 'application/json',
                'x-plex-token': 'TOKEN-1',
                'x-plex-provides': 'controller',
                'x-plex-client-identifier': 'client-id-1',
                'x-plex-product': 'Plex for ioBroker',
                'x-plex-version': '1.0',
                'x-plex-device-name': 'ioBroker',
                'x-plex-platform': 'ioBroker',
                'x-plex-platform-version': '22.0.0',
                'x-plex-device': 'Linux',
                'x-plex-language': 'en',
            });
        });

        it('adds per-request headers (e.g. the target player) to the standard ones', async () => {
            server = await startServer((_req, res) => json(res, 200, {}));

            await client(server.port, { options: IDENTITY }).query('/player/timeline/poll?wait=0', {
                headers: { 'X-Plex-Target-Client-Identifier': 'player-uuid', 'X-Plex-Device-Name': 'override' },
            });

            expect(server.requests[0].headers).to.include({
                'x-plex-target-client-identifier': 'player-uuid',
                'x-plex-device-name': 'override',
                'x-plex-token': 'TOKEN-1',
                'x-plex-client-identifier': 'client-id-1',
                accept: 'application/json',
            });
        });

        it('sends no token header when no token is configured', async () => {
            server = await startServer((_req, res) => json(res, 200, {}));

            await client(server.port, { token: undefined }).query('/identity');

            expect(server.requests[0].headers).to.not.have.property('x-plex-token');
        });

        it('uses the requested method and sends data as JSON body', async () => {
            server = await startServer((_req, res) => json(res, 200, {}));

            await client(server.port).query('/library/sections/1/refresh', { method: 'PUT', data: { force: 1 } });

            expect(server.requests[0].method).to.equal('PUT');
            expect(JSON.parse(server.requests[0].body)).to.deep.equal({ force: 1 });
        });

        it('rejects with status code and reason for an HTTP error status', async () => {
            server = await startServer((_req, res) => json(res, 401, { errors: [{ code: 1001 }] }));

            const err = await rejection(client(server.port).query('/'));

            expect(err).to.be.an.instanceOf(Error);
            expect(err.statusCode).to.equal(401);
            expect(err.message).to.contain('401').and.to.contain('Unauthorized');
        });

        it('rejects with code ECONNABORTED when the server does not answer in time', async () => {
            server = await startServer(() => {
                /* never answer */
            });

            const err = await rejection(client(server.port).query('/slow', { timeout: 100 }));

            expect(err).to.be.an.instanceOf(Error);
            expect(err.code).to.equal('ECONNABORTED');
            expect(err.message).to.contain('ECONNABORTED');
        });
    });

    describe('request building', () => {
        const stub = new AxiosStub();

        afterEach(() => {
            stub.restore();
        });

        async function requestOf(options: PlexHttpOptions, path = '/identity'): Promise<any> {
            stub.install(() => ({ body: {} }));
            await new PlexHttp(options).query(path);
            return stub.only;
        }

        it('uses http and the default Plex port', async () => {
            expect((await requestOf({ hostname: '192.0.2.10' })).url).to.equal('http://192.0.2.10:32400/identity');
        });

        it('uses the configured port', async () => {
            expect((await requestOf({ hostname: 'plex.local', port: 12_345 })).url).to.equal(
                'http://plex.local:12345/identity',
            );
        });

        it('uses https when requested', async () => {
            expect((await requestOf({ hostname: '192.0.2.10', https: true })).url).to.equal(
                'https://192.0.2.10:32400/identity',
            );
        });

        it('uses https on port 443 unless https is explicitly switched off', async () => {
            expect((await requestOf({ hostname: 'plex.example', port: 443 })).url).to.equal(
                'https://plex.example:443/identity',
            );
            expect((await requestOf({ hostname: 'plex.example', port: 443, https: false })).url).to.equal(
                'http://plex.example:443/identity',
            );
        });

        it('keeps path and query string verbatim in the URL', async () => {
            const path = '/library/sections/9/all?X-Plex-Container-Start=0&X-Plex-Container-Size=0';

            const request = await requestOf({ hostname: '192.0.2.10' }, path);

            expect(request.url).to.equal(`http://192.0.2.10:32400${path}`);
            expect(request.params, 'no separate params that axios would append').to.equal(undefined);
        });

        it('rejects an empty or missing hostname', () => {
            expect(() => new PlexHttp({ hostname: '' })).to.throw(TypeError);
            expect(() => new PlexHttp({ hostname: undefined as unknown as string })).to.throw(TypeError);
        });

        it('accepts invalid certificates by default for https (Plex certificates do not match LAN IPs)', async () => {
            const request = await requestOf({ hostname: '192.0.2.10', https: true });

            expect(request.httpsAgent.options.rejectUnauthorized).to.equal(false);
        });

        it('validates certificates when rejectUnauthorized is switched on', async () => {
            const request = await requestOf({
                hostname: 'plex.example',
                https: true,
                requestOptions: { rejectUnauthorized: true },
            });

            expect(request.httpsAgent.options.rejectUnauthorized).to.equal(true);
        });

        it('puts TLS options on the https agent and not on the request itself', async () => {
            const request = await requestOf({
                hostname: '192.0.2.10',
                https: true,
                requestOptions: {
                    cert: 'CERT',
                    key: 'KEY',
                    ca: 'CA',
                    passphrase: 'PASS',
                    rejectUnauthorized: false,
                    secureConnection: true,
                    _protocol: 'https:',
                },
            });

            expect(request.httpsAgent.options).to.include({ cert: 'CERT', key: 'KEY', ca: 'CA', passphrase: 'PASS' });
            for (const key of [
                'cert',
                'key',
                'ca',
                'passphrase',
                'rejectUnauthorized',
                'secureConnection',
                '_protocol',
            ]) {
                expect(request, `"${key}" on the axios config`).to.not.have.property(key);
            }
        });

        it('creates no https agent for plain http', async () => {
            const request = await requestOf({ hostname: '192.0.2.10', requestOptions: { cert: 'CERT', key: 'KEY' } });

            expect(request.httpsAgent).to.equal(undefined);
            expect(request).to.not.have.property('cert');
        });

        it('passes other request options through to axios', async () => {
            const request = await requestOf({ hostname: '192.0.2.10', requestOptions: { maxRedirects: 0 } });

            expect(request.maxRedirects).to.equal(0);
        });

        it('uses a 10 s timeout by default', async () => {
            expect((await requestOf({ hostname: '192.0.2.10' })).timeout).to.equal(10_000);
        });

        it('lets the constructor, the request options and the single query override the timeout, in that order', async () => {
            expect((await requestOf({ hostname: '192.0.2.10', timeout: 4000 })).timeout).to.equal(4000);
            expect(
                (await requestOf({ hostname: '192.0.2.10', timeout: 4000, requestOptions: { timeout: 2500 } })).timeout,
            ).to.equal(2500);

            stub.install(() => ({ body: {} }));
            const plex = new PlexHttp({ hostname: '192.0.2.10', timeout: 4000 });
            await plex.query('/a', { timeout: 3000 });
            await plex.query('/b');
            expect(stub.requests.map(r => r.timeout)).to.deep.equal([3000, 4000]);
        });

        it('sends only the identity headers that are configured', async () => {
            const request = await requestOf({ hostname: '192.0.2.10', options: { identifier: 'client-id-1' } });

            expect(header(request, 'X-Plex-Client-Identifier')).to.equal('client-id-1');
            expect(header(request, 'X-Plex-Provides')).to.equal('controller');
            expect(header(request, 'X-Plex-Product')).to.equal(undefined);
            expect(header(request, 'X-Plex-Device-Name')).to.equal(undefined);
        });
    });

    describe('error handling of query', () => {
        const stub = new AxiosStub();
        const plex = (): PlexHttp => new PlexHttp({ hostname: '192.0.2.10', token: 'TOKEN-1' });

        afterEach(() => {
            stub.restore();
        });

        const statusCases: Array<[number, string]> = [
            [401, 'Unauthorized'],
            [403, 'Forbidden'],
            [404, 'Not Found'],
            [500, 'Internal Server Error'],
            [502, 'Bad Gateway'],
            [503, 'Service Unavailable'],
            [504, 'Gateway Timeout'],
        ];
        for (const [status, text] of statusCases) {
            it(`rejects HTTP ${status} with statusCode ${status} and "${text}" in the message`, async () => {
                stub.install(() => ({ status, body: '' }));

                const err = await rejection(plex().query('/'));

                expect(err).to.be.an.instanceOf(Error);
                expect(err.statusCode).to.equal(status);
                expect(err.message).to.contain(String(status)).and.to.contain(text);
            });
        }

        it('rejects other non-2xx statuses with their status code as well', async () => {
            for (const status of [199, 301, 418, 429]) {
                stub.install(() => ({ status, body: '' }));

                const err = await rejection(plex().query('/'));

                expect(err.statusCode, `HTTP ${status}`).to.equal(status);
                expect(err.message).to.contain(String(status));
            }
        });

        it('resolves for every 2xx status', async () => {
            for (const status of [200, 201, 204, 299]) {
                stub.install(() => ({ status, body: { ok: true } }));

                expect(await plex().query('/'), `HTTP ${status}`).to.deep.equal({ ok: true });
            }
        });

        for (const code of ['ECONNREFUSED', 'ETIMEDOUT', 'ECONNABORTED', 'ENOTFOUND', 'EHOSTUNREACH', 'ENETUNREACH']) {
            it(`keeps the network error code ${code} as code and in the message`, async () => {
                stub.install(() => {
                    throw transportError(code, `connect failed 192.0.2.10:32400`);
                });

                const err = await rejection(plex().query('/'));

                expect(err).to.be.an.instanceOf(Error);
                expect(err.code).to.equal(code);
                expect(err.message).to.contain(code).and.to.contain('connect failed 192.0.2.10:32400');
            });
        }

        it('reports a canceled request as timeout', async () => {
            stub.install(() => {
                throw transportError('ERR_CANCELED', 'canceled');
            });

            const err = await rejection(plex().query('/'));

            expect(err.code).to.equal('ETIMEDOUT');
            expect(err.message).to.contain('ETIMEDOUT');
        });

        it('reports a generic network failure as connection refused', async () => {
            stub.install(() => {
                throw transportError('ERR_NETWORK', 'Network Error');
            });

            const err = await rejection(plex().query('/'));

            expect(err.code).to.equal('ECONNREFUSED');
            expect(err.message).to.contain('ECONNREFUSED').and.to.contain('Network Error');
        });

        it('passes other errors on unchanged', async () => {
            const original = Object.assign(new Error('socket hang up'), { code: 'ECONNRESET' });
            stub.install(() => {
                throw original;
            });

            const err = await rejection(plex().query('/'));

            expect(err).to.equal(original);
            expect(err.code).to.equal('ECONNRESET');
        });

        it('always rejects with an Error, even if something else was thrown', async () => {
            const thrown: unknown[] = ['plain text', 42, { some: 'object' }, { code: 'ENOTFOUND' }, null, undefined];
            for (const value of thrown) {
                // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors
                stub.install(() => Promise.reject(value));

                const err = await rejection(plex().query('/'));

                expect(err, `thrown: ${JSON.stringify(value)}`).to.be.an.instanceOf(Error);
                expect(err.message).to.be.a('string').and.not.equal('');
            }
        });

        it('keeps text and network code of non-Error rejections', async () => {
            // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors
            stub.install(() => Promise.reject('plain text'));
            expect((await rejection(plex().query('/'))).message).to.equal('plain text');

            // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors
            stub.install(() => Promise.reject({ code: 'ENOTFOUND' }));
            expect((await rejection(plex().query('/'))).code).to.equal('ENOTFOUND');
        });
    });

    describe('fetchPlexTvResources', () => {
        const stub = new AxiosStub();
        const plex = (): PlexHttp =>
            new PlexHttp({ hostname: '192.0.2.10', https: true, token: 'SERVER-TOKEN', options: IDENTITY });

        afterEach(() => {
            stub.restore();
        });

        it('asks plex.tv for the resources of the given account, including https and relay connections', async () => {
            stub.install(() => ({ body: [] }));

            await plex().fetchPlexTvResources('ACCOUNT-TOKEN');

            const url = new URL(String(stub.only.url));
            expect(url.origin + url.pathname).to.equal('https://plex.tv/api/v2/resources');
            expect(url.searchParams.get('includeHttps')).to.equal('1');
            expect(url.searchParams.get('includeRelay')).to.equal('1');
            expect(String(stub.only.method).toUpperCase()).to.equal('GET');
        });

        it('authenticates with the token passed in and identifies the client', async () => {
            stub.install(() => ({ body: [] }));

            await plex().fetchPlexTvResources('ACCOUNT-TOKEN');

            expect(header(stub.only, 'X-Plex-Token')).to.equal('ACCOUNT-TOKEN');
            expect(header(stub.only, 'Accept')).to.equal('application/json');
            expect(header(stub.only, 'X-Plex-Client-Identifier')).to.equal('client-id-1');
            expect(header(stub.only, 'X-Plex-Product')).to.equal('Plex for ioBroker');
        });

        it('does not use the certificate-tolerant agent of the local server for plex.tv', async () => {
            stub.install(() => ({ body: [] }));

            await plex().fetchPlexTvResources('ACCOUNT-TOKEN');

            expect(stub.only.httpsAgent).to.equal(undefined);
        });

        it('returns the resource list', async () => {
            const resources = [
                {
                    name: 'Apple TV',
                    clientIdentifier: 'ATV-1',
                    provides: 'client,player',
                    connections: [
                        {
                            uri: 'http://10.0.0.5:32500',
                            address: '10.0.0.5',
                            port: 32_500,
                            protocol: 'http',
                            local: true,
                        },
                    ],
                },
                { name: 'Server', clientIdentifier: 'PMS-1', provides: 'server' },
            ];
            stub.install(() => ({ body: resources }));

            expect(await plex().fetchPlexTvResources('ACCOUNT-TOKEN')).to.deep.equal(resources);
        });

        it('returns an empty list when plex.tv answers with something that is not a list', async () => {
            for (const body of [{ errors: [] }, '', 'null', '<html></html>']) {
                stub.install(() => ({ body }));

                expect(await plex().fetchPlexTvResources('ACCOUNT-TOKEN')).to.deep.equal([]);
            }
        });

        for (const status of [401, 403]) {
            it(`rejects with PLEX_TV_UNAUTHORIZED on HTTP ${status}`, async () => {
                stub.install(() => ({
                    status,
                    body: { errors: [{ code: 1001, message: 'User could not be authenticated' }] },
                }));

                const err = await rejection(plex().fetchPlexTvResources('ACCOUNT-TOKEN'));

                expect(err).to.be.an.instanceOf(Error);
                expect(err.code).to.equal('PLEX_TV_UNAUTHORIZED');
                expect(err.message).to.contain(String(status));
            });
        }

        it('rejects with PLEX_TV_UNAUTHORIZED without asking plex.tv when there is no token', async () => {
            stub.install(() => ({ body: [] }));

            const err = await rejection(plex().fetchPlexTvResources(''));

            expect(err.code).to.equal('PLEX_TV_UNAUTHORIZED');
            expect(stub.requests).to.deep.equal([]);
        });

        it('rejects other HTTP errors with their status code', async () => {
            stub.install(() => ({ status: 503, body: '' }));

            const err = await rejection(plex().fetchPlexTvResources('ACCOUNT-TOKEN'));

            expect(err.statusCode).to.equal(503);
            expect(err.code).to.equal(undefined);
        });

        it('reports network errors with their code', async () => {
            stub.install(() => {
                throw transportError('ENOTFOUND', 'getaddrinfo ENOTFOUND plex.tv');
            });

            const err = await rejection(plex().fetchPlexTvResources('ACCOUNT-TOKEN'));

            expect(err.code).to.equal('ENOTFOUND');
            expect(err.message).to.contain('ENOTFOUND');
        });
    });

    describe('fetchPlexTvDevices', () => {
        const stub = new AxiosStub();
        const plex = (): PlexHttp =>
            new PlexHttp({ hostname: '192.0.2.10', https: true, token: 'SERVER-TOKEN', options: IDENTITY });
        const XML = { 'content-type': 'application/xml;charset=utf-8' };
        const JSON_TYPE = { 'content-type': 'application/json; charset=utf-8' };

        const DEVICES_XML = `<?xml version="1.0" encoding="UTF-8"?>
<MediaContainer publicAddress="203.0.113.7">
  <Device name="Wohnzimmer" publicAddress="203.0.113.7" product="Plex for Apple TV" productVersion="8.30"
          platform="tvOS" platformVersion="17.2" device="Apple TV" model="AppleTV6,2" vendor="Apple"
          provides="client,player,pubsub-player" clientIdentifier="ATV-1" version="8.30" id="1"
          token="device-token" createdAt="1600000000" lastSeenAt="1700000000" screenResolution="">
    <SyncList itemsCompleteCount="0" totalSize="0" version="2"/>
    <Connection uri="http://192.168.1.20:32500"/>
    <Connection uri="http://10.0.0.5:32500" address="10.0.0.5" port="32500" protocol="http" local="1"/>
  </Device>
  <Device name="iPhone" product="Plex for iOS" provides="" clientIdentifier="IOS-1" lastSeenAt="1700000001"/>
  <Device name="Server" product="Plex Media Server" provides="server" clientIdentifier="PMS-1">
  </Device>
</MediaContainer>`;

        afterEach(() => {
            stub.restore();
        });

        it('asks plex.tv/devices.xml with the token passed in', async () => {
            stub.install(() => ({ body: '<MediaContainer/>', headers: XML }));

            await plex().fetchPlexTvDevices('ACCOUNT-TOKEN');

            expect(stub.only.url).to.equal('https://plex.tv/devices.xml');
            expect(String(stub.only.method).toUpperCase()).to.equal('GET');
            expect(header(stub.only, 'X-Plex-Token')).to.equal('ACCOUNT-TOKEN');
            expect(header(stub.only, 'X-Plex-Client-Identifier')).to.equal('client-id-1');
            expect(stub.only.httpsAgent).to.equal(undefined);
        });

        it('reads all devices from an XML answer', async () => {
            stub.install(() => ({ body: DEVICES_XML, headers: XML }));

            const devices = await plex().fetchPlexTvDevices('ACCOUNT-TOKEN');

            expect(devices.map(d => d.clientIdentifier)).to.deep.equal(['ATV-1', 'IOS-1', 'PMS-1']);
            expect(devices.map(d => d.name)).to.deep.equal(['Wohnzimmer', 'iPhone', 'Server']);
            expect(devices.map(d => d.provides)).to.deep.equal(['client,player,pubsub-player', '', 'server']);
        });

        it('reads the descriptive attributes of an XML device', async () => {
            stub.install(() => ({ body: DEVICES_XML, headers: XML }));

            const [appleTv] = await plex().fetchPlexTvDevices('ACCOUNT-TOKEN');

            expect(appleTv).to.include({
                clientIdentifier: 'ATV-1',
                name: 'Wohnzimmer',
                product: 'Plex for Apple TV',
                productVersion: '8.30',
                platform: 'tvOS',
                platformVersion: '17.2',
                device: 'Apple TV',
                model: 'AppleTV6,2',
                vendor: 'Apple',
                publicAddress: '203.0.113.7',
                lastSeenAt: '1700000000',
            });
        });

        it('reads the connections of an XML device and ignores other child elements', async () => {
            stub.install(() => ({ body: DEVICES_XML, headers: XML }));

            const [appleTv, iPhone, server] = await plex().fetchPlexTvDevices('ACCOUNT-TOKEN');

            expect(appleTv.connections).to.deep.equal([
                {
                    uri: 'http://192.168.1.20:32500',
                    address: undefined,
                    port: undefined,
                    protocol: undefined,
                    local: false,
                },
                { uri: 'http://10.0.0.5:32500', address: '10.0.0.5', port: 32_500, protocol: 'http', local: true },
            ]);
            expect(iPhone.connections).to.deep.equal([]);
            expect(server.connections).to.deep.equal([]);
        });

        it('does not mix up the connections of neighbouring devices', async () => {
            const body =
                '<MediaContainer>' +
                '<Device name="A" clientIdentifier="A-1" provides="player"/>' +
                '<Device name="B" clientIdentifier="B-1" provides="player"><Connection uri="http://b:1"/></Device>' +
                '<Device name="C" clientIdentifier="C-1" provides="player"><Connection uri="http://c:1"/></Device>' +
                '</MediaContainer>';
            stub.install(() => ({ body, headers: XML }));

            const devices = await plex().fetchPlexTvDevices('ACCOUNT-TOKEN');

            expect(devices.map(d => [d.name, d.connections.map(c => c.uri)])).to.deep.equal([
                ['A', []],
                ['B', ['http://b:1']],
                ['C', ['http://c:1']],
            ]);
        });

        it('gives the same result when the same answer is parsed repeatedly', async () => {
            stub.install(() => ({ body: DEVICES_XML, headers: XML }));
            const client = plex();

            const first = await client.fetchPlexTvDevices('ACCOUNT-TOKEN');
            const second = await client.fetchPlexTvDevices('ACCOUNT-TOKEN');

            expect(second).to.deep.equal(first);
            expect(second).to.have.length(3);
        });

        it('fills identifier and provides with empty strings when the attributes are missing', async () => {
            stub.install(() => ({ body: '<MediaContainer><Device name="Nameless"/></MediaContainer>', headers: XML }));

            const [device] = await plex().fetchPlexTvDevices('ACCOUNT-TOKEN');

            expect(device.clientIdentifier).to.equal('');
            expect(device.provides).to.equal('');
            expect(device.product).to.equal(undefined);
        });

        it('returns an empty list for an answer without devices', async () => {
            for (const body of ['<MediaContainer size="0"/>', '', '<html><body>Bad Gateway</body></html>']) {
                stub.install(() => ({ body, headers: XML }));

                expect(await plex().fetchPlexTvDevices('ACCOUNT-TOKEN')).to.deep.equal([]);
            }
        });

        // Finding (not fixed, see report): XML character references in attribute values are not
        // decoded, so such a device name reaches the adapter as "Rock &amp; Roll TV".
        it.skip('decodes XML entities in attribute values', async () => {
            const body = '<MediaContainer><Device name="Rock &amp; Roll TV" clientIdentifier="X-1"/></MediaContainer>';
            stub.install(() => ({ body, headers: XML }));

            const [device] = await plex().fetchPlexTvDevices('ACCOUNT-TOKEN');

            expect(device.name).to.equal('Rock & Roll TV');
        });

        it('reads devices and connections from a JSON answer', async () => {
            const body = {
                MediaContainer: {
                    Device: [
                        {
                            name: 'Wohnzimmer',
                            clientIdentifier: 'ATV-1',
                            product: 'Plex for Apple TV',
                            provides: 'client,player',
                            Connection: [
                                { uri: 'http://10.0.0.5:32500', address: '10.0.0.5', port: '32500', local: true },
                            ],
                        },
                        { name: 'iPhone', clientIdentifier: 'IOS-1' },
                    ],
                },
            };
            stub.install(() => ({ body, headers: JSON_TYPE }));

            const devices = await plex().fetchPlexTvDevices('ACCOUNT-TOKEN');

            expect(devices).to.have.length(2);
            expect(devices[0]).to.include({
                name: 'Wohnzimmer',
                clientIdentifier: 'ATV-1',
                product: 'Plex for Apple TV',
                provides: 'client,player',
            });
            expect(devices[0].connections).to.deep.equal([
                { uri: 'http://10.0.0.5:32500', address: '10.0.0.5', port: 32_500, protocol: undefined, local: true },
            ]);
            expect(devices[1]).to.include({ name: 'iPhone', clientIdentifier: 'IOS-1', provides: '' });
            expect(devices[1].connections).to.deep.equal([]);
        });

        it('falls back to XML parsing when the answer is XML although it is labelled as JSON', async () => {
            stub.install(() => ({ body: DEVICES_XML, headers: JSON_TYPE }));

            expect(await plex().fetchPlexTvDevices('ACCOUNT-TOKEN')).to.have.length(3);
        });

        it('returns an empty list for JSON without a device list or for broken JSON', async () => {
            const bodies = [
                '{"MediaContainer":{}}',
                '{}',
                '{"MediaContainer":{"Device":{"name":"single"}}}',
                '{ broken',
            ];
            for (const body of bodies) {
                stub.install(() => ({ body, headers: JSON_TYPE }));

                expect(await plex().fetchPlexTvDevices('ACCOUNT-TOKEN'), body).to.deep.equal([]);
            }
        });

        for (const status of [401, 403]) {
            it(`rejects with PLEX_TV_UNAUTHORIZED on HTTP ${status}`, async () => {
                stub.install(() => ({ status, body: '<errors/>', headers: XML }));

                const err = await rejection(plex().fetchPlexTvDevices('ACCOUNT-TOKEN'));

                expect(err.code).to.equal('PLEX_TV_UNAUTHORIZED');
                expect(err.message).to.contain(String(status));
            });
        }

        it('rejects with PLEX_TV_UNAUTHORIZED without asking plex.tv when there is no token', async () => {
            stub.install(() => ({ body: DEVICES_XML, headers: XML }));

            const err = await rejection(plex().fetchPlexTvDevices(''));

            expect(err.code).to.equal('PLEX_TV_UNAUTHORIZED');
            expect(stub.requests).to.deep.equal([]);
        });

        it('rejects other HTTP errors with their status code and network errors with their code', async () => {
            stub.install(() => ({ status: 500, body: '', headers: XML }));
            expect((await rejection(plex().fetchPlexTvDevices('ACCOUNT-TOKEN'))).statusCode).to.equal(500);

            stub.install(() => {
                throw transportError('ETIMEDOUT', 'connect ETIMEDOUT');
            });
            expect((await rejection(plex().fetchPlexTvDevices('ACCOUNT-TOKEN'))).code).to.equal('ETIMEDOUT');
        });
    });
});
