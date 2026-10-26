import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { distanceKm, dockedTo, isSatStale, orbitPath } from './satellites.ts';
import { makePropagator, parseSats } from '../sources/satellites.ts';

const fx = JSON.parse(readFileSync(new URL('../sources/fixtures/celestrak.json', import.meta.url), 'utf8'));
const sat = (id, kind) => ({ id, name: String(id), kind, epoch: 0, periodMin: 90, inclination: 51, omm: {} });
const DAY = 86_400_000;

test('distanceKm: 같은 위도·경도에서 고도 차이 = 거리', () => {
  assert.ok(Math.abs(distanceKm({ lat: 10, lng: 20, altKm: 400 }, { lat: 10, lng: 20, altKm: 409 }) - 9) < 1e-6);
});

test('dockedTo: 정거장 10km 미만은 도킹, 넘으면 아님, 정거장 본체는 대상 아님', () => {
  const sats = [sat(25544, 'station'), sat(1, 'sat'), sat(2, 'sat'), sat(48274, 'station')];
  const pos = new Map([
    [25544, { lat: 0, lng: 0, altKm: 400 }],
    [1, { lat: 0, lng: 0, altKm: 409 }],
    [2, { lat: 0, lng: 0, altKm: 411 }],
    [48274, { lat: 45, lng: 120, altKm: 405 }],
  ]);
  assert.deepEqual([...dockedTo(sats, pos)], [[1, 25544]]);
});

test('dockedTo: 위치가 없는 위성·정거장은 건너뛴다', () => {
  const sats = [sat(25544, 'station'), sat(1, 'sat')];
  assert.deepEqual([...dockedTo(sats, new Map([[1, { lat: 0, lng: 0, altKm: 400 }]]))], []);
});

test('dockedTo: 실제 fixture — 소유스 MS-29는 epoch에 ISS에 도킹', () => {
  const sats = parseSats(fx.stations);
  const t = sats[0].epoch;
  const pos = new Map(sats.map((s) => [s.id, makePropagator(s)(t)]));
  assert.equal(dockedTo(sats, pos).get(100057), 25544);
});

test('isSatStale: epoch로부터 7일 넘으면 true', () => {
  const s = { ...sat(1, 'sat'), epoch: 1_000 };
  assert.equal(isSatStale(s, 1_000 + 7 * DAY), false);
  assert.equal(isSatStale(s, 1_000 + 7 * DAY + 1), true);
});

test('orbitPath: t±45분을 1분 간격으로 91개, 가운데가 t의 위치', () => {
  const [iss] = parseSats(fx.stations);
  const positionAt = makePropagator(iss);
  const path = orbitPath(positionAt, iss.epoch);
  assert.equal(path.length, 91);
  assert.deepEqual(path[45], positionAt(iss.epoch));
});
