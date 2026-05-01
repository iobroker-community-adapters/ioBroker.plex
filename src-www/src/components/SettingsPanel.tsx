import { Box, Checkbox, Divider, Drawer, FormControlLabel, IconButton, Slider, ToggleButton, ToggleButtonGroup, Tooltip, Typography } from '@mui/material';
import SettingsIcon from '@mui/icons-material/Settings';
import ViewListIcon from '@mui/icons-material/ViewList';
import ViewColumnIcon from '@mui/icons-material/ViewColumn';
import { useState } from 'react';
import { useSettings } from '../settings';

export function SettingsPanel(): JSX.Element {
    const [open, setOpen] = useState(false);
    const { settings, update } = useSettings();

    return (
        <>
            <Tooltip title="Einstellungen">
                <IconButton size="small" onClick={() => setOpen(true)}>
                    <SettingsIcon fontSize="small" />
                </IconButton>
            </Tooltip>
            <Drawer anchor="right" open={open} onClose={() => setOpen(false)}>
                <Box sx={{ width: 280, p: 3 }}>
                    <Typography variant="h6" sx={{ mb: 3 }}>
                        Einstellungen
                    </Typography>

                    <Typography variant="body2" sx={{ mb: 1 }}>
                        Bildhöhe: {settings.thumbSize === 0 ? 'Aus' : `${settings.thumbSize} px`}
                    </Typography>
                    <Slider
                        min={0}
                        max={200}
                        step={10}
                        value={settings.thumbSize}
                        onChange={(_, v) => update({ thumbSize: v as number })}
                        marks={[
                            { value: 0, label: 'Aus' },
                            { value: 50, label: '50' },
                            { value: 200, label: '200' },
                        ]}
                        sx={{ mb: 3 }}
                    />

                    <Divider sx={{ mb: 3 }} />

                    <Typography variant="body2" sx={{ mb: 1 }}>
                        Max. Breite: {settings.maxWidth} px
                    </Typography>
                    <Slider
                        min={600}
                        max={2000}
                        step={50}
                        value={settings.maxWidth}
                        onChange={(_, v) => update({ maxWidth: v as number })}
                        marks={[
                            { value: 600, label: '600' },
                            { value: 1200, label: '1200' },
                            { value: 2000, label: '2000' },
                        ]}
                        sx={{ mb: 3 }}
                    />

                    <Divider sx={{ mb: 2 }} />

                    <FormControlLabel
                        control={
                            <Checkbox
                                checked={settings.showNowPlaying}
                                onChange={(_, v) => update({ showNowPlaying: v })}
                                size="small"
                            />
                        }
                        label="Now Playing anzeigen"
                    />
                    <FormControlLabel
                        control={
                            <Checkbox
                                checked={settings.showTimeline}
                                onChange={(_, v) => update({ showTimeline: v })}
                                size="small"
                            />
                        }
                        label="Timeline anzeigen"
                    />

                    <Divider sx={{ my: 2 }} />

                    <Typography variant="body2" sx={{ mb: 1.5 }}>
                        Timeline-Layout
                    </Typography>
                    <ToggleButtonGroup
                        exclusive
                        value={settings.timelineLayout}
                        onChange={(_, v) => v && update({ timelineLayout: v })}
                        size="small"
                        fullWidth
                    >
                        <ToggleButton value="list">
                            <ViewListIcon fontSize="small" sx={{ mr: 0.5 }} />
                            Liste
                        </ToggleButton>
                        <ToggleButton value="alternating">
                            <ViewColumnIcon fontSize="small" sx={{ mr: 0.5 }} />
                            Alternierend
                        </ToggleButton>
                    </ToggleButtonGroup>
                </Box>
            </Drawer>
        </>
    );
}
