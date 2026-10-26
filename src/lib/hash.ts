import { LAYERS, type LayerKey } from '../model.ts';

export type ViewState = { t: number | null; layers: LayerKey[] };

export function encodeHash(s: ViewState): string {
  const p = new URLSearchParams();
  if (s.t !== null) p.set('t', String(Math.round(s.t)));
  p.set('layers', s.layers.join(','));
  return `#${p.toString()}`;
}

export function decodeHash(hash: string): ViewState {
  const p = new URLSearchParams(hash.replace(/^#/, ''));
  const rawT = p.get('t');
  const t = rawT && Number.isFinite(Number(rawT)) ? Number(rawT) : null;
  const raw = p.get('layers');
  // 옛 공유 링크의 iss(ISS 하나) → sat(위성 레이어)
  const picked = raw === null ? LAYERS : raw.split(',').map((l) => (l === 'iss' ? 'sat' : l));
  return { t, layers: LAYERS.filter((l) => picked.includes(l)) };
}
