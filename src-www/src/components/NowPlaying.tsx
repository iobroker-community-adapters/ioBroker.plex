import { Box, Stack, Typography } from '@mui/material';
import { useEffect, useMemo, useState, type JSX } from 'react';
import { useIobState } from '../socket';
import { NowPlayingCard, type ActiveStream } from './NowPlayingCard';

interface HistoryEvent {
    id?: string;
    timestamp: number;
    player?: string;
    /** UUID of the player; missing in entries written before the adapter stored it */
    playerUuid?: string;
    account?: string;
    media?: string;
    event?: string;
    message?: string;
    caption?: string;
    thumb?: string;
}

const PLAYING_EVENTS = new Set(['media.play', 'media.resume', 'play', 'resume']);
const STOP_EVENTS = new Set(['media.stop', 'media.pause', 'stop', 'pause']);

/**
 * How long a stream counts as playing after its last "play" or "resume", in seconds. A "pause" or "stop"
 * ends it at once; this limit is for a stream whose end never arrived - the server, the adapter or the host
 * was not reachable, the webhook was not delivered, the device disappeared. Every new item (next episode,
 * next track) is a new event, so 12 hours do not cut a stream that still plays.
 */
const PLAYING_EXPIRES_S = 12 * 3600;

/** How long a paused stream is shown after its "pause", in seconds */
const PAUSED_EXPIRES_S = 24 * 3600;

/**
 * When a stream expires, in ms: `PLAYING_EXPIRES_S` after its "play" or "resume", `PAUSED_EXPIRES_S`
 * after its "pause". Never (`Infinity`) if its event has no valid time - the history counts in seconds.
 */
function getExpiry(stream: { paused: boolean; timestamp?: number }): number {
    const timestamp = Number(stream.timestamp) || 0;
    return timestamp > 0 ? (timestamp + (stream.paused ? PAUSED_EXPIRES_S : PLAYING_EXPIRES_S)) * 1000 : Infinity;
}

/**
 * The streams that play now or are paused, newest first.
 *
 * @param parsed the entries of `events.history`
 * @param now the moment to tell for, in ms
 */
function getActiveStreams(parsed: HistoryEvent[], now: number): ActiveStream[] {
    // Newest first. The adapter appends and counts whole seconds, so of two events of the
    // same second the later one in the array is the newer one (the sort is stable).
    const events = [...parsed].reverse().sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

    // The latest event per device. Two events are of two devices only if both name a UUID
    // (`playerUuid`) and these differ - so two devices of the same title are told apart. An
    // entry without a UUID (written before the adapter stored it) is one of its title: a newer
    // event of that title replaces it, with or without a UUID, and it replaces the older ones
    // of that title. So an old "play" and a new "stop" leave no stream that plays forever.
    const seenUuids = new Set<string>();
    const seenTitles = new Set<string>();
    const seenUuidTitles = new Set<string>();
    const result: ActiveStream[] = [];
    for (const e of events) {
        const player = e.player;
        if (!player) {
            continue;
        }
        const playerUuid = typeof e.playerUuid === 'string' && e.playerUuid ? e.playerUuid : undefined;
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
        if (seen) {
            continue;
        }
        const ev = e.event || '';
        const isPlaying = PLAYING_EVENTS.has(ev);
        const isPaused = STOP_EVENTS.has(ev) && (ev === 'media.pause' || ev === 'pause');
        // Only show currently-playing or just-paused streams; stopped ones are dropped.
        if (!isPlaying && !isPaused) {
            continue;
        }
        const stream: ActiveStream = {
            player,
            playerUuid,
            account: e.account,
            media: e.media,
            message: e.message,
            caption: e.caption,
            thumb: e.thumb,
            paused: isPaused,
            timestamp: e.timestamp,
        };
        // a stream whose end never arrived expires; its event stays in the timeline
        if (now <= getExpiry(stream)) {
            result.push(stream);
        }
    }
    result.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
    return result;
}

export function NowPlaying(): JSX.Element {
    // The _playing.<player>.Metadata.* states are aggressively GC'd by the adapter
    // (only viewOffset is refreshed continuously), so title/thumb are not reliably
    // available there. The events.history JSON, on the other hand, contains the
    // last event per player with title and a fully-qualified thumb URL incl. token.
    // We treat the latest event per player as the current state of that stream.
    const historyState = useIobState('events.history');
    const [expired, setExpired] = useState(0);

    const streams = useMemo<ActiveStream[]>(() => {
        const raw = historyState?.val;
        if (typeof raw !== 'string' || !raw) {
            return [];
        }
        let parsed: HistoryEvent[];
        try {
            const data = JSON.parse(raw);
            if (!Array.isArray(data)) {
                return [];
            }
            parsed = data;
        } catch {
            return [];
        }

        return getActiveStreams(parsed, Date.now());
        // `expired` counts up when a stream expires: tell again then, also without a new event
    }, [historyState, expired]);

    useEffect(() => {
        // the moment the next stream expires
        const next = Math.min(...streams.map(getExpiry));
        if (!Number.isFinite(next)) {
            return undefined;
        }
        // a timer cannot wait longer than 2^31 ms
        const delay = Math.min(Math.max(0, next - Date.now()) + 1000, 2 ** 31 - 1);
        const timer = setTimeout(() => setExpired(n => n + 1), delay);
        return () => clearTimeout(timer);
    }, [streams]);

    return (
        <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <Typography variant="overline" sx={{ opacity: 0.6, letterSpacing: 1 }}>
                Now Playing
            </Typography>
            {streams.length === 0 ? (
                <Box sx={{ py: 3, textAlign: 'center', opacity: 0.5 }}>
                    <Typography variant="body2">Keine aktiven Streams</Typography>
                </Box>
            ) : (
                <Stack direction="row" spacing={2} sx={{ mt: 1, flexWrap: 'wrap', gap: 2, justifyContent: 'center' }}>
                    {streams.map(s => (
                        <NowPlayingCard key={s.playerUuid || s.player} stream={s} />
                    ))}
                </Stack>
            )}
        </Box>
    );
}
