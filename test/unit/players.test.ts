import { expect } from 'chai';
import { describe, it } from 'mocha';
import * as fs from 'node:fs';
import * as path from 'node:path';

import { Library } from '../../src/lib/library';
import { Controller, parsePlayerChannelId, type Player } from '../../src/lib/players';
import type { PlexHttp, PlexQueryOptions } from '../../src/lib/plexHttp';
import { asAdapter, FakeAdapter, flush } from './helpers/fakeAdapter';

function readJson(name: string): any {
    return JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', name), 'utf8'));
}

// The definition files the adapter itself hands to Library and Controller.
const NODES = readJson('_NODES.json');
const ACTIONS = readJson('_ACTIONS.json');
const PLAYERDETAILS = readJson('_PLAYERDETAILS.json');

interface Setup {
    adapter: FakeAdapter;
    library: Library;
    controller: Controller;
    /** Requests sent to the Plex server. */
    queries: Array<{ path: string; opts: PlexQueryOptions | undefined }>;
    /** Decides what the Plex server answers; may throw. */
    answer: { fn: (path: string) => unknown };
}

async function setup(config: Record<string, any> = {}): Promise<Setup> {
    const adapter = new FakeAdapter();
    Object.assign(adapter.config, config);
    const library = new Library(asAdapter(adapter), {
        nodes: JSON.parse(JSON.stringify(NODES)),
        actions: JSON.parse(JSON.stringify(ACTIONS)),
    });
    const queries: Setup['queries'] = [];
    const answer: Setup['answer'] = { fn: () => ({}) };
    const plex = {
        query: async (p: string, opts?: PlexQueryOptions): Promise<unknown> => {
            queries.push({ path: p, opts });
            return answer.fn(p);
        },
    } as unknown as PlexHttp;
    const controller = new Controller(
        asAdapter(adapter),
        {
            controllerIdentifier: 'controller-id-1',
            plexToken: 'SECRET-TOKEN',
            plex,
            actions: JSON.parse(JSON.stringify(ACTIONS)),
            nodes: NODES,
            playerdetails: JSON.parse(JSON.stringify(PLAYERDETAILS)),
        },
        library,
    );
    controller.setServerId('server-uuid-1');
    await flush();
    adapter.resetRecords();
    return { adapter, library, controller, queries, answer };
}

const TV = { title: 'Wohnzimmer TV', uuid: 'abc-123' };
const TV_PREFIX = '_playing.wohnzimmer tv-abc-123';

/**
 * A player as the adapter has it after discovery reported it.
 *
 * @param s - test setup
 * @param discovery - what discovery knows: where the player was found and what it provides
 * @param discovery.sources - discovery sources
 * @param discovery.provides - the Plex "provides" declaration
 * @param discovery.protocolCapabilities - capabilities the controls are derived from
 */
async function discovered(
    s: Setup,
    discovery: { sources: string[]; provides: string; protocolCapabilities?: string },
): Promise<Player> {
    const player = s.controller.createPlayerIfNotExist({ config: { ...TV } });
    player.setClientData({
        title: TV.title,
        machineIdentifier: TV.uuid,
        protocolCapabilities: discovery.protocolCapabilities ?? 'timeline,playback,navigation',
        _sources: discovery.sources,
        _provides: discovery.provides,
    });
    await flush();
    return player;
}

/**
 * A player that accepts HTTP commands (found via /clients).
 *
 * @param s - test setup
 */
async function controllable(s: Setup): Promise<Player> {
    return discovered(s, { sources: ['/clients'], provides: 'player' });
}

describe('Controller', () => {
    describe('createPlayerIfNotExist', () => {
        it('names the player channel after the lower-cased title and the uuid', async () => {
            const s = await setup();

            const player = s.controller.createPlayerIfNotExist({ config: { ...TV } });

            expect(player.prefix).to.equal(TV_PREFIX);
        });

        it('replaces characters that are not allowed in ids', async () => {
            const s = await setup();

            const player = s.controller.createPlayerIfNotExist({ config: { title: "Tim's iPhone [2]", uuid: 'ID-9' } });

            expect(player.prefix).to.equal('_playing.tim#s iphone #2#-ID-9');
        });

        it('creates the channels for the player list and the player', async () => {
            const s = await setup();

            s.controller.createPlayerIfNotExist({ config: { ...TV } });
            await flush();

            expect(s.adapter.objectsFor('_playing')[0].type).to.equal('channel');
            expect(s.adapter.objectsFor(TV_PREFIX)[0].type).to.equal('channel');
            expect(s.adapter.objectsFor(TV_PREFIX)[0].common.name).to.equal('Player Wohnzimmer TV');
        });

        it('returns the existing player for the same title and uuid', async () => {
            const s = await setup();

            const first = s.controller.createPlayerIfNotExist({ config: { ...TV } });
            const second = s.controller.createPlayerIfNotExist({ config: { ...TV } });
            const differentCase = s.controller.createPlayerIfNotExist({
                config: { title: 'WOHNZIMMER tv', uuid: 'abc-123' },
            });

            expect(second).to.equal(first);
            expect(differentCase).to.equal(first);
            expect(s.controller.players).to.have.length(1);
        });

        it('keeps players with the same title but different uuid apart', async () => {
            const s = await setup();

            const first = s.controller.createPlayerIfNotExist({ config: { ...TV } });
            const second = s.controller.createPlayerIfNotExist({ config: { title: TV.title, uuid: 'other-456' } });

            expect(second).to.not.equal(first);
            expect(s.controller.players).to.have.length(2);
        });

        it('refuses to create a player without title or uuid', async () => {
            const s = await setup();

            expect(() => s.controller.createPlayerIfNotExist({ config: { title: '', uuid: 'abc-123' } })).to.throw();
            expect(() => s.controller.createPlayerIfNotExist({ config: { title: 'TV', uuid: '' } })).to.throw();
            expect(s.controller.players).to.deep.equal([]);
        });
    });

    describe('existPlayer', () => {
        it('finds a player by its prefix regardless of case, and returns null otherwise', async () => {
            const s = await setup();
            const player = s.controller.createPlayerIfNotExist({ config: { ...TV } });

            expect(s.controller.existPlayer(TV_PREFIX)).to.equal(player);
            expect(s.controller.existPlayer(TV_PREFIX.toUpperCase())).to.equal(player);
            expect(s.controller.existPlayer('_playing.unknown-1')).to.equal(null);
            expect(s.controller.existPlayer()).to.equal(null);
        });
    });
});

