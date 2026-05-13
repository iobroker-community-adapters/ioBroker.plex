/**
 * Plex API type surfaces used by the adapter.
 *
 * Schemas follow python-plexapi (https://github.com/pkkid/python-plexapi):
 *   - `Plex.Tv.*`     — `https://plex.tv/api/v2/...` (account-scoped cloud API)
 *   - `Plex.Event.*`  — webhook payloads from Plex Media Server / Tautulli
 *   - `Plex.Session.*` — `/status/sessions` and `/clients` JSON responses
 *
 * `Plex.DiscoveredPlayer` is the adapter's internal merged shape, not a Plex API type.
 */
namespace Plex {
    /**
     * Adapter-internal shape produced by the 3-source player discovery
     * (plex.tv/resources + /status/sessions + /clients), keyed by `machineIdentifier`.
     */
    interface DiscoveredPlayer {
        /** machineIdentifier — primary dedup key */
        uuid: string;
        title: string;
        address: string;
        port: number;
        /** Comma-separated capabilities consumed by setControls() */
        protocolCapabilities: string;
        /** Source(s) the player was found in (for diagnostics) */
        sources: string[];
        /** Original payload(s) — passed verbatim to setClientData() */
        raw: Record<string, unknown>;
        publicAddress?: string;
        local?: boolean;
        relay?: boolean;
        product?: string;
        platform?: string;
        device?: string;
        /**
         * Comma-separated `provides` value as Plex declares it. Empty for Companion-only
         * mobile/web apps (iOS, Plex Web, Android). Determines whether HTTP control
         * commands (`/player/playback/...`) reach the device — Plex routes them only
         * for `provides ∋ player|pubsub-player` and GDM `/clients` devices.
         */
        provides?: string;
    }

    namespace Tv {
        /**
         * Subset of fields from `https://plex.tv/api/v2/resources?includeHttps=1&includeRelay=1`.
         * Schema follows python-plexapi `MyPlexResource`.
         */
        interface Resource {
            clientIdentifier: string;
            name: string;
            product?: string;
            productVersion?: string;
            platform?: string;
            platformVersion?: string;
            device?: string;
            provides: string;
            owned?: boolean;
            ownerId?: number;
            home?: boolean;
            synced?: boolean;
            relay?: boolean;
            presence?: boolean;
            httpsRequired?: boolean;
            publicAddress?: string;
            publicAddressMatches?: boolean;
            dnsRebindingProtection?: boolean;
            natLoopbackSupported?: boolean;
            sourceTitle?: string;
            accessToken?: string;
            createdAt?: number;
            lastSeenAt?: number;
            connections?: Connection[];
        }

        /** Schema follows python-plexapi `ResourceConnection`. */
        interface Connection {
            uri: string;
            address: string;
            port: number;
            protocol: string;
            local: boolean;
            relay?: boolean;
            /** JSON key is capitalized `IPv6` in plex.tv responses. */
            IPv6?: boolean;
            httpsRequired?: boolean;
        }

        /**
         * Subset of `https://plex.tv/devices.xml` (legacy XML, also returns JSON when
         * Accept: application/json is honored). Lists ALL account devices including
         * Companion-only apps that don't appear in /api/v2/resources. Schema follows
         * python-plexapi `MyPlexDevice`.
         */
        interface Device {
            clientIdentifier: string;
            name?: string;
            product?: string;
            productVersion?: string;
            platform?: string;
            platformVersion?: string;
            device?: string;
            model?: string;
            vendor?: string;
            provides: string;
            publicAddress?: string;
            lastSeenAt?: string;
            connections: DeviceConnection[];
        }

        interface DeviceConnection {
            uri: string;
            address?: string;
            port?: number;
            protocol?: string;
            local?: boolean;
        }
    }

    /**
     * Webhook payloads as POSTed by Plex Media Server (and Tautulli, mirrored shape).
     * Most sub-collections only appear for certain event types — keep them optional.
     */
    namespace Event {
        interface Payload {
            event: string;
            user: boolean;
            owner: boolean;
            Account: Account;
            Server: Server;
            Player?: Player;
            Metadata: Metadata;
            /** Adapter-enriched fields (added in setEvent()) */
            media?: string;
            player?: string;
            account?: string;
            source?: string;
            timestamp?: number;
            datetime?: string;
            playing?: boolean;
            history?: any[];
        }

        interface Account {
            id: number;
            thumb: string;
            title: string;
        }

        interface Server {
            title: string;
            uuid: string;
        }

        interface Player {
            local: boolean;
            publicAddress: string;
            title: string;
            uuid: string;
        }

