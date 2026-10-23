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
  const tRaw = Number(p.get('t'));
  const t = p.has('t') && Number.isFinite(tRaw) ? tRaw : null;
  const raw = p.get('layers');
  const picked = raw === null ? LAYERS : raw.split(',');
  return { t, layers: LAYERS.filter((l) => picked.includes(l)) };
}
