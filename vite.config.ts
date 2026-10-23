import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: './', // GitHub Pages 하위 경로(/pulse/)와 서브도메인 루트에서 같은 빌드가 돈다
  worker: { format: 'es' }, // satellite.js의 wasm 워커가 top-level await를 쓴다
})
