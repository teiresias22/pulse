import { test } from 'node:test';
import assert from 'node:assert/strict';
import { daysBehind, portRatio, portTrend, portWindow, typeShares } from './ports.ts';

test('portRatio: 최근 7일 하루 평균 ÷ base, base 0이면 null', () => {
  assert.equal(portRatio({ days: [10, 10, 10, 10, 10, 10, 10], base: 10 }), 1);
  assert.equal(portRatio({ days: [7, 7, 7, 7, 7, 7, 7], base: 10 }), 0.7);
  assert.equal(portRatio({ days: [1, 1, 1, 1, 1, 1, 1], base: 0 }), null);
});

test('portTrend: 경계 0.7 · 0.9 · 1.1 · 1.3', () => {
  assert.equal(portTrend(0.7), 'down2');
  assert.equal(portTrend(0.71), 'down');
  assert.equal(portTrend(0.9), 'normal');
  assert.equal(portTrend(1.1), 'normal');
  assert.equal(portTrend(1.2), 'up');
  assert.equal(portTrend(1.3), 'up2');
  assert.equal(portTrend(null), 'normal');
});

test('portWindow·daysBehind: through 포함 7일, 지연 일수', () => {
  assert.deepEqual(portWindow('2026-10-16'), { from: Date.UTC(2026, 9, 10), to: Date.UTC(2026, 9, 16) });
  assert.equal(daysBehind('2026-10-16', Date.UTC(2026, 9, 26, 12)), 10);
});

test('typeShares: 0 제외, 큰 순 최대 3개', () => {
  assert.deepEqual(typeShares({ container: 6, dry_bulk: 0, general_cargo: 1, roro: 1, tanker: 2 }), [
    { type: 'container', share: 0.6 },
    { type: 'tanker', share: 0.2 },
    { type: 'general_cargo', share: 0.1 },
  ]);
  assert.deepEqual(typeShares({ container: 0, dry_bulk: 0, general_cargo: 0, roro: 0, tanker: 0 }), []);
});
