import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { sentryVitePlugin } from '@sentry/vite-plugin'

// https://vite.dev/config/
export default defineConfig({
  build: {
    sourcemap: true,
  },
  server: {
    headers: {
      "Document-Policy": "js-profiling",
    },
  },
  preview: {
    headers: {
      "Document-Policy": "js-profiling",
    },
  },
  plugins: [
    react(),
    sentryVitePlugin({
      org: "motifgames",
      project: "javascript-react",
      authToken: process.env.SENTRY_AUTH_TOKEN,
      sourcemaps: {
        filesToDeleteAfterUpload: ["./dist/**/*.map"],
      },
    }),
  ],
})
