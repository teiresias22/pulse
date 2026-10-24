import { isNum, MINUTE, type KpPoint, type Loaded } from '../model.ts';
import { withCache } from '../lib/cache.ts';
import { fetchJson } from './http.ts';

// 지난 7일 관측 + 앞으로 약 3일 예보가 3시간 간격으로 한 파일에 들어 있다
const URL = 'https://services.swpc.noaa.gov/products/noaa-planetary-k-index-forecast.json';
const KINDS = ['observed', 'estimated', 'predicted'] as const;

type Row = { time_tag?: unknown; kp?: unknown; observed?: unknown };

export function parseKp(json: unknown): KpPoint[] {
  if (!Array.isArray(json)) return [];
  const out: KpPoint[] = [];
  for (const r of json as (Row | null)[]) {
    // time_tag는 Z 없는 UTC
    const time = typeof r?.time_tag === 'string' ? Date.parse(`${r.time_tag}Z`) : NaN;
    const kind = KINDS.find((k) => k === r?.observed);
    if (!r || !isNum(time) || !isNum(r.kp) || !kind) continue;
    out.push({ time, kp: r.kp, kind });
  }
  return out.sort((a, b) => a.time - b.time);
}

export function loadKp(now = Date.now()): Promise<Loaded<KpPoint[]>> {
  return withCache('pp:kp', 30 * MINUTE, now, async () => parseKp(await fetchJson(URL)));
}
