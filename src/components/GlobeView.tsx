import { useEffect, useRef } from 'react';
import Globe, { type GlobeInstance } from 'globe.gl';
import type { KpPoint, PulseEvent, Sat, SatPos, Selection, Storm, TornadoWarning } from '../model.ts';
import type { SatOnGlobe, SatOrbit } from '../lib/satellites.ts';
import { ANIMAL_ICON, animalOpacity, type AnimalCluster } from '../lib/animals.ts';
import { activeRings, quakeOpacity, ringProgress, visibleTornadoes } from '../lib/timeline.ts';
import {
  AURORA_EQ_COLOR, AURORA_POLE_COLOR, FIRE_COLOR, fireRadius, ISS_COLOR, ISS_PATH_COLOR, LAUNCH_COLOR, quakeColor, quakeRadius,
  RING_RGB, STORM_PATH_COLOR, TORNADO_FILL, TORNADO_STROKE,
} from '../lib/style.ts';
import { auroraRings, GEOMAG_NORTH, GEOMAG_SOUTH, ovalLatitude, ring } from '../lib/aurora.ts';
import { tornadoCenter } from '../sources/nws.ts';
import { stormAt, stormCategory, trackUntil, type StormCategory } from '../lib/storm.ts';
import { msg } from '../i18n.ts';
import { MeshBasicMaterial, TextureLoader, type ShaderMaterial } from 'three';
import { antipode, subsolarPoint, type GeoPoint } from '../lib/sun.ts';
import { nextMode, type GlobeMode } from '../lib/globeMode.ts';
import { createDayNightMaterial, setSunDirection } from '../lib/dayNightMaterial.ts';

export type GlobeProps = {
  t: number;
  quakes: PulseEvent[];
  launches: PulseEvent[];
  storms: Storm[];
  fires: PulseEvent[];
  tornadoes: TornadoWarning[];
  kp: KpPoint | null;
  animals: AnimalCluster[]; // 보이는 동물 관찰을 칸·묶음별로 묶은 것
  sats: SatOnGlobe[]; // 보이는 위성(도킹 중 제외)과 t의 위치
  orbits: SatOrbit[]; // 정거장 + 선택한 위성의 궤도선
  followPos: SatPos | null; // 따라가는 위성의 위치
  reducedMotion: boolean;
  follow: boolean;
  onSelect: (s: Selection) => void;
  onUserInteract: () => void;
};

type Marker = {
  lat: number; lng: number; alt: number;
  launch?: PulseEvent; sat?: Sat; storm?: Storm; cat?: StormCategory; tornado?: TornadoWarning; aurora?: true; cluster?: AnimalCluster; el?: HTMLElement;
};
// 경로 레이어(위성 궤도 + 태풍 경로 + 오로라 띠). altKm이 없는 점은 지표 바로 위
type PathPoint = { lat: number; lng: number; altKm?: number };
type Path = { points: PathPoint[]; color: string; dashed: boolean; aurora?: true };

const EARTH_KM = 6371;
const LAUNCH_ALT = 0.12;
const FIRE_ALT = 0.04;
const STORM_ALT = 0.02;
const TORNADO_ALT = 0.02;
const STORM_PATH_ALT = 0.006;
const SYMBOL = { success: '▲', failure: '✕', upcoming: '◇' } as const;
// 가까이 확대했을 때만 쓰는 NASA GIBS 블루 마블 타일(키 없음, CORS *)
type TileUrl = (x: number, y: number, level: number) => string;
const GIBS_TILE: TileUrl = (x, y, level) =>
  `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/BlueMarble_ShadedRelief_Bathymetry/default/2004-08/GoogleMapsCompatible_Level8/${level}/${y}/${x}.jpeg`;
// 타일 모드의 밤: 조명을 돌리면 지진 점까지 어두워지므로 반투명 반구를 덮는다
const NIGHT_MATERIAL = new MeshBasicMaterial({ color: '#000000', transparent: true, opacity: 0.55, depthWrite: false });
const ANIMAL_ALT = 0.01;

