import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// Force platform for WSL compatibility
process.env.ROLLUP_BINARY_PATH = process.env.ROLLUP_BINARY_PATH || '';

// Determine backend URL based on environment
// In Docker: use service name 'backend-dev'
// In local: use 'localhost'
// Note: Vite only exposes VITE_* env vars to the client, but in vite.config.ts we can access all env vars
const isDocker = process.env.VITE_DOCKER_ENV === 'true' || process.env.DOCKER_ENV === 'true';
const backendHost = isDocker ? 'backend-dev' : 'localhost';
const backendPort = isDocker ? '5000' : (process.env.BACKEND_PORT || '5000');
const backendUrl = `http://${backendHost}:${backendPort}`;

console.log(`🔧 Vite proxy configuration:`, {
  isDocker,
  backendUrl,
  environment: process.env.NODE_ENV,
  dockerEnvVar: process.env.DOCKER_ENV,
  viteDockerEnvVar: process.env.VITE_DOCKER_ENV
});

// https://vitejs.dev/config/
export default defineConfig({
  esbuild: {
    // Use esbuild-wasm for WSL compatibility
    target: 'es2020',
  },
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
      interval: 100,
    },
    // Let Vite infer the HMR host from the page URL so LAN clients use the correct IP
    hmr: {
      port: 3000,
    },
    proxy: {
      '/api': {
        target: backendUrl,
        changeOrigin: false, // Keep original host header
        secure: false,
        // SSE 지원을 위한 설정
        configure: (proxy, options) => {
          proxy.on('proxyReq', (proxyReq, req, res) => {
            // Preserve the actual incoming host and protocol (works for LAN access)
            const incomingHost = (req.headers['x-forwarded-host'] as string) || (req.headers.host as string) || 'localhost:3000';
            const incomingProto = (req.headers['x-forwarded-proto'] as string) || (req.socket as any)?.encrypted ? 'https' : 'http';
            proxyReq.setHeader('Host', incomingHost);
            proxyReq.setHeader('X-Forwarded-Host', incomingHost);
            proxyReq.setHeader('X-Forwarded-Proto', incomingProto);

            // SSE requests need special headers to keep the stream open
            if (req.url?.includes('/notifications/sse') || req.url?.includes('/services/sse')) {
              proxyReq.setHeader('Cache-Control', 'no-cache');
              proxyReq.setHeader('Connection', 'keep-alive');
            }
          });
          proxy.on('proxyRes', (proxyRes, req, res) => {
            // SSE 응답인 경우 특별 처리
            if (req.url?.includes('/notifications/sse') || req.url?.includes('/services/sse')) {
              proxyRes.headers['cache-control'] = 'no-cache';
              proxyRes.headers['connection'] = 'keep-alive';
              proxyRes.headers['content-type'] = 'text/event-stream';
            }
          });
        },
      },
      '/admin/queues': {
        target: backendUrl,
        changeOrigin: false,
        secure: false,
        configure: (proxy, options) => {
          proxy.on('proxyReq', (proxyReq, req, res) => {
            proxyReq.setHeader('Host', 'localhost:3000');
          });
        },
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
        // 더 세분화된 청크 분할
        manualChunks: (id) => {
          // node_modules의 패키지들을 vendor 청크로 분리
          if (id.includes('node_modules')) {
            // React 관련
            if (id.includes('react') || id.includes('react-dom')) {
              return 'react-vendor';
            }
            // MUI 관련
            if (id.includes('@mui') || id.includes('@emotion')) {
              return 'mui-vendor';
            }
            // 라우터 관련
            if (id.includes('react-router')) {
              return 'router-vendor';
            }
            // 폼 관련
            if (id.includes('react-hook-form') || id.includes('yup') || id.includes('@hookform')) {
              return 'forms-vendor';
            }
            // i18n 관련
            if (id.includes('i18next') || id.includes('react-i18next')) {
              return 'i18n-vendor';
            }
            // 차트/그래프 라이브러리
            if (id.includes('chart') || id.includes('recharts') || id.includes('d3')) {
              return 'charts-vendor';
            }
            // 유틸리티 라이브러리들
            if (id.includes('lodash') || id.includes('date-fns') || id.includes('moment')) {
              return 'utils-vendor';
            }
            // 나머지 vendor 라이브러리들
            return 'vendor';
          }

          // 애플리케이션 코드 분할
          // 관리자 페이지들
          if (id.includes('/pages/admin/')) {
            return 'admin-pages';
          }
          // 사용자 페이지들
          if (id.includes('/pages/user/')) {
            return 'user-pages';
          }
          // 인증 페이지들
          if (id.includes('/pages/auth/')) {
            return 'auth-pages';
          }
          // 채팅 관련
          if (id.includes('/chat/') || id.includes('ChatContext') || id.includes('chatService')) {
            return 'chat';
          }
          // 서비스들
          if (id.includes('/services/')) {
            return 'services';
          }
          // 컴포넌트들
          if (id.includes('/components/')) {
            return 'components';
          }
        },
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
  },
})