describe('parsePlayerChannelId', () => {
    const ROOT = 'plex.0._playing.';
    const marker = (uuid: string): Record<string, unknown> => ({
        isPlayer: true,
        uuid,
        lastSeenAt: '2026-01-01T00:00:00.000Z',
    });

    it('splits the id of a player channel into title and uuid', () => {
        expect(parsePlayerChannelId(`${ROOT}wohnzimmer tv-abc-123`, ROOT, marker('abc-123'))).to.deep.equal({
            title: 'wohnzimmer tv',
            uuid: 'abc-123',
        });
    });

    // #618: "MagentaTV One (2. Generation)" - the dot in the title adds a level to the object id.
    it('accepts a title with dots, although the id then has more than one level', () => {
        const id = `${ROOT}magentatv one (2. generation)-0123456789abcdef`;

        expect(parsePlayerChannelId(id, ROOT, marker('0123456789abcdef'))).to.deep.equal({
            title: 'magentatv one (2. generation)',
            uuid: '0123456789abcdef',
        });
    });

    it('accepts dots and dashes in the uuid and dashes in the title', () => {
        expect(parsePlayerChannelId(`${ROOT}tv-a-b-c.d-e.f`, ROOT, marker('c.d-e.f'))).to.deep.equal({
            title: 'tv-a-b',
            uuid: 'c.d-e.f',
        });
        expect(parsePlayerChannelId(`${ROOT}192.168.178.50-uuid1`, ROOT, marker('uuid1'))).to.deep.equal({
            title: '192.168.178.50',
            uuid: 'uuid1',
        });
    });

    it('works with ids relative to the adapter namespace as well', () => {
        expect(parsePlayerChannelId('_playing.tv-uuid1', '_playing.', marker('uuid1'))).to.deep.equal({
            title: 'tv',
            uuid: 'uuid1',
        });
    });

    it('does not depend on the object type (typeless objects of #618 are recognized too)', () => {
        const typeless = { native: marker('uuid1') };

        expect(parsePlayerChannelId(`${ROOT}tv-uuid1`, ROOT, typeless.native)).to.deep.equal({
            title: 'tv',
            uuid: 'uuid1',
        });
    });

    it('rejects objects without the player marker or without uuid', () => {
        const id = `${ROOT}tv-uuid1`;

        expect(parsePlayerChannelId(id, ROOT, undefined)).to.equal(undefined);
        expect(parsePlayerChannelId(id, ROOT, null)).to.equal(undefined);
        expect(parsePlayerChannelId(id, ROOT, {})).to.equal(undefined);
        expect(parsePlayerChannelId(id, ROOT, { uuid: 'uuid1' })).to.equal(undefined);
        expect(parsePlayerChannelId(id, ROOT, { isPlayer: 'true', uuid: 'uuid1' })).to.equal(undefined);
        expect(parsePlayerChannelId(id, ROOT, { isPlayer: true })).to.equal(undefined);
        expect(parsePlayerChannelId(id, ROOT, { isPlayer: true, uuid: '' })).to.equal(undefined);
        expect(parsePlayerChannelId(id, ROOT, { isPlayer: true, uuid: 5 })).to.equal(undefined);
        expect(parsePlayerChannelId(id, ROOT, 'isPlayer')).to.equal(undefined);
    });

    it('rejects ids that do not end with "-<uuid>" of the marker', () => {
        expect(parsePlayerChannelId(`${ROOT}tv-uuid1.Metadata`, ROOT, marker('uuid1'))).to.equal(undefined);
        expect(parsePlayerChannelId(`${ROOT}tv-uuid2`, ROOT, marker('uuid1'))).to.equal(undefined);
        expect(parsePlayerChannelId(`${ROOT}tvuuid1`, ROOT, marker('uuid1'))).to.equal(undefined);
        expect(parsePlayerChannelId(`${ROOT}-uuid1`, ROOT, marker('uuid1')), 'empty title').to.equal(undefined);
    });

    it('rejects ids outside the player root', () => {
        expect(parsePlayerChannelId('plex.0.events.tv-uuid1', ROOT, marker('uuid1'))).to.equal(undefined);
        expect(parsePlayerChannelId('plex.1._playing.tv-uuid1', ROOT, marker('uuid1'))).to.equal(undefined);
        expect(parsePlayerChannelId('plex.0._playing', ROOT, marker('uuid1'))).to.equal(undefined);
        expect(parsePlayerChannelId(undefined as unknown as string, ROOT, marker('uuid1'))).to.equal(undefined);
    });

    describe('applied to an object tree', () => {
        // What the adapter finds in its object tree: two players (one of them with dots in the
        // title), their children, the "_recent" channel and a player object that lost its type.
        const DOTTED = `${ROOT}magentatv one (2. generation)-uuid2`;
        const tree: Record<
            string,
            { type?: string; common?: Record<string, unknown>; native?: Record<string, unknown> }
        > = {
            'plex.0._playing': { type: 'channel', native: {} },
            [`${ROOT}players`]: { type: 'state', native: {} },
            [`${ROOT}_recent-player`]: { type: 'channel', native: {} },
            [`${ROOT}_recent-player.Metadata`]: { type: 'channel', native: {} },
            [`${ROOT}wohnzimmer tv-uuid1`]: {
                type: 'channel',
                common: { name: 'Player Wohnzimmer TV' },
                native: marker('uuid1'),
            },
            [`${ROOT}wohnzimmer tv-uuid1.Player`]: { type: 'channel', native: {} },
            [`${ROOT}wohnzimmer tv-uuid1.Player.title`]: { type: 'state', native: {} },
            [DOTTED]: {
                type: 'channel',
                common: { name: 'Player MagentaTV One (2. Generation)' },
                native: marker('uuid2'),
            },
            [`${DOTTED}.Player`]: { type: 'channel', native: {} },
            [`${DOTTED}.Metadata.title`]: { type: 'state', native: {} },
            [`${DOTTED}._Controls.playback.play`]: { type: 'state', native: {} },
            [`${ROOT}kueche (1. og)-uuid3`]: { native: marker('uuid3') },
            'plex.0.events.tv-uuid1': { type: 'channel', native: marker('uuid1') },
        };

        /** Player channels as the admin cleanup list selects them: typed channels with marker. */
        const listed = (): string[] =>
            Object.keys(tree).filter(
                id => tree[id].type === 'channel' && !!parsePlayerChannelId(id, ROOT, tree[id].native),
            );

        it('finds exactly the player channels, including the one with dots in the title', () => {
            expect(listed()).to.deep.equal([`${ROOT}wohnzimmer tv-uuid1`, DOTTED]);
        });

        it('finds the typeless player object that needs a repair, with the title for its name', () => {
            const typeless = Object.keys(tree).filter(
                id => !tree[id].type && !!parsePlayerChannelId(id, ROOT, tree[id].native),
            );

            expect(typeless).to.deep.equal([`${ROOT}kueche (1. og)-uuid3`]);
            expect(parsePlayerChannelId(typeless[0], ROOT, tree[typeless[0]].native)?.title).to.equal('kueche (1. og)');
        });

        it('accepts none of the children of a player for deletion', () => {
            const children = Object.keys(tree).filter(
                id => id.startsWith(`${DOTTED}.`) || id.startsWith(`${ROOT}wohnzimmer tv-uuid1.`),
            );

            expect(children).to.have.length(5);
            expect(children.filter(id => !!parsePlayerChannelId(id, ROOT, tree[id].native))).to.deep.equal([]);
        });

        it('would have missed the dotted player with the former "no dot after _playing." rule', () => {
            const formerRule = listed().filter(id => !id.slice(ROOT.length).includes('.'));

            expect(formerRule).to.deep.equal([`${ROOT}wohnzimmer tv-uuid1`]);
        });
    });
});

