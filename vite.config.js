import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base: './' 让产物可在任意子路径下静态托管（CloudStudio / 对象存储 / 本地）
export default defineConfig({
  plugins: [react()],
  base: './',
  server: { host: true },
})
