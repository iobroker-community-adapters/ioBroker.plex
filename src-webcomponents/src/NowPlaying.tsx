/**
 * What is playing right now on which Plex player, as a web component: `<iob-plex-now-playing>` - the "Now Playing"
 * part of the www page of the adapter (`src-www/src/components/NowPlaying.tsx`).
 *
 * One module for every host - vis-2, devices, Aura, admin (`@iobroker/web-components`). Its manifest is a file of
 * its own (`plex-now-playing.json`, written by the build from `manifest.ts`), so a host loads this module only when
 * it shows the element. The host sets `socket` and `settings`, and if it has them `theme` and `editMode`.
 *
 * The streams come from `plex.<n>.events.history`, as on the www page: the last playback event per player (see
 * `history.ts`). The player channels below `plex.<n>._playing` are read once (`getObjectViewSystem`), and again when
 * a player appears that is not among them; from its channel the element takes the position and the length of the
 * item and - for players that can be controlled through the Plex server - the buttons of `_Controls.playback`.
 *
 * React is not in the module: it comes from `lib/esm/react-19.js` beside `adapter/`, see `vite.config.ts`.
 */
import { useState, type JSX } from 'react';

import type { WebComponentSocket } from '@iobroker/web-components';
import { defineWebComponent } from '@iobroker/web-components/element';

import { getNamespace, NOW_PLAYING_TAG, type NowPlayingSettings } from './constants';
import { formatTime } from './format';
import { formatEpisode, getActiveStreams, parseHistory, type ActiveStream } from './history';
import type { WordKey } from './i18n';
import { getMediaIcon, Icon, type IconName } from './icons';
import { Hint, PlexElement } from './PlexElement';
import {
    findPlayerChannel,
    getPlayerChannelId,
    isChannelOf,
    toPlayerChannels,
    type PlayerButton,
    type PlayerChannel,
} from './players';
import { NOW_PLAYING_STYLES } from './styles';

/** How long to wait before the player channels are read again for a new player that is not among them */
const NEW_PLAYER_DELAY_MS = 5_000;

/** How long to wait before the player channels are read again for the same players without a channel */
const RELOAD_CHANNELS_MS = 300_000;

/** A stream with what its player channel tells */
interface StreamEntry {
    stream: ActiveStream;
    /** The player channel, if it was found */
    channel: string | null;
    /** Seconds; null if unknown */
    elapsed: number | null;
    /** Seconds; null if unknown */
    duration: number | null;
    /** Whether the buttons of the player are shown */
    controllable: boolean;
}

interface ViewProps {
    entries: StreamEntry[];
    compact: boolean;
    showCover: boolean;
    editMode: boolean;
    word: (key: WordKey) => string;
    onCommand: (channel: string, button: PlayerButton) => void;
}

/** The cover, or the picture of the type of the item if there is none or it cannot be loaded */
function Cover({ thumb, media }: { thumb?: string; media?: string }): JSX.Element {
    const [failed, setFailed] = useState('');
    const square = media === 'track' || media === 'album' || media === 'artist';
    return (
        <div className={`cover${square ? ' square' : ''}`}>
            {thumb && failed !== thumb ? (
                <img
                    src={thumb}
                    alt=""
                    referrerPolicy="no-referrer"
                    onError={() => setFailed(thumb)}
                />
            ) : (
                <Icon name={getMediaIcon(media)} />
            )}
        </div>
    );
}

/** The bar with the position, and the times beside it if `withTimes` */
function Progress({ entry, withTimes }: { entry: StreamEntry; withTimes: boolean }): JSX.Element | null {
    const { elapsed, duration } = entry;
    if (elapsed === null && duration === null) {
        return null;
    }
    const share = duration ? Math.min(100, Math.max(0, ((elapsed || 0) / duration) * 100)) : 0;
    const bar = duration ? (
        <div className={withTimes ? 'bar' : 'bar line'}>
            <span style={{ width: `${share}%` }} />
        </div>
    ) : null;
    if (!withTimes) {
        return bar;
    }
    const times = duration ? `${formatTime(elapsed || 0)} / ${formatTime(duration)}` : formatTime(elapsed || 0);
    return (
        <div className="progress">
            {bar}
            <span className="time">{times}</span>
        </div>
    );
}

interface ButtonProps {
    icon: IconName;
    label: string;
    className?: string;
    disabled: boolean;
    onClick: () => void;
}

