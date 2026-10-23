# Pulse

지난 7일간 지구에서 일어난 지진·로켓 발사·ISS 궤도를 3D 지구본 위에서 되감아 보는 웹 페이지.

- 사이트: https://pulse.joon.is-a.dev
- 서버 없음. 브라우저가 키 없는 공개 API 세 개를 직접 부른다.

## 데이터

| 레이어 | 출처 | 캐시 |
|---|---|---|
| 지진 | [USGS Earthquake Hazards Program](https://earthquake.usgs.gov/earthquakes/feed/v1.0/geojson.php) — 지난 7일 전체 | 60초 |
| 발사 | [Launch Library 2](https://thespacedevs.com/llapi) — 지난 7일 + 앞으로 7일 | 1시간(익명 한도 IP당 시간당 15회) |
| ISS | [Where the ISS at?](https://wheretheiss.at/w/developer) TLE → [satellite.js](https://github.com/shashwatak/satellite-js)로 브라우저에서 위치 계산 | 1일 |

ISS 위치는 주기적으로 묻지 않는다. 하루 한 번 받은 궤도 요소(TLE)로 아무 시각의 위치나 계산하므로 스크러버로 되감을 수 있다.

## 구조

- `src/sources/` 출처 하나에 파일 하나. 응답을 `PulseEvent`로 바꾸는 순수 함수 + 캐시 붙은 로더
- `src/lib/` 캐시, 시각 `t`에 보일 이벤트(`timeline`), URL 해시
- `src/components/` globe.gl 래퍼, 스크러버, 헤더, 카드

## 개발

```bash
npm install
npm run dev
npm run check   # node --test 'src/**/*.check.mjs' — 실제 응답을 자른 fixture로 변환 결과 고정
npm run lint && npm run build
```

`earth-night.webp` — NASA Earth Observatory "Earth at Night" (public domain), via three-globe example images
`night-sky.webp` — from [three-globe](https://github.com/vasturiano/three-globe) example images (MIT License)

## 분석

방문 수와 몇 가지 이벤트(재생, 레이어 켜고 끄기, 카드 열기, ISS 따라가기, 링크 복사)를 Google Analytics 4로 센다. 측정 ID는 빌드 때 `VITE_GA_ID`로 넣고, 없으면 분석 스크립트를 불러오지 않는다.

## 라이선스

코드는 [MIT](LICENSE). 지구 텍스처의 출처와 라이선스는 위에 적었다.
