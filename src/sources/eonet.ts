import { httpUrl, isNum, MINUTE, validCoord, type Loaded, type PulseEvent, type Storm, type StormFix } from '../model.ts';
import { withCache } from '../lib/cache.ts';
import { fetchJson } from './http.ts';

// 끝난 이벤트도 받아야 스크러버로 지난 7일을 되감을 때 그 시점의 태풍·산불이 보인다
const URL = 'https://eonet.gsfc.nasa.gov/api/v3/events?status=all&days=7&category=severeStorms,wildfires';

type Geometry = { magnitudeValue?: unknown; magnitudeUnit?: unknown; date?: unknown; type?: unknown; coordinates?: unknown };
type EonetEvent = {
  id?: unknown;
  title?: unknown;
  closed?: unknown;
  categories?: ({ id?: unknown } | null)[] | null;
  sources?: ({ url?: unknown } | null)[] | null;
  geometry?: unknown;
};

export type EonetData = { storms: Storm[]; fires: PulseEvent[] };

function point(g: Geometry): { time: number; lat: number; lng: number } | null {
  if (g.type !== 'Point' || !Array.isArray(g.coordinates) || typeof g.date !== 'string') return null;
  const [lng, lat] = g.coordinates as unknown[];
  const time = Date.parse(g.date);
  if (!isNum(lat) || !isNum(lng) || !validCoord(lat, lng) || !isNum(time)) return null;
  return { time, lat, lng };
}

function parseTime(x: unknown): number | null {
  const ms = typeof x === 'string' ? Date.parse(x) : NaN;
  return isNum(ms) ? ms : null;
}

export function parseEonet(json: unknown): EonetData {
  const out: EonetData = { storms: [], fires: [] };
  const events = (json as { events?: unknown } | null)?.events;
  if (!Array.isArray(events)) return out;
  for (const e of events as (EonetEvent | null)[]) {
    if (!e || typeof e.id !== 'string' || !Array.isArray(e.geometry)) continue;
    const geometry = (e.geometry as (Geometry | null)[]).filter((g): g is Geometry => g !== null && typeof g === 'object');
    const category = e.categories?.[0]?.id;
    const name = String(e.title ?? '');
    const url = httpUrl(e.sources?.[0]?.url);
    const closed = parseTime(e.closed);
    if (category === 'severeStorms') {
      // ponytail: 태풍은 kts 관측점만 쓴다 — 기압(mb) 점은 경로 색·세기 표시에 쓰지 않는다
      const track: StormFix[] = [];
      for (const g of geometry) {
        const p = point(g);
        if (p && g.magnitudeUnit === 'kts' && isNum(g.magnitudeValue)) track.push({ ...p, kts: g.magnitudeValue });
      }
      if (track.length === 0) continue;
      track.sort((a, b) => a.time - b.time);
      out.storms.push({ id: e.id, name, track, closed, url });
    } else if (category === 'wildfires') {
      const g = geometry[0];
      const p = g ? point(g) : null;
      if (!g || !p) continue;
      out.fires.push({
        id: e.id,
        kind: 'fire',
        time: p.time,
        ...(closed !== null ? { endTime: closed } : {}),
        lat: p.lat,
        lng: p.lng,
        ...(g.magnitudeUnit === 'acres' && isNum(g.magnitudeValue) ? { magnitude: g.magnitudeValue } : {}),
        label: name,
        url,
      });
    }
  }
  return out;
}

export function loadEonet(now = Date.now()): Promise<Loaded<EonetData>> {
  // 태풍 위치는 6시간 간격으로 갱신된다 — 30분이면 충분하다
  return withCache('pp:eonet', 30 * MINUTE, now, async () => parseEonet(await fetchJson(URL, 15_000)));
}
