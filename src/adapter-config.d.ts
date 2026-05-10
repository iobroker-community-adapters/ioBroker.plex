// Augments ioBroker.AdapterConfig so `this.config.X` is typed inside the adapter.
// Sources: io-package.json#native plus all adapter.config.* call sites in plex.js + lib/.

import '@iobroker/types';

declare global {
    namespace ioBroker {
        interface PlexNotification {
            event: string;
            media: string;
            message: string;
            caption: string;
            thumb: string;
        }

        interface AdapterConfig {
            // Plex Media Server connection
            plexIp: string;
            plexPort: number;
            plexToken: string;
            secureConnection: boolean;
            certPublic: string;
            certPublicVal: string;
            certPrivate: string;
            certPrivateVal: string;
            certChained: string;
            certChainedVal: string;
            passphrase: string;
            tokenInLinks: boolean;

            // Tautulli
            tautulliEnabled: boolean;
            tautulliIp: string;
            tautulliPort: number;
            tautulliToken: string;

            // Webhook listener
            webhookIp: string;
            webhookPort: number;

            // Behaviour flags (from io-package native)
            getAllItems: boolean;
            getLibraries: boolean;
            getMetadataTrees: boolean;
            getPlayerRefresh: number;
            getPlaylists: boolean;
            getPlaylistsDetails: boolean;
            getServers: boolean;
            getSettings: boolean;
            getStatistics: boolean;
            getUsers: boolean;

            // Misc
            refresh: number;
            retry: number;
            resetMedia: boolean;
            debug: boolean;
            encryptionKey: string;

            // Notifications
            notifications: PlexNotification[];
        }
    }
}

export {};