function ControlButton({ icon, label, className, disabled, onClick }: ButtonProps): JSX.Element {
    return (
        <button
            type="button"
            className={className}
            title={label}
            aria-label={label}
            disabled={disabled}
            onClick={onClick}
        >
            <Icon name={icon} />
        </button>
    );
}

/** The buttons of a player: all of them in a card, play/pause and stop in a row */
function Controls({
    entry,
    full,
    editMode,
    word,
    onCommand,
}: {
    entry: StreamEntry;
    full: boolean;
    editMode: boolean;
    word: (key: WordKey) => string;
    onCommand: (channel: string, button: PlayerButton) => void;
}): JSX.Element | null {
    const channel = entry.channel;
    if (!entry.controllable || !channel) {
        return null;
    }
    const send = (button: PlayerButton) => () => onCommand(channel, button);
    const paused = entry.stream.paused;
    return (
        <div className="controls">
            {full ? (
                <>
                    <ControlButton
                        icon="skipPrevious"
                        label={word('previous')}
                        className="step"
                        disabled={editMode}
                        onClick={send('skipPrevious')}
                    />
                    <ControlButton
                        icon="replay"
                        label={word('stepBack')}
                        className="step"
                        disabled={editMode}
                        onClick={send('stepBack')}
                    />
                </>
            ) : null}
            <ControlButton
                icon={paused ? 'play' : 'pause'}
                label={word(paused ? 'play' : 'pause')}
                className="main"
                disabled={editMode}
                onClick={send(paused ? 'play' : 'pause')}
            />
            {full ? (
                <>
                    <ControlButton
                        icon="forward"
                        label={word('stepForward')}
                        className="step"
                        disabled={editMode}
                        onClick={send('stepForward')}
                    />
                    <ControlButton
                        icon="skipNext"
                        label={word('next')}
                        className="step"
                        disabled={editMode}
                        onClick={send('skipNext')}
                    />
                </>
            ) : null}
            <ControlButton
                icon="stop"
                label={word('stop')}
                disabled={editMode}
                onClick={send('stop')}
            />
        </div>
    );
}

/** The title of the item: the message of the notification, the episode, or the type and the player */
function getTitle(stream: ActiveStream): string {
    return stream.message || formatEpisode(stream.season, stream.episode) || stream.media || stream.player;
}

function Card(props: Omit<ViewProps, 'entries' | 'compact'> & { entry: StreamEntry }): JSX.Element {
    const { entry, showCover, word } = props;
    const { stream } = entry;
    const title = getTitle(stream);
    const state = word(stream.paused ? 'paused' : 'playing');
    return (
        <div className={`card${stream.paused ? ' paused' : ''}`}>
            <div className="card-body">
                {showCover ? (
                    <Cover
                        thumb={stream.thumb}
                        media={stream.media}
                    />
                ) : null}
                <div className="info">
                    <div
                        className="heading"
                        title={`${state}: ${title}`}
                    >
                        <Icon name={stream.paused ? 'pause' : 'play'} />
                        <span className="title">{title}</span>
                    </div>
                    {stream.caption ? (
                        <div
                            className="caption"
                            title={stream.caption}
                        >
                            {stream.caption}
                        </div>
                    ) : null}
                    <div className="meta">
                        <Icon name="tv" />
                        <span>{stream.player}</span>
                        {stream.account ? (
                            <>
                                <Icon
                                    name="person"
                                    className="gap"
                                />
                                <span>{stream.account}</span>
                            </>
                        ) : null}
                    </div>
                    <Progress
                        entry={entry}
                        withTimes
                    />
                    <Controls
                        entry={entry}
                        full
                        editMode={props.editMode}
                        word={word}
                        onCommand={props.onCommand}
                    />
                </div>
            </div>
        </div>
    );
}

