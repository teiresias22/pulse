import { HOUR, isNum, validCoord, type Loaded, type Port, type PortsData } from '../model.ts';
import { withCache } from '../lib/cache.ts';
import { fetchJson } from './http.ts';

// 수집기(GitHub Actions)가 사이트와 같이 배포하는 파일. 개발 서버에는 없으므로 배포된 사이트에서 받는다(Pages는 CORS *)
// 함수 안에서 읽는다 — node:test가 이 모듈을 불러올 때 import.meta.env가 없다
function dataUrl(path: string): string {
  const base = import.meta.env.DEV ? 'https://pulse.joon.is-a.dev/' : import.meta.env.BASE_URL;
  return `${base}data/${path}`;
}

const KINDS = ['port', 'chokepoint'] as const;
const VESSELS = ['container', 'dry_bulk', 'general_cargo', 'roro', 'tanker'] as const;

function isPort(x: unknown): x is Port {
  const p = x as Partial<Port> | null;
  return (
    typeof p?.id === 'string' &&
    KINDS.includes(p.kind as (typeof KINDS)[number]) &&
    typeof p.name === 'string' &&
    typeof p.country === 'string' &&
    isNum(p.lat) && isNum(p.lng) && validCoord(p.lat, p.lng) &&
    Array.isArray(p.days) && p.days.length === 7 && p.days.every(isNum) &&
    isNum(p.base) &&
    typeof p.byType === 'object' && p.byType !== null && VESSELS.every((k) => isNum(p.byType?.[k]))
  );
}

export function parsePorts(json: unknown): PortsData | null {
  const j = json as { builtAt?: unknown; through?: Record<string, unknown>; items?: unknown } | null;
  const through = j?.through;
  if (!isNum(j?.builtAt) || typeof through?.port !== 'string' || typeof through.chokepoint !== 'string' || !Array.isArray(j.items)) {
    return null;
  }
  return { builtAt: j.builtAt, through: { port: through.port, chokepoint: through.chokepoint }, items: (j.items as unknown[]).filter(isPort) };
}

export function loadPorts(now = Date.now()): Promise<Loaded<PortsData>> {
  return withCache('pp:ports', 6 * HOUR, now, async () => {
    const data = parsePorts(await fetchJson(dataUrl('ports.json'), 15_000));
    if (!data) throw new Error('invalid ports.json');
    return data;
  });
}
