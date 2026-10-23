import { SPEEDS } from '../model.ts';
import { fmtTime, lang, msg } from '../i18n.ts';

const SPEED_LABEL = ['1h/s', '6h/s', '1d/s'];

export type ScrubberProps = {
  t: number;
  min: number;
  max: number;
  now: number;
  live: boolean;
  playing: boolean;
  speed: number;
  onScrub: (t: number) => void;
  onTogglePlay: () => void;
  onSpeed: (s: number) => void;
  onLive: () => void;
};

const day = new Intl.DateTimeFormat(lang, { month: 'numeric', day: 'numeric' });

export function Scrubber(p: ScrubberProps) {
  const nowPct = ((p.now - p.min) / (p.max - p.min)) * 100;
  const label = SPEED_LABEL[SPEEDS.indexOf(p.speed)];
  const next = SPEEDS[(SPEEDS.indexOf(p.speed) + 1) % SPEEDS.length];
  return (
    <section className="scrubber panel" aria-label={msg.timeline}>
      <div className="scrubber-row">
        <button type="button" className="btn" onClick={p.onTogglePlay} aria-label={p.playing ? msg.pause : msg.play}>
          {p.playing ? '❚❚' : '▶'}
        </button>
        <button type="button" className="btn num" onClick={() => p.onSpeed(next)} aria-label={`${msg.speed} ${label}`}>
          {label}
        </button>
        <span className="scrubber-time num">{fmtTime(p.t)}</span>
        <button type="button" className={`btn${p.live ? ' btn-on' : ''}`} onClick={p.onLive} aria-pressed={p.live}>
          {msg.now}
        </button>
      </div>
      <div className="scrubber-track">
        <input
          type="range"
          min={p.min}
          max={p.max}
          step={60_000}
          value={p.t}
          onChange={(e) => p.onScrub(Number(e.currentTarget.value))}
          aria-label={msg.scrubTime}
          aria-valuetext={fmtTime(p.t)}
        />
        <span className="scrubber-now" style={{ left: `${nowPct}%` }} aria-hidden="true" />
      </div>
      <div className="scrubber-labels num" aria-hidden="true">
        <span>{day.format(p.min)}</span>
        <span>{msg.now}</span>
        <span>{day.format(p.max)}</span>
      </div>
    </section>
  );
}
