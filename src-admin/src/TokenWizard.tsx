import React from 'react';
import {
    Alert,
    Box,
    Button,
    CircularProgress,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    IconButton,
    Snackbar,
    Stack,
    Tooltip,
    Typography,
} from '@mui/material';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import VpnKeyIcon from '@mui/icons-material/VpnKey';
import CloseIcon from '@mui/icons-material/Close';
import { ConfigGeneric, type ConfigGenericProps, type ConfigGenericState } from '@iobroker/json-config';
import { I18n } from '@iobroker/adapter-react-v5';

type LastError = 'unauthorized' | 'network' | null;

interface TokenWizardState extends ConfigGenericState {
    connected: boolean;
    hasToken: boolean;
    lastError: LastError;
    statusLoaded: boolean;

    dialogOpen: boolean;
    pinId: number | null;
    pinCode: string | null;
    loadingPin: boolean;
    loadingToken: boolean;
    statusMsg: string;
    statusKind: 'info' | 'success' | 'error';

    snackbar: string | null;
}

const POLL_INTERVAL_MS = 3_000;
const PLEX_LINK_URL = 'https://plex.tv/link';

class TokenWizard extends ConfigGeneric<ConfigGenericProps, TokenWizardState> {
    private _pollTimer: number | null = null;
    private _polling = false;
    private _visibilityHandler: (() => void) | null = null;

    constructor(props: ConfigGenericProps) {
        super(props);
        Object.assign(this.state, {
            connected: false,
            hasToken: false,
            lastError: null,
            statusLoaded: false,
            dialogOpen: false,
            pinId: null,
            pinCode: null,
            loadingPin: false,
            loadingToken: false,
            statusMsg: '',
            statusKind: 'info',
            snackbar: null,
        } satisfies Partial<TokenWizardState>);
    }

    componentDidMount(): void {
        super.componentDidMount();
        this._visibilityHandler = (): void => {
            if (document.hidden) {
                this.stopPolling();
            } else {
                void this.pollStatus();
            }
        };
        document.addEventListener('visibilitychange', this._visibilityHandler);
        void this.pollStatus();
    }

    componentWillUnmount(): void {
        super.componentWillUnmount();
        this.stopPolling();
        if (this._visibilityHandler) {
            document.removeEventListener('visibilitychange', this._visibilityHandler);
            this._visibilityHandler = null;
        }
    }

    private stopPolling(): void {
        if (this._pollTimer !== null) {
            window.clearTimeout(this._pollTimer);
            this._pollTimer = null;
        }
    }

    private async pollStatus(): Promise<void> {
        if (this._polling || document.hidden) {
            return;
        }
        this._polling = true;
        this.stopPolling();

        let connected = false;
        let lastError: LastError = null;
        let hasToken = false;

        try {
            const raw: unknown = await this.props.oContext.socket.sendTo(
                `plex.${this.props.oContext.instance}`,
                'getConnectionStatus',
                {},
            );
            const r = raw as { connected?: boolean; lastError?: LastError; hasToken?: boolean } | undefined;
            if (r) {
                connected = r.connected === true;
                lastError = r.lastError ?? null;
                hasToken = r.hasToken === true;
            }
        } catch {
            // Adapter not running – fall back to the saved data so the button still
            // reflects whether a token is configured at all.
            const tokenFromData = (this.props.data as Record<string, unknown> | undefined)?.plexToken;
            hasToken = typeof tokenFromData === 'string' && tokenFromData.length > 0;
            connected = false;
            lastError = null;
        }

        const next: Partial<TokenWizardState> = {
            connected,
            lastError,
            hasToken,
            statusLoaded: true,
        };
        if (
            this.state.connected !== connected ||
            this.state.lastError !== lastError ||
            this.state.hasToken !== hasToken ||
            !this.state.statusLoaded
        ) {
            this.setState(next as TokenWizardState);
        }

        this._polling = false;
        this._pollTimer = window.setTimeout(() => {
            this._pollTimer = null;
            void this.pollStatus();
        }, POLL_INTERVAL_MS);
    }

    private isRed(): boolean {
        const { hasToken, lastError, statusLoaded } = this.state;
        if (!statusLoaded) {
            return false;
        }
        return !hasToken || lastError === 'unauthorized';
    }

