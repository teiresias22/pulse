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
