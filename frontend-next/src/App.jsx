import { useEffect, useMemo, useRef, useState } from 'react';
import { getAllCharacters, characterStats, seedStarterPackIfNeeded, restoreFromServer, saveCharacter } from './lib/db.js';
import CharacterCard from './components/CharacterCard.jsx';
import ChatView from './components/ChatView.jsx';
import CharacterEditor from './components/CharacterEditor.jsx';
import SettingsModal from './components/SettingsModal.jsx';
import TutorialModal, { TUTORIAL_FLAG } from './components/TutorialModal.jsx';
import { loadSettings, saveSettings } from './lib/settings.js';
import { applyDesignSettings } from './lib/design.js';
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
  const [menuOpen, setMenuOpen] = useState(false);
  const [showTutorial, setShowTutorial] = useState(() => {
    try { return !localStorage.getItem(TUTORIAL_FLAG); } catch (e) { return false; }
  });
  function closeTutorial() {
    setShowTutorial(false);
    try { localStorage.setItem(TUTORIAL_FLAG, '1'); } catch (e) { /* ignore */ }
  }
  const fileRef = useRef(null);

  function onSaveSettings(next) { setSettings(next); saveSettings(next); applyDesignSettings(next); setShowSettings(false); }

  // Apply appearance settings (CSS vars) once on load; saves re-apply via onSaveSettings.
  useEffect(() => { applyDesignSettings(settings); }, []);

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
      {editing !== null && <CharacterEditor char={editing} settings={settings} onClose={() => setEditing(null)} onSaved={onEditorSaved} />}
      {showSettings && <SettingsModal settings={settings} onSave={onSaveSettings} onClose={() => setShowSettings(false)} />}
      {showTutorial && <TutorialModal onClose={closeTutorial} />}
    </>
  );

  if (activeChar) {
    return (
      <>
        {overlays}
        <ChatView character={activeChar} settings={settings} onBack={() => setActiveChar(null)} onEdit={(c) => setEditing(c)} onOpenSettings={() => setShowSettings(true)} />
      </>
    );
  }

  return (
    <div className="min-h-full">
      {overlays}
      {/* Navbar */}
      <header className="sticky top-0 z-20 border-b border-white/10 bg-em-bg/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-3">
          <a href="/" className="group flex items-center gap-2.5">
            <img src="/favicon.svg" alt="" className="logo-mark h-9 w-9 drop-shadow-[0_0_12px_rgba(46,230,160,0.5)]" />
            <span className="flex flex-col leading-none">
              <span className="text-xl font-extrabold tracking-tight bg-gradient-to-r from-em-accent to-emerald-200 bg-clip-text text-transparent drop-shadow-[0_0_18px_rgba(46,230,160,0.25)]">Aria</span>
              <span className="mt-0.5 text-[10px] font-medium uppercase tracking-[0.2em] text-em-text-dim/70">Roleplay</span>
            </span>
          </a>
          <nav className="flex items-center gap-2 text-sm">
            <input ref={fileRef} type="file" accept=".json,.png" className="hidden" onChange={onImportFile} />
            <button onClick={() => setEditing({})} className="flex items-center gap-1.5 rounded-lg bg-em-accent px-3.5 py-1.5 font-semibold text-em-bg shadow-lg shadow-em-accent/20 transition hover:bg-emerald-300">
              <PlusIcon className="h-4 w-4" /> Create
            </button>
            {/* Overflow menu — Import / Export / How it works live here to keep the bar clean */}
            <div className="relative">
              <button
                onClick={() => setMenuOpen((v) => !v)}
                aria-label="More"
                className={'grid h-8 w-8 place-items-center rounded-lg border transition ' + (menuOpen ? 'border-em-accent/50 text-em-accent' : 'border-white/10 text-em-text-dim hover:border-em-accent/40 hover:text-em-text')}
              >
                <DotsIcon className="h-5 w-5" />
              </button>
              {menuOpen && (
                <>
                  <div className="fixed inset-0 z-30" onClick={() => setMenuOpen(false)} />
                  <div className="absolute right-0 top-full z-40 mt-1.5 w-56 overflow-hidden rounded-xl border border-white/10 bg-em-panel p-1.5 shadow-2xl">
                    <MenuItem onClick={() => { setMenuOpen(false); setShowSettings(true); }} icon={<GearIcon className="h-4 w-4" />} label="Settings" />
                    <MenuItem onClick={() => { setMenuOpen(false); fileRef.current && fileRef.current.click(); }} icon={<UploadIcon className="h-4 w-4" />} label="Import…" hint="backup / card" />
                    <MenuItem onClick={() => { setMenuOpen(false); exportBackup(); }} icon={<DownloadIcon className="h-4 w-4" />} label="Export backup" />
                    <div className="my-1 border-t border-white/10" />
                    <MenuItem onClick={() => { setMenuOpen(false); setShowTutorial(true); }} icon={<HelpIcon className="h-4 w-4" />} label="How it works" />
                  </div>
                </>
              )}
            </div>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="starfield relative overflow-hidden">
        {/* soft emerald aurora glow behind the headline */}
        <div className="pointer-events-none absolute left-1/2 top-0 h-80 w-[40rem] -translate-x-1/2 rounded-full bg-em-accent/20 blur-[100px] animate-pulse-slow" />
        <div className="relative mx-auto max-w-7xl px-5 py-16 text-center">
          <h1 className="bg-gradient-to-b from-white via-emerald-100 to-em-text-dim bg-clip-text text-5xl font-black tracking-tight text-transparent drop-shadow-[0_2px_30px_rgba(46,230,160,0.15)] sm:text-6xl">
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
              <CharacterCard key={c.id} char={c} settings={settings} onOpen={openCharacter} onToggleFav={toggleFavorite} />
            ))}
          </div>
        </section>
      )}

      {/* Main grid */}
      <main className="mx-auto max-w-7xl px-5 pb-20">
        {chars === null ? (
          <GridSkeleton />
        ) : filtered.length === 0 ? (
          <EmptyState onCreate={() => setEditing({})} />
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {filtered.map((c) => (
              <CharacterCard key={c.id} char={c} settings={settings} onOpen={openCharacter} onToggleFav={toggleFavorite} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

function MenuItem({ onClick, icon, label, hint }) {
  return (
    <button onClick={onClick} className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm text-em-text transition hover:bg-white/5">
      <span className="text-em-text-dim">{icon}</span>
      <span className="flex-1">{label}</span>
      {hint && <span className="text-[11px] text-em-text-dim/70">{hint}</span>}
    </button>
  );
}

/* Crisp inline icons (stroke = currentColor) so they inherit theme colours. */
function PlusIcon({ className }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>;
}
function DotsIcon({ className }) {
  return <svg className={className} viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="1.9" /><circle cx="12" cy="12" r="1.9" /><circle cx="19" cy="12" r="1.9" /></svg>;
}
function GearIcon({ className }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>;
}
function UploadIcon({ className }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" /></svg>;
}
function DownloadIcon({ className }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" /></svg>;
}
function HelpIcon({ className }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3" /><line x1="12" y1="17" x2="12" y2="17" /></svg>;
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

function EmptyState({ onCreate }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-24 text-center text-em-text-dim">
      <span className="text-5xl">🪐</span>
      <p className="text-lg font-medium text-em-text">No characters match</p>
      <p className="max-w-sm text-sm">
        Try clearing the search or category filter — or create your own character to start a new story.
      </p>
      {onCreate && <button onClick={onCreate} className="mt-2 rounded-lg bg-em-accent px-4 py-2 font-semibold text-em-bg transition hover:bg-emerald-300">+ Create a character</button>}
    </div>
  );
}
