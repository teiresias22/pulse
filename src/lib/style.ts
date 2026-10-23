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
