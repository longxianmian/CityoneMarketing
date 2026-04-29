import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

const port = Number(process.env.PORT) || 23097
const basePath = process.env.BASE_PATH || '/'
const apiProxyTarget =
  process.env.VITE_API_PROXY_TARGET ||
  process.env.API_PROXY_TARGET ||
  'http://127.0.0.1:3100'

export default defineConfig({
  plugins: [react()],
  base: basePath,
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') },
    dedupe: ['react', 'react-dom'],
  },
  server: {
    host: '0.0.0.0',
    port,
    allowedHosts: true,
    proxy: {
      '/api': {
        target: apiProxyTarget,
        changeOrigin: true,
      },
      '/uploads': {
        target: apiProxyTarget,
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: path.resolve(__dirname, 'dist/public'),
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks: {
          'antd-core': ['antd', '@ant-design/icons'],
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
        },
      },
    },
  },
})
