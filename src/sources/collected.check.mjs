import { test } from 'node:test';
import assert from 'node:assert/strict';
import { COLLECTED_STALE_MS, freshness, parseAnimals } from './collected.ts';

const loaded = (builtAt, stale = false) => ({ value: { builtAt, from: '2026-10-19', items: [] }, fetchedAt: 1, stale });

test('freshness: 갓 만든 데이터는 신선, fetchedAt은 builtAt', () => {
  const r = freshness(loaded(1000), 1000 + COLLECTED_STALE_MS);
  assert.equal(r.stale, false);
  assert.equal(r.fetchedAt, 1000);
});

test('freshness: 3일이 넘으면 stale', () => {
  assert.equal(freshness(loaded(1000), 1001 + COLLECTED_STALE_MS).stale, true);
});

test('freshness: 이미 stale인 캐시는 그대로 stale', () => {
  assert.equal(freshness(loaded(1000, true), 2000).stale, true);
});

const animal = { id: 1, group: 'whale', name: 'Common Dolphin', sci: 'Delphinus delphis', lat: -36.44, lng: 175.07, time: 9, obscured: false, photo: 'https://inaturalist-open-data.s3.amazonaws.com/photos/1/square.jpg', license: 'cc-by-nc', by: 'someone' };

test('parseAnimals: 형식이 맞는 항목만', () => {
  const r = parseAnimals({
    builtAt: 9,
    from: '2026-10-19',
    items: [
      animal,
      { ...animal, id: 2, photo: null, license: null },
      { ...animal, id: 3, group: 'dog' },
      { ...animal, id: 4, lat: 100 },
      { ...animal, id: 5, photo: 'javascript:alert(1)' },
      { ...animal, id: 6.5 },
      null,
    ],
  });
  assert.deepEqual(r.items.map((x) => x.id), [1, 2]);
  assert.equal(r.from, '2026-10-19');
});

test('parseAnimals: builtAt·from·items가 없으면 null', () => {
  assert.equal(parseAnimals({ from: '2026-10-19', items: [] }), null);
  assert.equal(parseAnimals({ builtAt: 9, from: 'x', items: [] }), null);
  assert.equal(parseAnimals({ builtAt: 9, from: '2026-10-19' }), null);
  assert.equal(parseAnimals(null), null);
});
