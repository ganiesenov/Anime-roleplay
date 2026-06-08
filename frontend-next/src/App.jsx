import { useEffect, useMemo, useRef, useState } from 'react';
import { getAllCharacters, characterStats, seedStarterPackIfNeeded, restoreFromServer, saveCharacter } from './lib/db.js';
import CharacterCard from './components/CharacterCard.jsx';
import ChatView from './components/ChatView.jsx';
import CharacterEditor from './components/CharacterEditor.jsx';
import CharacterWizard from './components/CharacterWizard.jsx';
import SettingsModal from './components/SettingsModal.jsx';
import TutorialModal, { TUTORIAL_FLAG } from './components/TutorialModal.jsx';
import CommandPalette from './components/CommandPalette.jsx';
import { loadSettings, saveSettings } from './lib/settings.js';
import { applyDesignSettings } from './lib/design.js';
import { exportBackup, importFile, importCode } from './lib/io.js';
import { PlusIcon, DotsIcon, GearIcon, UploadIcon, DownloadIcon, HelpIcon, SearchIcon, HomeIcon, StarIcon } from './components/icons.jsx';
import { ArrowUp, Shuffle } from 'lucide-react';
import FeaturedBanner from './components/FeaturedBanner.jsx';
import Scenes from './components/Scenes.jsx';
import Avatar from './components/Avatar.jsx';
import { buildSceneChat } from './lib/scenes.js';

// "2h ago" style relative time for the Continue shelf.
function relTime(ts) {
  if (!ts) return '';
  const s = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60); if (m < 60) return m + 'm ago';
  const h = Math.floor(m / 60); if (h < 24) return h + 'h ago';
  const d = Math.floor(h / 24); if (d < 7) return d + 'd ago';
  return Math.floor(d / 7) + 'w ago';
}

// A consistent, presentable section header (accent spine + title + count badge),
// matching the redesigned folder headers. Optional "see all ›" action.
function SectionHeader({ title, count, onSeeAll }) {
  return (
    <div className="mb-3 flex items-center gap-2.5">
      <span className="h-5 w-1 rounded-full bg-em-accent" />
      <h2 className="text-lg font-bold">{title}</h2>
      {count != null && <span className="grid h-5 min-w-5 place-items-center rounded-full bg-white/10 px-1.5 text-[11px] font-semibold text-em-text-dim">{count}</span>}
      {onSeeAll && <button onClick={onSeeAll} className="ml-auto text-xs font-medium text-em-text-dim transition hover:text-em-accent">see all ›</button>}
    </div>
  );
}

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

