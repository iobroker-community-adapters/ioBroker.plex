/**
 * The web components of the Plex adapter. Each one is built on its own (`vite build --mode <name>`, see
 * `vite.config.ts`), so that each is ONE module file: a host imports exactly one URL per component.
 */

/** Name of a component: the mode of its build and the base name of its files */
export type ComponentName = 'plex-now-playing' | 'plex-activity' | 'plex-stats';

export const COMPONENT_NAMES: ComponentName[] = ['plex-now-playing', 'plex-activity', 'plex-stats'];

/** Tag of `<iob-plex-now-playing>`: what is playing on which player, with cover, progress and controls */
export const NOW_PLAYING_TAG = 'iob-plex-now-playing';

/** Tag of `<iob-plex-activity>`: the latest events of the Plex server as a timeline */
export const ACTIVITY_TAG = 'iob-plex-activity';

/** Tag of `<iob-plex-stats>`: the top users and libraries by watch time, from Tautulli */
export const STATS_TAG = 'iob-plex-stats';

/** The built module, next to its manifest */
export function getModuleFile(name: ComponentName): string {
    return `${name}.js`;
}

/** The manifest the build writes next to the module; `common.webComponents` names this one */
export function getManifestFile(name: ComponentName): string {
    return `${name}.json`;
}

/** Where `tasks.ts` puts the module in the admin folder; the React import is relative to it */
export function getModulePath(name: ComponentName): string {
    return `webcomponents/${getModuleFile(name)}`;
}

/** Layouts of `<iob-plex-now-playing>` */
export type NowPlayingLayout = 'cards' | 'compact';

/** The values of the settings of `<iob-plex-now-playing>`; a setting without a value is missing */
export type NowPlayingSettings = {
    /** e.g. `plex.0` */
    instance?: string;
    /** Only this player: its channel `plex.0._playing.<name>-<id>` (or a state below it) */
    player?: string;
    layout?: NowPlayingLayout;
    showPaused?: boolean;
    showCover?: boolean;
    showControls?: boolean;
};

/** The values of the settings of `<iob-plex-activity>`; a setting without a value is missing */
export type ActivitySettings = {
    /** e.g. `plex.0` */
    instance?: string;
    /** How many events to show at most */
    count?: number;
    /** Only the events of playback: play, pause, resume, stop, watched, rated */
    playbackOnly?: boolean;
    showCovers?: boolean;
};

/** A period of the watch statistics of Tautulli */
export type StatsPeriod = '24h' | '7d' | '30d' | 'all';

/** Which lists `<iob-plex-stats>` shows */
export type StatsShow = 'both' | 'users' | 'libraries';

/** The values of the settings of `<iob-plex-stats>`; a setting without a value is missing */
export type StatsSettings = {
    /** e.g. `plex.0` */
    instance?: string;
    period?: StatsPeriod;
    show?: StatsShow;
    /** How many entries per list */
    count?: number;
};

/**
 * The namespace of an instance setting: `plex.0`, also for `0` or `system.adapter.plex.0`
 *
 * @param instance what the setting holds
 * @returns `plex.<n>`, or null if it is no instance of the Plex adapter
 */
export function getNamespace(instance: string | undefined): string | null {
    if (!instance) {
        return null;
    }
    const value = instance.trim().replace(/^system\.adapter\./, '');
    if (/^\d+$/.test(value)) {
        return `plex.${value}`;
    }
    return /^plex\.\d+$/.test(value) ? value : null;
}
