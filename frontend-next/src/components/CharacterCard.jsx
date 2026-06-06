import { useState } from 'react';
import { MessageSquare, Zap, Star, Heart } from 'lucide-react';
import { characterStats } from '../lib/db.js';
import { presenceFor } from '../lib/presence.js';

// Latest non-empty relationship across a character's chats (newest chat wins),
// so the home card can surface the "inner life" affection at a glance.
function latestAffection(char) {
  const chats = char && char.chats ? Object.values(char.chats) : [];
  let best = null;
  let bestTs = -1;
  for (const c of chats) {
    const aff = c && c.relationship && typeof c.relationship.affection === 'number' ? c.relationship.affection : null;
    if (aff == null) continue;
    const ts = parseInt(String(c.id || '').replace(/^chat-/, ''), 10) || 0;
    if (ts >= bestTs) { bestTs = ts; best = aff; }
  }
  return best;
}

// External avatars may be blocked by the browser/ISP; the backend proxy bypasses
// that. Try the direct src first, fall back to the proxy, then to a placeholder.
function proxied(url) {
  return '/api/img?url=' + encodeURIComponent(url);
}

function ChatIcon({ className }) { return <MessageSquare className={className} />; }
function BoltIcon({ className }) { return <Zap className={className} fill="currentColor" />; }
function StarIcon({ className, filled }) { return <Star className={className} fill={filled ? 'currentColor' : 'none'} />; }
function HeartIcon({ className }) { return <Heart className={className} fill="currentColor" />; }

export default function CharacterCard({ char, settings = {}, onOpen, onToggleFav }) {
  const [src, setSrc] = useState(char.avatar || '');
  const [stage, setStage] = useState('direct');
  const stats = characterStats(char);
  const presence = settings.presence ? presenceFor(char.id) : null;
  const affection = settings.relationship ? latestAffection(char) : null;
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
      className="char-card group relative flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] text-left shadow-lg shadow-black/40 backdrop-blur focus:outline-none focus-visible:ring-2 focus-visible:ring-em-accent"
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

        {/* presence pill — clear text status, not just an icon */}
        {presence && (
          <span
            title={`${char.name || 'They'} is ${presence.label}`}
            className={'absolute left-2 top-2 flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-semibold capitalize backdrop-blur ' +
              (presence.state === 'asleep'
                ? 'border-indigo-400/30 bg-black/55 text-indigo-200'
                : 'border-em-accent/30 bg-black/55 text-em-accent')}
          >
            <span className={'h-1.5 w-1.5 rounded-full ' + (presence.state === 'asleep' ? 'bg-indigo-300' : 'bg-em-accent animate-pulse')} />
            {presence.label}
          </span>
        )}

        {/* favorite toggle (not a <button> — this card itself is a button) */}
        <span
          role="button"
          tabIndex={0}
          title={char.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
          onClick={(e) => { e.stopPropagation(); onToggleFav && onToggleFav(char); }}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); onToggleFav && onToggleFav(char); } }}
          className={
            'absolute right-2 top-2 z-10 grid h-8 w-8 place-items-center rounded-full border backdrop-blur transition active:scale-90 ' +
            (char.isFavorite
              ? 'border-amber-300/40 bg-black/55 text-amber-300 hover:text-amber-200'
              : 'border-white/10 bg-black/40 text-white/70 opacity-0 hover:text-amber-300 group-hover:opacity-100')
          }
        >
          <StarIcon className="h-4 w-4" filled={char.isFavorite} />
        </span>

        {/* name + stats + tags */}
        <div className="absolute inset-x-0 bottom-0 p-3">
          <h3 className="truncate text-base font-semibold text-white drop-shadow">{char.name || 'Unnamed'}</h3>
          {(stats.chats > 0 || stats.messages > 0 || affection != null) && (
            <div className="mt-1 flex items-center gap-2.5 text-[11px] font-medium text-white/75">
              {stats.chats > 0 && <span className="flex items-center gap-1"><ChatIcon className="h-3 w-3 text-em-accent" />{stats.chats}</span>}
              {stats.messages > 0 && <span className="flex items-center gap-1"><BoltIcon className="h-3 w-3 text-em-accent" />{stats.messages}</span>}
              {affection != null && (
                <span className="flex items-center gap-1 text-rose-300" title={`Inner life — affection ${affection}`}>
                  <HeartIcon className="h-3 w-3" />{affection}
                </span>
              )}
            </div>
          )}
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
