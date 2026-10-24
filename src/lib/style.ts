export const LAUNCH_COLOR = '#7bdff2';
export const ISS_COLOR = '#f5f7ff';
export const RING_RGB = '239, 71, 111';

// 노랑→주황→빨강. 크기도 함께 커지므로 색을 못 구분해도 규모가 읽힌다
export function quakeColor(mag: number, alpha: number): string {
  const rgb = mag >= 4.5 ? '239, 71, 111' : mag >= 2.5 ? '247, 140, 64' : '255, 209, 102';
  return `rgba(${rgb}, ${alpha.toFixed(2)})`;
}

// globe.gl pointRadius 단위는 각도(도)
export function quakeRadius(mag: number): number {
  return 0.12 + Math.max(mag, 0) * 0.1;
}

export const FIRE_COLOR = '#ff6b1a';
export const STORM_PATH_COLOR = 'rgba(189, 178, 255, 0.7)';
export const ISS_PATH_COLOR = 'rgba(245, 247, 255, 0.55)';

// 산불 기둥 반지름(도). 면적(에이커)에 로그 비례, 면적이 없으면 최소
export function fireRadius(acres: number): number {
  return 0.1 + Math.log10(Math.max(acres, 1)) * 0.06;
}
