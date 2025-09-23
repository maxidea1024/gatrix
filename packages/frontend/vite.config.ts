import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// Force platform for WSL compatibility
process.env.ROLLUP_BINARY_PATH = process.env.ROLLUP_BINARY_PATH || '';

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
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:5001',
        changeOrigin: true,
        secure: false,
      },
      '/admin/queues': {
        target: 'http://localhost:5001',
        changeOrigin: true,
        secure: false,
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
