import { Box, Collapse, Divider, IconButton, Paper, Stack, Typography } from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { useState } from 'react';
import { getEventIcon } from '../icons';
import { useSettings } from '../settings';

export interface TimelineEvent {
    id?: string;
    timestamp: number;
    datetime?: string;
    account?: string;
    player?: string;
    media?: string;
    event: string;
    message?: string;
    caption?: string;
    thumb?: string;
    source?: string;
    season?: number;
    episode?: number;
    [key: string]: unknown;
}

interface Props {
    entry: TimelineEvent;
}

const HIDE_KEYS = new Set(['id', 'timestamp', 'datetime', 'event', 'message', 'caption', 'thumb', 'source', 'season', 'episode']);

export function TimelineEntry({ entry }: Props): JSX.Element {
    const [open, setOpen] = useState(false);
    const { settings } = useSettings();
    const thumbH = settings.thumbSize;
    const Icon = getEventIcon(entry.event);
    const dt = entry.timestamp ? new Date(entry.timestamp * 1000) : null;
    const time = dt && !isNaN(dt.getTime()) ? dt.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }) : '';

    const detailEntries = Object.entries(entry).filter(
        ([k, v]) => !HIDE_KEYS.has(k) && v != null && (typeof v !== 'object' || Array.isArray(v)),
    );

    return (
        <Paper
            variant="outlined"
            sx={{
                p: 1.5,
                cursor: detailEntries.length > 0 ? 'pointer' : 'default',
                transition: 'background-color 0.15s',
                '&:hover': detailEntries.length > 0 ? { bgcolor: 'action.hover' } : {},
            }}
            onClick={() => detailEntries.length > 0 && setOpen(o => !o)}
        >
            <Stack direction="row" spacing={1.5} alignItems="flex-start">
                <Box
                    sx={{
                        width: 32,
                        height: 32,
                        borderRadius: '50%',
                        bgcolor: 'primary.main',
                        color: 'primary.contrastText',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        mt: 0.5,
                    }}
                >
                    <Icon fontSize="small" />
                </Box>
                {entry.thumb && thumbH > 0 && (
                    <Box
                        component="img"
                        src={entry.thumb}
                        alt=""
                        sx={{
                            width: 'auto',
                            height: thumbH,
                            borderRadius: 1,
                            display: 'block',
                            bgcolor: 'action.hover',
                            flexShrink: 0,
                        }}
                        onError={e => {
                            (e.currentTarget as HTMLImageElement).style.display = 'none';
                        }}
                    />
                )}
                <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>
                        {entry.message || entry.event}
                    </Typography>
                    {entry.caption && (
                        <Typography variant="caption" sx={{ opacity: 0.75, display: 'block' }}>
                            {entry.caption}
                        </Typography>
                    )}
                    {(entry.season != null || entry.episode != null) && (
                        <Typography variant="caption" sx={{ opacity: 0.6, display: 'block', fontVariantNumeric: 'tabular-nums' }}>
                            {entry.season != null && `S${String(entry.season).padStart(2, '0')}`}
                            {entry.episode != null && `E${String(entry.episode).padStart(2, '0')}`}
                        </Typography>
                    )}
                    <Typography variant="caption" sx={{ opacity: 0.5 }}>
                        {time}
                        {entry.source ? ` · ${entry.source}` : ''}
                    </Typography>
                </Box>
                {detailEntries.length > 0 && (
                    <IconButton
                        size="small"
                        sx={{
                            transform: open ? 'rotate(180deg)' : 'none',
                            transition: 'transform 0.2s',
                        }}
                    >
                        <ExpandMoreIcon fontSize="small" />
                    </IconButton>
                )}
            </Stack>
            <Collapse in={open} unmountOnExit>
                <Divider sx={{ my: 1 }} />
                <Box
                    component="dl"
                    sx={{
                        m: 0,
                        display: 'grid',
                        gridTemplateColumns: 'auto 1fr',
                        gap: 0.5,
                        fontSize: '0.8rem',
                    }}
                >
                    {detailEntries.map(([k, v]) => (
                        <Box key={k} sx={{ display: 'contents' }}>
                            <Typography variant="caption" component="dt" sx={{ opacity: 0.6, pr: 1 }}>
                                {k}
                            </Typography>
                            <Typography variant="caption" component="dd" sx={{ m: 0, wordBreak: 'break-word' }}>
                                {Array.isArray(v) ? v.join(', ') : String(v)}
                            </Typography>
                        </Box>
                    ))}
                </Box>
            </Collapse>
        </Paper>
    );
}
