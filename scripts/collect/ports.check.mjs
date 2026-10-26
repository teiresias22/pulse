import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildItems, shiftDate, topSums, TOP_PORTS } from './ports.mjs';

test('shiftDate: UTC 날짜 이동, 월 경계', () => {
  assert.equal(shiftDate('2026-10-16', -6), '2026-10-10');
  assert.equal(shiftDate('2026-10-01', -1), '2026-09-30');
  assert.equal(shiftDate('2026-10-16', -96), '2026-07-12');
});

test('topSums: 큰 순으로 n개, 이상한 id는 버린다(where 절에 들어가므로)', () => {
  const rows = [
    { portid: 'port1', n: 10 },
    { portid: 'port2', n: 30 },
    { portid: "x' OR 1=1 --", n: 99 },
    { portid: 'port3', n: 20 },
    { portid: 'port4', n: 'x' },
  ];
  assert.deepEqual([...topSums(rows, 2)], [['port2', 30], ['port3', 20]]);
  assert.equal(topSums(rows).size, 3);
  assert.equal(TOP_PORTS, 300);
});

test('buildItems(port): 최근 7일을 날짜 칸에, 빈 날 0, base = 합 ÷ 90, 선종 합', () => {
  const items = buildItems('port', {
    through: '2026-10-16',
    baseSums: new Map([['port1', 900]]),
    meta: [
      { portid: 'port1', portname: 'Busan', country: 'Korea', lat: 35.1, lon: 129.04 },
      { portid: 'port9', portname: 'Other', country: 'X', lat: 1, lon: 1 },
    ],
    recent: [
      { portid: 'port1', date: '2026-10-10', portcalls: 12, portcalls_container: 7, portcalls_tanker: 5 },
      { portid: 'port1', date: '2026-10-16', portcalls: 8, portcalls_container: 8 },
      { portid: 'port1', date: '2026-10-09', portcalls: 100 },
      { portid: 'port9', date: '2026-10-16', portcalls: 1 },
    ],
  });
  assert.deepEqual(items, [{
    id: 'port1', kind: 'port', name: 'Busan', country: 'Korea', lat: 35.1, lng: 129.04,
    days: [12, 0, 0, 0, 0, 0, 8], base: 10,
    byType: { container: 15, dry_bulk: 0, general_cargo: 0, roro: 0, tanker: 5 },
  }]);
});

test('buildItems(chokepoint): n_* 필드를 쓰고 국가가 없으면 빈 문자열', () => {
  const [c] = buildItems('chokepoint', {
    through: '2026-10-18',
    baseSums: new Map([['chokepoint1', 4500]]),
    meta: [{ portid: 'chokepoint1', portname: 'Suez Canal', lat: 30.59, lon: 32.44 }],
    recent: [{ portid: 'chokepoint1', date: '2026-10-18', n_total: 43, n_container: 15, n_tanker: 15, n_dry_bulk: 10, n_general_cargo: 2, n_roro: 1 }],
  });
  assert.equal(c.country, '');
  assert.equal(c.base, 50);
  assert.deepEqual(c.days, [0, 0, 0, 0, 0, 0, 43]);
  assert.deepEqual(c.byType, { container: 15, dry_bulk: 10, general_cargo: 2, roro: 1, tanker: 15 });
});
