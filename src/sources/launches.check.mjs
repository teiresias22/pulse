import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { mapStatus, parseLaunches, retryAfterUntil } from './launches.ts';

const fixture = JSON.parse(readFileSync(new URL('./fixtures/ll2.json', import.meta.url), 'utf8'));
const NOW = Date.parse('2026-10-23T09:00:00Z');

test('mapStatus: 성공·비행중=success, 실패·부분실패=failure, 나머지는 미래면 upcoming', () => {
  assert.equal(mapStatus(3, NOW - 1, NOW), 'success');
  assert.equal(mapStatus(6, NOW - 1, NOW), 'success');
  assert.equal(mapStatus(4, NOW - 1, NOW), 'failure');
  assert.equal(mapStatus(7, NOW - 1, NOW), 'failure');
  assert.equal(mapStatus(1, NOW + 1, NOW), 'upcoming');
  assert.equal(mapStatus(2, NOW - 1, NOW), null); // 지났는데 결과 모름 → 그리지 않는다
});

test('정상 항목을 PulseEvent로 바꾼다(문자열 좌표도 숫자로)', () => {
  const events = parseLaunches(fixture, NOW);
  assert.deepEqual(events[0], {
    id: '7766f3bb-674c-4c71-b986-963bd633fcfe',
    kind: 'launch',
    time: Date.parse('2026-10-23T07:11:00Z'),
    lat: -39.262833,
    lng: 177.864469,
    status: 'success',
    label: "Electron | We're Not Hawking Around (3x HawkEye 360) · Rocket Lab Launch Complex 1, Mahia Peninsula, New Zealand",
    url: 'https://ll.thespacedevs.com/2.3.0/launches/7766f3bb-674c-4c71-b986-963bd633fcfe/',
  });
  assert.equal(events[1].lat, 28.5);
});

test('결과 모르는 과거 발사·좌표 없는 발사는 버린다', () => {
  assert.deepEqual(
    parseLaunches(fixture, NOW).map((e) => [e.id, e.status]),
    [
      ['7766f3bb-674c-4c71-b986-963bd633fcfe', 'success'],
      ['fail-1', 'failure'],
      ['future-1', 'upcoming'],
    ],
  );
});

test('형식이 다르면 빈 배열', () => {
  assert.deepEqual(parseLaunches(null, NOW), []);
  assert.deepEqual(parseLaunches({ results: [null, {}] }, NOW), []);
});

test('retryAfterUntil: 초·HTTP 날짜·없음(기본 1시간)', () => {
  assert.equal(retryAfterUntil('120', NOW), NOW + 120_000);
  assert.equal(retryAfterUntil('Fri, 23 Oct 2026 10:00:00 GMT', NOW), Date.parse('2026-10-23T10:00:00Z'));
  assert.equal(retryAfterUntil(null, NOW), NOW + 3_600_000);
  assert.equal(retryAfterUntil('garbage', NOW), NOW + 3_600_000);
});