// "Recently used" ranks by last activity, but a freshly-created character has no
// chats yet — fall back to its creation time so new cards surface at the top.
const recentKey = (c) => { const s = characterStats(c); return Math.max(s.lastTs, s.createdTs); };
const SORTS = {
  recent: (a, b) => recentKey(b) - recentKey(a),
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
  const [showWizard, setShowWizard] = useState(false); // guided character builder
  const [settings, setSettings] = useState(loadSettings);
  const [showSettings, setShowSettings] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [showTop, setShowTop] = useState(false);
  const [showPalette, setShowPalette] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showTutorial, setShowTutorial] = useState(() => {
    try { return !localStorage.getItem(TUTORIAL_FLAG); } catch (e) { return false; }
  });
  function closeTutorial() {
    setShowTutorial(false);
    try { localStorage.setItem(TUTORIAL_FLAG, '1'); } catch (e) { /* ignore */ }
  }
  const fileRef = useRef(null);

  function onSaveSettings(next) { setSettings(next); saveSettings(next); applyDesignSettings(next); setShowSettings(false); }
  function onChangeModel(modelId) { const next = { ...settings, model: modelId }; setSettings(next); saveSettings(next); }
  function onChangeSetting(key, value) { const next = { ...settings, [key]: value }; setSettings(next); saveSettings(next); }

  // Apply appearance settings (CSS vars) once on load; saves re-apply via onSaveSettings.
  useEffect(() => { applyDesignSettings(settings); }, []);

  // Show a "back to top" button once the user has scrolled down the library.
  useEffect(() => {
    const onScroll = () => setShowTop(window.scrollY > 700);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Global shortcuts: ⌘K/Ctrl+K command palette; "?" opens the shortcuts help
  // (only when not typing in a field).
  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        setShowPalette((v) => !v);
        return;
      }
      const el = e.target;
      const typing = el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);
      if (e.key === '?' && !typing && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        setShowShortcuts((v) => !v);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

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
  const newest = useMemo(() => (chars || []).slice().sort((a, b) => characterStats(b).createdTs - characterStats(a).createdTs).slice(0, 12), [chars]);
  const popularTags = useMemo(() => {
    const count = {};
    (chars || []).forEach((c) => String(c.tags || '').split(',').map((t) => t.trim().toLowerCase()).filter(Boolean)
      .forEach((t) => { count[t] = (count[t] || 0) + 1; }));
    return Object.entries(count).sort((a, b) => b[1] - a[1]).slice(0, 12).map(([t]) => t);
  }, [chars]);
  // Characters with actual chat history, most-recently-used first — for "Continue".
  const recents = useMemo(() => (chars || [])
    .map((c) => ({ c, s: characterStats(c) }))
    .filter((x) => x.s.lastTs > 0)
    .sort((a, b) => b.s.lastTs - a.s.lastTs)
    .slice(0, 8)
    .map((x) => x.c), [chars]);

  function openCharacter(char) {
    setActiveChar(char);
  }

  function surprise() {
    const pool = chars || [];
    if (pool.length) openCharacter(pool[Math.floor(Math.random() * pool.length)]);
  }

  // Launch a scene: create a fresh chat for the chosen character seeded with the
  // scene's opening, then open it (ChatView auto-selects the newest chat).
  async function playScene(scene, char) {
    const chat = buildSceneChat(char, scene);
    char.chats = char.chats || {};
    char.chats[chat.id] = chat;
    await saveCharacter(char);
    setActiveChar({ ...char });
  }

  const overlays = (
    <>
      {editing !== null && <CharacterEditor char={editing} settings={settings} onClose={() => setEditing(null)} onSaved={onEditorSaved} />}
      {showWizard && <CharacterWizard settings={settings} onClose={() => setShowWizard(false)} onCreated={(rec) => { setShowWizard(false); refresh(); setEditing(rec); }} />}
      {showSettings && <SettingsModal settings={settings} onSave={onSaveSettings} onClose={() => setShowSettings(false)} />}
      {showTutorial && <TutorialModal onClose={closeTutorial} />}
      {showPalette && <CommandPalette chars={chars || []} onOpen={openCharacter} onClose={() => setShowPalette(false)} />}
      {showShortcuts && <ShortcutsModal onClose={() => setShowShortcuts(false)} />}
    </>
  );

  if (activeChar) {
    return (
      <>
        {overlays}
        <ChatView character={activeChar} settings={settings} onBack={() => setActiveChar(null)} onEdit={(c) => setEditing(c)} onOpenSettings={() => setShowSettings(true)} onChangeModel={onChangeModel} onChangeSetting={onChangeSetting} />
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
            {/* Compact search appears in the bar once the hero search scrolls away */}
            {showTop && (
              <div className="hidden items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 focus-within:border-em-accent/50 sm:flex">
                <SearchIcon className="h-4 w-4 text-em-text-dim" />
                <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search…" className="w-36 bg-transparent text-em-text placeholder:text-em-text-dim/70 focus:outline-none" />
                <button onClick={() => setShowPalette(true)} title="Quick switch (⌘K)" className="text-[10px] text-em-text-dim">⌘K</button>
              </div>
            )}
            <button onClick={() => setShowWizard(true)} title="Guided character wizard" className="hidden items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 font-medium text-em-text-dim transition hover:border-em-accent/40 hover:text-em-accent sm:flex">✨ Wizard</button>
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
                    <MenuItem onClick={async () => { setMenuOpen(false); const code = window.prompt('Paste a character share code (ARIA1:…):'); if (code && code.trim()) { const r = await importCode(code.trim()); if (r) refresh(); } }} icon={<UploadIcon className="h-4 w-4" />} label="Import from code" hint="ARIA1:…" />
                    <MenuItem onClick={() => { setMenuOpen(false); exportBackup(); }} icon={<DownloadIcon className="h-4 w-4" />} label="Export backup" />
                    <div className="my-1 border-t border-white/10" />
                    <MenuItem onClick={() => { setMenuOpen(false); setShowShortcuts(true); }} icon={<HelpIcon className="h-4 w-4" />} label="Keyboard shortcuts" hint="?" />
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
        <div className="relative mx-auto max-w-7xl px-5 py-8">
          {!favOnly && !query && !category && chars && chars.length > 0 ? (
            <FeaturedBanner chars={chars} onOpen={openCharacter} />
          ) : (
            <h1 className="bg-gradient-to-b from-white via-emerald-100 to-em-text-dim bg-clip-text text-center text-4xl font-black tracking-tight text-transparent drop-shadow-[0_2px_30px_rgba(46,230,160,0.15)] sm:text-5xl">
              Your characters. Your stories.
            </h1>
          )}

          {/* Category pills */}
          <div className="mt-6 flex flex-wrap justify-center gap-2">
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
              <SearchIcon className="h-4 w-4 shrink-0 text-em-text-dim" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search characters or tags…"
                className="w-full bg-transparent text-em-text placeholder:text-em-text-dim/70 focus:outline-none"
              />
            </div>
            {popularTags.length > 0 && (
              <div className="mt-3 flex flex-wrap justify-center gap-1.5">
                {popularTags.map((t) => {
                  const active = query.trim().toLowerCase() === t;
                  return (
                    <button
                      key={t}
                      onClick={() => setQuery(active ? '' : t)}
                      className={'rounded-full px-3 py-1 text-xs font-medium transition ' + (active ? 'bg-em-accent text-em-bg' : 'border border-white/10 text-em-text-dim hover:border-em-accent/40 hover:text-em-text')}
                    >
                      #{t}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Primary call-to-action + library stats */}
          <div className="mt-7 flex flex-col items-center gap-3">
            <button
              onClick={() => setEditing({})}
              className="group inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-em-accent to-emerald-300 px-6 py-2.5 font-semibold text-em-bg shadow-lg shadow-em-accent/25 transition hover:-translate-y-0.5 hover:shadow-em-accent/40 active:scale-95"
            >
              <PlusIcon className="h-4 w-4" /> Create your own character
            </button>
            <button onClick={() => setShowWizard(true)} className="text-sm text-em-text-dim transition hover:text-em-accent">✨ or build one with the guided wizard</button>
            {chars && chars.length > 0 && (
              <div className="flex items-center gap-2 text-xs text-em-text-dim">
                <span><b className="text-em-text">{chars.length}</b> characters</span>
                <span className="text-em-text-dim/40">·</span>
                <span><b className="text-em-text">{favorites.length}</b> favorites</span>
                <span className="text-em-text-dim/40">·</span>
                <span><b className="text-em-text">{recents.length}</b> active chats</span>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Browse bar */}
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-5 pb-4">
        <div className="flex gap-2">
          <button
            onClick={() => setFavOnly(false)}
            className={'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition ' + (!favOnly ? 'bg-white/10 text-em-text' : 'text-em-text-dim hover:text-em-text')}
          >
            <HomeIcon className="h-4 w-4" /> Home
          </button>
          <button
            onClick={() => setFavOnly(true)}
            className={'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition ' + (favOnly ? 'bg-white/10 text-em-text' : 'text-em-text-dim hover:text-em-text')}
          >
            <StarIcon className="h-4 w-4" filled={favOnly} /> Favorites
          </button>
          <button
            onClick={surprise}
            title="Open a random character"
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-em-text-dim transition hover:text-em-text"
          >
            <Shuffle className="h-4 w-4" /> Surprise me
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

      {/* Continue — jump back into recent conversations */}
      {!favOnly && !query && !category && recents.length > 0 && (
        <section className="mx-auto max-w-7xl px-5 pb-6">
          <SectionHeader title="Continue" count={recents.length} />
          <div className="flex gap-3 overflow-x-auto pb-2">
            {recents.map((c) => (
              <button
                key={c.id}
                onClick={() => openCharacter(c)}
                className="group flex w-64 shrink-0 items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-2.5 text-left transition hover:-translate-y-0.5 hover:border-em-accent/40 hover:bg-white/[0.06]"
              >
                <Avatar src={c.avatar} name={c.name} size={48} rounded="rounded-xl" className="shrink-0" />
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-em-text">{c.name || 'Unnamed'}</div>
                  <div className="truncate text-[11px] text-em-text-dim">{relTime(characterStats(c).lastTs)} · {characterStats(c).messages} messages</div>
                </div>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Scenes shelf (reusable roleplay situations) */}
      {!favOnly && !query && !category && chars && chars.length > 0 && (
        <Scenes chars={chars} settings={settings} onPlay={playScene} />
      )}

      {/* Favorites shelf */}
      {!favOnly && !query && !category && favorites.length > 0 && (
        <section className="mx-auto max-w-7xl px-5 pb-6">
          <SectionHeader title="Favorites" count={favorites.length} onSeeAll={() => setFavOnly(true)} />
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {favorites.slice(0, 12).map((c) => (
              <CharacterCard key={c.id} char={c} settings={settings} onOpen={openCharacter} onToggleFav={toggleFavorite} onTag={setQuery} />
            ))}
          </div>
        </section>
      )}

      {/* Recently added shelf */}
      {!favOnly && !query && !category && newest.length > 0 && (
        <section className="mx-auto max-w-7xl px-5 pb-6">
          <SectionHeader title="Recently added" />
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {newest.map((c) => (
              <CharacterCard key={c.id} char={c} settings={settings} onOpen={openCharacter} onToggleFav={toggleFavorite} onTag={setQuery} />
            ))}
          </div>
        </section>
      )}

      {/* Genre rows */}
      {!favOnly && !query && !category && chars && CATEGORIES.filter((cat) => cat.key).map((cat) => {
        const list = chars.filter((c) => matchesCategory(c, cat)).slice(0, 12);
        if (list.length < 4) return null;
        return (
          <section key={cat.key} className="mx-auto max-w-7xl px-5 pb-6">
            <SectionHeader title={cat.label} count={list.length} onSeeAll={() => setCategory(cat.key)} />
            <div className="flex gap-4 overflow-x-auto pb-2">
              {list.map((c) => (
                <div key={c.id} className="w-40 shrink-0">
                  <CharacterCard char={c} settings={settings} onOpen={openCharacter} onToggleFav={toggleFavorite} onTag={setQuery} />
                </div>
              ))}
            </div>
          </section>
        );
      })}

      {/* Main grid */}
      <main className="mx-auto max-w-7xl px-5 pb-20">
        {chars === null ? (
          <GridSkeleton />
        ) : filtered.length === 0 ? (
          <EmptyState onCreate={() => setEditing({})} />
        ) : (
          <>
            {!favOnly && !query && !category && <SectionHeader title="All characters" count={filtered.length} />}
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
              {filtered.map((c) => (
                <CharacterCard key={c.id} char={c} settings={settings} onOpen={openCharacter} onToggleFav={toggleFavorite} onTag={setQuery} />
              ))}
            </div>
          </>
        )}
      </main>

      {/* Back to top */}
      {showTop && (
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          title="Back to top"
          className="fixed bottom-6 right-6 z-30 grid h-11 w-11 place-items-center rounded-full border border-em-accent/40 bg-em-panel/90 text-em-accent shadow-2xl backdrop-blur transition hover:-translate-y-0.5 hover:bg-em-panel active:scale-90"
        >
          <ArrowUp className="h-5 w-5" />
        </button>
      )}
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


function ShortcutsModal({ onClose }) {
  const rows = [
    ['⌘ / Ctrl + K', 'Open the command palette (jump to a character)'],
    ['?', 'Show this shortcuts help'],
    ['Enter', 'Send message'],
    ['Shift + Enter', 'New line in the message'],
    ['/', 'Slash commands (/me, /roll, /photo, …)'],
    ['Esc', 'Close a dialog or popover'],
    ['↑ / ↓ then ↵', 'Navigate & open in the command palette'],
  ];
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-md rounded-3xl glass-panel p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold">⌨️ Keyboard shortcuts</h2>
          <button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-lg text-em-text-dim transition hover:bg-white/5 hover:text-em-text">✕</button>
        </div>
        <div className="divide-y divide-white/5">
          {rows.map(([k, d]) => (
            <div key={k} className="flex items-center justify-between gap-4 py-2.5">
              <span className="text-sm text-em-text-dim">{d}</span>
              <kbd className="shrink-0 rounded-lg border border-white/15 bg-white/5 px-2 py-1 text-xs font-medium text-em-text">{k}</kbd>
            </div>
          ))}
        </div>
      </div>
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
