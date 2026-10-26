import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parsePorts } from './collected.ts';

const port = {
  id: 'port1', kind: 'port', name: 'Busan', country: 'Korea', lat: 35.1, lng: 129,
  days: [1, 2, 3, 4, 5, 6, 7], base: 4, byType: { container: 1, dry_bulk: 0, general_cargo: 0, roro: 0, tanker: 0 },
};

test('parsePorts: 형식이 맞는 항목만 남긴다', () => {
  const r = parsePorts({
    builtAt: 9,
    through: { port: '2026-10-16', chokepoint: '2026-10-18' },
    items: [
      port,
      { ...port, id: 'bad', days: [1, 2] },
      { ...port, id: 'bad2', lat: 100 },
      { ...port, id: 'bad3', kind: 'x' },
      { ...port, id: 'bad4', byType: { container: 1 } },
      null,
    ],
  });
  assert.deepEqual(r, { builtAt: 9, through: { port: '2026-10-16', chokepoint: '2026-10-18' }, items: [port] });
});

test('parsePorts: builtAt·through·items가 없으면 null', () => {
  assert.equal(parsePorts({ builtAt: 9, items: [] }), null);
  assert.equal(parsePorts({ through: { port: 'a', chokepoint: 'b' }, items: [] }), null);
  assert.equal(parsePorts({ builtAt: 9, through: { port: 'a', chokepoint: 'b' } }), null);
  assert.equal(parsePorts(null), null);
});
