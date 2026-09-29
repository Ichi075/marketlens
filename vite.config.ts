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
        rewrite: path => {
          const [pathname, query = ''] = path.split('?')
          const range = new URLSearchParams(query).get('range') === '5d' ? '5d' : '1d'
          return pathname.replace(/^\/api\/chart/, '/v8/finance/chart') +
            `?interval=1m&range=${range}&includePrePost=true`
        },
      },
    },
  },
})
