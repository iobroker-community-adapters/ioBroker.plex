/**
 * The player channels of an instance: `plex.<n>._playing.<title>-<uuid>`, with the title in lower case and the
 * characters ioBroker forbids in IDs replaced by `#` (`library.clean(title, true)` of the adapter). Below a channel:
 *
 * - `Metadata.viewOffset` - the position in ms, counted on every second by the adapter while the player plays
 * - `Metadata.durationSeconds` - the length of the item
 * - `Player.controllable` - false for players that cannot be controlled through the Plex server
 * - `_Controls.playback.<button>` - the buttons, only for players that can be controlled
 *
 * The history names a player by its title and - in entries written since the adapter stores it - by its UUID
 * (`playerUuid`). With the UUID the channel of that device is found: the one of this UUID. Without it a player is
 * found by the title in its channel ID. Where the UUID of a channel is known (`native.uuid` of the channel, written
 * when the adapter discovers the player, or the state `Player.uuid`), the rest of the ID is the title and must be
 * the same; else the ID must begin with the title.
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
    /** The UUID of the player (`native.uuid`) if the ID ends with it; empty if unknown */
    uuid: string;
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
 * The title in the name of a player channel, `<title>-<uuid>`
 *
 * @param name the last part of the channel ID
 * @param uuid the UUID of the player, in any case
 * @returns the title as the adapter cleaned it, or null if the UUID is unknown or not the end of the name
 */
function getChannelTitle(name: string, uuid: string | undefined): string | null {
    return uuid && name.toLowerCase().endsWith(`-${uuid.toLowerCase()}`) ? name.slice(0, -(uuid.length + 1)) : null;
}

/**
 * Whether a player channel belongs to the player of this title - or of this UUID, if the history names one
 *
 * @param channelId the channel, `plex.0._playing.<title>-<uuid>`
 * @param title the title of the player as the history names it
 * @param uuid the UUID of the player of the channel if it is known: then "tv" is not the player "tv-kitchen"
 * @param playerUuid the UUID of the player as the history names it, if it does: then it decides, not the title
 */
export function isChannelOf(channelId: string, title: string, uuid?: string, playerUuid?: string): boolean {
    const name = channelId.slice(channelId.lastIndexOf('.') + 1);
    if (playerUuid) {
        // two devices of the same title differ in their UUID only; a channel of unknown UUID has it in its ID
        return uuid ? uuid.toLowerCase() === playerUuid.toLowerCase() : getChannelTitle(name, playerUuid) !== null;
    }
    const channelTitle = getChannelTitle(name, uuid);
    return channelTitle !== null ? channelTitle === cleanTitle(title) : name.startsWith(`${cleanTitle(title)}-`);
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
        const uuid = typeof native.uuid === 'string' ? native.uuid : '';
        result.push({
            id,
            name,
            uuid: getChannelTitle(name, uuid) === null ? '' : uuid,
            lastSeen,
            hasControls: ids.includes(`${id}._Controls.playback`) || ids.includes(`${id}._Controls`),
        });
    }
    return result;
}

/**
 * The channel of a player. If the history names its UUID: the channel of that UUID - and only if there is none, one
 * of the title whose UUID is unknown, never the one of another device. Else the channel of the title: one whose UUID
 * is known, so that its title is the same, before one that only begins with the title. If there are several, the
 * one with controls and seen last.
 *
 * @param channels the player channels of the instance
 * @param title the title of the player as the history names it
 * @param playerUuid the UUID of the player as the history names it, if it does
 */
export function findPlayerChannel(channels: PlayerChannel[], title: string, playerUuid?: string): PlayerChannel | null {
    let found = playerUuid ? channels.filter(channel => isChannelOf(channel.id, title, channel.uuid, playerUuid)) : [];
    if (!found.length) {
        found = channels.filter(
            channel => !(playerUuid && channel.uuid) && isChannelOf(channel.id, title, channel.uuid),
        );
    }
    // several channels of one UUID (a device that was renamed): the one of the title
    const isOfTitle = (channel: PlayerChannel): boolean => isChannelOf(channel.id, title, channel.uuid || playerUuid);
    found.sort(
        (a, b) =>
            Number(isOfTitle(b)) - Number(isOfTitle(a)) ||
            Number(!!b.uuid) - Number(!!a.uuid) ||
            Number(b.hasControls) - Number(a.hasControls) ||
            b.lastSeen - a.lastSeen,
    );
    return found[0] || null;
}
