/**
 * The styles of the shadow roots. An element fills the box of the host, has a transparent background and inherits
 * `color` and `font`; accents come from the theme of the host (`--iob-primary`, `--iob-text-secondary`, ...), so it
 * looks right in light and dark. Sizes follow the box with container queries (`cqmin`, `cqh`), nothing is measured.
 */

/** The box, the hint shown instead of the content while settings are missing, and buttons */
const BASE = `
:host {
    display: block;
    width: 100%;
    height: 100%;
}
.mount {
    width: 100%;
    height: 100%;
    /* the size of the box does not depend on what is in it */
    container-type: size;
    --pad: clamp(2px, 1.5cqmin, 6px);
    --soft: color-mix(in srgb, currentColor 6%, transparent);
    --track: color-mix(in srgb, currentColor 18%, transparent);
}
.edit {
    pointer-events: none;
}
.hint {
    box-sizing: border-box;
    width: 100%;
    height: 100%;
    padding: 8px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: clamp(2px, 3cqmin, 8px);
    overflow: hidden;
    text-align: center;
    color: var(--iob-text-secondary);
    font-size: clamp(10px, 6cqmin, 15px);
}
.hint svg {
    width: clamp(16px, 14cqmin, 36px);
    height: clamp(16px, 14cqmin, 36px);
    fill: currentColor;
    flex: none;
    opacity: 0.7;
}
.scroll {
    scrollbar-width: thin;
}
button {
    font: inherit;
    color: inherit;
    background: none;
    border: none;
    margin: 0;
    padding: 0;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
}
button:disabled {
    cursor: default;
}
button:focus-visible {
    outline: 2px solid var(--iob-primary);
    outline-offset: 1px;
}
`;

