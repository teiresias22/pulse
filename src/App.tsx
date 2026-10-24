import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { loadQuakes } from './sources/usgs.ts';
import { loadLaunches } from './sources/launches.ts';
import { loadEonet, type EonetData } from './sources/eonet.ts';
import { isTleStale, loadTle, makePropagator, orbitPath, type Tle } from './sources/iss.ts';
import { Header } from './components/Header.tsx';
import { Legend } from './components/Legend.tsx';
import { EventCard } from './components/EventCard.tsx';
import { Fallback } from './components/Fallback.tsx';
import { hasWebGL } from './lib/webgl.ts';
import { Scrubber } from './components/Scrubber.tsx';
import { timeRange, visibleFires, visibleLaunches, visibleQuakes } from './lib/timeline.ts';
import { decodeHash, encodeHash } from './lib/hash.ts';
import { track } from './lib/analytics.ts';
import { HOUR, LAYERS, MINUTE, SPEEDS, type LayerKey, type LayerStatus, type Loaded, type PulseEvent, type Selection, type Storm } from './model.ts';
import './App.css';

// globe.gl·three는 무거워서 별도 청크로 — 헤더·스크러버가 먼저 그려지고 WebGL 없는 폴백은 받지 않는다
const GlobeView = lazy(() => import('./components/GlobeView.tsx').then((m) => ({ default: m.GlobeView })));

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const webgl = hasWebGL();

// 출처 하나에 로더 하나. 라이브 모드에서 5분마다 전부 부르고, 실제로 받을지는 출처별 캐시가 정한다
// (지진 1분 · 태풍·산불 30분 · 발사 1시간 · ISS 1일). 발사가 한도 초과로 막혀 있으면 로더가 네트워크 없이 옛 캐시를 돌려준다
const SOURCES: LayerKey[] = ['quake', 'launch', 'storm', 'iss']; // fire는 storm과 같은 EONET 요청
const layerOf = (s: Selection): LayerKey => (s.kind === 'event' ? s.event.kind : s.kind);

