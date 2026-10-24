import { test } from 'node:test';
import assert from 'node:assert/strict';
import { auroraRings, gScale, GEOMAG_NORTH, kpAt, KP_BLOCK_MS, ovalLatitude, ring } from './aurora.ts';

const R = Math.PI / 180;
// 두 점 사이 각거리(도)
const dist = (a, b) =>
  Math.acos(Math.min(1, Math.sin(a.lat * R) * Math.sin(b.lat * R) + Math.cos(a.lat * R) * Math.cos(b.lat * R) * Math.cos((a.lng - b.lng) * R))) / R;

const T = Date.UTC(2026, 9, 24, 0);
const pts = [
  { time: T, kp: 5.33, kind: 'observed' },
  { time: T + KP_BLOCK_MS, kp: 1.67, kind: 'estimated' },
];

test('kpAt: 구간 시작 포함, 3시간 뒤 제외, 범위 밖은 null', () => {
  assert.equal(kpAt(pts, T).kp, 5.33);
  assert.equal(kpAt(pts, T + KP_BLOCK_MS - 1).kp, 5.33);
  assert.equal(kpAt(pts, T + KP_BLOCK_MS).kp, 1.67);
  assert.equal(kpAt(pts, T + 2 * KP_BLOCK_MS), null);
  assert.equal(kpAt(pts, T - 1), null);
});

test('ovalLatitude = 66.5 − 2·Kp', () => {
  assert.equal(ovalLatitude(0), 66.5);
  assert.equal(ovalLatitude(7), 52.5);
});

test('gScale: Kp 5부터 G1, 9는 G5', () => {
  assert.deepEqual([4.67, 5, 5.33, 6, 7, 8, 9].map(gScale), [0, 1, 1, 2, 3, 4, 5]);
});

test('ring: 모든 점이 자기극에서 같은 각거리, 경도 [-180, 180), 닫혀 있다', () => {
  const pts = ring(GEOMAG_NORTH, 60);
  assert.equal(pts.length, 73);
  assert.deepEqual(pts[0], pts[72]);
  for (const p of pts) {
    assert.ok(Math.abs(dist(p, GEOMAG_NORTH) - 30) < 1e-6);
    assert.ok(p.lng >= -180 && p.lng < 180);
  }
});

test('ring: 극이 지리 북극이면 위도가 자기위도와 같다', () => {
  for (const p of ring({ lat: 90, lng: 0 }, 65)) assert.ok(Math.abs(p.lat - 65) < 1e-9);
});

test('auroraRings: [북 남쪽경계, 북 북쪽경계, 남 남쪽경계, 남 북쪽경계]', () => {
  const rs = auroraRings(2);
  assert.equal(rs.length, 4);
  assert.ok(Math.abs(dist(rs[0][0], GEOMAG_NORTH) - (90 - 62.5)) < 1e-6);
  assert.ok(Math.abs(dist(rs[1][0], GEOMAG_NORTH) - (90 - 70.5)) < 1e-6);
  assert.ok(rs[2].every((p) => p.lat < 0));
});