        interface Metadata {
            librarySectionType?: string;
            ratingKey?: string;
            key?: string;
            parentRatingKey?: string;
            grandparentRatingKey?: string;
            guid?: string;
            parentGuid?: string;
            grandparentGuid?: string;
            grandparentSlug?: string;
            type: string;
            title?: string;
            titleSort?: string;
            grandparentKey?: string;
            parentKey?: string;
            librarySectionTitle?: string;
            librarySectionID?: number;
            librarySectionKey?: string;
            grandparentTitle?: string;
            parentTitle?: string;
            originalTitle?: string;
            contentRating?: string;
            summary?: string;
            index?: number;
            parentIndex?: number;
            audienceRating?: number;
            viewOffset?: number;
            skipCount?: number;
            lastViewedAt?: number;
            year?: number;
            thumb?: string;
            art?: string;
            parentThumb?: string;
            grandparentThumb?: string;
            grandparentArt?: string;
            grandparentTheme?: string;
            duration?: number;
            originallyAvailableAt?: string;
            addedAt?: number;
            updatedAt?: number;
            audienceRatingImage?: string;
            chapterSource?: string;
            Media?: Media[];
            Image?: Image[];
            UltraBlurColors?: UltraBlurColors;
            Guid?: Guid[];
            Rating?: Rating[];
            Director?: Director[];
            Writer?: Writer[];
            Role?: Role[];
        }

        interface Media {
            aspectRatio?: string;
            audioChannels?: number;
            audioCodec?: string;
            audioProfile?: string;
            bitrate?: number;
            container?: string;
            duration?: number;
            hasVoiceActivity?: string;
            height?: number;
            id?: string;
            videoCodec?: string;
            videoFrameRate?: string;
            videoProfile?: string;
            videoResolution?: string;
            width?: number;
            selected?: boolean;
            Part?: Part[];
        }

        interface Part {
            audioProfile?: string;
            container?: string;
            duration?: number;
            file?: string;
            id?: string;
            key?: string;
            size?: number;
            videoProfile?: string;
            decision?: string;
            selected?: boolean;
            Stream?: Stream[];
        }

        interface Stream {
            id?: string;
            streamType?: number;
            codec?: string;
            index?: number;
            bitrate?: number;
            language?: string;
            languageCode?: string;
            languageTag?: string;
            displayTitle?: string;
            extendedDisplayTitle?: string;
            default?: boolean;
            selected?: boolean;
            title?: string;
            // Video
            bitDepth?: number;
            chromaLocation?: string;
            chromaSubsampling?: string;
            codedHeight?: number;
            codedWidth?: number;
            colorPrimaries?: string;
            colorRange?: string;
            colorSpace?: string;
            colorTrc?: string;
            frameRate?: number;
            hasScalingMatrix?: boolean;
            height?: number;
            level?: number;
            profile?: string;
            refFrames?: number;
            scanType?: string;
            width?: number;
            // Audio
            audioChannelLayout?: string;
            channels?: number;
            samplingRate?: number;
            // Subtitle
            canAutoSync?: string | boolean;
            forced?: boolean;
            format?: string;
        }

        interface Image {
            alt: string;
            type: string;
            url: string;
        }

        interface UltraBlurColors {
            topLeft: string;
            topRight: string;
            bottomRight: string;
            bottomLeft: string;
        }

        interface Guid {
            id: string;
        }

        interface Rating {
            image: string;
            /** Plex returns rating values as strings in webhook/session JSON. */
            value: string;
            type: string;
        }

        interface Director {
            id: number;
            filter: string;
            tag: string;
            tagKey: string;
        }

        interface Writer {
            id: number;
            filter: string;
            tag: string;
            tagKey: string;
        }

        interface Role {
            id: number;
            filter: string;
            tag: string;
            tagKey: string;
            role: string;
            thumb: string;
        }
    }

    /**
     * `/status/sessions` and `/clients` JSON responses. Schemas follow python-plexapi
     * `Media` / `MediaPart` / `MediaPartStream` / `PlexClient`.
     */
    namespace Session {
        interface MediaContainer {
            size?: number;
            Metadata?: MetadataItem[];
        }

        interface StreamItem {
            id?: string;
            streamType?: number;
            codec?: string;
            index?: number;
            bitrate?: number;
            language?: string;
            languageCode?: string;
            languageTag?: string;
            displayTitle?: string;
            extendedDisplayTitle?: string;
            default?: boolean;
            selected?: boolean;
            title?: string;
            decision?: string;
            key?: string;
            location?: string;
            requiredBandwidths?: string;
            streamIdentifier?: number;
            type?: number;
            // Video
            anamorphic?: string;
            bitDepth?: number;
            cabac?: number;
            chromaLocation?: string;
            chromaSubsampling?: string;
            codecID?: string;
            codedHeight?: number;
            codedWidth?: number;
            colorPrimaries?: string;
            colorRange?: string;
            colorSpace?: string;
            colorTrc?: string;
            duration?: number;
            frameRate?: number;
            frameRateMode?: string;
            hasScalingMatrix?: boolean;
            height?: number;
            level?: number;
            pixelAspectRatio?: string;
            pixelFormat?: string;
            profile?: string;
            refFrames?: number;
            scanType?: string;
            width?: number;
            // Audio
            audioChannelLayout?: string;
            bitrateMode?: string;
            channels?: number;
            samplingRate?: number;
            visualImpaired?: boolean;
            // Subtitle
            canAutoSync?: string | boolean;
            container?: string;
            forced?: boolean;
            format?: string;
            headerCompression?: string;
            hearingImpaired?: boolean;
            perfectMatch?: boolean;
            providerTitle?: string;
            score?: number;
            sourceKey?: string;
            transient?: string;
            userID?: number;
        }

