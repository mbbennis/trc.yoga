import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // Proxy .ics requests to the S3 website bucket during dev
      '^/.*\\.ics$': {
        target: 'http://trc-yoga-website.s3-website-us-east-1.amazonaws.com',
        changeOrigin: true,
      },
    },
  },
})