// 동물 마커: 이모지 + 개수(2 이상). t가 바뀔 때마다 부르지만 개수·투명도가 같으면 DOM을 건드리지 않는다
function paintAnimal(el: HTMLElement, c: AnimalCluster, t: number) {
  const n = c.items.length;
  const first = c.items[0];
  const opacity = first ? animalOpacity(first, t).toFixed(2) : '1';
  // 개수가 바뀔 때만 내용을 다시 만들고, 투명도는 문자열이 바뀔 때만 쓴다(틱마다 마커 ~200개)
  if (el.dataset.n !== String(n)) {
    el.dataset.n = String(n);
    el.textContent = ANIMAL_ICON[c.group];
    if (n > 1) {
      const s = document.createElement('span');
      s.className = 'marker-count';
      s.textContent = String(n);
      el.append(s);
    }
    el.setAttribute('aria-label', `${msg.animalGroup[c.group]} · ${msg.animalCount(n)}`);
  }
  if (el.dataset.op !== opacity) {
    el.dataset.op = opacity;
    el.style.opacity = opacity;
  }
}

export function GlobeView(props: GlobeProps) {
  const el = useRef<HTMLDivElement>(null);
  const globe = useRef<GlobeInstance | null>(null);
  // accessor·이벤트 핸들러가 최신 값을 읽도록 ref에 둔다(globe는 한 번만 만든다)
  const latest = useRef(props);
  useEffect(() => {
    latest.current = props;
  });
  // 위성 마커·궤도선은 위성 id별로 같은 객체를 고쳐 쓴다. 새 객체를 넘기면 globe.gl이 DOM을 다시 만들고,
  // 궤도선은 three-globe가 선과 LineMaterial을 버려 t가 바뀔 때마다 셰이더를 다시 컴파일했다(9bac3fe)
  const satMarkerOf = useRef(new Map<number, Marker>());
  const satPathOf = useRef(new Map<number, Path>());
  const dayNight = useRef<ShaderMaterial | null>(null);
  const mode = useRef<GlobeMode>('shader');
  const nightTile = useRef<GeoPoint>(antipode(subsolarPoint(props.t)));
  // 자동 회전 재개 타이머: 마지막 조작·따라가기 종료 10초 뒤에만, 따라가기 중에는 켜지 않는다
  const resumeTimer = useRef<number | undefined>(undefined);
  const scheduleResume = () => {
    window.clearTimeout(resumeTimer.current);
    resumeTimer.current = window.setTimeout(() => {
      const c = globe.current?.controls();
      if (c) c.autoRotate = !latest.current.reducedMotion && !latest.current.follow;
    }, 10_000);
  };

  useEffect(() => {
    const host = el.current;
    if (!host) return;
    const isActive = (d: object) => visibleTornadoes([d as TornadoWarning], latest.current.t).length > 0;
    const g = new Globe(host)
      // 텍스처를 받는 동안 밤 텍스처를 임시로 보인다(globeMaterial이 나중에 재질을 바꾼다)
      .globeImageUrl(`${import.meta.env.BASE_URL}textures/earth-night.webp`)
      .backgroundImageUrl(`${import.meta.env.BASE_URL}textures/night-sky.webp`)
      .pointLat('lat')
      .pointLng('lng')
      .pointsTransitionDuration(0)
      .pointAltitude((d) => {
        const e = d as PulseEvent;
        return e.kind === 'launch' ? LAUNCH_ALT : e.kind === 'fire' ? FIRE_ALT : 0.01;
      })
      .pointRadius((d) => {
        const e = d as PulseEvent;
        if (e.kind === 'launch') return 0.12;
        return e.kind === 'fire' ? fireRadius(e.magnitude ?? 0) : quakeRadius(e.magnitude ?? 0);
      })
      .pointColor((d) => {
        const e = d as PulseEvent;
        if (e.kind === 'launch') return LAUNCH_COLOR;
        return e.kind === 'fire' ? FIRE_COLOR : quakeColor(e.magnitude ?? 0, quakeOpacity(e, latest.current.t));
      })
      .onPointClick((d) => latest.current.onSelect({ kind: 'event', event: d as PulseEvent }))
      .ringLat('lat')
      .ringLng('lng')
      .ringAltitude(0.005)
      .ringMaxRadius((d) => 1 + ((d as PulseEvent).magnitude ?? 0) * 0.8)
      .ringPropagationSpeed(2)
      .ringRepeatPeriod(1400)
      .ringColor((d: object) => {
        const p = ringProgress((d as PulseEvent).time, latest.current.t) ?? 1;
        return (r: number) => `rgba(${RING_RGB}, ${((1 - r) * (1 - p)).toFixed(2)})`;
      })
      .htmlLat('lat')
      .htmlLng('lng')
      .htmlAltitude('alt')
      .htmlTransitionDuration(0)
      .htmlElement((d: object) => makeMarker(d as Marker))
      .pathPoints('points')
      .pathPointLat('lat')
      .pathPointLng('lng')
      .pathPointAlt((p) => {
        const km = (p as PathPoint).altKm;
        return km === undefined ? STORM_PATH_ALT : km / EARTH_KM;
      })
      .pathColor((d: object) => (d as Path).color)
      .pathDashLength((d) => ((d as Path).dashed ? 0.02 : 1))
      .pathDashGap((d) => ((d as Path).dashed ? 0.015 : 0))
      .pathStroke((d: object) => ((d as Path).aurora ? 2.5 : 1.2))
      .pathTransitionDuration(0)
      .polygonGeoJsonGeometry('geometry')
      // 지난 7일 경보를 모두 넣어 두고 t에 유효한 것만 색을 칠한다. 경보가 나타날 때마다 메시를 만들고 버리면
      // 마지막 메시와 함께 재질이 해제돼 재생 중 셰이더를 다시 컴파일했다(빈 색 = 면·테두리 없음, 재질은 유지)
      .polygonCapColor((d: object) => (isActive(d) ? TORNADO_FILL : ''))
      .polygonSideColor(() => '')
      .polygonStrokeColor((d: object) => (isActive(d) ? TORNADO_STROKE : null))
      .polygonAltitude(0.008)
      .polygonsTransitionDuration(0)
      .onPolygonClick((d) => {
        if (isActive(d)) latest.current.onSelect({ kind: 'tornado', tornado: d as TornadoWarning });
      })
      .onPathClick((d) => {
        if ((d as Path).aurora) latest.current.onSelect({ kind: 'aurora' });
      })
      // 누를 수 있는 경로는 오로라 고리뿐이다
      .showPointerCursor((type, d) => type !== 'path' || Boolean((d as Path | null)?.aurora))
      .tileLat('lat')
      .tileLng('lng')
      .tileAltitude(0.004)
      .tileWidth(180)
      .tileHeight(180)
      .tileUseGlobeProjection(false)
      .tileMaterial(() => NIGHT_MATERIAL)
      .tilesTransitionDuration(0)
      .globeTileEngineMaxLevel(8)
      .onZoom(({ altitude }) => applyMode(nextMode(mode.current, altitude)));
    // 모바일 GPU 부담 상한(PageSpeed 모바일이 시간 초과됐다). globe.gl도 생성 시 2로 묶지만 기본값이 바뀌어도 유지
    g.renderer().setPixelRatio(Math.min(window.devicePixelRatio, 2));

    // 고도에 따라 셰이더 지구 ↔ GIBS 타일. 타일 엔진 URL을 끄면(null) three-globe가 셰이더 지구를 다시 보인다
    function applyMode(next: GlobeMode) {
      if (next === mode.current) return;
      mode.current = next;
      g.globeTileEngineUrl(next === 'tiles' ? GIBS_TILE : (null as unknown as TileUrl));
      g.tilesData(next === 'tiles' ? [nightTile.current] : []);
    }

    const base = import.meta.env.BASE_URL;
    const loader = new TextureLoader();
    Promise.all([
      loader.loadAsync(`${base}textures/earth-day.webp`),
      loader.loadAsync(`${base}textures/earth-night.webp`),
    ])
      .then(([day, night]) => {
        if (globe.current !== g) {
          day.dispose();
          night.dispose();
          return;
        }
        const aniso = g.renderer().capabilities.getMaxAnisotropy();
        day.anisotropy = aniso;
        night.anisotropy = aniso;
        const m = createDayNightMaterial(day, night);
        setSunDirection(m, subsolarPoint(latest.current.t));
        dayNight.current = m;
        g.globeMaterial(m);
      })
      .catch(() => {
        // 낮 텍스처를 못 받으면 임시로 깔아 둔 밤 텍스처가 그대로 남는다
      });

    function makeMarker(d: Marker): HTMLElement {
      const b = document.createElement('button');
      b.type = 'button';
      b.style.pointerEvents = 'auto';
      if (d.sat) {
        const station = d.sat.kind === 'station';
        b.className = station ? 'marker marker-iss' : 'marker marker-sat';
        b.textContent = station ? '◉' : '•';
        if (station) b.style.color = ISS_COLOR;
        b.title = d.sat.name;
        b.setAttribute('aria-label', d.sat.name);
        b.onclick = (ev) => {
          ev.stopPropagation();
          if (d.sat) latest.current.onSelect({ kind: 'sat', id: d.sat.id });
        };
      } else if (d.launch) {
        const launch = d.launch;
        b.className = `marker marker-launch marker-${launch.status}`;
        b.textContent = SYMBOL[launch.status ?? 'upcoming'];
        b.setAttribute('aria-label', `${msg.status[launch.status ?? 'upcoming']} · ${launch.label}`);
        b.onclick = (ev) => {
          ev.stopPropagation();
          latest.current.onSelect({ kind: 'event', event: launch });
        };
      } else if (d.storm) {
        b.className = `marker storm-${d.cat}`;
        b.textContent = '🌀';
        b.setAttribute('aria-label', `${msg.layer.storm} · ${d.storm.name}`);
        b.onclick = (ev) => {
          ev.stopPropagation();
          if (d.storm) latest.current.onSelect({ kind: 'storm', storm: d.storm });
        };
        d.el = b; // 등급이 바뀌면 effect가 className만 고친다
      } else if (d.tornado) {
        b.className = 'marker marker-tornado';
        b.textContent = '🌪';
        b.setAttribute('aria-label', `${msg.layer.tornado} · ${d.tornado.area}`);
        b.onclick = (ev) => {
          ev.stopPropagation();
          if (d.tornado) latest.current.onSelect({ kind: 'tornado', tornado: d.tornado });
        };
      } else if (d.aurora) {
        b.className = 'marker marker-aurora';
        b.textContent = '🌌';
        b.setAttribute('aria-label', msg.layer.aurora);
        b.onclick = (ev) => {
          ev.stopPropagation();
          latest.current.onSelect({ kind: 'aurora' });
        };
      } else if (d.cluster) {
        b.className = 'marker marker-animal';
        paintAnimal(b, d.cluster, latest.current.t);
        b.onclick = (ev) => {
          ev.stopPropagation();
          if (d.cluster) latest.current.onSelect({ kind: 'animal', key: d.cluster.key });
        };
        d.el = b; // 개수·투명도가 바뀌면 effect가 paintAnimal로 고친다
      }
      return b;
    }

    const controls = g.controls();
    controls.autoRotate = !latest.current.reducedMotion;
    controls.autoRotateSpeed = 0.35;
    const onStart = () => {
      window.clearTimeout(resumeTimer.current);
      controls.autoRotate = false;
      latest.current.onUserInteract();
    };
    const onEnd = scheduleResume;
    controls.addEventListener('start', onStart);
    controls.addEventListener('end', onEnd);

    // 마커(HTML 버튼) 위 트랙패드 핀치(ctrl+wheel)·Safari 핀치가 페이지 확대로 새지 않게 막고, 휠은 캔버스로 넘겨 지구본을 확대한다
    const canvas = g.renderer().domElement;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      if (e.target !== canvas) canvas.dispatchEvent(new WheelEvent('wheel', e));
    };
    const stopGesture = (e: Event) => e.preventDefault();
    host.addEventListener('wheel', onWheel, { passive: false });
    host.addEventListener('gesturestart', stopGesture);
    host.addEventListener('gesturechange', stopGesture);

    const ro = new ResizeObserver(() => g.width(host.clientWidth).height(host.clientHeight));
    ro.observe(host);
    // 탭이 숨겨지면 렌더 루프를 멈춘다
    const onVisibility = () => (document.hidden ? g.pauseAnimation() : g.resumeAnimation());
    document.addEventListener('visibilitychange', onVisibility);
    globe.current = g;

    return () => {
      ro.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
      window.clearTimeout(resumeTimer.current);
      controls.removeEventListener('start', onStart);
      controls.removeEventListener('end', onEnd);
      host.removeEventListener('wheel', onWheel);
      host.removeEventListener('gesturestart', stopGesture);
      host.removeEventListener('gesturechange', stopGesture);
      const m = dayNight.current;
      if (m) {
        (m.uniforms.dayTexture.value as { dispose(): void }).dispose();
        (m.uniforms.nightTexture.value as { dispose(): void }).dispose();
        m.dispose();
      }
      dayNight.current = null;
      g._destructor();
      globe.current = null;
    };
  }, []);

  const { t, quakes, launches, storms, fires, tornadoes, kp, animals, sats, orbits, followPos, reducedMotion, follow } = props;

  // 점: 지진 + 산불 기둥 + 발사 기둥. 같은 객체를 넘기므로 globe.gl이 메시를 재사용하고 색만 다시 계산한다
  useEffect(() => {
    globe.current?.pointsData([...quakes, ...fires, ...launches]);
  }, [t, quakes, fires, launches]);

  // 토네이도 경보 구역(지난 7일 전부). 같은 객체를 다시 넘겨 t에 맞춰 색만 다시 칠한다
  useEffect(() => {
    globe.current?.polygonsData(tornadoes);
  }, [tornadoes, t]);

  // 스크러버 시각의 태양 위치로 셰이더 밤낮 경계와 타일 모드의 밤 반구를 옮긴다
  useEffect(() => {
    const sun = subsolarPoint(t);
    if (dayNight.current) setSunDirection(dayNight.current, sun);
    Object.assign(nightTile.current, antipode(sun));
    if (mode.current === 'tiles') globe.current?.tilesData([nightTile.current]);
  }, [t]);

  useEffect(() => {
    globe.current?.ringsData(reducedMotion ? [] : activeRings(quakes, t));
  }, [t, quakes, reducedMotion]);

  // 발사 기호와 위성 마커. launches 배열은 렌더마다 새로 걸러 오지만 원소(이벤트 객체)는 같으므로,
  // 이벤트 객체별로 마커 객체를 하나씩 기억해 두고 재사용한다(DOM 요소를 1초마다 다시 만들지 않게)
  const markerOf = useRef(new WeakMap<PulseEvent, Marker>());
  // 태풍 마커는 id로 기억한다(5분마다 다시 읽은 캐시가 새 Storm 객체를 주므로)
  const stormMarkerOf = useRef(new Map<string, Marker>());
  const tornadoMarkerOf = useRef(new WeakMap<TornadoWarning, Marker>());
  const auroraMarkers = useRef<Marker[]>([
    { lat: 0, lng: 0, alt: STORM_ALT, aurora: true },
    { lat: 0, lng: 0, alt: STORM_ALT, aurora: true },
  ]);
  // 동물 마커는 칸 key별로 기억한다(t마다 clusterAnimals가 새 객체를 주므로)
  const animalMarkerOf = useRef(new Map<string, Marker>());
  useEffect(() => {
    const markers = launches.map((e) => {
      let m = markerOf.current.get(e);
      if (!m) {
        m = { lat: e.lat, lng: e.lng, alt: LAUNCH_ALT + 0.02, launch: e };
        markerOf.current.set(e, m);
      }
      return m;
    });
    for (const s of storms) {
      const pos = stormAt(s, t);
      if (!pos) continue;
      const cat = stormCategory(pos.kts);
      let m = stormMarkerOf.current.get(s.id);
      if (!m) {
        m = { lat: pos.lat, lng: pos.lng, alt: STORM_ALT, storm: s, cat };
        stormMarkerOf.current.set(s.id, m);
      }
      if (m.cat !== cat && m.el) m.el.className = `marker storm-${cat}`;
      Object.assign(m, { lat: pos.lat, lng: pos.lng, storm: s, cat });
      markers.push(m);
    }
    for (const w of visibleTornadoes(tornadoes, t)) {
      let m = tornadoMarkerOf.current.get(w);
      if (!m) {
        m = { ...tornadoCenter(w), alt: TORNADO_ALT, tornado: w };
        tornadoMarkerOf.current.set(w, m);
      }
      markers.push(m);
    }
    // 오로라 고리는 선이 가늘어 누르기 어렵다 — 남쪽 경계 위 한 점(북: 자기극의 남쪽, 남: 자기극의 북쪽)에 누를 마커를 둔다
    if (kp) {
      const eq = ovalLatitude(kp.kp);
      const [north, south] = auroraMarkers.current;
      if (north && south) {
        Object.assign(north, ring(GEOMAG_NORTH, eq, 2)[1]);
        Object.assign(south, ring(GEOMAG_SOUTH, eq, 2)[0]);
        markers.push(north, south);
      }
    }
    for (const c of animals) {
      let m = animalMarkerOf.current.get(c.key);
      if (!m) {
        m = { lat: c.lat, lng: c.lng, alt: ANIMAL_ALT, cluster: c };
        animalMarkerOf.current.set(c.key, m);
      }
      Object.assign(m, { lat: c.lat, lng: c.lng, cluster: c });
      if (m.el) paintAnimal(m.el, c, t);
      markers.push(m);
    }
    for (const { sat, pos } of sats) {
      let m = satMarkerOf.current.get(sat.id);
      if (!m) {
        m = { lat: 0, lng: 0, alt: 0, sat };
        satMarkerOf.current.set(sat.id, m);
      }
      Object.assign(m, { lat: pos.lat, lng: pos.lng, alt: pos.altKm / EARTH_KM, sat });
      markers.push(m);
    }
    globe.current?.htmlElementsData(markers);
  }, [launches, storms, tornadoes, kp, t, sats, animals]);

  // 태풍 경로 객체도 id별로 재사용한다(새 객체 → LineMaterial 재생성 → 셰이더 재컴파일)
  const stormPathOf = useRef(new Map<string, Path>());
  // 오로라 고리 4개도 같은 객체를 고쳐 쓰고, Kp 값이 바뀔 때만 좌표를 다시 계산한다
  const auroraPaths = useRef<Path[]>(
    [AURORA_EQ_COLOR, AURORA_POLE_COLOR, AURORA_EQ_COLOR, AURORA_POLE_COLOR].map((color): Path => ({ points: [], color, dashed: false, aurora: true })),
  );
  const auroraKp = useRef<number | null>(null);
  useEffect(() => {
    const g = globe.current;
    if (!g) return;
    const paths: Path[] = [];
    for (const s of storms) {
      const points = trackUntil(s, t);
      if (points.length < 2) continue;
      let p = stormPathOf.current.get(s.id);
      if (!p) {
        p = { points, color: STORM_PATH_COLOR, dashed: false };
        stormPathOf.current.set(s.id, p);
      }
      p.points = points;
      paths.push(p);
    }
    if (kp) {
      if (auroraKp.current !== kp.kp) {
        auroraKp.current = kp.kp;
        auroraRings(kp.kp).forEach((pts, i) => {
          const p = auroraPaths.current[i];
          if (p) p.points = pts;
        });
      }
      paths.push(...auroraPaths.current);
    }
    for (const o of orbits) {
      let p = satPathOf.current.get(o.id);
      if (!p) {
        p = { points: [], color: ISS_PATH_COLOR, dashed: false };
        satPathOf.current.set(o.id, p);
      }
      p.points = o.points;
      p.dashed = o.stale;
      paths.push(p);
    }
    g.pathsData(paths);
  }, [orbits, storms, kp, t]);

  useEffect(() => {
    if (follow && followPos) globe.current?.pointOfView({ lat: followPos.lat, lng: followPos.lng, altitude: 1.8 }, 0);
  }, [follow, followPos]);

  useEffect(() => {
    const c = globe.current?.controls();
    if (!c) return;
    if (follow || reducedMotion) {
      window.clearTimeout(resumeTimer.current);
      c.autoRotate = false;
    } else scheduleResume();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- scheduleResume은 ref만 읽는다
  }, [reducedMotion, follow]);

  return <div ref={el} className="globe" />;
}
