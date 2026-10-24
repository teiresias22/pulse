import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseTornadoes, tornadoCenter } from './nws.ts';

const fixture = JSON.parse(readFileSync(new URL('./fixtures/nws.json', import.meta.url), 'utf8'));

test('발령은 갱신 시각에, 갱신은 취소 시각에 끝난다. 취소 자체는 그리지 않는다', () => {
  const ws = parseTornadoes(fixture);
  assert.deepEqual(
    ws.map((w) => [w.id, new Date(w.start).toISOString(), new Date(w.end).toISOString()]),
    [
      ['A1', '2026-10-20T15:00:00.000Z', '2026-10-20T15:20:00.000Z'],
      ['U1', '2026-10-20T15:20:00.000Z', '2026-10-20T15:30:00.000Z'],
    ],
  );
});

test('지역·제목·다각형을 그대로 옮긴다', () => {
  const [a1] = parseTornadoes(fixture);
  assert.equal(a1.area, 'Cleveland, OK');
  assert.equal(a1.headline, 'Tornado Warning issued October 20 at 10:00AM CDT until October 20 at 10:45AM CDT');
  assert.deepEqual(a1.geometry, fixture.features[0].geometry);
});

test('다각형이 아니거나 시각이 틀린 메시지는 버린다', () => {
  assert.deepEqual(parseTornadoes(fixture).map((w) => w.id), ['A1', 'U1']);
});

test('형식이 다르면 빈 배열', () => {
  assert.deepEqual(parseTornadoes(null), []);
  assert.deepEqual(parseTornadoes({ features: 'x' }), []);
});

test('tornadoCenter: 닫는 점을 뺀 꼭짓점 평균', () => {
  const c = tornadoCenter(parseTornadoes(fixture)[0]);
  assert.ok(Math.abs(c.lat - 35.05) < 1e-9);
  assert.ok(Math.abs(c.lng - -96.95) < 1e-9);
});
