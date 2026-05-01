import React from 'react';
import {
    Alert,
    Box,
    Button,
    Card,
    CardActionArea,
    CardContent,
    CircularProgress,
    Snackbar,
    Stack,
    TextField,
    Typography,
} from '@mui/material';
import DeleteSweepIcon from '@mui/icons-material/DeleteSweep';
import RefreshIcon from '@mui/icons-material/Refresh';
import { ConfigGeneric, type ConfigGenericProps, type ConfigGenericState } from '@iobroker/json-config';
import { I18n } from '@iobroker/adapter-react-v5';

interface KnownPlayer {
    id: string;
    uuid: string;
    title: string;
    product?: string;
    platform?: string;
    device?: string;
    lastSeenAt?: string;
    lastSeenSource?: string;
}

interface PlayerCleanupState extends ConfigGenericState {
    loaded: boolean;
    loading: boolean;
    busy: boolean;
    error: string | null;
    days: number;
    players: KnownPlayer[];
    /** UUIDs of players the user has flipped *away* from the auto-selection */
    overrideClear: Set<string>;
    /** UUIDs of players the user has flipped *into* selection (younger than threshold) */
    overrideMark: Set<string>;
    snackbar: string | null;
}

const DEFAULT_DAYS = 30;

class PlayerCleanup extends ConfigGeneric<ConfigGenericProps, PlayerCleanupState> {
    constructor(props: ConfigGenericProps) {
        super(props);
        Object.assign(this.state, {
            loaded: false,
            loading: false,
            busy: false,
            error: null,
            days: DEFAULT_DAYS,
            players: [],
            overrideClear: new Set<string>(),
            overrideMark: new Set<string>(),
            snackbar: null,
        } satisfies Partial<PlayerCleanupState>);
    }

    componentDidMount(): void {
        super.componentDidMount();
        void this.reload();
    }

    private async reload(): Promise<void> {
        this.setState({ loading: true, error: null });
        try {
            const raw: unknown = await this.props.oContext.socket.sendTo(
                `plex.${this.props.oContext.instance}`,
                'listKnownPlayers',
                {},
            );
            const r = raw as { result?: boolean; players?: KnownPlayer[]; error?: string } | undefined;
            if (r && r.result && Array.isArray(r.players)) {
                this.setState({
                    loaded: true,
                    loading: false,
                    players: r.players.slice().sort((a, b) => {
                        // Oldest first — most likely cleanup candidates at the top.
                        const ta = a.lastSeenAt ? Date.parse(a.lastSeenAt) : 0;
                        const tb = b.lastSeenAt ? Date.parse(b.lastSeenAt) : 0;
                        return ta - tb;
                    }),
                    overrideClear: new Set(),
                    overrideMark: new Set(),
                });
            } else {
                this.setState({
                    loaded: true,
                    loading: false,
                    error: r?.error ?? I18n.t('cleanup_error_load'),
                });
            }
        } catch (err) {
            this.setState({
                loaded: true,
                loading: false,
                error: (err as Error)?.message ?? I18n.t('cleanup_error_load'),
            });
        }
    }

    private isAutoMarked(p: KnownPlayer): boolean {
        if (!p.lastSeenAt) {
            return true;
        }
        const ts = Date.parse(p.lastSeenAt);
        if (Number.isNaN(ts)) {
            return true;
        }
        const ageMs = Date.now() - ts;
        return ageMs > this.state.days * 24 * 60 * 60 * 1000;
    }

    private isMarked(p: KnownPlayer): boolean {
        const auto = this.isAutoMarked(p);
        if (auto) {
            return !this.state.overrideClear.has(p.uuid);
        }
        return this.state.overrideMark.has(p.uuid);
    }

    private toggle(p: KnownPlayer): void {
        const auto = this.isAutoMarked(p);
        const overrideClear = new Set(this.state.overrideClear);
        const overrideMark = new Set(this.state.overrideMark);
        if (auto) {
            if (overrideClear.has(p.uuid)) {
                overrideClear.delete(p.uuid);
            } else {
                overrideClear.add(p.uuid);
            }
        } else {
            if (overrideMark.has(p.uuid)) {
                overrideMark.delete(p.uuid);
            } else {
                overrideMark.add(p.uuid);
            }
        }
        this.setState({ overrideClear, overrideMark });
    }

    private setDays(value: string): void {
        const n = parseInt(value, 10);
        if (!Number.isNaN(n) && n >= 0) {
            this.setState({ days: n, overrideClear: new Set(), overrideMark: new Set() });
        }
    }

    private async runCleanup(): Promise<void> {
        const ids = this.state.players.filter(p => this.isMarked(p)).map(p => p.id);
        if (ids.length === 0) {
            this.setState({ snackbar: I18n.t('cleanup_nothing_marked') });
            return;
        }
        this.setState({ busy: true, error: null });
        try {
            const raw: unknown = await this.props.oContext.socket.sendTo(
                `plex.${this.props.oContext.instance}`,
                'cleanupPlayers',
                { ids },
            );
            const r = raw as { result?: boolean; deleted?: number; errors?: string[]; error?: string } | undefined;
            if (r && r.result) {
                this.setState({
                    busy: false,
                    snackbar: I18n.t('cleanup_done', r.deleted ?? 0),
                });
                await this.reload();
            } else {
                this.setState({
                    busy: false,
                    error: r?.error ?? I18n.t('cleanup_error_delete'),
                });
            }
        } catch (err) {
            this.setState({
                busy: false,
                error: (err as Error)?.message ?? I18n.t('cleanup_error_delete'),
            });
        }
    }

