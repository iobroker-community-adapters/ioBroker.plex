import { expect } from 'chai';
import { afterEach, describe, it } from 'mocha';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as sinon from 'sinon';

import { Library, type LibraryOptions, type NodeDef } from '../../src/lib/library';
import type { PlexHttp } from '../../src/lib/plexHttp';
import { asAdapter, FakeAdapter, flush } from './helpers/fakeAdapter';

const NODES: Record<string, NodeDef> = {
    playing: { description: 'Plex Media being played', role: 'channel' },
    'playing.metadata': { description: 'Metadata', role: 'channel' },
    'playing.metadata.title': { description: 'Title', role: 'media.title', type: 'string' },
    'playing.metadata.year': { description: 'Year', role: 'text', type: 'number' },
    'playing.metadata.genre': { description: 'Genres', role: 'media.genre', type: 'string' },
    'playing.metadata.media.part.file': { description: 'File', role: 'text', type: 'string' },
    'playing.metadata.media.0.part.file': { description: 'File of first media', role: 'text', type: 'string' },
    'playing.player.local': { description: 'Local player', role: 'indicator', type: 'boolean' },
    'events.account': { description: 'Event account', role: 'text', type: 'string' },
};

interface Setup {
    adapter: FakeAdapter;
    library: Library;
}

/**
 * Library with a fake adapter. The objects/states the constructor creates on its own
 * (`info`, `info.connection`) are already written and removed from the records.
 *
 * @param options - library options; `nodes` defaults to the small table above
 * @param config - adapter config overrides
 */
async function createLibrary(options: LibraryOptions = {}, config: Record<string, any> = {}): Promise<Setup> {
    const adapter = new FakeAdapter();
    Object.assign(adapter.config, config);
    const library = new Library(asAdapter(adapter), { nodes: JSON.parse(JSON.stringify(NODES)), ...options });
    await flush();
    adapter.resetRecords();
    return { adapter, library };
}

