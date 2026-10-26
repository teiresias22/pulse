import { DAY, type Port, type VesselType } from '../model.ts';

export type PortTrend = 'down2' | 'down' | 'normal' | 'up' | 'up2';

// 최근 7일 하루 평균 ÷ 평소(직전 90일 하루 평균). 평소가 0이면 비교할 수 없다
export function portRatio(p: Pick<Port, 'days' | 'base'>): number | null {
  if (!(p.base > 0) || p.days.length === 0) return null;
  return p.days.reduce((a, b) => a + b, 0) / p.days.length / p.base;
}

// ponytail: 색 보간 대신 5단계 — 재질 5개를 재사용한다. 단계가 부족하면 경계만 늘린다
export function portTrend(ratio: number | null): PortTrend {
  if (ratio === null) return 'normal';
  if (ratio <= 0.7) return 'down2';
  if (ratio < 0.9) return 'down';
  if (ratio <= 1.1) return 'normal';
  if (ratio < 1.3) return 'up';
  return 'up2';
}

const utc = (date: string) => Date.parse(`${date}T00:00:00Z`);

export function portWindow(through: string): { from: number; to: number } {
  const to = utc(through);
  return { from: to - 6 * DAY, to };
}

export function daysBehind(through: string, now: number): number {
  return Math.floor((now - utc(through)) / DAY);
}

export function typeShares(byType: Record<VesselType, number>): { type: VesselType; share: number }[] {
  const entries = Object.entries(byType) as [VesselType, number][];
  const total = entries.reduce((a, [, n]) => a + n, 0);
  if (total <= 0) return [];
  return entries
    .filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([type, n]) => ({ type, share: n / total }));
}
