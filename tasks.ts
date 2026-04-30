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
} else {
    console.error(`Unknown command: ${command}`);
    process.exit(1);
}
