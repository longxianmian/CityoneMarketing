import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

const port = Number(process.env.PORT) || 23097
const basePath = process.env.BASE_PATH || '/'

export default defineConfig({
  plugins: [react()],
  base: basePath,
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') },
  },
  server: {
    host: '0.0.0.0',
    port,
    allowedHosts: true,
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
      '/uploads': {
        target: 'http://localhost:8080',
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
