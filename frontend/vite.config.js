import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  base: '/static/vue/',
  build: {
    outDir: '../frontend_dist',
    emptyOutDir: false,
  },
})
