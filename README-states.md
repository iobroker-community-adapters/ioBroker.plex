# Channels & States
The following tables list all channels and states which will be created by the adapter.

## With Basis Setup

| Channel / Folder | State | Description |
| ---------------- | ----- | ----------- |
| __libraries__ | - | Plex Libraries |
| libraries._\<libraryName\>_ | - | Plex Library _\<libraryName\>_ |
| libraries._\<libraryName\>_ | allowsync | Allow Sync |
| libraries._\<libraryName\>_ | art | Picture path |
| libraries._\<libraryName\>_ | composite | Composite |
| libraries._\<libraryName\>_ | filters | Indicator if filter is applied |
| libraries._\<libraryName\>_ | refreshing | Indicator if currently refreshing |
| libraries._\<libraryName\>_ | thumb | Thumbnail of the Library |
| libraries._\<libraryName\>_ | key | ID of library |
| libraries._\<libraryName\>_ | type | Type of Library |
| libraries._\<libraryName\>_ | title | Name of the Library |
| libraries._\<libraryName\>_ | agent | Agent |
| libraries._\<libraryName\>_ | scanner | Used scanner for media |
| libraries._\<libraryName\>_ | language | Language |
| libraries._\<libraryName\>_ | uuid | Unique ID |
| libraries._\<libraryName\>_ | updatedat | Timestamp of last update |
| libraries._\<libraryName\>_ | createdat | Timestamp of library creation |
| libraries._\<libraryName\>_ | scannedat | Timestamp of last scan |
| libraries._\<libraryName\>_ | location | Storage Locations |
| __servers__ | - | Plex Servers |
| servers._\<serverName\>_ | - | Plex Server _\<serverName\>_ |
| servers._\<serverName\>_ | name | Server Name |
| servers._\<serverName\>_ | host | Server Host |
| servers._\<serverName\>_ | address | Server Address |
| servers._\<serverName\>_ | port | Server Port |
| servers._\<serverName\>_ | machineIdentifier | Server Identifier |
| servers._\<serverName\>_ | version | Server Software Version |
| __settings__ | - | Plex Settings |
| settings.general | - | Settings General |
| settings.general | FriendlyName | Friendly name |
| settings.general | sendCrashReports | Send crash reports to Plex |
| settings.general | logDebug | Enable Plex Media Server debug logging |
| settings.general | LogVerbose | Enable Plex Media Server verbose logging |
| settings.general | MinimumProgressTime | |
| settings.general | ButlerUpdateChannel | Server update Channel |
| settings | library | Settings Library |
| settings.library | FSEventLibraryUpdatesEnabled | Scan my library automatically |
| settings.library | FSEventLibraryPartialScanEnabled | Run a partial scan when changes are detected |
| settings.library | watchMusicSections | Include music libraries in automatic updates |
| settings.library | ScheduledLibraryUpdatesEnabled | Scan my library periodically |
| settings.library | ScheduledLibraryUpdateInterval | Library scan interval |
| settings.library | autoEmptyTrash | Empty trash automatically after every scan |
| settings.library | allowMediaDeletion | Allow media deletion |
| settings.library | allowMediaDeletionLanOnly | |
| settings.library | OnDeckWindow | Weeks to consider for On Deck and Continue Watching |
| settings.library | OnDeckIncludePremieres | Include season premieres in On Deck |
| settings.library | ScannerLowPriority | Run scanner tasks at a lower priority |
| settings.library | GenerateBIFBehavior | Generate video preview thumbnails |
| settings.library | GenerateChapterThumbBehavior | Generate chapter thumbnails |
| settings.library | LoudnessAnalysisBehavior | Analyze audio tracks for loudness |
| settings.library | LocationVisibility | Location visibility |
| settings | extras | Settings Extras |
| settings.extras | CinemaTrailersType | Choose Cinema Trailers from |
| settings.extras | CinemaTrailersFromLibrary | Include Cinema Trailers from movies in my library |
| settings.extras | CinemaTrailersFromTheater | Include Cinema Trailers from new and upcoming movies in theaters |
| settings.extras | CinemaTrailersFromBluRay | Include Cinema Trailers from new and upcoming movies on Blu-ray |
| settings.extras | CinemaTrailersPrerollID | Movie pre-roll video |
| settings | channels | Settings Channels |
| settings.channels | iTunesSharingEnabled | Enable iTunes plugin |
| settings.channels | iTunesLibraryXmlPath | iTunes library XML path |
| settings.channels | disableCapabilityChecking | Disable capability checking |
| settings.channels | PluginsLaunchTimeout | Number of seconds to wait before a plugin times out |
| settings | other | Settings Other |
| settings.other | MachineIdentifier | A unique identifier for the machine |
| settings.other | AllowHighOutputBitrates | |
| settings.other | AcceptedEULA | Has the user accepted the EULA |
| settings.other | LanguageInCloud | Use language preferences from plex.tv |
| settings.other | ArticleStrings | Comma-separated list of strings considered articles when sorting titles. A server restart is required for a change to take effect. |
| settings.other | TranscoderCanOnlyRemuxVideo | The transcoder can only remux video |
| settings.other | TranscoderVideoResolutionLimit | Maximum video output resolution for the transcoder |
| settings.other | TranscoderPhotoFileSizeLimitMiB | |
| settings.other | PublishServerOnPlexOnlineKey | Publish server on Plex Online |
| settings.other | PlexOnlineMail | |
| settings.other | PlexOnlineUrl | |
| settings.other | ManualPortMappingMode | |
| settings.other | ManualPortMappingPort | |
| settings.other | LastAutomaticMappedPort | |
| settings.other | SyncMyPlexLoginGCDeferral | |
| settings.other | SyncPagingItemsLimit | |
| settings.other | BackgroundQueueIdlePaused | |
| settings.other | WanPerStreamMaxUploadRate | Limit remote stream bitrate |
| settings.other | WanTotalMaxUploadRate | External network total upload limit (kbps) |
| settings.other | forceAutoAdjustQuality | |
| settings.other | EnableABRDebugOverlay | |
| settings.other | ABRKeepOldTranscodes | |
| settings.other | ForceABRDisabled | |
| settings.other | LogTokensForDebug | Allow Plex Media Server tokens in logs |
| settings.other | GenerateIndexFilesDuringAnalysis | |
| settings.other | ButlerTaskGenerateMediaIndexFiles | |
| settings.other | LoudnessAnalysisThreads | |
| settings.other | RadioTopTracksPerAlbum | |
| settings.other | RadioDaysSinceLastPlayed | |
| settings.other | RadioDirectoryThreshold | |
| settings.other | GracenoteUser | |
| settings.other | CertificateVersion | |
| settings.other | EyeQUser | |
| settings.other | DvrShowUnsupportedDevices | |
| settings.other | DvrComskipRemoveIntermediates | |
| settings.other | DvrComskipKeepOriginal | |
| settings.other | DvrOnConnectTestingUrl | |
| settings.other | SubtitlesPersistIfAdmin | |
| settings.other | DvrIncrementalEpgLoader | |
| settings.other | DvrAllowUnsupportedCountry | |
| settings | network | Settings Network |
| settings.network | ConfigurationUrl | Web Manager URL |
| settings.network | EnableIPv6 | Enable server support for IPv6 |
| settings.network | secureConnections | Secure connections |
| settings.network | customCertificatePath | Custom certificate location |
| settings.network | customCertificateKey | Custom certificate encryption key |
| settings.network | customCertificateDomain | Custom certificate domain |
| settings.network | PreferredNetworkInterface | Preferred network interface |
| settings.network | GdmEnabled | Enable local network discovery (GDM) |
| settings | transcoder | Settings Transcoder |
| settings.transcoder | TranscoderQuality | Transcoder quality |
| settings.transcoder | SegmentedTranscoderTimeout | Segmented transcoder timeout |
| settings.transcoder | TranscoderTempDirectory | Transcoder temporary directory |
| settings.transcoder | TranscoderDefaultDuration | Transcoder default duration |
| settings.transcoder | TranscoderThrottleBuffer | Transcoder default throttle buffer |
| settings.transcoder | TranscoderPruneBuffer | Transcoder default prune buffer |
| settings.transcoder | TranscoderLivePruneBuffer | |
| settings.transcoder | TranscoderH264Preset | |
| settings.transcoder | TranscoderH264BackgroundPreset | Background transcoding x264 preset |
| settings.transcoder | TranscoderH264Options | |
| settings.transcoder | TranscoderH264OptionsOverride | |
| settings.transcoder | TranscoderH264MinimumCRF | |
| settings.transcoder | TranscoderLogLevel | |
| settings.transcoder | HardwareAcceleratedCodecs | Use hardware acceleration when available |
| settings.transcoder | SystemAudioCodecs | |
| settings.transcoder | HardwareDevicePath | |
| settings.transcoder | TranscodeCountLimit | Maximum simultaneous video transcode |
| settings | dlna | Settings Dlna |
| settings.dlna | DlnaEnabled | Enable the DLNA server |
| settings.dlna | DlnaPlatinumLoggingLevel | DLNA server logging level |
| settings.dlna | DlnaClientPreferences | DLNA client preferences |
| settings.dlna | DlnaReportTimeline | DLNA server timeline reporting |
| settings.dlna | DlnaDefaultProtocolInfo | DLNA default protocol info |
| settings.dlna | DlnaDeviceDiscoveryInterval | DLNA media renderer discovery interval |
| settings.dlna | DlnaAnnouncementLeaseTime | DLNA server announcement lease time |
| settings.dlna | DlnaDescriptionIcons | DLNA server description icons |
| settings.network | WanPerUserStreamCount | Remote streams allowed per user |
| settings.network | LanNetworksBandwidth | LAN Networks |
| settings.network | MinutesAllowedPaused | Terminate Sessions Paused for Longer Than |
| settings.network | TreatWanIpAsLocal | Treat WAN IP As LAN Bandwidth |
| settings.network | customConnections | Custom server access URLs |
| settings.network | allowedNetworks | List of IP addresses and networks that are allowed without auth |
| settings.network | enableAirplay | |
| settings.network | enableHttpPipelining | Enable HTTP Pipelining |
| settings.network | WebHooksEnabled | Webhooks |
| settings | butler | Settings Butler |
| settings.butler | ButlerStartHour | Time at which tasks start to run |
| settings.butler | ButlerEndHour | Time at which tasks stop running |
| settings.butler | ButlerTaskBackupDatabase | Backup database every three days |
| settings.butler | ButlerDatabaseBackupPath | Backup directory |
| settings.butler | ButlerTaskOptimizeDatabase | Optimize database every week |
| settings.butler | ButlerTaskCleanOldBundles | Remove old bundles every week |
| settings.butler | ButlerTaskCleanOldCacheFiles | Remove old cache files every week |
| settings.butler | ButlerTaskRefreshLocalMedia | Refresh local metadata every three days |
| settings.butler | ButlerTaskRefreshLibraries | Update all libraries during maintenance |
| settings.butler | ButlerTaskUpgradeMediaAnalysis | Upgrade media analysis during maintenance |
| settings.butler | ButlerTaskRefreshPeriodicMetadata | Refresh metadata periodically |
| settings.butler | ButlerTaskDeepMediaAnalysis | Perform extensive media analysis during maintenance |
| settings.butler | ButlerTaskRefreshEpgGuides | Perform refresh of program guide data. |
| settings.butler | ButlerTaskReverseGeocode | Fetch missing location names for items in photo sections |
| settings.butler | ButlerTaskGenerateAutoTags | Analyze and tag photos |


