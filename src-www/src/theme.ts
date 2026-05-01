import { createTheme, type Theme } from '@mui/material/styles';
import { useEffect, useMemo, useState } from 'react';

export type ThemeMode = 'light' | 'dark';
const STORAGE_KEY = 'plex-www-theme';

function readStoredMode(): ThemeMode | null {
    try {
        const v = localStorage.getItem(STORAGE_KEY);
        return v === 'light' || v === 'dark' ? v : null;
    } catch {
        return null;
    }
}

function systemPrefersDark(): boolean {
    return typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches;
}

export function useThemeMode(): { mode: ThemeMode; toggle: () => void; theme: Theme } {
    const [mode, setMode] = useState<ThemeMode>(() => readStoredMode() ?? (systemPrefersDark() ? 'dark' : 'light'));

    useEffect(() => {
        if (readStoredMode()) {
            return;
        }
        const mq = window.matchMedia('(prefers-color-scheme: dark)');
        const onChange = (e: MediaQueryListEvent): void => {
            setMode(e.matches ? 'dark' : 'light');
        };
        mq.addEventListener('change', onChange);
        return () => mq.removeEventListener('change', onChange);
    }, []);

    const theme = useMemo(
        () =>
            createTheme({
                palette: {
                    mode,
                    primary: { main: '#e5a00d' },
                    secondary: { main: '#1f1f1f' },
                },
                shape: { borderRadius: 10 },
            }),
        [mode],
    );

    const toggle = (): void => {
        setMode(prev => {
            const next: ThemeMode = prev === 'dark' ? 'light' : 'dark';
            try {
                localStorage.setItem(STORAGE_KEY, next);
            } catch {
                /* ignore quota / privacy errors */
            }
            return next;
        });
    };

    return { mode, toggle, theme };
}
