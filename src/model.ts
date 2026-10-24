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

// 미국 기상청 토네이도 경보 한 건. end는 갱신·취소로 앞당겨진 실제 종료 시각
export type TornadoWarning = {
  id: string;
  start: number;
  end: number;
  area: string;
  headline: string;
  geometry: { type: 'Polygon'; coordinates: number[][][] };
};

// NOAA 행성 Kp 지수(3시간 구간의 시작 시각). kind: 관측 · 추정(관측 대기) · 예보
export type KpPoint = { time: number; kp: number; kind: 'observed' | 'estimated' | 'predicted' };

export type LayerKey = 'quake' | 'storm' | 'tornado' | 'fire' | 'launch' | 'iss' | 'aurora';
export const LAYERS: LayerKey[] = ['quake', 'storm', 'tornado', 'fire', 'launch', 'iss', 'aurora'];

export const MINUTE = 60_000;
export const HOUR = 60 * MINUTE;
export const DAY = 24 * HOUR;
export const SPEEDS = [HOUR, 6 * HOUR, DAY];

// stale = 새로 받지 못해 예전 캐시를 돌려준 경우
export type Loaded<T> = { value: T; fetchedAt: number; stale: boolean };

export type Selection = { kind: 'event'; event: PulseEvent } | { kind: 'iss' } | { kind: 'storm'; storm: Storm };

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
