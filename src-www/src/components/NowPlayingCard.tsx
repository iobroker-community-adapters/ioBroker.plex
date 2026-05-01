import { Box, Card, CardContent, Stack, Typography } from '@mui/material';
import PauseIcon from '@mui/icons-material/Pause';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import { useSettings } from '../settings';

export interface ActiveStream {
    player: string;
    account?: string;
    media?: string;
    message?: string;
    caption?: string;
    thumb?: string;
    paused: boolean;
    timestamp?: number;
}

interface Props {
    stream: ActiveStream;
}

export function NowPlayingCard({ stream }: Props): JSX.Element {
    const { settings } = useSettings();
    const thumbH = settings.thumbSize;
    return (
        <Card sx={{ minWidth: 260, maxWidth: 380, flex: '1 1 280px' }}>
            <Stack direction="row" spacing={1.5} sx={{ p: 1.5 }}>
                {thumbH > 0 && (stream.thumb ? (
                    <Box
                        component="img"
                        src={stream.thumb}
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
                            (e.currentTarget as HTMLImageElement).style.visibility = 'hidden';
                        }}
                    />
                ) : (
                    <Box sx={{ width: thumbH, height: thumbH, borderRadius: 1, bgcolor: 'action.hover', flexShrink: 0 }} />
                ))}
                <CardContent sx={{ p: 0, '&:last-child': { pb: 0 }, flex: 1, minWidth: 0 }}>
                    <Stack spacing={0.5}>
                        <Stack direction="row" alignItems="center" spacing={0.5}>
                            {stream.paused ? (
                                <PauseIcon fontSize="small" sx={{ opacity: 0.6 }} />
                            ) : (
                                <PlayArrowIcon fontSize="small" color="primary" />
                            )}
                            <Typography variant="subtitle2" noWrap sx={{ flex: 1 }} title={stream.message || ''}>
                                {stream.message || stream.media || stream.player}
                            </Typography>
                        </Stack>
                        {stream.caption && (
                            <Typography variant="caption" noWrap sx={{ opacity: 0.75 }} title={stream.caption}>
                                {stream.caption}
                            </Typography>
                        )}
                        <Typography variant="caption" sx={{ opacity: 0.6 }}>
                            {stream.player}
                            {stream.account ? ` · ${stream.account}` : ''}
                        </Typography>
                    </Stack>
                </CardContent>
            </Stack>
        </Card>
    );
}
