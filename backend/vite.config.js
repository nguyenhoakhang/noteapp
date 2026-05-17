import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://noteapp_backend:8080',  // ĐỔI noteapp_backend -> noteapp_backend
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, '/api')
      },
      '/storage': {
        target: 'http://noteapp_backend:8080',  // ĐỔI noteapp_backend -> noteapp_backend
        changeOrigin: true,
      }
    }
  }
})