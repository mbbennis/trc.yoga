import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // Proxy .ics requests to production during dev
      '^/.*\\.ics$': {
        target: 'https://trc.yoga',
        changeOrigin: true,
        secure: true,
      },
    },
  },
})
