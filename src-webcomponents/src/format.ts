/** Formatting of times, durations and days for the elements */

/**
 * The locale of `Intl` for a language of ioBroker
 *
 * @param lang the language of the system, e.g. `de` or `zh-cn`
 */
function toLocale(lang: string): string {
    return lang === 'zh-cn' ? 'zh-CN' : lang || 'en';
}

/**
 * Seconds as `m:ss`, or `h:mm:ss` from an hour on
 *
 * @param seconds the time in seconds
 */
export function formatTime(seconds: number): string {
    const total = Math.max(0, Math.floor(seconds || 0));
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = String(total % 60).padStart(2, '0');
    return h ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`;
}

/**
 * A watch time as `5h 12m`, or `12m` below an hour
 *
 * @param seconds the time in seconds
 */
export function formatDuration(seconds: number): string {
    if (!seconds || seconds <= 0) {
        return '0m';
    }
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return h ? `${h}h ${m}m` : `${m}m`;
}

/**
 * The time of day of a moment, e.g. `14:05`
 *
 * @param ms the moment in ms
 * @param lang the language of the system
 */
export function formatClock(ms: number, lang: string): string {
    try {
        return new Date(ms).toLocaleTimeString(toLocale(lang), { hour: '2-digit', minute: '2-digit' });
    } catch {
        return new Date(ms).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
    }
}

/**
 * Date and time of a moment
 *
 * @param ms the moment in ms
 * @param lang the language of the system
 */
export function formatDateTime(ms: number, lang: string): string {
    try {
        return new Date(ms).toLocaleString(toLocale(lang));
    } catch {
        return new Date(ms).toLocaleString();
    }
}

/**
 * The day of a moment, e.g. `Monday, 3 November`, or the words for today and yesterday
 *
 * @param ms the moment in ms
 * @param lang the language of the system
 * @param today the word for today
 * @param yesterday the word for yesterday
 */
export function formatDay(ms: number, lang: string, today: string, yesterday: string): string {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const day = new Date(ms);
    day.setHours(0, 0, 0, 0);
    const diff = Math.round((start.getTime() - day.getTime()) / 86_400_000);
    if (diff === 0) {
        return today;
    }
    if (diff === 1) {
        return yesterday;
    }
    const options: Intl.DateTimeFormatOptions = { weekday: 'long', day: 'numeric', month: 'long' };
    if (day.getFullYear() !== start.getFullYear()) {
        options.year = 'numeric';
    }
    try {
        return new Date(ms).toLocaleDateString(toLocale(lang), options);
    } catch {
        return new Date(ms).toLocaleDateString(undefined, options);
    }
}

/**
 * The key of the day of a moment, to group events by day
 *
 * @param ms the moment in ms
 */
export function dayKey(ms: number): string {
    const date = new Date(ms);
    return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}
