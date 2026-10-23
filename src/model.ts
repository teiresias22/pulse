export type LaunchStatus = 'success' | 'failure' | 'upcoming';

export type PulseEvent = {
  id: string;
  kind: 'quake' | 'launch';
  time: number; // epoch ms
  lat: number;
  lng: number;
  magnitude?: number;
  status?: LaunchStatus;
  label: string;
  url: string;
};

export type LayerKey = 'quake' | 'launch' | 'iss';
export const LAYERS: LayerKey[] = ['quake', 'launch', 'iss'];

export const MINUTE = 60_000;
export const HOUR = 60 * MINUTE;
export const DAY = 24 * HOUR;

// stale = 새로 받지 못해 예전 캐시를 돌려준 경우
export type Loaded<T> = { value: T; fetchedAt: number; stale: boolean };

export type Selection = { kind: 'event'; event: PulseEvent } | { kind: 'iss' };

export function isNum(x: unknown): x is number {
  return typeof x === 'number' && Number.isFinite(x);
}

export function validCoord(lat: number, lng: number): boolean {
  return Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
}
