# Planet Pulse — 설계

- 작성일: 2026-10-23
- 상태: 승인됨(브레인스토밍 4개 섹션), 구현 계획 전
- 목적: Flutter 기록 앱 위주인 포트폴리오에 **인터랙티브 웹 시각화**(WebGL·실시간 데이터·여러 공개 API 정규화)를 더한다.

## 1. 범위와 구조

**한 줄 정의**: 지난 7일간 지구에서 일어난 지진·로켓 발사·ISS 궤도를 3D 지구본 위에 겹쳐 보여주고, 시간 스크러버로 되감아 보는 웹 페이지.

### MVP 레이어

| 레이어 | 출처 (모두 키 없음, CORS `*` 확인 2026-10-23) | 표현 |
|---|---|---|
| 지진 | USGS `https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_week.geojson` (주 ~2,000건, 응답 `max-age=60`) | 규모별 크기·색 점, 발생 순간 링 |
| 발사 | Launch Library 2 `https://ll.thespacedevs.com/2.3.0/launches/{previous,upcoming}/` (익명 IP당 시간당 15회) | 발사장 기둥, 예정 발사 카운트다운 |
| ISS | Where the ISS at `https://api.wheretheiss.at/v1/satellites/25544/tles` → 브라우저에서 satellite.js로 위치 계산 | 현재 위치 + 앞뒤 45분 궤도선 |

### 범위 밖
항공기(OpenSky — 호출 한도로 캐시 서버 필요, MVP 이후), 로그인·저장, 모바일 앱, 라이트 모드.

### 구조
- **정적 웹, 서버 없음.** Vite + React + TypeScript, 지구본은 globe.gl(Three.js).
- 브라우저가 세 API를 직접 호출한다. LL2 응답은 `localStorage`에 1시간, TLE는 하루 캐시. LL2 한도는 IP 단위라 방문자별로 충분하다.
- ISS는 위치를 폴링하지 않고 TLE를 하루 1회 받아 임의 시각 `t`의 위치를 계산한다(되감기 지원).
- 세 출처를 공통 형식으로 맞춘다:
  ```ts
  type PulseEvent = {
    id: string;
    kind: 'quake' | 'launch';
    time: number;          // epoch ms
    lat: number; lng: number;
    magnitude?: number;    // 지진 규모
    status?: 'success' | 'failure' | 'upcoming';  // 발사
    label: string;
    url: string;           // 원문 링크
  };
  ```
  ISS는 이벤트가 아니라 `positionAt(t) → {lat, lng, altKm}` 함수로 넘긴다.

### 저장소·운영 (누렁소검은소와 같은 방식)
- 공개 레포 `teiresias22/planet-pulse`, 브랜치 `master` 하나, 커밋 메시지는 한국어 서술형 한 줄(`~한다`) + 본문에 이유.
- Vercel 배포(`master` push = 프로덕션), 주소 `planet-pulse.joon.is-a.dev`.
- 출시 후 `joon-dev-web/apps.config.json`과 `portfolio/content/`(resume·career ko/en)에 등록.

## 2. 구성 요소와 데이터 흐름

```
src/
  sources/usgs.ts       USGS GeoJSON → PulseEvent[]
  sources/launches.ts   LL2 지난·예정 발사 → PulseEvent[] (1시간 캐시)
  sources/iss.ts        TLE 받기(하루 캐시) + positionAt(t)
  lib/cache.ts          localStorage 읽기·쓰기, 만료 시각, 예외 시 무캐시
  lib/timeline.ts       순수 함수: 시각 t에 보일 이벤트, 투명도, 링 진행도
  Globe.tsx             globe.gl 래퍼 — 점·링·기둥·경로 레이어
  Scrubber.tsx          슬라이더, 재생/일시정지, 배속, "지금"
  Legend.tsx, EventCard.tsx
  App.tsx               상태 {t, playing, speed, layers, selected}
```

1. 첫 로드에 세 출처를 병렬로 부른다(`Promise.allSettled`). 하나가 실패해도 나머지는 그린다.
2. 시각 `t` 하나가 화면 전체를 움직인다. 지진은 `time ≤ t`만, 오래될수록 흐리게. ISS는 `positionAt(t)`와 `t±45분` 궤도선.
3. 스크러버 범위: `지금−7일` ~ `지금+7일`(미래 구간은 예정 발사만 의미가 있다).
4. 기본은 **라이브 모드**(`t = 지금`). USGS를 5분마다 다시 받아 새 지진이면 링을 띄운다.
5. 상태는 URL 해시(`#t=<epoch>&layers=quake,launch,iss`)에 담아 순간 공유가 가능하다.

