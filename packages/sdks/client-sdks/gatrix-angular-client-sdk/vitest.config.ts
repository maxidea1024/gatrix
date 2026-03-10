import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    include: ['src/__tests__/**/*.spec.ts'],
    exclude: ['node_modules', 'dist', 'examples'],
  },
});
