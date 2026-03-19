import {defineConfig} from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    target: 'esnext', // ✅ 改为 esnext 支持 top-level await
    // 或者指定具体版本
    // target: ['es2022', 'chrome100', 'safari15', 'firefox100', 'edge100']
  },
  esbuild: {
    target: 'esnext', // ✅ esbuild 也需要设置
  },
  optimizeDeps: {
    esbuildOptions: {
      target: 'esnext', // ✅ 依赖优化也需要设置
    }
  }
})