        interface PartItem {
            id?: string;
            key?: string;
            file?: string;
            container?: string;
            duration?: number;
            size?: number;
            audioProfile?: string;
            videoProfile?: string;
            decision?: string;
            selected?: boolean;
            accessible?: boolean;
            exists?: boolean;
            hasThumbnail?: boolean;
            has64bitOffsets?: boolean;
            optimizedForStreaming?: boolean;
            indexes?: string;
            packetLength?: number;
            protocol?: string;
            requiredBandwidths?: string;
            syncItemId?: number;
            syncState?: string;
            deepAnalysisVersion?: number;
            Stream?: StreamItem[];
        }

        interface MediaItem {
            id?: string;
            aspectRatio?: string;
            audioChannels?: number;
            audioCodec?: string;
            audioProfile?: string;
            bitrate?: number;
            container?: string;
            duration?: number;
            hasVoiceActivity?: string;
            height?: number;
            videoCodec?: string;
            videoFrameRate?: string;
            videoProfile?: string;
            videoResolution?: string;
            width?: number;
            selected?: boolean;
            optimizedForStreaming?: boolean;
            has64bitOffsets?: boolean;
            proxyType?: number;
            target?: string;
            title?: string;
            uuid?: string;
            Part?: PartItem[];
        }

        interface UltraBlurColorsItem {
            bottomLeft?: string;
            bottomRight?: string;
            topLeft?: string;
            topRight?: string;
        }

        interface RatingItem {
            image?: string;
            type?: string;
            value?: string;
        }

        interface DirectorItem {
            filter?: string;
            id?: string;
            tag?: string;
            tagKey?: string;
        }

        interface WriterItem {
            filter?: string;
            id?: string;
            tag?: string;
            tagKey?: string;
        }

        interface RoleItem {
            filter?: string;
            id?: string;
            role?: string;
            tag?: string;
            tagKey?: string;
            thumb?: string;
        }

        interface User {
            id?: string;
            thumb?: string;
            title?: string;
        }

        /**
         * Player payload from `/status/sessions` and `/clients`. python-plexapi notes that
         * `protocolCapabilities` / `protocol` / `protocolVersion` / `deviceClass` only appear
         * on `/clients` responses — they are absent from `/status/sessions`.
         */
        interface Player {
            address?: string;
            device?: string;
            deviceClass?: string;
            machineIdentifier?: string;
            model?: string;
            platform?: string;
            platformVersion?: string;
            playbackId?: string;
            playbackSessionId?: string;
            product?: string;
            profile?: string;
            protocol?: string;
            protocolCapabilities?: string;
            protocolVersion?: string;
            remotePublicAddress?: string;
            state?: string;
            title?: string;
            vendor?: string;
            version?: string;
            local?: boolean;
            relayed?: boolean;
            secure?: boolean;
            userID?: number;
        }

        interface MetadataItem {
            addedAt?: number;
            art?: string;
            audienceRating?: number;
            audienceRatingImage?: string;
            chapterSource?: string;
            contentRating?: string;
            duration?: number;
            grandparentArt?: string;
            grandparentGuid?: string;
            grandparentKey?: string;
            grandparentRatingKey?: string;
            grandparentSlug?: string;
            grandparentTheme?: string;
            grandparentThumb?: string;
            grandparentTitle?: string;
            guid?: string;
            index?: number;
            key?: string;
            lastViewedAt?: number;
            librarySectionID?: string;
            librarySectionKey?: string;
            librarySectionTitle?: string;
            originalTitle?: string;
            originallyAvailableAt?: string;
            parentGuid?: string;
            parentIndex?: number;
            parentKey?: string;
            parentRatingKey?: string;
            parentThumb?: string;
            parentTitle?: string;
            ratingKey?: string;
            sessionKey?: string;
            skipCount?: string;
            summary?: string;
            thumb?: string;
            title?: string;
            titleSort?: string;
            type?: string;
            updatedAt?: number;
            viewOffset?: number;
            year?: number;
            Media?: MediaItem[];
            UltraBlurColors?: UltraBlurColorsItem[];
            Rating?: RatingItem[];
            Director?: DirectorItem[];
            Writer?: WriterItem[];
            Role?: RoleItem[];
            User?: User;
            Player?: Player;
        }
    }
}

interface ServerCommandDef {
    description: string;
    role: string;
    type: string;
    method: 'GET' | 'POST' | 'PUT' | 'DELETE';
    path?: string;
    pathTemplate?: string;
    common?: Record<string, unknown>;
}

interface ServerCommandsConfig {
    libraryCommands: Record<string, ServerCommandDef>;
    maintenanceCommands: Record<string, ServerCommandDef>;
    butlerTasks: Record<string, ServerCommandDef>;
    metadataCommands: Record<string, ServerCommandDef>;
}
