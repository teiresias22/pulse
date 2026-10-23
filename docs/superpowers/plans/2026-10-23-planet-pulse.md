# Planet Pulse Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 지난 7일간의 지진·로켓 발사·ISS 궤도를 3D 지구본에 겹쳐 보여주고 시간 스크러버로 되감는 정적 웹 페이지를 만든다.

**Architecture:** 서버 없는 Vite + React 앱. 브라우저가 키 없는 공개 API 3개(USGS, Launch Library 2, Where the ISS at)를 직접 부르고, 출처마다 순수 변환 함수로 `PulseEvent[]`를 만든다. ISS는 TLE 한 번으로 satellite.js가 임의 시각의 위치를 계산한다. 시각 `t` 하나가 화면 전체를 움직이고, globe.gl이 Three.js로 그린다.

**Tech Stack:** Node 24, Vite 8, React 19, TypeScript(템플릿 기본), oxlint(템플릿 기본), globe.gl 2.46, satellite.js 7.1, `node:test`(프레임워크 없음), GitHub Actions, Vercel.

**Spec:** `docs/superpowers/specs/2026-10-23-planet-pulse-design.md`

## Global Constraints

- 레포 `teiresias22/planet-pulse`(공개), 브랜치 `master` 하나. 커밋 메시지는 한국어 서술형 한 줄(`~한다`) + 본문에 이유, 끝에 `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- 서버·DB·API 키 없음. 외부 호출은 아래 3개뿐:
  - `https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_week.geojson`
  - `https://ll.thespacedevs.com/2.3.0/launches/{previous,upcoming}/` (익명 IP당 시간당 15회)
  - `https://api.wheretheiss.at/v1/satellites/25544/tles`
- 캐시: LL2 1시간, TLE 1일, USGS 60초. 모든 `localStorage` 접근은 try/catch.
- 요청 타임아웃 8초. 한 출처의 실패가 다른 레이어를 막지 않는다.
- 시간 창: `지금−7일` ~ `지금+7일`. 지진 링 3시간(시뮬레이션 시각 기준), ISS 궤도선 `t±45분`.
- 색만으로 구분하지 않는다(지진은 크기도, 발사는 기호 ▲ ✕ ◇).
- `prefers-reduced-motion`이면 자동 회전·링 애니메이션 끔. 다크 모드 하나. 한국어·영어 2개(`navigator.language`).
- `.ts` 파일끼리 import는 확장자 `.ts`를 붙인다(Node 24 타입 제거로 체크 파일이 그대로 읽는다). enum·namespace·생성자 매개변수 프로퍼티 금지(템플릿의 `erasableSyntaxOnly`).
- 테스트는 `src/**/*.check.mjs`, 실행은 `npm run check`(= `node --test 'src/**/*.check.mjs'`).

## File Structure

```
planet-pulse/
  index.html                       메타·제목
  package.json                     scripts: dev, build, lint, check, preview
  public/textures/                 earth-night.jpg, night-sky.png (three-globe 예제 이미지 복사)
  .github/workflows/ci.yml         lint + build + check
  README.md
  src/
    main.tsx                       진입점(템플릿)
    model.ts                       PulseEvent·Loaded·Selection 타입, 상수, isNum/validCoord
    i18n.ts                        msg(ko/en), fmtTime, fmtAgo, fmtCountdown
    lib/cache.ts                   cacheRead/cacheWrite/isFresh/withCache
    lib/cache.check.mjs
    lib/timeline.ts                visibleQuakes/visibleLaunches/quakeOpacity/ringProgress/activeRings/timeRange
    lib/timeline.check.mjs
    lib/hash.ts                    encodeHash/decodeHash
    lib/hash.check.mjs
    lib/style.ts                   quakeColor/quakeRadius/색 상수
    sources/http.ts                fetchJson, HttpError
    sources/usgs.ts                parseUsgs, loadQuakes
    sources/usgs.check.mjs
    sources/launches.ts            parseLaunches, mapStatus, retryAfterUntil, loadLaunches
    sources/launches.check.mjs
    sources/iss.ts                 parseTle, makePropagator, orbitPath, isTleStale, loadTle
    sources/iss.check.mjs
    sources/fixtures/              usgs.json, ll2.json, tle.json
    components/GlobeView.tsx       globe.gl 래퍼
    components/Header.tsx          제목·라이브·레이어 토글(⚠/다시 시도/N분 전)·공유
    components/Scrubber.tsx        range 입력·재생·배속·지금
    components/Legend.tsx
    components/EventCard.tsx
    components/Fallback.tsx        WebGL 미지원 시 텍스트 목록
    App.tsx                        상태·데이터 로드·재생 루프·해시 동기화·키보드
    App.css                        전체 스타일(토큰, 모바일 미디어쿼리)
```

설계에서 바뀐 점 하나: 설계 2/4의 `pointsMerge`는 쓰지 않는다. 합친 메시는 점 클릭(`onPointClick`)이 안 되기 때문이다. 대신 이벤트 객체를 그대로 재사용하고 색은 accessor가 `tRef`를 읽게 해서, globe.gl이 기존 메시를 다시 쓰게 한다. 재생 중 `t` 갱신은 초당 10회로 제한한다. Task 1에서 설계 문서의 해당 줄도 고친다.

---

### Task 1: 프로젝트 뼈대 + 공통 타입 + 캐시

**Files:**
- Create: 템플릿 파일 전체(Vite react-ts), `src/model.ts`, `src/lib/cache.ts`, `src/lib/cache.check.mjs`, `public/textures/*`, `.github/workflows/ci.yml`
- Modify: `package.json`(scripts·name), `index.html`, `src/App.tsx`(빈 화면), `docs/superpowers/specs/2026-10-23-planet-pulse-design.md`(pointsMerge 줄)
- Delete: `src/App.css`·`src/index.css`·`src/assets/`·`public/` 템플릿 기본 파일(아이콘 등)

**Interfaces:**
- Produces:
  - `model.ts`: `type LaunchStatus = 'success' | 'failure' | 'upcoming'`, `type PulseEvent`, `type LayerKey = 'quake' | 'launch' | 'iss'`, `const LAYERS: LayerKey[]`, `const MINUTE, HOUR, DAY: number`, `type Loaded<T> = { value: T; fetchedAt: number; stale: boolean }`, `type Selection = { kind: 'event'; event: PulseEvent } | { kind: 'iss' }`, `isNum(x: unknown): x is number`, `validCoord(lat: number, lng: number): boolean`
  - `lib/cache.ts`: `cacheRead<T>(key, storage?) → { savedAt: number; value: T } | null`, `cacheWrite<T>(key, value, now, storage?) → void`, `isFresh(entry, maxAgeMs, now) → boolean`, `withCache<T>(key, maxAgeMs, now, fetcher: () => Promise<T>, storage?) → Promise<Loaded<T>>`

- [ ] **Step 1: Vite 템플릿을 옆 폴더에 만들고 레포로 복사**

레포 폴더에는 이미 `.git`과 `docs/`가 있어서 `create-vite`가 대화형으로 묻는다. 옆에 만들고 복사한다.

```bash
cd /Users/junhookim/github/teiresias
npm create vite@latest planet-pulse-scaffold -- --template react-ts </dev/null
rsync -a planet-pulse-scaffold/ planet-pulse/
rm -rf planet-pulse-scaffold
cd planet-pulse
rm -rf src/assets src/App.css src/index.css public/*
npm install
npm install globe.gl@2.46.2 satellite.js@7.1.0
mkdir -p public/textures
cp node_modules/three-globe/example/img/earth-night.jpg node_modules/three-globe/example/img/night-sky.png public/textures/
```

Expected: `public/textures/`에 두 이미지, `package.json` dependencies에 `globe.gl`, `satellite.js`.

- [ ] **Step 2: package.json 정리**

`name`을 `planet-pulse`로 바꾸고 scripts를 아래로 맞춘다(나머지 필드는 템플릿 그대로).

```json
"scripts": {
  "dev": "vite",
  "build": "tsc -b && vite build",
  "lint": "oxlint",
  "check": "node --test 'src/**/*.check.mjs'",
  "preview": "vite preview"
}
```

- [ ] **Step 3: index.html과 빈 App**

`index.html` 전체:

```html
<!doctype html>
<html lang="ko">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="description" content="지난 7일간 지구의 지진·로켓 발사·ISS 궤도를 3D 지구본에서 되감아 본다." />
    <meta name="theme-color" content="#05070d" />
    <title>Planet Pulse</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

`src/main.tsx`에서 `import './index.css'` 줄을 지운다. `src/App.tsx` 전체:

```tsx
export default function App() {
  return <main>Planet Pulse</main>;
}
```

- [ ] **Step 4: model.ts 작성**

`src/model.ts`:

```ts
export type LaunchStatus = 'success' | 'failure' | 'upcoming';

export type PulseEvent = {
  id: string;
  kind: 'quake' | 'launch';
  time: number; // epoch ms
  lat: number;
  lng: number;
  magnitude?: number;
  status?: LaunchStatus;
  label: string;
  url: string;
};

export type LayerKey = 'quake' | 'launch' | 'iss';
export const LAYERS: LayerKey[] = ['quake', 'launch', 'iss'];

export const MINUTE = 60_000;
export const HOUR = 60 * MINUTE;
export const DAY = 24 * HOUR;

// stale = 새로 받지 못해 예전 캐시를 돌려준 경우
export type Loaded<T> = { value: T; fetchedAt: number; stale: boolean };

export type Selection = { kind: 'event'; event: PulseEvent } | { kind: 'iss' };

export function isNum(x: unknown): x is number {
  return typeof x === 'number' && Number.isFinite(x);
}

export function validCoord(lat: number, lng: number): boolean {
  return Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
}
```

- [ ] **Step 5: 캐시 체크 작성(실패 확인용)**

`src/lib/cache.check.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cacheRead, cacheWrite, isFresh, withCache } from './cache.ts';

function memStorage() {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => void m.set(k, String(v)),
  };
}
function throwingStorage() {
  const boom = () => {
    throw new Error('SecurityError');
  };
  return { getItem: boom, setItem: boom };
}

test('쓴 값을 savedAt과 함께 읽는다', () => {
  const s = memStorage();
  cacheWrite('k', { a: 1 }, 1000, s);
  assert.deepEqual(cacheRead('k', s), { savedAt: 1000, value: { a: 1 } });
});

test('없는 키·깨진 JSON은 null', () => {
  const s = memStorage();
  assert.equal(cacheRead('none', s), null);
  s.setItem('bad', '{not json');
  assert.equal(cacheRead('bad', s), null);
});

test('isFresh: maxAge 안이면 true, 경계와 그 뒤는 false', () => {
  const e = { savedAt: 1000 };
  assert.equal(isFresh(e, 500, 1499), true);
  assert.equal(isFresh(e, 500, 1500), false);
  assert.equal(isFresh(null, 500, 1000), false);
});

test('저장소가 예외를 던져도 읽기는 null, 쓰기는 조용히 무시', () => {
  const s = throwingStorage();
  assert.equal(cacheRead('k', s), null);
  assert.doesNotThrow(() => cacheWrite('k', 1, 0, s));
});

test('withCache: 신선한 캐시면 fetcher를 부르지 않는다', async () => {
  const s = memStorage();
  cacheWrite('k', 'cached', 1000, s);
  let called = false;
  const r = await withCache('k', 500, 1200, async () => ((called = true), 'fresh'), s);
  assert.equal(called, false);
  assert.deepEqual(r, { value: 'cached', fetchedAt: 1000, stale: false });
});

test('withCache: 만료면 새로 받고 저장한다', async () => {
  const s = memStorage();
  cacheWrite('k', 'old', 1000, s);
  const r = await withCache('k', 500, 2000, async () => 'new', s);
  assert.deepEqual(r, { value: 'new', fetchedAt: 2000, stale: false });
  assert.equal(cacheRead('k', s).value, 'new');
});

test('withCache: 받기 실패 시 예전 캐시를 stale로 돌려준다', async () => {
  const s = memStorage();
  cacheWrite('k', 'old', 1000, s);
  const r = await withCache('k', 500, 2000, async () => {
    throw new Error('net');
  }, s);
  assert.deepEqual(r, { value: 'old', fetchedAt: 1000, stale: true });
});

test('withCache: 실패하고 캐시도 없으면 예외를 그대로 던진다', async () => {
  await assert.rejects(
    withCache('k', 500, 2000, async () => {
      throw new Error('net');
    }, memStorage()),
    /net/,
  );
});

