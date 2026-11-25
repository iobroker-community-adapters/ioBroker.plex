import { expect } from 'chai';
import { describe, it } from 'mocha';

import { Library, type NodeDef } from '../../src/lib/library';
import { asAdapter, FakeAdapter, flush } from './helpers/fakeAdapter';

const NODES: Record<string, NodeDef> = {
    'media.addedatdate': { description: 'Date added', role: 'text', type: 'string' },
    'media.viewoffsethuman': { description: 'Position (readable)', role: 'text', type: 'string' },
    'media.viewoffsetseconds': { description: 'Position in seconds', role: 'media.elapsed', type: 'number' },
    'media.durationseconds': { description: 'Duration in seconds', role: 'media.duration', type: 'number' },
    'media.thumburl': { description: 'Thumbnail link', role: 'url', type: 'string' },
};

async function createLibrary(config: Record<string, any> = {}): Promise<{ adapter: FakeAdapter; library: Library }> {
    const adapter = new FakeAdapter();
    Object.assign(adapter.config, config);
    const library = new Library(asAdapter(adapter), { nodes: JSON.parse(JSON.stringify(NODES)) });
    library.AXIOS_OPTIONS = { _protocol: 'http:' };
    await flush();
    adapter.resetRecords();
    return { adapter, library };
}

function dateNode(): NodeDef {
    return {
        convert: { func: 'date-timestamp' },
        key: 'media.addedAt',
        nodeKey: 'media.addedat',
        type: 'number',
        role: 'date',
    };
}

/**
 * Unix timestamp (seconds) of the given wall-clock time in the time zone the test runs in.
 * The expected `YYYY-MM-DD` of that instant is then, by construction, the date passed in —
 * whatever the local time zone is.
 *
 * @param year - full year
 * @param month - calendar month, 1 = January
 * @param day - day of month
 * @param hour - local hour
 * @param minute - local minute
 * @param second - local second
 */
function localUnix(year: number, month: number, day: number, hour = 12, minute = 0, second = 0): number {
    return Math.floor(new Date(year, month - 1, day, hour, minute, second).getTime() / 1000);
}