describe('Player with dots in the title (#618)', () => {
    const DOTTED = { title: 'MagentaTV One (2. Generation)', uuid: 'uuid-618' };
    const DOTTED_PREFIX = '_playing.magentatv one (2. generation)-uuid-618';

    async function dottedPlayer(s: Setup): Promise<Player> {
        const player = s.controller.createPlayerIfNotExist({ config: { ...DOTTED } });
        player.setClientData({
            title: DOTTED.title,
            machineIdentifier: DOTTED.uuid,
            protocolCapabilities: 'timeline,playback,navigation',
            _sources: ['/clients'],
            _provides: 'player',
        });
        await flush();
        return player;
    }

    it('keeps the id as it has always been created (the dot stays in the id)', async () => {
        const s = await setup();

        expect(s.controller.createPlayerIfNotExist({ config: { ...DOTTED } }).prefix).to.equal(DOTTED_PREFIX);
    });

    it('is found again by the prefix of one of its control states', async () => {
        const s = await setup();
        const player = await dottedPlayer(s);

        // The way the adapter derives the player from a changed control state: drop the last
        // three id parts (`_Controls.<mode>.<action>`) and look the rest up.
        const parts = `${DOTTED_PREFIX}._Controls.playback.play`.split('.');
        const prefix = parts.slice(0, -3).join('.');

        expect(s.controller.existPlayer(prefix)).to.equal(player);
        expect(parsePlayerChannelId(prefix, '_playing.', { isPlayer: true, uuid: DOTTED.uuid })?.title).to.equal(
            'magentatv one (2. generation)',
        );
    });

    it('gets its player states and controls with the regular definitions', async () => {
        const s = await setup();

        await dottedPlayer(s);

        expect(s.adapter.objectsFor(DOTTED_PREFIX)[0].type).to.equal('channel');
        expect(s.adapter.lastValue(`${DOTTED_PREFIX}.Player.title`)).to.equal(DOTTED.title);
        expect(s.adapter.objectsFor(`${DOTTED_PREFIX}.Player.title`)[0].common.role).to.equal(
            NODES['playing.player.title'].role,
        );
        expect(s.adapter.objectsFor(`${DOTTED_PREFIX}._Controls.playback.play`)[0].common).to.include({
            role: 'button.play',
            type: 'boolean',
        });
        expect(s.adapter.subscriptions).to.include(`${DOTTED_PREFIX}._Controls.playback.*`);
    });

    it('accepts commands and acknowledges the control state', async () => {
        const s = await setup();
        const player = await dottedPlayer(s);
        s.adapter.resetRecords();

        await player.action({ id: `${DOTTED_PREFIX}._Controls`, mode: 'playback', action: 'setVolume', val: 40 });
        await flush();

        expect(s.queries.map(q => new URL(q.path, 'http://pms').pathname)).to.deep.equal([
            '/player/playback/setParameters',
        ]);
        expect(s.queries[0].opts?.headers).to.include({ 'X-Plex-Target-Client-Identifier': DOTTED.uuid });
        expect(s.adapter.lastValue(`${DOTTED_PREFIX}._Controls.playback.setVolume`)).to.equal(40);
    });

    it('restores address and controllability from the cached states of the dotted prefix', async () => {
        const s = await setup();
        s.library.setDeviceState(`${DOTTED_PREFIX}.Player.localAddress`, '10.0.0.9');
        s.library.setDeviceState(`${DOTTED_PREFIX}.Player.port`, 32_500);
        s.library.setDeviceState(`${DOTTED_PREFIX}.Player.controllable`, true);

        const player = s.controller.createPlayerIfNotExist({ config: { ...DOTTED } });

        expect(player.address).to.equal('10.0.0.9');
        expect(player.port).to.equal(32_500);
        expect(player.config.controllable).to.equal(true);
    });
});

