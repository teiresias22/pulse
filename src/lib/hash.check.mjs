import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decodeHash, encodeHash } from './hash.ts';
import { ANIMAL_GROUPS } from './animals.ts';

test('라이브(t=null)는 t를 빼고 레이어만 담는다', () => {
  assert.equal(encodeHash({ t: null, layers: ['quake', 'sat'], animals: ANIMAL_GROUPS }), '#layers=quake%2Csat');
});

test('왕복: 인코딩한 값을 그대로 되읽는다', () => {
  const s = { t: 1792738861000, layers: ['launch'], animals: ANIMAL_GROUPS };
  assert.deepEqual(decodeHash(encodeHash(s)), s);
});

test('빈 해시 → 라이브 + 전체 레이어', () => {
  assert.deepEqual(decodeHash(''), { t: null, layers: ['quake', 'storm', 'tornado', 'fire', 'launch', 'sat', 'aurora', 'animal'], animals: ANIMAL_GROUPS });
});

test('잘못된 t는 라이브, 모르는 레이어는 버리고 순서는 정해진 순서로', () => {
  assert.deepEqual(decodeHash('#t=abc&layers=iss,bogus,quake'), { t: null, layers: ['quake', 'sat'], animals: ANIMAL_GROUPS });
});

test('빈 t(#t=)도 라이브', () => {
  assert.deepEqual(decodeHash('#t=&layers=quake'), { t: null, layers: ['quake'], animals: ANIMAL_GROUPS });
});

test('layers= 가 비어 있으면 레이어 없음(전부 끈 상태도 공유 가능)', () => {
  assert.deepEqual(decodeHash('#layers='), { t: null, layers: [], animals: ANIMAL_GROUPS });
});

test('옛 링크의 iss는 sat으로 읽는다', () => {
  assert.deepEqual(decodeHash('#layers=iss,quake'), { t: null, layers: ['quake', 'sat'], animals: ANIMAL_GROUPS });
});

test('옛 링크의 port는 무시한다', () => {
  assert.deepEqual(decodeHash('#layers=port,quake'), { t: null, layers: ['quake'], animals: ANIMAL_GROUPS });
});

test('동물 전부 켜짐은 animals 키를 생략', () => {
  assert.equal(encodeHash({ t: null, layers: ['animal'], animals: ANIMAL_GROUPS }), '#layers=animal');
});

test('동물 일부·빈 값 왕복', () => {
  for (const animals of [['bear', 'whale'], []]) {
    const s = { t: null, layers: ['animal'], animals };
    assert.deepEqual(decodeHash(encodeHash(s)), s);
  }
});

test('animals 키 없음은 전체, 모르는 값은 버리고 정해진 순서로', () => {
  assert.deepEqual(decodeHash('#layers=animal').animals, ANIMAL_GROUPS);
  assert.deepEqual(decodeHash('#animals=whale,dog,bear').animals, ['bear', 'whale']);
});
