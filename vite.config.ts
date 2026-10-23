import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// index.html의 og:url·og:image·JSON-LD 절대 주소. 도메인을 https://pulse.joon.is-a.dev/ 로
// 옮길 때 이 값만 바꾼다(끝 슬래시 유지). .env 는 전역 dotenvx 필터가 평문 커밋을 막아 여기에 둔다
process.env.VITE_SITE_URL ??= 'https://teiresias22.github.io/pulse/'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: './', // GitHub Pages 하위 경로(/pulse/)와 서브도메인 루트에서 같은 빌드가 돈다
  worker: { format: 'es' }, // satellite.js의 wasm 워커가 top-level await를 쓴다
})
