import type { Loaded } from '../model.ts';

type Entry<T> = { savedAt: number; value: T };
type KV = Pick<Storage, 'getItem' | 'setItem'>;

function defaultStorage(): KV | null {
  // 사생활 보호 모드·차단된 사이트 데이터에서는 접근 자체가 던진다
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

export function cacheRead<T>(key: string, storage: KV | null = defaultStorage()): Entry<T> | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(key);
    if (!raw) return null;
    const entry = JSON.parse(raw) as Entry<T> | null;
    return typeof entry?.savedAt === 'number' ? entry : null;
  } catch {
    return null;
  }
}

export function cacheWrite<T>(key: string, value: T, now: number, storage: KV | null = defaultStorage()): void {
  if (!storage) return;
  try {
    storage.setItem(key, JSON.stringify({ savedAt: now, value }));
  } catch {
    // 용량 초과·쓰기 금지 — 캐시 없이 계속
  }
}

export function isFresh(entry: { savedAt: number } | null, maxAgeMs: number, now: number): boolean {
  return entry !== null && now - entry.savedAt < maxAgeMs;
}

export async function withCache<T>(
  key: string,
  maxAgeMs: number,
  now: number,
  fetcher: () => Promise<T>,
  storage: KV | null = defaultStorage(),
): Promise<Loaded<T>> {
  const cached = cacheRead<T>(key, storage);
  if (cached && isFresh(cached, maxAgeMs, now)) {
    return { value: cached.value, fetchedAt: cached.savedAt, stale: false };
  }
  try {
    const value = await fetcher();
    cacheWrite(key, value, now, storage);
    return { value, fetchedAt: now, stale: false };
  } catch (err) {
    if (cached) return { value: cached.value, fetchedAt: cached.savedAt, stale: true };
    throw err;
  }
}