describe('Library.convertNode', () => {
    describe('return value', () => {
        it('returns a promise that resolves to the unchanged data when the node has no conversion', async () => {
            const { adapter, library } = await createLibrary();

            const result = library.convertNode({ type: 'string', role: 'text' }, 'Some Title');

            expect(result).to.be.an.instanceOf(Promise);
            expect(await result).to.equal('Some Title');
            expect(adapter.stateCalls).to.deep.equal([]);
        });

        it('passes data through for the fallback definition of an unknown node', async () => {
            const { library } = await createLibrary();

            expect(await library.convertNode(library.getNode('does.not.exist'), 42)).to.equal(42);
        });

        // Regression: the playlist code in main.ts used the return value without awaiting it, so the
        // state was written as the string "[object Promise]".
        it('resolves to the converted value, so an awaiting caller stores the value and not a Promise', async () => {
            const { adapter, library } = await createLibrary();
            const node: NodeDef = { convert: { func: 'ms-min' }, key: 'media.duration', nodeKey: 'media.duration' };

            const pending = library.convertNode(node, 5_400_000);
            expect(pending).to.be.an.instanceOf(Promise);

            const value = await pending;
            expect(value).to.equal(90);

            await library.set({ node: 'media.duration', description: 'Duration', type: 'number' }, value);
            expect(adapter.lastValue('media.duration')).to.equal(90);
        });
    });

    describe('date-timestamp', () => {
        // Regression: getMonth() is zero-based; the date used to be one month too early
        // (January came out as "00", December as "11").
        for (let month = 1; month <= 12; month++) {
            const expected = `2023-${String(month).padStart(2, '0')}-15`;
            it(`writes ${expected} for a timestamp on the 15th of month ${month}`, async () => {
                const { adapter, library } = await createLibrary();

                await library.convertNode(dateNode(), localUnix(2023, month, 15));

                expect(adapter.lastValue('media.addedAtDate')).to.equal(expected);
            });
        }

        it('handles the first and the last day of a year', async () => {
            const { adapter, library } = await createLibrary();

            await library.convertNode(dateNode(), localUnix(2024, 1, 1));
            expect(adapter.lastValue('media.addedAtDate')).to.equal('2024-01-01');

            await library.convertNode(dateNode(), localUnix(2024, 12, 31));
            expect(adapter.lastValue('media.addedAtDate')).to.equal('2024-12-31');
        });

        it('pads single-digit months and days and knows the leap day', async () => {
            const { adapter, library } = await createLibrary();

            await library.convertNode(dateNode(), localUnix(2021, 3, 5));
            expect(adapter.lastValue('media.addedAtDate')).to.equal('2021-03-05');

            await library.convertNode(dateNode(), localUnix(2024, 2, 29));
            expect(adapter.lastValue('media.addedAtDate')).to.equal('2024-02-29');
        });

        it('switches the month exactly at local midnight', async () => {
            const { adapter, library } = await createLibrary();

            await library.convertNode(dateNode(), localUnix(2024, 1, 31, 23, 59, 59));
            expect(adapter.lastValue('media.addedAtDate')).to.equal('2024-01-31');

            await library.convertNode(dateNode(), localUnix(2024, 2, 1, 0, 0, 0));
            expect(adapter.lastValue('media.addedAtDate')).to.equal('2024-02-01');
        });

        it('returns a numeric timestamp unchanged', async () => {
            const { library } = await createLibrary();
            const ts = localUnix(2023, 6, 15);

            expect(await library.convertNode(dateNode(), ts)).to.equal(ts);
        });

        it('accepts the timestamp as a numeric string', async () => {
            const { adapter, library } = await createLibrary();
            const ts = localUnix(2022, 11, 9);

            const result = await library.convertNode(dateNode(), String(ts));

            expect(adapter.lastValue('media.addedAtDate')).to.equal('2022-11-09');
            expect(Number(result)).to.equal(ts);
        });

        it('converts an ISO date into a unix timestamp in seconds and keeps the date text', async () => {
            const { adapter, library } = await createLibrary();

            const result = await library.convertNode(dateNode(), '2020-05-17');

            // A date-only ISO string is defined as UTC midnight, independent of the local zone.
            expect(result).to.equal(Date.UTC(2020, 4, 17) / 1000);
            expect(adapter.lastValue('media.addedAtDate')).to.equal('2020-05-17');
        });

        it('converts an ISO date-time with explicit zone into whole seconds', async () => {
            const { library } = await createLibrary();

            const result = await library.convertNode(dateNode(), '2020-05-17T10:30:15.900Z');

            expect(result).to.equal(Date.UTC(2020, 4, 17, 10, 30, 15) / 1000);
        });

        it('creates the companion "<key>Date" state as text with the description of its own node', async () => {
            const { adapter, library } = await createLibrary();

            await library.convertNode(dateNode(), localUnix(2023, 6, 15));

            expect(adapter.createdIds()).to.deep.equal(['media.addedAtDate']);
            const [obj] = adapter.objectsFor('media.addedAtDate');
            expect(obj.type).to.equal('state');
            expect(obj.common).to.include({ name: 'Date added', type: 'string', role: 'text', write: false });
        });
    });

    describe('seconds-readable', () => {
        function offsetNode(): NodeDef {
            return { convert: { func: 'seconds-readable' }, key: 'media.viewOffset', nodeKey: 'media.viewoffset' };
        }

        const cases: Array<{ ms: number; human: string; seconds: number; label: string }> = [
            { ms: 0, human: '0:00', seconds: 0, label: 'zero' },
            { ms: 59_999, human: '0:59', seconds: 59, label: 'just under a minute' },
            { ms: 125_000, human: '2:05', seconds: 125, label: 'minutes and padded seconds' },
            { ms: 3_599_000, human: '59:59', seconds: 3599, label: 'just under an hour' },
            { ms: 3_600_000, human: '1:00', seconds: 3600, label: 'exactly one hour' },
            { ms: 3_723_000, human: '1:02', seconds: 3723, label: 'hours and padded minutes' },
            { ms: 37_230_000, human: '10:20', seconds: 37_230, label: 'two-digit hours' },
        ];

        for (const c of cases) {
            it(`formats ${c.ms} ms as "${c.human}" (${c.label})`, async () => {
                const { adapter, library } = await createLibrary();

                const result = await library.convertNode(offsetNode(), c.ms);

                expect(adapter.lastValue('media.viewOffsethuman')).to.equal(c.human);
                expect(adapter.lastValue('media.viewOffsetSeconds')).to.equal(c.seconds);
                expect(result, 'the millisecond value itself stays untouched').to.equal(c.ms);
            });
        }

        it('does not depend on the local time zone offset (uses elapsed time, not wall-clock time)', async () => {
            const { adapter, library } = await createLibrary();

            // 23h 59m: any zone-dependent implementation would shift the hour for most zones.
            await library.convertNode(offsetNode(), 86_340_000);

            expect(adapter.lastValue('media.viewOffsethuman')).to.equal('23:59');
        });

        it('accepts the millisecond value as a string', async () => {
            const { adapter, library } = await createLibrary();

            await library.convertNode(offsetNode(), '125000');

            expect(adapter.lastValue('media.viewOffsethuman')).to.equal('2:05');
            expect(adapter.lastValue('media.viewOffsetSeconds')).to.equal(125);
        });

        it('creates the seconds state as a number with role media.elapsed', async () => {
            const { adapter, library } = await createLibrary();

            await library.convertNode(offsetNode(), 125_000);

            expect(adapter.objectsFor('media.viewOffsetSeconds')[0].common).to.include({
                name: 'Position in seconds',
                type: 'number',
                role: 'media.elapsed',
            });
            expect(adapter.objectsFor('media.viewOffsethuman')[0].common).to.include({
                name: 'Position (readable)',
                type: 'string',
                role: 'text',
            });
        });
    });

    describe('ms-min', () => {
        function durationNode(): NodeDef {
            return { convert: { func: 'ms-min' }, key: 'media.duration', nodeKey: 'media.duration' };
        }

        it('converts milliseconds into whole minutes and stores whole seconds next to it', async () => {
            const { adapter, library } = await createLibrary();

            const result = await library.convertNode(durationNode(), 5_430_500);

            expect(result).to.equal(90);
            expect(adapter.lastValue('media.durationSeconds')).to.equal(5430);
            expect(adapter.objectsFor('media.durationSeconds')[0].common).to.include({
                type: 'number',
                role: 'media.duration',
            });
        });

        it('rounds a duration below one minute down to 0 minutes', async () => {
            const { adapter, library } = await createLibrary();

            expect(await library.convertNode(durationNode(), 59_000)).to.equal(0);
            expect(adapter.lastValue('media.durationSeconds')).to.equal(59);
        });

        it('treats values below 1000 as already being minutes and derives the seconds from them', async () => {
            const { adapter, library } = await createLibrary();

            expect(await library.convertNode(durationNode(), 90)).to.equal(90);
            expect(adapter.lastValue('media.durationSeconds')).to.equal(5400);
        });

        it('switches from the minutes to the milliseconds interpretation at 1000', async () => {
            const { adapter, library } = await createLibrary();

            expect(await library.convertNode(durationNode(), 999)).to.equal(999);
            expect(adapter.lastValue('media.durationSeconds')).to.equal(59_940);

            expect(await library.convertNode(durationNode(), 1000)).to.equal(0);
            expect(adapter.lastValue('media.durationSeconds')).to.equal(1);
        });
    });

    describe('create-link / create-link-only', () => {
        function linkNode(func: string): NodeDef {
            return {
                convert: { func, key: 'Url', type: 'string', role: 'url' },
                key: 'media.thumb',
                nodeKey: 'media.thumb',
            };
        }

        it('create-link-only returns the full link with the token', async () => {
            const { adapter, library } = await createLibrary();

            const result = await library.convertNode(linkNode('create-link-only'), '/library/metadata/5/thumb/17');

            expect(result).to.equal('http://192.0.2.10:32400/library/metadata/5/thumb/17?X-Plex-Token=SECRET-TOKEN');
            expect(adapter.stateCalls, 'no companion state').to.deep.equal([]);
        });

        it('create-link keeps the path as value and writes the link into the companion state', async () => {
            const { adapter, library } = await createLibrary();

            const result = await library.convertNode(linkNode('create-link'), '/library/metadata/5/thumb/17');

            expect(result).to.equal('/library/metadata/5/thumb/17');
            expect(adapter.lastValue('media.thumbUrl')).to.equal(
                'http://192.0.2.10:32400/library/metadata/5/thumb/17?X-Plex-Token=SECRET-TOKEN',
            );
            expect(adapter.objectsFor('media.thumbUrl')[0].common).to.include({
                name: 'Thumbnail link',
                type: 'string',
                role: 'url',
            });
        });

        it('replaces the token by a placeholder when tokenInLinks is switched off', async () => {
            const { library } = await createLibrary({ tokenInLinks: false });

            const result = await library.convertNode(linkNode('create-link-only'), '/photo/1');

            expect(result).to.equal('http://192.0.2.10:32400/photo/1?X-Plex-Token=__PLEX_TOKEN__');
            expect(result).to.not.contain('SECRET-TOKEN');
        });

        it('keeps the token in the link when tokenInLinks is not configured at all (older configs)', async () => {
            const { library } = await createLibrary({ tokenInLinks: undefined });

            const result = await library.convertNode(linkNode('create-link-only'), '/photo/1');

            expect(result).to.equal('http://192.0.2.10:32400/photo/1?X-Plex-Token=SECRET-TOKEN');
        });

        it('uses the configured protocol, host and port', async () => {
            const { library } = await createLibrary({ plexIp: 'plex.example', plexPort: 443 });
            library.AXIOS_OPTIONS = { _protocol: 'https:' };

            const result = await library.convertNode(linkNode('create-link-only'), '/photo/1');

            expect(result).to.equal('https://plex.example:443/photo/1?X-Plex-Token=SECRET-TOKEN');
        });

        it('yields an empty link (and no token) for an empty path', async () => {
            const { adapter, library } = await createLibrary();

            expect(await library.convertNode(linkNode('create-link-only'), '')).to.equal('');

            expect(await library.convertNode(linkNode('create-link'), '')).to.equal('');
            expect(adapter.stateCalls, 'no link state for an empty path').to.deep.equal([]);
        });
    });

    describe('unknown conversions', () => {
        it('passes data through for an unknown function name', async () => {
            const { adapter, library } = await createLibrary();

            const result = await library.convertNode({ convert: { func: 'no-such-func' }, key: 'a', nodeKey: 'a' }, 7);

            expect(result).to.equal(7);
            expect(adapter.stateCalls).to.deep.equal([]);
        });

        it('passes data through when "convert" is only a marker string (as on the "...date" nodes)', async () => {
            const { adapter, library } = await createLibrary();

            const result = await library.convertNode(
                { convert: 'date-timestamp', key: 'a', nodeKey: 'a' },
                '2020-05-17',
            );

            expect(result).to.equal('2020-05-17');
            expect(adapter.stateCalls).to.deep.equal([]);
        });
    });
});
