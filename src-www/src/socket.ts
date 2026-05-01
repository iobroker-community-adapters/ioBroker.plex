import { Connection } from '@iobroker/socket-client';
import { useEffect, useState, useSyncExternalStore } from 'react';

export const ADAPTER_NAMESPACE = 'plex.0';

let connectionPromise: Promise<Connection> | null = null;
let cachedConnection: Connection | null = null;
const connectedListeners = new Set<() => void>();
let isConnected = false;

function notifyConnected(): void {
    for (const l of connectedListeners) {
        l();
    }
}

function awaitSocketIo(): Promise<void> {
    if (typeof globalThis !== 'undefined' && (globalThis as any).io) {
        return Promise.resolve();
    }
    return new Promise(resolve => {
        const w = window as unknown as { registerSocketOnLoad?: (cb: () => void) => void };
        if (typeof w.registerSocketOnLoad === 'function') {
            w.registerSocketOnLoad(resolve);
        } else {
            // Polling fallback if the loader was not installed.
            const t = setInterval(() => {
                if ((globalThis as any).io) {
                    clearInterval(t);
                    resolve();
                }
            }, 100);
        }
    });
}

export function getConnection(): Promise<Connection> {
    if (cachedConnection) {
        return Promise.resolve(cachedConnection);
    }
    if (connectionPromise) {
        return connectionPromise;
    }
    connectionPromise = awaitSocketIo().then(
        () =>
            new Promise<Connection>(resolve => {
                // host/port/protocol are derived from window.socketUrl (set in index.html).
                const conn = new Connection({
                    name: 'plex.www',
                    onReady: () => {
                        cachedConnection = conn;
                        isConnected = true;
                        notifyConnected();
                        resolve(conn);
                    },
                    onError: err => {
                        // eslint-disable-next-line no-console
                        console.error('socket-client error:', err);
                    },
                });
                // Connection wires up disconnect/reconnect internally; mirror that into our flag.
                const sock = (conn as unknown as { _socket?: { on: (ev: string, fn: () => void) => void } })._socket;
                sock?.on('disconnect', () => {
                    isConnected = false;
                    notifyConnected();
                });
                sock?.on('reconnect', () => {
                    isConnected = true;
                    notifyConnected();
                });
            }),
    );
    return connectionPromise;
}

export function useConnection(): Connection | null {
    const [conn, setConn] = useState<Connection | null>(cachedConnection);
    useEffect(() => {
        if (!conn) {
            getConnection().then(setConn);
        }
    }, [conn]);
    return conn;
}

export function useConnectionStatus(): boolean {
    return useSyncExternalStore(
        listener => {
            connectedListeners.add(listener);
            return () => connectedListeners.delete(listener);
        },
        () => isConnected,
        () => false,
    );
}

function fullId(id: string): string {
    return id.includes('.') && id.startsWith(`${ADAPTER_NAMESPACE}.`) ? id : `${ADAPTER_NAMESPACE}.${id}`;
}

export function useIobState(id: string | null): ioBroker.State | null | undefined {
    const conn = useConnection();
    const [state, setState] = useState<ioBroker.State | null | undefined>(undefined);
    useEffect(() => {
        if (!conn || !id) {
            return;
        }
        const sid = fullId(id);
        let active = true;
        const handler: ioBroker.StateChangeHandler = (changedId, s) => {
            if (changedId === sid && active) {
                setState(s);
            }
        };
        conn.subscribeState(sid, handler).catch(() => {});
        conn.getState(sid).then(s => {
            if (active) {
                setState(s ?? null);
            }
        });
        return () => {
            active = false;
            conn.unsubscribeState(sid, handler);
        };
    }, [conn, id]);
    return state;
}

export function useIobStates(pattern: string | null): Record<string, ioBroker.State> {
    const conn = useConnection();
    const [states, setStates] = useState<Record<string, ioBroker.State>>({});
    useEffect(() => {
        if (!conn || !pattern) {
            return;
        }
        const fullPattern = fullId(pattern);
        let active = true;
        const handler: ioBroker.StateChangeHandler = (id, state) => {
            if (!active) {
                return;
            }
            setStates(prev => {
                const next = { ...prev };
                if (state) {
                    next[id] = state;
                } else {
                    delete next[id];
                }
                return next;
            });
        };
        conn.subscribeState(fullPattern, handler).catch(() => {});
        conn.getStates(fullPattern).then(initial => {
            if (active) {
                setStates(initial || {});
            }
        });
        return () => {
            active = false;
            conn.unsubscribeState(fullPattern, handler);
        };
    }, [conn, pattern]);
    return states;
}

export async function setIobState(id: string, val: ioBroker.StateValue): Promise<void> {
    const conn = await getConnection();
    await conn.setState(fullId(id), val);
}

export async function getAdapterConfig(): Promise<Record<string, unknown> | null> {
    const conn = await getConnection();
    const obj = await conn.getObject(`system.adapter.${ADAPTER_NAMESPACE}`);
    return (obj?.native as Record<string, unknown>) ?? null;
}
