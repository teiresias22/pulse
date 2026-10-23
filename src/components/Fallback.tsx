import type { PulseEvent } from '../model.ts';
import { fmtTime, msg } from '../i18n.ts';

export function Fallback({ quakes, launches }: { quakes: PulseEvent[]; launches: PulseEvent[] }) {
  const recent = [...quakes].sort((a, b) => b.time - a.time).slice(0, 20);
  const upcoming = launches.filter((l) => l.status === 'upcoming').sort((a, b) => a.time - b.time);
  return (
    <main className="fallback">
      <h1>{msg.title}</h1>
      <p>{msg.noWebgl}</p>
      <h2>{msg.recentQuakes}</h2>
      <ul>
        {recent.map((q) => (
          <li key={q.id} className="num">
            M {q.magnitude?.toFixed(1)} · {q.label} · {fmtTime(q.time)}
          </li>
        ))}
      </ul>
      <h2>{msg.upcomingLaunches}</h2>
      <ul>
        {upcoming.map((l) => (
          <li key={l.id} className="num">
            {l.label} · {fmtTime(l.time)}
          </li>
        ))}
      </ul>
    </main>
  );
}
