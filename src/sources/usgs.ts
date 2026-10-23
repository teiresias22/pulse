import { httpUrl, isNum, MINUTE, validCoord, type Loaded, type PulseEvent } from '../model.ts';
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
      url: httpUrl(p.url),
    });
  }
  return out;
}

export function loadQuakes(now = Date.now()): Promise<Loaded<PulseEvent[]>> {
  // USGS가 60초 캐시를 쓰니 그보다 자주 받을 이유가 없다
  return withCache('pp:quakes', MINUTE, now, async () => parseUsgs(await fetchJson(URL)));
}
