import { expect } from 'chai';
import { afterEach, describe, it } from 'mocha';
import * as http from 'node:http';
import * as net from 'node:net';
import type { Duplex } from 'node:stream';
import { WebSocketServer, type WebSocket as ServerSocket } from 'ws';

import { PlexNotifications, type PlexNotificationsOptions } from '../../src/lib/plexNotifications';

const IDLE_MS = 30 * 60_000;

interface ManualTimer {
    cb: () => void;
    ms: number;
    state: 'pending' | 'cleared' | 'fired';
}

/**
 * Stand-in for `adapter.setTimeout` / `adapter.clearTimeout`: timers never fire on their own,
 * the test decides when "time has passed". No test has to wait for a real reconnect or idle delay.
 */
class ManualTimers {
    public all: ManualTimer[] = [];

    setTimeout = (cb: () => void, ms: number): ioBroker.Timeout => {
        const timer: ManualTimer = { cb, ms, state: 'pending' };
        this.all.push(timer);
        return timer as unknown as ioBroker.Timeout;
    };

    clearTimeout = (handle: ioBroker.Timeout | undefined): void => {
        const timer = handle as unknown as ManualTimer | undefined;
        if (timer && timer.state === 'pending') {
            timer.state = 'cleared';
        }
    };

    pending(): ManualTimer[] {
        return this.all.filter(t => t.state === 'pending');
    }

    /** Delays of all pending timers. */
    pendingDelays(): number[] {
        return this.pending().map(t => t.ms);
    }

    /** Let the single pending timer elapse. */
    fireOnly(): void {
        const pending = this.pending();
        if (pending.length !== 1) {
            throw new Error(`expected exactly one pending timer, got delays [${this.pendingDelays().join(', ')}]`);
        }
        pending[0].state = 'fired';
        pending[0].cb();
    }
}

interface Upgrade {
    url: string;
    headers: http.IncomingHttpHeaders;
}

/** Local stand-in for the Plex Media Server notification endpoint. */
class FakePms {
    public port = 0;
    /** Every connection attempt that reached the server. */
    public upgrades: Upgrade[] = [];
    /** Established WebSocket connections, in order. */
    public sockets: ServerSocket[] = [];
    public closedSockets = 0;
    /** When false, the handshake is cut off, i.e. the connection attempt fails. */
    public accept = true;

    private readonly httpServer = http.createServer();
    private readonly wss = new WebSocketServer({ noServer: true });
    private readonly rawSockets = new Set<Duplex>();

    async start(): Promise<void> {
        this.httpServer.on('upgrade', (req, socket, head) => {
            this.upgrades.push({ url: req.url ?? '', headers: req.headers });
            this.rawSockets.add(socket);
            socket.on('close', () => this.rawSockets.delete(socket));
            socket.on('error', () => {});
            if (!this.accept) {
                socket.destroy();
                return;
            }
            this.wss.handleUpgrade(req, socket, head, ws => {
                this.sockets.push(ws);
                ws.on('close', () => this.closedSockets++);
                ws.on('error', () => {});
            });
        });
        await new Promise<void>(resolve => this.httpServer.listen(0, '127.0.0.1', resolve));
        this.port = (this.httpServer.address() as net.AddressInfo).port;
    }

    get last(): ServerSocket {
        return this.sockets[this.sockets.length - 1];
    }

    send(container: Record<string, unknown>): void {
        this.last.send(JSON.stringify({ NotificationContainer: container }));
    }

    async stop(): Promise<void> {
        for (const socket of this.rawSockets) {
            socket.destroy();
        }
        await new Promise<void>(resolve => this.httpServer.close(() => resolve()));
    }
}

/** TCP server that accepts connections but never answers, so a handshake never completes. */
class SilentServer {
    public port = 0;
    public sockets: net.Socket[] = [];
    public closed = 0;
    public firstBytes: number[] = [];
    private readonly server = net.createServer(socket => {
        this.sockets.push(socket);
        socket.once('data', (data: Buffer) => this.firstBytes.push(data[0]));
        socket.on('close', () => this.closed++);
        socket.on('error', () => {});
    });

    async start(): Promise<void> {
        await new Promise<void>(resolve => this.server.listen(0, '127.0.0.1', resolve));
        this.port = (this.server.address() as net.AddressInfo).port;
    }

    async stop(): Promise<void> {
        for (const socket of this.sockets) {
            socket.destroy();
        }
        await new Promise<void>(resolve => this.server.close(() => resolve()));
    }
}

