
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss()
  ],

  base: '/Flathisab/',

  build: {
    outDir: '../docs',
    emptyOutDir: true
  },

  server: {
    proxy: {
      '/flathisab': {
        target: 'http://localhost:8080',
        changeOrigin: true
      }
    }
  }
})