/** `<iob-plex-now-playing>`: a card or a row per player */
export const NOW_PLAYING_STYLES = `${BASE}
.streams {
    box-sizing: border-box;
    width: 100%;
    height: 100%;
    padding: var(--pad);
    overflow-x: hidden;
    overflow-y: auto;
    display: grid;
    gap: clamp(4px, 2cqmin, 10px);
    user-select: none;
}
.streams.cards {
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 320px), 1fr));
    /* one player fills the box; more share it down to a readable height and scroll then */
    grid-auto-rows: minmax(min(calc(100cqh - 2 * var(--pad)), 124px), 1fr);
}
.streams.compact {
    grid-template-columns: 1fr;
    grid-auto-rows: max-content;
    align-content: start;
    font-size: clamp(11px, 4cqi, 15px);
}
.cover {
    --ratio: 2 / 3;
    flex: none;
    aspect-ratio: var(--ratio);
    border-radius: var(--iob-border-radius);
    overflow: hidden;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--soft);
    color: var(--iob-text-secondary);
}
.cover.square {
    --ratio: 1;
}
.cover img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
}
.cover svg {
    width: 50%;
    height: 50%;
    fill: currentColor;
    opacity: 0.6;
}
.info {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    justify-content: center;
}
.heading {
    display: flex;
    align-items: center;
    gap: 0.35em;
    min-width: 0;
    font-weight: 600;
    line-height: 1.25;
}
.heading svg {
    width: 1.1em;
    height: 1.1em;
    flex: none;
    fill: var(--iob-primary);
}
.paused .heading svg {
    fill: var(--iob-text-secondary);
}
.title,
.caption,
.meta,
.sub {
    min-width: 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}
.caption,
.meta,
.sub,
.time {
    color: var(--iob-text-secondary);
}
.meta {
    display: flex;
    align-items: center;
    gap: 0.3em;
}
.meta svg {
    width: 1.1em;
    height: 1.1em;
    flex: none;
    fill: currentColor;
}
.meta span {
    overflow: hidden;
    text-overflow: ellipsis;
}
.meta .gap {
    margin-left: 0.6em;
}
.progress {
    display: flex;
    align-items: center;
    gap: 0.6em;
    min-width: 0;
}
.bar {
    flex: 1;
    min-width: 0;
    border-radius: 999px;
    background: var(--track);
    overflow: hidden;
}
.bar span {
    display: block;
    height: 100%;
    border-radius: 999px;
    background: var(--iob-primary);
}
.paused .bar span {
    background: var(--iob-text-secondary);
}
.time {
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
}
.controls {
    display: flex;
    align-items: center;
    flex: none;
}
.controls button {
    flex: none;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
}
.controls button:hover:not(:disabled) {
    background: var(--soft);
}
.controls button svg {
    width: 62%;
    height: 62%;
    fill: currentColor;
}
.controls button.main {
    background: var(--iob-primary);
    color: var(--iob-primary-contrast);
}
.controls button.main:hover:not(:disabled) {
    background: color-mix(in srgb, var(--iob-primary) 85%, currentColor);
}

/* cards: each card is a container of its own, so its parts follow its size */
.card {
    container-type: size;
    min-width: 0;
    min-height: 0;
    border-radius: calc(var(--iob-border-radius) * 2);
    background: var(--soft);
    overflow: hidden;
}
.card-body {
    box-sizing: border-box;
    width: 100%;
    height: 100%;
    display: flex;
    gap: clamp(6px, 5cqmin, 16px);
    padding: clamp(6px, 6cqmin, 16px);
}
.card .cover {
    height: 100%;
    max-width: 40cqw;
}
.card .info {
    gap: clamp(2px, 2.5cqh, 8px);
}
.card .heading {
    font-size: clamp(12px, 11cqh, 22px);
}
.card .caption {
    font-size: clamp(10px, 8.5cqh, 16px);
}
.card .meta {
    font-size: clamp(10px, 8cqh, 14px);
}
.card .progress {
    font-size: clamp(9px, 7.5cqh, 13px);
}
.card .bar {
    height: clamp(3px, 2.5cqh, 6px);
}
.card .controls {
    gap: clamp(0px, 1.5cqw, 10px);
    margin-top: clamp(0px, 1.5cqh, 6px);
}
.card .controls button {
    width: clamp(24px, 19cqh, 44px);
    height: clamp(24px, 19cqh, 44px);
}
@container (max-height: 118px) {
    .card .caption {
        display: none;
    }
}
@container (max-height: 92px) {
    .card .meta {
        display: none;
    }
}
@container (max-width: 300px) {
    .card .controls .step {
        display: none;
    }
}
@container (max-width: 210px) {
    .card .cover {
        display: none;
    }
}

/* compact: one row per player, the progress as a line below it */
.row {
    position: relative;
    min-width: 0;
    display: flex;
    align-items: center;
    gap: 0.6em;
    padding: 0.4em 0.5em 0.55em;
    border-radius: var(--iob-border-radius);
    background: var(--soft);
}
.row .cover {
    height: 2.6em;
}
.row .heading {
    font-size: 1em;
}
.row .sub {
    font-size: 0.8em;
}
.row .controls {
    gap: 0.15em;
}
.row .controls button {
    width: 2em;
    height: 2em;
}
.row .line {
    position: absolute;
    left: 0.5em;
    right: 0.5em;
    bottom: 0.2em;
    height: 2px;
}
@container (max-width: 220px) {
    .row .cover {
        display: none;
    }
}
`;

