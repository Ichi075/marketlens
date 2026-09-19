import { defineConfig } from 'vite'

declare const process: { env: Record<string, string | undefined> }
const host = process.env.TAURI_DEV_HOST

export default defineConfig({
  clearScreen: false,
  server: {
    host: host || false,
    port: 1420,
    strictPort: true,
    hmr: host ? { protocol: 'ws', host, port: 1421 } : undefined,
    proxy: {
      '/api/chart': {
        target: 'https://query1.finance.yahoo.com',
        changeOrigin: true,
        rewrite: path => path.replace(/^\/api\/chart/, '/v8/finance/chart') +
          '?interval=1m&range=1d&includePrePost=true',
      },
    },
  },
})
