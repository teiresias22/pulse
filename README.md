# Pulse

지난 7일간 지구에서 일어난 지진·태풍·토네이도 경보·산불·오로라·로켓 발사·ISS 궤도를 3D 지구본 위에서 되감아 보는 웹 페이지.

- 사이트: https://pulse.joon.is-a.dev
- 서버 없음. 브라우저가 키 없는 공개 API 여섯 개를 직접 부른다.

## 데이터

| 레이어 | 출처 | 캐시 |
|---|---|---|
| 지진 | [USGS Earthquake Hazards Program](https://earthquake.usgs.gov/earthquakes/feed/v1.0/geojson.php) — 지난 7일 전체 | 60초 |
| 발사 | [Launch Library 2](https://thespacedevs.com/llapi) — 지난 7일 + 앞으로 7일 | 1시간(익명 한도 IP당 시간당 15회) |
| 태풍·산불 | [NASA EONET](https://eonet.gsfc.nasa.gov/docs/v3) — 지난 7일(끝난 이벤트 포함). 태풍은 6시간 간격 관측점을 보간, 예보 경로는 없음 | 30분 |
| 토네이도 | [NOAA NWS API](https://www.weather.gov/documentation/services-web-api) Tornado Warning — 지난 7일, 갱신·취소 반영, 미국 전용 | 15분 |
| 오로라 | [NOAA SWPC Kp 지수](https://www.swpc.noaa.gov/products/planetary-k-index) — 지난 7일 관측 + 3일 예보. 띠는 자기위도 66.5° − 2·Kp 근사 | 30분 |
| ISS | [Where the ISS at?](https://wheretheiss.at/w/developer) TLE → [satellite.js](https://github.com/shashwatak/satellite-js)로 브라우저에서 위치 계산 | 1일 |

ISS 위치는 주기적으로 묻지 않는다. 하루 한 번 받은 궤도 요소(TLE)로 아무 시각의 위치나 계산하므로 스크러버로 되감을 수 있다.

라이브 모드에서는 5분마다 모든 출처를 다시 부르고, 실제 요청 여부는 위 캐시 시간이 정한다.

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

`earth-day.webp` — NASA "Blue Marble" (public domain), via three-globe example images
`earth-night.webp` — NASA Earth Observatory "Earth at Night" / Black Marble (public domain), via three-globe example images
`night-sky.webp` — from [three-globe](https://github.com/vasturiano/three-globe) example images (MIT License).
확대 시 위성 타일은 [NASA Global Imagery Browse Services (GIBS)](https://www.earthdata.nasa.gov/engage/open-data-services-software/earthdata-developer-portal/gibs-api) BlueMarble_ShadedRelief_Bathymetry(키 없음).

## 분석

방문 수와 몇 가지 이벤트(재생, 레이어 켜고 끄기, 카드 열기, ISS 따라가기, 링크 복사)를 Google Analytics 4로 센다. 측정 ID는 빌드 때 `VITE_GA_ID`로 넣고, 없으면 분석 스크립트를 불러오지 않는다.

## 라이선스

코드는 [MIT](LICENSE). 지구 텍스처의 출처와 라이선스는 위에 적었다.
