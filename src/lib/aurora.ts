import { HOUR, type KpPoint } from '../model.ts';
import type { GeoPoint } from './sun.ts';

export const KP_BLOCK_MS = 3 * HOUR;
// 지자기 극(IGRF 2025 근사). 남극은 북극의 반대편
export const GEOMAG_NORTH: GeoPoint = { lat: 80.8, lng: -72.6 };
export const GEOMAG_SOUTH: GeoPoint = { lat: -80.8, lng: 107.4 };
// 오로라 띠 폭(자기위도, 도)
export const OVAL_WIDTH = 8;

export function kpAt(points: KpPoint[], t: number): KpPoint | null {
  for (let i = points.length - 1; i >= 0; i--) {
    const p = points[i];
    if (p && p.time <= t) return t < p.time + KP_BLOCK_MS ? p : null;
  }
  return null;
}

// 오로라 띠 남쪽 경계의 자기위도 근사. Kp가 1 오를 때마다 약 2°씩 적도 쪽으로 내려온다
export function ovalLatitude(kp: number): number {
  return 66.5 - 2 * kp;
}

// NOAA 지자기폭풍 등급: Kp 5 = G1 … Kp 9 = G5
export function gScale(kp: number): number {
  return kp >= 5 ? Math.min(5, Math.floor(kp) - 4) : 0;
}

const R = Math.PI / 180;

// pole에서 각거리 (90 − magLat)°인 원. 구면 목적지 공식으로 n등분, 첫 점을 끝에 한 번 더 넣어 닫는다
export function ring(pole: GeoPoint, magLat: number, n = 72): GeoPoint[] {
  const d = (90 - magLat) * R;
  const p1 = pole.lat * R;
  const l1 = pole.lng * R;
  const out: GeoPoint[] = [];
  for (let i = 0; i <= n; i++) {
    const b = ((i % n) / n) * 2 * Math.PI;
    const p2 = Math.asin(Math.sin(p1) * Math.cos(d) + Math.cos(p1) * Math.sin(d) * Math.cos(b));
    const l2 = l1 + Math.atan2(Math.sin(b) * Math.sin(d) * Math.cos(p1), Math.cos(d) - Math.sin(p1) * Math.sin(p2));
    out.push({ lat: p2 / R, lng: ((((l2 / R + 180) % 360) + 360) % 360) - 180 });
  }
  return out;
}

// [북 남쪽경계, 북 북쪽경계, 남 남쪽경계, 남 북쪽경계]
export function auroraRings(kp: number): GeoPoint[][] {
  const eq = ovalLatitude(kp);
  const pole = eq + OVAL_WIDTH;
  return [ring(GEOMAG_NORTH, eq), ring(GEOMAG_NORTH, pole), ring(GEOMAG_SOUTH, eq), ring(GEOMAG_SOUTH, pole)];
}
