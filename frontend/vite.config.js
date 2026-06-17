import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: './', // Важно для Electron: относительные пути
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'masked-icon.svg'],
      manifest: {
        name: 'СИЯНИЕ OS',
        short_name: 'СИЯНИЕ',
        description: 'Защищенный терминал связи',
        theme_color: '#050a0c',
        background_color: '#050a0c',
        display: 'standalone', // Это уберет адресную строку браузера
        icons: [
          {
            src: 'favicon.ico',
            sizes: '64x64 32x32 24x24 16x16',
            type: 'image/x-icon'
          }
        ]
      }
    })
  ]
})
