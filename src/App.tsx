import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { GlobeView } from './components/GlobeView.tsx';
import { loadQuakes } from './sources/usgs.ts';
import { loadLaunches } from './sources/launches.ts';
import { isTleStale, loadTle, makePropagator, orbitPath, type Tle } from './sources/iss.ts';
import { Scrubber } from './components/Scrubber.tsx';
import { timeRange, visibleLaunches, visibleQuakes } from './lib/timeline.ts';
import { decodeHash, encodeHash } from './lib/hash.ts';
import { HOUR, MINUTE, SPEEDS, type LayerKey, type LayerStatus, type Loaded, type PulseEvent, type Selection } from './model.ts';
import './App.css';

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export default function App() {
  const [initial] = useState(() => decodeHash(window.location.hash));
  const [anchor] = useState(() => Date.now()); // 스크러버 범위 기준(페이지를 연 시각)
  const range = timeRange(anchor);
  const [live, setLive] = useState(initial.t === null);
  const [t, setT] = useState(() =>
    initial.t === null ? Date.now() : Math.min(range.max, Math.max(range.min, initial.t)),
  );
  const [layers] = useState<LayerKey[]>(initial.layers); // Task 8에서 [layers, setLayers]로 바꾼다
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(SPEEDS[0]);
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

  // 재생: rAF로 시뮬레이션 시간을 쌓고, 화면 갱신(setT)은 초당 10회로 제한한다
  const tRef = useRef(t);
  useEffect(() => {
    tRef.current = t;
  });
  const simRef = useRef(t); // 재생 루프·스크럽이 공유하는 시뮬레이션 시각
  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    let last = performance.now();
    let lastSet = last;
    const step = (now: number) => {
      const dt = Math.min(now - last, 250); // 숨겨졌던 탭이 돌아와도 끝으로 튀지 않게
      simRef.current = Math.min(range.max, simRef.current + (dt / 1000) * speed);
      last = now;
      if (now - lastSet >= 100 || simRef.current >= range.max) {
        lastSet = now;
        setT(simRef.current);
      }
      if (simRef.current >= range.max) {
        setPlaying(false);
        return;
      }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [playing, speed, range.max]);

  // 해시: 재생 중엔 쓰지 않고, 멈춘 뒤 0.5초 지나 한 번(Safari는 replaceState 횟수를 제한한다)
  useEffect(() => {
    if (playing) return;
    const id = window.setTimeout(() => {
      history.replaceState(null, '', encodeHash({ t: live ? null : t, layers }));
    }, 500);
    return () => window.clearTimeout(id);
  }, [playing, live, t, layers]);

  const scrubTo = useCallback(
    (next: number) => {
      setLive(false);
      const v = Math.min(range.max, Math.max(range.min, next));
      simRef.current = v;
      setT(v);
    },
    [range.min, range.max],
  );
  const goLive = useCallback(() => {
    setPlaying(false);
    setLive(true);
    setT(Date.now());
  }, []);
  const togglePlay = useCallback(() => {
    setLive(false);
    if (!playing) {
      // 끝에서 재생을 누르면 처음부터
      simRef.current = tRef.current >= range.max ? range.min : tRef.current;
      setT(simRef.current);
    }
    setPlaying(!playing);
  }, [playing, range.min, range.max]);

  // 키보드: ←→ ±1시간, Space 재생. 입력 요소에 포커스가 있으면 그 요소에 맡긴다
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'BUTTON' || tag === 'A') return;
      if (e.key === 'ArrowLeft') scrubTo(tRef.current - HOUR);
      else if (e.key === 'ArrowRight') scrubTo(tRef.current + HOUR);
      else if (e.key === ' ') {
        if (!e.repeat) togglePlay();
      }
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [scrubTo, togglePlay]);

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
      <Scrubber
        t={t}
        min={range.min}
        max={range.max}
        now={live ? t : anchor}
        live={live}
        playing={playing}
        speed={speed}
        onScrub={scrubTo}
        onTogglePlay={togglePlay}
        onSpeed={setSpeed}
        onLive={goLive}
      />
    </div>
  );
}