describe('Player', () => {
    describe('identity', () => {
        it('addresses its commands to the player and identifies the adapter as controller', async () => {
            const s = await setup();

            const player = s.controller.createPlayerIfNotExist({ config: { ...TV } });

            expect(player.PLEX_HEADERS).to.include({
                'X-Plex-Target-Client-Identifier': 'abc-123',
                'X-Plex-Client-Identifier': 'controller-id-1',
                'X-Plex-Token': 'SECRET-TOKEN',
                'X-Plex-Provides': 'controller',
            });
        });

        it('has a readable id of title and uuid', async () => {
            const s = await setup();

            expect(s.controller.createPlayerIfNotExist({ config: { ...TV } }).getReadableID()).to.equal(
                'Wohnzimmer TV-abc-123',
            );
        });
    });

    describe('isCompanionControllable', () => {
        const cases: Array<{ sources: string[]; provides: string; expected: boolean; label: string }> = [
            { sources: ['/clients'], provides: '', expected: true, label: 'found via /clients' },
            { sources: ['plex.tv/devices', '/clients'], provides: '', expected: true, label: '/clients among others' },
            { sources: ['plex.tv/devices'], provides: 'player', expected: true, label: 'provides player' },
            { sources: ['plex.tv/devices'], provides: 'client,pubsub-player', expected: true, label: 'pubsub-player' },
            { sources: ['plex.tv/devices'], provides: 'client, player ,x', expected: true, label: 'with blanks' },
            { sources: ['plex.tv/devices'], provides: '', expected: false, label: 'provides nothing (mobile app)' },
            { sources: ['/status/sessions'], provides: 'controller', expected: false, label: 'controller only' },
            { sources: [], provides: 'client,server', expected: false, label: 'client and server' },
            { sources: [], provides: 'sync-player-x,players', expected: false, label: 'only similar words' },
        ];

        for (const c of cases) {
            it(`is ${c.expected} for a device ${c.label}`, async () => {
                const s = await setup();
                const player = s.controller.createPlayerIfNotExist({ config: { ...TV } });
                player.sources = c.sources;
                player.provides = c.provides;

                expect(player.isCompanionControllable()).to.equal(c.expected);
            });
        }
    });

    describe('data from discovery (setClientData)', () => {
        it('takes over where the player was found and what it provides', async () => {
            const s = await setup();

            const player = await discovered(s, { sources: ['plex.tv/devices', '/clients'], provides: 'player' });

            expect(player.sources).to.deep.equal(['plex.tv/devices', '/clients']);
            expect(player.provides).to.equal('player');
            expect(player.config.connected).to.equal(true);
        });

        // Regression described in players.ts: Plex only sends "machineIdentifier"; when the config
        // was replaced by the payload the uuid got lost and every command was answered with 404.
        it('keeps the uuid when the payload only carries machineIdentifier', async () => {
            const s = await setup();
            const player = s.controller.createPlayerIfNotExist({ config: { ...TV } });

            player.setClientData({ machineIdentifier: 'abc-123', product: 'Plex for LG' });
            player.setClientData({ product: 'Plex for LG', state: 'playing' });

            expect(player.config.uuid).to.equal('abc-123');
            expect(player.config.title).to.equal('Wohnzimmer TV');
            expect(player.config.product).to.equal('Plex for LG');
        });

        it('takes address and port from the payload and keeps them when a later payload has none', async () => {
            const s = await setup();
            const player = s.controller.createPlayerIfNotExist({ config: { ...TV } });

            player.setClientData({ address: '10.0.0.5', port: 32_500 });
            player.setClientData({ state: 'paused' });

            expect(player.address).to.equal('10.0.0.5');
            expect(player.port).to.equal(32_500);
        });

        it('does not take the loopback address of the server as player address', async () => {
            const s = await setup();
            const player = s.controller.createPlayerIfNotExist({ address: '10.0.0.5', config: { ...TV } });

            player.setClientData({ address: '127.0.0.1' });

            expect(player.address).to.equal('10.0.0.5');
        });

        it('uses "name" as title and the remote public address of a session as public address', async () => {
            const s = await setup();
            const player = s.controller.createPlayerIfNotExist({ config: { ...TV } });

            player.setClientData({ name: 'Renamed TV', remotePublicAddress: '203.0.113.2' });

            expect(player.config.title).to.equal('Renamed TV');
            expect(player.config.publicAddress).to.equal('203.0.113.2');
        });

        // cleanUpConfig() computes "remotePublicAddress || publicAddress || previous value", but the
        // payload is merged into the config afterwards. A `publicAddress` in the payload - also a
        // present but undefined one, as in a promoted plex.tv device without address - used to
        // overwrite the result again.
        it('prefers the remote public address over a public address in the same payload', async () => {
            const s = await setup();
            const player = s.controller.createPlayerIfNotExist({ config: { ...TV } });

            player.setClientData({ publicAddress: '203.0.113.1', remotePublicAddress: '203.0.113.2' });
            await flush();

            expect(player.config.publicAddress).to.equal('203.0.113.2');
            expect(s.adapter.lastValue(`${TV_PREFIX}.Player.publicAddress`)).to.equal('203.0.113.2');
        });

        it('keeps the remote public address when the payload carries an undefined public address', async () => {
            const s = await setup();
            const player = s.controller.createPlayerIfNotExist({ config: { ...TV } });

            player.setClientData({ publicAddress: undefined, remotePublicAddress: '203.0.113.2' });
            await flush();

            expect(player.config.publicAddress).to.equal('203.0.113.2');
            expect(s.adapter.lastValue(`${TV_PREFIX}.Player.publicAddress`)).to.equal('203.0.113.2');
        });

        it('uses the public address of the payload when there is no remote one', async () => {
            const s = await setup();
            const player = s.controller.createPlayerIfNotExist({ config: { ...TV } });

            player.setClientData({ publicAddress: '203.0.113.1' });

            expect(player.config.publicAddress).to.equal('203.0.113.1');
        });

        it('keeps the known public address when a later payload has none', async () => {
            const s = await setup();
            const player = s.controller.createPlayerIfNotExist({ config: { ...TV } });

            player.setClientData({ remotePublicAddress: '203.0.113.2' });
            player.setClientData({ state: 'playing' });

            expect(player.config.publicAddress).to.equal('203.0.113.2');
        });

        it('does not add a public address to a payload that has only a remote one', async () => {
            const s = await setup();
            const player = s.controller.createPlayerIfNotExist({ config: { ...TV } });
            const sessionPlayer: Record<string, unknown> = {
                machineIdentifier: 'abc-123',
                remotePublicAddress: '203.0.113.2',
            };

            player.cleanUpConfig(sessionPlayer);

            expect(sessionPlayer).to.not.have.property('publicAddress');
            expect(player.config.publicAddress).to.equal('203.0.113.2');
        });

        it('writes the player data into states below "Player"', async () => {
            const s = await setup();

            await discovered(s, { sources: ['/clients'], provides: 'player' });

            expect(s.adapter.lastValue(`${TV_PREFIX}.Player.title`)).to.equal('Wohnzimmer TV');
            expect(s.adapter.lastValue(`${TV_PREFIX}.Player.uuid`)).to.equal('abc-123');
            expect(s.adapter.writtenIds(), 'internal discovery fields are not published').to.not.include(
                `${TV_PREFIX}.Player._sources`,
            );
        });
    });

    describe('controls (setControls)', () => {
        it('creates control states for the capabilities of a controllable player', async () => {
            const s = await setup();

            const player = await controllable(s);

            const created = s.adapter.createdIds();
            expect(player.config.controllable).to.equal(true);
            expect(s.adapter.objectsFor(`${TV_PREFIX}._Controls`)[0].type).to.equal('channel');
            expect(s.adapter.objectsFor(`${TV_PREFIX}._Controls.playback`)[0].type).to.equal('channel');
            expect(created).to.include.members([
                `${TV_PREFIX}._Controls.playback.play`,
                `${TV_PREFIX}._Controls.playback.pause`,
                `${TV_PREFIX}._Controls.playback.setVolume`,
                `${TV_PREFIX}._Controls.playback.seekTo`,
                `${TV_PREFIX}._Controls.navigation.moveUp`,
                `${TV_PREFIX}._Controls.timeline.refreshDetails`,
            ]);
            expect(s.adapter.lastValue(`${TV_PREFIX}.Player.controllable`)).to.equal(true);
        });

        it('creates only the controls of the reported capabilities', async () => {
            const s = await setup();

            await discovered(s, { sources: ['/clients'], provides: 'player', protocolCapabilities: 'playback' });

            const created = s.adapter.createdIds();
            expect(created).to.include(`${TV_PREFIX}._Controls.playback.play`);
            expect(created.filter(id => id.includes('._Controls.navigation'))).to.deep.equal([]);
            expect(created.filter(id => id.includes('._Controls.timeline'))).to.deep.equal([]);
        });

        it('makes buttons write-only booleans and value controls writable with their defaults', async () => {
            const s = await setup();

            await controllable(s);

            expect(s.adapter.objectsFor(`${TV_PREFIX}._Controls.playback.play`)[0].common).to.include({
                role: 'button.play',
                type: 'boolean',
                read: false,
                write: true,
            });
            expect(s.adapter.objectsFor(`${TV_PREFIX}._Controls.navigation.moveUp`)[0].common).to.include({
                role: 'button',
                type: 'boolean',
                write: true,
            });
            expect(s.adapter.objectsFor(`${TV_PREFIX}._Controls.playback.setVolume`)[0].common).to.include({
                role: 'level.volume',
                type: 'number',
                unit: '%',
                min: 0,
                max: 100,
                read: true,
                write: true,
            });
            expect(s.adapter.lastValue(`${TV_PREFIX}._Controls.playback.setVolume`)).to.equal(0);
            expect(s.adapter.objectsFor(`${TV_PREFIX}._Controls.playback.seekTo`)[0].common).to.include({
                type: 'number',
                write: true,
            });
        });

        it('subscribes to the control states so that user commands arrive', async () => {
            const s = await setup();

            await controllable(s);

            expect(s.adapter.subscriptions).to.include.members([
                `${TV_PREFIX}._Controls.playback.*`,
                `${TV_PREFIX}._Controls.navigation.*`,
            ]);
        });

        it('creates no controls for a companion-only device and marks it as not controllable', async () => {
            const s = await setup();

            const player = await discovered(s, { sources: ['plex.tv/devices'], provides: '' });

            expect(player.config.controllable).to.equal(false);
            expect(s.adapter.createdIds().filter(id => id.includes('._Controls'))).to.deep.equal([]);
            expect(s.adapter.subscriptions).to.deep.equal([]);
            expect(s.adapter.lastValue(`${TV_PREFIX}.Player.controllable`)).to.equal(false);
        });

        it('does not reset control values that already exist when discovery reports the player again', async () => {
            const s = await setup();
            const player = await controllable(s);
            s.library.confirmNode({ node: `${TV_PREFIX}._Controls.playback.setVolume` }, 40);
            await flush();

            player.setControls();
            await flush();

            expect(s.adapter.lastValue(`${TV_PREFIX}._Controls.playback.setVolume`)).to.equal(40);
        });
    });

    describe('commands (action)', () => {
        const ID = `${TV_PREFIX}._Controls`;

        async function send(s: Setup, player: Player, mode: string, action: string, val: any): Promise<string[]> {
            s.queries.length = 0;
            await player.action({ id: ID, mode, action, val });
            await flush();
            return s.queries.map(q => q.path);
        }

        it('sends a button command to the server, addressed to the player', async () => {
            const s = await setup();
            const player = await controllable(s);

            const paths = await send(s, player, 'playback', 'play', true);

            expect(paths).to.have.length(1);
            const url = new URL(paths[0], 'http://pms');
            expect(url.pathname).to.equal('/player/playback/play');
            expect(s.queries[0].opts?.headers).to.include({ 'X-Plex-Target-Client-Identifier': 'abc-123' });
        });

        it('always sends a media type and an increasing commandID', async () => {
            const s = await setup();
            const player = await controllable(s);

            const first = new URL((await send(s, player, 'playback', 'play', true))[0], 'http://pms');
            const second = new URL((await send(s, player, 'playback', 'pause', true))[0], 'http://pms');

            expect(first.searchParams.get('type')).to.equal('video');
            expect(Number(second.searchParams.get('commandID'))).to.equal(
                Number(first.searchParams.get('commandID')) + 1,
            );
        });

        it('uses the media type that is currently playing', async () => {
            const s = await setup();
            const player = await controllable(s);
            player.details.type = 'music';

            const url = new URL((await send(s, player, 'playback', 'play', true))[0], 'http://pms');

            expect(url.searchParams.get('type')).to.equal('music');
        });

        it('maps the play/pause switch to the play and pause commands', async () => {
            const s = await setup();
            const player = await controllable(s);

            const on = new URL((await send(s, player, 'playback', 'play_switch', true))[0], 'http://pms');
            const off = new URL((await send(s, player, 'playback', 'play_switch', false))[0], 'http://pms');

            expect(on.pathname).to.equal('/player/playback/play');
            expect(off.pathname).to.equal('/player/playback/pause');
        });

        it('sends value commands as parameter of the Plex command', async () => {
            const s = await setup();
            const player = await controllable(s);

            const volume = new URL((await send(s, player, 'playback', 'setVolume', 40))[0], 'http://pms');
            const seek = new URL((await send(s, player, 'playback', 'seekTo', 61_000))[0], 'http://pms');

            expect(volume.pathname).to.equal('/player/playback/setParameters');
            expect(volume.searchParams.get('volume')).to.equal('40');
            expect(seek.pathname).to.equal('/player/playback/seekTo');
            expect(seek.searchParams.get('offset')).to.equal('61000');
        });

        it('translates boolean switches into the values Plex expects', async () => {
            const s = await setup();
            const player = await controllable(s);

            const shuffleOn = new URL((await send(s, player, 'playback', 'setShuffle', true))[0], 'http://pms');
            const shuffleOff = new URL((await send(s, player, 'playback', 'setShuffle', false))[0], 'http://pms');
            const repeatAll = new URL((await send(s, player, 'playback', 'setRepeatAll', true))[0], 'http://pms');

            expect(shuffleOn.searchParams.get('shuffle')).to.equal('1');
            expect(shuffleOff.searchParams.get('shuffle')).to.equal('0');
            expect(repeatAll.searchParams.get('repeat')).to.equal('2');
        });

        it('converts a percentage into an offset of the current duration', async () => {
            const s = await setup();
            const player = await controllable(s);
            player.details.duration = 120_000;

            const url = new URL((await send(s, player, 'playback', 'seekToPercent', 25))[0], 'http://pms');

            expect(url.pathname).to.equal('/player/playback/seekTo');
            expect(url.searchParams.get('offset')).to.equal('30000');
        });

        it('seeks to 0 for a percentage when no duration is known', async () => {
            const s = await setup();
            const player = await controllable(s);

            const url = new URL((await send(s, player, 'playback', 'seekToPercent', 25))[0], 'http://pms');

            expect(url.searchParams.get('offset')).to.equal('0');
        });

        it('starts a given media key with offset on this server', async () => {
            const s = await setup();
            const player = await controllable(s);

            const paths = await send(
                s,
                player,
                'playback',
                'playKey',
                '{"key":"/library/metadata/45156","offset":"1500"}',
            );

            const url = new URL(paths[0], 'http://pms');
            expect(url.pathname).to.equal('/player/playback/playMedia');
            expect(Object.fromEntries(url.searchParams)).to.include({
                key: '/library/metadata/45156',
                offset: '1500',
                address: '192.0.2.10',
                port: '32400',
                machineIdentifier: 'server-uuid-1',
                type: 'video',
            });
        });

        it('rejects a malformed media key with an error in the log and sends nothing', async () => {
            const s = await setup();
            const player = await controllable(s);

            for (const bad of ['not json', '{"offset":"1"}', '{"key":"/library/metadata/1"}', '{"key":5,"offset":1}']) {
                s.adapter.logs = [];

                expect(await send(s, player, 'playback', 'playKey', bad), bad).to.deep.equal([]);
                expect(s.adapter.logged('error'), bad).to.have.length(1);
            }
        });

        it('sends navigation commands', async () => {
            const s = await setup();
            const player = await controllable(s);

            const url = new URL((await send(s, player, 'navigation', 'moveUp', true))[0], 'http://pms');

            expect(url.pathname).to.equal('/player/navigation/moveUp');
            expect(url.searchParams.get('type')).to.equal('video');
        });

        it('acknowledges the control state after the server accepted the command', async () => {
            const s = await setup();
            const player = await controllable(s);
            s.adapter.resetRecords();

            await send(s, player, 'playback', 'setVolume', 40);

            expect(s.adapter.lastValue(`${TV_PREFIX}._Controls.playback.setVolume`)).to.equal(40);
        });

        it('does not acknowledge the control state and warns when the server rejects the command', async () => {
            const s = await setup();
            const player = await controllable(s);
            s.adapter.resetRecords();
            s.answer.fn = () => {
                throw new Error('Plex Server responded with HTTP 404 (Not Found)');
            };

            await send(s, player, 'playback', 'setVolume', 40);

            expect(s.adapter.writtenIds()).to.not.include(`${TV_PREFIX}._Controls.playback.setVolume`);
            expect(s.adapter.logged('warn')).to.have.length(1);
        });

        it('sends nothing to a companion-only device and says so in the log', async () => {
            const s = await setup();
            const player = await discovered(s, { sources: ['plex.tv/devices'], provides: '' });
            s.adapter.resetRecords();

            expect(await send(s, player, 'playback', 'play', true)).to.deep.equal([]);
            expect(s.adapter.logged('warn')).to.have.length(1);
        });

        it('sends nothing for an unknown command and warns', async () => {
            const s = await setup();
            const player = await controllable(s);
            s.adapter.resetRecords();

            expect(await send(s, player, 'playback', 'doesNotExist', true)).to.deep.equal([]);
            expect(await send(s, player, 'unknownMode', 'play', true)).to.deep.equal([]);
            expect(s.adapter.logged('warn')).to.have.length(2);
        });

        it('keeps "refresh details" local instead of sending it to the server', async () => {
            const s = await setup();
            const player = await controllable(s);

            const paths = await send(s, player, 'timeline', 'refreshDetails', false);

            expect(paths).to.deep.equal([]);
            expect(player.refreshDetails).to.equal(false);
        });
    });

    describe('timeline poll (updateTimeline)', () => {
        function timeline(video: Record<string, unknown>, music: Record<string, unknown> = {}): unknown {
            return {
                MediaContainer: {
                    location: 'fullScreenVideo',
                    commandID: '1',
                    Timeline: [
                        { type: 'music', state: 'stopped', ...music },
                        { type: 'photo', state: 'stopped' },
                        { type: 'video', state: 'stopped', ...video },
                    ],
                },
            };
        }

        const PLAYING = {
            state: 'playing',
            time: 30_000,
            duration: 120_000,
            key: '/library/metadata/5',
            ratingKey: '5',
            volume: 80,
            shuffle: '0',
            repeat: '0',
            address: '192.0.2.10',
            machineIdentifier: 'server-uuid-1',
            containerKey: '/playQueues/1',
        };

        it('asks the server for the timeline of exactly this player', async () => {
            const s = await setup();
            const player = await controllable(s);
            s.queries.length = 0;

            await player.updateTimeline();

            expect(s.queries).to.have.length.at.least(1);
            const url = new URL(s.queries[0].path, 'http://pms');
            expect(url.pathname).to.equal('/player/timeline/poll');
            expect(url.searchParams.get('wait')).to.equal('0');
            expect(url.searchParams.has('commandID')).to.equal(true);
            expect(s.queries[0].opts?.headers).to.include({ 'X-Plex-Target-Client-Identifier': 'abc-123' });
        });

        it('takes state, position, duration and progress from the playing timeline', async () => {
            const s = await setup();
            const player = await controllable(s);
            s.answer.fn = p => (p.startsWith('/player/timeline/poll') ? timeline(PLAYING) : {});

            await player.updateTimeline();
            await flush();

            expect(player.details).to.include({
                state: 'playing',
                type: 'video',
                time: 30_000,
                duration: 120_000,
                percent: 25,
                key: '/library/metadata/5',
                volume: 80,
                location: 'fullScreenVideo',
            });
            expect(player.config.connected).to.equal(true);
        });

        it('publishes the timeline below "Player.details"', async () => {
            const s = await setup();
            const player = await controllable(s);
            s.answer.fn = p => (p.startsWith('/player/timeline/poll') ? timeline(PLAYING) : {});

            await player.updateTimeline();
            await flush();

            expect(s.adapter.lastValue(`${TV_PREFIX}.Player.details.state`)).to.equal('playing');
            expect(s.adapter.lastValue(`${TV_PREFIX}.Player.details.type`)).to.equal('video');
            expect(Number(s.adapter.lastValue(`${TV_PREFIX}.Player.details.time`))).to.equal(30_000);
            expect(Number(s.adapter.lastValue(`${TV_PREFIX}.Player.details.percent`))).to.equal(25);
        });

        it('mirrors position, volume and play state into the control states', async () => {
            const s = await setup();
            const player = await controllable(s);
            s.answer.fn = p => (p.startsWith('/player/timeline/poll') ? timeline(PLAYING) : {});

            await player.updateTimeline();
            await flush();

            expect(s.adapter.lastValue(`${TV_PREFIX}._Controls.playback.seekTo`)).to.equal(30_000);
            expect(s.adapter.lastValue(`${TV_PREFIX}._Controls.playback.seekToPercent`)).to.equal(25);
            expect(s.adapter.lastValue(`${TV_PREFIX}._Controls.playback.setVolume`)).to.equal(80);
            expect(s.adapter.lastValue(`${TV_PREFIX}._Controls.playback.play_switch`)).to.equal(true);
        });

        it('recognizes music playback', async () => {
            const s = await setup();
            const player = await controllable(s);
            const music = { state: 'paused', time: 5000, duration: 200_000, key: '/library/metadata/9' };
            s.answer.fn = p => (p.startsWith('/player/timeline/poll') ? timeline({}, music) : {});

            await player.updateTimeline();
            await flush();

            expect(player.details).to.include({ state: 'paused', type: 'music', time: 5000, duration: 200_000 });
        });

        it('reports "stopped" when no timeline is playing', async () => {
            const s = await setup();
            const player = await controllable(s);
            s.answer.fn = p => (p.startsWith('/player/timeline/poll') ? timeline({}) : {});

            await player.updateTimeline();
            await flush();

            expect(player.details).to.include({ state: 'stopped', time: 0, duration: 0, percent: 0 });
            expect(player.config.connected).to.equal(true);
        });

        it('reports "stopped" for an answer without timelines', async () => {
            const s = await setup();
            const player = await controllable(s);
            s.answer.fn = () => ({ MediaContainer: {} });

            await player.updateTimeline();
            await flush();

            expect(player.details).to.include({ state: 'stopped', location: 'none' });
        });

        it('fails with "timeout" and marks the player as disconnected when the server does not answer', async () => {
            const s = await setup();
            const player = await controllable(s);
            for (const code of ['ECONNABORTED', 'ECONNRESET', 'ECONNREFUSED']) {
                s.answer.fn = () => {
                    throw Object.assign(new Error(`${code}: failed`), { code });
                };

                let message = 'resolved';
                try {
                    await player.updateTimeline();
                } catch (err) {
                    message = (err as Error).message;
                }

                expect(message, code).to.equal('timeout');
                expect(player.config.connected, code).to.equal(false);
                expect(player.details.state, code).to.equal('stopped');
            }
        });

        it('does not poll a player that is not controllable', async () => {
            const s = await setup();
            const player = await discovered(s, { sources: ['plex.tv/devices'], provides: '' });
            s.queries.length = 0;

            await player.updateTimeline();

            expect(s.queries).to.deep.equal([]);
        });
    });

    describe('delete', () => {
        it('marks the player as disconnected and cancels its refresh timer', async () => {
            const s = await setup({ getPlayerRefresh: 5 });
            const player = await controllable(s);
            const pendingBefore = s.adapter.timers.filter(t => !t.cleared && t.ms !== 400);
            expect(pendingBefore, 'the refresh timer is running').to.have.length(1);

            player.delete();
            await flush();

            expect(player.config.connected).to.equal(false);
            expect(player.unload).to.equal(true);
            expect(pendingBefore[0].cleared).to.equal(true);
        });
    });
});