function Row(props: Omit<ViewProps, 'entries' | 'compact'> & { entry: StreamEntry }): JSX.Element {
    const { entry, showCover, word } = props;
    const { stream } = entry;
    const title = getTitle(stream);
    const state = word(stream.paused ? 'paused' : 'playing');
    const sub = [stream.player, stream.account].filter(Boolean);
    if (entry.elapsed !== null) {
        sub.push(
            entry.duration ? `${formatTime(entry.elapsed)} / ${formatTime(entry.duration)}` : formatTime(entry.elapsed),
        );
    }
    return (
        <div className={`row${stream.paused ? ' paused' : ''}`}>
            {showCover ? (
                <Cover
                    thumb={stream.thumb}
                    media={stream.media}
                />
            ) : null}
            <div className="info">
                <div
                    className="heading"
                    title={`${state}: ${title}`}
                >
                    <Icon name={stream.paused ? 'pause' : 'play'} />
                    <span className="title">{title}</span>
                </div>
                <div
                    className="sub"
                    title={stream.caption || undefined}
                >
                    {sub.join(' · ')}
                </div>
            </div>
            <Controls
                entry={entry}
                full={false}
                editMode={props.editMode}
                word={props.word}
                onCommand={props.onCommand}
            />
            <Progress
                entry={entry}
                withTimes={false}
            />
        </div>
    );
}

function NowPlayingView(props: ViewProps): JSX.Element {
    const { entries, compact, editMode, word } = props;
    if (!entries.length) {
        return (
            <Hint
                text={word('nothingPlaying')}
                icon="movie"
                editMode={editMode}
            />
        );
    }
    return (
        <div className={`streams scroll ${compact ? 'compact' : 'cards'}${editMode ? ' edit' : ''}`}>
            {entries.map(entry =>
                compact ? (
                    <Row
                        key={entry.stream.player}
                        {...props}
                        entry={entry}
                    />
                ) : (
                    <Card
                        key={entry.stream.player}
                        {...props}
                        entry={entry}
                    />
                ),
            )}
        </div>
    );
}

/** A number of a state, null if it has none */
function toNumber(state: ioBroker.State | null | undefined): number | null {
    const value = Number(state?.val);
    return state && state.val !== null && state.val !== '' && Number.isFinite(value) ? value : null;
}

/**
 * The namespace of the settings, `plex.<n>`: from the instance, or from the player if there is no instance
 *
 * @param settings the settings of the element
 */
function getSettingsNamespace(settings: NowPlayingSettings): string | null {
    const namespace = getNamespace(settings.instance);
    if (namespace || settings.instance) {
        return namespace;
    }
    const channel = getPlayerChannelId(settings.player);
    return channel ? channel.split('.').slice(0, 2).join('.') : null;
}

class PlexNowPlaying extends PlexElement<NowPlayingSettings> {
    /** The player channels of `#channelsFor`; null while they are read */
    #channels: PlayerChannel[] | null = null;

    #channelsFor = '';

    #channelsSocket: WebComponentSocket | null = null;

    /** When the channels were asked for last, in ms */
    #channelsAskedAt = 0;

    /** The players without a channel when the channels were asked for last */
    #channelsMissing = '';

    #reloadTimer: ReturnType<typeof setTimeout> | null = null;

    constructor() {
        super(NOW_PLAYING_STYLES);
    }

    override disconnectedCallback(): void {
        super.disconnectedCallback();
        if (this.#reloadTimer) {
            clearTimeout(this.#reloadTimer);
            this.#reloadTimer = null;
        }
    }

    /** The streams to show, each with its player channel if it is known */
    #getStreams(settings: NowPlayingSettings, namespace: string): { stream: ActiveStream; channel: string | null }[] {
        const filter = settings.player ? getPlayerChannelId(settings.player) : null;
        let streams = getActiveStreams(parseHistory(this.states[`${namespace}.events.history`]?.val));
        if (settings.showPaused === false) {
            streams = streams.filter(stream => !stream.paused);
        }
        if (filter) {
            return streams
                .filter(stream => isChannelOf(filter, stream.player))
                .map(stream => ({ stream, channel: filter }));
        }
        return streams.map(stream => ({
            stream,
            channel: findPlayerChannel(this.#getChannels(namespace) || [], stream.player)?.id || null,
        }));
    }

    #getChannels(namespace: string): PlayerChannel[] | null {
        return namespace === this.#channelsFor && this.socket === this.#channelsSocket ? this.#channels : null;
    }

    protected override getWantedIds(settings: NowPlayingSettings): string[] {
        const namespace = getSettingsNamespace(settings);
        if (!namespace) {
            return [];
        }
        const ids = [`${namespace}.events.history`];
        for (const { channel } of this.#getStreams(settings, namespace)) {
            if (channel) {
                ids.push(`${channel}.Metadata.viewOffset`, `${channel}.Metadata.durationSeconds`);
                if (settings.showControls !== false) {
                    // the object of the button tells whether the player has controls at all
                    ids.push(`${channel}.Player.controllable`, `${channel}._Controls.playback.play`);
                }
            }
        }
        return ids;
    }

