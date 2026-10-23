import { useEffect, useRef } from 'react';
import Globe, { type GlobeInstance } from 'globe.gl';
import type { IssPos } from '../sources/iss.ts';
import type { PulseEvent, Selection } from '../model.ts';
import { activeRings, quakeOpacity, ringProgress } from '../lib/timeline.ts';
import { ISS_COLOR, LAUNCH_COLOR, quakeColor, quakeRadius, RING_RGB } from '../lib/style.ts';
import { msg } from '../i18n.ts';

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
      .globeImageUrl(`${import.meta.env.BASE_URL}textures/earth-night.webp`)
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
      .pathTransitionDuration(0);

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
    globe.current = g;

    return () => {
      ro.disconnect();
      window.clearTimeout(resumeTimer.current);
      controls.removeEventListener('start', onStart);
      controls.removeEventListener('end', onEnd);
      g._destructor();
      globe.current = null;
    };
  }, []);

  const { t, quakes, launches, iss, orbit, issStale, reducedMotion, follow } = props;

  // 점: 지진 + 발사 기둥. 같은 객체를 넘기므로 globe.gl이 메시를 재사용하고 색만 다시 계산한다
  useEffect(() => {
    globe.current?.pointsData([...quakes, ...launches]);
  }, [t, quakes, launches]);

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