async function waitFor(condition: () => boolean, what: string, timeoutMs = 3000): Promise<void> {
    const start = Date.now();
    while (!condition()) {
        if (Date.now() - start > timeoutMs) {
            throw new Error(`timed out waiting for ${what}`);
        }
        await new Promise<void>(resolve => setTimeout(resolve, 2));
    }
}

/** Give already-triggered socket and nextTick callbacks the chance to run. */
async function settle(): Promise<void> {
    for (let i = 0; i < 5; i++) {
        await new Promise<void>(resolve => setImmediate(resolve));
    }
    await new Promise<void>(resolve => setTimeout(resolve, 20));
}

/**
 * Runs `fn` and returns every exception that would have crashed the process meanwhile
 * (mocha's own handler is suspended for that time so the test can assert on them itself).
 *
 * @param fn - code under observation
 */
async function uncaughtExceptionsDuring(fn: () => Promise<void>): Promise<Error[]> {
    const suspended = process.listeners('uncaughtException');
    process.removeAllListeners('uncaughtException');
    const caught: Error[] = [];
    const capture = (err: Error): void => void caught.push(err);
    process.on('uncaughtException', capture);
    try {
        await fn();
    } finally {
        process.removeListener('uncaughtException', capture);
        for (const listener of suspended) {
            process.on('uncaughtException', listener);
        }
    }
    return caught;
}

