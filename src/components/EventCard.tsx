import { useEffect, useRef } from 'react';
import type { IssPos } from '../sources/iss.ts';
import type { KpPoint, Selection } from '../model.ts';
import { fmtCountdown, fmtTime, lang, msg } from '../i18n.ts';
import { gScale, ovalLatitude } from '../lib/aurora.ts';
import { stormAt, stormCategory } from '../lib/storm.ts';

type Props = {
  selection: Selection;
  t: number;
  iss: IssPos | null;
  issStale: boolean;
  kp: KpPoint | null;
  follow: boolean;
  onFollow: (f: boolean) => void;
  onClose: () => void;
};

export function EventCard(p: Props) {
  const ref = useRef<HTMLElement>(null);
  const s = p.selection;
  const id = s.kind === 'event' ? s.event.id : s.kind === 'storm' ? s.storm.id : s.kind === 'tornado' ? s.tornado.id : s.kind;
  useEffect(() => {
    ref.current?.focus();
  }, [id]);
  return (
    <aside ref={ref} tabIndex={-1} className="card panel">
      <button type="button" className="card-close btn btn-small" onClick={p.onClose} aria-label={msg.close}>
        ✕
      </button>
      {s.kind === 'iss' ? (
        <IssBody {...p} />
      ) : s.kind === 'storm' ? (
        <StormBody {...p} />
      ) : s.kind === 'tornado' ? (
        <TornadoBody {...p} />
      ) : s.kind === 'aurora' ? (
        <AuroraBody {...p} />
      ) : (
        <EventBody {...p} />
      )}
    </aside>
  );
}

function IssBody({ iss, issStale, follow, onFollow }: Props) {
  return (
    <>
      <h2>ISS</h2>
      {iss ? (
        <dl className="num">
          <dt>{msg.issPosition}</dt>
          <dd>{iss.lat.toFixed(2)}°, {iss.lng.toFixed(2)}°</dd>
          <dt>{msg.altitude}</dt>
          <dd>{Math.round(iss.altKm)} km</dd>
        </dl>
      ) : (
        <p>{msg.failed}</p>
      )}
      {issStale && <p className="warn-text">{msg.estimated}</p>}
      <button type="button" className={`btn${follow ? ' btn-on' : ''}`} onClick={() => onFollow(!follow)}>
        {follow ? msg.unfollow : msg.follow}
      </button>
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
