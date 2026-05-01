import { Box, Card, CardContent, Stack, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material';
import { useEffect, useMemo, useState } from 'react';
import { ADAPTER_NAMESPACE, getAdapterConfig, useIobStates } from '../socket';

type Period = '24h' | '7d' | '30d' | 'all';

const PERIOD_DAYS: Record<Period, number> = {
    '24h': 1,
    '7d': 7,
    '30d': 30,
    all: 0,
};

interface Row {
    name: string;
    plays: number;
    seconds: number;
}

function formatDuration(secs: number): string {
    if (secs <= 0) {
        return '0m';
    }
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    if (h === 0) {
        return `${m}m`;
    }
    return `${h}h ${m}m`;
}

function aggregate(states: Record<string, ioBroker.State>, period: Period, prefix: string): Row[] {
    const targetDays = PERIOD_DAYS[period];
    const byName: Record<string, Row> = {};
    for (const [id, state] of Object.entries(states)) {
        const rest = id.slice(prefix.length + 1);
        const parts = rest.split('.');
        if (parts.length < 2) {
            continue;
        }
        const name = parts[0];
        const field = parts[parts.length - 1];
        const queryDays = Number(
            (states[`${prefix}.${name}.query_days`] || states[`${prefix}.${name}.${parts[1]}.query_days`])?.val ?? -1,
        );
        // The adapter stores stats keyed by query_days. We pick the matching period.
        if (queryDays !== targetDays) {
            continue;
        }
        if (!byName[name]) {
            byName[name] = { name, plays: 0, seconds: 0 };
        }
        if (field === 'total_plays') {
            byName[name].plays = Number(state.val ?? 0);
        } else if (field === 'total_time') {
            byName[name].seconds = Number(state.val ?? 0);
        }
    }
    return Object.values(byName)
        .filter(r => r.plays > 0 || r.seconds > 0)
        .sort((a, b) => b.seconds - a.seconds)
        .slice(0, 5);
}

interface ListProps {
    title: string;
    rows: Row[];
}

function StatList({ title, rows }: ListProps): JSX.Element {
    return (
        <Card sx={{ flex: 1, minWidth: 240 }}>
            <CardContent>
                <Typography variant="overline" sx={{ opacity: 0.7, letterSpacing: 1 }}>
                    {title}
                </Typography>
                {rows.length === 0 ? (
                    <Typography variant="body2" sx={{ opacity: 0.5, py: 2, textAlign: 'center' }}>
                        Keine Daten
                    </Typography>
                ) : (
                    <Stack spacing={1} sx={{ mt: 1 }}>
                        {rows.map((r, i) => (
                            <Stack key={r.name} direction="row" spacing={1} alignItems="center">
                                <Typography variant="caption" sx={{ width: 18, opacity: 0.5 }}>
                                    {i + 1}
                                </Typography>
                                <Typography variant="body2" sx={{ flex: 1 }} noWrap>
                                    {r.name}
                                </Typography>
                                <Typography variant="caption" sx={{ opacity: 0.7, minWidth: 60, textAlign: 'right' }}>
                                    {formatDuration(r.seconds)}
                                </Typography>
                                <Typography variant="caption" sx={{ opacity: 0.5, minWidth: 50, textAlign: 'right' }}>
                                    {r.plays} ▶
                                </Typography>
                            </Stack>
                        ))}
                    </Stack>
                )}
            </CardContent>
        </Card>
    );
}

export function TautulliStats(): JSX.Element | null {
    const [enabled, setEnabled] = useState<boolean | null>(null);
    const [period, setPeriod] = useState<Period>('7d');

    useEffect(() => {
        getAdapterConfig().then(cfg => {
            // Treat as enabled if either flag set, or both IP+token present (legacy configs).
            const e =
                (cfg && cfg.tautulliEnabled === true) ||
                (cfg && cfg.tautulliEnabled !== false && Boolean(cfg.tautulliIp) && Boolean(cfg.tautulliToken));
            setEnabled(Boolean(e));
        });
    }, []);

    const userStates = useIobStates(enabled ? 'statistics.users.*' : null);
    const libraryStates = useIobStates(enabled ? 'statistics.libraries.*' : null);

    const userRows = useMemo(
        () => aggregate(userStates, period, `${ADAPTER_NAMESPACE}.statistics.users`),
        [userStates, period],
    );
    const libraryRows = useMemo(
        () => aggregate(libraryStates, period, `${ADAPTER_NAMESPACE}.statistics.libraries`),
        [libraryStates, period],
    );

    if (!enabled) {
        return null;
    }

    return (
        <Box sx={{ p: 2 }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                <Typography variant="overline" sx={{ opacity: 0.6, letterSpacing: 1 }}>
                    Tautulli Statistics
                </Typography>
                <ToggleButtonGroup
                    size="small"
                    value={period}
                    exclusive
                    onChange={(_, v) => v && setPeriod(v as Period)}
                >
                    <ToggleButton value="24h">24h</ToggleButton>
                    <ToggleButton value="7d">7d</ToggleButton>
                    <ToggleButton value="30d">30d</ToggleButton>
                    <ToggleButton value="all">all</ToggleButton>
                </ToggleButtonGroup>
            </Stack>
            <Stack direction="row" spacing={2} sx={{ flexWrap: 'wrap', gap: 2 }}>
                <StatList title="Top Users" rows={userRows} />
                <StatList title="Top Libraries" rows={libraryRows} />
            </Stack>
        </Box>
    );
}
