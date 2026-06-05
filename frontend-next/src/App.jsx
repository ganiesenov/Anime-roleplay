import { useEffect, useMemo, useRef, useState } from 'react';
import { getAllCharacters, characterStats, seedStarterPackIfNeeded, restoreFromServer, saveCharacter } from './lib/db.js';
import CharacterCard from './components/CharacterCard.jsx';
import ChatView from './components/ChatView.jsx';
import CharacterEditor from './components/CharacterEditor.jsx';
import SettingsModal from './components/SettingsModal.jsx';
import { loadSettings, saveSettings } from './lib/settings.js';
import { exportBackup, importFile } from './lib/io.js';

const CATEGORIES = [
  { key: null, label: 'All', keywords: [] },
  { key: 'anime', label: 'Anime', keywords: ['anime', 'manga', 'waifu', 'isekai', 'shounen', 'shoujo'] },
  { key: 'hero', label: 'Superheroes', keywords: ['hero', 'marvel', 'dc', 'superhero', 'avenger', 'spider', 'batman'] },
  { key: 'kpop', label: 'K-pop', keywords: ['kpop', 'k-pop', 'idol', 'bts', 'blackpink', 'kdrama'] },
  { key: 'music', label: 'Music', keywords: ['music', 'singer', 'band', 'rock', 'pop', 'rapper'] },
  { key: 'movies', label: 'Movies', keywords: ['movie', 'film', 'cinema', 'hollywood', 'actor'] },
  { key: 'games', label: 'Games', keywords: ['game', 'gaming', 'rpg', 'fps', 'minecraft', 'gamer'] },
];

function matchesCategory(char, cat) {
  if (!cat || !cat.key) return true;
  const hay = ((char.name || '') + ' ' + (char.tags || '')).toLowerCase();
  return cat.keywords.some((k) => hay.includes(k));
}

const SORTS = {
  recent: (a, b) => characterStats(b).lastTs - characterStats(a).lastTs,
  newest: (a, b) => characterStats(b).createdTs - characterStats(a).createdTs,
  name: (a, b) => (a.name || '').localeCompare(b.name || ''),
  messages: (a, b) => characterStats(b).messages - characterStats(a).messages,
};

