import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  activeRings, quakeOpacity, ringProgress, RING_MS, timeRange, visibleLaunches, visibleQuakes, WINDOW_MS,
} from './timeline.ts';

const H = 3_600_000;
const T = 1_800_000_000_000;
const q = (id, time, magnitude = 3) => ({ id, kind: 'quake', time, lat: 0, lng: 0, magnitude, label: id, url: '' });
const l = (id, time, status) => ({ id, kind: 'launch', time, lat: 0, lng: 0, status, label: id, url: '' });

test('timeRange: 지금 ±7일', () => {
  assert.deepEqual(timeRange(T), { min: T - WINDOW_MS, max: T + WINDOW_MS });
  assert.equal(WINDOW_MS, 7 * 24 * H);
});

test('visibleQuakes: t 이하이고 7일 창 안만', () => {
  const evs = [q('future', T + 1), q('now', T), q('edge', T - WINDOW_MS), q('in', T - WINDOW_MS + 1)];
  assert.deepEqual(visibleQuakes(evs, T).map((e) => e.id), ['now', 'in']);
});

test('visibleQuakes: 발사는 섞이지 않는다', () => {
  assert.deepEqual(visibleQuakes([l('x', T - 1, 'success')], T), []);
});

test('visibleLaunches: 예정은 항상, 나머지는 t 이하만', () => {
  const evs = [l('up', T + H, 'upcoming'), l('done', T - H, 'success'), l('later', T + H, 'success')];
  assert.deepEqual(visibleLaunches(evs, T).map((e) => e.id), ['up', 'done']);
});

test('quakeOpacity: 막 생기면 1, 7일 지나면 하한 0.15', () => {
  assert.equal(quakeOpacity(q('a', T), T), 1);
  assert.equal(quakeOpacity(q('a', T - WINDOW_MS / 2), T), 0.5);
  assert.equal(quakeOpacity(q('a', T - WINDOW_MS), T), 0.15);
});

test('ringProgress: 발생 순간 0 → 3시간 뒤 직전까지 1 미만, 밖이면 null', () => {
  assert.equal(RING_MS, 3 * H);
  assert.equal(ringProgress(T, T), 0);
  assert.equal(ringProgress(T, T + RING_MS / 2), 0.5);
  assert.equal(ringProgress(T, T + RING_MS), null);
  assert.equal(ringProgress(T, T - 1), null);
});

test('activeRings: 규모 2.5 이상이고 링 창 안인 지진만', () => {
  const evs = [q('big', T - H, 4), q('small', T - H, 1.2), q('old', T - 4 * H, 5)];
  assert.deepEqual(activeRings(evs, T).map((e) => e.id), ['big']);
});
