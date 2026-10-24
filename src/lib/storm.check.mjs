import { test } from 'node:test';
import assert from 'node:assert/strict';
import { OPEN_LINGER_MS, stormAt, stormCategory, trackUntil } from './storm.ts';

const H = 3_600_000;
const T0 = Date.UTC(2026, 9, 21, 0);
const fix = (h, lat, lng, kts) => ({ time: T0 + h * H, lat, lng, kts });
const storm = (track, closed = null) => ({ id: 's', name: 'S', track, closed, url: '' });

test('관측점 사이는 위도·경도·풍속을 직선 보간', () => {
  const s = storm([fix(0, 10, 100, 40), fix(6, 16, 106, 70)]);
  assert.deepEqual(stormAt(s, T0 + 3 * H), { lat: 13, lng: 103, kts: 55 });
});

test('날짜변경선은 짧은 쪽으로 건너고 [-180, 180)로 되돌린다', () => {
  const s = storm([fix(0, 10, 179, 40), fix(6, 10, -179, 40)]);
  assert.equal(stormAt(s, T0 + 1.5 * H).lng, 179.5);
  assert.equal(stormAt(s, T0 + 4.5 * H).lng, -179.5);
});

test('첫 관측 전에는 없다', () => {
  assert.equal(stormAt(storm([fix(0, 10, 100, 40)]), T0 - 1), null);
});

test('진행 중: 마지막 관측 뒤 24시간까지 마지막 위치, 넘으면 없다', () => {
  const s = storm([fix(0, 10, 100, 40), fix(6, 12, 102, 50)]);
  const last = T0 + 6 * H;
  assert.deepEqual(stormAt(s, last + OPEN_LINGER_MS), { lat: 12, lng: 102, kts: 50 });
  assert.equal(stormAt(s, last + OPEN_LINGER_MS + 1), null);
});

test('끝난 태풍: 마지막 관측 시각까지만', () => {
  const s = storm([fix(0, 10, 100, 40), fix(6, 12, 102, 50)], T0 + 7 * H);
  assert.deepEqual(stormAt(s, T0 + 6 * H), { lat: 12, lng: 102, kts: 50 });
  assert.equal(stormAt(s, T0 + 6 * H + 1), null);
});

test('등급 경계: 64·96노트', () => {
  assert.deepEqual([63, 64, 95, 96].map(stormCategory), ['ts', 'c12', 'c12', 'c3']);
});

test('trackUntil: 지난 관측점 + 현재 위치, 안 보이면 빈 배열', () => {
  const s = storm([fix(0, 10, 100, 40), fix(6, 16, 106, 70), fix(12, 22, 112, 80)]);
  assert.deepEqual(trackUntil(s, T0 + 9 * H), [
    { lat: 10, lng: 100 },
    { lat: 16, lng: 106 },
    { lat: 19, lng: 109 },
  ]);
  assert.deepEqual(trackUntil(s, T0 - 1), []);
});
