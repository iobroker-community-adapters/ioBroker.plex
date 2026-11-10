/**
 * The latest events of the Plex server as a web component: `<iob-plex-activity>` - the timeline of the www page of
 * the adapter (`src-www/src/components/Timeline.tsx`, `TimelineEntry.tsx`).
 *
 * One module for every host - vis-2, devices, Aura, admin (`@iobroker/web-components`). Its manifest is a file of
 * its own (`plex-activity.json`, written by the build from `manifest.ts`), so a host loads this module only when it
 * shows the element. The host sets `socket` and `settings`, and if it has them `theme`, `editMode` and `dialogs`.
 *
 * The events come from the state `plex.<n>.events.history`, newest first and grouped by day. A click on an event
 * shows all it carries in an element dialog that the host frames.
 *
 * React is not in the module: it comes from `lib/esm/react-19.js` beside `adapter/`, see `vite.config.ts`.
 */
import { useState, type JSX } from 'react';
import { createRoot } from 'react-dom/client';

import { defineWebComponent, getThemeCssVariables } from '@iobroker/web-components/element';

import { ACTIVITY_TAG, getNamespace, type ActivitySettings } from './constants';
import { dayKey, formatClock, formatDateTime, formatDay } from './format';
import { formatEpisode, isPlaybackEvent, parseHistory, type HistoryEvent } from './history';
import type { WordKey } from './i18n';
import { getEventIcon, Icon } from './icons';
import { Hint, PlexElement } from './PlexElement';
import { ACTIVITY_STYLES, DETAILS_STYLES } from './styles';

/** How many events are shown if the setting has no value */
const DEFAULT_COUNT = 30;

/** The keys of an event that the entry shows itself; the dialog lists the others */
const SHOWN_KEYS = new Set([
    'id',
    'timestamp',
    'datetime',
    'event',
    'message',
    'caption',
    'thumb',
    'season',
    'episode',
]);

/** The keys the dialog names in the language of the system */
const KEY_WORDS: Record<string, WordKey> = {
    account: 'account',
    player: 'player',
    media: 'media',
    source: 'source',
};

interface DayGroup {
    key: string;
    label: string;
    events: HistoryEvent[];
}

/** A cover that hides itself when it cannot be loaded */
function Thumb({ src, className }: { src: string; className?: string }): JSX.Element | null {
    const [failed, setFailed] = useState('');
    if (!src || failed === src) {
        return null;
    }
    return (
        <img
            className={className}
            src={src}
            alt=""
            referrerPolicy="no-referrer"
            onError={() => setFailed(src)}
        />
    );
}

interface EntryProps {
    event: HistoryEvent;
    showCovers: boolean;
    editMode: boolean;
    lang: string;
    onOpen: (event: HistoryEvent) => void;
}

function Entry({ event, showCovers, editMode, lang, onOpen }: EntryProps): JSX.Element {
    const time = event.timestamp ? formatClock(event.timestamp * 1000, lang) : '';
    const episode = formatEpisode(event.season, event.episode);
    const when = [time, episode, event.source].filter(Boolean).join(' · ');
    return (
        <button
            type="button"
            className="entry"
            disabled={editMode}
            onClick={() => onOpen(event)}
        >
            <span className="badge">
                <Icon name={getEventIcon(event.event)} />
            </span>
            {showCovers && event.thumb ? (
                <Thumb
                    className="thumb"
                    src={event.thumb}
                />
            ) : null}
            <span className="text">
                <span className="message">{event.message || event.event}</span>
                {event.caption ? <span className="caption">{event.caption}</span> : null}
                {when ? <span className="when">{when}</span> : null}
            </span>
        </button>
    );
}

/** What an event carries besides what its entry shows */
function getDetails(event: HistoryEvent, lang: string, word: (key: WordKey) => string): [string, string][] {
    const details: [string, string][] = [];
    if (event.timestamp) {
        details.push([word('time'), formatDateTime(event.timestamp * 1000, lang)]);
    }
    for (const [key, value] of Object.entries(event)) {
        if (SHOWN_KEYS.has(key)) {
            continue;
        }
        let text = '';
        if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
            text = String(value);
        } else if (Array.isArray(value)) {
            text = value.filter(item => typeof item !== 'object').join(', ');
        }
        if (text) {
            details.push([KEY_WORDS[key] ? word(KEY_WORDS[key]) : key, text]);
        }
    }
    return details;
}

