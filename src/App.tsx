import { useCallback, useEffect, useMemo, useState } from 'react';
import { GlobeView } from './components/GlobeView.tsx';
import { loadQuakes } from './sources/usgs.ts';
import { loadLaunches } from './sources/launches.ts';
import { isTleStale, loadTle, makePropagator, orbitPath, type Tle } from './sources/iss.ts';
import { visibleLaunches, visibleQuakes } from './lib/timeline.ts';
import { MINUTE, type LayerKey, type LayerStatus, type Loaded, type PulseEvent, type Selection } from './model.ts';
import './App.css';

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export default function App() {
  const [t, setT] = useState(() => Date.now());
  const [live] = useState(true);
  const [layers] = useState<LayerKey[]>(['quake', 'launch', 'iss']);
  const [quakes, setQuakes] = useState<PulseEvent[]>([]);
  const [launches, setLaunches] = useState<PulseEvent[]>([]);
  const [tle, setTle] = useState<Tle | null>(null);
  const [, setStatus] = useState<Record<LayerKey, LayerStatus>>({
    quake: { state: 'loading' },
    launch: { state: 'loading' },
    iss: { state: 'loading' },
  });
  const [follow, setFollow] = useState(false);
  const [, setSelected] = useState<Selection | null>(null);

  const run = useCallback(async <T,>(key: LayerKey, loader: () => Promise<Loaded<T>>, apply: (v: T) => void) => {
    setStatus((s) => ({ ...s, [key]: { state: 'loading' } }));
    try {
      const r = await loader();
      apply(r.value);
      setStatus((s) => ({ ...s, [key]: { state: 'ok', fetchedAt: r.fetchedAt, stale: r.stale } }));
    } catch {
      setStatus((s) => ({ ...s, [key]: { state: 'error' } }));
    }
  }, []);

  const load = useCallback(
    (key: LayerKey) => {
      if (key === 'quake') return run('quake', () => loadQuakes(), setQuakes);
      if (key === 'launch') return run('launch', () => loadLaunches(), setLaunches);
      return run('iss', () => loadTle(), setTle);
    },
    [run],
  );

  useEffect(() => {
    // 마운트 시 한 번 외부 데이터를 가져온다(loading 상태 갱신은 load 안에서)
    /* oxlint-disable react/set-state-in-effect */
    void load('quake');
    void load('launch');
    void load('iss');
    /* oxlint-enable react/set-state-in-effect */
  }, [load]);

  // 라이브: 1초마다 t = 지금
  useEffect(() => {
    if (!live) return;
    const id = window.setInterval(() => setT(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [live]);

  // 라이브: 5분마다 지진 갱신. 탭이 숨겨져 있으면 건너뛰고, 돌아오면 바로 한 번
  useEffect(() => {
    if (!live) return;
    const tick = () => {
      if (document.visibilityState === 'visible') void load('quake');
    };
    const id = window.setInterval(tick, 5 * MINUTE);
    document.addEventListener('visibilitychange', tick);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [live, load]);

  const positionAt = useMemo(() => (tle ? makePropagator(tle) : null), [tle]);
  const iss = layers.includes('iss') && positionAt ? positionAt(t) : null;
  const orbit = iss && positionAt ? orbitPath(positionAt, t) : [];

  return (
    <div className="app">
      <GlobeView
        t={t}
        quakes={layers.includes('quake') ? visibleQuakes(quakes, t) : []}
        launches={layers.includes('launch') ? visibleLaunches(launches, t) : []}
        iss={iss}
        orbit={orbit}
        issStale={tle ? isTleStale(tle, t) : false}
        reducedMotion={reducedMotion}
        follow={follow}
        onSelect={setSelected}
        onUserInteract={() => setFollow(false)}
      />
    </div>
  );
}