export default function App() {
  const [initial] = useState(() => decodeHash(window.location.hash));
  const [anchor] = useState(() => Date.now()); // 스크러버 범위 기준(페이지를 연 시각)
  const range = timeRange(anchor);
  const [live, setLive] = useState(initial.t === null);
  const [t, setT] = useState(() =>
    initial.t === null ? Date.now() : Math.min(range.max, Math.max(range.min, initial.t)),
  );
  const [layers, setLayers] = useState<LayerKey[]>(initial.layers);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(SPEEDS[0]);
  const [quakes, setQuakes] = useState<PulseEvent[]>([]);
  const [launches, setLaunches] = useState<PulseEvent[]>([]);
  const [storms, setStorms] = useState<Storm[]>([]);
  const [fires, setFires] = useState<PulseEvent[]>([]);
  const [tle, setTle] = useState<Tle | null>(null);
  const [status, setStatus] = useState<Record<LayerKey, LayerStatus>>({
    quake: { state: 'loading' },
    storm: { state: 'loading' },
    fire: { state: 'loading' },
    launch: { state: 'loading' },
    iss: { state: 'loading' },
  });
  const [follow, setFollow] = useState(false);
  const [selected, setSelected] = useState<Selection | null>(null);

  const run = useCallback(async <T,>(keys: LayerKey[], loader: () => Promise<Loaded<T>>, apply: (v: T) => void) => {
    const set = (st: LayerStatus) => setStatus((s) => ({ ...s, ...Object.fromEntries(keys.map((k) => [k, st])) }));
    set({ state: 'loading' });
    try {
      const r = await loader();
      apply(r.value);
      set({ state: 'ok', fetchedAt: r.fetchedAt, stale: r.stale });
    } catch {
      set({ state: 'error' });
    }
  }, []);

  const load = useCallback(
    (key: LayerKey) => {
      if (key === 'quake') return run(['quake'], () => loadQuakes(), setQuakes);
      if (key === 'launch') return run(['launch'], () => loadLaunches(), setLaunches);
      // 태풍·산불은 EONET 한 번의 응답을 나눠 쓴다
      if (key === 'storm' || key === 'fire') {
        return run(['storm', 'fire'], () => loadEonet(), (d: EonetData) => {
          setStorms(d.storms);
          setFires(d.fires);
        });
      }
      return run(['iss'], () => loadTle(), setTle);
    },
    [run],
  );

  useEffect(() => {
    // 마운트 시 한 번 외부 데이터를 가져온다(loading 상태 갱신은 load 안에서)
    /* oxlint-disable react/set-state-in-effect */
    for (const k of SOURCES) void load(k);
    /* oxlint-enable react/set-state-in-effect */
  }, [load]);

  // 라이브: 1초마다 t = 지금
  useEffect(() => {
    if (!live) return;
    const id = window.setInterval(() => setT(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [live]);

  // 라이브: 5분마다 모든 출처를 다시 부른다. 탭이 숨겨져 있으면 건너뛰고, 돌아오면 바로 한 번
  useEffect(() => {
    if (!live) return;
    const tick = () => {
      if (document.visibilityState === 'visible') for (const k of SOURCES) void load(k);
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

  const hashT = live ? null : t;
  // 해시: 재생 중엔 쓰지 않고, 멈춘 뒤 0.5초 지나 한 번(Safari는 replaceState 횟수를 제한한다)
  useEffect(() => {
    if (playing) return;
    const id = window.setTimeout(() => {
      history.replaceState(null, '', encodeHash({ t: hashT, layers }));
    }, 500);
    return () => window.clearTimeout(id);
  }, [playing, hashT, layers]);

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
      track('play');
    }
    setPlaying(!playing);
  }, [playing, range.min, range.max]);

  // 키보드: ←→ ±1시간, Space 재생. 입력 요소에 포커스가 있으면 그 요소에 맡긴다
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'BUTTON' || tag === 'A' || tag === 'SUMMARY') return;
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
  const issStale = tle ? isTleStale(tle, t) : false;
  const toggleLayer = (k: LayerKey) => {
    // 끄는 레이어의 카드가 열려 있으면 닫고 따라가기도 멈춘다
    const open = selected && layerOf(selected);
    if (open === k && layers.includes(k)) {
      setSelected(null);
      setFollow(false);
    }
    setLayers((ls) => LAYERS.filter((l) => (l === k ? !ls.includes(l) : ls.includes(l))));
    track('layer_toggle', { layer: k, on: !layers.includes(k) });
  };
  const select = (s: Selection) => {
    setSelected(s);
    track('select_content', { content_type: layerOf(s) });
  };
  const followIss = (f: boolean) => {
    setFollow(f);
    if (f) track('follow_iss');
  };
  const shareUrl = () =>
    `${window.location.origin}${window.location.pathname}${encodeHash({ t, layers })}`;

  if (!webgl) return <Fallback quakes={quakes} launches={launches} />;

  return (
    <div className="app">
      <Suspense fallback={<div className="globe" />}>
        <GlobeView
          t={t}
          quakes={layers.includes('quake') ? visibleQuakes(quakes, t) : []}
          launches={layers.includes('launch') ? visibleLaunches(launches, t) : []}
          storms={layers.includes('storm') ? storms : []}
          fires={layers.includes('fire') ? visibleFires(fires, t) : []}
          iss={iss}
          orbit={orbit}
          issStale={issStale}
          reducedMotion={reducedMotion}
          follow={follow}
          onSelect={select}
          onUserInteract={() => setFollow(false)}
        />
      </Suspense>
      <Header
        live={live}
        layers={layers}
        status={status}
        now={live ? t : anchor}
        onToggle={toggleLayer}
        onRetry={(k) => void load(k)}
        shareUrl={shareUrl}
      />
      <Legend />
      {selected && (
        <EventCard
          selection={selected}
          t={t}
          iss={iss}
          issStale={issStale}
          follow={follow}
          onFollow={followIss}
          onClose={() => {
            setSelected(null);
            setFollow(false);
          }}
        />
      )}
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
