import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildAnimals, GROUPS, groupOf, MIN_ANIMALS, TAXON_IDS, toAnimal } from './animals.mjs';

const fx = JSON.parse(readFileSync(new URL('./fixtures/inat.json', import.meta.url), 'utf8'));
const bear = (over = {}) => ({
  id: 1, time_observed_at: null, observed_on: '2026-10-20', obscured: false, geoprivacy: null, taxon_geoprivacy: 'open',
  location: '61.123456,-149.98765',
  taxon: { id: 41638, name: 'Ursus americanus', preferred_common_name: 'American Black Bear', ancestor_ids: [48460, 1, 41636, 41638] },
  photos: [{ url: 'https://example.org/square.jpg', license_code: 'all rights reserved' }],
  user: { login: 'someone' },
  ...over,
});

test('GROUPS·TAXON_IDS: 7묶음, 정해진 순서', () => {
  assert.deepEqual(GROUPS.map((g) => g.key), ['bear', 'elephant', 'bigcat', 'penguin', 'turtle', 'seal', 'whale']);
  assert.equal(TAXON_IDS, '41636,43692,846273,67564,372234,372843,152871');
  assert.equal(MIN_ANIMALS, 100);
});

test('groupOf: 조상 id 또는 자기 id로 묶음, 없으면 null', () => {
  assert.equal(groupOf({ id: 41638, ancestor_ids: [1, 41636] }), 'bear');
  assert.equal(groupOf({ id: 152871, ancestor_ids: [1] }), 'whale');
  assert.equal(groupOf({ id: 5, ancestor_ids: [1, 2] }), null);
  assert.equal(groupOf(undefined), null);
});

test('toAnimal: 실제 응답 — 고래 묶음, 시각·좌표·CC 사진', () => {
  assert.deepEqual(toAnimal(fx.results[0]), {
    id: 409349758, group: 'whale', name: 'Common Bottlenose Dolphin', sci: 'Tursiops truncatus',
    lat: -36.79, lng: 174.94, time: Date.parse('2026-10-19T14:25:52+13:00'), obscured: false,
    photo: 'https://inaturalist-open-data.s3.amazonaws.com/photos/752639654/square.jpg', license: 'cc-by-nc', by: 'papijohngo',
  });
});

test('toAnimal: time_observed_at 없으면 observed_on의 UTC 정오, CC 아닌 사진은 null', () => {
  const a = toAnimal(bear());
  assert.equal(a.time, Date.UTC(2026, 9, 20, 12));
  assert.equal(a.photo, null);
  assert.equal(a.license, null);
  assert.equal(a.lat, 61.12);
  assert.equal(a.lng, -149.99);
});

test('toAnimal: 위치 흐림 세 경우', () => {
  assert.equal(toAnimal(bear({ obscured: true })).obscured, true);
  assert.equal(toAnimal(bear({ geoprivacy: 'obscured' })).obscured, true);
  assert.equal(toAnimal(bear({ taxon_geoprivacy: 'obscured' })).obscured, true);
  assert.equal(toAnimal(bear()).obscured, false);
});

test('toAnimal: 묶음 밖·좌표 오류·시각 없음·id 없음은 null', () => {
  assert.equal(toAnimal(bear({ taxon: { id: 5, name: 'x', ancestor_ids: [1] } })), null);
  assert.equal(toAnimal(bear({ location: 'nope' })), null);
  assert.equal(toAnimal(bear({ location: '95,10' })), null);
  assert.equal(toAnimal(bear({ observed_on: null })), null);
  assert.equal(toAnimal(bear({ id: 'x' })), null);
  assert.equal(toAnimal(null), null);
});

test('buildAnimals: 중복 id 제거, 버린 행 제외, builtAt·from', () => {
  const d = buildAnimals([...fx.results, fx.results[0], bear({ location: 'bad' })], 5, '2026-10-19');
  assert.equal(d.builtAt, 5);
  assert.equal(d.from, '2026-10-19');
  assert.deepEqual(d.items.map((a) => a.id), [409349758, 409349996, 409356690]);
});