export default function App() {
  const [chars, setChars] = useState(null); // null = loading
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState(null);
  const [favOnly, setFavOnly] = useState(false);
  const [sort, setSort] = useState('recent');
  const [activeChar, setActiveChar] = useState(null);
  const [editing, setEditing] = useState(null); // null=closed, {} or char=open
  const [settings, setSettings] = useState(loadSettings);
  const [showSettings, setShowSettings] = useState(false);
  const fileRef = useRef(null);

  function onSaveSettings(next) { setSettings(next); saveSettings(next); setShowSettings(false); }

  async function onImportFile(e) {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file) return;
    try { await importFile(file); }
    catch (err) { window.alert('Import failed: ' + (err && err.message ? err.message : err)); }
    refresh();
  }

  function refresh() {
    return getAllCharacters().then((list) => {
      const filtered = list.filter((c) => !c.isArchived);
      setChars(filtered);
      return filtered;
    });
  }

  useEffect(() => {
    // First seed any missing starter characters (merge-by-id, once), then pull
    // the user's own characters + chat histories from the backend disk backups
    // (also merge-only), so nothing the user made is lost — then load.
    seedStarterPackIfNeeded()
      .then(() => restoreFromServer())
      .then(refresh);
  }, []);

  async function toggleFavorite(char) {
    const next = { ...char, isFavorite: !char.isFavorite };
    await saveCharacter(next);
    setChars((prev) => (prev || []).map((c) => (c.id === next.id ? next : c)));
  }

  function onEditorSaved(updated) {
    setEditing(null);
    refresh();
    if (activeChar && activeChar.id === updated.id) setActiveChar(updated);
  }

  const filtered = useMemo(() => {
    if (!chars) return [];
    const q = query.trim().toLowerCase();
    return chars
      .filter((c) => (favOnly ? c.isFavorite : true))
      .filter((c) => matchesCategory(c, CATEGORIES.find((k) => k.key === category)))
      .filter((c) => !q || ((c.name || '') + ' ' + (c.tags || '')).toLowerCase().includes(q))
      .sort(SORTS[sort] || SORTS.recent);
  }, [chars, query, category, favOnly, sort]);

  const favorites = useMemo(() => (chars || []).filter((c) => c.isFavorite), [chars]);

  function openCharacter(char) {
    setActiveChar(char);
  }

  const overlays = (
    <>
      {editing !== null && <CharacterEditor char={editing} onClose={() => setEditing(null)} onSaved={onEditorSaved} />}
      {showSettings && <SettingsModal settings={settings} onSave={onSaveSettings} onClose={() => setShowSettings(false)} />}
    </>
  );

  if (activeChar) {
    return (
      <>
        {overlays}
        <ChatView character={activeChar} settings={settings} onBack={() => setActiveChar(null)} onEdit={(c) => setEditing(c)} />
      </>
    );
  }

  return (
    <div className="min-h-full">
      {overlays}
      {/* Navbar */}
      <header className="sticky top-0 z-20 border-b border-white/10 bg-em-bg/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-3">
          <a href="/" className="flex items-center gap-2 text-xl font-extrabold tracking-tight">
            <span className="bg-gradient-to-r from-em-accent to-emerald-300 bg-clip-text text-transparent">Aria</span>
            <span className="rounded-md bg-em-accent/15 px-1.5 py-0.5 text-[10px] font-bold text-em-accent">NEXT</span>
          </a>
          <nav className="flex items-center gap-2 text-sm">
            <a href="/" className="rounded-lg border border-white/10 px-3 py-1.5 text-em-text-dim transition hover:border-em-accent/40 hover:text-em-text">
              ← Classic UI
            </a>
            <input ref={fileRef} type="file" accept=".json,.png" className="hidden" onChange={onImportFile} />
            <button onClick={() => fileRef.current && fileRef.current.click()} className="rounded-lg border border-white/10 px-3 py-1.5 text-em-text-dim transition hover:border-em-accent/40 hover:text-em-text" title="Import backup (.json) or character card (.png / .json)">
              ⬆ Import
            </button>
            <button onClick={exportBackup} className="rounded-lg border border-white/10 px-3 py-1.5 text-em-text-dim transition hover:border-em-accent/40 hover:text-em-text" title="Export all characters & personas as a .json backup">
              ⬇ Export
            </button>
            <button onClick={() => setShowSettings(true)} className="rounded-lg border border-white/10 px-3 py-1.5 text-em-text-dim transition hover:border-em-accent/40 hover:text-em-text" title="Settings">
              ⚙
            </button>
            <button onClick={() => setEditing({})} className="rounded-lg bg-em-accent px-3 py-1.5 font-semibold text-em-bg transition hover:bg-emerald-300">
              + Create
            </button>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="starfield relative overflow-hidden">
        <div className="mx-auto max-w-7xl px-5 py-16 text-center">
          <h1 className="bg-gradient-to-b from-white to-em-text-dim bg-clip-text text-5xl font-black tracking-tight text-transparent sm:text-6xl">
            Your characters. Your stories.
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-em-text-dim">
            Create, customize and live any world — no limits.
          </p>

          {/* Category pills */}
          <div className="mt-8 flex flex-wrap justify-center gap-2">
            {CATEGORIES.map((cat) => {
              const active = cat.key === category;
              return (
                <button
                  key={cat.label}
                  onClick={() => setCategory(cat.key)}
                  className={
                    'rounded-full px-4 py-1.5 text-sm font-medium transition ' +
                    (active
                      ? 'bg-em-accent text-em-bg shadow-lg shadow-em-accent/20'
                      : 'border border-white/10 text-em-text-dim hover:border-em-accent/40 hover:text-em-text')
                  }
                >
                  {cat.label}
                </button>
              );
            })}
          </div>

          {/* Search */}
          <div className="mx-auto mt-6 max-w-xl">
            <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 backdrop-blur focus-within:border-em-accent/50">
              <span className="text-em-text-dim">🔍</span>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search characters or tags…"
                className="w-full bg-transparent text-em-text placeholder:text-em-text-dim/70 focus:outline-none"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Browse bar */}
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-5 pb-4">
        <div className="flex gap-2">
          <button
            onClick={() => setFavOnly(false)}
            className={'rounded-lg px-3 py-1.5 text-sm font-medium transition ' + (!favOnly ? 'bg-white/10 text-em-text' : 'text-em-text-dim hover:text-em-text')}
          >
            🏠 Home
          </button>
          <button
            onClick={() => setFavOnly(true)}
            className={'rounded-lg px-3 py-1.5 text-sm font-medium transition ' + (favOnly ? 'bg-white/10 text-em-text' : 'text-em-text-dim hover:text-em-text')}
          >
            ★ Favorites
          </button>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            className="rounded-lg border border-white/10 bg-em-panel px-3 py-1.5 text-sm text-em-text focus:border-em-accent/50 focus:outline-none"
          >
            <option value="recent">Recently used</option>
            <option value="newest">Recently added</option>
            <option value="name">Name (A–Z)</option>
            <option value="messages">Most messages</option>
          </select>
          <span className="rounded-lg border border-em-accent/30 px-3 py-1.5 text-sm font-semibold text-em-accent">
            {chars ? filtered.length : '…'} characters
          </span>
        </div>
      </div>

      {/* Favorites shelf */}
      {!favOnly && !query && !category && favorites.length > 0 && (
        <section className="mx-auto max-w-7xl px-5 pb-6">
          <h2 className="mb-3 text-lg font-bold">Favorites ({favorites.length})</h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {favorites.slice(0, 12).map((c) => (
              <CharacterCard key={c.id} char={c} onOpen={openCharacter} onToggleFav={toggleFavorite} />
            ))}
          </div>
        </section>
      )}

      {/* Main grid */}
      <main className="mx-auto max-w-7xl px-5 pb-20">
        {chars === null ? (
          <GridSkeleton />
        ) : filtered.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {filtered.map((c) => (
              <CharacterCard key={c.id} char={c} onOpen={openCharacter} onToggleFav={toggleFavorite} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

function GridSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
      {Array.from({ length: 12 }).map((_, i) => (
        <div key={i} className="aspect-[3/4] animate-pulse rounded-2xl border border-white/10 bg-white/[0.04]" />
      ))}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-24 text-center text-em-text-dim">
      <span className="text-5xl">🪐</span>
      <p className="text-lg font-medium text-em-text">No characters here yet</p>
      <p className="max-w-sm text-sm">
        If your library lives in the Classic UI, open it once on this origin so the new app can read the same local database.
      </p>
      <a href="/" className="mt-2 rounded-lg bg-em-accent px-4 py-2 font-semibold text-em-bg">Open Classic UI</a>
    </div>
  );
}