test('withCache: 저장소가 없어도(null) 동작한다', async () => {
  const r = await withCache('k', 500, 2000, async () => 'v', null);
  assert.deepEqual(r, { value: 'v', fetchedAt: 2000, stale: false });
});
```

- [ ] **Step 6: 실패 확인**

Run: `npm run check`
Expected: FAIL — `Cannot find module '.../src/lib/cache.ts'`

- [ ] **Step 7: cache.ts 구현**

`src/lib/cache.ts`:

```ts
import type { Loaded } from '../model.ts';

type Entry<T> = { savedAt: number; value: T };
type KV = Pick<Storage, 'getItem' | 'setItem'>;

function defaultStorage(): KV | null {
  // 사생활 보호 모드·차단된 사이트 데이터에서는 접근 자체가 던진다
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

export function cacheRead<T>(key: string, storage: KV | null = defaultStorage()): Entry<T> | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(key);
    if (!raw) return null;
    const entry = JSON.parse(raw) as Entry<T> | null;
    return typeof entry?.savedAt === 'number' ? entry : null;
  } catch {
    return null;
  }
}

export function cacheWrite<T>(key: string, value: T, now: number, storage: KV | null = defaultStorage()): void {
  if (!storage) return;
  try {
    storage.setItem(key, JSON.stringify({ savedAt: now, value }));
  } catch {
    // 용량 초과·쓰기 금지 — 캐시 없이 계속
  }
}

export function isFresh(entry: { savedAt: number } | null, maxAgeMs: number, now: number): boolean {
  return entry !== null && now - entry.savedAt < maxAgeMs;
}

export async function withCache<T>(
  key: string,
  maxAgeMs: number,
  now: number,
  fetcher: () => Promise<T>,
  storage: KV | null = defaultStorage(),
): Promise<Loaded<T>> {
  const cached = cacheRead<T>(key, storage);
  if (cached && isFresh(cached, maxAgeMs, now)) {
    return { value: cached.value, fetchedAt: cached.savedAt, stale: false };
  }
  try {
    const value = await fetcher();
    cacheWrite(key, value, now, storage);
    return { value, fetchedAt: now, stale: false };
  } catch (err) {
    if (cached) return { value: cached.value, fetchedAt: cached.savedAt, stale: true };
    throw err;
  }
}
```

- [ ] **Step 8: 통과 확인**

Run: `npm run check && npm run lint && npm run build`
Expected: 9 tests pass, lint 0 errors, `dist/` 생성.

- [ ] **Step 9: CI 워크플로**

`.github/workflows/ci.yml`:

```yaml
name: ci
on:
  push:
    branches: [master]
  pull_request:
jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 24
          cache: npm
      - run: npm ci
      - run: npm run lint
      - run: npm run build
      - run: npm run check
```

- [ ] **Step 10: 설계 문서의 pointsMerge 줄 고치기**

`docs/superpowers/specs/2026-10-23-planet-pulse-design.md`에서

```
**성능**: 지진 점은 globe.gl `pointsMerge`로 단일 메시. 재생 중에는 `t`가 바뀔 때만 레이어 데이터를 갱신한다.
```

를 아래로 바꾼다.

```
**성능**: `pointsMerge`는 점 클릭이 안 돼서 쓰지 않는다. 이벤트 객체를 재사용하고 색 accessor가 현재 `t`를 읽어 globe.gl이 기존 메시를 다시 쓰게 한다. 재생 중 `t` 갱신은 초당 10회로 제한한다.
```

- [ ] **Step 11: 커밋**

```bash
git add -A
git commit -m "Vite 뼈대와 공통 타입·캐시를 추가한다" -m "출처 3개가 같은 캐시 규칙(신선하면 재사용, 실패하면 예전 값)을 쓰도록 withCache 하나로 모은다. pointsMerge는 클릭이 안 돼 설계에서 뺀다.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: HTTP 헬퍼 + USGS 지진 출처

**Files:**
- Create: `src/sources/http.ts`, `src/sources/usgs.ts`, `src/sources/fixtures/usgs.json`, `src/sources/usgs.check.mjs`

**Interfaces:**
- Consumes: `PulseEvent`, `Loaded`, `isNum`, `validCoord`, `MINUTE`(model.ts), `withCache`(lib/cache.ts)
- Produces:
  - `http.ts`: `class HttpError extends Error { status: number; retryAfter: string | null }`, `fetchJson(url: string, timeoutMs?: number) → Promise<unknown>`
  - `usgs.ts`: `parseUsgs(json: unknown) → PulseEvent[]`, `loadQuakes(now?: number) → Promise<Loaded<PulseEvent[]>>`

- [ ] **Step 1: fixture 작성**

실제 응답(2026-10-23)의 필드 이름을 그대로 쓰고, 버려야 할 항목 3개(규모 null, 좌표 범위 밖, id 없음)를 섞는다. `src/sources/fixtures/usgs.json`:

```json
{
  "type": "FeatureCollection",
  "metadata": { "generated": 1792738748000, "count": 5 },
  "features": [
    {
      "type": "Feature",
      "id": "ci41350919",
      "properties": {
        "mag": 0.73,
        "place": "13 km WSW of Searles Valley, CA",
        "time": 1792739784220,
        "url": "https://earthquake.usgs.gov/earthquakes/eventpage/ci41350919",
        "title": "M 0.7 - 13 km WSW of Searles Valley, CA"
      },
      "geometry": { "type": "Point", "coordinates": [-117.536666666667, 35.7268333333333, 2.44] }
    },
    {
      "type": "Feature",
      "id": "us7000abcd",
      "properties": {
        "mag": 5.6,
        "place": "south of the Kermadec Islands",
        "time": 1792700000000,
        "url": "https://earthquake.usgs.gov/earthquakes/eventpage/us7000abcd",
        "title": "M 5.6 - south of the Kermadec Islands"
      },
      "geometry": { "type": "Point", "coordinates": [-178.2, -32.1, 35] }
    },
    {
      "type": "Feature",
      "id": "nullmag1",
      "properties": { "mag": null, "place": "x", "time": 1792700000000, "url": "u" },
      "geometry": { "type": "Point", "coordinates": [10, 10, 1] }
    },
    {
      "type": "Feature",
      "id": "badcoord",
      "properties": { "mag": 2, "place": "x", "time": 1792700000000, "url": "u" },
      "geometry": { "type": "Point", "coordinates": [200, 10, 1] }
    },
    {
      "type": "Feature",
      "properties": { "mag": 2, "place": "no id", "time": 1792700000000, "url": "u" },
      "geometry": { "type": "Point", "coordinates": [10, 10, 1] }
    }
  ]
}
```

- [ ] **Step 2: 체크 작성**

`src/sources/usgs.check.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseUsgs } from './usgs.ts';

const fixture = JSON.parse(readFileSync(new URL('./fixtures/usgs.json', import.meta.url), 'utf8'));

test('정상 항목을 PulseEvent로 바꾼다(GeoJSON은 [lng, lat] 순서)', () => {
  const events = parseUsgs(fixture);
  assert.deepEqual(events[0], {
    id: 'ci41350919',
    kind: 'quake',
    time: 1792739784220,
    lat: 35.7268333333333,
    lng: -117.536666666667,
    magnitude: 0.73,
    label: '13 km WSW of Searles Valley, CA',
    url: 'https://earthquake.usgs.gov/earthquakes/eventpage/ci41350919',
  });
});

test('규모 null·좌표 범위 밖·id 없는 항목만 버린다', () => {
  assert.deepEqual(
    parseUsgs(fixture).map((e) => e.id),
    ['ci41350919', 'us7000abcd'],
  );
});

test('형식이 다르면 빈 배열', () => {
  assert.deepEqual(parseUsgs(null), []);
  assert.deepEqual(parseUsgs({ features: 'nope' }), []);
  assert.deepEqual(parseUsgs({ features: [null, 1, {}] }), []);
});
```

- [ ] **Step 3: 실패 확인**

Run: `npm run check`
Expected: FAIL — `Cannot find module '.../src/sources/usgs.ts'`

- [ ] **Step 4: http.ts 구현**

`src/sources/http.ts`:

```ts
export class HttpError extends Error {
  status: number;
  retryAfter: string | null;

  constructor(status: number, retryAfter: string | null) {
    super(`HTTP ${status}`);
    this.status = status;
    this.retryAfter = retryAfter;
  }
}

export async function fetchJson(url: string, timeoutMs = 8000): Promise<unknown> {
  const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
  // Retry-After는 CORS 노출 헤더가 아니면 null로 읽힌다 — 호출 쪽이 기본값을 둔다
  if (!res.ok) throw new HttpError(res.status, res.headers.get('Retry-After'));
  return res.json();
}
```

- [ ] **Step 5: usgs.ts 구현**

`src/sources/usgs.ts`:

```ts
import { isNum, MINUTE, validCoord, type Loaded, type PulseEvent } from '../model.ts';
import { withCache } from '../lib/cache.ts';
import { fetchJson } from './http.ts';

const URL = 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_week.geojson';

type Feature = {
  id?: unknown;
  properties?: { mag?: unknown; time?: unknown; place?: unknown; title?: unknown; url?: unknown };
  geometry?: { coordinates?: unknown };
};

export function parseUsgs(json: unknown): PulseEvent[] {
  const features = (json as { features?: unknown } | null)?.features;
  if (!Array.isArray(features)) return [];
  const out: PulseEvent[] = [];
  for (const f of features as (Feature | null)[]) {
    const p = f?.properties;
    const c = f?.geometry?.coordinates;
    if (!f || !p || !Array.isArray(c) || typeof f.id !== 'string') continue;
    const [lng, lat] = c as unknown[];
    if (!isNum(lat) || !isNum(lng) || !validCoord(lat, lng)) continue;
    if (!isNum(p.time) || !isNum(p.mag)) continue;
    out.push({
      id: f.id,
      kind: 'quake',
      time: p.time,
      lat,
      lng,
      magnitude: p.mag,
      label: String(p.place ?? p.title ?? ''),
      url: String(p.url ?? ''),
    });
  }
  return out;
}

export function loadQuakes(now = Date.now()): Promise<Loaded<PulseEvent[]>> {
  // USGS가 60초 캐시를 쓰니 그보다 자주 받을 이유가 없다
  return withCache('pp:quakes', MINUTE, now, async () => parseUsgs(await fetchJson(URL)));
}
```

- [ ] **Step 6: 통과 확인**

Run: `npm run check && npm run lint && npm run build`
Expected: 12 tests pass, lint·build 통과.

- [ ] **Step 7: 커밋**

```bash
git add -A
git commit -m "USGS 지진 피드를 PulseEvent로 바꾸는 출처를 추가한다" -m "잘못된 항목은 그 항목만 버려 목록 전체를 살린다. 타임아웃 8초는 fetchJson 한 곳에 둔다.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Launch Library 2 발사 출처

**Files:**
- Create: `src/sources/launches.ts`, `src/sources/fixtures/ll2.json`, `src/sources/launches.check.mjs`

**Interfaces:**
- Consumes: `PulseEvent`, `LaunchStatus`, `Loaded`, `isNum`, `validCoord`, `HOUR`, `DAY`(model.ts), `withCache`, `cacheRead`, `cacheWrite`(lib/cache.ts), `fetchJson`, `HttpError`(sources/http.ts)
- Produces: `mapStatus(statusId: unknown, time: number, now: number) → LaunchStatus | null`, `parseLaunches(json: unknown, now: number) → PulseEvent[]`, `retryAfterUntil(header: string | null, now: number) → number`, `loadLaunches(now?: number) → Promise<Loaded<PulseEvent[]>>`

LL2 상태 id(2026-10-23 응답 기준): 1 Go, 2 TBD, 3 Success, 4 Failure, 5 Hold, 6 In Flight, 7 Partial Failure, 8 TBC.

- [ ] **Step 1: fixture 작성**

`src/sources/fixtures/ll2.json` (실제 필드 이름, 4건 + 좌표 없는 1건):

```json
{
  "count": 5,
  "results": [
    {
      "id": "7766f3bb-674c-4c71-b986-963bd633fcfe",
      "url": "https://ll.thespacedevs.com/2.3.0/launches/7766f3bb-674c-4c71-b986-963bd633fcfe/",
      "name": "Electron | We're Not Hawking Around (3x HawkEye 360)",
      "net": "2026-10-23T07:11:00Z",
      "status": { "id": 6, "abbrev": "In Flight" },
      "pad": {
        "name": "Rocket Lab Launch Complex 1A",
        "latitude": -39.262833,
        "longitude": 177.864469,
        "location": { "name": "Rocket Lab Launch Complex 1, Mahia Peninsula, New Zealand" }
      }
    },
    {
      "id": "fail-1",
      "url": "https://ll.thespacedevs.com/2.3.0/launches/fail-1/",
      "name": "Rocket X | Demo",
      "net": "2026-10-20T00:00:00Z",
      "status": { "id": 4, "abbrev": "Failure" },
      "pad": { "latitude": "28.5", "longitude": "-80.6", "location": { "name": "Cape Canaveral, FL, USA" } }
    },
    {
      "id": "future-1",
      "url": "https://ll.thespacedevs.com/2.3.0/launches/future-1/",
      "name": "Falcon 9 | Starlink",
      "net": "2026-10-26T12:00:00Z",
      "status": { "id": 1, "abbrev": "Go" },
      "pad": { "latitude": 28.56, "longitude": -80.57, "location": { "name": "Kennedy Space Center, FL, USA" } }
    },
    {
      "id": "past-tbd",
      "url": "u",
      "name": "Mystery | ?",
      "net": "2026-10-18T00:00:00Z",
      "status": { "id": 2, "abbrev": "TBD" },
      "pad": { "latitude": 0, "longitude": 0, "location": { "name": "Nowhere" } }
    },
    {
      "id": "no-pad",
      "url": "u",
      "name": "No pad",
      "net": "2026-10-21T00:00:00Z",
      "status": { "id": 3, "abbrev": "Success" },
      "pad": { "latitude": null, "longitude": null }
    }
  ]
}
```

- [ ] **Step 2: 체크 작성**

`src/sources/launches.check.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { mapStatus, parseLaunches, retryAfterUntil } from './launches.ts';