/** `<iob-plex-activity>`: the events grouped by day */
export const ACTIVITY_STYLES = `${BASE}
.activity {
    box-sizing: border-box;
    width: 100%;
    height: 100%;
    padding: var(--pad);
    overflow-x: hidden;
    overflow-y: auto;
    font-size: clamp(11px, 3.6cqi, 14px);
}
.day {
    margin: 0.7em 0.4em 0.3em;
    font-size: 0.75em;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--iob-text-secondary);
}
.day:first-child {
    margin-top: 0.2em;
}
.entry {
    box-sizing: border-box;
    width: 100%;
    display: flex;
    align-items: flex-start;
    gap: 0.6em;
    padding: 0.45em 0.4em;
    border-radius: var(--iob-border-radius);
    text-align: left;
}
.entry:hover:not(:disabled) {
    background: var(--soft);
}
.badge {
    flex: none;
    width: 2em;
    height: 2em;
    margin-top: 0.1em;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--iob-primary);
    color: var(--iob-primary-contrast);
}
.badge svg {
    width: 1.15em;
    height: 1.15em;
    fill: currentColor;
}
.thumb {
    flex: none;
    height: 3.4em;
    width: auto;
    max-width: 5em;
    border-radius: var(--iob-border-radius);
    object-fit: cover;
    background: var(--soft);
}
.text {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 0.1em;
    line-height: 1.3;
}
.message {
    font-weight: 500;
    overflow-wrap: anywhere;
}
.caption,
.when {
    color: var(--iob-text-secondary);
    overflow-wrap: anywhere;
}
.caption {
    font-size: 0.85em;
}
.when {
    font-size: 0.78em;
    font-variant-numeric: tabular-nums;
}
@container (max-width: 240px) {
    .thumb {
        display: none;
    }
}
`;

/** The details of an event in an element dialog of the host */
export const DETAILS_STYLES = `
:host {
    display: block;
}
.details {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-start;
    gap: 16px;
    color: var(--iob-text);
    font-family: var(--iob-font-family);
    font-size: var(--iob-font-size, 14px);
}
.details img {
    max-width: 160px;
    max-height: 240px;
    border-radius: var(--iob-border-radius);
    object-fit: cover;
}
.details .text {
    flex: 1;
    min-width: 220px;
}
.details .caption {
    margin: 0 0 12px;
    color: var(--iob-text-secondary);
}
dl {
    margin: 0;
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 4px 12px;
    font-size: 0.9em;
}
dt {
    color: var(--iob-text-secondary);
}
dd {
    margin: 0;
    overflow-wrap: anywhere;
}
`;

/** `<iob-plex-stats>`: the top users and libraries of a period */
export const STATS_STYLES = `${BASE}
.stats {
    box-sizing: border-box;
    width: 100%;
    height: 100%;
    padding: var(--pad);
    display: flex;
    flex-direction: column;
    gap: 0.5em;
    overflow: hidden;
    font-size: clamp(11px, 3.4cqi, 14px);
    user-select: none;
}
.periods {
    flex: none;
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-end;
    gap: 0.3em;
}
.periods button {
    padding: 0.15em 0.7em;
    font-size: 0.8em;
    border-radius: 999px;
    border: 1px solid var(--iob-divider);
}
.periods button:hover:not(:disabled) {
    background: var(--soft);
}
.periods button.active {
    border-color: transparent;
    background: var(--iob-primary);
    color: var(--iob-primary-contrast);
}
.lists {
    flex: 1;
    min-height: 0;
    overflow-x: hidden;
    overflow-y: auto;
    display: grid;
    grid-template-columns: 1fr;
    align-content: start;
    gap: 0.8em 1.2em;
}
@container (min-width: 440px) {
    .lists.both {
        grid-template-columns: 1fr 1fr;
    }
}
.list h3 {
    margin: 0 0 0.3em;
    font-size: 0.75em;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--iob-text-secondary);
}
.entry {
    --share: 0%;
    display: grid;
    grid-template-columns: 1.3em minmax(0, 1fr) auto auto;
    align-items: center;
    gap: 0.5em;
    padding: 0.25em 0.4em;
    border-radius: var(--iob-border-radius);
    background: linear-gradient(
        to right,
        color-mix(in srgb, var(--iob-primary) 16%, transparent) var(--share),
        transparent var(--share)
    );
}
.rank,
.plays {
    font-size: 0.85em;
    color: var(--iob-text-secondary);
    font-variant-numeric: tabular-nums;
}
.name {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}
.watch {
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
}
.plays {
    white-space: nowrap;
    text-align: right;
    min-width: 3.5em;
}
.plays svg {
    width: 0.9em;
    height: 0.9em;
    fill: currentColor;
    vertical-align: -0.1em;
}
.none {
    padding: 0.8em 0;
    text-align: center;
    color: var(--iob-text-secondary);
}
`;
