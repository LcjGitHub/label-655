import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'
/// <reference types="vitest" />

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  const apiBaseUrl = env.VITE_API_BASE_URL || '/api'
  let proxyTarget = 'http://localhost:3000'

  try {
    const url = new URL(apiBaseUrl)
    proxyTarget = `${url.protocol}//${url.host}`
  } catch (_) {
    proxyTarget = 'http://localhost:3000'
  }

  return {
    plugins: [vue()],
    envDir: process.cwd(),
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url))
      }
    },
    server: {
      port: 5173,
      proxy: {
        '/api': {
          target: proxyTarget,
          changeOrigin: true
        },
        '/uploads': {
          target: proxyTarget,
          changeOrigin: true
        }
      }
    },
    define: {
      __APP_ENV__: JSON.stringify(env.VITE_APP_ENV || 'development'),
      __APP_TITLE__: JSON.stringify(env.VITE_APP_TITLE || '留言板系统')
    },
    test: {
      globals: true,
      environment: 'happy-dom',
      setupFiles: ['./src/tests/setup.js'],
      include: ['src/tests/**/*.{test,spec}.{js,ts,jsx,tsx}']
    }
  }
})
