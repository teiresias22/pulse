import { DAY, type Animal, type AnimalGroup } from '../model.ts';

export const ANIMAL_WINDOW_MS = 7 * DAY;
export const ANIMAL_GROUPS: AnimalGroup[] = ['bear', 'elephant', 'bigcat', 'penguin', 'turtle', 'seal', 'whale'];
export const ANIMAL_ICON: Record<AnimalGroup, string> = { bear: '🐻', elephant: '🐘', bigcat: '🐅', penguin: '🐧', turtle: '🐢', seal: '🦭', whale: '🐋' };

const CELL_DEG = 4;
const COLS = 360 / CELL_DEG;
const ROWS = 180 / CELL_DEG;

export type AnimalCluster = { key: string; group: AnimalGroup; lat: number; lng: number; items: Animal[] };

// 남서쪽(-90, -180)부터 경도 방향으로. 끝값(lat 90, lng 180)은 마지막 칸
export function cellKey(lat: number, lng: number): number {
  const row = Math.min(ROWS - 1, Math.floor((lat + 90) / CELL_DEG));
  const col = Math.min(COLS - 1, Math.floor((lng + 180) / CELL_DEG));
  return row * COLS + col;
}

export function visibleAnimals(items: Animal[], t: number): Animal[] {
  return items.filter((a) => a.time <= t && t < a.time + ANIMAL_WINDOW_MS);
}

export function animalOpacity(a: Animal, t: number): number {
  return Math.max(0.35, 1 - (t - a.time) / ANIMAL_WINDOW_MS);
}

// 칸·묶음별 마커 하나. 같은 칸의 다른 묶음과 겹치지 않게 묶음 순서대로 경도를 −1.8°…+1.8° 비킨다
export function clusterAnimals(visible: Animal[]): AnimalCluster[] {
  const byKey = new Map<string, Animal[]>();
  for (const a of visible) {
    const key = `${a.group}:${cellKey(a.lat, a.lng)}`;
    const list = byKey.get(key);
    if (list) list.push(a);
    else byKey.set(key, [a]);
  }
  return [...byKey].map(([key, items]) => {
    items.sort((x, y) => y.time - x.time);
    const group = items[0]!.group; // byKey의 목록은 항상 한 개 이상
    const lat = items.reduce((s, x) => s + x.lat, 0) / items.length;
    const lng = items.reduce((s, x) => s + x.lng, 0) / items.length + ANIMAL_GROUPS.indexOf(group) * 0.6 - 1.8;
    return { key, group, lat, lng, items };
  });
}

// iNaturalist license_code → 표기
export function licenseLabel(code: string): string {
  return code.toUpperCase().replace(/^CC-/, 'CC ');
}
