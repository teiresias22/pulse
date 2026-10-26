// 사용: node scripts/collect/run.mjs <출력 폴더(dist)> [--fresh]
// 1) 배포된 사이트에서 직전 data/ 받기 2) iNaturalist 최근 7일 관찰(하루 1회) 3) <출력>/data/ 에 쓰기
// --fresh: 직전 데이터를 받지 않는다(로컬 시험용)
import { appendFile, mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { buildAnimals, MIN_ANIMALS, TAXON_IDS } from './animals.mjs';

const SITE = process.env.SITE_URL ?? 'https://pulse.joon.is-a.dev/';
const INAT = 'https://api.inaturalist.org/v1/observations';
const DAY_MS = 86_400_000;
const PER_PAGE = 200;

const [out, ...flags] = process.argv.slice(2);
if (!out) {
  console.error('usage: node scripts/collect/run.mjs <out-dir> [--fresh]');
  process.exit(2);
}
const fresh = flags.includes('--fresh');
const now = Date.now();
const utcDay = (ms) => new Date(ms).toISOString().slice(0, 10);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// 404 → null(처음부터). 그 밖의 실패는 던져서 배포를 막는다 — 빈 데이터로 사이트를 덮어쓰지 않게
// ?v= 는 Pages CDN 캐시(max-age 600)를 비켜 가서 방금 배포된 파일을 놓치지 않게 한다
async function previous(path) {
  if (fresh) return null;
  const res = await fetch(new URL(`data/${path}?v=${now}`, SITE), { signal: AbortSignal.timeout(20_000) });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`previous ${path}: HTTP ${res.status}`);
  return res.json();
}

// id 오름차순 + id_above 커서(오프셋보다 안정적). 권장 한도(분당 60회) 아래로 1초씩 쉰다.
// 받은 수가 첫 쪽의 total_results보다 적으면 행을 흘린 것이므로 던진다(직전 데이터로 물러남)
async function observations(from) {
  const results = [];
  let total = null;
  let above = 0;
  // 정상은 ~820건(5쪽 안팎). 50쪽 × 200 = 1만 건이 넘으면 커서가 맴도는 것으로 본다
  for (let pages = 1; ; pages++) {
    if (pages > 50) throw new Error('inaturalist: too many pages');
    const q = new URLSearchParams({
      taxon_id: TAXON_IDS, d1: from, quality_grade: 'research', geo: 'true',
      order_by: 'id', order: 'asc', per_page: String(PER_PAGE), id_above: String(above),
    });
    const res = await fetch(`${INAT}?${q}`, { headers: { 'User-Agent': 'pulse.joon.is-a.dev daily collector' }, signal: AbortSignal.timeout(30_000) });
    if (!res.ok) throw new Error(`inaturalist: HTTP ${res.status}`);
    const json = await res.json();
    const page = Array.isArray(json.results) ? json.results : [];
    total ??= json.total_results;
    results.push(...page);
    if (page.length < PER_PAGE) break;
    const next = page.at(-1)?.id;
    if (!Number.isInteger(next) || next <= above) throw new Error('inaturalist: cursor stuck');
    above = next;
    await sleep(1000);
  }
  if (typeof total !== 'number' || results.length < total) throw new Error(`inaturalist: got ${results.length} of ${total}`);
  return results;
}

// 하루 한 번(UTC 날짜가 바뀌었을 때만 — push 배포마다 다시 부르지 않게). 실패·이상 결과면 직전 값
async function collectAnimals(prev) {
  if (prev && typeof prev.builtAt === 'number' && utcDay(prev.builtAt) === utcDay(now)) return prev;
  try {
    const from = utcDay(now - 7 * DAY_MS);
    const data = buildAnimals(await observations(from), now, from);
    if (data.items.length < MIN_ANIMALS) throw new Error(`inaturalist: ${data.items.length} animals`);
    return data;
  } catch (err) {
    console.warn(`animals skipped: ${err.message}`);
    return prev;
  }
}

const animals = await collectAnimals(await previous('animals.json'));

const dir = join(out, 'data');
await mkdir(dir, { recursive: true });
if (animals) await writeFile(join(dir, 'animals.json'), JSON.stringify(animals));

const ageD = animals ? Math.floor((now - animals.builtAt) / DAY_MS) : 999;
if (process.env.GITHUB_OUTPUT) await appendFile(process.env.GITHUB_OUTPUT, `animals_age_d=${ageD}\n`);
console.log(`animals ${animals?.items.length ?? 0} · age ${ageD}d · from ${animals?.from ?? '-'}`);
