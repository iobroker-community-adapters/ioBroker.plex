import { AppBar, Box, CssBaseline, Divider, IconButton, ThemeProvider, Toolbar, Tooltip } from '@mui/material';
import LightModeIcon from '@mui/icons-material/LightMode';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import { useThemeMode } from './theme';
import { ServerStatusBadge } from './components/ServerStatusBadge';
import { NowPlaying } from './components/NowPlaying';
import { Timeline } from './components/Timeline';
import { TautulliStats } from './components/TautulliStats';
import { SettingsPanel } from './components/SettingsPanel';
import { SettingsContext, useSettings, useSettingsProvider } from './settings';

function AppInner(): JSX.Element {
    const { mode, toggle, theme } = useThemeMode();
    const { settings } = useSettings();

    return (
        <ThemeProvider theme={theme}>
            <CssBaseline />
            <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
                <AppBar position="sticky" elevation={0} color="default">
                    <Toolbar variant="dense" sx={{ gap: 2 }}>
                        <Box
                            component="img"
                            src="./plex.jpg"
                            alt=""
                            sx={{ height: 24 }}
                            onError={e => {
                                (e.currentTarget as HTMLImageElement).style.display = 'none';
                            }}
                        />
                        <Box sx={{ flex: 1 }} />
                        <ServerStatusBadge />
                        <Tooltip title={mode === 'dark' ? 'Light mode' : 'Dark mode'}>
                            <IconButton size="small" onClick={toggle}>
                                {mode === 'dark' ? <LightModeIcon /> : <DarkModeIcon />}
                            </IconButton>
                        </Tooltip>
                        <SettingsPanel />
                    </Toolbar>
                </AppBar>
                <Box sx={{ maxWidth: settings.maxWidth, mx: 'auto' }}>
                    {settings.showNowPlaying && <NowPlaying />}
                    {settings.showNowPlaying && <Divider />}
                    <TautulliStats />
                    {settings.showTimeline && <Timeline />}
                </Box>
            </Box>
        </ThemeProvider>
    );
}

export function App(): JSX.Element {
    const ctx = useSettingsProvider();
    return (
        <SettingsContext.Provider value={ctx}>
            <AppInner />
        </SettingsContext.Provider>
    );
}
