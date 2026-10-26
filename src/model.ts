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

// CelesTrak GP(OMM) 위성 하나. omm은 satellite.js json2satrec에 그대로 넘긴다
export type SatKind = 'station' | 'sat';
export type Sat = { id: number; name: string; kind: SatKind; epoch: number; periodMin: number; inclination: number; omm: Record<string, unknown> };
export type SatPos = { lat: number; lng: number; altKm: number };

// iNaturalist 검증 관찰 하나(수집기가 만든 data/animals.json). photo·license는 CC 사진일 때만
export type AnimalGroup = 'bear' | 'elephant' | 'bigcat' | 'penguin' | 'turtle' | 'seal' | 'whale';
export type Animal = {
  id: number;
  group: AnimalGroup;
  name: string;
  sci: string;
  lat: number;
  lng: number;
  time: number;
  obscured: boolean;
  photo: string | null;
  license: string | null;
  by: string;
};
export type AnimalsData = { builtAt: number; from: string; items: Animal[] };

export type LayerKey = 'quake' | 'storm' | 'tornado' | 'fire' | 'launch' | 'sat' | 'aurora' | 'animal';
export const LAYERS: LayerKey[] = ['quake', 'storm', 'tornado', 'fire', 'launch', 'sat', 'aurora', 'animal'];

export const MINUTE = 60_000;
export const HOUR = 60 * MINUTE;
export const DAY = 24 * HOUR;
export const SPEEDS = [HOUR, 6 * HOUR, DAY];

// stale = 새로 받지 못해 예전 캐시를 돌려준 경우
export type Loaded<T> = { value: T; fetchedAt: number; stale: boolean };

export type Selection =
  | { kind: 'event'; event: PulseEvent }
  | { kind: 'sat'; id: number }
  | { kind: 'storm'; storm: Storm }
  | { kind: 'tornado'; tornado: TornadoWarning }
  | { kind: 'aurora' }
  | { kind: 'animal'; key: string };

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