describe('Library', () => {
    afterEach(() => {
        sinon.restore();
    });

    describe('constructor', () => {
        it('creates the info channel and the connection indicator, initially "not connected"', async () => {
            const adapter = new FakeAdapter();

            new Library(asAdapter(adapter), {});
            await flush();

            expect(adapter.createdIds()).to.deep.equal(['info', 'info.connection']);
            expect(adapter.objectsFor('info')[0].type).to.equal('channel');
            const connection = adapter.objectsFor('info.connection')[0];
            expect(connection.type).to.equal('state');
            expect(connection.common).to.include({
                name: 'Adapter Connection Status',
                role: 'indicator.connected',
                type: 'boolean',
                write: false,
            });
            expect(adapter.stateCalls).to.have.length(1);
            expect(adapter.stateCalls[0].id).to.equal('info.connection');
            expect(adapter.stateCalls[0].state).to.include({ val: false, ack: true });
        });

        it('warns about node keys that are not lower case (they could never be found)', async () => {
            const adapter = new FakeAdapter();

            new Library(asAdapter(adapter), { nodes: { 'Playing.Title': { description: 'x' }, 'playing.ok': {} } });
            await flush();

            expect(adapter.logged('warn')).to.have.length(1);
            expect(adapter.logged('warn')[0]).to.contain('Playing.Title');
        });
    });

    describe('getNode', () => {
        it('returns the definition of a known node', async () => {
            const { library } = await createLibrary();

            expect(library.getNode('playing.metadata.title')).to.deep.equal({
                description: 'Title',
                role: 'media.title',
                type: 'string',
            });
        });

        it('returns a "does not exist" string state definition for an unknown node', async () => {
            const { library } = await createLibrary();

            const node = library.getNode('playing.metadata.nope');

            expect(node.notExist).to.equal(true);
            expect(node).to.include({ role: 'state', type: 'string', convert: null });
            expect(node.description).to.be.a('string').and.not.equal('');
        });

        it('does not mark known nodes as missing', async () => {
            const { library } = await createLibrary();

            expect(library.getNode('playing.metadata.title').notExist).to.equal(undefined);
        });

        it('returns a copy: changing the result does not change later lookups', async () => {
            const { library } = await createLibrary();

            const first = library.getNode('playing.metadata.title');
            first.description = 'changed';
            first.key = '_playing.x.Metadata.title';

            const second = library.getNode('playing.metadata.title');
            expect(second.description).to.equal('Title');
            expect(second).to.not.have.property('key');
            expect(second).to.not.equal(first);
        });

        it('returns independent copies of the fallback definition as well', async () => {
            const { library } = await createLibrary();

            library.getNode('unknown.one').description = 'changed';

            expect(library.getNode('unknown.two').description).to.not.equal('changed');
        });

        it('matches case-sensitively by default and lower-cases only on request', async () => {
            const { library } = await createLibrary();

            expect(library.getNode('Playing.Metadata.Title').notExist).to.equal(true);
            expect(library.getNode('Playing.Metadata.Title', true).description).to.equal('Title');
        });

        it('ignores numeric index segments when the indexed key itself is not defined', async () => {
            const { library } = await createLibrary();

            expect(library.getNode('playing.metadata.media.3.part.12.file').description).to.equal('File');
            expect(library.getNode('playing.metadata.media.001.part.000.file').description).to.equal('File');
        });

        it('prefers a definition for the exact indexed key over the index-less one', async () => {
            const { library } = await createLibrary();

            expect(library.getNode('playing.metadata.media.0.part.file').description).to.equal('File of first media');
        });

        it('does not strip a trailing number or digits that are only part of a segment', async () => {
            const { library } = await createLibrary({
                nodes: { 'a.b': { description: 'plain' }, 'a.b2.c': { description: 'with digit' } },
            });

            expect(library.getNode('a.b.0').notExist).to.equal(true);
            expect(library.getNode('a.b2.c').description).to.equal('with digit');
            expect(library.getNode('a.2.c').notExist).to.equal(true);
        });
    });

    describe('clean', () => {
        it('keeps characters that are allowed in ioBroker ids', async () => {
            const { library } = await createLibrary();

            expect(library.clean('Wohnzimmer TV_2-a.b')).to.equal('Wohnzimmer TV_2-a.b');
            expect(library.clean('Küche Ñandú')).to.equal('Küche Ñandú');
        });

        it('replaces forbidden characters by "#"', async () => {
            const { library } = await createLibrary();

            expect(library.clean("Tim's iPhone")).to.equal('Tim#s iPhone');
            expect(library.clean('TV [4K]')).to.equal('TV #4K#');
            expect(library.clean('a*b?c"d')).to.equal('a#b#c#d');
        });

        it('replaces a run of forbidden characters by a single "#"', async () => {
            const { library } = await createLibrary();

            expect(library.clean('a*?"<>b')).to.equal('a#b');
        });

        it('lower-cases only on request', async () => {
            const { library } = await createLibrary();

            expect(library.clean('Wohnzimmer TV')).to.equal('Wohnzimmer TV');
            expect(library.clean('Wohnzimmer TV', true)).to.equal('wohnzimmer tv');
            expect(library.clean("Tim's iPhone", true)).to.equal('tim#s iphone');
        });

        it('gives the same result when called repeatedly with the same input', async () => {
            const { library } = await createLibrary();

            const results = [1, 2, 3, 4].map(() => library.clean('ab*cd*ef'));

            expect(results).to.deep.equal(['ab#cd#ef', 'ab#cd#ef', 'ab#cd#ef', 'ab#cd#ef']);
        });

        it('returns an empty string and missing values unchanged', async () => {
            const { library } = await createLibrary();

            expect(library.clean('')).to.equal('');
            expect(library.clean(undefined as unknown as string)).to.equal(undefined);
            expect(library.clean(null as unknown as string)).to.equal(null);
        });

        it('warns when the removed third/fourth parameter is still passed', async () => {
            const { adapter, library } = await createLibrary();

            library.clean('abc', false, '_');

            expect(adapter.logged('warn')).to.have.length(1);
        });
    });

    describe('replaceDescription / appendToDescription', () => {
        it('replaces within a plain string', async () => {
            const { library } = await createLibrary();

            expect(library.replaceDescription('Library %library%', '%library%', 'Movies')).to.equal('Library Movies');
            expect(library.replaceDescription('a-a-a', /a/g, 'b')).to.equal('b-b-b');
        });

        it('replaces in every language of a translated description without touching the original', async () => {
            const { library } = await createLibrary();
            const original = { en: 'Library %library%', de: 'Bibliothek %library%' };

            const result = library.replaceDescription(original, '%library%', 'Movies');

            expect(result).to.deep.equal({ en: 'Library Movies', de: 'Bibliothek Movies' });
            expect(original).to.deep.equal({ en: 'Library %library%', de: 'Bibliothek %library%' });
        });

        it('leaves a description without the placeholder unchanged', async () => {
            const { library } = await createLibrary();

            expect(library.replaceDescription('nothing here', '%library%', 'Movies')).to.equal('nothing here');
        });

        it('appends to a plain string and to every language', async () => {
            const { library } = await createLibrary();
            const original = { en: 'Player', de: 'Abspieler' };

            expect(library.appendToDescription('Player', ' TV')).to.equal('Player TV');
            expect(library.appendToDescription(original, ' TV')).to.deep.equal({ en: 'Player TV', de: 'Abspieler TV' });
            expect(original).to.deep.equal({ en: 'Player', de: 'Abspieler' });
        });
    });

    describe('encode / decode', () => {
        it('decode restores what encode produced', async () => {
            const { library } = await createLibrary();
            const secret = 'tautulli-API-key_0123456789 äöü €';

            const encoded = library.encode('k3Y', secret);

            expect(encoded).to.not.equal(secret);
            expect(encoded).to.have.length(secret.length);
            expect(library.decode('k3Y', encoded)).to.equal(secret);
        });

        it('does not restore the text with a different key', async () => {
            const { library } = await createLibrary();

            const encoded = library.encode('right-key', 'secret');

            expect(library.decode('wrong-key', encoded)).to.not.equal('secret');
        });

        it('uses every character of the key, repeating it for longer texts', async () => {
            const { library } = await createLibrary();

            // XOR with the key: 'A'(65)^'a'(97)=32, 'B'(66)^'b'(98)=32, then the key starts over.
            expect(library.encode('ab', 'ABAB')).to.equal('    ');
            expect(library.encode('ab', 'AB')).to.not.equal(library.encode('ac', 'AB'));
        });

        it('returns an empty string for empty input', async () => {
            const { library } = await createLibrary();

            expect(library.encode('key', '')).to.equal('');
            expect(library.decode('key', '')).to.equal('');
        });
    });

    describe('small helpers', () => {
        it('getKey returns a random alphanumeric key of the requested length (default 8)', async () => {
            const { library } = await createLibrary();

            expect(library.getKey()).to.match(/^[0-9a-zA-Z]{8}$/);
            for (const length of [1, 7, 20, 33]) {
                expect(library.getKey(length)).to.match(new RegExp(`^[0-9a-zA-Z]{${length}}$`));
            }
            expect(library.getKey(20)).to.not.equal(library.getKey(20));
        });

        it('getIP turns a 32-bit number into dotted notation', async () => {
            const { library } = await createLibrary();

            expect(library.getIP(3_232_235_777)).to.equal('192.168.1.1');
            expect(library.getIP(2_130_706_433)).to.equal('127.0.0.1');
            expect(library.getIP(0)).to.equal('0.0.0.0');
            expect(library.getIP(4_294_967_295)).to.equal('255.255.255.255');
        });

        it('ucFirst capitalizes only the first character', async () => {
            const { library } = await createLibrary();

            expect(library.ucFirst('playback controls')).to.equal('Playback controls');
            expect(library.ucFirst('Already')).to.equal('Already');
            expect(library.ucFirst('')).to.equal('');
        });

        it('getTimestamp returns milliseconds, and 0 for missing or unparsable input', async () => {
            const { library } = await createLibrary();

            expect(library.getTimestamp('2020-05-17T10:00:00Z')).to.equal(Date.UTC(2020, 4, 17, 10));
            expect(library.getTimestamp(1_589_709_600_000)).to.equal(1_589_709_600_000);
            expect(library.getTimestamp(undefined)).to.equal(0);
            expect(library.getTimestamp('')).to.equal(0);
            expect(library.getTimestamp('not a date')).to.equal(0);
        });

        it('getDateTime formats local time as DD.MM.YYYY HH:mm:ss with the calendar month', async () => {
            const { library } = await createLibrary();

            expect(library.getDateTime(new Date(2024, 0, 5, 3, 7, 9).getTime())).to.equal('05.01.2024 03:07:09');
            expect(library.getDateTime(new Date(2023, 11, 31, 23, 59, 58).getTime())).to.equal('31.12.2023 23:59:58');
        });

        it('getDateTime returns an empty string when there is no usable timestamp', async () => {
            const { library } = await createLibrary();

            expect(library.getDateTime(undefined)).to.equal('');
            expect(library.getDateTime('')).to.equal('');
            expect(library.getDateTime(0)).to.equal('');
            expect(library.getDateTime(-1)).to.equal('');
        });

        it('readableTime formats durations as m:ss below one hour and as h:mm from one hour on', async () => {
            const { library } = await createLibrary();

            expect(library.readableTime(0)).to.equal('0:00');
            expect(library.readableTime(999)).to.equal('0:00');
            expect(library.readableTime(5000)).to.equal('0:05');
            expect(library.readableTime(59_999)).to.equal('0:59');
            expect(library.readableTime(60_000)).to.equal('1:00');
            expect(library.readableTime(754_000)).to.equal('12:34');
            expect(library.readableTime(3_599_999)).to.equal('59:59');
            expect(library.readableTime(3_600_000)).to.equal('1:00');
            expect(library.readableTime(3_723_000)).to.equal('1:02');
            expect(library.readableTime(45_240_000)).to.equal('12:34');
        });

        it('cloneObj makes a deep copy', () => {
            const original = { a: { b: [1, 2] } };

            const copy = Library.cloneObj(original);
            copy.a.b.push(3);

            expect(original).to.deep.equal({ a: { b: [1, 2] } });
        });
    });

    describe('convertToType', () => {
        it('returns the value untouched when no type is given', async () => {
            const { library } = await createLibrary();

            expect(library.convertToType('5')).to.equal('5');
            expect(library.convertToType(undefined)).to.equal(undefined);
        });

        it('converts between string, number and boolean', async () => {
            const { library } = await createLibrary();

            expect(library.convertToType(1979, 'string')).to.equal('1979');
            expect(library.convertToType(true, 'string')).to.equal('true');
            expect(library.convertToType('1979', 'number')).to.equal(1979);
            expect(library.convertToType('12.5', 'number')).to.equal(12.5);
            expect(library.convertToType(true, 'number')).to.equal(1);
            expect(library.convertToType(1, 'boolean')).to.equal(true);
            expect(library.convertToType(0, 'boolean')).to.equal(false);
            expect(library.convertToType('', 'boolean')).to.equal(false);
        });

        it('keeps values that already have the requested type', async () => {
            const { library } = await createLibrary();

            expect(library.convertToType('text', 'string')).to.equal('text');
            expect(library.convertToType(0, 'number')).to.equal(0);
            expect(library.convertToType(false, 'boolean')).to.equal(false);
        });

        it('maps missing values to the empty value of the type', async () => {
            const { library } = await createLibrary();

            for (const missing of [undefined, null]) {
                expect(library.convertToType(missing, 'string')).to.equal('');
                expect(library.convertToType(missing, 'number')).to.equal(0);
                expect(library.convertToType(missing, 'boolean')).to.equal(false);
            }
            expect(library.convertToType('', 'number')).to.equal(0);
        });

        it('leaves values alone for types it does not convert (json, array, mixed, ...)', async () => {
            const { library } = await createLibrary();
            const list = [1, 2];

            expect(library.convertToType(list, 'array')).to.equal(list);
            expect(library.convertToType('{"a":1}', 'json')).to.equal('{"a":1}');
        });
    });

    describe('set: creating objects', () => {
        it('creates a read-only state object with name, role and type of the node, then writes the value', async () => {
            const { adapter, library } = await createLibrary();

            await library.set({ node: 'a.title', description: 'Title', role: 'media.title', type: 'string' }, 'Alien');

            expect(adapter.objectsFor('a.title')).to.deep.equal([
                {
                    type: 'state',
                    common: { name: 'Title', role: 'media.title', type: 'string', write: false },
                    native: {},
                },
            ]);
            expect(adapter.stateCalls).to.have.length(1);
            expect(adapter.stateCalls[0].id).to.equal('a.title');
            expect(adapter.stateCalls[0].state).to.include({ val: 'Alien', ack: true });
            expect(adapter.stateCalls[0].state.ts).to.be.a('number');
        });

        it('defaults to a string state with role "state"', async () => {
            const { adapter, library } = await createLibrary();

            await library.set({ node: 'a.plain', description: 'Plain' }, 'x');

            expect(adapter.objectsFor('a.plain')[0].common).to.include({ role: 'state', type: 'string' });
        });

        it('prefers "name" over "description" as the object name', async () => {
            const { adapter, library } = await createLibrary();

            await library.set({ node: 'a.named', name: 'The Name', description: 'The Description' }, 'x');

            expect(adapter.objectsFor('a.named')[0].common.name).to.equal('The Name');
        });

        it('keeps a translated description object as the name', async () => {
            const { adapter, library } = await createLibrary();
            const description = { en: 'Title', de: 'Titel' } as unknown as string;

            await library.set({ node: 'a.i18n', description }, 'x');

            expect(adapter.objectsFor('a.i18n')[0].common.name).to.deep.equal({ en: 'Title', de: 'Titel' });
        });

        it('lets "common" override role, type and write access and passes extra common fields on', async () => {
            const { adapter, library } = await createLibrary();

            await library.set(
                {
                    node: 'a.volume',
                    description: 'Volume',
                    role: 'text',
                    type: 'string',
                    common: { role: 'level.volume', type: 'number', write: true, read: true, unit: '%' },
                },
                '40',
            );

            expect(adapter.objectsFor('a.volume')[0].common).to.deep.equal({
                name: 'Volume',
                role: 'level.volume',
                type: 'number',
                write: true,
                read: true,
                unit: '%',
            });
            expect(adapter.lastValue('a.volume'), 'value follows common.type').to.equal(40);
        });

        it('creates a channel without type/role in common and writes no state for it', async () => {
            const { adapter, library } = await createLibrary();

            await library.set({ node: 'a', role: 'channel', description: 'Channel A' }, 'ignored');

            const [obj] = adapter.objectsFor('a');
            expect(obj.type).to.equal('channel');
            expect(obj.common.name).to.equal('Channel A');
            expect(obj.common.type).to.equal(undefined);
            expect(obj.common.role).to.equal(undefined);
            expect(adapter.stateCalls).to.deep.equal([]);
        });

        it('creates a device object for role "device"', async () => {
            const { adapter, library } = await createLibrary();

            await library.set({ node: 'dev', role: 'device', description: 'Device' });

            expect(adapter.objectsFor('dev')[0].type).to.equal('device');
            expect(adapter.stateCalls).to.deep.equal([]);
        });

        it('makes button states write-only booleans', async () => {
            const { adapter, library } = await createLibrary();

            await library.set({ node: 'a.play', description: 'Play', role: 'button.play' }, false);

            expect(adapter.objectsFor('a.play')[0].type).to.equal('state');
            expect(adapter.objectsFor('a.play')[0].common).to.include({
                role: 'button.play',
                type: 'boolean',
                read: false,
                write: true,
            });
        });

        it('passes "native" on and defaults it to an empty object', async () => {
            const { adapter, library } = await createLibrary();

            await library.set({ node: 'a.n1', description: 'x', native: { ratingKey: '5' } }, 'x');
            await library.set({ node: 'a.n2', description: 'x' }, 'x');

            expect(adapter.objectsFor('a.n1')[0].native).to.deep.equal({ ratingKey: '5' });
            expect(adapter.objectsFor('a.n2')[0].native).to.deep.equal({});
        });

        it('creates the object only once, however often the state is set', async () => {
            const { adapter, library } = await createLibrary();
            const node = { node: 'a.title', description: 'Title' };

            await library.set(node, 'one');
            await library.set(node, 'two');
            await library.set(node, 'three');

            expect(adapter.objectsFor('a.title')).to.have.length(1);
            expect(adapter.valuesFor('a.title')).to.deep.equal(['one', 'two', 'three']);
        });

        it('does not create a state for an empty string value', async () => {
            const { adapter, library } = await createLibrary();

            await library.set({ node: 'a.empty', description: 'Empty' }, '');

            expect(adapter.objectCalls).to.deep.equal([]);
            expect(adapter.stateCalls).to.deep.equal([]);
        });

        it('does create states for 0 and false', async () => {
            const { adapter, library } = await createLibrary();

            await library.set({ node: 'a.zero', description: 'Zero', type: 'number' }, 0);
            await library.set({ node: 'a.off', description: 'Off', type: 'boolean' }, false);

            expect(adapter.lastValue('a.zero')).to.equal(0);
            expect(adapter.lastValue('a.off')).to.equal(false);
        });

        it('empties an existing state when it is later set to an empty string', async () => {
            const { adapter, library } = await createLibrary();
            const node = { node: 'a.title', description: 'Title' };

            await library.set(node, 'Alien');
            await library.set(node, '');

            expect(adapter.valuesFor('a.title')).to.deep.equal(['Alien', '']);
        });

        it('logs an error for a node without name and description', async () => {
            const { adapter, library } = await createLibrary();

            await library.set({ node: 'a.anonymous' }, 'x');

            expect(adapter.logged('error')).to.not.deep.equal([]);
            expect(adapter.logged('error')[0]).to.contain('a.anonymous');
        });
    });

    describe('set: writing values', () => {
        it('converts the value to the type of the node', async () => {
            const { adapter, library } = await createLibrary();

            await library.set({ node: 'a.year', description: 'Year', type: 'number' }, '1979');
            await library.set({ node: 'a.count', description: 'Count', type: 'string' }, 3);
            await library.set({ node: 'a.flag', description: 'Flag', type: 'boolean' }, 1);

            expect(adapter.lastValue('a.year')).to.equal(1979);
            expect(adapter.lastValue('a.count')).to.equal('3');
            expect(adapter.lastValue('a.flag')).to.equal(true);
        });

        it('does not write an unchanged value again', async () => {
            const { adapter, library } = await createLibrary();
            const node = { node: 'a.title', description: 'Title' };

            await library.set(node, 'Alien');
            await library.set(node, 'Alien');
            await library.set(node, 'Alien');

            expect(adapter.valuesFor('a.title')).to.deep.equal(['Alien']);
        });

        it('treats a value as unchanged when it only differs in its representation', async () => {
            const { adapter, library } = await createLibrary();
            const node = { node: 'a.year', description: 'Year', type: 'number' as const };

            await library.set(node, 1979);
            await library.set(node, '1979');

            expect(adapter.valuesFor('a.year')).to.deep.equal([1979]);
        });

        it('writes again when the value changes, including back to an earlier value', async () => {
            const { adapter, library } = await createLibrary();
            const node = { node: 'a.state', description: 'State' };

            await library.set(node, 'playing');
            await library.set(node, 'paused');
            await library.set(node, 'playing');

            expect(adapter.valuesFor('a.state')).to.deep.equal(['playing', 'paused', 'playing']);
        });

        it('writes an unchanged value again when forced', async () => {
            const { adapter, library } = await createLibrary();
            const node = { node: 'a.title', description: 'Title' };

            await library.set(node, 'Alien');
            await library.set(node, 'Alien', { force: true });

            expect(adapter.valuesFor('a.title')).to.deep.equal(['Alien', 'Alien']);
        });

        it('always acknowledges the values it writes', async () => {
            const { adapter, library } = await createLibrary();

            await library.set({ node: 'a.b', description: 'x' }, 'one');
            await library.set({ node: 'a.b', description: 'x' }, 'two');

            expect(adapter.stateCalls.map(c => c.state.ack)).to.deep.equal([true, true]);
        });

        it('retries a value whose write failed instead of considering it written', async () => {
            const { adapter, library } = await createLibrary();
            const node = { node: 'a.title', description: 'Title' };
            await library.set(node, 'Alien');

            adapter.failSetState = new Error('DB closed');
            await library.set(node, 'Aliens');
            expect(adapter.logged('debug').join('\n')).to.contain('DB closed');

            adapter.failSetState = undefined;
            await library.set(node, 'Aliens');

            expect(adapter.valuesFor('a.title')).to.deep.equal(['Alien', 'Aliens']);
        });

        it('remembers the written value for getDeviceState', async () => {
            const { library } = await createLibrary();

            await library.set({ node: 'a.title', description: 'Title' }, 'Alien');

            expect(library.getDeviceState('a.title')).to.equal('Alien');
        });
    });

    describe('confirmNode', () => {
        it('re-writes a known state even when the value did not change', async () => {
            const { adapter, library } = await createLibrary();
            await library.set({ node: 'a.seekTo', description: 'Seek', type: 'number' }, 10);

            library.confirmNode({ node: 'a.seekTo' }, 10);
            await flush();

            expect(adapter.valuesFor('a.seekTo')).to.deep.equal([10, 10]);
        });

        it('does nothing for a state the library has never seen', async () => {
            const { adapter, library } = await createLibrary();

            library.confirmNode({ node: 'a.unknown' }, 10);
            await flush();

            expect(adapter.stateCalls).to.deep.equal([]);
        });

        it('stores objects as JSON text', async () => {
            const { adapter, library } = await createLibrary();
            await library.set({ node: 'a.json', description: 'JSON', type: 'string' }, '{}');

            library.confirmNode({ node: 'a.json' }, { key: '/library/metadata/1', offset: 5 });
            await flush();

            expect(adapter.lastValue('a.json')).to.equal('{"key":"/library/metadata/1","offset":5}');
        });
    });

    describe('state cache', () => {
        it('getDeviceState distinguishes unknown states (null) from known ones', async () => {
            const { library } = await createLibrary();
            library.setDeviceState('p.title', 'TV');

            expect(library.getDeviceState('p.unknown')).to.equal(null);
            expect(library.getDeviceState('p.title')).to.equal('TV');
        });

        it('getDeviceState reports falsy cached values as false, not as null', async () => {
            const { library } = await createLibrary();
            library.setDeviceState('p.zero', 0);
            library.setDeviceState('p.empty', '');

            expect(library.getDeviceState('p.zero')).to.equal(false);
            expect(library.getDeviceState('p.empty')).to.equal(false);
        });

        it('getDeviceState can return the time of the last update', async () => {
            const clock = sinon.useFakeTimers({ now: 1_700_000_000_000, toFake: ['Date'] });
            const { library } = await createLibrary();

            library.setDeviceState('p.title', 'TV');
            clock.tick(5000);

            expect(library.getDeviceState('p.title', 'ts')).to.equal(1_700_000_000_000);
        });

        it('getDeviceStateJson collects the direct children of a prefix', async () => {
            const { library } = await createLibrary();
            library.setDeviceState('p.details.state', 'playing');
            library.setDeviceState('p.details.time', 1200);
            library.setDeviceState('p.detailsX.state', 'other prefix');
            library.setDeviceState('q.details.state', 'other player');

            expect(library.getDeviceStateJson('p.details')).to.deep.equal({ state: 'playing', time: 1200 });
        });

        it('getDeviceStateJson restores nested objects from their "_data" JSON', async () => {
            const { library } = await createLibrary();
            library.setDeviceState('p.details.state', 'playing');
            library.setDeviceState('p.details.video._data', '{"time":1200,"state":"playing"}');

            expect(library.getDeviceStateJson('p.details')).to.deep.equal({
                state: 'playing',
                video: { time: 1200, state: 'playing' },
            });
        });

        it('getDeviceStateJson returns an empty object for an unknown prefix', async () => {
            const { library } = await createLibrary();

            expect(library.getDeviceStateJson('nothing.here')).to.deep.equal({});
        });

        it('clearStateCache forgets a prefix and its children, but not similarly named siblings', async () => {
            const { library } = await createLibrary();
            library.setDeviceState('p._Controls', 1);
            library.setDeviceState('p._Controls.playback.play', true);
            library.setDeviceState('p._ControlsOther.x', 'keep');
            library.setDeviceState('p.Player.title', 'keep');

            library.clearStateCache('p._Controls');

            expect(library.getDeviceState('p._Controls')).to.equal(null);
            expect(library.getDeviceState('p._Controls.playback.play')).to.equal(null);
            expect(library.getDeviceState('p._ControlsOther.x')).to.equal('keep');
            expect(library.getDeviceState('p.Player.title')).to.equal('keep');
        });

        it('a state forgotten by clearStateCache is created and written again on the next set', async () => {
            const { adapter, library } = await createLibrary();
            const node = { node: 'p._Controls.playback.play', description: 'Play', type: 'boolean' as const };
            await library.set(node, true);

            library.clearStateCache('p._Controls');
            await library.set(node, true);

            expect(adapter.objectsFor(node.node)).to.have.length(2);
            expect(adapter.valuesFor(node.node)).to.deep.equal([true, true]);
        });

        it('resetStates forgets everything', async () => {
            const { library } = await createLibrary();
            library.setDeviceState('p.title', 'TV');

            library.resetStates();

            expect(library.getDeviceState('p.title')).to.equal(null);
        });
    });

    describe('internal subscriptions on _playing states', () => {
        it('calls the callback of a node when its value changes, with state id and player prefix', async () => {
            const { library } = await createLibrary();
            const calls: any[][] = [];
            library._SUBCSCRIPT_PLAYING['metadata.viewoffset'] = (...args) => calls.push(args);

            library.setDeviceState('_playing.tv-uuid1.Metadata.viewOffset', 1000);
            library.setDeviceState('_playing.tv-uuid1.Metadata.viewOffset', 1000);
            library.setDeviceState('_playing.tv-uuid1.Metadata.viewOffset', 2000);

            expect(calls).to.deep.equal([
                ['_playing.tv-uuid1.Metadata.viewOffset', '_playing.tv-uuid1', 1000, undefined],
                ['_playing.tv-uuid1.Metadata.viewOffset', '_playing.tv-uuid1', 2000, 1000],
            ]);
        });

        it('ignores states outside _playing and the _recent copies', async () => {
            const { library } = await createLibrary();
            const calls: any[][] = [];
            library._SUBCSCRIPT_PLAYING['metadata.viewoffset'] = (...args) => calls.push(args);

            library.setDeviceState('events.tv-uuid1.Metadata.viewOffset', 1000);
            library.setDeviceState('_playing._recent.tv-uuid1.Metadata.viewOffset', 1000);

            expect(calls).to.deep.equal([]);
        });

        // Finding (not fixed, see report): subscribeNode() only replaces or removes an entry that
        // already exists, and nothing ever creates one. The subscription made in main.ts
        // ("metadata.viewoffset") therefore never fires. The behaviour is identical in the last
        // JavaScript version of the library (long-standing no-op).
        it.skip('subscribeNode registers a callback for a node that had none', async () => {
            const { library } = await createLibrary();
            const calls: any[][] = [];

            library.subscribeNode('metadata.viewoffset', (...args) => calls.push(args));
            library.setDeviceState('_playing.tv-uuid1.Metadata.viewOffset', 1000);

            expect(calls).to.have.length(1);
        });
    });

    describe('runGarbageCollector', () => {
        const T0 = 1_700_000_000_000;

        async function setupWithStates(): Promise<Setup & { clock: sinon.SinonFakeTimers }> {
            const clock = sinon.useFakeTimers({ now: T0, toFake: ['Date'] });
            const setup = await createLibrary();
            const { adapter, library } = setup;
            const states: Array<[string, ioBroker.CommonType | undefined, any]> = [
                ['_playing.tv.Metadata.title', 'string', 'Alien'],
                ['_playing.tv.Metadata.year', 'number', 1979],
                ['_playing.tv.Metadata.local', 'boolean', true],
                ['_playing.tv.Metadata.raw', undefined, 'whatever'],
                ['_playing.tv.Player.title', 'string', 'TV'],
            ];
            for (const [id, type, value] of states) {
                await library.set({ node: id, description: id, type: type ?? 'string' }, value);
                adapter.dbStates[`plex.0.${id}`] = { val: value };
                adapter.dbObjects[id] = type ? { common: { type } } : { common: {} };
            }
            adapter.resetRecords();
            return { ...setup, clock };
        }

        it('empties states that were not updated within the offset, by type', async () => {
            const { adapter, library, clock } = await setupWithStates();
            clock.tick(60_000);

            const result = await library.runGarbageCollector('_playing.tv', false, 30_000);
            await flush();

            expect(result).to.equal(true);
            expect(adapter.lastValue('_playing.tv.Metadata.title')).to.equal('');
            expect(adapter.lastValue('_playing.tv.Metadata.year')).to.equal(0);
            expect(adapter.lastValue('_playing.tv.Metadata.local')).to.equal(false);
            expect(adapter.lastValue('_playing.tv.Metadata.raw'), 'unknown type is reset to null').to.equal(null);
        });

        it('leaves states alone that were updated within the offset', async () => {
            const { adapter, library, clock } = await setupWithStates();
            clock.tick(60_000);
            await library.set({ node: '_playing.tv.Metadata.title', description: 'x' }, 'Aliens');
            adapter.resetRecords();
            clock.tick(10_000);

            await library.runGarbageCollector('_playing.tv', false, 30_000);
            await flush();

            expect(adapter.writtenIds()).to.not.include('_playing.tv.Metadata.title');
            expect(adapter.writtenIds()).to.include('_playing.tv.Metadata.year');
        });

        it('never touches whitelisted branches', async () => {
            const { adapter, library, clock } = await setupWithStates();
            clock.tick(60_000);

            await library.runGarbageCollector('_playing.tv', false, 30_000, ['Player', '_Controls']);
            await flush();

            expect(adapter.writtenIds()).to.not.include('_playing.tv.Player.title');
            expect(adapter.writtenIds()).to.include('_playing.tv.Metadata.title');
        });

        it('only looks at states below the given prefix', async () => {
            const { adapter, library, clock } = await setupWithStates();
            await library.set({ node: '_playing.other.Metadata.title', description: 'x' }, 'Other');
            adapter.dbStates['plex.0._playing.other.Metadata.title'] = { val: 'Other' };
            adapter.resetRecords();
            clock.tick(60_000);

            await library.runGarbageCollector('_playing.tv', false, 30_000);
            await flush();

            expect(adapter.writtenIds()).to.not.include('_playing.other.Metadata.title');
        });

        it('writes nothing when everything is fresh', async () => {
            const { adapter, library, clock } = await setupWithStates();
            clock.tick(1000);

            await library.runGarbageCollector('_playing.tv', false, 30_000);
            await flush();

            expect(adapter.stateCalls).to.deep.equal([]);
        });

        it('resolves false and writes nothing when the states cannot be read', async () => {
            const { adapter, library, clock } = await setupWithStates();
            clock.tick(60_000);
            adapter.getStatesError = new Error('DB closed');

            const result = await library.runGarbageCollector('_playing.tv', false, 30_000);
            await flush();

            expect(result).to.equal(false);
            expect(adapter.stateCalls).to.deep.equal([]);
        });

        it('an emptied state is written again when the next event delivers the old value', async () => {
            const { adapter, library, clock } = await setupWithStates();
            clock.tick(60_000);
            await library.runGarbageCollector('_playing.tv', false, 30_000);
            await flush();

            await library.set({ node: '_playing.tv.Metadata.title', description: 'x' }, 'Alien');

            expect(adapter.valuesFor('_playing.tv.Metadata.title')).to.deep.equal(['', 'Alien']);
        });

        // Finding (not fixed, see report): since the JS -> TS migration a value that is delivered
        // again unchanged no longer refreshes the "last update" time of the state, so the garbage
        // collector treats it as stale and empties it although it was just confirmed.
        it.skip('does not empty a state whose unchanged value was delivered again within the offset', async () => {
            const { adapter, library, clock } = await setupWithStates();
            clock.tick(60_000);
            // The next "media.play" delivers the same title again ...
            await library.set({ node: '_playing.tv.Metadata.title', description: 'x' }, 'Alien');
            adapter.resetRecords();

            // ... and then the collector runs for everything older than 30 s.
            await library.runGarbageCollector('_playing.tv', false, 30_000);
            await flush();

            expect(adapter.writtenIds()).to.not.include('_playing.tv.Metadata.title');
        });
    });

    describe('del', () => {
        it('resets all states below a prefix to null and then calls back', async () => {
            const { adapter, library } = await createLibrary();
            adapter.dbStates = {
                'plex.0.p.a': { val: 1 },
                'plex.0.p.b.c': { val: 'x' },
                'plex.0.q.a': { val: 2 },
            };
            let done = false;

            await library.del('p', true, () => (done = true));
            await flush();

            expect(adapter.stateCalls).to.deep.equal([
                { id: 'p.a', state: null },
                { id: 'p.b.c', state: null },
            ]);
            expect(done).to.equal(true);
        });

        it('resets only the named state when not nested', async () => {
            const { adapter, library } = await createLibrary();
            adapter.dbStates = { 'plex.0.p.a': { val: 1 }, 'plex.0.p.a.b': { val: 2 } };

            await library.del('p.a', false);
            await flush();

            expect(adapter.stateCalls).to.deep.equal([{ id: 'p.a', state: null }]);
        });
    });

    describe('terminate', () => {
        it('only warns and marks the adapter as disconnected when it is not a kill', async () => {
            const { adapter, library } = await createLibrary();
            library.setDeviceState('p.title', 'TV');

            const result = library.terminate('Plex not reachable');
            await flush();

            expect(result).to.equal(false);
            expect(adapter.logged('warn')).to.deep.equal(['Plex not reachable']);
            expect(adapter.lastValue('info.connection')).to.equal(false);
            expect(library.getDeviceState('p.title'), 'state cache is reset').to.equal(null);
            expect(adapter.timers).to.deep.equal([]);
            expect(adapter.terminations).to.deep.equal([]);
        });

        it('logs an error and terminates the adapter with exit code 11 after 5 s on kill', async () => {
            const { adapter, library } = await createLibrary();

            library.terminate('Fatal', true);

            expect(adapter.logged('error')).to.deep.equal(['Fatal']);
            expect(adapter.terminations, 'not before the timer fires').to.deep.equal([]);
            expect(adapter.timers.map(t => t.ms)).to.deep.equal([5000]);
            adapter.timers[0].cb();
            expect(adapter.terminations).to.deep.equal([{ reason: 'Fatal', exitCode: 11 }]);
        });

        it('uses the given exit code and a default message', async () => {
            const { adapter, library } = await createLibrary();

            library.terminate(undefined, true, 3);
            adapter.timers[0].cb();

            expect(adapter.terminations).to.have.length(1);
            expect(adapter.terminations[0].exitCode).to.equal(3);
            expect(adapter.terminations[0].reason).to.be.a('string').and.not.equal('');
        });
    });

    describe('extendState', () => {
        async function extended(library: Library, adapter: FakeAdapter, state: string): Promise<string[]> {
            adapter.extendAsyncCalls = [];
            await library.extendState(state);
            return adapter.extendAsyncCalls.map(c => c.id);
        }

        it('touches the object of a state whose node is known', async () => {
            const { adapter, library } = await createLibrary();

            expect(await extended(library, adapter, 'plex.0.playing.Metadata.title')).to.deep.equal([
                'plex.0.playing.Metadata.title',
            ]);
        });

        it('finds the node of a player state by skipping the player segment (_playing -> playing)', async () => {
            const { adapter, library } = await createLibrary();

            expect(await extended(library, adapter, 'plex.0._playing.tv-uuid1.Metadata.title')).to.deep.equal([
                'plex.0._playing.tv-uuid1.Metadata.title',
            ]);
        });

        it('leaves states alone whose node is unknown', async () => {
            const { adapter, library } = await createLibrary();

            expect(await extended(library, adapter, 'plex.0._playing.tv-uuid1.Metadata.unknownThing')).to.deep.equal(
                [],
            );
            expect(await extended(library, adapter, 'plex.0.somethingelse')).to.deep.equal([]);
        });

        it('skips _refresh states', async () => {
            const { adapter, library } = await createLibrary({
                nodes: { 'libraries._refresh': { description: 'Refresh', role: 'button', type: 'boolean' } },
            });

            expect(await extended(library, adapter, 'plex.0.libraries._refresh')).to.deep.equal([]);
        });

        it('handles control states via the action definitions, and only those with a type', async () => {
            const { adapter, library } = await createLibrary({
                actions: {
                    playback: { play: { type: 'boolean', role: 'button.play' }, legacy: { description: 'no type' } },
                },
            });

            expect(await extended(library, adapter, 'plex.0._playing.tv-uuid1._Controls.playback.play')).to.deep.equal([
                'plex.0._playing.tv-uuid1._Controls.playback.play',
            ]);
            expect(
                await extended(library, adapter, 'plex.0._playing.tv-uuid1._Controls.playback.legacy'),
            ).to.deep.equal([]);
            expect(
                await extended(library, adapter, 'plex.0._playing.tv-uuid1._Controls.playback.unknown'),
            ).to.deep.equal([]);
            expect(await extended(library, adapter, 'plex.0._playing.tv-uuid1._Controls.nomode.play')).to.deep.equal(
                [],
            );
        });

        // Pins a long-standing no-op (see CLAUDE.md "Do not fix long-standing NO-OPs"): extendState
        // has never changed type or role of an existing object. Changing that would rewrite the
        // objects of every existing installation on adapter start.
        it('does not overwrite type or role of the existing object', async () => {
            const { adapter, library } = await createLibrary();

            await library.extendState('plex.0.playing.Metadata.title');

            expect(adapter.extendAsyncCalls).to.have.length(1);
            expect(adapter.extendAsyncCalls[0].obj.common.type).to.equal(undefined);
            expect(adapter.extendAsyncCalls[0].obj.common.role).to.equal(undefined);
            expect(adapter.extendAsyncCalls[0].obj).to.not.have.property('type');
        });

        it('logs instead of throwing when the object cannot be extended', async () => {
            const { adapter, library } = await createLibrary();
            adapter.failExtendObjectAsync = new Error('DB closed');

            await library.extendState('plex.0.playing.Metadata.title');

            expect(adapter.logged('error')).to.deep.equal(['DB closed']);
        });

        it('finds the node of an event state under "events"', async () => {
            const { adapter, library } = await createLibrary();

            expect(await extended(library, adapter, 'plex.0.events.Account')).to.deep.equal(['plex.0.events.Account']);
        });

        // Finding (not fixed, see report): the fallback from "events.*" to the "playing.*" node
        // definitions never matches, because the first pass consumes the path segments. Without
        // user-visible effect as long as extendState does not change type/role (see above).
        it.skip('falls back to the "playing" definition for an event state without own definition', async () => {
            const { adapter, library } = await createLibrary();

            expect(await extended(library, adapter, 'plex.0.events.Metadata.title')).to.deep.equal([
                'plex.0.events.Metadata.title',
            ]);
        });
    });

    describe('readData', () => {
        const PREFIX = '_playing.tv-uuid1';

        it('writes a plain value into a state described by its node definition', async () => {
            const { adapter, library } = await createLibrary();

            await library.readData(`${PREFIX}.Metadata.title`, 'Alien', PREFIX);

            expect(adapter.createdIds()).to.deep.equal([`${PREFIX}.Metadata.title`]);
            expect(adapter.objectsFor(`${PREFIX}.Metadata.title`)[0].common).to.include({
                name: 'Title',
                role: 'media.title',
                type: 'string',
            });
            expect(adapter.lastValue(`${PREFIX}.Metadata.title`)).to.equal('Alien');
        });

        it('converts the value to the type of the node definition', async () => {
            const { adapter, library } = await createLibrary();

            await library.readData(`${PREFIX}.Metadata.year`, '1979', PREFIX);

            expect(adapter.lastValue(`${PREFIX}.Metadata.year`)).to.equal(1979);
        });

        it('creates a generic string state for a key without node definition', async () => {
            const { adapter, library } = await createLibrary();

            await library.readData(`${PREFIX}.Metadata.somethingNew`, 12, PREFIX);

            expect(adapter.objectsFor(`${PREFIX}.Metadata.somethingNew`)[0].common).to.include({
                role: 'state',
                type: 'string',
            });
            expect(adapter.lastValue(`${PREFIX}.Metadata.somethingNew`)).to.equal('12');
        });

        it('ignores undefined and the string "undefined"', async () => {
            const { adapter, library } = await createLibrary();

            expect(await library.readData(`${PREFIX}.Metadata.title`, undefined, PREFIX)).to.equal(false);
            expect(await library.readData(`${PREFIX}.Metadata.title`, 'undefined', PREFIX)).to.equal(false);

            expect(adapter.objectCalls).to.deep.equal([]);
            expect(adapter.stateCalls).to.deep.equal([]);
        });

        it('writes 0 and false, but creates nothing for an empty string', async () => {
            const { adapter, library } = await createLibrary();

            await library.readData(`${PREFIX}.Metadata.year`, 0, PREFIX);
            await library.readData(`${PREFIX}.Player.local`, false, PREFIX);
            await library.readData(`${PREFIX}.Metadata.title`, '', PREFIX);

            expect(adapter.lastValue(`${PREFIX}.Metadata.year`)).to.equal(0);
            expect(adapter.lastValue(`${PREFIX}.Player.local`)).to.equal(false);
            expect(adapter.createdIds()).to.not.include(`${PREFIX}.Metadata.title`);
        });

        it('creates a channel for an object and states for its members', async () => {
            const { adapter, library } = await createLibrary();

            await library.readData(`${PREFIX}.Metadata`, { title: 'Alien', year: 1979 }, PREFIX);

            expect(adapter.objectsFor(`${PREFIX}.Metadata`)[0].type).to.equal('channel');
            expect(adapter.objectsFor(`${PREFIX}.Metadata`)[0].common.name).to.equal('Metadata');
            expect(adapter.lastValue(`${PREFIX}.Metadata.title`)).to.equal('Alien');
            expect(adapter.lastValue(`${PREFIX}.Metadata.year`)).to.equal(1979);
        });

        it('names the channel of an undefined object "<Key> Information"', async () => {
            const { adapter, library } = await createLibrary();

            await library.readData(`${PREFIX}.account`, { id: 1 }, PREFIX);

            expect(adapter.objectsFor(`${PREFIX}.account`)[0].type).to.equal('channel');
            expect(adapter.objectsFor(`${PREFIX}.account`)[0].common.name).to.equal('Account Information');
        });

        it('stores nested objects additionally as JSON in "_data"', async () => {
            const { adapter, library } = await createLibrary();

            await library.readData(`${PREFIX}.Player`, { title: 'TV', details: { state: 'playing' } }, PREFIX);

            expect(adapter.lastValue(`${PREFIX}.Player.title`)).to.equal('TV');
            expect(adapter.lastValue(`${PREFIX}.Player.details._data`)).to.equal('{"state":"playing"}');
            expect(adapter.lastValue(`${PREFIX}.Player.details.state`)).to.equal('playing');
        });

        it('writes no "_data" copies when nested data is to be expanded only', async () => {
            const { adapter, library } = await createLibrary();

            await library.readData(`${PREFIX}.Player`, { details: { state: 'playing' } }, PREFIX, undefined, true);

            expect(adapter.lastValue(`${PREFIX}.Player.details.state`)).to.equal('playing');
            expect(adapter.createdIds()).to.not.include(`${PREFIX}.Player.details._data`);
        });

        it('creates nothing for an empty object', async () => {
            const { adapter, library } = await createLibrary();

            await library.readData(`${PREFIX}.Metadata`, {}, PREFIX);

            expect(adapter.objectCalls).to.deep.equal([]);
        });

        it('joins a list into one comma separated state when metadata trees are off', async () => {
            const { adapter, library } = await createLibrary();

            await library.readData(`${PREFIX}.Metadata.Genre`, [{ tag: 'Horror' }, { tag: 'Sci-Fi' }], PREFIX);

            expect(adapter.createdIds()).to.deep.equal([`${PREFIX}.Metadata.Genre`]);
            expect(adapter.objectsFor(`${PREFIX}.Metadata.Genre`)[0].common).to.include({
                name: 'Genres',
                role: 'media.genre',
            });
            expect(adapter.lastValue(`${PREFIX}.Metadata.Genre`)).to.equal('Horror, Sci-Fi');
        });

        it('picks url, id, tag or name of the list items, in that order', async () => {
            const { adapter, library } = await createLibrary();
            const list = [
                { url: 'http://a', id: 1, tag: 't', name: 'n' },
                { id: 2, tag: 't', name: 'n' },
                { tag: 'Tag', name: 'n' },
                { name: 'Name' },
            ];

            await library.readData(`${PREFIX}.Metadata.Things`, list, PREFIX);

            expect(adapter.lastValue(`${PREFIX}.Metadata.Things`)).to.equal('http://a, 2, Tag, Name');
        });

        it('creates nothing for an empty list', async () => {
            const { adapter, library } = await createLibrary();

            await library.readData(`${PREFIX}.Metadata.Genre`, [], PREFIX);

            expect(adapter.objectCalls).to.deep.equal([]);
        });

        it('expands a list into indexed sub-states instead of joining it when metadata trees are on', async () => {
            const { adapter, library } = await createLibrary({}, { getMetadataTrees: true });

            await library.readData(`${PREFIX}.Metadata.Genre`, [{ tag: 'Horror' }, { tag: 'Sci-Fi' }], PREFIX);

            expect(adapter.objectsFor(`${PREFIX}.Metadata.Genre.000`)[0].type).to.equal('channel');
            expect(adapter.objectsFor(`${PREFIX}.Metadata.Genre.000`)[0].common.name).to.equal('Index 000');
            expect(adapter.lastValue(`${PREFIX}.Metadata.Genre.000.tag`)).to.equal('Horror');
            expect(adapter.lastValue(`${PREFIX}.Metadata.Genre.001.tag`)).to.equal('Sci-Fi');
            expect(adapter.lastValue(`${PREFIX}.Metadata.Genre.001._data`)).to.equal('{"tag":"Sci-Fi"}');
            expect(adapter.valuesFor(`${PREFIX}.Metadata.Genre`)).to.not.include('Horror, Sci-Fi');
        });

        it('zero-pads list indexes to three digits', async () => {
            const { adapter, library } = await createLibrary({}, { getMetadataTrees: true });
            const list = Array.from({ length: 101 }, (_, i) => `item ${i}`);

            await library.readData('lists.items', list, 'lists');

            expect(adapter.lastValue('lists.items.000')).to.equal('item 0');
            expect(adapter.lastValue('lists.items.009')).to.equal('item 9');
            expect(adapter.lastValue('lists.items.010')).to.equal('item 10');
            expect(adapter.lastValue('lists.items.100')).to.equal('item 100');
        });

        // Finding (not fixed, see report): the index is cut to its last three digits, so entry 1000
        // is written into the states of entry 0 (and so on).
        it.skip('keeps list entries from index 1000 on apart from the first ones', async () => {
            const { adapter, library } = await createLibrary({}, { getMetadataTrees: true });
            const list = Array.from({ length: 1001 }, (_, i) => `item ${i}`);

            await library.readData('lists.items', list, 'lists');

            expect(adapter.valuesFor('lists.items.000')).to.deep.equal(['item 0']);
            expect(adapter.lastValue('lists.items.1000')).to.equal('item 1000');
        });

        it('uses the "playing" definition for an event key without own definition', async () => {
            const { adapter, library } = await createLibrary();

            await library.readData('events.Metadata.title', 'Alien', 'events');
            await library.readData('events.account', 'tim', 'events');

            expect(adapter.objectsFor('events.Metadata.title')[0].common).to.include({
                name: 'Title',
                role: 'media.title',
            });
            expect(adapter.objectsFor('events.account')[0].common.name).to.equal('Event account');
        });

        it('passes write options on, so an unchanged value can be forced', async () => {
            const { adapter, library } = await createLibrary();

            await library.readData(`${PREFIX}.Metadata.title`, 'Alien', PREFIX);
            await library.readData(`${PREFIX}.Metadata.title`, 'Alien', PREFIX);
            await library.readData(`${PREFIX}.Metadata.title`, 'Alien', PREFIX, { force: true });

            expect(adapter.valuesFor(`${PREFIX}.Metadata.title`)).to.deep.equal(['Alien', 'Alien']);
        });
    });

    describe('readData with the real node definitions (_NODES.json)', () => {
        const PREFIX = '_playing.tv-uuid1';
        const realNodes: Record<string, NodeDef> = JSON.parse(
            fs.readFileSync(path.join(__dirname, '..', '..', '_NODES.json'), 'utf8'),
        );

        async function createRealLibrary(): Promise<Setup> {
            const setup = await createLibrary({ nodes: JSON.parse(JSON.stringify(realNodes)) });
            setup.library.AXIOS_OPTIONS = { _protocol: 'http:' };
            return setup;
        }

        it('has only lower-case keys (anything else could never be looked up)', () => {
            expect(Object.keys(realNodes).filter(key => key !== key.toLowerCase())).to.deep.equal([]);
        });

        it('writes addedAt as timestamp plus a readable date with the correct month', async () => {
            const { adapter, library } = await createRealLibrary();
            // Local noon on 15 January 2023, whatever the local zone is.
            const ts = Math.floor(new Date(2023, 0, 15, 12).getTime() / 1000);

            await library.readData(`${PREFIX}.Metadata.addedAt`, ts, PREFIX);

            expect(adapter.lastValue(`${PREFIX}.Metadata.addedAt`)).to.equal(ts);
            expect(adapter.objectsFor(`${PREFIX}.Metadata.addedAt`)[0].common).to.include({ type: 'number' });
            expect(adapter.lastValue(`${PREFIX}.Metadata.addedAtDate`)).to.equal('2023-01-15');
            expect(adapter.objectsFor(`${PREFIX}.Metadata.addedAtDate`)[0].common).to.include({ type: 'string' });
        });

        it('writes viewOffset in milliseconds plus readable and seconds variants', async () => {
            const { adapter, library } = await createRealLibrary();

            await library.readData(`${PREFIX}.Metadata.viewOffset`, 3_723_000, PREFIX);

            expect(adapter.lastValue(`${PREFIX}.Metadata.viewOffset`)).to.equal(3_723_000);
            expect(adapter.lastValue(`${PREFIX}.Metadata.viewOffsethuman`)).to.equal('1:02');
            expect(adapter.lastValue(`${PREFIX}.Metadata.viewOffsetSeconds`)).to.equal(3723);
        });

        it('writes duration in minutes plus a seconds variant', async () => {
            const { adapter, library } = await createRealLibrary();

            await library.readData(`${PREFIX}.Metadata.duration`, 7_020_000, PREFIX);

            expect(adapter.lastValue(`${PREFIX}.Metadata.duration`)).to.equal(117);
            expect(adapter.lastValue(`${PREFIX}.Metadata.durationSeconds`)).to.equal(7020);
        });

        it('writes thumb as path plus a complete link', async () => {
            const { adapter, library } = await createRealLibrary();

            await library.readData(`${PREFIX}.Metadata.thumb`, '/library/metadata/5/thumb/17', PREFIX);

            expect(adapter.lastValue(`${PREFIX}.Metadata.thumb`)).to.equal('/library/metadata/5/thumb/17');
            expect(adapter.lastValue(`${PREFIX}.Metadata.thumb_link`)).to.equal(
                'http://192.0.2.10:32400/library/metadata/5/thumb/17?X-Plex-Token=SECRET-TOKEN',
            );
        });
    });

    describe('getItem', () => {
        function plexReturning(result: unknown): { plex: PlexHttp; paths: string[] } {
            const paths: string[] = [];
            const plex = {
                query: async (p: string): Promise<unknown> => {
                    paths.push(p);
                    return result;
                },
            } as unknown as PlexHttp;
            return { plex, paths };
        }

        it('returns the MediaContainer of the queried path', async () => {
            const { plex, paths } = plexReturning({ MediaContainer: { size: 1, Metadata: [{ title: 'Alien' }] } });
            const library = new Library(asAdapter(new FakeAdapter()), {}, plex);

            expect(await library.getItem('/library/metadata/5')).to.deep.equal({
                size: 1,
                Metadata: [{ title: 'Alien' }],
            });
            expect(paths).to.deep.equal(['/library/metadata/5']);
        });

        it('returns an empty object for a response without MediaContainer', async () => {
            for (const result of [undefined, null, '', {}, { other: 1 }]) {
                const library = new Library(asAdapter(new FakeAdapter()), {}, plexReturning(result).plex);

                expect(await library.getItem('/library/metadata/5')).to.deep.equal({});
            }
        });

        it('does not query for a missing path or without a Plex client', async () => {
            const { plex, paths } = plexReturning({ MediaContainer: { size: 1 } });
            const withPlex = new Library(asAdapter(new FakeAdapter()), {}, plex);
            const withoutPlex = new Library(asAdapter(new FakeAdapter()), {});

            expect(await withPlex.getItem('')).to.deep.equal({});
            expect(await withPlex.getItem(undefined as unknown as string)).to.deep.equal({});
            expect(await withoutPlex.getItem('/library/metadata/5')).to.deep.equal({});
            expect(paths).to.deep.equal([]);
        });
    });
});
