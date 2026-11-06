import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'EF_')
  const target = process.env.EF_API_TARGET || env.EF_API_TARGET || 'http://127.0.0.1:8080'
  return {
    cacheDir: process.env.EF_VITE_CACHE_DIR || undefined,
    plugins: [react()],
    server: { proxy: { '/api': { target, changeOrigin: true } }, watch: { ignored: ['**/tmp/**'] } },
    preview: { proxy: { '/api': { target, changeOrigin: true } } },
  }
})
