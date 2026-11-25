/**
 * The top users and libraries by watch time, from Tautulli, as a web component: `<iob-plex-stats>` - the
 * "Tautulli Statistics" part of the www page of the adapter (`src-www/src/components/TautulliStats.tsx`).
 *
 * One module for every host - vis-2, devices, Aura, admin (`@iobroker/web-components`). Its manifest is a file of
 * its own (`plex-stats.json`, written by the build from `manifest.ts`), so a host loads this module only when it
 * shows the element. The host sets `socket` and `settings`, and if it has them `theme` and `editMode`.
 *
 * The adapter writes the statistics of Tautulli below `plex.<n>.statistics.users.<user>.<period>` and
 * `plex.<n>.statistics.libraries.<library>.<period>` (`total_time` in seconds, `total_plays`), for the periods
 * `01-last_24h`, `02-last_7d`, `03-last_30d` and `00-all_time`. The users and libraries are found with
 * `getObjectViewSystem` - and looked for again from time to time; the element subscribes the states of the period shown and the names of the users
 * (`users.<user>.friendly_name`) and libraries (`libraries.<library>.title`). The period can be switched in the
 * element; the setting chooses the one it starts with.
 *
 * React is not in the module: it comes from `lib/esm/react-19.js` beside `adapter/`, see `vite.config.ts`.
 */
import type { CSSProperties, JSX } from 'react';

import type { WebComponentSocket } from '@iobroker/web-components';
import { defineWebComponent } from '@iobroker/web-components/element';

import { getNamespace, STATS_TAG, type StatsPeriod, type StatsSettings } from './constants';
import { formatDuration } from './format';
import type { WordKey } from './i18n';
import { Icon } from './icons';
import { Hint, PlexElement } from './PlexElement';
import { STATS_STYLES } from './styles';

/** How many entries per list if the setting has no value */
const DEFAULT_COUNT = 5;

/**
 * How long to wait before the users and libraries are looked for again while there are none - the adapter may just
 * start, Tautulli may answer later, or the read failed: after the first and the second try. Then as seldom as below.
 */
const RETRY_SUBJECTS_MS = [5_000, 30_000];

/** How long to wait before the users and libraries are looked for again, to find new ones */
const RELOAD_SUBJECTS_MS = 300_000;

/** The channel of each period below a user or a library, as the adapter names them */
const PERIOD_CHANNELS: Record<StatsPeriod, string> = {
    '24h': '01-last_24h',
    '7d': '02-last_7d',
    '30d': '03-last_30d',
    all: '00-all_time',
};

const PERIODS: { period: StatsPeriod; word: WordKey }[] = [
    { period: '24h', word: 'period24h' },
    { period: '7d', word: 'period7d' },
    { period: '30d', word: 'period30d' },
    { period: 'all', word: 'periodAll' },
];

type Kind = 'users' | 'libraries';

/** A user or a library with statistics */
interface Subject {
    kind: Kind;
    /** The last part of its channel: the user name in lower case, or `<key>-<title>` of a library */
    id: string;
}

interface Row {
    name: string;
    plays: number;
    seconds: number;
}

function isPeriod(value: unknown): value is StatsPeriod {
    return typeof value === 'string' && value in PERIOD_CHANNELS;
}

/**
 * The users and libraries among the channels below `plex.<n>.statistics.`
 *
 * @param namespace `plex.<n>`
 * @param channels what `getObjectViewSystem('channel', ...)` returned for that range
 */
function toSubjects(namespace: string, channels: Record<string, ioBroker.AnyObject>): Subject[] {
    const subjects: Subject[] = [];
    const periods = Object.values(PERIOD_CHANNELS);
    for (const id of Object.keys(channels)) {
        // a user or library is what has the channel of a period below it: the title of a library - and so its
        // ID - may contain dots ("3-tv 2.0")
        const match = id.slice(namespace.length + 1).match(/^statistics\.(users|libraries)\.(.+)\.([^.]+)$/);
        if (
            match &&
            periods.includes(match[3]) &&
            !subjects.some(subject => subject.kind === match[1] && subject.id === match[2])
        ) {
            subjects.push({ kind: match[1] as Kind, id: match[2] });
        }
    }
    return subjects;
}

