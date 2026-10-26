import { msg } from '../i18n.ts';

type Props = { animalOn: boolean };

export function Legend({ animalOn }: Props) {
  return (
    <details className="legend panel" open={window.innerWidth > 640}>
      <summary>{msg.legendTitle}</summary>
      <ul>
        <li><span className="dot dot-s" /> {msg.magnitude} &lt; 2.5</li>
        <li><span className="dot dot-m" /> {msg.magnitude} 2.5–4.5</li>
        <li><span className="dot dot-l" /> {msg.magnitude} 4.5+</li>
        <li>
          <span className="storm-ts">🌀</span> {msg.stormCat.ts} · <span className="storm-c12">🌀</span> {msg.stormCat.c12} · <span className="storm-c3">🌀</span> {msg.stormCat.c3}
        </li>
        <li><span className="sym sym-fire">▮</span> {msg.layer.fire}</li>
        <li><span className="sym">🌪</span> {msg.tornadoLegend}</li>
        <li><span className="sym sym-aurora">〰</span> {msg.auroraLegend}</li>
        <li><span className="sym">▲</span> {msg.status.success} · <span className="sym sym-failure">✕</span> {msg.status.failure} · <span className="sym sym-upcoming">◇</span> {msg.status.upcoming}</li>
        <li><span className="sym">◉</span> {msg.station} · <span className="sym sym-sat">•</span> {msg.satellite}</li>
        {animalOn && <li><span className="sym">🐻🐘🐅🐧🐢🦭🐋</span> {msg.animalLegend}</li>}
      </ul>
    </details>
  );
}
