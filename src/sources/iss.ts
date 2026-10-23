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
