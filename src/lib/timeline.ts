import { DAY, HOUR, type PulseEvent, type TornadoWarning } from '../model.ts';

export const WINDOW_MS = 7 * DAY;
export const RING_MS = 3 * HOUR;

export function timeRange(now: number): { min: number; max: number } {
  return { min: now - WINDOW_MS, max: now + WINDOW_MS };
}

export function visibleQuakes(events: PulseEvent[], t: number): PulseEvent[] {
  return events.filter((e) => e.kind === 'quake' && e.time <= t && e.time > t - WINDOW_MS);
}

export function visibleLaunches(events: PulseEvent[], t: number): PulseEvent[] {
  return events.filter((e) => e.kind === 'launch' && (e.status === 'upcoming' || e.time <= t));
}

export function visibleFires(events: PulseEvent[], t: number): PulseEvent[] {
  return events.filter((e) => e.kind === 'fire' && e.time <= t && (e.endTime === undefined || t < e.endTime));
}

export function visibleTornadoes(ws: TornadoWarning[], t: number): TornadoWarning[] {
  return ws.filter((w) => w.start <= t && t < w.end);
}

export function quakeOpacity(e: PulseEvent, t: number): number {
  return Math.max(0.15, 1 - (t - e.time) / WINDOW_MS);
}

export function ringProgress(eventTime: number, t: number, windowMs = RING_MS): number | null {
  const p = (t - eventTime) / windowMs;
  return p >= 0 && p < 1 ? p : null;
}

export function activeRings(quakes: PulseEvent[], t: number): PulseEvent[] {
  return quakes.filter((q) => (q.magnitude ?? 0) >= 2.5 && ringProgress(q.time, t) !== null);
}
