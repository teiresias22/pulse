import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ENTER_TILES, EXIT_TILES, nextMode } from './globeMode.ts';

test('경계값', () => {
  assert.equal(ENTER_TILES, 0.6);
  assert.equal(EXIT_TILES, 0.8);
});

test('shader에서는 0.6 미만일 때만 tiles로', () => {
  assert.equal(nextMode('shader', 0.61), 'shader');
  assert.equal(nextMode('shader', 0.6), 'shader');
  assert.equal(nextMode('shader', 0.59), 'tiles');
});

test('tiles에서는 0.8 초과일 때만 shader로', () => {
  assert.equal(nextMode('tiles', 0.79), 'tiles');
  assert.equal(nextMode('tiles', 0.8), 'tiles');
  assert.equal(nextMode('tiles', 0.81), 'shader');
});

test('흔들림 방지: 0.6~0.8 사이에서는 지금 모드를 유지', () => {
  assert.equal(nextMode('shader', 0.7), 'shader');
  assert.equal(nextMode('tiles', 0.7), 'tiles');
});
