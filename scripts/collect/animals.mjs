// iNaturalist 분류군 id(2026-10-26 확인). 관찰의 조상 id에 들어 있으면 그 묶음 — 위 순서로 첫 일치
export const GROUPS = [
  { key: 'bear', taxon: 41636 }, // Ursidae
  { key: 'elephant', taxon: 43692 }, // Elephantidae
  { key: 'bigcat', taxon: 846273 }, // Pantherinae
  { key: 'penguin', taxon: 67564 }, // Sphenisciformes
  { key: 'turtle', taxon: 372234 }, // Chelonioidea
  { key: 'seal', taxon: 372843 }, // Phocoidea(기각류)
  { key: 'whale', taxon: 152871 }, // Cetacea
];
export const TAXON_IDS = GROUPS.map((g) => g.taxon).join(',');
export const MIN_ANIMALS = 100; // 평소 7일 약 800건 — 이보다 적으면 부분 응답으로 보고 직전 값을 쓴다

const round2 = (x) => Math.round(x * 100) / 100;

export function groupOf(taxon) {
  const ids = [...(Array.isArray(taxon?.ancestor_ids) ? taxon.ancestor_ids : []), taxon?.id];
  return GROUPS.find((g) => ids.includes(g.taxon))?.key ?? null;
}

function obsTime(o) {
  const t = typeof o.time_observed_at === 'string' ? Date.parse(o.time_observed_at) : NaN;
  if (Number.isFinite(t)) return t;
  // 시각 없이 날짜만 있으면 그날 UTC 정오
  return typeof o.observed_on === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(o.observed_on) ? Date.parse(`${o.observed_on}T12:00:00Z`) : NaN;
}

export function toAnimal(o) {
  if (!o || !Number.isInteger(o.id)) return null;
  const group = groupOf(o.taxon);
  if (!group) return null;
  const [lat, lng] = typeof o.location === 'string' ? o.location.split(',').map(Number) : [];
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  const time = obsTime(o);
  if (!Number.isFinite(time)) return null;
  // 재사용 허락(CC)이 있는 사진만 — 카드에 관찰자와 라이선스를 적는다
  const p = Array.isArray(o.photos) ? o.photos[0] : null;
  const cc = typeof p?.url === 'string' && typeof p.license_code === 'string' && p.license_code.startsWith('cc');
  return {
    id: o.id,
    group,
    name: String(o.taxon.preferred_common_name ?? o.taxon.name ?? ''),
    sci: String(o.taxon.name ?? ''),
    lat: round2(lat),
    lng: round2(lng),
    time,
    obscured: o.obscured === true || o.geoprivacy === 'obscured' || o.taxon_geoprivacy === 'obscured',
    photo: cc ? p.url : null,
    license: cc ? p.license_code : null,
    by: String(o.user?.login ?? ''),
  };
}

export function buildAnimals(results, now, from) {
  const seen = new Set();
  const items = [];
  for (const o of results) {
    const a = toAnimal(o);
    if (!a || seen.has(a.id)) continue;
    seen.add(a.id);
    items.push(a);
  }
  return { builtAt: now, from, items };
}
