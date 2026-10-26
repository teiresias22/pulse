import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { makePropagator, mergeSats, parseSats, STATION_IDS } from './satellites.ts';

const fx = JSON.parse(readFileSync(new URL('./fixtures/celestrak.json', import.meta.url), 'utf8'));

test('parseSats: 저궤도만, DEB·R/B·형식 오류 제외, 정거장 판별', () => {
  const st = parseSats(fx.stations);
  assert.deepEqual(st.map((s) => [s.id, s.name, s.kind]), [
    [25544, 'ISS (ZARYA)', 'station'],
    [48274, 'CSS (TIANHE)', 'station'],
    [100057, 'SOYUZ-MS 29', 'sat'],
  ]);
  // CXO(하루 0.38바퀴)·BROKEN은 빠지고 ISS 사본은 남는다(중복은 mergeSats가 정리)
  assert.deepEqual(parseSats(fx.science).map((s) => s.name), ['HST', 'ISS (ZARYA)']);
  assert.deepEqual(STATION_IDS, [25544, 48274]);
});

test('parseSats: EPOCH는 Z 없는 UTC, 주기 = 1440 / MEAN_MOTION, 경사각', () => {
  const [iss] = parseSats(fx.stations);
  assert.equal(iss.epoch, Date.parse('2026-10-25T15:04:58.336608Z'));
  assert.equal(iss.periodMin, 1440 / 15.49052179);
  assert.equal(iss.inclination, 51.6337);
});

test('parseSats: 배열이 아니면 빈 배열', () => {
  assert.deepEqual(parseSats(null), []);
  assert.deepEqual(parseSats({}), []);
});

test('mergeSats: 앞 목록 우선, id 중복 제거, 순서 유지', () => {
  const all = mergeSats([parseSats(fx.stations), parseSats(fx.science)]);
  assert.deepEqual(all.map((s) => s.id), [25544, 48274, 100057, 20580]);
});

test('makePropagator: epoch에서 ISS 고도 300–500km, 위도는 경사각 이내', () => {
  const [iss] = parseSats(fx.stations);
  const p = makePropagator(iss)(iss.epoch);
  assert.ok(p);
  assert.ok(p.altKm > 300 && p.altKm < 500, `alt ${p.altKm}`);
  assert.ok(Math.abs(p.lat) <= 51.7);
  assert.ok(Math.abs(p.lng) <= 180);
});
