import { useState } from 'react';
import { LAYERS, type LayerKey, type LayerStatus } from '../model.ts';
import { fmtAgo, msg } from '../i18n.ts';

const ICON: Record<LayerKey, string> = { quake: '●', launch: '▲', iss: '◉' };

type Props = {
  live: boolean;
  layers: LayerKey[];
  status: Record<LayerKey, LayerStatus>;
  now: number;
  onToggle: (k: LayerKey) => void;
  onRetry: (k: LayerKey) => void;
  shareUrl: () => string;
};

export function Header(p: Props) {
  const [copied, setCopied] = useState(false);
  const share = async () => {
    try {
      await navigator.clipboard.writeText(p.shareUrl());
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt(msg.share, p.shareUrl());
    }
  };
  return (
    <header className="header panel">
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
                aria-label={msg.layer[k]}
              >
                <span aria-hidden="true">{ICON[k]}</span>
                <span className="toggle-label"> {msg.layer[k]}</span>
                {s.state === 'error' && <>
                    <span className="warn" aria-hidden="true"> ⚠</span>
                    <span className="sr-only">{msg.failed}</span>
                  </>}
              </button>
              {s.state === 'error' && (
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
    </header>
  );
}
