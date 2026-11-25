import { expect } from 'chai';
import { afterEach, describe, it } from 'mocha';
import * as sinon from 'sinon';

import { PlexPinAuth } from '../../src/lib/plexPinAuth';
import { AxiosStub, header, transportError, type StubReply } from './helpers/axiosStub';

const NOW = Date.UTC(2026, 0, 10, 12, 0, 0);
const IN_15_MIN = new Date(NOW + 15 * 60_000).toISOString();
const ONE_MIN_AGO = new Date(NOW - 60_000).toISOString();

const IDENTITY = {
    identifier: 'client-id-1',
    product: 'Plex for ioBroker',
    version: '1.0',
    device: 'Linux',
    deviceName: 'ioBroker',
    platform: 'ioBroker',
    platformVersion: '22.0.0',
    language: 'en',
};

async function rejection(promise: Promise<unknown>): Promise<any> {
    try {
        await promise;
    } catch (err) {
        return err;
    }
    throw new Error('expected the promise to be rejected, but it was fulfilled');
}

describe('PlexPinAuth', () => {
    const stub = new AxiosStub();
    let clock: sinon.SinonFakeTimers;

    function useClock(): void {
        clock = sinon.useFakeTimers({ now: NOW, toFake: ['Date'] });
    }

    afterEach(() => {
        stub.restore();
        sinon.restore();
    });

    describe('getPin', () => {
        const PIN = { id: 4711, code: 'AB12', expiresAt: IN_15_MIN, authToken: null, trusted: false };

        it('requests a new PIN from plex.tv with POST', async () => {
            stub.install(() => ({ status: 201, body: PIN }));

            await new PlexPinAuth(IDENTITY).getPin();

            expect(String(stub.only.method).toUpperCase()).to.equal('POST');
            expect(new URL(String(stub.only.url)).origin).to.equal('https://plex.tv');
            expect(new URL(String(stub.only.url)).pathname).to.equal('/api/v2/pins');
        });

        // The adapter shows the code to the user for entry at plex.tv/link. Only the short
        // 4-character code works there; "strong" PINs are long and meant for the headless flow.
        it('does not ask for a "strong" PIN', async () => {
            stub.install(() => ({ status: 201, body: PIN }));

            await new PlexPinAuth(IDENTITY).getPin();

            expect(String(stub.only.url)).to.not.contain('strong');
            expect(JSON.stringify(stub.only.params ?? {})).to.not.contain('strong');
            expect(String(stub.only.data ?? '')).to.not.contain('strong');
        });

        it('identifies the client and asks for JSON', async () => {
            stub.install(() => ({ status: 201, body: PIN }));

            await new PlexPinAuth(IDENTITY).getPin();

            const sent = stub.only;
            expect(header(sent, 'Accept')).to.equal('application/json');
            expect(header(sent, 'X-Plex-Provides')).to.equal('controller');
            expect(header(sent, 'X-Plex-Client-Identifier')).to.equal('client-id-1');
            expect(header(sent, 'X-Plex-Product')).to.equal('Plex for ioBroker');
            expect(header(sent, 'X-Plex-Version')).to.equal('1.0');
            expect(header(sent, 'X-Plex-Device')).to.equal('Linux');
            expect(header(sent, 'X-Plex-Device-Name')).to.equal('ioBroker');
            expect(header(sent, 'X-Plex-Platform')).to.equal('ioBroker');
            expect(header(sent, 'X-Plex-Platform-Version')).to.equal('22.0.0');
            expect(header(sent, 'X-Plex-Language')).to.equal('en');
        });

        it('leaves out identity headers that are not configured', async () => {
            stub.install(() => ({ status: 201, body: PIN }));

            await new PlexPinAuth({ identifier: 'client-id-1' }).getPin();

            expect(header(stub.only, 'X-Plex-Client-Identifier')).to.equal('client-id-1');
            expect(header(stub.only, 'X-Plex-Product')).to.equal(undefined);
            expect(header(stub.only, 'X-Plex-Device-Name')).to.equal(undefined);
        });

        it('works without any client metadata', async () => {
            stub.install(() => ({ status: 201, body: PIN }));

            const result = await new PlexPinAuth().getPin();

            expect(result.code).to.equal('AB12');
            expect(header(stub.only, 'X-Plex-Client-Identifier')).to.equal(undefined);
        });

        it('returns id and code of the PIN, marked as "code retrieved" and without token', async () => {
            stub.install(() => ({ status: 201, body: PIN }));

            const result = await new PlexPinAuth(IDENTITY).getPin();

            expect(result).to.include({ id: 4711, code: 'AB12', expiresAt: IN_15_MIN });
            expect(result.status).to.equal('RETRIEVED_CODE');
            expect(result.token).to.equal(null);
        });

        it('rejects when plex.tv answers with an error status', async () => {
            stub.install(() => ({ status: 429, body: { errors: [{ code: 1003, message: 'Rate limit' }] } }));

            const err = await rejection(new PlexPinAuth(IDENTITY).getPin());

            expect(err).to.be.an.instanceOf(Error);
            expect(err.response.status).to.equal(429);
        });

        it('rejects when plex.tv cannot be reached', async () => {
            stub.install(() => {
                throw transportError('ENOTFOUND', 'getaddrinfo ENOTFOUND plex.tv');
            });

            const err = await rejection(new PlexPinAuth(IDENTITY).getPin());

            expect(err.code).to.equal('ENOTFOUND');
        });
    });

    describe('getToken', () => {
        const pending = (id: number): StubReply => ({
            body: { id, code: 'AB12', expiresAt: IN_15_MIN, authToken: null },
        });
        const linked = (id: number, token = `token-of-${id}`): StubReply => ({
            body: { id, code: 'AB12', expiresAt: IN_15_MIN, authToken: token },
        });
        const idOf = (url: unknown): number => Number(String(url).split('/').pop());

        it('polls the PIN by its id with GET and the client identity', async () => {
            useClock();
            stub.install(() => pending(4711));

            await new PlexPinAuth(IDENTITY).getToken(4711);

            expect(String(stub.only.method).toUpperCase()).to.equal('GET');
            expect(stub.only.url).to.equal('https://plex.tv/api/v2/pins/4711');
            expect(header(stub.only, 'X-Plex-Client-Identifier')).to.equal('client-id-1');
            expect(header(stub.only, 'Accept')).to.equal('application/json');
        });

        it('reports "still retrieving" while the user has not linked the PIN', async () => {
            useClock();
            stub.install(() => pending(4711));

            const result = await new PlexPinAuth(IDENTITY).getToken(4711);

            expect(result.status).to.equal('RETRIEVING_TOKEN');
            expect(result.token).to.equal(null);
            expect(result.auth_token).to.equal(undefined);
            expect(result).to.include({ id: 4711, code: 'AB12' });
        });

        it('returns the token once the PIN is linked', async () => {
            useClock();
            stub.install(() => linked(4711, 'the-auth-token'));

            const result = await new PlexPinAuth(IDENTITY).getToken(4711);

            expect(result.status).to.equal('RETRIEVED_TOKEN');
            expect(result.token).to.equal(true);
            expect(result.auth_token).to.equal('the-auth-token');
        });

        it('reports a timeout when the PIN expired without being linked', async () => {
            useClock();
            stub.install(() => ({ body: { id: 4711, code: 'AB12', expiresAt: ONE_MIN_AGO, authToken: null } }));

            const result = await new PlexPinAuth(IDENTITY).getToken(4711);

            expect(result.status).to.equal('TIMEOUT_TOKEN');
            expect(result.token).to.equal(false);
            expect(result.auth_token).to.equal(undefined);
        });

        it('treats the PIN as expired exactly at its expiry time, not before', async () => {
            useClock();
            stub.install(() => pending(4711));
            const auth = new PlexPinAuth(IDENTITY);

            clock.tick(15 * 60_000 - 1);
            expect((await auth.getToken(4711)).status).to.equal('RETRIEVING_TOKEN');

            clock.tick(1);
            expect((await auth.getToken(4711)).status).to.equal('TIMEOUT_TOKEN');
        });

        it('still returns the token when it arrives together with an expired PIN', async () => {
            useClock();
            stub.install(() => ({ body: { id: 4711, code: 'AB12', expiresAt: ONE_MIN_AGO, authToken: 'late-token' } }));

            const result = await new PlexPinAuth(IDENTITY).getToken(4711);

            expect(result.status).to.equal('RETRIEVED_TOKEN');
            expect(result.token).to.equal(true);
            expect(result.auth_token).to.equal('late-token');
        });

        it('keeps polling while the PIN is pending and does not time out a PIN without expiry date', async () => {
            useClock();
            stub.install(() => ({ body: { id: 4711, code: 'AB12', authToken: null } }));
            const auth = new PlexPinAuth(IDENTITY);

            expect((await auth.getToken(4711)).status).to.equal('RETRIEVING_TOKEN');
            expect((await auth.getToken(4711)).status).to.equal('RETRIEVING_TOKEN');
            expect(stub.requests).to.have.length(2);
        });

        it('reports "still retrieving" for an empty answer', async () => {
            useClock();
            stub.install(() => ({ body: '' }));

            const result = await new PlexPinAuth(IDENTITY).getToken(4711);

            expect(result.status).to.equal('RETRIEVING_TOKEN');
            expect(result.token).to.equal(null);
        });

        it('answers repeated requests for a linked PIN from memory, without asking plex.tv again', async () => {
            useClock();
            stub.install(() => linked(4711, 'the-auth-token'));
            const auth = new PlexPinAuth(IDENTITY);
            await auth.getToken(4711);

            const again = await auth.getToken(4711);

            expect(stub.requests).to.have.length(1);
            expect(again.status).to.equal('RETRIEVED_TOKEN');
            expect(again.token).to.equal(true);
            expect(again.auth_token).to.equal('the-auth-token');
        });

        it('keeps the tokens of different PINs apart', async () => {
            useClock();
            stub.install(config => linked(idOf(config.url)));
            const auth = new PlexPinAuth(IDENTITY);
            await auth.getToken(1);
            await auth.getToken(2);

            expect((await auth.getToken(1)).auth_token).to.equal('token-of-1');
            expect((await auth.getToken(2)).auth_token).to.equal('token-of-2');
            expect(stub.requests).to.have.length(2);
        });

        it('does not share remembered tokens between instances', async () => {
            useClock();
            stub.install(() => linked(4711));
            await new PlexPinAuth(IDENTITY).getToken(4711);

            await new PlexPinAuth(IDENTITY).getToken(4711);

            expect(stub.requests).to.have.length(2);
        });

        it('asks plex.tv again once the remembered PIN has expired', async () => {
            useClock();
            stub.install(() => linked(4711));
            const auth = new PlexPinAuth(IDENTITY);
            await auth.getToken(4711);

            clock.tick(15 * 60_000 - 1);
            await auth.getToken(4711);
            expect(stub.requests, 'before expiry').to.have.length(1);

            clock.tick(1);
            await auth.getToken(4711);
            expect(stub.requests, 'after expiry').to.have.length(2);
        });

        it('remembers at most 50 PINs and forgets the oldest first', async () => {
            useClock();
            stub.install(config => linked(idOf(config.url)));
            const auth = new PlexPinAuth(IDENTITY);
            for (let id = 1; id <= 51; id++) {
                await auth.getToken(id);
            }
            expect(stub.requests).to.have.length(51);

            await auth.getToken(2);
            await auth.getToken(51);
            expect(stub.requests, 'PIN 2 and 51 are still remembered').to.have.length(51);

            const first = await auth.getToken(1);
            expect(stub.requests, 'PIN 1 had to be fetched again').to.have.length(52);
            expect(first.auth_token).to.equal('token-of-1');
        });

        it('does not remember a PIN that is not linked yet', async () => {
            useClock();
            let authToken: string | null = null;
            stub.install(() => ({ body: { id: 4711, code: 'AB12', expiresAt: IN_15_MIN, authToken } }));
            const auth = new PlexPinAuth(IDENTITY);

            expect((await auth.getToken(4711)).status).to.equal('RETRIEVING_TOKEN');
            authToken = 'now-linked';
            const result = await auth.getToken(4711);

            expect(result.status).to.equal('RETRIEVED_TOKEN');
            expect(result.auth_token).to.equal('now-linked');
        });

        it('rejects when plex.tv does not know the PIN', async () => {
            stub.install(() => ({
                status: 404,
                body: { errors: [{ code: 1020, message: 'Code not found or expired' }] },
            }));

            const err = await rejection(new PlexPinAuth(IDENTITY).getToken(4711));

            expect(err).to.be.an.instanceOf(Error);
            expect(err.response.status).to.equal(404);
        });

        it('rejects when plex.tv cannot be reached, and succeeds on the next attempt', async () => {
            useClock();
            let fail = true;
            stub.install(() => {
                if (fail) {
                    throw transportError('ETIMEDOUT', 'connect ETIMEDOUT');
                }
                return linked(4711);
            });
            const auth = new PlexPinAuth(IDENTITY);

            const err = await rejection(auth.getToken(4711));
            expect(err.code).to.equal('ETIMEDOUT');

            fail = false;
            expect((await auth.getToken(4711)).status).to.equal('RETRIEVED_TOKEN');
        });
    });
});
