import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { loadQuakes } from './sources/usgs.ts';
import { loadLaunches } from './sources/launches.ts';
import { loadTornadoes } from './sources/nws.ts';
import { loadKp } from './sources/kp.ts';
import { kpAt } from './lib/aurora.ts';
import { loadAnimals } from './sources/collected.ts';
import { ANIMAL_GROUPS, clusterAnimals, visibleAnimals, type AnimalCluster } from './lib/animals.ts';
import { loadEonet, type EonetData } from './sources/eonet.ts';
import { loadSats, makePropagator } from './sources/satellites.ts';
import { dockedTo, isSatStale, orbitPath, type SatOnGlobe, type SatOrbit } from './lib/satellites.ts';
import { Header } from './components/Header.tsx';
import { Legend } from './components/Legend.tsx';
import { EventCard } from './components/EventCard.tsx';
import { Fallback } from './components/Fallback.tsx';
import { hasWebGL } from './lib/webgl.ts';
import { Scrubber } from './components/Scrubber.tsx';
import { timeRange, visibleFires, visibleLaunches, visibleQuakes } from './lib/timeline.ts';
import { decodeHash, encodeHash } from './lib/hash.ts';
import { track } from './lib/analytics.ts';
import { HOUR, LAYERS, MINUTE, SPEEDS, type LayerKey, type LayerStatus, type KpPoint, type Loaded, type AnimalsData, type AnimalGroup, type PulseEvent, type Sat, type SatPos, type Selection, type Storm, type TornadoWarning } from './model.ts';
import './App.css';

// globe.gl·three는 무거워서 별도 청크로 — 헤더·스크러버가 먼저 그려지고 WebGL 없는 폴백은 받지 않는다
const GlobeView = lazy(() => import('./components/GlobeView.tsx').then((m) => ({ default: m.GlobeView })));

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const webgl = hasWebGL();
const NO_ANIMALS: AnimalCluster[] = [];

