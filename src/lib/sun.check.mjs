import { test } from 'node:test';
import assert from 'node:assert/strict';
import { antipode, subsolarPoint, sunVector } from './sun.ts';

const at = (iso) => subsolarPoint(Date.parse(iso));
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a} vs ${b}`);

test('하지·동지·춘분 적위', () => {
  near(at('2026-06-21T12:00:00Z').lat, 23.44, 0.3, '하지');
  near(at('2026-12-21T12:00:00Z').lat, -23.44, 0.3, '동지');
  near(at('2026-03-20T12:00:00Z').lat, 0, 0.6, '춘분');
});

test('정오 UTC 직하점 경도는 균시차만큼만 벗어난다', () => {
  near(at('2026-06-21T12:00:00Z').lng, 0, 4.5, '6월');
  // 11월 초 균시차 +16분 → 경도 약 -4.1°
  near(at('2026-11-03T12:00:00Z').lng, -4.1, 0.5, '11월');
  // 2월 중순 균시차 -14분 → 경도 약 +3.6°
  near(at('2026-02-11T12:00:00Z').lng, 3.6, 0.5, '2월');
});

test('6시간 뒤 직하점은 서쪽으로 약 90° 이동', () => {
  const a = at('2026-06-21T12:00:00Z').lng;
  const b = at('2026-06-21T18:00:00Z').lng;
  near(b - a, -90, 1, '6시간');
});

test('경도는 [-180, 180) 범위', () => {
  for (let h = 0; h < 48; h++) {
    const { lat, lng } = subsolarPoint(Date.parse('2026-10-24T00:00:00Z') + h * 3_600_000);
    assert.ok(lng >= -180 && lng < 180, `lng ${lng}`);
    assert.ok(Math.abs(lat) <= 23.5, `lat ${lat}`);
  }
});

test('antipode: 위도 부호 반전, 경도 180° 이동', () => {
  assert.deepEqual(antipode({ lat: 23, lng: 10 }), { lat: -23, lng: -170 });
  assert.deepEqual(antipode({ lat: 0, lng: -170 }), { lat: -0, lng: 10 });
});

test('sunVector: three-globe 좌표 규약', () => {
  const close = (v, w) => v.forEach((x, i) => near(x, w[i], 1e-9, `축 ${i}`));
  close(sunVector({ lat: 0, lng: 0 }), [0, 0, 1]);
  close(sunVector({ lat: 0, lng: 90 }), [1, 0, 0]);
  close(sunVector({ lat: 90, lng: 0 }), [0, 1, 0]);
});
