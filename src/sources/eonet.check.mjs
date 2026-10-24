import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseEonet } from './eonet.ts';

const fixture = JSON.parse(readFileSync(new URL('./fixtures/eonet.json', import.meta.url), 'utf8'));

test('태풍: kts 관측점만 시각순으로 모은다(GeoJSON은 [lng, lat])', () => {
  assert.deepEqual(parseEonet(fixture).storms, [
    {
      id: 'EONET_1',
      name: 'Typhoon Test',
      track: [
        { time: Date.parse('2026-10-21T00:00:00Z'), lat: 14, lng: 178, kts: 30 },
        { time: Date.parse('2026-10-21T06:00:00Z'), lat: 15, lng: 179, kts: 35 },
      ],
      closed: null,
      url: 'https://www.metoc.navy.mil/jtwc/products/wp2626.tcw',
    },
  ]);
});

test('산불: 첫 점, 면적(에이커)·진화 시각은 있을 때만, 링크는 http(s)만', () => {
  assert.deepEqual(parseEonet(fixture).fires, [
    {
      id: 'EONET_3',
      kind: 'fire',
      time: Date.parse('2026-10-22T21:45:00Z'),
      lat: 30.4952778,
      lng: -82.8577778,
      magnitude: 2060,
      label: 'Wildfire BEE HAVEN, Hamilton, Florida',
      url: 'https://irwin.doi.gov/observer/incidents/2026-FLFLS-260601105',
    },
    {
      id: 'EONET_4',
      kind: 'fire',
      time: Date.parse('2026-10-20T10:00:00Z'),
      endTime: Date.parse('2026-10-23T00:00:00Z'),
      lat: 44,
      lng: -120.5,
      label: 'Wildfire Closed, Oregon',
      url: '',
    },
  ]);
});

test('관측점 없는 태풍·좌표 틀린 산불·다른 카테고리·id 없는 항목은 버린다', () => {
  const d = parseEonet(fixture);
  assert.deepEqual(d.storms.map((s) => s.id), ['EONET_1']);
  assert.deepEqual(d.fires.map((f) => f.id), ['EONET_3', 'EONET_4']);
});

test('형식이 다르면 빈 결과', () => {
  assert.deepEqual(parseEonet(null), { storms: [], fires: [] });
  assert.deepEqual(parseEonet({ events: 'x' }), { storms: [], fires: [] });
});
