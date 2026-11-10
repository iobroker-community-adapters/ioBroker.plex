import react from '@vitejs/plugin-react';
import { checkManifest, getReactImportPath, REACT_SPECIFIERS } from '@iobroker/web-components';
import type { Plugin, UserConfig } from 'vite';

// with the extension: Vite may load its config natively, without a bundler that would add it
import { COMPONENT_NAMES, getManifestFile, getModuleFile, getModulePath, type ComponentName } from './src/constants.ts';
import { MANIFESTS } from './src/manifest.ts';

/**
 * The web components `<iob-plex-now-playing>`, `<iob-plex-activity>` and `<iob-plex-stats>`: one ES module each,
 * `admin/webcomponents/<name>.js`, and its manifest `<name>.json` next to it (`common.webComponents`). Every host -
 * vis-2, devices, Aura, admin - reads them from `/adapter/plex/webcomponents/`. No module federation: the host shares
 * nothing but the socket.
 *
 * One build per component - `vite build --mode <name>` (`npm run build` runs all of them): a host imports exactly
 * one URL per component, so each module is one file, with the shared code compiled into each. One build with several
 * entries would move the shared code into a chunk of its own.
 *
 * React is not bundled: the four React imports point at `lib/esm/react-19.js`, which web and admin serve
 * beside `adapter/`. The path is relative to the module, so a path prefix of a reverse proxy stays.
 */

/** The module of each component */
const ENTRIES: Record<ComponentName, string> = {
    'plex-now-playing': './src/NowPlaying.tsx',
    'plex-activity': './src/Activity.tsx',
    'plex-stats': './src/Stats.tsx',
};

/** Writes `<name>.json` next to the module, checked like a host checks it */
function manifestFile(name: ComponentName): Plugin {
    return {
        name: 'plex-web-component-manifest',
        generateBundle() {
            const manifest = MANIFESTS[name];
            const problem = checkManifest(manifest);
            if (problem) {
                this.error(`${getManifestFile(name)}: ${problem}`);
            }
            if (manifest.module !== getModuleFile(name)) {
                this.error(`${getManifestFile(name)}: "module" must be "${getModuleFile(name)}"`);
            }
            this.emitFile({
                type: 'asset',
                fileName: getManifestFile(name),
                source: `${JSON.stringify(manifest, null, 4)}\n`,
            });
        },
    };
}

export default ({ mode }: { mode: string }): UserConfig => {
    const name = COMPONENT_NAMES.find(component => component === mode);
    if (!name) {
        throw new Error(`Build one component at a time: vite build --mode <${COMPONENT_NAMES.join('|')}>`);
    }
    const reactImport = getReactImportPath(getModulePath(name));

    return {
        plugins: [react(), manifestFile(name)],
        define: {
            'process.env.NODE_ENV': JSON.stringify('production'),
        },
        build: {
            target: 'es2022',
            outDir: './build',
            // the builds of all components write into the same folder: only the first one empties it
            emptyOutDir: name === COMPONENT_NAMES[0],
            lib: {
                entry: ENTRIES[name],
                formats: ['es'],
                fileName: (): string => getModuleFile(name),
            },
            rollupOptions: {
                external: [...REACT_SPECIFIERS],
                output: {
                    paths: Object.fromEntries(REACT_SPECIFIERS.map(specifier => [specifier, reactImport])),
                    // one file: a host imports exactly one URL
                    codeSplitting: false,
                    // library mode keeps whitespace for the bundler of a consumer; this module is loaded as it is
                    minify: true,
                },
            },
        },
    };
};
