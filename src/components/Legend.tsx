import { msg } from '../i18n.ts';
import { ANIMAL_ICON } from '../lib/animals.ts';
import type { AnimalGroup } from '../model.ts';

type Props = { animalGroups: AnimalGroup[] }; // 범례에 보일 동물(레이어가 꺼져 있으면 빈 배열)

export function Legend({ animalGroups }: Props) {
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
        {animalGroups.length > 0 && <li><span className="sym">{animalGroups.map((g) => ANIMAL_ICON[g]).join('')}</span> {msg.animalLegend}</li>}
      </ul>
    </details>
  );
}