// 출처 하나에 로더 하나. 라이브 모드에서 5분마다 전부 부르고, 실제로 받을지는 출처별 캐시가 정한다
// (지진 1분 · 토네이도 15분 · 태풍·산불·Kp 30분 · 발사 1시간 · 동물 6시간 · 위성 1일). 발사가 한도 초과로 막혀 있으면 로더가 네트워크 없이 옛 캐시를 돌려준다
const SOURCES: LayerKey[] = ['quake', 'launch', 'storm', 'tornado', 'aurora', 'sat', 'animal']; // fire는 storm과 같은 EONET 요청
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
  const [animalGroups, setAnimalGroups] = useState<AnimalGroup[]>(initial.animals);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(SPEEDS[0]);
  const [quakes, setQuakes] = useState<PulseEvent[]>([]);
  const [launches, setLaunches] = useState<PulseEvent[]>([]);
  const [storms, setStorms] = useState<Storm[]>([]);
  const [fires, setFires] = useState<PulseEvent[]>([]);
  const [tornadoes, setTornadoes] = useState<TornadoWarning[]>([]);
  const [kpPoints, setKpPoints] = useState<KpPoint[]>([]);
  const [sats, setSats] = useState<Sat[]>([]);
  const [animals, setAnimals] = useState<AnimalsData | null>(null);
  const [status, setStatus] = useState<Record<LayerKey, LayerStatus>>({
    quake: { state: 'loading' },
    storm: { state: 'loading' },
    tornado: { state: 'loading' },
    fire: { state: 'loading' },
    launch: { state: 'loading' },
    sat: { state: 'loading' },
    aurora: { state: 'loading' },
    animal: { state: 'loading' },
  });
  const [follow, setFollow] = useState(false);
  const [selected, setSelected] = useState<Selection | null>(null);

  // 출처별 마지막으로 반영한 fetchedAt. 5분 틱이 같은 캐시를 다시 읽으면 새 객체로 바꾸지 않는다
  // (바꾸면 발사 마커·산불 기둥·위성 위치 계산기가 값은 같은데 매번 다시 만들어진다)
  const selectedRef = useRef(selected);
  useEffect(() => {
    selectedRef.current = selected;
  });
  const applied = useRef<Partial<Record<LayerKey, number>>>({});
  const run = useCallback(async <T,>(keys: LayerKey[], loader: () => Promise<Loaded<T>>, apply: (v: T) => void) => {
    const set = (st: LayerStatus) => setStatus((s) => ({ ...s, ...Object.fromEntries(keys.map((k) => [k, st])) }));
    set({ state: 'loading' });
    try {
      const r = await loader();
      if (applied.current[keys[0]] !== r.fetchedAt) {
        applied.current[keys[0]] = r.fetchedAt;
        apply(r.value);
      }
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
      if (key === 'tornado') return run(['tornado'], () => loadTornadoes(), setTornadoes);
      if (key === 'aurora') return run(['aurora'], () => loadKp(), setKpPoints);
      if (key === 'animal') return run(['animal'], () => loadAnimals(), setAnimals);
      // 새 데이터에서 빠진 위성의 카드는 닫는다
      return run(['sat'], () => loadSats(), (d: Sat[]) => {
        setSats(d);
        const cur = selectedRef.current;
        if (cur?.kind === 'sat' && !d.some((x) => x.id === cur.id)) {
          setSelected(null);
          setFollow(false);
        }
      });
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
      history.replaceState(null, '', encodeHash({ t: hashT, layers, animals: animalGroups }));
    }, 500);
    return () => window.clearTimeout(id);
  }, [playing, hashT, layers, animalGroups]);

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

  // 위성: t마다 전부(약 56개) 위치를 계산하고, 정거장 10km 안의 위성은 도킹 중으로 숨긴다
  const satOn = layers.includes('sat');
  const propagators = useMemo(() => new Map(sats.map((s) => [s.id, makePropagator(s)])), [sats]);
  const satPos = useMemo(() => {
    const m = new Map<number, SatPos>();
    if (!satOn) return m;
    for (const [id, positionAt] of propagators) {
      const p = positionAt(t);
      if (p) m.set(id, p);
    }
    return m;
  }, [satOn, propagators, t]);
  const docked = useMemo(() => dockedTo(sats, satPos), [sats, satPos]);
  const selectedSat = selected?.kind === 'sat' ? sats.find((s) => s.id === selected.id) ?? null : null;
  const satsOnGlobe: SatOnGlobe[] = sats.flatMap((sat) => {
    const pos = satPos.get(sat.id);
    return pos && !docked.has(sat.id) ? [{ sat, pos }] : [];
  });
  const orbits: SatOrbit[] = satsOnGlobe.flatMap(({ sat }) => {
    if (sat.kind !== 'station' && sat.id !== selectedSat?.id) return [];
    const positionAt = propagators.get(sat.id);
    return positionAt ? [{ id: sat.id, points: orbitPath(positionAt, t), stale: isSatStale(sat, t) }] : [];
  });
  const followPos = follow && selectedSat ? satPos.get(selectedSat.id) ?? null : null;
  const dockedNames = selectedSat ? sats.filter((s) => docked.get(s.id) === selectedSat.id).map((s) => s.name) : [];
  const kpNow = layers.includes('aurora') ? kpAt(kpPoints, t) : null;
  // 동물: 지금 t에 보이는 관찰을 칸·묶음별로. 카드는 같은 key의 칸을 다시 찾는다(그 칸이 없으면 그리지 않는다)
  const animalOn = layers.includes('animal');
  const animalClusters = useMemo(
    () =>
      animalOn && animals
        ? clusterAnimals(visibleAnimals(animals.items.filter((a) => animalGroups.includes(a.group)), t))
        : NO_ANIMALS,
    [animalOn, animals, animalGroups, t],
  );
  const selectedCluster = selected?.kind === 'animal' ? animalClusters.find((c) => c.key === selected.key) ?? null : null;
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
  const toggleAnimal = (g: AnimalGroup) => {
    const on = !animalGroups.includes(g);
    setAnimalGroups((gs) => ANIMAL_GROUPS.filter((x) => (x === g ? !gs.includes(x) : gs.includes(x))));
    track('animal_filter', { group: g, on });
  };
  const select = (s: Selection) => {
    // 같은 위성을 다시 누른 게 아니면 따라가기를 끈다(새 위성 자동 추적·지진 클릭 시 카메라 고정 방지)
    if (!(s.kind === 'sat' && selected?.kind === 'sat' && s.id === selected.id)) setFollow(false);
    setSelected(s);
    track('select_content', { content_type: layerOf(s) });
  };
  const followSat = (f: boolean) => {
    setFollow(f);
    if (f && selectedSat) track('follow_sat', { sat_id: selectedSat.id });
  };
  const shareUrl = () =>
    `${window.location.origin}${window.location.pathname}${encodeHash({ t, layers, animals: animalGroups })}`;

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
          tornadoes={layers.includes('tornado') ? tornadoes : []}
          kp={kpNow}
          animals={animalClusters}
          sats={satsOnGlobe}
          orbits={orbits}
          followPos={followPos}
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
        animalGroups={animalGroups}
        onToggleAnimal={toggleAnimal}
        onRetry={(k) => void load(k)}
        shareUrl={shareUrl}
      />
      <Legend animalGroups={animalOn ? animalGroups : []} />
      {selected && (selected.kind !== 'animal' || selectedCluster) && (
        <EventCard
          selection={
            // 태풍·토네이도 카드는 새로 받은 데이터로 보인다(지도 마커와 같은 값 — 갱신·취소된 경보의 종료 시각 등)
            selected.kind === 'storm'
              ? { kind: 'storm', storm: storms.find((s) => s.id === selected.storm.id) ?? selected.storm }
              : selected.kind === 'tornado'
                ? { kind: 'tornado', tornado: tornadoes.find((w) => w.id === selected.tornado.id) ?? selected.tornado }
                : selected
          }
          t={t}
          sat={selectedSat}
          satPos={selectedSat ? satPos.get(selectedSat.id) ?? null : null}
          docked={dockedNames}
          kp={kpNow}
          animalCluster={selectedCluster}
          follow={follow}
          onFollow={followSat}
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
