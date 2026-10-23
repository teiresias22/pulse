import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { isTleStale, makePropagator, orbitPath, parseTle } from './iss.ts';

const { tle: raw, reference: ref } = JSON.parse(
  readFileSync(new URL('./fixtures/tle.json', import.meta.url), 'utf8'),
);

function km(a, b) {
  const R = 6371;
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLng = (b.lng - a.lng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

test('parseTle: 정상 응답 → epoch ms 포함', () => {
  assert.deepEqual(parseTle(raw), { line1: raw.line1, line2: raw.line2, epoch: 1792544939000 });
});

test('parseTle: 필드가 빠지면 null', () => {
  assert.equal(parseTle(null), null);
  assert.equal(parseTle({ line1: 'x' }), null);
  assert.equal(parseTle({ line1: 'x', line2: 'y', tle_timestamp: 'z' }), null);
});

test('계산 위치가 같은 시각 실제 위치와 50km 안', () => {
  const positionAt = makePropagator(parseTle(raw));
  const p = positionAt(ref.timestamp * 1000);
  assert.ok(p, 'propagate 결과가 있어야 한다');
  const d = km(p, { lat: ref.latitude, lng: ref.longitude });
  assert.ok(d < 50, `거리 ${d.toFixed(2)}km`);
  assert.ok(Math.abs(p.altKm - ref.altitude) < 5);
});

test('orbitPath: t±45분을 1분 간격으로 91개, 가운데가 t의 위치', () => {
  const positionAt = makePropagator(parseTle(raw));
  const t = ref.timestamp * 1000;
  const path = orbitPath(positionAt, t);
  assert.equal(path.length, 91);
  assert.deepEqual(path[45], positionAt(t));
});

test('isTleStale: epoch로부터 7일 넘으면 true', () => {
  const tle = parseTle(raw);
  const DAY = 86_400_000;
  assert.equal(isTleStale(tle, tle.epoch + 7 * DAY), false);
  assert.equal(isTleStale(tle, tle.epoch + 7 * DAY + 1), true);
});
