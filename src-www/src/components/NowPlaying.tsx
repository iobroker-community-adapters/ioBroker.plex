import { Box, Stack, Typography } from '@mui/material';
import { useMemo } from 'react';
import { useIobState } from '../socket';
import { NowPlayingCard, type ActiveStream } from './NowPlayingCard';

interface HistoryEvent {
    id?: string;
    timestamp: number;
    player?: string;
    account?: string;
    media?: string;
    event?: string;
    message?: string;
    caption?: string;
    thumb?: string;
}

const PLAYING_EVENTS = new Set(['media.play', 'media.resume', 'play', 'resume']);
const STOP_EVENTS = new Set(['media.stop', 'media.pause', 'stop', 'pause']);

export function NowPlaying(): JSX.Element {
    // The _playing.<player>.Metadata.* states are aggressively GC'd by the adapter
    // (only viewOffset is refreshed continuously), so title/thumb are not reliably
    // available there. The events.history JSON, on the other hand, contains the
    // last event per player with title and a fully-qualified thumb URL incl. token.
    // We treat the latest event per player as the current state of that stream.
    const historyState = useIobState('events.history');

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

        const latestPerPlayer = new Map<string, HistoryEvent>();
        for (const e of parsed) {
            if (!e.player) {
                continue;
            }
            const prev = latestPerPlayer.get(e.player);
            if (!prev || (e.timestamp || 0) > (prev.timestamp || 0)) {
                latestPerPlayer.set(e.player, e);
            }
        }

        const result: ActiveStream[] = [];
        for (const [player, e] of latestPerPlayer) {
            const ev = e.event || '';
            const isPlaying = PLAYING_EVENTS.has(ev);
            const isPaused = STOP_EVENTS.has(ev) && (ev === 'media.pause' || ev === 'pause');
            // Only show currently-playing or just-paused streams; stopped ones are dropped.
            if (!isPlaying && !isPaused) {
                continue;
            }
            result.push({
                player,
                account: e.account,
                media: e.media,
                message: e.message,
                caption: e.caption,
                thumb: e.thumb,
                paused: isPaused,
                timestamp: e.timestamp,
            });
        }
        result.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
        return result;
    }, [historyState]);

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
                        <NowPlayingCard key={s.player} stream={s} />
                    ))}
                </Stack>
            )}
        </Box>
    );
}
