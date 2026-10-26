import { useEffect, useRef } from 'react';
import type { KpPoint, PortsData, Sat, SatPos, Selection } from '../model.ts';
import { isSatStale } from '../lib/satellites.ts';
import { fmtCountdown, fmtDay, fmtTime, lang, msg } from '../i18n.ts';
import { daysBehind, portRatio, portWindow, typeShares } from '../lib/ports.ts';
import { gScale, ovalLatitude } from '../lib/aurora.ts';
import { stormAt, stormCategory } from '../lib/storm.ts';

type Props = {
  selection: Selection;
  t: number;
  sat: Sat | null;
  satPos: SatPos | null;
  docked: string[]; // 이 정거장에 도킹 중인 위성 이름
  kp: KpPoint | null;
  follow: boolean;
  onFollow: (f: boolean) => void;
  portsThrough: PortsData['through'] | null;
  now: number;
  onClose: () => void;
};

export function EventCard(p: Props) {
  const ref = useRef<HTMLElement>(null);
  const s = p.selection;
  const id =
    s.kind === 'event' ? s.event.id
    : s.kind === 'storm' ? s.storm.id
    : s.kind === 'tornado' ? s.tornado.id
    : s.kind === 'port' ? s.port.id
    : s.kind === 'sat' ? String(s.id)
    : s.kind;
  useEffect(() => {
    ref.current?.focus();
  }, [id]);
  return (
    <aside ref={ref} tabIndex={-1} className="card panel">
      <button type="button" className="card-close btn btn-small" onClick={p.onClose} aria-label={msg.close}>
        ✕
      </button>
      {s.kind === 'sat' ? (
        <SatBody {...p} />
      ) : s.kind === 'storm' ? (
        <StormBody {...p} />
      ) : s.kind === 'tornado' ? (
        <TornadoBody {...p} />
      ) : s.kind === 'aurora' ? (
        <AuroraBody {...p} />
      ) : s.kind === 'port' ? (
        <PortBody {...p} />
      ) : (
        <EventBody {...p} />
      )}
    </aside>
  );
}

function SatBody({ sat, satPos, docked, t, follow, onFollow }: Props) {
  if (!sat) return <p>{msg.failed}</p>;
  return (
    <>
      <h2>{sat.kind === 'station' ? msg.station : msg.satellite}</h2>
      <p className="card-label">{sat.name}</p>
      {satPos ? (
        <dl className="num">
          <dt>{msg.issPosition}</dt>
          <dd>{satPos.lat.toFixed(2)}°, {satPos.lng.toFixed(2)}°</dd>
          <dt>{msg.altitude}</dt>
          <dd>{Math.round(satPos.altKm)} km</dd>
          <dt>{msg.period}</dt>
          <dd>{Math.round(sat.periodMin)} {msg.minutesUnit}</dd>
          <dt>{msg.inclination}</dt>
          <dd>{sat.inclination.toFixed(1)}°</dd>
          <dt>NORAD</dt>
          <dd>{sat.id}</dd>
          {docked.length > 0 && (
            <>
              <dt>{msg.docked}</dt>
              <dd>{docked.join(', ')}</dd>
            </>
          )}
        </dl>
      ) : (
        <p>{msg.satNoPos}</p>
      )}
      {isSatStale(sat, t) && <p className="warn-text">{msg.estimated}</p>}
      <button type="button" className={`btn${follow ? ' btn-on' : ''}`} onClick={() => onFollow(!follow)}>
        {follow ? msg.unfollow : msg.follow}
      </button>
      <a className="btn" href={`https://celestrak.org/satcat/table-satcat.php?CATNR=${sat.id}`} target="_blank" rel="noreferrer">
        {msg.source} ↗
      </a>
    </>
  );
}

function StormBody({ selection, t }: Props) {
  if (selection.kind !== 'storm') return null;
  const s = selection.storm;
  const pos = stormAt(s, t);
  const last = s.track.at(-1);
  return (
    <>
      <h2>{msg.layer.storm}</h2>
      <p className="card-label">{s.name}</p>
      {pos ? (
        <dl className="num">
          <dt>{msg.wind}</dt>
          <dd>{Math.round(pos.kts)} kt · {Math.round(pos.kts * 1.852)} km/h</dd>
          <dt>{msg.category}</dt>
          <dd>{msg.stormCat[stormCategory(pos.kts)]}</dd>
          {last && (
            <>
              <dt>{msg.lastFix}</dt>
              <dd>{fmtTime(last.time)}</dd>
            </>
          )}
        </dl>
      ) : (
        <p>{msg.stormInactive}</p>
      )}
      {s.url && (
        <a className="btn" href={s.url} target="_blank" rel="noreferrer">
          {msg.source} ↗
        </a>
      )}
    </>
  );
}

