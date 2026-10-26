export const TYPES = ['container', 'dry_bulk', 'general_cargo', 'roro', 'tanker'];
export const TOP_PORTS = 300;
export const MIN_PORTS = 100; // 이보다 적으면 PortWatch 부분 응답으로 보고 직전 값을 쓴다
export const MIN_CHOKEPOINTS = 20; // 해협도 같다 — 이보다 적으면 부분 응답으로 보고 직전 값을 쓴다
export const BASE_DAYS = 90;

// 합계·선종 필드 이름이 항만(portcalls_*)과 해협(n_*)에서 다르다
export const FIELDS = {
  port: { total: 'portcalls', type: (k) => `portcalls_${k}` },
  chokepoint: { total: 'n_total', type: (k) => `n_${k}` },
};

const DAY_MS = 86_400_000;
const utc = (date) => Date.parse(`${date}T00:00:00Z`);
const num = (x) => (typeof x === 'number' && Number.isFinite(x) ? x : 0);

export function shiftDate(date, d) {
  return new Date(utc(date) + d * DAY_MS).toISOString().slice(0, 10);
}

// id는 ArcGIS where 절(portid IN (...))에 그대로 들어가므로 영숫자만 받는다
export function topSums(rows, n = Infinity) {
  const ok = rows.filter((r) => typeof r?.portid === 'string' && /^\w+$/.test(r.portid) && typeof r.n === 'number');
  ok.sort((a, b) => b.n - a.n);
  return new Map(ok.slice(0, n).map((r) => [r.portid, r.n]));
}

// recent = through 포함 최근 7일 행, baseSums = 그 앞 90일 합(id → 합)
export function buildItems(kind, { through, meta, baseSums, recent }) {
  const f = FIELDS[kind];
  const from = utc(shiftDate(through, -6));
  const byId = new Map();
  for (const m of meta) {
    if (!baseSums.has(m.portid) || typeof m.lat !== 'number' || typeof m.lon !== 'number') continue;
    byId.set(m.portid, {
      id: m.portid,
      kind,
      name: String(m.portname ?? ''),
      country: String(m.country ?? ''),
      lat: m.lat,
      lng: m.lon,
      days: [0, 0, 0, 0, 0, 0, 0],
      base: Math.round((baseSums.get(m.portid) / BASE_DAYS) * 10) / 10,
      byType: Object.fromEntries(TYPES.map((k) => [k, 0])),
    });
  }
  for (const r of recent) {
    const p = byId.get(r.portid);
    if (!p || typeof r.date !== 'string') continue;
    const i = (utc(r.date) - from) / DAY_MS;
    if (!Number.isInteger(i) || i < 0 || i > 6) continue;
    p.days[i] += num(r[f.total]);
    for (const k of TYPES) p.byType[k] += num(r[f.type(k)]);
  }
  return [...byId.values()];
}
