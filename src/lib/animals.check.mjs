import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ANIMAL_WINDOW_MS, animalOpacity, cellKey, clusterAnimals, licenseLabel, visibleAnimals } from './animals.ts';

const T = 1_800_000_000_000;
const a = (id, group, lat, lng, time) => ({ id, group, name: '', sci: '', lat, lng, time, obscured: false, photo: null, license: null, by: '' });

test('cellKey: 4°×4°, 남서쪽 끝 0, 끝값은 마지막 칸', () => {
  assert.equal(cellKey(-90, -180), 0);
  assert.equal(cellKey(90, 180), 44 * 90 + 89);
  assert.equal(cellKey(-86, -180), 90);
  assert.equal(cellKey(-90, -176), 1);
});

test('visibleAnimals: 관찰 시각부터 7일 동안', () => {
  const items = [a(1, 'bear', 0, 0, T), a(2, 'bear', 0, 0, T + 1), a(3, 'bear', 0, 0, T - ANIMAL_WINDOW_MS), a(4, 'bear', 0, 0, T - ANIMAL_WINDOW_MS + 1)];
  assert.deepEqual(visibleAnimals(items, T).map((x) => x.id), [1, 4]);
});

test('animalOpacity: 막 관찰 1, 7일에 걸쳐 흐려지고 0.35 아래로 가지 않는다', () => {
  assert.equal(animalOpacity(a(1, 'bear', 0, 0, T), T), 1);
  assert.equal(animalOpacity(a(1, 'bear', 0, 0, T), T + ANIMAL_WINDOW_MS / 2), 0.5);
  assert.equal(animalOpacity(a(1, 'bear', 0, 0, T), T + ANIMAL_WINDOW_MS - 1) >= 0.35, true);
  assert.equal(animalOpacity(a(1, 'bear', 0, 0, T), T + ANIMAL_WINDOW_MS - 1), 0.35);
});

test('clusterAnimals: 같은 칸·같은 묶음은 하나, 최신순, 평균 위치 + 묶음별 경도 비킴', () => {
  // 칸 경계는 위도 -90+4k, 경도 -180+4k — (3,1)·(5,3)·(2,2)는 모두 위도 2–6°, 경도 0–4° 칸
  const cs = clusterAnimals([a(1, 'whale', 3, 1, T), a(2, 'whale', 5, 3, T + 5), a(3, 'bear', 2, 2, T), a(4, 'whale', 50, 50, T)]);
  const w = cs.find((c) => c.key === `whale:${cellKey(3, 1)}`);
  assert.equal(cellKey(3, 1), cellKey(5, 3));
  assert.deepEqual(w.items.map((x) => x.id), [2, 1]);
  assert.equal(w.lat, 4);
  assert.equal(w.lng, 2 + 6 * 0.6 - 1.8);
  const b = cs.find((c) => c.key === `bear:${cellKey(2, 2)}`);
  assert.equal(b.lng, 2 - 1.8);
  assert.equal(cs.length, 3);
});

test('licenseLabel: cc-by-nc → CC BY-NC, cc0 → CC0', () => {
  assert.equal(licenseLabel('cc-by-nc'), 'CC BY-NC');
  assert.equal(licenseLabel('cc0'), 'CC0');
});
