import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseUsgs } from './usgs.ts';

const fixture = JSON.parse(readFileSync(new URL('./fixtures/usgs.json', import.meta.url), 'utf8'));

test('정상 항목을 PulseEvent로 바꾼다(GeoJSON은 [lng, lat] 순서)', () => {
  const events = parseUsgs(fixture);
  assert.deepEqual(events[0], {
    id: 'ci41350919',
    kind: 'quake',
    time: 1792739784220,
    lat: 35.7268333333333,
    lng: -117.536666666667,
    magnitude: 0.73,
    label: '13 km WSW of Searles Valley, CA',
    url: 'https://earthquake.usgs.gov/earthquakes/eventpage/ci41350919',
  });
});

test('규모 null·좌표 범위 밖·id 없는 항목만 버린다', () => {
  assert.deepEqual(
    parseUsgs(fixture).map((e) => e.id),
    ['ci41350919', 'us7000abcd'],
  );
});

test('형식이 다르면 빈 배열', () => {
  assert.deepEqual(parseUsgs(null), []);
  assert.deepEqual(parseUsgs({ features: 'nope' }), []);
  assert.deepEqual(parseUsgs({ features: [null, 1, {}] }), []);
});

test('http(s)가 아닌 url은 빈 문자열', () => {
  const f = { id: 'x', properties: { mag: 1, time: 1, place: 'p', url: 'javascript:alert(1)' }, geometry: { coordinates: [0, 0] } };
  assert.equal(parseUsgs({ features: [f] })[0].url, '');
});