const fixture = JSON.parse(readFileSync(new URL('./fixtures/ll2.json', import.meta.url), 'utf8'));
const NOW = Date.parse('2026-10-23T09:00:00Z');

test('mapStatus: 성공·비행중=success, 실패·부분실패=failure, 나머지는 미래면 upcoming', () => {
  assert.equal(mapStatus(3, NOW - 1, NOW), 'success');
  assert.equal(mapStatus(6, NOW - 1, NOW), 'success');
  assert.equal(mapStatus(4, NOW - 1, NOW), 'failure');
  assert.equal(mapStatus(7, NOW - 1, NOW), 'failure');
  assert.equal(mapStatus(1, NOW + 1, NOW), 'upcoming');
  assert.equal(mapStatus(2, NOW - 1, NOW), null); // 지났는데 결과 모름 → 그리지 않는다
});

test('정상 항목을 PulseEvent로 바꾼다(문자열 좌표도 숫자로)', () => {
  const events = parseLaunches(fixture, NOW);
  assert.deepEqual(events[0], {
    id: '7766f3bb-674c-4c71-b986-963bd633fcfe',
    kind: 'launch',
    time: Date.parse('2026-10-23T07:11:00Z'),
    lat: -39.262833,
    lng: 177.864469,
    status: 'success',
    label: "Electron | We're Not Hawking Around (3x HawkEye 360) · Rocket Lab Launch Complex 1, Mahia Peninsula, New Zealand",
    url: 'https://ll.thespacedevs.com/2.3.0/launches/7766f3bb-674c-4c71-b986-963bd633fcfe/',
  });
  assert.equal(events[1].lat, 28.5);
});

test('결과 모르는 과거 발사·좌표 없는 발사는 버린다', () => {
  assert.deepEqual(
    parseLaunches(fixture, NOW).map((e) => [e.id, e.status]),
    [
      ['7766f3bb-674c-4c71-b986-963bd633fcfe', 'success'],
      ['fail-1', 'failure'],
      ['future-1', 'upcoming'],
    ],
  );
});

test('형식이 다르면 빈 배열', () => {
  assert.deepEqual(parseLaunches(null, NOW), []);
  assert.deepEqual(parseLaunches({ results: [null, {}] }, NOW), []);
});

test('retryAfterUntil: 초·HTTP 날짜·없음(기본 1시간)', () => {
  assert.equal(retryAfterUntil('120', NOW), NOW + 120_000);
  assert.equal(retryAfterUntil('Fri, 23 Oct 2026 10:00:00 GMT', NOW), Date.parse('2026-10-23T10:00:00Z'));
  assert.equal(retryAfterUntil(null, NOW), NOW + 3_600_000);
  assert.equal(retryAfterUntil('garbage', NOW), NOW + 3_600_000);
});
```

- [ ] **Step 3: 실패 확인**

Run: `npm run check`
Expected: FAIL — `Cannot find module '.../src/sources/launches.ts'`

- [ ] **Step 4: launches.ts 구현**

`src/sources/launches.ts`:

```ts
import { DAY, HOUR, isNum, validCoord, type LaunchStatus, type Loaded, type PulseEvent } from '../model.ts';
import { cacheRead, cacheWrite, withCache } from '../lib/cache.ts';
import { fetchJson, HttpError } from './http.ts';

const BASE = 'https://ll.thespacedevs.com/2.3.0/launches';
const KEY = 'pp:launches';
const BLOCK_KEY = 'pp:launches:blockedUntil';

type Launch = {
  id?: unknown;
  url?: unknown;
  name?: unknown;
  net?: unknown;
  status?: { id?: unknown } | null;
  pad?: { latitude?: unknown; longitude?: unknown; location?: { name?: unknown } | null } | null;
};

export function mapStatus(statusId: unknown, time: number, now: number): LaunchStatus | null {
  if (statusId === 3 || statusId === 6) return 'success';
  if (statusId === 4 || statusId === 7) return 'failure';
  return time > now ? 'upcoming' : null;
}

export function parseLaunches(json: unknown, now: number): PulseEvent[] {
  const results = (json as { results?: unknown } | null)?.results;
  if (!Array.isArray(results)) return [];
  const out: PulseEvent[] = [];
  for (const r of results as (Launch | null)[]) {
    if (!r || typeof r.id !== 'string' || typeof r.net !== 'string') continue;
    // 예전 응답은 좌표를 문자열로 준다. null은 Number()가 0으로 바꾸니 먼저 거른다
    if (r.pad?.latitude == null || r.pad?.longitude == null) continue;
    const lat = Number(r.pad.latitude);
    const lng = Number(r.pad.longitude);
    const time = Date.parse(r.net);
    if (!isNum(lat) || !isNum(lng) || !validCoord(lat, lng) || !isNum(time)) continue;
    const status = mapStatus(r.status?.id, time, now);
    if (!status) continue;
    const place = r.pad.location?.name;
    out.push({
      id: r.id,
      kind: 'launch',
      time,
      lat,
      lng,
      status,
      label: place ? `${String(r.name)} · ${String(place)}` : String(r.name),
      url: String(r.url ?? ''),
    });
  }
  return out;
}

export function retryAfterUntil(header: string | null, now: number): number {
  if (header) {
    const seconds = Number(header);
    if (isNum(seconds)) return now + seconds * 1000;
    const date = Date.parse(header);
    if (isNum(date)) return date;
  }
  return now + HOUR;
}

export function loadLaunches(now = Date.now()): Promise<Loaded<PulseEvent[]>> {
  return withCache(KEY, HOUR, now, async () => {
    const blocked = cacheRead<number>(BLOCK_KEY);
    if (blocked && blocked.value > now) throw new Error('rate-limited');
    const from = new Date(now - 7 * DAY).toISOString();
    const to = new Date(now + 7 * DAY).toISOString();
    try {
      const [prev, next] = await Promise.all([
        fetchJson(`${BASE}/previous/?mode=normal&limit=100&net__gte=${from}`),
        fetchJson(`${BASE}/upcoming/?mode=normal&limit=100&net__lte=${to}`),
      ]);
      return [...parseLaunches(prev, now), ...parseLaunches(next, now)];
    } catch (err) {
      if (err instanceof HttpError && err.status === 429) {
        cacheWrite(BLOCK_KEY, retryAfterUntil(err.retryAfter, now), now);
      }
      throw err;
    }
  });
}
```

- [ ] **Step 5: 통과 확인**

Run: `npm run check && npm run lint && npm run build`
Expected: 17 tests pass, lint·build 통과.

- [ ] **Step 6: 커밋**

```bash
git add -A
git commit -m "Launch Library 2 발사 출처를 추가한다" -m "익명 한도가 IP당 시간당 15회라 1시간 캐시하고, 429를 받으면 Retry-After(없으면 1시간)까지 다시 부르지 않는다. 지났는데 결과를 모르는 발사는 성공으로 오인하지 않게 버린다.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: ISS 궤도 계산

**Files:**
- Create: `src/sources/iss.ts`, `src/sources/fixtures/tle.json`, `src/sources/iss.check.mjs`

**Interfaces:**
- Consumes: `Loaded`, `isNum`, `DAY`, `MINUTE`(model.ts), `withCache`(lib/cache.ts), `fetchJson`(sources/http.ts)
- Produces: `type Tle = { line1: string; line2: string; epoch: number }`, `type IssPos = { lat: number; lng: number; altKm: number }`, `parseTle(json: unknown) → Tle | null`, `makePropagator(tle: Tle) → (t: number) => IssPos | null`, `orbitPath(positionAt, t: number, spanMs?: number, stepMs?: number) → IssPos[]`, `isTleStale(tle: Tle, now: number) → boolean`, `loadTle(now?: number) → Promise<Loaded<Tle>>`

- [ ] **Step 1: fixture 작성**

2026-10-23에 받은 실제 TLE와, 같은 시각(1792738861초)에 `/positions`가 돌려준 기준 위치. `src/sources/fixtures/tle.json`:

```json
{
  "tle": {
    "requested_timestamp": 1792738861,
    "tle_timestamp": 1792544939,
    "id": "25544",
    "name": "iss",
    "header": "ISS (ZARYA)",
    "line1": "1 25544U 98067A   26294.04791053  .00009575  00000+0  18188-3 0  9996",
    "line2": "2 25544  51.6327  37.2623 0006759 289.5321  70.4938 15.48967427591263"
  },
  "reference": {
    "timestamp": 1792738861,
    "latitude": -49.634666456546,
    "longitude": -178.66020860851,
    "altitude": 432.08358721968
  }
}
```

- [ ] **Step 2: 체크 작성**

`src/sources/iss.check.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { isTleStale, makePropagator, orbitPath, parseTle } from './iss.ts';

const { tle: raw, reference: ref } = JSON.parse(
  readFileSync(new URL('./fixtures/tle.json', import.meta.url), 'utf8'),
);

function km(a, b) {
  const R = 6371;
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLng = (b.lng - a.lng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

test('parseTle: 정상 응답 → epoch ms 포함', () => {
  assert.deepEqual(parseTle(raw), { line1: raw.line1, line2: raw.line2, epoch: 1792544939000 });
});

test('parseTle: 필드가 빠지면 null', () => {
  assert.equal(parseTle(null), null);
  assert.equal(parseTle({ line1: 'x' }), null);
  assert.equal(parseTle({ line1: 'x', line2: 'y', tle_timestamp: 'z' }), null);
});

test('계산 위치가 같은 시각 실제 위치와 50km 안', () => {
  const positionAt = makePropagator(parseTle(raw));
  const p = positionAt(ref.timestamp * 1000);
  assert.ok(p, 'propagate 결과가 있어야 한다');
  const d = km(p, { lat: ref.latitude, lng: ref.longitude });
  assert.ok(d < 50, `거리 ${d.toFixed(2)}km`);
  assert.ok(Math.abs(p.altKm - ref.altitude) < 5);
});

test('orbitPath: t±45분을 1분 간격으로 91개, 가운데가 t의 위치', () => {
  const positionAt = makePropagator(parseTle(raw));
  const t = ref.timestamp * 1000;
  const path = orbitPath(positionAt, t);
  assert.equal(path.length, 91);
  assert.deepEqual(path[45], positionAt(t));
});

test('isTleStale: epoch로부터 7일 넘으면 true', () => {
  const tle = parseTle(raw);
  const DAY = 86_400_000;
  assert.equal(isTleStale(tle, tle.epoch + 7 * DAY), false);
  assert.equal(isTleStale(tle, tle.epoch + 7 * DAY + 1), true);
});
```

- [ ] **Step 3: 실패 확인**

Run: `npm run check`
Expected: FAIL — `Cannot find module '.../src/sources/iss.ts'`

