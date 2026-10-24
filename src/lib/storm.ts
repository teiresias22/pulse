import { HOUR, type Storm } from '../model.ts';

export type StormCategory = 'ts' | 'c12' | 'c3';
export type StormPos = { lat: number; lng: number; kts: number };

// EONET 반영이 6~12시간 늦으므로 진행 중인 태풍은 마지막 관측 뒤 하루 동안 그 자리에 둔다.
// 그 뒤의 위치(예보)는 지어내지 않는다
export const OPEN_LINGER_MS = 24 * HOUR;

// 사피어-심프슨: 64노트부터 1등급, 96노트부터 3등급(강한 태풍)
export function stormCategory(kts: number): StormCategory {
  return kts >= 96 ? 'c3' : kts >= 64 ? 'c12' : 'ts';
}

function lerpLng(a: number, b: number, f: number): number {
  let d = b - a;
  if (d > 180) d -= 360;
  else if (d < -180) d += 360;
  const x = a + d * f;
  return x >= 180 ? x - 360 : x < -180 ? x + 360 : x;
}

export function stormAt(s: Storm, t: number): StormPos | null {
  const { track } = s;
  const first = track[0];
  const last = track.at(-1);
  if (!first || !last || t < first.time) return null;
  if (t >= last.time) {
    const until = s.closed === null ? last.time + OPEN_LINGER_MS : last.time;
    return t <= until ? { lat: last.lat, lng: last.lng, kts: last.kts } : null;
  }
  const i = track.findIndex((f) => f.time > t);
  const a = track[i - 1];
  const b = track[i];
  if (!a || !b) return null;
  const f = (t - a.time) / (b.time - a.time);
  return { lat: a.lat + (b.lat - a.lat) * f, lng: lerpLng(a.lng, b.lng, f), kts: a.kts + (b.kts - a.kts) * f };
}

// 지나온 경로: t까지의 관측점 + t의 위치
export function trackUntil(s: Storm, t: number): { lat: number; lng: number }[] {
  const pos = stormAt(s, t);
  if (!pos) return [];
  const past = s.track.filter((f) => f.time <= t).map(({ lat, lng }) => ({ lat, lng }));
  return [...past, { lat: pos.lat, lng: pos.lng }];
}