    /**
     * Read the player channels: once per instance and socket, and again for a player that is not among them - soon
     * for a new one (the adapter creates its channel before it writes the history), seldom for one that has none
     * (e.g. a player known to Tautulli only)
     *
     * @param namespace `plex.<n>`
     * @param missing the titles of the players shown without a channel
     */
    #loadChannels(namespace: string, missing: string[]): void {
        const socket = this.socket;
        if (!socket) {
            return;
        }
        const known = namespace === this.#channelsFor && socket === this.#channelsSocket;
        const missingKey = missing.join('\n');
        if (known) {
            if (!missingKey) {
                return;
            }
            const delay =
                (missingKey === this.#channelsMissing ? RELOAD_CHANNELS_MS : NEW_PLAYER_DELAY_MS) -
                (Date.now() - this.#channelsAskedAt);
            if (delay > 0) {
                // draw again then, even if no state changes in between
                this.#reloadTimer ||= setTimeout(() => {
                    this.#reloadTimer = null;
                    if (this.isConnected) {
                        this.resubscribe();
                    }
                }, delay);
                return;
            }
        } else {
            this.#channels = null;
        }
        this.#channelsFor = namespace;
        this.#channelsSocket = socket;
        this.#channelsAskedAt = Date.now();
        this.#channelsMissing = missingKey;
        const prefix = `${namespace}._playing.`;
        socket
            .getObjectViewSystem('channel', prefix, `${prefix}香`)
            .then(channels => toPlayerChannels(namespace, channels))
            .catch((error: unknown) => {
                console.warn(`<${this.localName}>: cannot read the players of ${namespace}: ${String(error)}`);
                return [];
            })
            .then(channels => {
                if (namespace === this.#channelsFor && socket === this.#channelsSocket) {
                    this.#channels = channels;
                    this.resubscribe();
                }
            })
            .catch(() => undefined);
    }

    protected override draw(): JSX.Element {
        const settings = this.settings;
        const namespace = getSettingsNamespace(settings);
        if (!namespace) {
            return (
                <Hint
                    text={this.word(settings.instance ? 'notInstance' : 'chooseInstance')}
                    icon="movie"
                    editMode={this.editMode}
                />
            );
        }
        const filter = settings.player ? getPlayerChannelId(settings.player) : null;
        if (settings.player && (!filter || !filter.startsWith(`${namespace}.`))) {
            return (
                <Hint
                    text={this.word('notPlayer')}
                    icon="tv"
                    editMode={this.editMode}
                />
            );
        }
        if (this.states[`${namespace}.events.history`] === undefined) {
            // not read yet: show nothing rather than "nothing is playing"
            return <div className="streams" />;
        }

        const streams = this.#getStreams(settings, namespace);
        if (!filter && streams.length) {
            this.#loadChannels(
                namespace,
                streams.filter(({ channel }) => !channel).map(({ stream }) => stream.player),
            );
        }

        const entries: StreamEntry[] = streams.map(({ stream, channel }) => {
            const offset = channel ? toNumber(this.states[`${channel}.Metadata.viewOffset`]) : null;
            const duration = channel ? toNumber(this.states[`${channel}.Metadata.durationSeconds`]) : null;
            const buttons = channel ? this.objects[`${channel}._Controls.playback.play`] : null;
            const controllable =
                settings.showControls !== false &&
                !!buttons &&
                this.states[`${channel}.Player.controllable`]?.val !== false;
            return {
                stream,
                channel,
                elapsed: offset !== null && offset > 0 ? Math.floor(offset / 1000) : null,
                duration: duration !== null && duration > 0 ? duration : null,
                controllable,
            };
        });

        return (
            <NowPlayingView
                entries={entries}
                compact={settings.layout === 'compact'}
                showCover={settings.showCover !== false}
                editMode={this.editMode}
                word={this.word}
                onCommand={(channel, button) => void this.setState(`${channel}._Controls.playback.${button}`, true)}
            />
        );
    }
}

defineWebComponent(NOW_PLAYING_TAG, PlexNowPlaying);
