import react from '@vitejs/plugin-react';
import commonjs from 'vite-plugin-commonjs';
import { federation } from '@module-federation/vite';
import { moduleFederationShared } from '@iobroker/gui-components/modulefederation.admin.config';
import { readFileSync } from 'node:fs';

const config = {
    plugins: [
        federation({
            manifest: true,
            name: 'ConfigCustomPlexSet',
            filename: 'customComponents.js',
            exposes: {
                './Components': './src/Components.tsx',
            },
            remotes: {},
            shared: moduleFederationShared(JSON.parse(readFileSync('./package.json').toString())),
            dts: false,
        }),
        react(),
        commonjs(),
    ],
    resolve: {
        tsconfigPaths: true,
    },
    server: {
        port: 3000,
    },
    base: './',
    build: {
        target: 'chrome89',
        outDir: './build',
        chunkSizeWarningLimit: 5000,
    },
};

export default config;
