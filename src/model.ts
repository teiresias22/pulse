export type LaunchStatus = 'success' | 'failure' | 'upcoming';

export type PulseEvent = {
  id: string;
  kind: 'quake' | 'launch' | 'fire';
  time: number; // epoch ms (산불은 시작 시각)
  endTime?: number; // 산불 진화 시각. 없으면 진행 중
  lat: number;
  lng: number;
  magnitude?: number; // 지진 규모 · 산불 면적(에이커)
  status?: LaunchStatus;
  label: string;
  url: string;
};

// 태풍 관측점(6시간 간격). track은 시각 오름차순
export type StormFix = { time: number; lat: number; lng: number; kts: number };
export type Storm = { id: string; name: string; track: StormFix[]; closed: number | null; url: string };

export type LayerKey = 'quake' | 'storm' | 'fire' | 'launch' | 'iss';
export const LAYERS: LayerKey[] = ['quake', 'storm', 'fire', 'launch', 'iss'];

export const MINUTE = 60_000;
export const HOUR = 60 * MINUTE;
export const DAY = 24 * HOUR;
export const SPEEDS = [HOUR, 6 * HOUR, DAY];

// stale = 새로 받지 못해 예전 캐시를 돌려준 경우
export type Loaded<T> = { value: T; fetchedAt: number; stale: boolean };

export type Selection = { kind: 'event'; event: PulseEvent } | { kind: 'iss' };

export type LayerStatus = { state: 'loading' | 'ok' | 'error'; fetchedAt?: number; stale?: boolean };

export function isNum(x: unknown): x is number {
  return typeof x === 'number' && Number.isFinite(x);
}

export function validCoord(lat: number, lng: number): boolean {
  return Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
}

export function httpUrl(x: unknown): string {
  const s = String(x ?? '');
  return /^https?:\/\//.test(s) ? s : '';
}
