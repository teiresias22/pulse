import { degreesLat, degreesLong, eciToGeodetic, gstime, json2satrec, propagate, type OMMJsonObject } from 'satellite.js';
import { DAY, isNum, type Loaded, type Sat, type SatPos } from '../model.ts';
import { withCache } from '../lib/cache.ts';
import { fetchJson } from './http.ts';

const GROUPS = ['stations', 'science'] as const;
const url = (g: (typeof GROUPS)[number]) => `https://celestrak.org/NORAD/elements/gp.php?GROUP=${g}&FORMAT=json`;

// 정거장 본체: ISS (ZARYA), CSS (TIANHE). 도킹한 우주선·모듈은 이 둘과 같은 자리에 있다
export const STATION_IDS = [25544, 48274];
// 하루 11바퀴 이하는 고궤도(지구 반지름의 수 배 밖) — 화면에 안 들어온다
const MIN_MEAN_MOTION = 11;

type Omm = { OBJECT_NAME?: unknown; NORAD_CAT_ID?: unknown; EPOCH?: unknown; MEAN_MOTION?: unknown; INCLINATION?: unknown };

export function makePropagator(sat: Sat): (t: number) => SatPos | null {
  const rec = json2satrec(sat.omm as unknown as OMMJsonObject);
  return (t) => {
    const date = new Date(t);
    const pv = propagate(rec, date);
    if (!pv) return null;
    const geo = eciToGeodetic(pv.position, gstime(date));
    const p = { lat: degreesLat(geo.latitude), lng: degreesLong(geo.longitude), altKm: geo.height };
    return isNum(p.lat) && isNum(p.lng) && isNum(p.altKm) ? p : null;
  };
}

export function parseSats(json: unknown): Sat[] {
  if (!Array.isArray(json)) return [];
  const out: Sat[] = [];
  for (const o of json as (Omm | null)[]) {
    if (!o || typeof o.OBJECT_NAME !== 'string' || !isNum(o.NORAD_CAT_ID) || !isNum(o.MEAN_MOTION) || !isNum(o.INCLINATION)) continue;
    if (o.MEAN_MOTION <= MIN_MEAN_MOTION || /\b(DEB|R\/B)\b/.test(o.OBJECT_NAME)) continue;
    // EPOCH는 Z 없는 UTC
    const epoch = typeof o.EPOCH === 'string' ? Date.parse(`${o.EPOCH}Z`) : NaN;
    if (!isNum(epoch)) continue;
    const sat: Sat = {
      id: o.NORAD_CAT_ID,
      name: o.OBJECT_NAME,
      kind: STATION_IDS.includes(o.NORAD_CAT_ID) ? 'station' : 'sat',
      epoch,
      periodMin: 1440 / o.MEAN_MOTION,
      inclination: o.INCLINATION,
      omm: o as Record<string, unknown>,
    };
    // 궤도 요소가 빠졌거나 틀리면 json2satrec이 던지거나 위치가 NaN이다
    try {
      if (!makePropagator(sat)(epoch)) continue;
    } catch {
      continue;
    }
    out.push(sat);
  }
  return out;
}

export function mergeSats(lists: Sat[][]): Sat[] {
  const seen = new Set<number>();
  return lists.flat().filter((s) => !seen.has(s.id) && Boolean(seen.add(s.id)));
}

// 그룹 하나만 실패해도 받은 그룹은 보인다(stale로 표시). 둘 다 실패하면 던진다
export async function loadSats(now = Date.now()): Promise<Loaded<Sat[]>> {
  const rs = await Promise.allSettled(
    GROUPS.map((g) =>
      withCache(`pp:sat:${g}`, DAY, now, async () => {
        const sats = parseSats(await fetchJson(url(g), 15_000));
        if (!sats.length) throw new Error(`no satellites in ${g}`);
        return sats;
      }),
    ),
  );
  const ok = rs.flatMap((r) => (r.status === 'fulfilled' ? [r.value] : []));
  if (!ok.length) throw new Error('no satellites');
  return {
    value: mergeSats(ok.map((r) => r.value)),
    fetchedAt: Math.max(...ok.map((r) => r.fetchedAt)),
    stale: ok.length < rs.length || ok.some((r) => r.stale),
  };
}