- [ ] **Step 4: iss.ts 구현**

`src/sources/iss.ts`:

```ts
import { degreesLat, degreesLong, eciToGeodetic, gstime, propagate, twoline2satrec } from 'satellite.js';
import { DAY, isNum, MINUTE, type Loaded } from '../model.ts';
import { withCache } from '../lib/cache.ts';
import { fetchJson } from './http.ts';

const URL = 'https://api.wheretheiss.at/v1/satellites/25544/tles';

export type Tle = { line1: string; line2: string; epoch: number };
export type IssPos = { lat: number; lng: number; altKm: number };

export function parseTle(json: unknown): Tle | null {
  const j = json as { line1?: unknown; line2?: unknown; tle_timestamp?: unknown } | null;
  if (typeof j?.line1 !== 'string' || typeof j.line2 !== 'string' || !isNum(j.tle_timestamp)) return null;
  return { line1: j.line1, line2: j.line2, epoch: j.tle_timestamp * 1000 };
}

export function makePropagator(tle: Tle): (t: number) => IssPos | null {
  const rec = twoline2satrec(tle.line1, tle.line2);
  return (t) => {
    const date = new Date(t);
    const pv = propagate(rec, date);
    if (!pv) return null;
    const geo = eciToGeodetic(pv.position, gstime(date));
    return { lat: degreesLat(geo.latitude), lng: degreesLong(geo.longitude), altKm: geo.height };
  };
}

export function orbitPath(
  positionAt: (t: number) => IssPos | null,
  t: number,
  spanMs = 45 * MINUTE,
  stepMs = MINUTE,
): IssPos[] {
  const out: IssPos[] = [];
  for (let s = t - spanMs; s <= t + spanMs; s += stepMs) {
    const p = positionAt(s);
    if (p) out.push(p);
  }
  return out;
}

export function isTleStale(tle: Tle, now: number): boolean {
  return now - tle.epoch > 7 * DAY;
}

export function loadTle(now = Date.now()): Promise<Loaded<Tle>> {
  return withCache('pp:tle', DAY, now, async () => {
    const tle = parseTle(await fetchJson(URL));
    if (!tle) throw new Error('bad tle');
    return tle;
  });
}
```

- [ ] **Step 5: 통과 확인**

Run: `npm run check && npm run lint && npm run build`
Expected: 22 tests pass. 거리 테스트는 실측 기준 0.001km 미만으로 나온다.

- [ ] **Step 6: 커밋**

```bash
git add -A
git commit -m "TLE로 ISS 위치를 브라우저에서 계산한다" -m "위치를 주기적으로 묻지 않고 하루 한 번 받은 TLE로 임의 시각을 계산해야 스크러버로 되감을 수 있다. 기준값은 같은 시각 wheretheiss /positions 응답이다.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: 타임라인·URL 해시·스타일 순수 함수

**Files:**
- Create: `src/lib/timeline.ts`, `src/lib/timeline.check.mjs`, `src/lib/hash.ts`, `src/lib/hash.check.mjs`, `src/lib/style.ts`

**Interfaces:**
- Consumes: `PulseEvent`, `LayerKey`, `LAYERS`, `HOUR`, `DAY`(model.ts)
- Produces:
  - `timeline.ts`: `const WINDOW_MS`(7일), `const RING_MS`(3시간), `timeRange(now) → { min: number; max: number }`, `visibleQuakes(events, t) → PulseEvent[]`, `visibleLaunches(events, t) → PulseEvent[]`, `quakeOpacity(e, t) → number`, `ringProgress(eventTime, t, windowMs?) → number | null`, `activeRings(quakes, t) → PulseEvent[]`
  - `hash.ts`: `type ViewState = { t: number | null; layers: LayerKey[] }`(t null = 라이브), `encodeHash(s) → string`, `decodeHash(hash) → ViewState`
  - `style.ts`: `quakeColor(mag, alpha) → string`, `quakeRadius(mag) → number`, `LAUNCH_COLOR`, `ISS_COLOR`, `RING_RGB`

- [ ] **Step 1: 체크 작성**

`src/lib/timeline.check.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  activeRings, quakeOpacity, ringProgress, RING_MS, timeRange, visibleLaunches, visibleQuakes, WINDOW_MS,
} from './timeline.ts';

const H = 3_600_000;
const T = 1_800_000_000_000;
const q = (id, time, magnitude = 3) => ({ id, kind: 'quake', time, lat: 0, lng: 0, magnitude, label: id, url: '' });
const l = (id, time, status) => ({ id, kind: 'launch', time, lat: 0, lng: 0, status, label: id, url: '' });

test('timeRange: 지금 ±7일', () => {
  assert.deepEqual(timeRange(T), { min: T - WINDOW_MS, max: T + WINDOW_MS });
  assert.equal(WINDOW_MS, 7 * 24 * H);
});

test('visibleQuakes: t 이하이고 7일 창 안만', () => {
  const evs = [q('future', T + 1), q('now', T), q('edge', T - WINDOW_MS), q('in', T - WINDOW_MS + 1)];
  assert.deepEqual(visibleQuakes(evs, T).map((e) => e.id), ['now', 'in']);
});

test('visibleQuakes: 발사는 섞이지 않는다', () => {
  assert.deepEqual(visibleQuakes([l('x', T - 1, 'success')], T), []);
});

test('visibleLaunches: 예정은 항상, 나머지는 t 이하만', () => {
  const evs = [l('up', T + H, 'upcoming'), l('done', T - H, 'success'), l('later', T + H, 'success')];
  assert.deepEqual(visibleLaunches(evs, T).map((e) => e.id), ['up', 'done']);
});

test('quakeOpacity: 막 생기면 1, 7일 지나면 하한 0.15', () => {
  assert.equal(quakeOpacity(q('a', T), T), 1);
  assert.equal(quakeOpacity(q('a', T - WINDOW_MS / 2), T), 0.5);
  assert.equal(quakeOpacity(q('a', T - WINDOW_MS), T), 0.15);
});

test('ringProgress: 발생 순간 0 → 3시간 뒤 직전까지 1 미만, 밖이면 null', () => {
  assert.equal(RING_MS, 3 * H);
  assert.equal(ringProgress(T, T), 0);
  assert.equal(ringProgress(T, T + RING_MS / 2), 0.5);
  assert.equal(ringProgress(T, T + RING_MS), null);
  assert.equal(ringProgress(T, T - 1), null);
});

test('activeRings: 규모 2.5 이상이고 링 창 안인 지진만', () => {
  const evs = [q('big', T - H, 4), q('small', T - H, 1.2), q('old', T - 4 * H, 5)];
  assert.deepEqual(activeRings(evs, T).map((e) => e.id), ['big']);
});
```

`src/lib/hash.check.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decodeHash, encodeHash } from './hash.ts';

test('라이브(t=null)는 t를 빼고 레이어만 담는다', () => {
  assert.equal(encodeHash({ t: null, layers: ['quake', 'iss'] }), '#layers=quake%2Ciss');
});

test('왕복: 인코딩한 값을 그대로 되읽는다', () => {
  const s = { t: 1792738861000, layers: ['launch'] };
  assert.deepEqual(decodeHash(encodeHash(s)), s);
});

test('빈 해시 → 라이브 + 전체 레이어', () => {
  assert.deepEqual(decodeHash(''), { t: null, layers: ['quake', 'launch', 'iss'] });
});

test('잘못된 t는 라이브, 모르는 레이어는 버리고 순서는 정해진 순서로', () => {
  assert.deepEqual(decodeHash('#t=abc&layers=iss,bogus,quake'), { t: null, layers: ['quake', 'iss'] });
});

