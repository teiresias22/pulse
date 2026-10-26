// 사용: node scripts/collect/run.mjs <출력 폴더(dist)> [--fresh]
// 1) 배포된 사이트에서 직전 data/ 받기 2) PortWatch 집계(하루 1회) 3) <출력>/data/ 에 쓰기
// --fresh: 직전 데이터를 받지 않는다(로컬 시험용)
// 비행(OpenSky)은 서면 허가 대기 — 허가되면 여기에 수집을 더하고 cron을 매시로 바꾼다
import { appendFile, mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { buildItems, FIELDS, MIN_PORTS, shiftDate, topSums, TOP_PORTS, TYPES } from './ports.mjs';

const SITE = process.env.SITE_URL ?? 'https://pulse.joon.is-a.dev/';
const ARCGIS = 'https://services9.arcgis.com/weJ1QsnbMYJlCHdG/arcgis/rest/services';
const DAILY = { port: 'Daily_Ports_Data', chokepoint: 'Daily_Chokepoints_Data' };
const META = { port: 'PortWatch_ports_database', chokepoint: 'PortWatch_chokepoints_database' };
const DAY_MS = 86_400_000;

const [out, ...flags] = process.argv.slice(2);
if (!out) {
  console.error('usage: node scripts/collect/run.mjs <out-dir> [--fresh]');
  process.exit(2);
}
const fresh = flags.includes('--fresh');
const now = Date.now();
const utcDay = (ms) => new Date(ms).toISOString().slice(0, 10);

// 404 → null(처음부터). 그 밖의 실패는 던져서 배포를 막는다 — 빈 데이터로 사이트를 덮어쓰지 않게
// ?v= 는 Pages CDN 캐시(max-age 600)를 비켜 가서 방금 배포된 파일을 놓치지 않게 한다
async function previous(path) {
  if (fresh) return null;
  const res = await fetch(new URL(`data/${path}?v=${now}`, SITE), { signal: AbortSignal.timeout(20_000) });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`previous ${path}: HTTP ${res.status}`);
  return res.json();
}

// ArcGIS는 한 번에 1,000행까지 — exceededTransferLimit이면 resultOffset으로 넘긴다. limit에 닿으면 멈춘다
async function arcgis(service, params, limit = Infinity) {
  const rows = [];
  for (let offset = 0; ; offset += 1000) {
    const res = await fetch(`${ARCGIS}/${service}/FeatureServer/0/query`, {
      method: 'POST',
      // resultOffset=0 을 보내면 outStatistics 질의가 400이라 첫 쪽에는 싣지 않는다
      body: new URLSearchParams({ f: 'json', returnGeometry: 'false', ...(offset && { resultOffset: String(offset) }), ...(!params.outStatistics && { orderByFields: 'ObjectId' }), ...params }),
      signal: AbortSignal.timeout(60_000),
    });
    if (!res.ok) throw new Error(`${service}: HTTP ${res.status}`);
    const json = await res.json();
    if (json.error) throw new Error(`${service}: ${json.error.message}`);
    if (params.returnCountOnly) return json.count;
    rows.push(...json.features.map((f) => f.attributes));
    if (!json.exceededTransferLimit || rows.length >= limit) return rows.slice(0, limit);
  }
}

async function collectKind(kind) {
  const f = FIELDS[kind];
  // orderByFields=date DESC 는 느리고(~1분) 400으로 끝나는 일이 있어 max(date) 집계로 구한다
  const [last] = await arcgis(DAILY[kind], {
    where: '1=1',
    outStatistics: JSON.stringify([{ statisticType: 'max', onStatisticField: 'date', outStatisticFieldName: 'd' }]),
  });
  const through = last?.d;
  if (typeof through !== 'string') throw new Error(`${kind}: no latest date`);
  const top = kind === 'port' ? TOP_PORTS : Infinity;
  const sums = await arcgis(
    DAILY[kind],
    {
      where: `date >= DATE '${shiftDate(through, -96)}' AND date <= DATE '${shiftDate(through, -7)}'`,
      outStatistics: JSON.stringify([{ statisticType: 'sum', onStatisticField: f.total, outStatisticFieldName: 'n' }]),
      groupByFieldsForStatistics: 'portid',
      orderByFields: 'n DESC',
    },
    top,
  );
  const baseSums = topSums(sums, top);
  const ids = [...baseSums.keys()].map((id) => `'${id}'`).join(',');
  const recentWhere = `date >= DATE '${shiftDate(through, -6)}' AND portid IN (${ids})`;
  const recent = await arcgis(DAILY[kind], {
    where: recentWhere,
    outFields: ['portid', 'date', f.total, ...TYPES.map(f.type)].join(','),
  });
  // 쪽 넘김이 행을 흘리면 최근 날짜가 0으로 나오므로, 서버가 센 행 수와 다르면 던진다(직전 데이터로 물러남)
  const count = await arcgis(DAILY[kind], { where: recentWhere, returnCountOnly: 'true' });
  if (recent.length !== count) throw new Error(`${kind}: recent rows ${recent.length} != count ${count}`);
  const meta = await arcgis(META[kind], { where: `portid IN (${ids})`, outFields: '*' });
  return { through, items: buildItems(kind, { through, meta, baseSums, recent }) };
}

// 하루 한 번(UTC 날짜가 바뀌었을 때만 — push 배포마다 PortWatch를 다시 부르지 않게). 실패·이상 결과면 직전 값
async function collectPorts(prev) {
  if (prev && typeof prev.builtAt === 'number' && utcDay(prev.builtAt) === utcDay(now)) return prev;
  try {
    const [port, chokepoint] = await Promise.all([collectKind('port'), collectKind('chokepoint')]);
    if (port.items.length < MIN_PORTS) throw new Error(`portwatch: ${port.items.length} ports`);
    return { builtAt: now, through: { port: port.through, chokepoint: chokepoint.through }, items: [...chokepoint.items, ...port.items] };
  } catch (err) {
    console.warn(`ports skipped: ${err.message}`);
    return prev;
  }
}

const ports = await collectPorts(await previous('ports.json'));

const dir = join(out, 'data');
await mkdir(dir, { recursive: true });
if (ports) await writeFile(join(dir, 'ports.json'), JSON.stringify(ports));

const ageD = ports ? Math.floor((now - ports.builtAt) / DAY_MS) : 999;
if (process.env.GITHUB_OUTPUT) await appendFile(process.env.GITHUB_OUTPUT, `ports_age_d=${ageD}\n`);
console.log(`ports ${ports?.items.length ?? 0} · age ${ageD}d · through ${ports?.through.port ?? '-'} / ${ports?.through.chokepoint ?? '-'}`);
