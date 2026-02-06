import resolve from '@rollup/plugin-node-resolve';
import typescript from '@rollup/plugin-typescript';
import replace from '@rollup/plugin-replace';
import { readFileSync } from 'fs';

const pkg = JSON.parse(readFileSync('./package.json', 'utf8'));

export default {
  input: 'src/index.ts',
  output: [
    {
      file: 'dist/index.cjs.js',
      format: 'cjs',
      sourcemap: true,
    },
    {
      file: 'dist/index.esm.js',
      format: 'esm',
      sourcemap: true,
    },
    {
      file: 'dist/index.umd.js',
      format: 'umd',
      name: 'GatrixClient',
      sourcemap: true,
    },
  ],
  plugins: [
    resolve(),
    replace({
      preventAssignment: true,
      __SDK_VERSION__: JSON.stringify(pkg.version),
      __SDK_NAME__: JSON.stringify(pkg.name),
    }),
    typescript({
      tsconfig: './tsconfig.json',
      declaration: false, // handled separately by tsc
    }),
  ],
};
