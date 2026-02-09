import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import path from 'path';

export default defineConfig({
    plugins: [svelte()],
    resolve: {
        dedupe: ['svelte'],
        alias: {
            // Resolve svelte-sdk to source so we don't need a separate build step
            '@gatrix/svelte-sdk': path.resolve(__dirname, '../../src'),
        },
    },
});
