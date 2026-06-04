import { useState } from 'react';
import { characterStats } from '../lib/db.js';

// External avatars may be blocked by the browser/ISP; the backend proxy bypasses
// that. Try the direct src first, fall back to the proxy, then to a placeholder.
function proxied(url) {
  return '/api/img?url=' + encodeURIComponent(url);
}

export default function CharacterCard({ char, onOpen }) {
  const [src, setSrc] = useState(char.avatar || '');
  const [stage, setStage] = useState('direct');
  const stats = characterStats(char);
  const tags = String(char.tags || '')
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean)
    .slice(0, 3);

  function handleError() {
    const isHttp = /^https?:\/\//i.test(char.avatar || '');
    if (stage === 'direct' && isHttp) {
      setStage('proxy');
      setSrc(proxied(char.avatar));
    } else {
      setStage('placeholder');
      setSrc('');
    }
  }

  return (
    <button
      onClick={() => onOpen && onOpen(char)}
      className="group relative flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] text-left shadow-lg shadow-black/40 backdrop-blur transition duration-200 hover:-translate-y-1 hover:border-em-accent/50 hover:shadow-em-accent/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-em-accent"
    >
      <div className="relative aspect-[3/4] w-full overflow-hidden bg-em-panel">
        {src ? (
          <img
            src={src}
            alt={char.name}
            loading="lazy"
            onError={handleError}
            className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-5xl text-em-text-dim/40">
            👤
          </div>
        )}
        {/* gradient scrim */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-transparent" />

        {/* stat chips */}
        <div className="absolute left-2 top-2 flex gap-1.5">
          {stats.chats > 0 && (
            <span className="rounded-full bg-black/55 px-2 py-0.5 text-[11px] font-medium text-white/90 backdrop-blur">
              💬 {stats.chats}
            </span>
          )}
          {char.isFavorite && (
            <span className="rounded-full bg-black/55 px-2 py-0.5 text-[11px] text-amber-300 backdrop-blur">
              ★
            </span>
          )}
        </div>

        {/* name + tags */}
        <div className="absolute inset-x-0 bottom-0 p-3">
          <h3 className="truncate text-base font-semibold text-white drop-shadow">{char.name || 'Unnamed'}</h3>
          {tags.length > 0 && (
            <div className="mt-1 flex flex-wrap gap-1">
              {tags.map((t) => (
                <span key={t} className="rounded-full bg-em-accent/15 px-2 py-0.5 text-[10px] font-medium text-em-accent">
                  {t}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </button>
  );
}
