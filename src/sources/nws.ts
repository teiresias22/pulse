import { DAY, isNum, MINUTE, type Loaded, type TornadoWarning } from '../model.ts';
import { withCache } from '../lib/cache.ts';
import { fetchJson } from './http.ts';

const BASE = 'https://api.weather.gov/alerts?event=Tornado%20Warning&limit=500&start=';

type Props = {
  id?: unknown;
  messageType?: unknown;
  areaDesc?: unknown;
  headline?: unknown;
  sent?: unknown;
  effective?: unknown;
  onset?: unknown;
  expires?: unknown;
  ends?: unknown;
  references?: unknown;
};
type Feature = { geometry?: { type?: unknown; coordinates?: unknown } | null; properties?: Props | null };

function time(x: unknown): number {
  return typeof x === 'string' ? Date.parse(x) : NaN;
}

export function parseTornadoes(json: unknown): TornadoWarning[] {
  const features = (json as { features?: unknown } | null)?.features;
  if (!Array.isArray(features)) return [];
  const msgs: (TornadoWarning & { type: unknown; sent: number; refs: string[] })[] = [];
  for (const f of features as (Feature | null)[]) {
    const p = f?.properties;
    const g = f?.geometry;
    if (!p || typeof p.id !== 'string') continue;
    const start = time(p.onset ?? p.effective);
    const end = time(p.ends ?? p.expires);
    const sent = time(p.sent);
    const refs = Array.isArray(p.references)
      ? (p.references as ({ identifier?: unknown } | null)[]).flatMap((r) => (typeof r?.identifier === 'string' ? [r.identifier] : []))
      : [];
    msgs.push({
      id: p.id,
      type: p.messageType,
      start,
      end,
      sent,
      refs,
      area: String(p.areaDesc ?? ''),
      headline: String(p.headline ?? ''),
      geometry: g?.type === 'Polygon' && Array.isArray(g.coordinates)
        ? { type: 'Polygon', coordinates: g.coordinates as number[][][] }
        : { type: 'Polygon', coordinates: [] },
    });
  }
  // 갱신·취소가 가리킨 메시지는 그 갱신·취소가 나간 시각에 끝난다
  const cut = new Map<string, number>();
  for (const m of msgs) {
    if ((m.type === 'Update' || m.type === 'Cancel') && isNum(m.sent)) {
      for (const r of m.refs) cut.set(r, Math.min(cut.get(r) ?? Infinity, m.sent));
    }
  }
  const out: TornadoWarning[] = [];
  for (const m of msgs) {
    if (m.type === 'Cancel' || m.geometry.coordinates.length === 0) continue;
    const end = Math.min(m.end, cut.get(m.id) ?? Infinity);
    if (!isNum(m.start) || !isNum(end) || end <= m.start) continue;
    out.push({ id: m.id, start: m.start, end, area: m.area, headline: m.headline, geometry: m.geometry });
  }
  return out;
}

// 다각형 꼭짓점 평균(닫는 점 제외) — 멀리서도 보이게 마커를 둘 자리
export function tornadoCenter(w: TornadoWarning): { lat: number; lng: number } {
  const ring = w.geometry.coordinates[0] ?? [];
  const pts = ring.length > 1 ? ring.slice(0, -1) : ring;
  let lat = 0;
  let lng = 0;
  for (const [x = 0, y = 0] of pts) {
    lng += x;
    lat += y;
  }
  return { lat: lat / (pts.length || 1), lng: lng / (pts.length || 1) };
}

export function loadTornadoes(now = Date.now()): Promise<Loaded<TornadoWarning[]>> {
  const start = new Date(now - 7 * DAY).toISOString();
  // ponytail: 첫 페이지(최대 500건)만 받는다. 7일에 500건을 넘는 성수기에는 pagination.next를 따라가야 한다
  return withCache('pp:tornado', 15 * MINUTE, now, async () => parseTornadoes(await fetchJson(`${BASE}${start}`, 15_000)));
}