    private async handleOpen(): Promise<void> {
        this.setState({
            dialogOpen: true,
            pinId: null,
            pinCode: null,
            loadingPin: true,
            loadingToken: false,
            statusMsg: I18n.t('tokenDialog_status_connecting'),
            statusKind: 'info',
        });

        try {
            const raw: unknown = await this.props.oContext.socket.sendTo(
                `plex.${this.props.oContext.instance}`,
                'getPin',
                {},
            );
            const r = raw as { result?: boolean; pin?: { id: number; code: string }; error?: string } | undefined;
            if (r && r.result && r.pin) {
                this.setState({
                    pinId: r.pin.id,
                    pinCode: r.pin.code,
                    loadingPin: false,
                    statusMsg: I18n.t('tokenDialog_status_gotPin'),
                    statusKind: 'info',
                });
            } else {
                this.setState({
                    loadingPin: false,
                    statusMsg: r?.error ?? I18n.t('tokenDialog_status_error_pin'),
                    statusKind: 'error',
                });
            }
        } catch (err) {
            this.setState({
                loadingPin: false,
                statusMsg: (err as Error)?.message ?? I18n.t('tokenDialog_status_error_pin'),
                statusKind: 'error',
            });
        }
    }

    private handleClose(): void {
        this.setState({ dialogOpen: false });
    }

    private async copyPin(): Promise<void> {
        const { pinCode } = this.state;
        if (!pinCode) {
            return;
        }
        let ok = false;
        try {
            if (navigator.clipboard && navigator.clipboard.writeText) {
                await navigator.clipboard.writeText(pinCode);
                ok = true;
            }
        } catch {
            ok = false;
        }
        if (!ok) {
            // Fallback for non-secure contexts.
            try {
                const ta = document.createElement('textarea');
                ta.value = pinCode;
                ta.style.position = 'fixed';
                ta.style.opacity = '0';
                document.body.appendChild(ta);
                ta.select();
                ok = document.execCommand('copy');
                document.body.removeChild(ta);
            } catch {
                ok = false;
            }
        }
        if (ok) {
            this.setState({ snackbar: I18n.t('tokenDialog_copied') });
        }
    }

    private openPlexLink(): void {
        // Synchronous in click handler – avoids most popup blockers.
        const win = window.open(PLEX_LINK_URL, '_blank', 'noopener,noreferrer');
        if (!win) {
            // Fallback: offer the link as a copy if popups are blocked.
            this.setState({ snackbar: I18n.t('tokenDialog_popupBlocked') });
        }
    }

    private async applyToken(): Promise<void> {
        const { pinId } = this.state;
        if (pinId === null) {
            return;
        }
        this.setState({
            loadingToken: true,
            statusMsg: I18n.t('tokenDialog_status_waiting'),
            statusKind: 'info',
        });

        try {
            const raw: unknown = await this.props.oContext.socket.sendTo(
                `plex.${this.props.oContext.instance}`,
                'getToken',
                { pinId },
            );
            const r = raw as { result?: boolean; token?: string; error?: string } | undefined;
            if (r && r.result && r.token) {
                const previousToken = (this.props.data as Record<string, unknown> | undefined)?.plexToken;
                const unchanged = typeof previousToken === 'string' && previousToken === r.token;
                // Use the inherited ConfigGeneric.onChange — it clones the current
                // data, sets only this field, then forwards to props.onChange. Calling
                // props.onChange directly with (attr, value) wipes the rest of the form.
                await this.onChange('plexToken', r.token);
                this.setState({
                    loadingToken: false,
                    statusMsg: unchanged
                        ? I18n.t('tokenDialog_status_success_unchanged')
                        : I18n.t('tokenDialog_status_success'),
                    statusKind: 'success',
                    dialogOpen: false,
                    snackbar: unchanged ? I18n.t('tokenDialog_unchanged') : I18n.t('tokenDialog_applied'),
                });
            } else {
                this.setState({
                    loadingToken: false,
                    statusMsg: r?.error ?? I18n.t('tokenDialog_status_error_token'),
                    statusKind: 'error',
                });
            }
        } catch (err) {
            this.setState({
                loadingToken: false,
                statusMsg: (err as Error)?.message ?? I18n.t('tokenDialog_status_error_token'),
                statusKind: 'error',
            });
        }
    }

    private renderButton(): React.JSX.Element {
        const red = this.isRed();
        const color = red ? 'error' : 'success';
        const label = red ? I18n.t('tokenButton_required') : I18n.t('tokenButton_renew');
        const Icon = red ? ErrorOutlineIcon : CheckCircleIcon;
        const tooltip = !this.state.statusLoaded
            ? I18n.t('tokenButton_tooltip_loading')
            : red
              ? I18n.t('tokenButton_tooltip_required')
              : I18n.t('tokenButton_tooltip_renew');

        return (
            <Tooltip title={tooltip}>
                <span>
                    <Button
                        variant="contained"
                        color={color}
                        startIcon={<Icon />}
                        onClick={() => void this.handleOpen()}
                        disabled={this.state.dialogOpen}
                    >
                        {label}
                    </Button>
                </span>
            </Tooltip>
        );
    }

