import { useEffect, useMemo, useRef, useState } from 'react';
import Avatar from './Avatar.jsx';
import { SearchIcon } from './icons.jsx';

// ⌘K / Ctrl+K quick switcher — fuzzy-find and open any character. Keyboard-driven.
export default function CommandPalette({ chars, onOpen, onClose }) {
  const [q, setQ] = useState('');
  const [idx, setIdx] = useState(0);
  const listRef = useRef(null);

  const results = useMemo(() => {
    const s = q.trim().toLowerCase();
    const list = (chars || []).filter((c) => !c.isArchived);
    const scored = s
      ? list.filter((c) => ((c.name || '') + ' ' + (c.tags || '')).toLowerCase().includes(s))
      : list;
    return scored.slice(0, 50);
  }, [chars, q]);

  useEffect(() => { setIdx(0); }, [q]);
  // Keep the highlighted row in view.
  useEffect(() => {
    const el = listRef.current && listRef.current.querySelector('[data-active="true"]');
    if (el) el.scrollIntoView({ block: 'nearest' });
  }, [idx]);

  function choose(c) { if (c) { onOpen(c); onClose(); } }

  function onKey(e) {
    if (e.key === 'ArrowDown') { e.preventDefault(); setIdx((i) => Math.min(i + 1, results.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setIdx((i) => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); choose(results[idx]); }
    else if (e.key === 'Escape') { e.preventDefault(); onClose(); }
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center bg-black/70 p-4 pt-[12vh] backdrop-blur-sm" onClick={onClose}>
      <div className="flex max-h-[70vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl glass-panel shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 border-b border-white/10 px-4 py-3">
          <SearchIcon className="h-4 w-4 shrink-0 text-em-text-dim" />
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={onKey}
            placeholder="Jump to a character…"
            className="w-full bg-transparent text-em-text placeholder:text-em-text-dim/60 focus:outline-none"
          />
          <kbd className="rounded border border-white/15 px-1.5 py-0.5 text-[10px] text-em-text-dim">Esc</kbd>
        </div>
        <div ref={listRef} className="min-h-0 flex-1 overflow-y-auto p-1.5">
          {results.length === 0 && <p className="px-3 py-6 text-center text-sm text-em-text-dim">No characters found.</p>}
          {results.map((c, i) => (
            <button
              key={c.id}
              data-active={i === idx}
              onMouseEnter={() => setIdx(i)}
              onClick={() => choose(c)}
              className={'flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition ' + (i === idx ? 'bg-em-accent/15' : 'hover:bg-white/5')}
            >
              <Avatar src={c.avatar} name={c.name} size={32} className="shrink-0" />
              <div className="min-w-0 flex-1">
                <div className={'truncate text-sm ' + (i === idx ? 'font-semibold text-em-accent' : 'text-em-text')}>{c.name || 'Unnamed'}</div>
                {c.tags && <div className="truncate text-[11px] text-em-text-dim">{c.tags}</div>}
              </div>
              {i === idx && <kbd className="rounded border border-white/15 px-1.5 py-0.5 text-[10px] text-em-text-dim">↵</kbd>}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
