import { DAY, MINUTE, type Sat, type SatPos } from '../model.ts';

export const DOCK_KM = 10;
export const SAT_STALE_MS = 7 * DAY;
const EARTH_KM = 6371;

// 화면에 넘기는 값: 보이는 위성과 t의 위치, 궤도선(정거장 + 선택한 위성)
export type SatOnGlobe = { sat: Sat; pos: SatPos };
export type SatOrbit = { id: number; points: SatPos[]; stale: boolean };

function xyz(p: SatPos): [number, number, number] {
  const r = EARTH_KM + p.altKm;
  const lat = (p.lat * Math.PI) / 180;
  const lng = (p.lng * Math.PI) / 180;
  return [r * Math.cos(lat) * Math.cos(lng), r * Math.cos(lat) * Math.sin(lng), r * Math.sin(lat)];
}

export function distanceKm(a: SatPos, b: SatPos): number {
  const [ax, ay, az] = xyz(a);
  const [bx, by, bz] = xyz(b);
  return Math.hypot(ax - bx, ay - by, az - bz);
}

// 정거장 본체 10km 안의 다른 위성은 도킹 중 — 위성 id → 정거장 id
export function dockedTo(sats: Sat[], pos: ReadonlyMap<number, SatPos>): Map<number, number> {
  const stations = sats.flatMap((s) => {
    const p = s.kind === 'station' ? pos.get(s.id) : undefined;
    return p ? [{ id: s.id, p }] : [];
  });
  const out = new Map<number, number>();
  for (const s of sats) {
    const p = s.kind === 'sat' ? pos.get(s.id) : undefined;
    if (!p) continue;
    const st = stations.find((x) => distanceKm(p, x.p) < DOCK_KM);
    if (st) out.set(s.id, st.id);
  }
  return out;
}

export function isSatStale(sat: Sat, now: number): boolean {
  return now - sat.epoch > SAT_STALE_MS;
}

export function orbitPath(
  positionAt: (t: number) => SatPos | null,
  t: number,
  spanMs = 45 * MINUTE,
  stepMs = MINUTE,
): SatPos[] {
  const out: SatPos[] = [];
  for (let s = t - spanMs; s <= t + spanMs; s += stepMs) {
    const p = positionAt(s);
    if (p) out.push(p);
  }
  return out;
}
