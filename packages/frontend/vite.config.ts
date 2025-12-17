import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import http from 'http'
import https from 'https'

// Force platform for WSL compatibility
process.env.ROLLUP_BINARY_PATH = process.env.ROLLUP_BINARY_PATH || '';

// Use esbuild-wasm for better compatibility
process.env.ESBUILD_BINARY_PATH = process.env.ESBUILD_BINARY_PATH || '';

// Determine backend URL based on environment
// In Docker: use service name 'backend-dev'
// In local: use 'localhost'
// Note: Vite only exposes VITE_* env vars to the client, but in vite.config.ts we can access all env vars
const isDocker = process.env.VITE_DOCKER_ENV === 'true' || process.env.DOCKER_ENV === 'true';
const backendHost = isDocker ? 'backend-dev' : 'localhost';
const backendPort = isDocker ? '5000' : (process.env.BACKEND_PORT || '5000');
const backendUrl = `http://${backendHost}:${backendPort}`;

// Create HTTP agents with DNS caching disabled
const httpAgent = new http.Agent({
  keepAlive: true,
  keepAliveMsecs: 1000,
  maxSockets: 50,
  maxFreeSockets: 10,
  timeout: 60000,
  freeSocketTimeout: 30000,
});

const httpsAgent = new https.Agent({
  keepAlive: true,
  keepAliveMsecs: 1000,
  maxSockets: 50,
  maxFreeSockets: 10,
  timeout: 60000,
  freeSocketTimeout: 30000,
});

console.log(`🔧 Vite proxy configuration:`, {
  isDocker,
  backendUrl,
  environment: process.env.NODE_ENV,
  dockerEnvVar: process.env.DOCKER_ENV,
  viteDockerEnvVar: process.env.VITE_DOCKER_ENV
});

const frontendRoot = path.resolve(__dirname).replace(/\\/g, '/');

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@/components': path.resolve(__dirname, './src/components'),
      '@/pages': path.resolve(__dirname, './src/pages'),
      '@/hooks': path.resolve(__dirname, './src/hooks'),
      '@/utils': path.resolve(__dirname, './src/utils'),
      '@/types': path.resolve(__dirname, './src/types'),
      '@/services': path.resolve(__dirname, './src/services'),
      '@/contexts': path.resolve(__dirname, './src/contexts'),
    },
  },
  server: {
    host: '0.0.0.0', // Allow external connections (required for Docker)
    port: 3000,
    watch: {
      usePolling: true, // Required for Docker on Windows/WSL
      interval: 1000, // Increased from 100ms to 1000ms to reduce unnecessary reloads
      ignored: (watchPath: string) => {
        // Only watch files inside the frontend workspace to avoid reloads from other packages
        const normalizedPath = watchPath.replace(/\\/g, '/');
        if (!normalizedPath.startsWith(frontendRoot)) {
          return true;
        }

        // Ignore common non-source directories and files
        const ignoredPatterns = [
          'node_modules',
          '.git',
          'dist',
          'build',
          '.next',
          'logs',
          '.log',
          'tmp',
          '.DS_Store',
          '.vite',
          'coverage',
          '.turbo',
        ];
        return ignoredPatterns.some(pattern => normalizedPath.includes(pattern));
      },
    },
    // Let Vite infer the HMR host from the page URL so LAN clients use the correct IP
    hmr: {
      overlay: false, // Disable error overlay on connection loss
      timeout: 30000, // Increase timeout before giving up on reconnection
    },
    proxy: {
      '/api': {
        target: backendUrl,
        changeOrigin: true, // Change origin to backend URL
        secure: false,
        agent: httpAgent,
        // SSE 지원을 위한 설정
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq, req) => {
            // SSE requests need special headers to keep the stream open
            if (req.url?.includes('/notifications/sse') || req.url?.includes('/services/sse')) {
              proxyReq.setHeader('Cache-Control', 'no-cache');
              proxyReq.setHeader('Connection', 'keep-alive');
            }
          });
          proxy.on('proxyRes', (proxyRes, req) => {
            // SSE 응답인 경우 특별 처리
            if (req.url?.includes('/notifications/sse') || req.url?.includes('/services/sse')) {
              proxyRes.headers['cache-control'] = 'no-cache';
              proxyRes.headers['connection'] = 'keep-alive';
              proxyRes.headers['content-type'] = 'text/event-stream';
            }
          });
        },
      },
      '/bull-board': {
        target: backendUrl,
        changeOrigin: true,
        secure: false,
        agent: httpAgent,
        ws: true,
        // Ensure all Bull Board paths are proxied, including static resources
        rewrite: undefined, // Don't rewrite the path
        bypass: undefined, // Don't bypass any requests
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    // 청크 크기 경고 임계값 증가 (기본값: 500KB)
    chunkSizeWarningLimit: 1000,
    // 빌드 성능 최적화
    minify: 'esbuild',
    target: 'es2020',
    rollupOptions: {
      output: {
        // Hardening: eliminate dynamic code-splitting to avoid runtime init-order issues across chunks
        inlineDynamicImports: true,
        manualChunks: undefined,
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
  },
})
