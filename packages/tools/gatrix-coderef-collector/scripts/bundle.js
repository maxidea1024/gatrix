const esbuild = require('esbuild');

// Bundle all TypeScript/JavaScript into a single file for pkg
esbuild
    .build({
        entryPoints: ['dist/cli.js'],
        bundle: true,
        platform: 'node',
        target: 'node18',
        outfile: 'dist/bundle.js',
        minify: false,
        sourcemap: false,
        // Mark native addons as external (if any)
        external: [],
    })
    .then(() => {
        console.log('[OK] Bundle created: dist/bundle.js');
    })
    .catch((err) => {
        console.error('[FAIL] Bundle failed:', err);
        process.exit(1);
    });