/**
 * The lists the settings ask for
 *
 * @param settings the settings of the element
 */
function getKinds(settings: StatsSettings): Kind[] {
    if (settings.show === 'users') {
        return ['users'];
    }
    if (settings.show === 'libraries') {
        return ['libraries'];
    }
    return ['users', 'libraries'];
}

/**
 * The IDs of a user or a library: its total time and plays in the period, and its name
 *
 * @param namespace `plex.<n>`
 * @param subject the user or library
 * @param period the period shown
 */
function getIds(
    namespace: string,
    subject: Subject,
    period: StatsPeriod,
): { time: string; plays: string; name: string } {
    const base = `${namespace}.statistics.${subject.kind}.${subject.id}.${PERIOD_CHANNELS[period]}`;
    return {
        time: `${base}.total_time`,
        plays: `${base}.total_plays`,
        name:
            subject.kind === 'users'
                ? `${namespace}.users.${subject.id}.friendly_name`
                : `${namespace}.libraries.${subject.id}.title`,
    };
}

function List({ title, rows, word }: { title: string; rows: Row[]; word: (key: WordKey) => string }): JSX.Element {
    const max = Math.max(1, ...rows.map(row => row.seconds));
    return (
        <div className="list">
            <h3>{title}</h3>
            {rows.length ? (
                rows.map((row, i) => (
                    <div
                        key={row.name}
                        className="entry"
                        style={{ '--share': `${(row.seconds / max) * 100}%` } as CSSProperties}
                    >
                        <span className="rank">{i + 1}</span>
                        <span
                            className="name"
                            title={row.name}
                        >
                            {row.name}
                        </span>
                        <span className="watch">{formatDuration(row.seconds)}</span>
                        <span
                            className="plays"
                            title={`${row.plays} ${word('plays')}`}
                        >
                            {row.plays} <Icon name="play" />
                        </span>
                    </div>
                ))
            ) : (
                <div className="none">{word('noData')}</div>
            )}
        </div>
    );
}

class PlexStats extends PlexElement<StatsSettings> {
    /** The users and libraries of `#subjectsFor`; null while they are read */
    #subjects: Subject[] | null = null;

    #subjectsFor = '';

    #subjectsSocket: WebComponentSocket | null = null;

    /** When the users and libraries were looked for last, in ms */
    #subjectsAskedAt = 0;

    /** How often in a row none were found, or the read failed */
    #subjectsMisses = 0;

    /** The period the user picked in the element; null: the one of the settings */
    #picked: StatsPeriod | null = null;

    /** The period of the settings when the user picked one: a new setting takes over again */
    #pickedFrom: unknown = undefined;

    constructor() {
        super(STATS_STYLES);
    }