function TornadoBody({ selection }: Props) {
  if (selection.kind !== 'tornado') return null;
  const w = selection.tornado;
  return (
    <>
      <h2>{msg.layer.tornado}</h2>
      <p className="card-label">{w.headline}</p>
      <dl className="num">
        <dt>{msg.region}</dt>
        <dd>{w.area}</dd>
        <dt>{msg.inEffect}</dt>
        <dd>{fmtTime(w.start)}</dd>
        <dt>{msg.until}</dt>
        <dd>{fmtTime(w.end)}</dd>
      </dl>
    </>
  );
}

function AuroraBody({ kp }: Props) {
  const g = kp ? gScale(kp.kp) : 0;
  return (
    <>
      <h2>{msg.layer.aurora}</h2>
      {kp ? (
        <>
          <dl className="num">
            <dt>{msg.kpIndex}</dt>
            <dd>{kp.kp.toFixed(2)} · {msg.kpKind[kp.kind]}</dd>
            <dt>{msg.gScale}</dt>
            <dd>{g ? `G${g}` : msg.none}</dd>
          </dl>
          <p>{msg.auroraVisible(Math.round(ovalLatitude(kp.kp)))}</p>
        </>
      ) : (
        <p>{msg.noKp}</p>
      )}
      <p>{msg.auroraApprox}</p>
    </>
  );
}

function PortBody({ selection, portsThrough, now }: Props) {
  if (selection.kind !== 'port') return null;
  const p = selection.port;
  const through = portsThrough?.[p.kind];
  const ratio = portRatio(p);
  const total = p.days.reduce((a, b) => a + b, 0);
  const max = Math.max(p.base, ...p.days, 1);
  const win = through ? portWindow(through) : null;
  const shares = typeShares(p.byType);
  const pct = ratio === null ? null : Math.round((ratio - 1) * 100);
  return (
    <>
      <h2>{msg.portKind[p.kind]}</h2>
      <p className="card-label">{p.country ? `${p.name} · ${p.country}` : p.name}</p>
      {through && win && <p className="num card-note">{msg.portRange(fmtDay(win.from), fmtDay(win.to), daysBehind(through, now))}</p>}
      <div className="bars" role="img" aria-label={msg.portBars(total, Math.round(p.base))}>
        {p.days.map((n, i) => (
          <span key={i} className="bar" style={{ height: `${(n / max) * 100}%` }} />
        ))}
        <span className="bar-base" style={{ bottom: `${(p.base / max) * 100}%` }} />
      </div>
      <dl className="num">
        <dt>{msg.vsUsual}</dt>
        <dd>{pct === null ? '—' : `${pct > 0 ? '+' : ''}${pct}%`}</dd>
        <dt>{msg.vessels7d}</dt>
        <dd>{total.toLocaleString(lang)}</dd>
        {shares.length > 0 && (
          <>
            <dt>{msg.vesselMix}</dt>
            <dd>{shares.map((x) => `${msg.vessel[x.type]} ${Math.round(x.share * 100)}%`).join(' · ')}</dd>
          </>
        )}
      </dl>
      <p className="card-note">{msg.portNote}</p>
    </>
  );
}

function EventBody({ selection, t }: Props) {
  if (selection.kind !== 'event') return null;
  const e = selection.event;
  return (
    <>
      <h2>{msg.layer[e.kind]}</h2>
      <p className="card-label">{e.label}</p>
      <dl className="num">
        <dt>{fmtTime(e.time)}</dt>
        <dd />
        {e.kind === 'quake' && (
          <>
            <dt>{msg.magnitude}</dt>
            <dd>M {e.magnitude?.toFixed(1)}</dd>
          </>
        )}
        {e.kind === 'launch' && e.status && (
          <>
            <dt>{msg.status[e.status]}</dt>
            <dd>{e.status === 'upcoming' ? fmtCountdown(e.time, t) : ''}</dd>
          </>
        )}
        {e.kind === 'fire' && (
          <>
            {e.magnitude !== undefined && (
              <>
                <dt>{msg.area}</dt>
                <dd>
                  {Math.round(e.magnitude).toLocaleString(lang)} ac · {Math.round(e.magnitude * 0.4047).toLocaleString(lang)} ha
                </dd>
              </>
            )}
            <dt>{e.endTime === undefined ? msg.ongoing : msg.contained}</dt>
            <dd>{e.endTime === undefined ? '' : fmtTime(e.endTime)}</dd>
          </>
        )}
      </dl>
      {e.url && (
        <a className="btn" href={e.url} target="_blank" rel="noreferrer">
          {msg.source} ↗
        </a>
      )}
    </>
  );
}
