import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import dts from 'vite-plugin-dts';
import { resolve } from 'path';

export default defineConfig({
    plugins: [
        vue(),
        dts({
            insertTypesEntry: true,
        }),
    ],
    build: {
        lib: {
            entry: resolve(__dirname, 'src/index.ts'),
            name: 'GatrixVue',
            fileName: 'gatrix-vue',
        },
        rollupOptions: {
            external: ['vue', '@gatrix/js-client-sdk'],
            output: {
                globals: {
                    vue: 'Vue',
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
