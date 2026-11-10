import { execSync } from 'node:child_process';
import { cpSync, mkdirSync, readdirSync, existsSync, rmSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const command = process.argv[2];

function copyGlob(srcDir: string, pattern: RegExp, destDir: string): void {
    if (!existsSync(srcDir)) {
        return;
    }
    mkdirSync(destDir, { recursive: true });
    for (const file of readdirSync(srcDir)) {
        if (pattern.test(file)) {
            cpSync(resolve(srcDir, file), resolve(destDir, file));
        }
    }
}

if (command === 'admin:copy') {
    const buildDir = resolve(__dirname, 'src-admin/build');
    const customDir = resolve(__dirname, 'admin/custom');
    // Wipe previous output so stale hashed bundles from earlier builds don't leak through.
    rmSync(customDir, { recursive: true, force: true });
    copyGlob(resolve(buildDir, 'assets'), /\.js$/, resolve(customDir, 'assets'));
    copyGlob(buildDir, /^customComponents\.js$/, customDir);
    copyGlob(resolve(__dirname, 'src-admin/src/i18n'), /\.json$/, resolve(customDir, 'i18n'));
    console.log('admin:copy done');
} else if (command === 'wc') {
    // Web components (src-webcomponents/): one ES module and its manifest each, built by one vite build per
    // component (see src-webcomponents/vite.config.ts), served as /adapter/plex/webcomponents/ and named in
    // `common.webComponents`. The destination is emptied first, so no module of an earlier build is published.
    const srcDir = resolve(__dirname, 'src-webcomponents');
    const destDir = resolve(__dirname, 'admin/webcomponents');
    rmSync(destDir, { recursive: true, force: true });
    rmSync(resolve(srcDir, 'build'), { recursive: true, force: true });
    if (!existsSync(resolve(srcDir, 'node_modules'))) {
        execSync('npm install', { cwd: srcDir, stdio: 'inherit' });
    }
    // fails the task if a manifest does not pass `checkManifest`
    execSync('npm run build', { cwd: srcDir, stdio: 'inherit' });
    copyGlob(resolve(srcDir, 'build'), /\.(js|json)$/, destDir);
    console.log('wc done');
} else {
    console.error(`Unknown command: ${command}`);
    process.exit(1);
}
