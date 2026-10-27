import { useEffect, useRef, useState } from 'react';
import { LAYERS, type AnimalGroup, type LayerKey, type LayerStatus } from '../model.ts';
import { ANIMAL_GROUPS, ANIMAL_ICON } from '../lib/animals.ts';
import { fmtAgo, msg } from '../i18n.ts';
import { track } from '../lib/analytics.ts';

const ICON: Record<LayerKey, string> = { quake: '●', storm: '🌀', tornado: '🌪', fire: '🔥', launch: '▲', sat: '🛰', aurora: '🌌', animal: '🐾' };

type Props = {
  live: boolean;
  layers: LayerKey[];
  status: Record<LayerKey, LayerStatus>;
  now: number;
  onToggle: (k: LayerKey) => void;
  onRetry: (k: LayerKey) => void;
  animalGroups: AnimalGroup[];
  onToggleAnimal: (g: AnimalGroup) => void;
  shareUrl: () => string;
};

export function Header(p: Props) {
  const [copied, setCopied] = useState(false);
  const ref = useRef<HTMLElement>(null);
  // 헤더가 접혀 높이가 바뀌면 #about이 그 아래로 따라간다
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => document.documentElement.style.setProperty('--header-h', `${el.offsetHeight}px`));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const share = async () => {
    try {
      await navigator.clipboard.writeText(p.shareUrl());
      track('share', { method: 'copy_link' });
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt(msg.share, p.shareUrl());
    }
  };
  return (
    <header ref={ref} className="header panel">
      <div className="brand">
        <h1>{msg.title}</h1>
        {p.live && (
          <span className="live">
            <span className="live-dot" aria-hidden="true" />
            {msg.live}
          </span>
        )}
      </div>
      <div className="toggles">
        {LAYERS.map((k) => {
          const s = p.status[k];
          return (
            <span key={k} className="toggle">
              <button
                type="button"
                className={`btn${p.layers.includes(k) ? ' btn-on' : ''}`}
                aria-pressed={p.layers.includes(k)}
                onClick={() => p.onToggle(k)}
                title={msg.layer[k]}
                aria-label={s.state === 'error' ? `${msg.layer[k]} — ${msg.failed}` : msg.layer[k]}
              >
                <span aria-hidden="true">{ICON[k]}</span>
                <span className="toggle-label"> {msg.layer[k]}</span>
                {s.state === 'error' && <span className="warn" aria-hidden="true"> ⚠</span>}
              </button>
              {(s.state === 'error' || (s.state === 'ok' && s.stale)) && (
                <button type="button" className="btn btn-small" onClick={() => p.onRetry(k)}>
                  {msg.retry}
                </button>
              )}
              {s.state === 'ok' && s.stale && s.fetchedAt !== undefined && (
                <span className="stale num">{msg.dataAgo(fmtAgo(s.fetchedAt, p.now))}</span>
              )}
            </span>
          );
        })}
        <button type="button" className="btn" onClick={share}>
          {copied ? msg.copied : msg.share}
        </button>
      </div>
      {p.layers.includes('animal') && (
        <div className="subtoggles">
          {ANIMAL_GROUPS.map((g) => (
            <button
              key={g}
              type="button"
              className={`btn${p.animalGroups.includes(g) ? ' btn-on' : ''}`}
              aria-pressed={p.animalGroups.includes(g)}
              onClick={() => p.onToggleAnimal(g)}
              title={msg.animalGroup[g]}
              aria-label={msg.animalGroup[g]}
            >
              <span aria-hidden="true">{ANIMAL_ICON[g]}</span>
              <span className="toggle-label"> {msg.animalGroup[g]}</span>
            </button>
          ))}
        </div>
      )}
    </header>
  );
}
