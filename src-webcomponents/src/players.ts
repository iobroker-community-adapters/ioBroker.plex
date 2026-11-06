/**
 * The player channels of an instance: `plex.<n>._playing.<title>-<uuid>`, with the title in lower case and the
 * characters ioBroker forbids in IDs replaced by `#` (`library.clean(title, true)` of the adapter). Below a channel:
 *
 * - `Metadata.viewOffset` - the position in ms, counted on every second by the adapter while the player plays
 * - `Metadata.durationSeconds` - the length of the item
 * - `Player.controllable` - false for players that cannot be controlled through the Plex server
 * - `_Controls.playback.<button>` - the buttons, only for players that can be controlled
 *
 * The history names a player by its title only, so a player is found by the beginning of its channel ID.
 */

/** The characters ioBroker forbids in IDs, as `FORBIDDEN_CHARS` of js-controller */
const FORBIDDEN_CHARS = /[^._\-/ :!#$%&()+=@^{}|~\p{Ll}\p{Lu}\p{Nd}]+/gu;

/** The pseudo player of the adapter that always holds the latest event */
const RECENT_PLAYER = '_recent-player';

/** The buttons of `_Controls.playback` the element writes `true` to */
export type PlayerButton = 'play' | 'pause' | 'stop' | 'skipPrevious' | 'skipNext' | 'stepBack' | 'stepForward';

/** A player channel found below `_playing` */
export interface PlayerChannel {
    /** Full ID, `plex.0._playing.<title>-<uuid>` */
    id: string;
    /** The last part of the ID */
    name: string;
    /** When the adapter saw the player last (`native.lastSeenAt`), in ms; 0 if unknown */
    lastSeen: number;
    /** Whether `_Controls.playback` exists below it */
    hasControls: boolean;
}

/**
 * The part of a player channel ID the adapter makes from the title of a player
 *
 * @param title the title of the player
 */
export function cleanTitle(title: string): string {
    return title.replace(FORBIDDEN_CHARS, '#').toLowerCase();
}

/**
 * The player channel of an ID of the player setting: the channel itself or something below it
 *
 * @param id e.g. `plex.0._playing.apple tv-1234` or `plex.0._playing.apple tv-1234.Player.title`
 * @returns the channel, or null if the ID is no player of the Plex adapter
 */
export function getPlayerChannelId(id: string | undefined): string | null {
    const match = id?.trim().match(/^(plex\.\d+\._playing\.[^.]+)(\.|$)/);
    if (!match || match[1].endsWith(`.${RECENT_PLAYER}`) || /\._playing\.(players|streams)$/.test(match[1])) {
        return null;
    }
    return match[1];
}

/**
 * Whether a player channel belongs to the player of this title
 *
 * @param channelId the channel, `plex.0._playing.<title>-<uuid>`
 * @param title the title of the player as the history names it
 */
export function isChannelOf(channelId: string, title: string): boolean {
    const name = channelId.slice(channelId.lastIndexOf('.') + 1);
    return name.startsWith(`${cleanTitle(title)}-`);
}

/**
 * The player channels among the channels below `plex.<n>._playing.`
 *
 * @param namespace `plex.<n>`
 * @param channels what `getObjectViewSystem('channel', ...)` returned for that range
 */
export function toPlayerChannels(namespace: string, channels: Record<string, ioBroker.AnyObject>): PlayerChannel[] {
    const prefix = `${namespace}._playing.`;
    const ids = Object.keys(channels);
    const result: PlayerChannel[] = [];
    for (const id of ids) {
        const name = id.slice(prefix.length);
        if (!id.startsWith(prefix) || !name || name.includes('.') || name === RECENT_PLAYER) {
            continue;
        }
        const native = (channels[id]?.native || {}) as Record<string, unknown>;
        const lastSeen = typeof native.lastSeenAt === 'string' ? Date.parse(native.lastSeenAt) || 0 : 0;
        result.push({
            id,
            name,
            lastSeen,
            hasControls: ids.includes(`${id}._Controls.playback`) || ids.includes(`${id}._Controls`),
        });
    }
    return result;
}

/**
 * The channel of the player of this title: the one with controls and seen last if there are several
 *
 * @param channels the player channels of the instance
 * @param title the title of the player as the history names it
 */
export function findPlayerChannel(channels: PlayerChannel[], title: string): PlayerChannel | null {
    const found = channels.filter(channel => isChannelOf(channel.id, title));
    found.sort((a, b) => Number(b.hasControls) - Number(a.hasControls) || b.lastSeen - a.lastSeen);
    return found[0] || null;
}
