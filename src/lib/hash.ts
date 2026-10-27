import { LAYERS, type AnimalGroup, type LayerKey } from '../model.ts';
import { ANIMAL_GROUPS } from './animals.ts';

export type ViewState = { t: number | null; layers: LayerKey[]; animals: AnimalGroup[] };

export function encodeHash(s: ViewState): string {
  const p = new URLSearchParams();
  if (s.t !== null) p.set('t', String(Math.round(s.t)));
  p.set('layers', s.layers.join(','));
  // 동물이 전부 켜져 있으면 생략(옛 링크와 같은 모양)
  if (s.animals.length < ANIMAL_GROUPS.length) p.set('animals', s.animals.join(','));
  return `#${p.toString()}`;
}

export function decodeHash(hash: string): ViewState {
  const p = new URLSearchParams(hash.replace(/^#/, ''));
  const rawT = p.get('t');
  const t = rawT && Number.isFinite(Number(rawT)) ? Number(rawT) : null;
  const raw = p.get('layers');
  // 옛 공유 링크의 iss(ISS 하나) → sat(위성 레이어)
  const picked = raw === null ? LAYERS : raw.split(',').map((l) => (l === 'iss' ? 'sat' : l));
  const rawAnimals = p.get('animals');
  const animals = rawAnimals === null ? ANIMAL_GROUPS : ANIMAL_GROUPS.filter((g) => rawAnimals.split(',').includes(g));
  return { t, layers: LAYERS.filter((l) => picked.includes(l)), animals };
}
