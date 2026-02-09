import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';
import { resolve } from 'path';

export default defineConfig({
    plugins: [
        dts({
            insertTypesEntry: true,
        }),
    ],
    build: {
        lib: {
            entry: resolve(__dirname, 'src/index.ts'),
            name: 'GatrixSvelte',
            fileName: 'gatrix-svelte',
            formats: ['es'],
        },
        rollupOptions: {
            external: ['svelte', 'svelte/store', '@gatrix/js-client-sdk'],
            output: {
                globals: {
                    svelte: 'Svelte',
                    'svelte/store': 'SvelteStore',
                    '@gatrix/js-client-sdk': 'Gatrix',
                },
            },
        },
    },
    test: {
        globals: true,
        environment: 'happy-dom',
    },
});
