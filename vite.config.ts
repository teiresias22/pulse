import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// index.html의 canonical·og:url·og:image·JSON-LD 절대 주소(끝 슬래시 유지). 옛 github.io/pulse/ 는 GitHub이
// 사용자 지정 도메인으로 넘긴다. .env 는 전역 dotenvx 필터가 평문 커밋을 막아 여기에 둔다
process.env.VITE_SITE_URL ??= 'https://pulse.joon.is-a.dev/'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: './', // GitHub Pages 하위 경로(/pulse/)와 서브도메인 루트에서 같은 빌드가 돈다
  worker: { format: 'es' }, // satellite.js의 wasm 워커가 top-level await를 쓴다
})
