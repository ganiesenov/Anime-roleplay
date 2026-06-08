import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, ChevronLeft, ChevronRight } from 'lucide-react';

function img(url) {
  if (!url) return '';
  return /^https?:\/\//i.test(url) ? '/api/img?url=' + encodeURIComponent(url) : url;
}

// A rotating spotlight of characters at the top of the home page — big art, name,
// and a Start button. Favours favourites, then any character with artwork.
export default function FeaturedBanner({ chars, onOpen }) {
  const favs = (chars || []).filter((c) => c.isFavorite && (c.avatar || c.background));
  const pool = (favs.length ? favs : (chars || []).filter((c) => c.avatar || c.background)).slice(0, 6);
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  const go = (d) => setI((n) => (n + d + pool.length) % pool.length);

  useEffect(() => {
    if (pool.length <= 1 || paused) return undefined;
    const t = setInterval(() => setI((n) => (n + 1) % pool.length), 6000);
    return () => clearInterval(t);
  }, [pool.length, paused]);

  if (!pool.length) return null;
  const c = pool[Math.min(i, pool.length - 1)];
  const bg = img(c.background || c.avatar);

  return (
    <div
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      className="group relative mx-auto mb-8 h-64 max-w-7xl overflow-hidden rounded-3xl border border-white/10 shadow-2xl sm:h-80"
    >
      <AnimatePresence mode="wait">
        <motion.div
          key={c.id}
          initial={{ opacity: 0, scale: 1.06 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="absolute inset-0"
        >
          {bg
            ? <img src={bg} alt="" className="h-full w-full object-cover" />
            : <div className="h-full w-full bg-em-panel" />}
          <div className="absolute inset-0 bg-gradient-to-r from-em-bg via-em-bg/75 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-t from-em-bg/85 to-transparent" />
        </motion.div>
      </AnimatePresence>

      <div className="relative flex h-full max-w-xl flex-col justify-end gap-2.5 p-6 sm:p-9">
        <div className="text-xs font-semibold uppercase tracking-[0.22em] text-em-accent">Featured</div>
        <h2 className="text-3xl font-black leading-tight text-white drop-shadow sm:text-5xl">{c.name || 'Unnamed'}</h2>
        {c.tags && <div className="line-clamp-1 text-sm text-em-text-dim">{c.tags}</div>}
        <button
          onClick={() => onOpen(c)}
          className="mt-1 flex w-fit items-center gap-2 rounded-xl bg-em-accent px-5 py-2.5 font-semibold text-em-bg shadow-lg shadow-em-accent/30 transition hover:-translate-y-0.5 hover:bg-emerald-300 active:scale-95"
        >
          <Play className="h-4 w-4" fill="currentColor" /> Start chat
        </button>
      </div>

      {pool.length > 1 && (
        <div className="absolute right-3 top-3 flex gap-1.5 opacity-0 transition group-hover:opacity-100">
          <button onClick={() => go(-1)} aria-label="Previous" className="grid h-9 w-9 place-items-center rounded-full border border-white/15 bg-em-bg/60 text-em-text backdrop-blur transition hover:bg-em-bg/90"><ChevronLeft className="h-5 w-5" /></button>
          <button onClick={() => go(1)} aria-label="Next" className="grid h-9 w-9 place-items-center rounded-full border border-white/15 bg-em-bg/60 text-em-text backdrop-blur transition hover:bg-em-bg/90"><ChevronRight className="h-5 w-5" /></button>
        </div>
      )}
      {pool.length > 1 && (
        <div className="absolute bottom-4 right-6 flex gap-1.5">
          {pool.map((p, k) => (
            <button
              key={p.id}
              onClick={() => setI(k)}
              aria-label={'Featured ' + (k + 1)}
              className={'h-1.5 rounded-full transition-all ' + (k === i ? 'w-6 bg-em-accent' : 'w-1.5 bg-white/40 hover:bg-white/70')}
            />
          ))}
        </div>
      )}
    </div>
  );
}
