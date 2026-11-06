/**
 * What the elements of the Plex adapter share: the shadow root with React in it, the words in the language of the
 * system, the hint shown while settings are missing - and states that depend on what arrives.
 *
 * The base class `IobWebComponent` subscribes what `getStateIds` names whenever the socket or the settings change.
 * Here the states also depend on states and on objects read once: the players in `events.history`, the statistics
 * found below the instance. So every drawing compares the states wanted now with those subscribed, and has them
 * subscribed anew when they differ.
 */
import type { JSX, ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';

import type { WebComponentSettings } from '@iobroker/web-components';
import { IobWebComponent } from '@iobroker/web-components/element';

import { getWord, type WordKey } from './i18n';
import { Icon, type IconName } from './icons';

/** The IDs as one comparable text */
function toKey(ids: string[]): string {
    return [...new Set(ids.filter(Boolean))].sort().join('\n');
}

/**
 * A hint instead of the content: a setting is missing, or there is nothing to show
 *
 * @param props the text, the picture and whether the host is in edit mode
 * @param props.text what to say
 * @param props.icon the picture above it
 * @param props.editMode in edit mode the element takes no clicks
 */
export function Hint({ text, icon, editMode }: { text: string; icon: IconName; editMode: boolean }): JSX.Element {
    return (
        <div className={`hint${editMode ? ' edit' : ''}`}>
            <Icon name={icon} />
            <span>{text}</span>
        </div>
    );
}

export abstract class PlexElement<TSettings extends WebComponentSettings> extends IobWebComponent<TSettings> {
    readonly #root: Root;

    /** The states `getStateIds` named last - what the base class has subscribed */
    #subscribed = '';

    protected constructor(css: string) {
        super();
        const shadow = this.attachShadow({ mode: 'open' });
        const style = document.createElement('style');
        style.textContent = css;
        const mount = document.createElement('div');
        mount.className = 'mount';
        shadow.append(style, mount);
        this.#root = createRoot(mount);
    }

    /** The states the element needs now: for the settings, and for what arrived so far */
    protected abstract getWantedIds(settings: TSettings): string[];

    /** What the element shows */
    protected abstract draw(): ReactNode;

    protected override getStateIds(settings: TSettings): string[] {
        const ids = this.getWantedIds(settings);
        this.#subscribed = toKey(ids);
        return ids;
    }

    protected override render(): void {
        if (this.socket && toKey(this.getWantedIds(this.settings)) !== this.#subscribed) {
            // draws again once subscribed
            this.resubscribe();
            return;
        }
        this.#root.render(this.draw());
    }

    /** Have the states subscribed that `getStateIds` names now: the base class asks again for new settings */
    protected resubscribe(): void {
        const settings = this.settings;
        this.settings = settings;
    }

    /**
     * A word in the language of the system
     *
     * @param key the word
     */
    protected word = (key: WordKey): string => getWord(this.systemLang, key);
}
