/**
 * The state `plex.<n>.events.history`: a JSON array of the last (up to 1000) events of the Plex server, written by
 * the adapter for every webhook event a notification is defined for (`native.notifications`). Each entry carries
 * the player, the user, the message and caption of the notification and - if the notification has one - the
 * absolute URL of the cover incl. the token (`http(s)://<plex>:<port>/library/...?X-Plex-Token=...`).
 *
 * `<iob-plex-now-playing>` takes the last playback event per player as the current state of that player: the
 * states below `_playing.<player>.Metadata` are emptied by the garbage collector of the adapter, so title and
 * cover are not reliable there (the same as the www page of the adapter does).
 */
import { PAUSED_EXPIRES_S, PLAYING_EXPIRES_S } from './constants';

/** One entry of `events.history` */
export interface HistoryEvent {
    id?: string;
    /** In seconds */
    timestamp: number;
    datetime?: string;
    /** The Plex user */
    account?: string;
    /** The title of the player */
    player?: string;
    /** The UUID of the player; missing in entries written before the adapter stored it, or if the event has none */
    playerUuid?: string;
    /** `movie`, `episode`, `track`, ... */
    media?: string;
    /** Without `media.`: `play`, `pause`, `resume`, `stop`, `scrobble`, `rate`, or e.g. `library.new` */
    event: string;
    message?: string;
    caption?: string;
    thumb?: string;
    /** `plex` or `tautulli` */
    source?: string;
    season?: number;
    episode?: number;
    [key: string]: unknown;
}

/** A player that plays something now, or has paused it */
export interface ActiveStream {
    /** The title of the player */
    player: string;
    /** The UUID of the player, if the event names it */
    playerUuid?: string;
    account?: string;
    media?: string;
    message?: string;
    caption?: string;
    thumb?: string;
    season?: number;
    episode?: number;
    paused: boolean;
    /** Of the event, in seconds */
    timestamp: number;
}

/** The events of playback; the events of the Plex webhook start with `media.`, the adapter strips that */
const PLAY_EVENTS = new Set(['play', 'resume', 'media.play', 'media.resume']);
const PAUSE_EVENTS = new Set(['pause', 'media.pause']);
const STOP_EVENTS = new Set(['stop', 'media.stop']);
const PLAYBACK_EVENTS = new Set([
    ...PLAY_EVENTS,
    ...PAUSE_EVENTS,
    ...STOP_EVENTS,
    'scrobble',
    'media.scrobble',
    'rate',
    'media.rate',
    'watched',
    'media.watched',
]);

/** The last parsed value, so that a drawing does not parse the same JSON again */
let cache: { raw: string; events: HistoryEvent[] } | null = null;

/**
 * The events of the state `events.history`, newest first
 *
 * @param raw the value of the state
 */
export function parseHistory(raw: ioBroker.StateValue | undefined): HistoryEvent[] {
    if (typeof raw !== 'string' || !raw) {
        return [];
    }
    if (cache?.raw === raw) {
        return cache.events;
    }
    let events: HistoryEvent[] = [];
    try {
        const parsed: unknown = JSON.parse(raw);
        if (Array.isArray(parsed)) {
            events = (parsed as unknown[])
                .filter(
                    (entry): entry is HistoryEvent =>
                        !!entry && typeof entry === 'object' && typeof (entry as HistoryEvent).event === 'string',
                )
                // the adapter appends and counts whole seconds: of two events of one second the later one in the
                // array is the newer one - the sort is stable, so turned around first it stays in front
                .reverse()
                .sort((a, b) => (Number(b.timestamp) || 0) - (Number(a.timestamp) || 0));
        }
    } catch {
        // a broken state: nothing to show
    }
    cache = { raw, events };
    return events;
}

/**
 * Whether an event is one of playback (play, pause, resume, stop, watched, rated)
 *
 * @param event the `event` of an entry
 */
export function isPlaybackEvent(event: string): boolean {
    return PLAYBACK_EVENTS.has(event);
}

/**
 * When a stream expires, in ms: `PLAYING_EXPIRES_S` after its "play" or "resume", `PAUSED_EXPIRES_S` after its
 * "pause". Never (`Infinity`) if its event has no valid time - the history counts in seconds.
 *
 * @param stream the stream
 * @param stream.paused whether its last event is a "pause"
 * @param stream.timestamp the time of its last event, in seconds
 */
export function getExpiry(stream: { paused: boolean; timestamp: number }): number {
    return stream.timestamp > 0
        ? (stream.timestamp + (stream.paused ? PAUSED_EXPIRES_S : PLAYING_EXPIRES_S)) * 1000
        : Infinity;
}

/**
 * The players that play something now or have paused it, newest first. The last event of play, pause, resume or
 * stop of each player counts; "watched" and "rated" come while it plays and change nothing.
 *
 * A player is a device: two events are of two players only if both name a UUID (`playerUuid`) and these differ, so
 * two devices of the same title are told apart. An event without a UUID - written before the adapter stored it -
 * is one of its title: a newer event of that title replaces it, with or without a UUID, and it replaces the older
 * ones of that title. So a "play" without and a later "stop" with a UUID leave no stream that plays forever.
 *
 * A stream whose end never arrived expires (`getExpiry`): it is left out, its event stays in the history.
 *
 * @param events the history, newest first
 * @param now the moment to tell for, in ms
 */
export function getActiveStreams(events: HistoryEvent[], now = Date.now()): ActiveStream[] {
    /** The UUIDs, in lower case, of the events so far */
    const seenUuids = new Set<string>();
    /** The titles of the events so far: of those without a UUID, and of those with one */
    const seenTitles = new Set<string>();
    const seenUuidTitles = new Set<string>();
    const result: ActiveStream[] = [];
    for (const entry of events) {
        const player = entry.player;
        const event = entry.event;
        if (!player) {
            continue;
        }
        const playing = PLAY_EVENTS.has(event);
        const paused = PAUSE_EVENTS.has(event);
        if (!playing && !paused && !STOP_EVENTS.has(event)) {
            continue;
        }
        const playerUuid = typeof entry.playerUuid === 'string' && entry.playerUuid ? entry.playerUuid : undefined;
        const uuid = playerUuid?.toLowerCase();
        const seen = uuid
            ? seenUuids.has(uuid) || seenTitles.has(player)
            : seenTitles.has(player) || seenUuidTitles.has(player);
        if (uuid) {
            seenUuids.add(uuid);
            seenUuidTitles.add(player);
        } else {
            seenTitles.add(player);
        }
        if (!seen && (playing || paused)) {
            const stream: ActiveStream = {
                player,
                playerUuid,
                account: entry.account,
                media: entry.media,
                message: entry.message,
                caption: entry.caption,
                thumb: entry.thumb,
                season: typeof entry.season === 'number' ? entry.season : undefined,
                episode: typeof entry.episode === 'number' ? entry.episode : undefined,
                paused,
                timestamp: Number(entry.timestamp) || 0,
            };
            if (now <= getExpiry(stream)) {
                result.push(stream);
            }
        }
    }
    return result;
}

/**
 * `S01E02` for an episode, empty otherwise
 *
 * @param season number of the season
 * @param episode number of the episode
 */
export function formatEpisode(season: number | undefined, episode: number | undefined): string {
    let text = '';
    if (typeof season === 'number') {
        text += `S${String(season).padStart(2, '0')}`;
    }
    if (typeof episode === 'number') {
        text += `E${String(episode).padStart(2, '0')}`;
    }
    return text;
}
