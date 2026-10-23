import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cacheRead, cacheWrite, isFresh, withCache } from './cache.ts';

function memStorage() {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => void m.set(k, String(v)),
  };
}
function throwingStorage() {
  const boom = () => {
    throw new Error('SecurityError');
  };
  return { getItem: boom, setItem: boom };
}

test('쓴 값을 savedAt과 함께 읽는다', () => {
  const s = memStorage();
  cacheWrite('k', { a: 1 }, 1000, s);
  assert.deepEqual(cacheRead('k', s), { savedAt: 1000, value: { a: 1 } });
});

test('없는 키·깨진 JSON은 null', () => {
  const s = memStorage();
  assert.equal(cacheRead('none', s), null);
  s.setItem('bad', '{not json');
  assert.equal(cacheRead('bad', s), null);
});

test('isFresh: maxAge 안이면 true, 경계와 그 뒤는 false', () => {
  const e = { savedAt: 1000 };
  assert.equal(isFresh(e, 500, 1499), true);
  assert.equal(isFresh(e, 500, 1500), false);
  assert.equal(isFresh(null, 500, 1000), false);
});

test('저장소가 예외를 던져도 읽기는 null, 쓰기는 조용히 무시', () => {
  const s = throwingStorage();
  assert.equal(cacheRead('k', s), null);
  assert.doesNotThrow(() => cacheWrite('k', 1, 0, s));
});

test('withCache: 신선한 캐시면 fetcher를 부르지 않는다', async () => {
  const s = memStorage();
  cacheWrite('k', 'cached', 1000, s);
  let called = false;
  const r = await withCache('k', 500, 1200, async () => ((called = true), 'fresh'), s);
  assert.equal(called, false);
  assert.deepEqual(r, { value: 'cached', fetchedAt: 1000, stale: false });
});

test('withCache: 만료면 새로 받고 저장한다', async () => {
  const s = memStorage();
  cacheWrite('k', 'old', 1000, s);
  const r = await withCache('k', 500, 2000, async () => 'new', s);
  assert.deepEqual(r, { value: 'new', fetchedAt: 2000, stale: false });
  assert.equal(cacheRead('k', s).value, 'new');
});

test('withCache: 받기 실패 시 예전 캐시를 stale로 돌려준다', async () => {
  const s = memStorage();
  cacheWrite('k', 'old', 1000, s);
  const r = await withCache('k', 500, 2000, async () => {
    throw new Error('net');
  }, s);
  assert.deepEqual(r, { value: 'old', fetchedAt: 1000, stale: true });
});

test('withCache: 실패하고 캐시도 없으면 예외를 그대로 던진다', async () => {
  await assert.rejects(
    withCache('k', 500, 2000, async () => {
      throw new Error('net');
    }, memStorage()),
    /net/,
  );
});

test('withCache: 저장소가 없어도(null) 동작한다', async () => {
  const r = await withCache('k', 500, 2000, async () => 'v', null);
  assert.deepEqual(r, { value: 'v', fetchedAt: 2000, stale: false });
});
