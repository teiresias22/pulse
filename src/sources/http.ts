export class HttpError extends Error {
  status: number;
  retryAfter: string | null;

  constructor(status: number, retryAfter: string | null) {
    super(`HTTP ${status}`);
    this.status = status;
    this.retryAfter = retryAfter;
  }
}

export async function fetchJson(url: string, timeoutMs = 8000): Promise<unknown> {
  const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
  // Retry-After는 CORS 노출 헤더가 아니면 null로 읽힌다 — 호출 쪽이 기본값을 둔다
  if (!res.ok) throw new HttpError(res.status, res.headers.get('Retry-After'));
  return res.json();
}
