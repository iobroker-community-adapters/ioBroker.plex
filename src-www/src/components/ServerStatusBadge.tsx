import { Box, Stack, Tooltip, Typography } from '@mui/material';
import { useEffect, useState } from 'react';
import { getConnection, useConnectionStatus, ADAPTER_NAMESPACE } from '../socket';

interface ServerInfo {
    name?: string;
    version?: string;
    address?: string;
}

export function ServerStatusBadge(): JSX.Element {
    const connected = useConnectionStatus();
    const [server, setServer] = useState<ServerInfo | null>(null);

    useEffect(() => {
        if (!connected) {
            return;
        }
        let cancelled = false;
        getConnection().then(async conn => {
            const states = await conn.getStates(`${ADAPTER_NAMESPACE}.servers.*`);
            if (cancelled || !states) {
                return;
            }
            const info: ServerInfo = {};
            for (const [id, state] of Object.entries(states)) {
                if (id.endsWith('.name')) {
                    info.name = String(state?.val ?? '');
                } else if (id.endsWith('.version')) {
                    info.version = String(state?.val ?? '');
                } else if (id.endsWith('.address')) {
                    info.address = String(state?.val ?? '');
                }
            }
            setServer(info);
        });
        return () => {
            cancelled = true;
        };
    }, [connected]);

    return (
        <Tooltip
            title={
                <Box>
                    <div>{connected ? 'Connected to ioBroker' : 'Disconnected'}</div>
                    {server?.address && <div>Server: {server.address}</div>}
                </Box>
            }
        >
            <Stack direction="row" alignItems="center" spacing={1}>
                <Box
                    sx={{
                        width: 10,
                        height: 10,
                        borderRadius: '50%',
                        bgcolor: connected ? 'success.main' : 'error.main',
                        boxShadow: connected ? '0 0 6px rgba(76,175,80,0.6)' : 'none',
                    }}
                />
                <Stack direction="column" spacing={0} sx={{ lineHeight: 1 }}>
                    <Typography variant="caption" sx={{ fontWeight: 600 }}>
                        {server?.name || 'Plex'}
                    </Typography>
                    {server?.version && (
                        <Typography variant="caption" sx={{ opacity: 0.7, fontSize: '0.7rem' }}>
                            v{server.version}
                        </Typography>
                    )}
                </Stack>
            </Stack>
        </Tooltip>
    );
}