    private renderDialog(): React.JSX.Element {
        const { dialogOpen, pinCode, loadingPin, loadingToken, statusMsg, statusKind, pinId } = this.state;

        return (
            <Dialog
                open={dialogOpen}
                onClose={() => this.handleClose()}
                maxWidth="sm"
                fullWidth
            >
                <DialogTitle sx={{ pr: 6 }}>
                    {I18n.t('tokenDialog_title')}
                    <IconButton
                        aria-label="close"
                        onClick={() => this.handleClose()}
                        sx={{ position: 'absolute', right: 8, top: 8 }}
                    >
                        <CloseIcon />
                    </IconButton>
                </DialogTitle>
                <DialogContent dividers>
                    <Stack spacing={2}>
                        <Box>
                            <Typography
                                variant="subtitle2"
                                gutterBottom
                            >
                                {I18n.t('tokenDialog_step1')}
                            </Typography>
                            {loadingPin ? (
                                <Stack
                                    direction="row"
                                    spacing={1}
                                    alignItems="center"
                                >
                                    <CircularProgress size={18} />
                                    <Typography variant="body2">{I18n.t('tokenDialog_status_connecting')}</Typography>
                                </Stack>
                            ) : pinCode ? (
                                <Tooltip title={I18n.t('tokenDialog_copyHint')}>
                                    <Box
                                        onClick={() => void this.copyPin()}
                                        sx={{
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: 1,
                                            cursor: 'pointer',
                                            border: '1px dashed',
                                            borderColor: 'divider',
                                            borderRadius: 1,
                                            px: 2,
                                            py: 1,
                                            userSelect: 'all',
                                            '&:hover': { borderColor: 'primary.main' },
                                        }}
                                    >
                                        <Typography
                                            variant="h4"
                                            component="span"
                                            sx={{ fontFamily: 'monospace', letterSpacing: '0.2em' }}
                                        >
                                            {pinCode}
                                        </Typography>
                                        <ContentCopyIcon
                                            fontSize="small"
                                            color="action"
                                        />
                                    </Box>
                                </Tooltip>
                            ) : null}
                        </Box>

                        <Box>
                            <Typography
                                variant="subtitle2"
                                gutterBottom
                            >
                                {I18n.t('tokenDialog_step2')}
                            </Typography>
                            <Stack
                                direction={{ xs: 'column', sm: 'row' }}
                                spacing={1}
                                alignItems={{ sm: 'center' }}
                            >
                                <Button
                                    variant="outlined"
                                    startIcon={<OpenInNewIcon />}
                                    onClick={() => this.openPlexLink()}
                                    disabled={!pinCode}
                                >
                                    {I18n.t('tokenDialog_openPlex')}
                                </Button>
                                <Typography
                                    component="a"
                                    href={PLEX_LINK_URL}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    variant="body2"
                                    sx={{ color: 'text.secondary' }}
                                >
                                    {PLEX_LINK_URL}
                                </Typography>
                            </Stack>
                        </Box>

                        <Box>
                            <Typography
                                variant="subtitle2"
                                gutterBottom
                            >
                                {I18n.t('tokenDialog_step3')}
                            </Typography>
                            <Button
                                variant="contained"
                                color="primary"
                                startIcon={
                                    loadingToken ? (
                                        <CircularProgress
                                            size={16}
                                            color="inherit"
                                        />
                                    ) : (
                                        <VpnKeyIcon />
                                    )
                                }
                                onClick={() => void this.applyToken()}
                                disabled={pinId === null || loadingToken}
                            >
                                {I18n.t('tokenDialog_apply')}
                            </Button>
                        </Box>

                        {statusMsg ? (
                            <Alert
                                severity={statusKind}
                                variant="outlined"
                            >
                                {statusMsg}
                            </Alert>
                        ) : null}
                    </Stack>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => this.handleClose()}>{I18n.t('tokenDialog_cancel')}</Button>
                </DialogActions>
            </Dialog>
        );
    }

    renderItem(): React.JSX.Element {
        return (
            <Box sx={{ width: '100%' }}>
                {this.renderButton()}
                {this.renderDialog()}
                <Snackbar
                    open={!!this.state.snackbar}
                    autoHideDuration={2500}
                    onClose={() => this.setState({ snackbar: null })}
                    message={this.state.snackbar ?? ''}
                    anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
                />
            </Box>
        );
    }
}

export default TokenWizard;