describe('PlexNotifications', () => {
    let pms: FakePms | undefined;
    let silent: SilentServer | undefined;
    let client: PlexNotifications | undefined;
    let timers: ManualTimers;
    let logs: Array<{ level: string; msg: string }>;

    function createClient(port: number, overrides: Partial<PlexNotificationsOptions> = {}): PlexNotifications {
        timers = new ManualTimers();
        logs = [];
        const log = (level: string) => (msg: string) => void logs.push({ level, msg });
        client = new PlexNotifications({
            hostname: '127.0.0.1',
            port,
            https: false,
            token: 'TOKEN-1',
            log: { debug: log('debug'), info: log('info'), warn: log('warn'), error: log('error') },
            setTimeout: timers.setTimeout,
            clearTimeout: timers.clearTimeout,
            ...overrides,
        });
        return client;
    }

    async function startPms(accept = true): Promise<FakePms> {
        pms = new FakePms();
        pms.accept = accept;
        await pms.start();
        return pms;
    }

    /** Client connected to a fresh fake PMS, with the idle timer already armed. */
    async function connected(): Promise<{ server: FakePms; notifications: PlexNotifications }> {
        const server = await startPms();
        const notifications = createClient(server.port);
        notifications.start();
        await waitFor(() => server.sockets.length === 1 && timers.pending().length === 1, 'the connection');
        return { server, notifications };
    }

    afterEach(async () => {
        client?.stop();
        client = undefined;
        await pms?.stop();
        pms = undefined;
        await silent?.stop();
        silent = undefined;
    });

    describe('connecting', () => {
        it('opens the notification endpoint of the server, authenticated by query and header', async () => {
            const server = await startPms();

            createClient(server.port).start();
            await waitFor(() => server.upgrades.length === 1, 'the connection attempt');

            expect(server.upgrades[0].url).to.equal('/:/websockets/notifications?X-Plex-Token=TOKEN-1');
            expect(server.upgrades[0].headers['x-plex-token']).to.equal('TOKEN-1');
        });

        it('sends the additional identity headers with the handshake', async () => {
            const server = await startPms();

            createClient(server.port, {
                headers: { 'X-Plex-Client-Identifier': 'client-id-1', 'X-Plex-Device-Name': 'ioBroker' },
            }).start();
            await waitFor(() => server.upgrades.length === 1, 'the connection attempt');

            expect(server.upgrades[0].headers).to.include({
                'x-plex-client-identifier': 'client-id-1',
                'x-plex-device-name': 'ioBroker',
                'x-plex-token': 'TOKEN-1',
            });
        });

        it('encodes special characters of the token in the URL', async () => {
            const server = await startPms();

            createClient(server.port, { token: 'a b&c/d=e' }).start();
            await waitFor(() => server.upgrades.length === 1, 'the connection attempt');

            const query = new URL(server.upgrades[0].url, 'http://localhost').searchParams;
            expect([...query.keys()]).to.deep.equal(['X-Plex-Token']);
            expect(query.get('X-Plex-Token')).to.equal('a b&c/d=e');
        });

        it('does not write the token into the log', async () => {
            await connected();

            expect(logs.map(l => l.msg).join('\n')).to.not.contain('TOKEN-1');
            expect(logs.map(l => l.msg).join('\n')).to.contain('/:/websockets/notifications');
        });

        it('speaks plain WebSocket without https and TLS with https', async () => {
            silent = new SilentServer();
            await silent.start();
            const server = silent;

            createClient(server.port).start();
            await waitFor(() => server.firstBytes.length === 1, 'the plain handshake');
            client?.stop();
            createClient(server.port, { https: true }).start();
            await waitFor(() => server.firstBytes.length === 2, 'the TLS handshake');

            expect(String.fromCharCode(server.firstBytes[0]), 'plain: HTTP request line').to.equal('G');
            expect(server.firstBytes[1], 'https: TLS handshake record').to.equal(0x16);
        });
    });

    describe('frames', () => {
        it('hands a "playing" notification to the handler as type and session list', async () => {
            const { server, notifications } = await connected();
            const events: Array<{ type: string; payload: any }> = [];
            notifications.setHandler(event => events.push(event));
            const sessions = [{ sessionKey: '7', ratingKey: '123', state: 'paused', viewOffset: 61_000 }];

            server.send({ type: 'playing', size: 1, PlaySessionStateNotification: sessions });
            await waitFor(() => events.length === 1, 'the event');

            expect(events).to.deep.equal([{ type: 'playing', payload: sessions }]);
        });

        it('unwraps the type-specific part of every known notification type', async () => {
            const { server, notifications } = await connected();
            const events: Array<{ type: string; payload: any }> = [];
            notifications.setHandler(event => events.push(event));
            const frames: Array<[string, string]> = [
                ['activity', 'ActivityNotification'],
                ['progress', 'ProgressNotification'],
                ['transcodeSession.start', 'TranscodeSession'],
                ['transcodeSession.update', 'TranscodeSession'],
                ['transcodeSession.end', 'TranscodeSession'],
                ['status', 'StatusNotification'],
                ['library.update', 'LibraryUpdateNotification'],
                ['timeline', 'TimelineEntry'],
            ];

            for (const [type, key] of frames) {
                server.send({ type, size: 1, [key]: [{ marker: type }] });
            }
            await waitFor(() => events.length === frames.length, 'all events');

            expect(events).to.deep.equal(frames.map(([type]) => ({ type, payload: [{ marker: type }] })));
        });

        it('hands the whole container of an unknown notification type to the handler', async () => {
            const { server, notifications } = await connected();
            const events: Array<{ type: string; payload: any }> = [];
            notifications.setHandler(event => events.push(event));

            server.send({ type: 'something.new', size: 1, Whatever: [{ a: 1 }] });
            await waitFor(() => events.length === 1, 'the event');

            expect(events).to.deep.equal([
                { type: 'something.new', payload: { type: 'something.new', size: 1, Whatever: [{ a: 1 }] } },
            ]);
        });

        it('accepts a notification that arrives as binary frame', async () => {
            const { server, notifications } = await connected();
            const events: Array<{ type: string; payload: any }> = [];
            notifications.setHandler(event => events.push(event));

            server.last.send(
                Buffer.from(JSON.stringify({ NotificationContainer: { type: 'status', StatusNotification: [] } })),
                {
                    binary: true,
                },
            );
            await waitFor(() => events.length === 1, 'the event');

            expect(events).to.deep.equal([{ type: 'status', payload: [] }]);
        });

        it('ignores frames that are not a notification and keeps working afterwards', async () => {
            const { server, notifications } = await connected();
            const events: Array<{ type: string; payload: any }> = [];
            notifications.setHandler(event => events.push(event));

            server.last.send('this is not JSON');
            server.last.send(JSON.stringify({ somethingElse: true }));
            server.last.send(JSON.stringify({ NotificationContainer: { size: 1 } }));
            server.last.send(JSON.stringify(null));
            server.send({ type: 'status', StatusNotification: [{ title: 'ok' }] });
            await waitFor(() => events.length === 1, 'the valid event');

            expect(events).to.deep.equal([{ type: 'status', payload: [{ title: 'ok' }] }]);
            expect(server.closedSockets, 'connection stays open').to.equal(0);
        });

        it('survives a throwing handler: logs a warning and delivers the next notification', async () => {
            const { server, notifications } = await connected();
            const delivered: string[] = [];
            notifications.setHandler(event => {
                delivered.push(event.type);
                if (event.type === 'playing') {
                    throw new Error('handler exploded');
                }
            });

            server.send({ type: 'playing', PlaySessionStateNotification: [] });
            server.send({ type: 'status', StatusNotification: [] });
            await waitFor(() => delivered.length === 2, 'both events');

            expect(delivered).to.deep.equal(['playing', 'status']);
            const warnings = logs.filter(l => l.level === 'warn').map(l => l.msg);
            expect(warnings).to.have.length(1);
            expect(warnings[0]).to.contain('handler exploded');
            expect(server.closedSockets, 'connection stays open').to.equal(0);
        });

        it('works without a handler', async () => {
            const { server } = await connected();
            const idleTimer = timers.pending()[0];

            server.send({ type: 'playing', PlaySessionStateNotification: [] });
            await waitFor(() => idleTimer.state === 'cleared', 'the frame to be processed');

            expect(logs.filter(l => l.level === 'warn' || l.level === 'error')).to.deep.equal([]);
        });
    });

    describe('idle timeout', () => {
        it('starts a 30 minute idle timer when the connection is established', async () => {
            await connected();

            expect(timers.pendingDelays()).to.deep.equal([IDLE_MS]);
        });

        it('restarts the idle timer with every frame, whatever its content', async () => {
            const { server } = await connected();

            for (const frame of ['not JSON', JSON.stringify({ NotificationContainer: { type: 'status' } })]) {
                const before = timers.pending()[0];
                server.last.send(frame);
                await waitFor(() => before.state === 'cleared', 'the idle timer to be replaced');

                expect(timers.pendingDelays()).to.deep.equal([IDLE_MS]);
                expect(timers.pending()[0]).to.not.equal(before);
            }
        });

        it('drops a silent connection when the idle timer elapses and schedules a reconnect', async () => {
            const { server } = await connected();

            timers.fireOnly();
            await waitFor(() => server.closedSockets === 1, 'the connection to be dropped');
            await waitFor(() => timers.pending().length === 1, 'the reconnect timer');

            expect(timers.pendingDelays()).to.deep.equal([1000]);
        });

        it('reconnects after the idle drop and watches the new connection again', async () => {
            const { server } = await connected();
            timers.fireOnly();
            await waitFor(() => timers.pendingDelays().join() === '1000', 'the reconnect timer');

            timers.fireOnly();
            await waitFor(() => server.sockets.length === 2 && timers.pending().length === 1, 'the new connection');

            expect(timers.pendingDelays()).to.deep.equal([IDLE_MS]);
        });
    });

    describe('reconnect', () => {
        async function failOnce(server: FakePms, attempt: number): Promise<number> {
            await waitFor(
                () => server.upgrades.length === attempt && timers.pending().length === 1,
                `attempt ${attempt}`,
            );
            const [delay] = timers.pendingDelays();
            return delay;
        }

        it('retries failed connections after 1, 2, 5, 15 and then every 30 seconds', async () => {
            const server = await startPms(false);
            createClient(server.port).start();
            const delays: number[] = [];

            for (let attempt = 1; attempt <= 8; attempt++) {
                delays.push(await failOnce(server, attempt));
                await settle();
                expect(timers.pending(), `exactly one retry scheduled after attempt ${attempt}`).to.have.length(1);
                timers.fireOnly();
            }

            expect(delays).to.deep.equal([1000, 2000, 5000, 15_000, 30_000, 30_000, 30_000, 30_000]);
        });

        it('starts over with the shortest delay after a successful connection', async () => {
            const server = await startPms(false);
            createClient(server.port).start();
            expect(await failOnce(server, 1)).to.equal(1000);
            timers.fireOnly();
            expect(await failOnce(server, 2)).to.equal(2000);
            timers.fireOnly();
            expect(await failOnce(server, 3)).to.equal(5000);

            server.accept = true;
            timers.fireOnly();
            await waitFor(() => server.sockets.length === 1 && timers.pending().length === 1, 'the connection');
            expect(timers.pendingDelays()).to.deep.equal([IDLE_MS]);

            server.accept = false;
            server.last.close();
            await waitFor(() => timers.pendingDelays().join() === '1000', 'the reconnect timer');
            timers.fireOnly();
            expect(await failOnce(server, 5)).to.equal(2000);
        });

        it('reconnects when the server closes an established connection', async () => {
            const { server } = await connected();

            server.last.close(1001, 'server restart');
            await waitFor(() => timers.pendingDelays().join() === '1000', 'the reconnect timer');
            timers.fireOnly();
            await waitFor(() => server.sockets.length === 2, 'the second connection');

            expect(server.upgrades).to.have.length(2);
            expect(server.upgrades[1].url).to.equal(server.upgrades[0].url);
        });

        it('cancels the idle timer of a connection that was closed by the server', async () => {
            const { server } = await connected();
            const idleTimer = timers.pending()[0];

            server.last.close();
            await waitFor(() => timers.pendingDelays().join() === '1000', 'the reconnect timer');

            expect(idleTimer.state).to.equal('cleared');
        });

        it('delivers notifications again after a reconnect', async () => {
            const { server, notifications } = await connected();
            const events: string[] = [];
            notifications.setHandler(event => events.push(event.type));
            server.last.close();
            await waitFor(() => timers.pendingDelays().join() === '1000', 'the reconnect timer');
            timers.fireOnly();
            await waitFor(() => server.sockets.length === 2 && timers.pending().length === 1, 'the second connection');

            server.send({ type: 'playing', PlaySessionStateNotification: [] });
            await waitFor(() => events.length === 1, 'the event');

            expect(events).to.deep.equal(['playing']);
        });
    });

    describe('stop', () => {
        it('closes the connection and leaves no timer behind', async () => {
            const { server, notifications } = await connected();

            notifications.stop();
            await waitFor(() => server.closedSockets === 1, 'the server to see the close');
            await settle();

            expect(timers.pending(), 'no idle and no reconnect timer').to.deep.equal([]);
            expect(server.upgrades, 'no new connection').to.have.length(1);
        });

        it('cancels a scheduled reconnect', async () => {
            const server = await startPms(false);
            const notifications = createClient(server.port);
            notifications.start();
            await waitFor(() => timers.pending().length === 1, 'the reconnect timer');
            const reconnect = timers.pending()[0];

            notifications.stop();
            await settle();

            expect(reconnect.state).to.equal('cleared');
            expect(timers.pending()).to.deep.equal([]);
            expect(server.upgrades).to.have.length(1);
        });

        it('does not reconnect even if a reconnect timer still fires after stop', async () => {
            const server = await startPms(false);
            const notifications = createClient(server.port);
            notifications.start();
            await waitFor(() => timers.pending().length === 1, 'the reconnect timer');
            const reconnect = timers.pending()[0];
            notifications.stop();

            reconnect.cb();
            await settle();

            expect(server.upgrades, 'no further connection attempt').to.have.length(1);
            expect(timers.pending()).to.deep.equal([]);
        });

        it('no longer delivers notifications after stop', async () => {
            const { server, notifications } = await connected();
            const events: string[] = [];
            notifications.setHandler(event => events.push(event.type));

            notifications.stop();
            if (server.last.readyState === server.last.OPEN) {
                server.send({ type: 'playing', PlaySessionStateNotification: [] });
            }
            await settle();

            expect(events).to.deep.equal([]);
        });

        it('can be called before start and repeatedly', async () => {
            const server = await startPms();
            const notifications = createClient(server.port);

            expect(() => {
                notifications.stop();
                notifications.stop();
            }).to.not.throw();
            notifications.start();
            await waitFor(() => server.sockets.length === 1, 'the connection');
            expect(() => {
                notifications.stop();
                notifications.stop();
            }).to.not.throw();
        });

        it('can be started again after stop', async () => {
            const { server, notifications } = await connected();
            notifications.stop();
            await waitFor(() => server.closedSockets === 1, 'the server to see the close');

            notifications.start();
            await waitFor(() => server.sockets.length === 2 && timers.pending().length === 1, 'the new connection');

            expect(timers.pendingDelays()).to.deep.equal([IDLE_MS]);
        });

        // Regression: closing a socket whose handshake has not finished makes `ws` emit an "error"
        // on the next tick. Without a listener that was an uncaught exception
        // ("WebSocket was closed before the connection was established").
        it('does not crash and schedules nothing when stopped right after start (still connecting)', async () => {
            silent = new SilentServer();
            await silent.start();
            const notifications = createClient(silent.port);

            const uncaught = await uncaughtExceptionsDuring(async () => {
                notifications.start();
                notifications.stop();
                await settle();
            });

            expect(uncaught.map(e => e.message)).to.deep.equal([]);
            expect(timers.pending(), 'no reconnect timer').to.deep.equal([]);
            expect(timers.all, 'no timer was ever scheduled').to.deep.equal([]);
        });

        it('does not crash and schedules nothing when stopped while the handshake is pending', async () => {
            silent = new SilentServer();
            await silent.start();
            const server = silent;
            const notifications = createClient(server.port);

            const uncaught = await uncaughtExceptionsDuring(async () => {
                notifications.start();
                // The TCP connection is up and the upgrade request sent, but the server stays silent.
                await waitFor(() => server.firstBytes.length === 1, 'the handshake request');
                notifications.stop();
                await waitFor(() => server.closed === 1, 'the client to drop the connection');
                await settle();
            });

            expect(uncaught.map(e => e.message)).to.deep.equal([]);
            expect(timers.pending(), 'no reconnect timer').to.deep.equal([]);
            expect(timers.all, 'no timer was ever scheduled').to.deep.equal([]);
            expect(server.sockets, 'no further connection attempt').to.have.length(1);
        });
    });
});