    private formatLastSeen(p: KnownPlayer): string {
        if (!p.lastSeenAt) {
            return I18n.t('cleanup_lastseen_unknown');
        }
        const ts = Date.parse(p.lastSeenAt);
        if (Number.isNaN(ts)) {
            return p.lastSeenAt;
        }
        const ageMs = Date.now() - ts;
        const days = Math.floor(ageMs / (24 * 60 * 60 * 1000));
        const hours = Math.floor((ageMs % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
        if (days >= 1) {
            return I18n.t('cleanup_lastseen_days', days);
        }
        if (hours >= 1) {
            return I18n.t('cleanup_lastseen_hours', hours);
        }
        return I18n.t('cleanup_lastseen_recent');
    }

    private renderPlayerCard(p: KnownPlayer): React.JSX.Element {
        const marked = this.isMarked(p);
        const subtitle = [p.product, p.platform, p.device].filter(Boolean).join(' · ') || '—';
        return (
            <Card
                key={p.id}
                variant="outlined"
                sx={{
                    bgcolor: marked ? 'error.dark' : 'background.paper',
                    color: marked ? 'error.contrastText' : 'text.primary',
                    transition: 'background-color 0.15s ease',
                }}
            >
                <CardActionArea onClick={() => this.toggle(p)}>
                    <CardContent>
                        <Typography
                            variant="subtitle1"
                            sx={{ fontWeight: 600 }}
                        >
                            {p.title}
                        </Typography>
                        <Typography
                            variant="body2"
                            sx={{ opacity: 0.8 }}
                        >
                            {subtitle}
                        </Typography>
                        <Typography
                            variant="caption"
                            sx={{ display: 'block', opacity: 0.7, mt: 0.5 }}
                        >
                            {this.formatLastSeen(p)}
                            {p.lastSeenSource ? ` · ${p.lastSeenSource}` : ''}
                        </Typography>
                    </CardContent>
                </CardActionArea>
            </Card>
        );
    }

    renderItem(): React.JSX.Element {
        const { loaded, loading, busy, error, players, days, snackbar } = this.state;
        const markedCount = players.filter(p => this.isMarked(p)).length;

        return (
            <Box sx={{ width: '100%' }}>
                <Stack spacing={2}>
                    <Stack
                        direction={{ xs: 'column', sm: 'row' }}
                        spacing={2}
                        alignItems={{ sm: 'center' }}
                    >
                        <TextField
                            type="number"
                            label={I18n.t('cleanup_days_label')}
                            value={days}
                            onChange={e => this.setDays(e.target.value)}
                            inputProps={{ min: 0, step: 1 }}
                            size="small"
                            sx={{ maxWidth: 160 }}
                        />
                        <Button
                            variant="contained"
                            color="error"
                            startIcon={busy ? <CircularProgress size={16} color="inherit" /> : <DeleteSweepIcon />}
                            onClick={() => void this.runCleanup()}
                            disabled={busy || markedCount === 0}
                        >
                            {I18n.t('cleanup_button', markedCount)}
                        </Button>
                        <Button
                            variant="outlined"
                            startIcon={<RefreshIcon />}
                            onClick={() => void this.reload()}
                            disabled={loading || busy}
                        >
                            {I18n.t('cleanup_refresh')}
                        </Button>
                        <Typography
                            variant="body2"
                            sx={{ color: 'text.secondary', flexGrow: 1 }}
                        >
                            {I18n.t('cleanup_hint')}
                        </Typography>
                    </Stack>

                    {error ? (
                        <Alert
                            severity="error"
                            variant="outlined"
                        >
                            {error}
                        </Alert>
                    ) : null}

                    {loading && !loaded ? (
                        <Stack
                            direction="row"
                            spacing={1}
                            alignItems="center"
                        >
                            <CircularProgress size={18} />
                            <Typography variant="body2">{I18n.t('cleanup_loading')}</Typography>
                        </Stack>
                    ) : players.length === 0 ? (
                        <Alert severity="info">{I18n.t('cleanup_empty')}</Alert>
                    ) : (
                        <Box
                            sx={{
                                display: 'grid',
                                gap: 1.5,
                                gridTemplateColumns: {
                                    xs: '1fr',
                                    sm: 'repeat(2, 1fr)',
                                    md: 'repeat(3, 1fr)',
                                },
                            }}
                        >
                            {players.map(p => this.renderPlayerCard(p))}
                        </Box>
                    )}
                </Stack>

                <Snackbar
                    open={!!snackbar}
                    autoHideDuration={3000}
                    onClose={() => this.setState({ snackbar: null })}
                    message={snackbar ?? ''}
                    anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
                />
            </Box>
        );
    }
}

export default PlayerCleanup;
