export type GlobeMode = 'shader' | 'tiles';

// 카메라 고도(지구 반지름 단위). 경계에서 오락가락하지 않게 들어가는 값과 나오는 값을 나눈다
export const ENTER_TILES = 0.6;
export const EXIT_TILES = 0.8;

export function nextMode(mode: GlobeMode, altitude: number): GlobeMode {
  if (mode === 'shader') return altitude < ENTER_TILES ? 'tiles' : 'shader';
  return altitude > EXIT_TILES ? 'shader' : 'tiles';
}