test('layers= 가 비어 있으면 레이어 없음(전부 끈 상태도 공유 가능)', () => {
  assert.deepEqual(decodeHash('#layers='), { t: null, layers: [] });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npm run check`
Expected: FAIL — `Cannot find module '.../src/lib/timeline.ts'`, `.../src/lib/hash.ts`

- [ ] **Step 3: timeline.ts 구현**

`src/lib/timeline.ts`:

```ts
import { DAY, HOUR, type PulseEvent } from '../model.ts';

export const WINDOW_MS = 7 * DAY;
export const RING_MS = 3 * HOUR;

export function timeRange(now: number): { min: number; max: number } {
  return { min: now - WINDOW_MS, max: now + WINDOW_MS };
}

export function visibleQuakes(events: PulseEvent[], t: number): PulseEvent[] {
  return events.filter((e) => e.kind === 'quake' && e.time <= t && e.time > t - WINDOW_MS);
}

export function visibleLaunches(events: PulseEvent[], t: number): PulseEvent[] {
  return events.filter((e) => e.kind === 'launch' && (e.status === 'upcoming' || e.time <= t));
}

export function quakeOpacity(e: PulseEvent, t: number): number {
  return Math.max(0.15, 1 - (t - e.time) / WINDOW_MS);
}

export function ringProgress(eventTime: number, t: number, windowMs = RING_MS): number | null {
  const p = (t - eventTime) / windowMs;
  return p >= 0 && p < 1 ? p : null;
}

export function activeRings(quakes: PulseEvent[], t: number): PulseEvent[] {
  return quakes.filter((q) => (q.magnitude ?? 0) >= 2.5 && ringProgress(q.time, t) !== null);
}
```

- [ ] **Step 4: hash.ts 구현**

`src/lib/hash.ts`:

```ts
import { LAYERS, type LayerKey } from '../model.ts';

export type ViewState = { t: number | null; layers: LayerKey[] };

export function encodeHash(s: ViewState): string {
  const p = new URLSearchParams();
  if (s.t !== null) p.set('t', String(Math.round(s.t)));
  p.set('layers', s.layers.join(','));
  return `#${p.toString()}`;
}

export function decodeHash(hash: string): ViewState {
  const p = new URLSearchParams(hash.replace(/^#/, ''));
  const tRaw = Number(p.get('t'));
  const t = p.has('t') && Number.isFinite(tRaw) ? tRaw : null;
  const raw = p.get('layers');
  const picked = raw === null ? LAYERS : raw.split(',');
  return { t, layers: LAYERS.filter((l) => picked.includes(l)) };
}
```

- [ ] **Step 5: style.ts 작성(테스트 없음 — 상수와 단순 분기)**

`src/lib/style.ts`:

```ts
export const LAUNCH_COLOR = '#7bdff2';
export const ISS_COLOR = '#f5f7ff';
export const RING_RGB = '239, 71, 111';

// 노랑→주황→빨강. 크기도 함께 커지므로 색을 못 구분해도 규모가 읽힌다
export function quakeColor(mag: number, alpha: number): string {
  const rgb = mag >= 4.5 ? '239, 71, 111' : mag >= 2.5 ? '247, 140, 64' : '255, 209, 102';
  return `rgba(${rgb}, ${alpha.toFixed(2)})`;
}

// globe.gl pointRadius 단위는 각도(도)
export function quakeRadius(mag: number): number {
  return 0.12 + Math.max(mag, 0) * 0.1;
}
```

- [ ] **Step 6: 통과 확인**

Run: `npm run check && npm run lint && npm run build`
Expected: 34 tests pass, lint·build 통과.

- [ ] **Step 7: 커밋**

```bash
git add -A
git commit -m "시각 t에 보일 이벤트와 URL 해시를 순수 함수로 둔다" -m "화면은 t 하나로만 움직이므로, 무엇이 보이는지는 렌더링과 떼어 테스트로 고정한다. 해시로 특정 순간을 링크로 공유한다.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: 지구본 화면 + 라이브 모드

이 태스크부터는 화면이라 단위 테스트 대신 브라우저로 확인한다(`npm run dev` → 내장 브라우저로 `http://localhost:5173`).

**Files:**
- Create: `src/i18n.ts`, `src/components/GlobeView.tsx`, `src/App.css`
- Modify: `src/App.tsx`, `src/main.tsx`

**Interfaces:**
- Consumes: `loadQuakes`(usgs.ts), `loadLaunches`(launches.ts), `loadTle`, `makePropagator`, `orbitPath`, `isTleStale`, `Tle`, `IssPos`(iss.ts), `visibleQuakes`, `visibleLaunches`, `quakeOpacity`, `activeRings`, `ringProgress`(timeline.ts), `quakeColor`, `quakeRadius`, `LAUNCH_COLOR`, `ISS_COLOR`, `RING_RGB`(style.ts), `PulseEvent`, `LayerKey`, `Selection`, `Loaded`, `MINUTE`(model.ts)
- Produces:
  - `i18n.ts`: `msg`(아래 키 전부), `fmtTime(ms) → string`, `fmtAgo(ms, now) → string`, `fmtCountdown(target, t) → string`
  - `GlobeView.tsx`: `GlobeView(props: GlobeProps)`, `type GlobeProps = { t: number; quakes: PulseEvent[]; launches: PulseEvent[]; iss: IssPos | null; orbit: IssPos[]; issStale: boolean; reducedMotion: boolean; follow: boolean; onSelect: (s: Selection) => void; onUserInteract: () => void }`
  - `model.ts`에 추가: `type LayerStatus = { state: 'loading' | 'ok' | 'error'; fetchedAt?: number; stale?: boolean }`(App과 Header가 같이 쓴다)

- [ ] **Step 0: model.ts에 LayerStatus 추가**

`src/model.ts`의 `Selection` 정의 아래에 추가:

```ts
export type LayerStatus = { state: 'loading' | 'ok' | 'error'; fetchedAt?: number; stale?: boolean };
```

- [ ] **Step 1: i18n.ts**

`src/i18n.ts`:

```ts
const ko = {
  title: 'Planet Pulse',
  tagline: '지난 7일, 지구의 맥박',
  live: '라이브',
  layer: { quake: '지진', launch: '발사', iss: 'ISS' },
  retry: '다시 시도',
  loading: '불러오는 중',
  failed: '불러오지 못했어요',
  dataAgo: (ago: string) => `${ago} 데이터`,
  now: '지금',
  play: '재생',
  pause: '일시정지',
  speed: '배속',
  share: '링크 복사',
  copied: '복사됨',
  close: '닫기',
  magnitude: '규모',
  status: { success: '성공', failure: '실패', upcoming: '예정' },
  issPosition: '현재 위치',
  altitude: '고도',
  estimated: '추정 위치(궤도 정보가 오래됨)',
  follow: 'ISS 따라가기',
  unfollow: '따라가기 멈춤',
  source: '원문 보기',
  legendTitle: '범례',
  noWebgl: '이 브라우저는 3D를 지원하지 않아요. 최근 기록만 목록으로 보여드려요.',
  recentQuakes: '최근 지진',
  upcomingLaunches: '예정 발사',
  minutes: (n: number) => `${n}분 전`,
  hours: (n: number) => `${n}시간 전`,
  days: (n: number) => `${n}일 전`,
};

const en: typeof ko = {
  title: 'Planet Pulse',
  tagline: 'The planet’s pulse, last 7 days',
  live: 'Live',
  layer: { quake: 'Quakes', launch: 'Launches', iss: 'ISS' },
  retry: 'Retry',
  loading: 'Loading',
  failed: 'Failed to load',
  dataAgo: (ago: string) => `Data from ${ago}`,
  now: 'Now',
  play: 'Play',
  pause: 'Pause',
  speed: 'Speed',
  share: 'Copy link',
  copied: 'Copied',
  close: 'Close',
  magnitude: 'Magnitude',
  status: { success: 'Success', failure: 'Failure', upcoming: 'Upcoming' },
  issPosition: 'Current position',
  altitude: 'Altitude',
  estimated: 'Estimated (orbit data is old)',
  follow: 'Follow ISS',
  unfollow: 'Stop following',
  source: 'View source',
  legendTitle: 'Legend',
  noWebgl: 'This browser can’t show 3D. Here is the recent activity as a list.',
  recentQuakes: 'Recent quakes',
  upcomingLaunches: 'Upcoming launches',
  minutes: (n: number) => `${n} min ago`,
  hours: (n: number) => `${n} h ago`,
  days: (n: number) => `${n} d ago`,
};

export const lang = navigator.language.toLowerCase().startsWith('ko') ? 'ko' : 'en';
export const msg = lang === 'ko' ? ko : en;

const local = new Intl.DateTimeFormat(lang, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
const utc = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' });

export function fmtTime(ms: number): string {
  return `${local.format(ms)} (UTC ${utc.format(ms)})`;
}

export function fmtAgo(ms: number, now: number): string {
  const min = Math.max(0, Math.round((now - ms) / 60_000));
  if (min < 60) return msg.minutes(min);
  if (min < 1440) return msg.hours(Math.round(min / 60));
  return msg.days(Math.round(min / 1440));
}

export function fmtCountdown(target: number, t: number): string {
  const sign = target >= t ? 'T−' : 'T+';
  let s = Math.floor(Math.abs(target - t) / 1000);
  const d = Math.floor(s / 86400);
  s -= d * 86400;
  const h = Math.floor(s / 3600);
  s -= h * 3600;
  const m = Math.floor(s / 60);
  return `${sign}${d > 0 ? `${d}d ` : ''}${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}
```

`index.html`의 `lang="ko"`는 그대로 두고, `src/main.tsx` 첫 줄 뒤에 `document.documentElement.lang = navigator.language.toLowerCase().startsWith('ko') ? 'ko' : 'en';`를 넣는다.

- [ ] **Step 2: GlobeView.tsx**

`src/components/GlobeView.tsx`:

```tsx
import { useEffect, useRef } from 'react';
import Globe, { type GlobeInstance } from 'globe.gl';
import type { IssPos } from '../sources/iss.ts';
import type { PulseEvent, Selection } from '../model.ts';
import { activeRings, quakeOpacity, ringProgress } from '../lib/timeline.ts';
import { ISS_COLOR, LAUNCH_COLOR, quakeColor, quakeRadius, RING_RGB } from '../lib/style.ts';
import { msg } from '../i18n.ts';

export type GlobeProps = {
  t: number;
  quakes: PulseEvent[];
  launches: PulseEvent[];
  iss: IssPos | null;
  orbit: IssPos[];
  issStale: boolean;
  reducedMotion: boolean;
  follow: boolean;
  onSelect: (s: Selection) => void;
  onUserInteract: () => void;
};

type Marker = { lat: number; lng: number; alt: number; launch?: PulseEvent; iss?: true };

const EARTH_KM = 6371;
const LAUNCH_ALT = 0.12;
const SYMBOL = { success: '▲', failure: '✕', upcoming: '◇' } as const;

export function GlobeView(props: GlobeProps) {
  const el = useRef<HTMLDivElement>(null);
  const globe = useRef<GlobeInstance | null>(null);
  // accessor·이벤트 핸들러가 최신 값을 읽도록 ref에 둔다(globe는 한 번만 만든다)
  const latest = useRef(props);
  latest.current = props;
  // ISS 마커 객체를 재사용해야 globe.gl이 DOM 요소를 매번 새로 만들지 않는다
  const issMarker = useRef<Marker>({ lat: 0, lng: 0, alt: 0, iss: true });

  useEffect(() => {
    const host = el.current;
    if (!host) return;
    const g = new Globe(host)
      .globeImageUrl('/textures/earth-night.jpg')
      .backgroundImageUrl('/textures/night-sky.png')
      .pointLat('lat')
      .pointLng('lng')
      .pointsTransitionDuration(0)
      .pointAltitude((d) => ((d as PulseEvent).kind === 'launch' ? LAUNCH_ALT : 0.01))
      .pointRadius((d) => {
        const e = d as PulseEvent;
        return e.kind === 'launch' ? 0.12 : quakeRadius(e.magnitude ?? 0);
      })
      .pointColor((d) => {
        const e = d as PulseEvent;
        return e.kind === 'launch' ? LAUNCH_COLOR : quakeColor(e.magnitude ?? 0, quakeOpacity(e, latest.current.t));
      })
      .onPointClick((d) => latest.current.onSelect({ kind: 'event', event: d as PulseEvent }))
      .ringLat('lat')
      .ringLng('lng')
      .ringMaxRadius((d) => 1 + ((d as PulseEvent).magnitude ?? 0) * 0.8)
      .ringPropagationSpeed(2)
      .ringRepeatPeriod(1400)
      .ringColor((d) => {
        const p = ringProgress((d as PulseEvent).time, latest.current.t) ?? 1;
        return (r: number) => `rgba(${RING_RGB}, ${((1 - r) * (1 - p)).toFixed(2)})`;
      })
      .htmlLat('lat')
      .htmlLng('lng')
      .htmlAltitude('alt')
      .htmlTransitionDuration(0)
      .htmlElement((d) => makeMarker(d as Marker))
      .pathPoints('points')
      .pathPointLat('lat')
      .pathPointLng('lng')
      .pathPointAlt((p) => (p as IssPos).altKm / EARTH_KM)
      .pathColor(() => 'rgba(245, 247, 255, 0.55)')
      .pathStroke(1.2)
      .pathTransitionDuration(0);

    function makeMarker(d: Marker): HTMLElement {
      const b = document.createElement('button');
      b.type = 'button';
      b.style.pointerEvents = 'auto';
      if (d.iss) {
        b.className = 'marker marker-iss';
        b.textContent = '◉';
        b.style.color = ISS_COLOR;
        b.setAttribute('aria-label', 'ISS');
        b.onclick = (ev) => {
          ev.stopPropagation();
          latest.current.onSelect({ kind: 'iss' });
        };
      } else if (d.launch) {
        const launch = d.launch;
        b.className = `marker marker-launch marker-${launch.status}`;
        b.textContent = SYMBOL[launch.status ?? 'upcoming'];
        b.setAttribute('aria-label', `${msg.status[launch.status ?? 'upcoming']} · ${launch.label}`);
        b.onclick = (ev) => {
          ev.stopPropagation();
          latest.current.onSelect({ kind: 'event', event: launch });
        };
      }
      return b;
    }

    const controls = g.controls();
    controls.autoRotate = !latest.current.reducedMotion;
    controls.autoRotateSpeed = 0.35;
    let resume: number | undefined;
    const onStart = () => {
      controls.autoRotate = false;
      window.clearTimeout(resume);
      latest.current.onUserInteract();
    };
    const onEnd = () => {
      window.clearTimeout(resume);
      resume = window.setTimeout(() => {
        controls.autoRotate = !latest.current.reducedMotion;
      }, 10_000);
    };
    controls.addEventListener('start', onStart);
    controls.addEventListener('end', onEnd);

    const ro = new ResizeObserver(() => g.width(host.clientWidth).height(host.clientHeight));
    ro.observe(host);
    globe.current = g;

    return () => {
      ro.disconnect();
      window.clearTimeout(resume);
      controls.removeEventListener('start', onStart);
      controls.removeEventListener('end', onEnd);
      g._destructor();
      globe.current = null;
    };
  }, []);

  const { t, quakes, launches, iss, orbit, issStale, reducedMotion, follow } = props;

  // 점: 지진 + 발사 기둥. 같은 객체를 넘기므로 globe.gl이 메시를 재사용하고 색만 다시 계산한다
  useEffect(() => {
    globe.current?.pointsData([...quakes, ...launches]);
  }, [t, quakes, launches]);

  useEffect(() => {
    globe.current?.ringsData(reducedMotion ? [] : activeRings(quakes, t));
  }, [t, quakes, reducedMotion]);

  // 발사 기호와 ISS 마커. launches 배열은 렌더마다 새로 걸러 오지만 원소(이벤트 객체)는 같으므로,
  // 이벤트 객체별로 마커 객체를 하나씩 기억해 두고 재사용한다(DOM 요소를 1초마다 다시 만들지 않게)
  const markerOf = useRef(new WeakMap<PulseEvent, Marker>());
  useEffect(() => {
    const markers = launches.map((e) => {
      let m = markerOf.current.get(e);
      if (!m) {
        m = { lat: e.lat, lng: e.lng, alt: LAUNCH_ALT + 0.02, launch: e };
        markerOf.current.set(e, m);
      }
      return m;
    });
    const m = issMarker.current;
    if (iss) Object.assign(m, { lat: iss.lat, lng: iss.lng, alt: iss.altKm / EARTH_KM });
    globe.current?.htmlElementsData(iss ? [...markers, m] : markers);
  }, [launches, iss]);

  useEffect(() => {
    const g = globe.current;
    if (!g) return;
    g.pathDashLength(issStale ? 0.02 : 1).pathDashGap(issStale ? 0.015 : 0);
    g.pathsData(orbit.length ? [{ points: orbit }] : []);
  }, [orbit, issStale]);

  useEffect(() => {
    if (follow && iss) globe.current?.pointOfView({ lat: iss.lat, lng: iss.lng, altitude: 1.8 }, 0);
  }, [follow, iss]);

  useEffect(() => {
    const g = globe.current;
    if (g) g.controls().autoRotate = !reducedMotion && !follow;
  }, [reducedMotion, follow]);

  return <div ref={el} className="globe" />;
}
```

주의: `pointsData`에는 App이 이미 `visibleQuakes(…, t)`로 거른 배열을 넘긴다(Step 3). 거른 배열의 원소는 원본 객체 그대로라 메시가 재사용된다.

- [ ] **Step 3: App.tsx — 데이터 로드와 라이브 모드**

`src/App.tsx` 전체(이후 태스크에서 기능을 더한다):

```tsx
import { useCallback, useEffect, useMemo, useState } from 'react';
import { GlobeView } from './components/GlobeView.tsx';
import { loadQuakes } from './sources/usgs.ts';
import { loadLaunches } from './sources/launches.ts';
import { isTleStale, loadTle, makePropagator, orbitPath, type Tle } from './sources/iss.ts';
import { visibleLaunches, visibleQuakes } from './lib/timeline.ts';
import { MINUTE, type LayerKey, type LayerStatus, type Loaded, type PulseEvent, type Selection } from './model.ts';
import './App.css';

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export default function App() {
  const [t, setT] = useState(() => Date.now());
  const [live] = useState(true);
  const [layers] = useState<LayerKey[]>(['quake', 'launch', 'iss']);
  const [quakes, setQuakes] = useState<PulseEvent[]>([]);
  const [launches, setLaunches] = useState<PulseEvent[]>([]);
  const [tle, setTle] = useState<Tle | null>(null);
  const [, setStatus] = useState<Record<LayerKey, LayerStatus>>({
    quake: { state: 'loading' },
    launch: { state: 'loading' },
    iss: { state: 'loading' },
  });
  const [follow, setFollow] = useState(false);
  const [, setSelected] = useState<Selection | null>(null);

  const run = useCallback(async <T,>(key: LayerKey, loader: () => Promise<Loaded<T>>, apply: (v: T) => void) => {
    setStatus((s) => ({ ...s, [key]: { state: 'loading' } }));
    try {
      const r = await loader();
      apply(r.value);
      setStatus((s) => ({ ...s, [key]: { state: 'ok', fetchedAt: r.fetchedAt, stale: r.stale } }));
    } catch {
      setStatus((s) => ({ ...s, [key]: { state: 'error' } }));
    }
  }, []);

  const load = useCallback(
    (key: LayerKey) => {
      if (key === 'quake') return run('quake', () => loadQuakes(), setQuakes);
      if (key === 'launch') return run('launch', () => loadLaunches(), setLaunches);
      return run('iss', () => loadTle(), setTle);
    },
    [run],
  );

  useEffect(() => {
    void load('quake');
    void load('launch');
    void load('iss');
  }, [load]);

  // 라이브: 1초마다 t = 지금
  useEffect(() => {
    if (!live) return;
    const id = window.setInterval(() => setT(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [live]);

  // 라이브: 5분마다 지진 갱신. 탭이 숨겨져 있으면 건너뛰고, 돌아오면 바로 한 번
  useEffect(() => {
    if (!live) return;
    const tick = () => {
      if (document.visibilityState === 'visible') void load('quake');
    };
    const id = window.setInterval(tick, 5 * MINUTE);
    document.addEventListener('visibilitychange', tick);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [live, load]);

  const positionAt = useMemo(() => (tle ? makePropagator(tle) : null), [tle]);
  const iss = layers.includes('iss') && positionAt ? positionAt(t) : null;
  const orbit = iss && positionAt ? orbitPath(positionAt, t) : [];

  return (
    <div className="app">
      <GlobeView
        t={t}
        quakes={layers.includes('quake') ? visibleQuakes(quakes, t) : []}
        launches={layers.includes('launch') ? visibleLaunches(launches, t) : []}
        iss={iss}
        orbit={orbit}
        issStale={tle ? isTleStale(tle, t) : false}
        reducedMotion={reducedMotion}
        follow={follow}
        onSelect={setSelected}
        onUserInteract={() => setFollow(false)}
      />
    </div>
  );
}
```

- [ ] **Step 4: App.css 기본(전체 화면 지구본 + 토큰)**

`src/App.css`:

```css
:root {
  color-scheme: dark;
  --bg: #05070d;
  --panel: rgba(12, 16, 28, 0.72);
  --panel-border: rgba(255, 255, 255, 0.1);
  --text: #e8ecf6;
  --muted: #8f9ab3;
  --accent: #7bdff2;
  --warn: #ffd166;
  --danger: #ef476f;
  --radius: 12px;
  --gutter: 16px;
  font-family: ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif;
}

* { box-sizing: border-box; }

html, body, #root { height: 100%; margin: 0; }

body {
  background: var(--bg);
  color: var(--text);
  overflow: hidden;
}

.app { position: relative; height: 100%; }

.globe { position: absolute; inset: 0; }

.num { font-variant-numeric: tabular-nums; }

.marker {
  border: 0;
  background: none;
  color: var(--accent);
  font-size: 16px;
  line-height: 1;
  padding: 4px;
  cursor: pointer;
  transform: translate(-50%, -50%);
  text-shadow: 0 0 6px rgba(0, 0, 0, 0.9);
}
.marker-failure { color: var(--danger); }
.marker-upcoming { color: var(--warn); }
.marker-iss { font-size: 18px; }
.marker:focus-visible { outline: 2px solid var(--accent); border-radius: 50%; }
```

- [ ] **Step 5: 브라우저로 확인**

```bash
npm run dev
```

내장 브라우저로 `http://localhost:5173`을 열어 확인한다:
- 야간 지구본이 화면 전체에 보이고 천천히 돈다.
- 지진 점이 수천 개 찍히고(태평양 불의 고리를 따라 밀집), 최근 3시간 안의 규모 2.5 이상 지진에 링이 퍼진다.
- 최근 발사장에 하늘색 기둥과 ▲(또는 ✕, ◇) 기호가 보인다.
- ISS ◉가 1초마다 조금씩 움직이고 앞뒤 궤도선이 그려진다.
- 드래그하면 자동 회전이 멈추고, 놓은 뒤 10초 지나면 다시 돈다.
- 개발자 도구 Console에 오류가 없다.

- [ ] **Step 6: lint·build·check 후 커밋**

Run: `npm run lint && npm run build && npm run check`
Expected: 모두 통과.

```bash
git add -A
git commit -m "지구본에 지진·발사·ISS를 라이브로 그린다" -m "globe.gl은 한 번만 만들고 데이터만 갈아 끼운다. 이벤트·마커 객체를 재사용해 메시와 DOM 요소를 다시 만들지 않는다.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: 스크러버·재생·키보드·URL 해시

**Files:**
- Create: `src/components/Scrubber.tsx`
- Modify: `src/App.tsx`, `src/App.css`

**Interfaces:**
- Consumes: `timeRange`(timeline.ts), `encodeHash`, `decodeHash`(hash.ts), `HOUR`, `DAY`(model.ts), `msg`, `fmtTime`(i18n.ts)
- Produces: `SPEEDS: number[]`(시뮬레이션 ms/초), `Scrubber(props: ScrubberProps)`, `type ScrubberProps = { t: number; min: number; max: number; now: number; live: boolean; playing: boolean; speed: number; onScrub: (t: number) => void; onTogglePlay: () => void; onSpeed: (s: number) => void; onLive: () => void }`

- [ ] **Step 1: Scrubber.tsx**

`src/components/Scrubber.tsx`:

```tsx
import { DAY, HOUR } from '../model.ts';
import { fmtTime, msg } from '../i18n.ts';

export const SPEEDS = [HOUR, 6 * HOUR, DAY];
const SPEED_LABEL = ['1h/s', '6h/s', '1d/s'];

export type ScrubberProps = {
  t: number;
  min: number;
  max: number;
  now: number;
  live: boolean;
  playing: boolean;
  speed: number;
  onScrub: (t: number) => void;
  onTogglePlay: () => void;
  onSpeed: (s: number) => void;
  onLive: () => void;
};

const day = new Intl.DateTimeFormat(undefined, { month: 'numeric', day: 'numeric' });

export function Scrubber(p: ScrubberProps) {
  const nowPct = ((p.now - p.min) / (p.max - p.min)) * 100;
  const next = SPEEDS[(SPEEDS.indexOf(p.speed) + 1) % SPEEDS.length];
  return (
    <section className="scrubber panel" aria-label="timeline">
      <div className="scrubber-row">
        <button type="button" className="btn" onClick={p.onTogglePlay} aria-label={p.playing ? msg.pause : msg.play}>
          {p.playing ? '❚❚' : '▶'}
        </button>
        <button type="button" className="btn num" onClick={() => p.onSpeed(next)} aria-label={msg.speed}>
          {SPEED_LABEL[SPEEDS.indexOf(p.speed)]}
        </button>
        <span className="scrubber-time num">{fmtTime(p.t)}</span>
        <button type="button" className={`btn${p.live ? ' btn-on' : ''}`} onClick={p.onLive} aria-pressed={p.live}>
          {msg.now}
        </button>
      </div>
      <div className="scrubber-track">
        <input
          type="range"
          min={p.min}
          max={p.max}
          step={60_000}
          value={p.t}
          onChange={(e) => p.onScrub(Number(e.currentTarget.value))}
          aria-valuetext={fmtTime(p.t)}
        />
        <span className="scrubber-now" style={{ left: `${nowPct}%` }} aria-hidden="true" />
      </div>
      <div className="scrubber-labels num" aria-hidden="true">
        <span>{day.format(p.min)}</span>
        <span>{msg.now}</span>
        <span>{day.format(p.max)}</span>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: App.tsx에 시간 상태 연결**

`src/App.tsx`를 고친다.

import에 추가:

```tsx
import { useRef } from 'react';
import { Scrubber, SPEEDS } from './components/Scrubber.tsx';
import { timeRange } from './lib/timeline.ts';
import { decodeHash, encodeHash } from './lib/hash.ts';
import { HOUR } from './model.ts';
```

(`useRef`는 기존 `react` import 줄에 합치고, `HOUR`는 기존 `./model.ts` import 줄에 합친다.)

컴포넌트 첫 부분의 `t`·`live`·`layers` 상태를 아래로 바꾼다:

```tsx
  const [initial] = useState(() => decodeHash(window.location.hash));
  const [anchor] = useState(() => Date.now()); // 스크러버 범위 기준(페이지를 연 시각)
  const range = timeRange(anchor);
  const [live, setLive] = useState(initial.t === null);
  const [t, setT] = useState(() => initial.t ?? Date.now());
  const [layers] = useState<LayerKey[]>(initial.layers); // Task 8에서 [layers, setLayers]로 바꾼다
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(SPEEDS[0]);
```

`setLayers`를 지금 꺼내면 `noUnusedLocals`로 빌드가 깨지므로 Task 8에서 꺼낸다.

라이브 effect들 아래에 재생 루프·해시·키보드를 더한다:

```tsx
  // 재생: rAF로 시뮬레이션 시간을 쌓고, 화면 갱신(setT)은 초당 10회로 제한한다
  const tRef = useRef(t);
  tRef.current = t;
  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    let last = performance.now();
    let lastSet = last;
    let simT = tRef.current;
    const step = (now: number) => {
      simT = Math.min(range.max, simT + ((now - last) / 1000) * speed);
      last = now;
      if (now - lastSet >= 100 || simT >= range.max) {
        lastSet = now;
        setT(simT);
      }
      if (simT >= range.max) {
        setPlaying(false);
        return;
      }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [playing, speed, range.max]);

  // 해시: 재생 중엔 쓰지 않고, 멈춘 뒤 0.5초 지나 한 번(Safari는 replaceState 횟수를 제한한다)
  useEffect(() => {
    if (playing) return;
    const id = window.setTimeout(() => {
      history.replaceState(null, '', encodeHash({ t: live ? null : t, layers }));
    }, 500);
    return () => window.clearTimeout(id);
  }, [playing, live, t, layers]);

  const scrubTo = useCallback(
    (next: number) => {
      setLive(false);
      setT(Math.min(range.max, Math.max(range.min, next)));
    },
    [range.min, range.max],
  );
  const goLive = useCallback(() => {
    setPlaying(false);
    setLive(true);
    setT(Date.now());
  }, []);
  const togglePlay = useCallback(() => {
    setLive(false);
    // 끝에서 재생을 누르면 처음부터(재생 중엔 끝에 닿는 순간 멈추므로 이 조건은 시작할 때만 맞는다)
    if (tRef.current >= range.max) setT(range.min);
    setPlaying((p) => !p);
  }, [range.min, range.max]);

  // 키보드: ←→ ±1시간, Space 재생. 입력 요소에 포커스가 있으면 그 요소에 맡긴다
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'BUTTON' || tag === 'A') return;
      if (e.key === 'ArrowLeft') scrubTo(tRef.current - HOUR);
      else if (e.key === 'ArrowRight') scrubTo(tRef.current + HOUR);
      else if (e.key === ' ') togglePlay();
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [scrubTo, togglePlay]);
```

JSX의 `<GlobeView … />` 다음에 넣는다:

```tsx
      <Scrubber
        t={t}
        min={range.min}
        max={range.max}
        now={live ? t : Date.now()}
        live={live}
        playing={playing}
        speed={speed}
        onScrub={scrubTo}
        onTogglePlay={togglePlay}
        onSpeed={setSpeed}
        onLive={goLive}
      />
```

- [ ] **Step 3: 스크러버·패널 CSS**

`src/App.css` 끝에 추가:

```css
.panel {
  position: absolute;
  background: var(--panel);
  border: 1px solid var(--panel-border);
  border-radius: var(--radius);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
}

.btn {
  min-height: 32px;
  padding: 4px 10px;
  border: 1px solid var(--panel-border);
  border-radius: 8px;
  background: transparent;
  color: var(--text);
  font: inherit;
  font-size: 13px;
  cursor: pointer;
}
.btn:hover { border-color: var(--muted); }
.btn:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.btn-on { background: rgba(123, 223, 242, 0.15); border-color: var(--accent); color: var(--accent); }

.scrubber {
  left: var(--gutter);
  right: var(--gutter);
  bottom: calc(var(--gutter) + env(safe-area-inset-bottom));
  padding: 10px 14px 8px;
}
.scrubber-row { display: flex; align-items: center; gap: 8px; }
.scrubber-time { flex: 1; font-size: 13px; color: var(--muted); text-align: right; }
.scrubber-track { position: relative; margin-top: 8px; }
.scrubber-track input { width: 100%; height: 28px; margin: 0; accent-color: var(--accent); }
.scrubber-now {
  position: absolute;
  top: 2px;
  bottom: 2px;
  width: 2px;
  background: var(--warn);
  pointer-events: none;
}
.scrubber-labels { display: flex; justify-content: space-between; font-size: 11px; color: var(--muted); }

@media (max-width: 640px) {
  .scrubber-track input { height: 44px; }
}
```

- [ ] **Step 4: 브라우저로 확인**

`npm run dev`가 떠 있는 상태에서 확인한다:
- 슬라이더를 왼쪽으로 끌면 지진 점이 줄어들고(그 시각 이후 지진이 사라짐), ISS가 그 시각 위치로 이동한다.
- ▶를 누르면 1h/s로 흐르고, 배속 버튼이 1h/s → 6h/s → 1d/s로 순환한다.
- 오른쪽 끝(+7일)에 닿으면 멈춘다. 다시 ▶를 누르면 처음(−7일)부터 흐른다.
- "지금"을 누르면 라이브로 돌아오고 버튼이 강조된다.
- 지구본을 클릭한 뒤(포커스가 입력 요소에 없을 때) ←→가 1시간씩 움직이고 Space가 재생을 토글한다.
- 멈춘 상태에서 0.5초 뒤 주소창 해시가 `#t=…&layers=quake%2Claunch%2Ciss`가 된다. 그 URL을 새 탭에서 열면 같은 시각으로 열린다.

- [ ] **Step 5: lint·build·check 후 커밋**

Run: `npm run lint && npm run build && npm run check`

```bash
git add -A
git commit -m "시간 스크러버와 재생·키보드·URL 해시를 붙인다" -m "재생 중 화면 갱신은 초당 10회로 제한하고, 해시는 멈춘 뒤에만 쓴다(Safari replaceState 횟수 제한).

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: 헤더(레이어 토글·오류 상태·공유)·범례·상세 카드

**Files:**
- Create: `src/components/Header.tsx`, `src/components/Legend.tsx`, `src/components/EventCard.tsx`
- Modify: `src/App.tsx`, `src/App.css`

**Interfaces:**
- Consumes: `LayerStatus`, `LayerKey`, `LAYERS`, `PulseEvent`, `Selection`(model.ts), `IssPos`(iss.ts), `encodeHash`(hash.ts), `msg`, `fmtTime`, `fmtAgo`, `fmtCountdown`(i18n.ts)
- Produces:
  - `Header(props: { live: boolean; layers: LayerKey[]; status: Record<LayerKey, LayerStatus>; now: number; onToggle: (k: LayerKey) => void; onRetry: (k: LayerKey) => void; shareUrl: () => string })`
  - `Legend()`
  - `EventCard(props: { selection: Selection; t: number; iss: IssPos | null; issStale: boolean; follow: boolean; onFollow: (f: boolean) => void; onClose: () => void })`

- [ ] **Step 1: Header.tsx**

`src/components/Header.tsx`:

```tsx
import { useState } from 'react';
import { LAYERS, type LayerKey, type LayerStatus } from '../model.ts';
import { fmtAgo, msg } from '../i18n.ts';

const ICON: Record<LayerKey, string> = { quake: '●', launch: '▲', iss: '◉' };

type Props = {
  live: boolean;
  layers: LayerKey[];
  status: Record<LayerKey, LayerStatus>;
  now: number;
  onToggle: (k: LayerKey) => void;
  onRetry: (k: LayerKey) => void;
  shareUrl: () => string;
};

export function Header(p: Props) {
  const [copied, setCopied] = useState(false);
  const share = async () => {
    try {
      await navigator.clipboard.writeText(p.shareUrl());
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt(msg.share, p.shareUrl());
    }
  };
  return (
    <header className="header panel">
      <div className="brand">
        <h1>{msg.title}</h1>
        {p.live && (
          <span className="live">
            <span className="live-dot" aria-hidden="true" />
            {msg.live}
          </span>
        )}
      </div>
      <div className="toggles">
        {LAYERS.map((k) => {
          const s = p.status[k];
          return (
            <span key={k} className="toggle">
              <button
                type="button"
                className={`btn${p.layers.includes(k) ? ' btn-on' : ''}`}
                aria-pressed={p.layers.includes(k)}
                onClick={() => p.onToggle(k)}
                title={msg.layer[k]}
              >
                <span aria-hidden="true">{ICON[k]}</span>
                <span className="toggle-label"> {msg.layer[k]}</span>
                {s.state === 'error' && <span className="warn" aria-label={msg.failed}> ⚠</span>}
              </button>
              {s.state === 'error' && (
                <button type="button" className="btn btn-small" onClick={() => p.onRetry(k)}>
                  {msg.retry}
                </button>
              )}
              {s.state === 'ok' && s.stale && s.fetchedAt !== undefined && (
                <span className="stale num">{msg.dataAgo(fmtAgo(s.fetchedAt, p.now))}</span>
              )}
            </span>
          );
        })}
        <button type="button" className="btn" onClick={share}>
          {copied ? msg.copied : msg.share}
        </button>
      </div>
    </header>
  );
}
```

- [ ] **Step 2: Legend.tsx**

`src/components/Legend.tsx`:

```tsx
import { msg } from '../i18n.ts';

export function Legend() {
  return (
    <details className="legend panel" open={window.innerWidth > 640}>
      <summary>{msg.legendTitle}</summary>
      <ul>
        <li><span className="dot dot-s" /> {msg.magnitude} &lt; 2.5</li>
        <li><span className="dot dot-m" /> {msg.magnitude} 2.5–4.5</li>
        <li><span className="dot dot-l" /> {msg.magnitude} 4.5+</li>
        <li><span className="sym">▲</span> {msg.status.success} · <span className="sym sym-failure">✕</span> {msg.status.failure} · <span className="sym sym-upcoming">◇</span> {msg.status.upcoming}</li>
        <li><span className="sym">◉</span> ISS</li>
      </ul>
    </details>
  );
}
```

- [ ] **Step 3: EventCard.tsx**

`src/components/EventCard.tsx`:

```tsx
import type { IssPos } from '../sources/iss.ts';
import type { Selection } from '../model.ts';
import { fmtCountdown, fmtTime, msg } from '../i18n.ts';

type Props = {
  selection: Selection;
  t: number;
  iss: IssPos | null;
  issStale: boolean;
  follow: boolean;
  onFollow: (f: boolean) => void;
  onClose: () => void;
};

export function EventCard(p: Props) {
  return (
    <aside className="card panel" aria-live="polite">
      <button type="button" className="card-close btn btn-small" onClick={p.onClose} aria-label={msg.close}>
        ✕
      </button>
      {p.selection.kind === 'iss' ? <IssBody {...p} /> : <EventBody {...p} />}
    </aside>
  );
}

function IssBody({ iss, issStale, follow, onFollow }: Props) {
  return (
    <>
      <h2>ISS</h2>
      {iss ? (
        <dl className="num">
          <dt>{msg.issPosition}</dt>
          <dd>{iss.lat.toFixed(2)}°, {iss.lng.toFixed(2)}°</dd>
          <dt>{msg.altitude}</dt>
          <dd>{Math.round(iss.altKm)} km</dd>
        </dl>
      ) : (
        <p>{msg.failed}</p>
      )}
      {issStale && <p className="warn-text">{msg.estimated}</p>}
      <button type="button" className={`btn${follow ? ' btn-on' : ''}`} onClick={() => onFollow(!follow)}>
        {follow ? msg.unfollow : msg.follow}
      </button>
    </>
  );
}

function EventBody({ selection, t }: Props) {
  if (selection.kind !== 'event') return null;
  const e = selection.event;
  return (
    <>
      <h2>{e.kind === 'quake' ? msg.layer.quake : msg.layer.launch}</h2>
      <p className="card-label">{e.label}</p>
      <dl className="num">
        <dt>{fmtTime(e.time)}</dt>
        <dd />
        {e.kind === 'quake' && (
          <>
            <dt>{msg.magnitude}</dt>
            <dd>M {e.magnitude?.toFixed(1)}</dd>
          </>
        )}
        {e.kind === 'launch' && e.status && (
          <>
            <dt>{msg.status[e.status]}</dt>
            <dd>{e.status === 'upcoming' ? fmtCountdown(e.time, t) : ''}</dd>
          </>
        )}
      </dl>
      {e.url && (
        <a className="btn" href={e.url} target="_blank" rel="noreferrer">
          {msg.source} ↗
        </a>
      )}
    </>
  );
}
```

- [ ] **Step 4: App.tsx에 연결**

import에 추가:

```tsx
import { Header } from './components/Header.tsx';
import { Legend } from './components/Legend.tsx';
import { EventCard } from './components/EventCard.tsx';
```

상태 줄을 고친다: `const [, setStatus]` → `const [status, setStatus]`, `const [, setSelected]` → `const [selected, setSelected]`, `const [layers] = …` → `const [layers, setLayers] = …`.

`orbit` 계산 아래에 추가:

```tsx
  const issStale = tle ? isTleStale(tle, t) : false;
  const toggleLayer = (k: LayerKey) =>
    setLayers((ls) => LAYERS.filter((l) => (l === k ? !ls.includes(l) : ls.includes(l))));
  const shareUrl = () =>
    `${window.location.origin}${window.location.pathname}${encodeHash({ t, layers })}`;
```

(`LAYERS`를 `./model.ts` import에 추가한다. `GlobeView`의 `issStale` prop은 이 변수로 바꾼다.)

JSX를 아래로 바꾼다:

```tsx
    <div className="app">
      <GlobeView
        t={t}
        quakes={layers.includes('quake') ? visibleQuakes(quakes, t) : []}
        launches={layers.includes('launch') ? visibleLaunches(launches, t) : []}
        iss={iss}
        orbit={orbit}
        issStale={issStale}
        reducedMotion={reducedMotion}
        follow={follow}
        onSelect={setSelected}
        onUserInteract={() => setFollow(false)}
      />
      <Header
        live={live}
        layers={layers}
        status={status}
        now={Date.now()}
        onToggle={toggleLayer}
        onRetry={(k) => void load(k)}
        shareUrl={shareUrl}
      />
      <Legend />
      {selected && (
        <EventCard
          selection={selected}
          t={t}
          iss={iss}
          issStale={issStale}
          follow={follow}
          onFollow={setFollow}
          onClose={() => {
            setSelected(null);
            setFollow(false);
          }}
        />
      )}
      <Scrubber
        t={t}
        min={range.min}
        max={range.max}
        now={live ? t : Date.now()}
        live={live}
        playing={playing}
        speed={speed}
        onScrub={scrubTo}
        onTogglePlay={togglePlay}
        onSpeed={setSpeed}
        onLive={goLive}
      />
    </div>
```

- [ ] **Step 5: CSS(데스크톱 + 모바일)**

`src/App.css` 끝에 추가:

```css
.header {
  top: calc(var(--gutter) + env(safe-area-inset-top));
  left: var(--gutter);
  right: var(--gutter);
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 8px;
  padding: 8px 12px;
}
.brand { display: flex; align-items: center; gap: 10px; }
.brand h1 { margin: 0; font-size: 15px; letter-spacing: 0.12em; text-transform: uppercase; }
.live { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; color: var(--danger); }
.live-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--danger); animation: pulse 1.6s infinite; }
@keyframes pulse { 50% { opacity: 0.3; } }
.toggles { display: flex; align-items: center; flex-wrap: wrap; gap: 6px; }
.toggle { display: inline-flex; align-items: center; gap: 4px; }
.btn-small { min-height: 28px; padding: 2px 8px; font-size: 12px; }
.warn { color: var(--warn); }
.warn-text { color: var(--warn); font-size: 13px; }
.stale { font-size: 11px; color: var(--warn); }

.legend {
  left: var(--gutter);
  bottom: calc(var(--gutter) + 120px + env(safe-area-inset-bottom));
  padding: 8px 12px;
  font-size: 12px;
  color: var(--muted);
}
.legend summary { cursor: pointer; color: var(--text); }
.legend ul { list-style: none; margin: 6px 0 0; padding: 0; display: grid; gap: 4px; }
.dot { display: inline-block; border-radius: 50%; vertical-align: middle; }
.dot-s { width: 6px; height: 6px; background: #ffd166; }
.dot-m { width: 9px; height: 9px; background: #f78c40; }
.dot-l { width: 12px; height: 12px; background: #ef476f; }
.sym { color: var(--accent); }
.sym-failure { color: var(--danger); }
.sym-upcoming { color: var(--warn); }

.card {
  top: calc(var(--gutter) + 64px + env(safe-area-inset-top));
  right: var(--gutter);
  width: 300px;
  max-width: calc(100% - 2 * var(--gutter));
  padding: 14px 16px;
  display: grid;
  gap: 8px;
}
.card h2 { margin: 0; font-size: 14px; color: var(--muted); font-weight: 500; }
.card-label { margin: 0; font-size: 15px; line-height: 1.4; }
.card dl { margin: 0; display: grid; grid-template-columns: auto 1fr; gap: 4px 12px; font-size: 13px; }
.card dt { color: var(--muted); }
.card dd { margin: 0; }
.card a.btn { justify-self: start; text-decoration: none; }
.card-close { position: absolute; top: 8px; right: 8px; }

@media (max-width: 640px) {
  .toggle-label { display: none; }
  .legend { bottom: calc(var(--gutter) + 136px + env(safe-area-inset-bottom)); }
  .card {
    top: auto;
    right: var(--gutter);
    left: var(--gutter);
    bottom: calc(var(--gutter) + 136px + env(safe-area-inset-bottom));
    width: auto;
  }
}

@media (prefers-reduced-motion: reduce) {
  .live-dot { animation: none; }
}
```

- [ ] **Step 6: 브라우저로 확인(데스크톱 + 모바일 375px)**

- 지진 점을 클릭하면 오른쪽에 카드가 뜬다: 장소, 시각(로컬 + UTC), 규모, "원문 보기 ↗"(USGS 페이지).
- 발사 기호나 기둥을 클릭하면 카드에 로켓·임무·발사장, 상태가 나오고, 예정 발사는 `T−` 카운트다운이 나온다.
- ISS ◉를 클릭하면 위치·고도, "ISS 따라가기"가 나온다. 누르면 카메라가 ISS를 따라가고, 지구본을 드래그하면 따라가기가 풀린다.
- 레이어 토글을 끄고 켜면 해당 레이어만 사라졌다 나타난다.
- "링크 복사"를 누르면 "복사됨"이 2초 보이고, 붙여넣은 URL이 같은 상태로 열린다.
- 개발자 도구 Network에서 `ll.thespacedevs.com`을 차단(Block request URL)하고 `localStorage`를 비운 뒤 새로고침하면 발사 토글에만 ⚠와 "다시 시도"가 뜨고, 지진·ISS는 정상이다.
- 차단을 풀기 전에 캐시가 있는 상태(차단 없이 한 번 연 뒤 `pp:launches`의 `savedAt`을 1시간 이상 과거로 고쳐 저장)에서 차단하고 새로고침하면 "N시간 전 데이터"가 보인다.
- 내장 브라우저 뷰포트를 mobile(375×812)로 바꾸면 토글이 아이콘만 남고, 카드는 아래쪽 시트로 뜨며, 가로 스크롤이 없다.

- [ ] **Step 7: lint·build·check 후 커밋**

Run: `npm run lint && npm run build && npm run check`

```bash
git add -A
git commit -m "레이어 토글·오류 상태·공유·범례·상세 카드를 붙인다" -m "한 출처가 실패해도 그 레이어에만 경고와 다시 시도를 띄운다. 예전 캐시로 그릴 때는 몇 분 전 데이터인지 밝힌다.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: WebGL 미지원 대체 화면

**Files:**
- Create: `src/components/Fallback.tsx`
- Modify: `src/App.tsx`, `src/App.css`

**Interfaces:**
- Consumes: `PulseEvent`(model.ts), `msg`, `fmtTime`(i18n.ts)
- Produces: `hasWebGL() → boolean`, `Fallback(props: { quakes: PulseEvent[]; launches: PulseEvent[] })`

- [ ] **Step 1: Fallback.tsx**

`src/components/Fallback.tsx`:

```tsx
import type { PulseEvent } from '../model.ts';
import { fmtTime, msg } from '../i18n.ts';

export function hasWebGL(): boolean {
  try {
    const c = document.createElement('canvas');
    return Boolean(c.getContext('webgl2') ?? c.getContext('webgl'));
  } catch {
    return false;
  }
}

export function Fallback({ quakes, launches }: { quakes: PulseEvent[]; launches: PulseEvent[] }) {
  const recent = [...quakes].sort((a, b) => b.time - a.time).slice(0, 20);
  const upcoming = launches.filter((l) => l.status === 'upcoming').sort((a, b) => a.time - b.time);
  return (
    <main className="fallback">
      <h1>{msg.title}</h1>
      <p>{msg.noWebgl}</p>
      <h2>{msg.recentQuakes}</h2>
      <ul>
        {recent.map((q) => (
          <li key={q.id} className="num">
            M {q.magnitude?.toFixed(1)} · {q.label} · {fmtTime(q.time)}
          </li>
        ))}
      </ul>
      <h2>{msg.upcomingLaunches}</h2>
      <ul>
        {upcoming.map((l) => (
          <li key={l.id} className="num">
            {l.label} · {fmtTime(l.time)}
          </li>
        ))}
      </ul>
    </main>
  );
}
```

- [ ] **Step 2: App.tsx 분기**

import에 `import { Fallback, hasWebGL } from './components/Fallback.tsx';`를 더하고, 모듈 최상단 `reducedMotion` 옆에 `const webgl = hasWebGL();`를 둔다. `return (` 바로 앞에:

```tsx
  if (!webgl) return <Fallback quakes={quakes} launches={launches} />;
```

(훅 호출이 모두 끝난 뒤라 훅 순서 규칙을 어기지 않는다.)

- [ ] **Step 3: CSS**

`src/App.css` 끝에 추가:

```css
.fallback { max-width: 720px; height: 100%; overflow-y: auto; margin: 0 auto; padding: var(--gutter); line-height: 1.6; }
.fallback h2 { font-size: 15px; color: var(--muted); margin-top: 24px; }
.fallback ul { padding-left: 18px; font-size: 14px; }
```

- [ ] **Step 4: 확인**

임시로 `const webgl = false;`로 바꿔 `npm run dev`에서 목록이 나오는지 보고 되돌린다(커밋 전 반드시 원복).

Run: `npm run lint && npm run build && npm run check`

- [ ] **Step 5: 커밋**

```bash
git add -A
git commit -m "WebGL이 없으면 최근 기록을 목록으로 보여준다" -m "3D를 못 그리는 브라우저에서도 같은 데이터를 읽을 수 있게 한다.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: README·출시 전 수동 점검

**Files:**
- Create: `README.md`(템플릿 README를 덮어쓴다), `docs/demo.gif`

- [ ] **Step 1: 출시 전 수동 점검**

`npm run build && npm run preview`(http://localhost:4173)로 확인한다:
- 데스크톱 Chrome·Safari: Task 6~8의 확인 항목 전부.
- 모바일 375px: 가로 스크롤 없음, 스크러버 터치 높이 44px, 카드가 아래 시트.
- 오프라인: 한 번 연 뒤 Network를 Offline으로 두고 새로고침 → 캐시가 있는 발사·ISS는 그려지고, 지진은 1분 넘게 지났으면 "N분 전 데이터"가 보인다(빈 화면 아님). 다만 정적 파일 자체는 서비스 워커가 없어 오프라인 새로고침이 안 될 수 있으니, 이 항목은 Network를 "Offline" 대신 세 API 도메인 차단으로 확인한다.
- macOS 손쉬운 사용 > 동작 줄이기를 켜면 자동 회전·링·라이브 점 깜빡임이 멈춘다.

- [ ] **Step 2: 데모 GIF**

`npm run preview` 화면을 15초 녹화해(라이브 → ▶ 1d/s 재생 → 지진 클릭 → ISS 따라가기) `docs/demo.gif`(가로 960px 이하, 5MB 이하)로 저장한다.

- [ ] **Step 3: README.md**

```markdown
# Planet Pulse

지난 7일간 지구에서 일어난 지진·로켓 발사·ISS 궤도를 3D 지구본 위에서 되감아 보는 웹 페이지.

![demo](docs/demo.gif)

- 사이트: https://planet-pulse.joon.is-a.dev
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

지구 텍스처는 [three-globe](https://github.com/vasturiano/three-globe) 예제 이미지(NASA)다.
```

- [ ] **Step 4: 커밋**

```bash
git add -A
git commit -m "README와 데모 GIF를 추가한다" -m "포트폴리오 링크로 들어온 사람이 데이터 출처와 ISS 계산 방식을 바로 알 수 있게 한다.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 11: 공개·배포·포트폴리오 등록 (사용자 확인 필요)

외부에 공개되는 작업이라 **단계마다 사용자에게 확인을 받은 뒤** 진행한다.

- [ ] **Step 1: GitHub 공개 레포 생성과 push (확인 후)**

```bash
cd /Users/junhookim/github/teiresias/planet-pulse
gh repo create teiresias22/planet-pulse --public --source . --remote origin --push
```

Expected: `https://github.com/teiresias22/planet-pulse`에 `master`가 올라가고 Actions `ci`가 초록.

- [ ] **Step 2: Vercel 연결 (사용자 작업)**

Vercel 대시보드에서 레포를 import한다(Framework: Vite, 루트 `/`, Build `npm run build`, Output `dist`). 누렁소검은소와 같은 방식으로 `planet-pulse.joon.is-a.dev` 도메인을 붙인다(DNS 레코드는 사용자가 추가).

- [ ] **Step 3: 배포 확인**

`https://planet-pulse.joon.is-a.dev`를 내장 브라우저로 열어 Task 10 Step 1 항목을 한 번 더 본다. 특히 세 API가 배포 도메인에서도 CORS로 막히지 않는지 Console을 확인한다.

- [ ] **Step 4: joon-dev-web·portfolio 등록 (확인 후)**

- `joon-dev-web/apps.config.json`에 누렁소검은소 항목(`"id": "nureongso"`, 외부 `url`)과 같은 모양으로 `planet-pulse` 항목을 더한다(아이콘은 `public/external/planet-pulse.png`).
- `portfolio/content/resume.ko.md`·`resume.en.md`·`career.ko.md`·`career.en.md`에 누렁소검은소 행과 같은 형식으로 추가: `Vite · React · Three.js(globe.gl) · satellite.js · 공개 API 3종 정규화 · Vercel`.
- 각 레포의 규칙(CLAUDE.md)대로 커밋하고, push는 사용자 확인 후.
