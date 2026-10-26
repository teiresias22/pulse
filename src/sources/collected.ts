import { DAY, HOUR, isNum, validCoord, type Animal, type AnimalGroup, type AnimalsData, type Loaded } from '../model.ts';
import { withCache } from '../lib/cache.ts';
import { fetchJson } from './http.ts';

// 수집기(GitHub Actions)가 사이트와 같이 배포하는 파일. 개발 서버에는 없으므로 배포된 사이트에서 받는다(Pages는 CORS *)
// 함수 안에서 읽는다 — node:test가 이 모듈을 불러올 때 import.meta.env가 없다
function dataUrl(path: string): string {
  const base = import.meta.env.DEV ? 'https://pulse.joon.is-a.dev/' : import.meta.env.BASE_URL;
  return `${base}data/${path}`;
}

const isDay = (x: unknown): x is string => typeof x === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(x);

// 하루 한 번 도는 수집기가 멈추면 6시간 캐시는 계속 '신선'해 보인다 — 만든 지 3일이 넘으면 헤더의 '오래된 데이터' 표시를 띄운다
// fetchedAt도 builtAt으로 둔다: 같은 파일을 다시 읽어도 값이 같아 App의 applied 가드가 재적용을 막고, 새 파일이 오면 값이 바뀐다
export const COLLECTED_STALE_MS = 3 * DAY;

export function freshness<T extends { builtAt: number }>(r: Loaded<T>, now: number): Loaded<T> {
  return { ...r, fetchedAt: r.value.builtAt, stale: r.stale || now - r.value.builtAt > COLLECTED_STALE_MS };
}

const GROUPS: AnimalGroup[] = ['bear', 'elephant', 'bigcat', 'penguin', 'turtle', 'seal', 'whale'];

function isAnimal(x: unknown): x is Animal {
  const a = x as Partial<Animal> | null;
  return (
    typeof a?.id === 'number' && Number.isInteger(a.id) &&
    GROUPS.includes(a.group as AnimalGroup) &&
    typeof a.name === 'string' && typeof a.sci === 'string' &&
    isNum(a.lat) && isNum(a.lng) && validCoord(a.lat, a.lng) &&
    isNum(a.time) &&
    typeof a.obscured === 'boolean' &&
    // img src로 쓰므로 https만
    (a.photo === null || (typeof a.photo === 'string' && a.photo.startsWith('https://'))) &&
    (a.license === null || typeof a.license === 'string') &&
    typeof a.by === 'string'
  );
}

export function parseAnimals(json: unknown): AnimalsData | null {
  const j = json as { builtAt?: unknown; from?: unknown; items?: unknown } | null;
  if (!isNum(j?.builtAt) || !isDay(j.from) || !Array.isArray(j.items)) return null;
  return { builtAt: j.builtAt, from: j.from, items: (j.items as unknown[]).filter(isAnimal) };
}

export async function loadAnimals(now = Date.now()): Promise<Loaded<AnimalsData>> {
  const r = await withCache('pp:animals', 6 * HOUR, now, async () => {
    const data = parseAnimals(await fetchJson(dataUrl('animals.json'), 15_000));
    if (!data) throw new Error('invalid animals.json');
    return data;
  });
  return freshness(r, now);
}
