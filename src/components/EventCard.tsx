import type { IssPos } from '../sources/iss.ts';
import type { Selection } from '../model.ts';
import { fmtCountdown, fmtTime, msg } from '../i18n.ts';

type Props = {
  selection: Selection;
  t: number;
  iss: IssPos | null;
  issStale: boolean;
  follow: boolean;
  onFollow: (f: boolean) => void;
  onClose: () => void;
};

export function EventCard(p: Props) {
  return (
    <aside className="card panel" aria-live="polite">
      <button type="button" className="card-close btn btn-small" onClick={p.onClose} aria-label={msg.close}>
        ✕
      </button>
      {p.selection.kind === 'iss' ? <IssBody {...p} /> : <EventBody {...p} />}
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

function EventBody({ selection, t }: Props) {
  if (selection.kind !== 'event') return null;
  const e = selection.event;
  return (
    <>
      <h2>{e.kind === 'quake' ? msg.layer.quake : msg.layer.launch}</h2>
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
      </dl>
      {e.url && (
        <a className="btn" href={e.url} target="_blank" rel="noreferrer">
          {msg.source} ↗
        </a>
      )}
    </>
  );
}
