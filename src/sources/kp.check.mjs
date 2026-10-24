import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseKp } from './kp.ts';

const fixture = JSON.parse(readFileSync(new URL('./fixtures/kp.json', import.meta.url), 'utf8'));

test('Z 없는 시각은 UTC로 읽고 시각순으로 정렬, 이상한 행은 버린다', () => {
  assert.deepEqual(parseKp(fixture), [
    { time: Date.UTC(2026, 9, 17, 0), kp: 2, kind: 'observed' },
    { time: Date.UTC(2026, 9, 24, 0), kp: 5.33, kind: 'observed' },
    { time: Date.UTC(2026, 9, 24, 3), kp: 1.67, kind: 'estimated' },
    { time: Date.UTC(2026, 9, 26, 0), kp: 3, kind: 'predicted' },
  ]);
});

test('형식이 다르면 빈 배열', () => {
  assert.deepEqual(parseKp(null), []);
  assert.deepEqual(parseKp({}), []);
});
