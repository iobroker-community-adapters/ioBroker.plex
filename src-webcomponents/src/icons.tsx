import type { JSX } from 'react';

/** The pictures of the elements: the paths of the Material icons the www page of the adapter shows (24 x 24) */
const PATHS = {
    play: 'M8 5v14l11-7z',
    pause: 'M6 19h4V5H6v14zm8-14v14h4V5h-4z',
    stop: 'M6 6h12v12H6z',
    skipNext: 'M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z',
    skipPrevious: 'M6 6h2v12H6zm3.5 6 8.5 6V6z',
    replay: 'M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z',
    star: 'M12 17.27 18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z',
    libraryAdd:
        'M4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6zm16-4H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-1 9h-4v4h-2v-4H9V9h4V5h2v4h4v2z',
    bookmark: 'M17 3H7c-1.1 0-1.99.9-1.99 2L5 21l7-3 7 3V5c0-1.1-.9-2-2-2z',
    devices:
        'M3 6h18V4H3c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h4v-2H3V6zm10 6H9v1.78c-.61.55-1 1.33-1 2.22s.39 1.67 1 2.22V20h4v-1.78c.61-.55 1-1.34 1-2.22s-.39-1.67-1-2.22V12zm-2 5.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM22 8h-6c-.5 0-1 .5-1 1v10c0 .5.5 1 1 1h6c.5 0 1-.5 1-1V9c0-.5-.5-1-1-1zm-1 10h-4v-8h4v8z',
    storage: 'M2 20h20v-4H2v4zm2-3h2v2H4v-2zM2 4v4h20V4H2zm4 3H4V5h2v2zm-4 7h20v-4H2v4zm2-3h2v2H4v-2z',
    warning: 'M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z',
    update: 'M17 1.01 7 1c-1.1 0-1.99.9-1.99 2v18c0 1.1.89 2 1.99 2h10c1.1 0 2-.9 2-2V3c0-1.1-.9-1.99-2-1.99zM17 19H7V5h10v14zm-1-6h-3V8h-2v5H8l4 4 4-4z',
    help: 'M11 18h2v-2h-2v2zm1-16C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm0-14c-2.21 0-4 1.79-4 4h2c0-1.1.9-2 2-2s2 .9 2 2c0 2-3 1.75-3 5h2c0-2.25 3-2.5 3-5 0-2.21-1.79-4-4-4z',
    movie: 'M18 4l2 4h-3l-2-4h-2l2 4h-3l-2-4H8l2 4H7L5 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V4h-4z',
    tv: 'M21 3H3c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h5v2h8v-2h5c1.1 0 1.99-.9 1.99-2L23 5c0-1.1-.9-2-2-2zm0 14H3V5h18v12z',
    music: 'M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z',
    person: 'M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z',
    history:
        'M13 3c-4.97 0-9 4.03-9 9H1l3.89 3.89.07.14L9 12H6c0-3.87 3.13-7 7-7s7 3.13 7 7-3.13 7-7 7c-1.93 0-3.68-.79-4.94-2.06l-1.42 1.42C8.27 19.99 10.51 21 13 21c4.97 0 9-4.03 9-9s-4.03-9-9-9zm-1 5v5l4.28 2.54.72-1.21-3.5-2.08V8H12z',
    chart: 'M5 9.2h3V19H5zM10.6 5h2.8v14h-2.8zm5.6 8H19v6h-2.8z',
} as const;

export type IconName = keyof typeof PATHS | 'forward';

/**
 * One icon, filled with the color of the text
 *
 * @param props the icon and an optional class
 * @param props.name which icon
 * @param props.className class of the `<svg>`
 */
export function Icon({ name, className }: { name: IconName; className?: string }): JSX.Element {
    // "forward" is "replay" mirrored, as the step buttons of a player
    const path = name === 'forward' ? PATHS.replay : PATHS[name];
    return (
        <svg
            className={className}
            viewBox="0 0 24 24"
            aria-hidden="true"
            focusable="false"
            style={name === 'forward' ? { transform: 'scaleX(-1)' } : undefined}
        >
            <path d={path} />
        </svg>
    );
}

/**
 * The icon of an event of the history, as the www page of the adapter shows it
 *
 * @param event the `event` of an entry, with or without `media.`
 */
export function getEventIcon(event: string): IconName {
    switch (event.replace(/^media\./, '')) {
        case 'play':
        case 'resume':
            return 'play';
        case 'pause':
            return 'pause';
        case 'stop':
            return 'stop';
        case 'scrobble':
        case 'watched':
            return 'skipNext';
        case 'rate':
            return 'star';
        case 'library.new':
        case 'new':
            return 'libraryAdd';
        case 'library.on.deck':
        case 'on_deck':
            return 'bookmark';
        case 'device.new':
        case 'device_new':
            return 'devices';
        case 'admin.database.backup':
        case 'backup':
            return 'storage';
        case 'admin.database.corrupted':
        case 'corrupted':
            return 'warning';
        case 'update.plex':
        case 'update.tautulli':
            return 'update';
        default:
            return 'help';
    }
}

/**
 * The picture for an item without a cover
 *
 * @param media the type of the item: `movie`, `episode`, `track`, ...
 */
export function getMediaIcon(media: string | undefined): IconName {
    switch (media) {
        case 'track':
        case 'album':
        case 'artist':
            return 'music';
        case 'episode':
        case 'show':
        case 'season':
            return 'tv';
        default:
            return 'movie';
    }
}