## With Advanced Setup

### with either Plex Pass or Tautulli
tbd

### only with Tautulli

| Channel / Folder | State | Description |
| ---------------- | ----- | ----------- |
| __statistics__ | - | Plex Watch Statistics |
| statistics.libraries | - | Library Watch Statistics |
| statistics.libraries._\<libraryName\>_ | - | Library Watch Statistics _\<libraryName\>_ |
| statistics.libraries._\<libraryName\>_.01-last_24h | - | Watched last 24 hours |
| statistics.libraries._\<libraryName\>_.01-last_24h | query_days | Days querying |
| statistics.libraries._\<libraryName\>_.01-last_24h | total_time | Total Time |
| statistics.libraries._\<libraryName\>_.01-last_24h | total_plays | Total plays |
| statistics.libraries._\<libraryName\>_.02-last_7d | - | Watched last 7 days |
| statistics.libraries._\<libraryName\>_.02-last_7d | query_days | Days querying |
| statistics.libraries._\<libraryName\>_.02-last_7d | total_time | Total Time |
| statistics.libraries._\<libraryName\>_.02-last_7d | total_plays | Total plays |
| statistics.libraries._\<libraryName\>_.03-last_30d | - | Watched last 30 days |
| statistics.libraries._\<libraryName\>_.03-last_30d | query_days | Days querying |
| statistics.libraries._\<libraryName\>_.03-last_30d | total_time | Total Time |
| statistics.libraries._\<libraryName\>_.03-last_30d | total_plays | Total plays |
| statistics.libraries._\<libraryName\>_.00-all_time | - | Watched all time |
| statistics.libraries._\<libraryName\>_.00-all_time | query_days | Days querying |
| statistics.libraries._\<libraryName\>_.00-all_time | total_time | Total Time |
| statistics.libraries._\<libraryName\>_.00-all_time | total_plays | Total plays |
| statistics.users | - | User Watch Statistics |
| statistics.users._\<userName\>_ | - | User Watch Statistics _\<userName\>_ |
| statistics.users._\<userName\>_.01-last_24h | - | Watched last 24 hours |
| statistics.users._\<userName\>_.01-last_24h | query_days | Days querying |
| statistics.users._\<userName\>_.01-last_24h | total_time | Total Time |
| statistics.users._\<userName\>_.01-last_24h | total_plays | Total plays |
| statistics.users._\<userName\>_.02-last_7d | - | Watched last 7 days |
| statistics.users._\<userName\>_.02-last_7d | query_days | Days querying |
| statistics.users._\<userName\>_.02-last_7d | total_time | Total Time |
| statistics.users._\<userName\>_.02-last_7d | total_plays | Total plays |
| statistics.users._\<userName\>_.03-last_30d | - | Watched last 30 days |
| statistics.users._\<userName\>_.03-last_30d | query_days | Days querying |
| statistics.users._\<userName\>_.03-last_30d | total_time | Total Time |
| statistics.users._\<userName\>_.03-last_30d | total_plays | Total plays |
| statistics.users._\<userName\>_.00-all_time | - | Watched all time |
| statistics.users._\<userName\>_.00-all_time | query_days | Days querying |
| statistics.users._\<userName\>_.00-all_time | total_time | Total Time |
| statistics.users._\<userName\>_.00-all_time | total_plays | Total plays |
| __users__ | - | Plex Users |
| users._\<userName\>_ | - | Plex User _\<userName\>_ |
| users._\<userName\>_ | username | Name of User |
| users._\<userName\>_ | filter_music | Filter Music |
| users._\<userName\>_ | user_id | User ID |
| users._\<userName\>_ | thumb | Thumbnail |
| users._\<userName\>_ | shared_libraries | Shared Libraries |
| users._\<userName\>_ | do_notify | Do Notify |
| users._\<userName\>_ | filter_movies | Filter Movies |
| users._\<userName\>_ | friendly_name | Friendly Name |
| users._\<userName\>_ | is_allow_sync | User may sync media |
| users._\<userName\>_ | filter_photos | Filter Photos |
| users._\<userName\>_ | filter_all | Filter All |
| users._\<userName\>_ | keep_history | Keep History |
| users._\<userName\>_ | is_admin | User is admin |
| users._\<userName\>_ | filter_tv | Filter TV |
| users._\<userName\>_ | allow__\<userName\>_ | Allow _\<userName\>_ |
| users._\<userName\>_ | is_restricted | User is restricted |
| users._\<userName\>_ | is_home_user | User is Home User |
| users._\<userName\>_ | email | Email address |
