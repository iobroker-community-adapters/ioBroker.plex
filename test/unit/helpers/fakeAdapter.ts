/**
 * Minimal stand-in for the ioBroker adapter instance, covering exactly the surface that
 * `src/lib/library.ts` and `src/lib/players.ts` touch. It records every call instead of talking to
 * a database, so tests can assert on what the adapter would have been asked to do.
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface FakeTimer {
    id: number;
    cb: () => void;
    ms: number;
    cleared: boolean;
}

export class FakeAdapter {
    public name = 'plex';
    public instance = 0;
    public namespace = 'plex.0';
    /** Same expression as js-controller's `adapter.FORBIDDEN_CHARS`. */
    public FORBIDDEN_CHARS = /[^._\-/ :!#$%&()+=@^{}|~\p{Ll}\p{Lu}\p{Nd}]+/gu;

    public config: Record<string, any> = {
        plexIp: '192.0.2.10',
        plexPort: 32_400,
        plexToken: 'SECRET-TOKEN',
        tokenInLinks: true,
        getMetadataTrees: false,
        getPlayerRefresh: 0,
    };

    public logs: Array<{ level: LogLevel; msg: string }> = [];
    public log = {
        debug: (msg: string): void => void this.logs.push({ level: 'debug', msg }),
        info: (msg: string): void => void this.logs.push({ level: 'info', msg }),
        warn: (msg: string): void => void this.logs.push({ level: 'warn', msg }),
        error: (msg: string): void => void this.logs.push({ level: 'error', msg }),
    };

    /** Calls to `extendObject` (object creation by the library). */
    public objectCalls: Array<{ id: string; obj: any }> = [];
    /** Calls to `extendObjectAsync` (used by `Library.extendState`). */
    public extendAsyncCalls: Array<{ id: string; obj: any }> = [];
    /** Calls to `setState`. `state` is `null` when a state was reset. */
    public stateCalls: Array<{ id: string; state: any }> = [];
    public subscriptions: string[] = [];
    /** Calls to `terminate`. */
    public terminations: Array<{ reason: string | undefined; exitCode: number | undefined }> = [];
    public timers: FakeTimer[] = [];

    /** If set, `setState` rejects with this error (and records nothing). */
    public failSetState: Error | undefined;
    /** If set, `extendObjectAsync` rejects with this error. */
    public failExtendObjectAsync: Error | undefined;
    /** Result handed to `getStates` callbacks: full state ids → state. */
    public dbStates: Record<string, { val: any } | null> = {};
    /** If set, `getStates` reports this error instead of `dbStates`. */
    public getStatesError: Error | undefined;
    /** Objects returned by `getObjectAsync`, keyed by relative id. */
    public dbObjects: Record<string, any> = {};

    private nextTimerId = 1;

    async extendObject(id: string, obj: any): Promise<void> {
        this.objectCalls.push({ id, obj });
    }

    async extendObjectAsync(id: string, obj: any): Promise<void> {
        if (this.failExtendObjectAsync) {
            throw this.failExtendObjectAsync;
        }
        this.extendAsyncCalls.push({ id, obj });
    }

    async setState(id: string, state: any): Promise<void> {
        if (this.failSetState) {
            throw this.failSetState;
        }
        this.stateCalls.push({ id, state });
    }

    getStates(pattern: string, callback: (err: Error | null, states?: Record<string, any>) => void): void {
        if (this.getStatesError) {
            callback(this.getStatesError);
            return;
        }
        // Only the trailing-wildcard form `<prefix>.*` and exact ids are used by the library.
        const prefix = pattern.endsWith('.*') ? pattern.slice(0, -1) : undefined;
        const result: Record<string, any> = {};
        for (const id of Object.keys(this.dbStates)) {
            const relative = id.replace(`${this.namespace}.`, '');
            if (prefix !== undefined ? relative.startsWith(prefix) : relative === pattern) {
                result[id] = this.dbStates[id];
            }
        }
        callback(null, result);
    }

    async getObjectAsync(id: string): Promise<any> {
        return this.dbObjects[id];
    }

    terminate(reason?: string, exitCode?: number): void {
        this.terminations.push({ reason, exitCode });
    }

    subscribeStates(pattern: string): void {
        this.subscriptions.push(pattern);
    }

    setTimeout(cb: () => void, ms: number): number {
        const timer: FakeTimer = { id: this.nextTimerId++, cb, ms, cleared: false };
        this.timers.push(timer);
        return timer.id;
    }

    clearTimeout(id: number | null | undefined): void {
        const timer = this.timers.find(t => t.id === id);
        if (timer) {
            timer.cleared = true;
        }
    }

    // --- helpers for assertions -------------------------------------------------------------

    /**
     * All messages logged at the given level.
     *
     * @param level - log level to filter by
     */
    logged(level: LogLevel): string[] {
        return this.logs.filter(l => l.level === level).map(l => l.msg);
    }

    /**
     * The object definitions the library created for `id` (normally exactly one).
     *
     * @param id - relative object id
     */
    objectsFor(id: string): any[] {
        return this.objectCalls.filter(c => c.id === id).map(c => c.obj);
    }

    /**
     * The values written to state `id`, in order (`null` for a reset).
     *
     * @param id - relative state id
     */
    valuesFor(id: string): any[] {
        return this.stateCalls.filter(c => c.id === id).map(c => (c.state === null ? null : c.state.val));
    }

    /**
     * The last value written to state `id`; fails loudly if it was never written.
     *
     * @param id - relative state id
     */
    lastValue(id: string): any {
        const values = this.valuesFor(id);
        if (!values.length) {
            throw new Error(`state "${id}" was never written (written: ${this.writtenIds().join(', ') || 'none'})`);
        }
        return values[values.length - 1];
    }

    writtenIds(): string[] {
        return [...new Set(this.stateCalls.map(c => c.id))];
    }

    createdIds(): string[] {
        return [...new Set(this.objectCalls.map(c => c.id))];
    }

    /** Forget everything recorded so far (e.g. the objects the Library constructor creates). */
    resetRecords(): void {
        this.logs = [];
        this.objectCalls = [];
        this.extendAsyncCalls = [];
        this.stateCalls = [];
    }
}

/**
 * Type the fake as the real adapter for constructors that expect `ioBroker.Adapter`.
 *
 * @param fake - the fake to pass on
 */
export function asAdapter(fake: FakeAdapter): ioBroker.Adapter {
    return fake as unknown as ioBroker.Adapter;
}

/** Let all already-queued promise callbacks and I/O callbacks run. */
export async function flush(): Promise<void> {
    for (let i = 0; i < 3; i++) {
        await new Promise<void>(resolve => setImmediate(resolve));
    }
}