    #getPeriod(settings: StatsSettings): StatsPeriod {
        if (this.#picked && this.#pickedFrom === settings.period) {
            return this.#picked;
        }
        return isPeriod(settings.period) ? settings.period : '7d';
    }

    #getSubjects(namespace: string): Subject[] | null {
        return namespace === this.#subjectsFor && this.socket === this.#subjectsSocket ? this.#subjects : null;
    }

    protected override getWantedIds(settings: StatsSettings): string[] {
        const namespace = getNamespace(settings.instance);
        const subjects = namespace ? this.#getSubjects(namespace) : null;
        if (!namespace || !subjects) {
            return [];
        }
        const period = this.#getPeriod(settings);
        const kinds = getKinds(settings);
        return subjects
            .filter(subject => kinds.includes(subject.kind))
            .flatMap(subject => Object.values(getIds(namespace, subject, period)));
    }

    /**
     * Find the users and libraries with statistics: once per instance and socket - and again later, as they may
     * appear after the element (the adapter starts, a new user) and a read may fail: soon while there are none,
     * seldom to find new ones. What is known stays until a read gives something else.
     */
    #loadSubjects(namespace: string): void {
        const socket = this.socket;
        if (!socket) {
            return;
        }
        if (namespace === this.#subjectsFor && socket === this.#subjectsSocket) {
            const wait = this.#subjects?.length
                ? RELOAD_SUBJECTS_MS
                : (RETRY_SUBJECTS_MS[Math.max(0, this.#subjectsMisses - 1)] ?? RELOAD_SUBJECTS_MS);
            if (this.#subjectsAskedAt + wait > Date.now()) {
                // draw again then, even if no state changes in between
                this.drawAt(this.#subjectsAskedAt + wait);
                return;
            }
        } else {
            this.#subjects = null;
            this.#subjectsMisses = 0;
        }
        this.#subjectsFor = namespace;
        this.#subjectsSocket = socket;
        this.#subjectsAskedAt = Date.now();
        const prefix = `${namespace}.statistics.`;
        socket
            .getObjectViewSystem('channel', prefix, `${prefix}香`)
            .then(channels => toSubjects(namespace, channels))
            .catch((error: unknown) => {
                console.warn(`<${this.localName}>: cannot read the statistics of ${namespace}: ${String(error)}`);
                return null;
            })
            .then(subjects => {
                if (namespace === this.#subjectsFor && socket === this.#subjectsSocket) {
                    this.#subjectsMisses = subjects?.length ? 0 : this.#subjectsMisses + 1;
                    this.#subjects = subjects || this.#subjects || [];
                    this.resubscribe();
                }
            })
            .catch(() => undefined);
    }

    #getRows(namespace: string, subjects: Subject[], kind: Kind, period: StatsPeriod): Row[] {
        const count = Math.max(1, Math.round(Number(this.settings.count) || DEFAULT_COUNT));
        return subjects
            .filter(subject => subject.kind === kind)
            .map(subject => {
                const ids = getIds(namespace, subject, period);
                const name = this.states[ids.name]?.val;
                return {
                    name:
                        typeof name === 'string' && name
                            ? name
                            : kind === 'libraries'
                              ? subject.id.replace(/^\d+-/, '')
                              : subject.id,
                    plays: Number(this.states[ids.plays]?.val) || 0,
                    seconds: Number(this.states[ids.time]?.val) || 0,
                };
            })
            .filter(row => row.plays > 0 || row.seconds > 0)
            .sort((a, b) => b.seconds - a.seconds || b.plays - a.plays)
            .slice(0, count);
    }

    #pick(period: StatsPeriod): void {
        if (this.editMode) {
            return;
        }
        this.#picked = period;
        this.#pickedFrom = this.settings.period;
        this.resubscribe();
    }

    protected override draw(): JSX.Element {
        const settings = this.settings;
        const namespace = getNamespace(settings.instance);
        if (!namespace) {
            return (
                <Hint
                    text={this.word(settings.instance ? 'notInstance' : 'chooseInstance')}
                    icon="chart"
                    editMode={this.editMode}
                />
            );
        }
        this.#loadSubjects(namespace);
        const subjects = this.#getSubjects(namespace);
        if (!subjects) {
            // not read yet
            return <div className="stats" />;
        }
        const kinds = getKinds(settings);
        if (!subjects.some(subject => kinds.includes(subject.kind))) {
            return (
                <Hint
                    text={this.word('noStats')}
                    icon="chart"
                    editMode={this.editMode}
                />
            );
        }
        const period = this.#getPeriod(settings);
        return (
            <div className={`stats${this.editMode ? ' edit' : ''}`}>
                <div className="periods">
                    {PERIODS.map(entry => (
                        <button
                            key={entry.period}
                            type="button"
                            className={entry.period === period ? 'active' : undefined}
                            aria-pressed={entry.period === period}
                            disabled={this.editMode}
                            onClick={() => this.#pick(entry.period)}
                        >
                            {this.word(entry.word)}
                        </button>
                    ))}
                </div>
                <div className={`lists scroll${kinds.length > 1 ? ' both' : ''}`}>
                    {kinds.map(kind => (
                        <List
                            key={kind}
                            title={this.word(kind === 'users' ? 'topUsers' : 'topLibraries')}
                            rows={this.#getRows(namespace, subjects, kind, period)}
                            word={this.word}
                        />
                    ))}
                </div>
            </div>
        );
    }
}

defineWebComponent(STATS_TAG, PlexStats);
