import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import PauseIcon from '@mui/icons-material/Pause';
import StopIcon from '@mui/icons-material/Stop';
import SkipNextIcon from '@mui/icons-material/SkipNext';
import LibraryAddIcon from '@mui/icons-material/LibraryAdd';
import StarRateIcon from '@mui/icons-material/StarRate';
import BookmarkIcon from '@mui/icons-material/Bookmark';
import DevicesOtherIcon from '@mui/icons-material/DevicesOther';
import StorageIcon from '@mui/icons-material/Storage';
import WarningIcon from '@mui/icons-material/Warning';
import SystemUpdateIcon from '@mui/icons-material/SystemUpdate';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import type { SvgIconComponent } from '@mui/icons-material';

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
