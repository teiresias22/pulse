import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decodeHash, encodeHash } from './hash.ts';

test('라이브(t=null)는 t를 빼고 레이어만 담는다', () => {
  assert.equal(encodeHash({ t: null, layers: ['quake', 'iss'] }), '#layers=quake%2Ciss');
});

test('왕복: 인코딩한 값을 그대로 되읽는다', () => {
  const s = { t: 1792738861000, layers: ['launch'] };
  assert.deepEqual(decodeHash(encodeHash(s)), s);
});

test('빈 해시 → 라이브 + 전체 레이어', () => {
  assert.deepEqual(decodeHash(''), { t: null, layers: ['quake', 'storm', 'tornado', 'fire', 'launch', 'iss', 'aurora'] });
});

test('잘못된 t는 라이브, 모르는 레이어는 버리고 순서는 정해진 순서로', () => {
  assert.deepEqual(decodeHash('#t=abc&layers=iss,bogus,quake'), { t: null, layers: ['quake', 'iss'] });
});

test('빈 t(#t=)도 라이브', () => {
  assert.deepEqual(decodeHash('#t=&layers=quake'), { t: null, layers: ['quake'] });
});

test('layers= 가 비어 있으면 레이어 없음(전부 끈 상태도 공유 가능)', () => {
  assert.deepEqual(decodeHash('#layers='), { t: null, layers: [] });
});
