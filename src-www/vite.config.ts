import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
    plugins: [react()],
    base: './',
    server: {
        port: 4174,
    },
    build: {
        outDir: '../www',
        emptyOutDir: true,
        target: 'chrome89',
        chunkSizeWarningLimit: 2000,
    },
});