**성능**: 지진 점은 globe.gl `pointsMerge`로 단일 메시. 재생 중에는 `t`가 바뀔 때만 레이어 데이터를 갱신한다.

## 3. 화면과 인터랙션

### 레이아웃
- 데스크톱: 지구본 전체 화면. 상단 = 제목·라이브 표시·레이어 토글, 우측 = 상세 카드, 좌하단 = 범례, 하단 = 스크러버(지금 위치 표시, 오른쪽은 예정 구간).
- 모바일(375px): 토글은 아이콘만, 상세 카드는 하단 시트, 범례 접기, 스크러버 터치 높이 44px.

### 인터랙션
- 지구본: 드래그 회전, 휠·핀치 확대. 유휴 시 천천히 자동 회전, 조작하면 멈추고 10초 뒤 재개.
- 스크러버: 드래그 이동, ▶ 재생(배속 1시간/초 · 6시간/초 · 1일/초), "지금" 버튼으로 라이브 복귀. 키보드 ←→(±1시간), Space(재생).
- 지진: 규모별 크기 + 노랑→주황→빨강 단계(색약 대비 크기도 함께). 스크러버가 발생 시각을 지날 때 링.
- 발사: 성공·실패·예정을 **아이콘 모양**으로 구분(색만으로 구분 금지). 예정 발사는 카운트다운.
- ISS: 클릭 시 카메라 추적.
- 상세 카드: 장소, 시각(로컬 + UTC), 규모 또는 로켓·임무명, 원문 링크.
- 공유 버튼: 현재 해시 URL 복사.

### 톤·접근성·언어
- 어두운 우주 배경, 야간 위성 지구 텍스처, 반투명 패널, 고정폭 숫자. 다크 모드 단일.
- `prefers-reduced-motion`이면 자동 회전·링 애니메이션 끔.
- 한국어·영어 2개. `navigator.language`로 고르고, 문구는 객체 하나(i18n 라이브러리 없음).

## 4. 오류 처리와 테스트

### 오류 처리
| 상황 | 처리 |
|---|---|
| 출처 요청 실패·8초 타임아웃 | 해당 토글에 ⚠ + "다시 시도". 캐시가 있으면 쓰고 "N분 전 데이터" 표시 |
| LL2 429 | 캐시 유지, `Retry-After`까지 재요청 안 함. 캐시도 없으면 발사 레이어만 비우고 안내 |
| 응답 형식 이상 | 항목별 검사, 좌표·시각이 잘못된 항목만 버림 |
| TLE가 7일 초과 | 궤도선 점선 + "추정 위치". TLE 없음 → ISS 레이어만 끔 |
| `localStorage` 예외 | try/catch, 캐시 없이 동작 |
| WebGL 미지원 | 안내 문구 + 최근 지진·발사 텍스트 목록 |
| 탭 숨김(라이브) | 5분 주기 중단, 복귀 시 즉시 1회 갱신 |

### 테스트 (프레임워크 없이 `*.check.mjs`, `node --test`)
- `sources/*.check.mjs`: 실제 응답을 잘라 둔 `fixtures/`로 변환 결과 고정. 잘못된 항목 제외, 빈 응답 → 빈 배열.
- `lib/timeline.check.mjs`: 시각 `t`의 가시 이벤트, 7일 경계, 링 진행도 0→1.
- `sources/iss.check.mjs`: fixture TLE로 계산한 위치가 같은 시각 `/positions` 기준값(fixture)과 50km 이내.
- `lib/cache.check.mjs`: 만료, 저장소 예외.
- 실행: `node --test 'src/**/*.check.mjs'` — 패턴을 명시해야 한다(`node --test` 기본 탐색은 `*.check.mjs`를 안 집는다). 체크 파일은 Node 24 타입 제거로 `.ts`를 확장자째 import한다(누렁소검은소와 같음).
- CI: GitHub Actions, push마다 `npm run lint && npm run build && npm run check`. 배포는 Vercel.
- 출시 전 수동 확인: 데스크톱 Chrome·Safari, 모바일 375px, 오프라인, reduced-motion. README용 15초 데모 GIF.
