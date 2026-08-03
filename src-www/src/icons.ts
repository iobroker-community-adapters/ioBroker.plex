import type { SvgIconComponent } from '@mui/icons-material';
import {
    PlayArrow as PlayArrowIcon,
    Pause as PauseIcon,
    Stop as StopIcon,
    SkipNext as SkipNextIcon,
    LibraryAdd as LibraryAddIcon,
    StarRate as StarRateIcon,
    Bookmark as BookmarkIcon,
    DevicesOther as DevicesOtherIcon,
    Storage as StorageIcon,
    Warning as WarningIcon,
    SystemUpdate as SystemUpdateIcon,
    HelpOutlineOutlined as HelpOutlineIcon,
} from '@mui/icons-material';

export function getEventIcon(event: string): SvgIconComponent {
    switch (event) {
        case 'media.play':
        case 'play':
            return PlayArrowIcon;
        case 'media.pause':
        case 'pause':
            return PauseIcon;
        case 'media.stop':
        case 'stop':
            return StopIcon;
        case 'media.resume':
        case 'resume':
            return PlayArrowIcon;
        case 'media.scrobble':
        case 'scrobble':
            return SkipNextIcon;
        case 'media.rate':
        case 'rate':
            return StarRateIcon;
        case 'library.new':
        case 'new':
            return LibraryAddIcon;
        case 'library.on.deck':
        case 'on_deck':
            return BookmarkIcon;
        case 'device.new':
        case 'device_new':
            return DevicesOtherIcon;
        case 'admin.database.backup':
        case 'backup':
            return StorageIcon;
        case 'admin.database.corrupted':
        case 'corrupted':
            return WarningIcon;
        case 'update.plex':
        case 'update.tautulli':
            return SystemUpdateIcon;
        default:
            return HelpOutlineIcon;
    }
}