/** The content of the dialog of an event */
function Details({
    event,
    lang,
    word,
}: {
    event: HistoryEvent;
    lang: string;
    word: (key: WordKey) => string;
}): JSX.Element {
    return (
        <div className="details">
            {event.thumb ? <Thumb src={event.thumb} /> : null}
            <div className="text">
                {event.caption ? <p className="caption">{event.caption}</p> : null}
                <dl>
                    {getDetails(event, lang, word).map(([key, value]) => (
                        <div
                            key={key}
                            style={{ display: 'contents' }}
                        >
                            <dt>{key}</dt>
                            <dd>{value}</dd>
                        </div>
                    ))}
                </dl>
            </div>
        </div>
    );
}

class PlexActivity extends PlexElement<ActivitySettings> {
    constructor() {
        super(ACTIVITY_STYLES);
    }

    protected override getWantedIds(settings: ActivitySettings): string[] {
        const namespace = getNamespace(settings.instance);
        return namespace ? [`${namespace}.events.history`] : [];
    }

    /** The events to show, grouped by day */
    #getGroups(namespace: string): DayGroup[] {
        const settings = this.settings;
        const lang = this.systemLang;
        const count = Math.max(1, Math.round(Number(settings.count) || DEFAULT_COUNT));
        let events = parseHistory(this.states[`${namespace}.events.history`]?.val);
        if (settings.playbackOnly) {
            events = events.filter(event => isPlaybackEvent(event.event));
        }
        const groups: DayGroup[] = [];
        for (const event of events.slice(0, count)) {
            const ms = (Number(event.timestamp) || 0) * 1000;
            const key = ms ? dayKey(ms) : '';
            let group = groups[groups.length - 1];
            if (!group || group.key !== key) {
                group = {
                    key,
                    label: ms ? formatDay(ms, lang, this.word('today'), this.word('yesterday')) : '',
                    events: [],
                };
                groups.push(group);
            }
            group.events.push(event);
        }
        return groups;
    }

    /** All that an event carries, in an element dialog of the host */
    #onOpen = (event: HistoryEvent): void => {
        if (this.editMode) {
            return;
        }
        const element = document.createElement('div');
        // the host moves the content into its dialog, out of this element: it takes the theme along
        for (const [name, value] of Object.entries(getThemeCssVariables(this.theme))) {
            element.style.setProperty(name, value);
        }
        const shadow = element.attachShadow({ mode: 'open' });
        const style = document.createElement('style');
        style.textContent = DETAILS_STYLES;
        const mount = document.createElement('div');
        shadow.append(style, mount);
        const root = createRoot(mount);
        root.render(
            <Details
                event={event}
                lang={this.systemLang}
                word={this.word}
            />,
        );
        void this.openDialog({ title: event.message || event.event, element, width: 600 }).finally(() =>
            root.unmount(),
        );
    };

    protected override draw(): JSX.Element {
        const settings = this.settings;
        const namespace = getNamespace(settings.instance);
        if (!namespace) {
            return (
                <Hint
                    text={this.word(settings.instance ? 'notInstance' : 'chooseInstance')}
                    icon="history"
                    editMode={this.editMode}
                />
            );
        }
        const state = this.states[`${namespace}.events.history`];
        if (state === undefined) {
            // not read yet
            return <div className="activity" />;
        }
        const groups = this.#getGroups(namespace);
        if (!groups.length) {
            return (
                <Hint
                    text={this.word('noEvents')}
                    icon="history"
                    editMode={this.editMode}
                />
            );
        }
        const lang = this.systemLang;
        return (
            <div className={`activity scroll${this.editMode ? ' edit' : ''}`}>
                {groups.map(group => (
                    <section key={group.key}>
                        {group.label ? <div className="day">{group.label}</div> : null}
                        {group.events.map((event, i) => (
                            <Entry
                                key={event.id || `${group.key}-${i}`}
                                event={event}
                                showCovers={settings.showCovers !== false}
                                editMode={this.editMode}
                                lang={lang}
                                onOpen={this.#onOpen}
                            />
                        ))}
                    </section>
                ))}
            </div>
        );
    }
}

defineWebComponent(ACTIVITY_TAG, PlexActivity);
