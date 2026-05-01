import { Box, Stack, Typography } from '@mui/material';
import { useMemo } from 'react';
import { useIobState } from '../socket';
import { useSettings } from '../settings';
import { TimelineEntry, type TimelineEvent } from './TimelineEntry';

function dayLabel(date: Date): string {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const target = new Date(date);
    target.setHours(0, 0, 0, 0);
    if (target.getTime() === today.getTime()) {
        return 'Heute';
    }
    if (target.getTime() === yesterday.getTime()) {
        return 'Gestern';
    }
    return date.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
}

interface DayGroup {
    day: string;
    entries: TimelineEvent[];
}

interface AlternatingGroupProps {
    group: DayGroup;
    startIndex: number;
    offset: number;
}

function AlternatingGroup({ group, startIndex, offset }: AlternatingGroupProps): JSX.Element {
    const left = group.entries.filter((_, i) => (startIndex + i) % 2 === 0);
    const right = group.entries.filter((_, i) => (startIndex + i) % 2 !== 0);

    return (
        <Box>
            <Typography
                variant="caption"
                sx={{
                    opacity: 0.6,
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    display: 'block',
                    textAlign: 'center',
                    mb: 1.5,
                }}
            >
                {group.day}
            </Typography>
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 2px 1fr', gap: '0 12px' }}>
                {/* left column */}
                <Stack spacing={1.5}>
                    {left.map((e, i) => (
                        <TimelineEntry key={e.id || `l-${i}`} entry={e} />
                    ))}
                </Stack>

                {/* center line */}
                <Box sx={{ bgcolor: 'divider', borderRadius: 1 }} />

                {/* right column — offset by half the image height */}
                <Stack spacing={1.5} sx={{ mt: `${offset}px` }}>
                    {right.map((e, i) => (
                        <TimelineEntry key={e.id || `r-${i}`} entry={e} />
                    ))}
                </Stack>
            </Box>
        </Box>
    );
}

export function Timeline(): JSX.Element {
    const historyState = useIobState('events.history');
    const { settings } = useSettings();
    const alternate = settings.timelineLayout === 'alternating';

    const events = useMemo<TimelineEvent[]>(() => {
        const raw = historyState?.val;
        if (typeof raw !== 'string' || !raw) {
            return [];
        }
        try {
            const parsed = JSON.parse(raw);
            if (!Array.isArray(parsed)) {
                return [];
            }
            return [...parsed].sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
        } catch {
            return [];
        }
    }, [historyState]);

    const grouped = useMemo<DayGroup[]>(() => {
        const groups: DayGroup[] = [];
        let currentKey = '';
        for (const e of events) {
            if (!e.timestamp) {
                continue;
            }
            const dt = new Date(e.timestamp * 1000);
            if (isNaN(dt.getTime())) {
                continue;
            }
            const key = dt.toISOString().slice(0, 10);
            if (key !== currentKey) {
                groups.push({ day: dayLabel(dt), entries: [] });
                currentKey = key;
            }
            groups[groups.length - 1].entries.push(e);
        }
        return groups;
    }, [events]);

    // track the global entry index so alternation continues across day boundaries
    let globalIndex = 0;
    const offset = Math.round(settings.thumbSize / 2);

    return (
        <Box sx={{ p: 2 }}>
            <Typography variant="overline" sx={{ opacity: 0.6, letterSpacing: 1 }}>
                Timeline
            </Typography>
            {events.length === 0 ? (
                <Box sx={{ py: 4, textAlign: 'center', opacity: 0.5 }}>
                    <Typography variant="body2">Noch keine Events</Typography>
                </Box>
            ) : alternate ? (
                <Stack spacing={3} sx={{ mt: 1 }}>
                    {grouped.map(group => {
                        const startIndex = globalIndex;
                        globalIndex += group.entries.length;
                        return (
                            <AlternatingGroup key={group.day} group={group} startIndex={startIndex} offset={offset} />
                        );
                    })}
                </Stack>
            ) : (
                <Stack spacing={2} sx={{ mt: 1 }}>
                    {grouped.map(group => (
                        <Box key={group.day}>
                            <Typography
                                variant="caption"
                                sx={{ opacity: 0.6, fontWeight: 600, textTransform: 'uppercase', mb: 1, display: 'block' }}
                            >
                                {group.day}
                            </Typography>
                            <Stack spacing={1}>
                                {group.entries.map((e, i) => (
                                    <TimelineEntry key={e.id || `${group.day}-${i}`} entry={e} />
                                ))}
                            </Stack>
                        </Box>
                    ))}
                </Stack>
            )}
        </Box>
    );
}
