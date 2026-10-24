import { useEffect, useRef } from 'react';
import Globe, { type GlobeInstance } from 'globe.gl';
import type { IssPos } from '../sources/iss.ts';
import type { PulseEvent, Selection } from '../model.ts';
import { activeRings, quakeOpacity, ringProgress } from '../lib/timeline.ts';
import { ISS_COLOR, LAUNCH_COLOR, quakeColor, quakeRadius, RING_RGB } from '../lib/style.ts';
import { msg } from '../i18n.ts';
import { MeshBasicMaterial, TextureLoader, type ShaderMaterial } from 'three';
import { antipode, subsolarPoint, type GeoPoint } from '../lib/sun.ts';
import { nextMode, type GlobeMode } from '../lib/globeMode.ts';
import { createDayNightMaterial, setSunDirection } from '../lib/dayNightMaterial.ts';

export type GlobeProps = {
  t: number;
  quakes: PulseEvent[];
  launches: PulseEvent[];
  iss: IssPos | null;
  orbit: IssPos[];
  issStale: boolean;
  reducedMotion: boolean;
  follow: boolean;
  onSelect: (s: Selection) => void;
  onUserInteract: () => void;
};

type Marker = { lat: number; lng: number; alt: number; launch?: PulseEvent; iss?: true };

const EARTH_KM = 6371;
const LAUNCH_ALT = 0.12;
const SYMBOL = { success: '▲', failure: '✕', upcoming: '◇' } as const;
// 가까이 확대했을 때만 쓰는 NASA GIBS 블루 마블 타일(키 없음, CORS *)
type TileUrl = (x: number, y: number, level: number) => string;
const GIBS_TILE: TileUrl = (x, y, level) =>
  `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/BlueMarble_ShadedRelief_Bathymetry/default/2004-08/GoogleMapsCompatible_Level8/${level}/${y}/${x}.jpeg`;
// 타일 모드의 밤: 조명을 돌리면 지진 점까지 어두워지므로 반투명 반구를 덮는다
const NIGHT_MATERIAL = new MeshBasicMaterial({ color: '#000000', transparent: true, opacity: 0.55, depthWrite: false });

export function GlobeView(props: GlobeProps) {
  const el = useRef<HTMLDivElement>(null);
  const globe = useRef<GlobeInstance | null>(null);
  // accessor·이벤트 핸들러가 최신 값을 읽도록 ref에 둔다(globe는 한 번만 만든다)
  const latest = useRef(props);
  useEffect(() => {
    latest.current = props;
  });
  // ISS 마커 객체를 재사용해야 globe.gl이 DOM 요소를 매번 새로 만들지 않는다
  const issMarker = useRef<Marker>({ lat: 0, lng: 0, alt: 0, iss: true });
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
    const g = new Globe(host)
      .backgroundImageUrl(`${import.meta.env.BASE_URL}textures/night-sky.webp`)
      .pointLat('lat')
      .pointLng('lng')
      .pointsTransitionDuration(0)
      .pointAltitude((d) => ((d as PulseEvent).kind === 'launch' ? LAUNCH_ALT : 0.01))
      .pointRadius((d) => {
        const e = d as PulseEvent;
        return e.kind === 'launch' ? 0.12 : quakeRadius(e.magnitude ?? 0);
      })
      .pointColor((d) => {
        const e = d as PulseEvent;
        return e.kind === 'launch' ? LAUNCH_COLOR : quakeColor(e.magnitude ?? 0, quakeOpacity(e, latest.current.t));
      })
      .onPointClick((d) => latest.current.onSelect({ kind: 'event', event: d as PulseEvent }))
      .ringLat('lat')
      .ringLng('lng')
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
      .pathPointAlt((p) => (p as IssPos).altKm / EARTH_KM)
      .pathColor(() => 'rgba(245, 247, 255, 0.55)')
      .pathStroke(1.2)
      .pathTransitionDuration(0)
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
        if (globe.current !== g) return;
        const m = createDayNightMaterial(day, night);
        setSunDirection(m, subsolarPoint(latest.current.t));
        dayNight.current = m;
        g.globeMaterial(m);
      })
      .catch(() => {
        // 낮 텍스처를 못 받으면 예전처럼 밤 텍스처만
        if (globe.current === g) g.globeImageUrl(`${base}textures/earth-night.webp`);
      });

    function makeMarker(d: Marker): HTMLElement {
      const b = document.createElement('button');
      b.type = 'button';
      b.style.pointerEvents = 'auto';
      if (d.iss) {
        b.className = 'marker marker-iss';
        b.textContent = '◉';
        b.style.color = ISS_COLOR;
        b.setAttribute('aria-label', 'ISS');
        b.onclick = (ev) => {
          ev.stopPropagation();
          latest.current.onSelect({ kind: 'iss' });
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

  const { t, quakes, launches, iss, orbit, issStale, reducedMotion, follow } = props;

  // 점: 지진 + 발사 기둥. 같은 객체를 넘기므로 globe.gl이 메시를 재사용하고 색만 다시 계산한다
  useEffect(() => {
    globe.current?.pointsData([...quakes, ...launches]);
  }, [t, quakes, launches]);

  // 스크러버 시각의 태양 위치로 셰이더 밤낮 경계와 타일 모드의 밤 반구를 옮긴다
  useEffect(() => {
    const sun = subsolarPoint(t);
    if (dayNight.current) setSunDirection(dayNight.current, sun);
    nightTile.current = antipode(sun);
    if (mode.current === 'tiles') globe.current?.tilesData([nightTile.current]);
  }, [t]);

  useEffect(() => {
    globe.current?.ringsData(reducedMotion ? [] : activeRings(quakes, t));
  }, [t, quakes, reducedMotion]);

  // 발사 기호와 ISS 마커. launches 배열은 렌더마다 새로 걸러 오지만 원소(이벤트 객체)는 같으므로,
  // 이벤트 객체별로 마커 객체를 하나씩 기억해 두고 재사용한다(DOM 요소를 1초마다 다시 만들지 않게)
  const markerOf = useRef(new WeakMap<PulseEvent, Marker>());
  useEffect(() => {
    const markers = launches.map((e) => {
      let m = markerOf.current.get(e);
      if (!m) {
        m = { lat: e.lat, lng: e.lng, alt: LAUNCH_ALT + 0.02, launch: e };
        markerOf.current.set(e, m);
      }
      return m;
    });
    const m = issMarker.current;
    if (iss) Object.assign(m, { lat: iss.lat, lng: iss.lng, alt: iss.altKm / EARTH_KM });
    globe.current?.htmlElementsData(iss ? [...markers, m] : markers);
  }, [launches, iss]);

  useEffect(() => {
    const g = globe.current;
    if (!g) return;
    g.pathDashLength(issStale ? 0.02 : 1).pathDashGap(issStale ? 0.015 : 0);
    g.pathsData(orbit.length ? [{ points: orbit }] : []);
  }, [orbit, issStale]);

  useEffect(() => {
    if (follow && iss) globe.current?.pointOfView({ lat: iss.lat, lng: iss.lng, altitude: 1.8 }, 0);
  }, [follow, iss]);

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
