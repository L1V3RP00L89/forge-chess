import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const crossOriginIsolationHeaders = {
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Embedder-Policy': 'require-corp',
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/forge-chess/',
  server: {
    headers: crossOriginIsolationHeaders,
  },
  preview: {
    headers: crossOriginIsolationHeaders,
  },
  worker: {
    format: 'es',
  },
  optimizeDeps: {
    // Vite's dep pre-bundler copies this Emscripten glue module without its
    // sibling .wasm file, breaking the glue's self-relative wasm fetch.
    // Serve it straight from node_modules instead.
    exclude: ['@journeyapps/wa-sqlite'],
  },
})
