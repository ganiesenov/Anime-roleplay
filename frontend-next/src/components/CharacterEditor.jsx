import { useState, useEffect } from 'react';
import { saveCharacter } from '../lib/db.js';
import { syncCharacterToServer, fileToDataUrl, fetchAsDataUrl } from '../lib/api.js';
import { buildWallpaperUrl, buildPhotoUrl } from '../lib/chat.js';
import { TRAIT_DEFS, ARCHETYPES } from '../lib/personality.js';
import { DEFAULT_SETTINGS, resolveModel } from '../lib/settings.js';
import { generateCharacter, generateScenario, generateAppearance, formatGenError } from '../lib/aigen.js';
import { searchShikimori, getShikimoriCharacter, cleanShikiDescription } from '../lib/shikimori.js';
import { ttsSupported, getVoices, onVoicesChanged, groupVoices } from '../lib/tts.js';
import { loadThemes } from '../lib/themes.js';
import { User, MessageSquare, BookOpen, Clapperboard, SlidersHorizontal, Download, HeartHandshake } from 'lucide-react';

const EDITOR_TABS = [
  { key: 'basics', Icon: User, label: 'Basics' },
  { key: 'personality', Icon: HeartHandshake, label: 'Personality' },
  { key: 'greetings', Icon: MessageSquare, label: 'Greetings' },
  { key: 'lore', Icon: BookOpen, label: 'Lore' },
  { key: 'media', Icon: Clapperboard, label: 'Media & Voice' },
  { key: 'advanced', Icon: SlidersHorizontal, label: 'Advanced' },
];

function avatarSrc(url) {
  if (!url) return '';
  if (/^https?:\/\//i.test(url)) return '/api/img?url=' + encodeURIComponent(url);
  return url;
}

function Field({ label, hint, children }) {
  return (
    <label className="block">
      <span className="mb-1 flex items-center gap-2 text-sm font-medium text-em-text">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-em-text-dim">{hint}</span>}
    </label>
  );
}

const inputCls =
  'w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-em-text placeholder:text-em-text-dim/60 focus:border-em-accent/50 focus:outline-none';

// Normalize a character's scenarios into an editable [{name, text}] list.
function initialScenarios(char) {
  if (char?.scenarios && char.scenarios.length) {
    return char.scenarios.map((s, i) => ({ name: s.name || ('Scenario ' + (i + 1)), text: s.text || '' }));
  }
  const text = char?.first_mes || '';
  return [{ name: 'Greeting', text }];
}

export default function CharacterEditor({ char, onClose, onSaved, settings = DEFAULT_SETTINGS }) {
  const editing = !!(char && char.id);
  const [name, setName] = useState(char?.name || '');
  const [avatar, setAvatar] = useState(char?.avatar || '');
  const [background, setBackground] = useState(char?.background || '');
  const [bgPrompt, setBgPrompt] = useState('');
  const [danceUrl, setDanceUrl] = useState(char?.danceUrl || '');
  const [voiceURI, setVoiceURI] = useState(char?.voiceURI || '');
  const [voices, setVoices] = useState([]);
  const [appearance, setAppearance] = useState(char?.appearance || '');
  const [tags, setTags] = useState(char?.tags || '');
  const [description, setDescription] = useState(char?.description || '');
  const [scenarios, setScenarios] = useState(() => initialScenarios(char));
  const [lore, setLore] = useState(char?.lore || '');
  const [instructions, setInstructions] = useState(char?.instructions || '');
  const [reminder, setReminder] = useState(char?.reminder || '');
  const [narratorReminder, setNarratorReminder] = useState(char?.narratorReminder || '');
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState('basics');
  const savedThemes = loadThemes();
  const [themeName, setThemeName] = useState(char?.themeName || '');
  const [archetype, setArchetype] = useState(char?.archetype || '');
  const [traits, setTraits] = useState(char?.traits || {});
  const setTrait = (k, v) => setTraits((prev) => ({ ...prev, [k]: v }));

  // AI generation
  const [concept, setConcept] = useState('');
  const [aiBusy, setAiBusy] = useState('');   // '' | 'char' | 'scenario'
  const [aiError, setAiError] = useState('');

  // Shikimori import
  const [showShiki, setShowShiki] = useState(false);
  const [shikiQ, setShikiQ] = useState('');
  const [shikiResults, setShikiResults] = useState([]);
  const [shikiBusy, setShikiBusy] = useState(false);

  async function doShikiSearch() {
    if (!shikiQ.trim() || shikiBusy) return;
    setShikiBusy(true); setAiError('');
    try { setShikiResults(await searchShikimori(shikiQ.trim())); }
    catch (err) { setAiError('Shikimori search failed.'); }
    finally { setShikiBusy(false); }
  }
  async function importShiki(item) {
    setShikiBusy(true); setAiError('');
    try {
      const c = await getShikimoriCharacter(item.id);
      setName(c.name || item.name || name);
      if (c.tags) setTags(c.tags);
      if (c.description) setDescription(cleanShikiDescription(c.description));
      if (c.image) {
        try { setAvatar(await fetchAsDataUrl('/api/img?url=' + encodeURIComponent(c.image))); }
        catch (e) { setAvatar(c.image); }
      }
      setShowShiki(false);
    } catch (err) { setAiError('Shikimori import failed.'); }
    finally { setShikiBusy(false); }
  }

  useEffect(() => {
    if (!ttsSupported()) return undefined;
    setVoices(getVoices());
    return onVoicesChanged(setVoices);
  }, []);

  async function pickAvatar(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    try { setAvatar(await fileToDataUrl(file)); } catch (err) { /* ignore */ }
  }
  async function pickBackground(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    try { setBackground(await fileToDataUrl(file)); } catch (err) { /* ignore */ }
  }

  // ── Scenario list helpers ──
  const setScenario = (i, k, v) => setScenarios((prev) => prev.map((s, j) => (j === i ? { ...s, [k]: v } : s)));
  const addScenario = () => setScenarios((prev) => [...prev, { name: 'Scenario ' + (prev.length + 1), text: '' }]);
  const removeScenario = (i) => setScenarios((prev) => (prev.length <= 1 ? prev : prev.filter((_, j) => j !== i)));

  // ── AI generation ──
  async function aiGenerateCharacter() {
    if (aiBusy) return;
    setAiBusy('char'); setAiError('');
    try {
      const out = await generateCharacter(concept, resolveModel(settings, settings.model));
      if (out.name) setName(out.name);
      if (out.description) setDescription(out.description);
      if (out.tags) setTags(out.tags);
      if (out.instructions) setInstructions(out.instructions);
    } catch (err) {
      setAiError(formatGenError(err));
    } finally { setAiBusy(''); }
  }
  async function aiGenerateWallpaper() {
    if (aiBusy) return;
    setAiBusy('wallpaper'); setAiError('');
    try {
      const desc = (bgPrompt && bgPrompt.trim())
        || [name, tags].filter(Boolean).join(', ') + ', atmospheric environment';
      const url = buildWallpaperUrl(desc, settings);
      const dataUrl = await fetchAsDataUrl(url);   // bake into a stable base64 so it persists
      setBackground(dataUrl);
    } catch (err) {
      setAiError(formatGenError(err));
    } finally { setAiBusy(''); }
  }
  async function aiGenerateAppearance() {
    if (aiBusy) return;
    setAiBusy('appearance'); setAiError('');
    try {
      const appr = await generateAppearance({ name, description, tags }, resolveModel(settings, settings.model));
      if (appr) setAppearance(appr);
    } catch (err) {
      setAiError(formatGenError(err));
    } finally { setAiBusy(''); }
  }
  async function aiGenerateAvatar() {
    if (aiBusy) return;
    setAiBusy('avatar'); setAiError('');
    try {
      const charLike = { name, appearance, tags };
      const url = buildPhotoUrl(charLike, 'portrait, upper body, looking at viewer, solo, simple background, detailed face', settings);
      const dataUrl = await fetchAsDataUrl(url);
      setAvatar(dataUrl);
    } catch (err) {
      setAiError(formatGenError(err));
    } finally { setAiBusy(''); }
  }
  async function aiGenerateScenario(i) {
    if (aiBusy) return;
    setAiBusy('scenario'); setAiError('');
    try {
      const text = await generateScenario({ name, description, lore }, resolveModel(settings, settings.model));
      if (text) setScenario(i, 'text', text);
    } catch (err) {
      setAiError(formatGenError(err));
    } finally { setAiBusy(''); }
  }

  function buildRecord(forceNewId) {
    const base = (editing && !forceNewId) ? { ...char } : {
      id: 'char-' + Date.now() + (forceNewId ? '-copy' : ''),
      chats: {}, isFavorite: false, isArchived: false, particleEffect: 'none', particleIntensityLevel: 50,
    };
    const cleanScenarios = scenarios.map((s) => ({ name: (s.name || 'Scenario').trim(), text: s.text }))
      .filter((s) => s.text.trim());
    return {
      ...base,
      name: name.trim(),
      chatName: (char?.chatName || '').trim() || name.trim(),
      avatar,
      background,
      danceUrl: danceUrl.trim(),
      voiceURI,
      appearance: appearance.trim(),
      description,
      lore,
      tags,
      instructions,
      reminder,
      narratorReminder,
      scenarios: cleanScenarios.length ? cleanScenarios : (base.scenarios || []),
      archetype: archetype || undefined,
      traits,
      themeName: themeName || undefined,
      themeValues: (savedThemes.find((t) => t.name === themeName) || {}).values
        || (themeName && themeName === char?.themeName ? char?.themeValues : undefined),
      type: 'character',
      characterIds: base.characterIds || [],
    };
  }

  async function save() {
    if (!name.trim() || busy) return;
    setBusy(true);
    const updated = buildRecord(false);
    await saveCharacter(updated);
    syncCharacterToServer(updated);
    setBusy(false);
    onSaved && onSaved(updated);
  }

  async function duplicate() {
    if (!name.trim() || busy) return;
    setBusy(true);
    const copy = buildRecord(true);
    copy.name = copy.name + ' (copy)';
    copy.chats = {};
    await saveCharacter(copy);
    syncCharacterToServer(copy);
    setBusy(false);
    onSaved && onSaved(copy);
  }

  // Count of filled fields per tab → a small badge so the user can see what's set.
  const counts = {
    basics: [name, avatar, tags, description].filter((x) => x && x.trim()).length,
    personality: (archetype ? 1 : 0) + TRAIT_DEFS.filter((d) => typeof traits[d.key] === 'number' && traits[d.key] !== 50).length,
    greetings: scenarios.filter((s) => s.text && s.text.trim()).length,
    lore: [lore].filter((x) => x && x.trim()).length,
    media: [background, danceUrl, voiceURI, appearance].filter((x) => x && x.trim()).length,
    advanced: [instructions, reminder, narratorReminder].filter((x) => x && x.trim()).length,
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl glass-panel shadow-2xl shadow-black/60">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <h2 className="text-xl font-bold">{editing ? 'Edit character' : 'Create character'}</h2>
          <button onClick={() => onClose()} className="grid h-8 w-8 place-items-center rounded-lg text-em-text-dim transition hover:bg-white/5 hover:text-em-text">✕</button>
        </div>

        {/* Tab rail */}
        <div className="flex gap-1 overflow-x-auto border-b border-white/10 px-3 py-2">
          {EDITOR_TABS.map((t) => {
            const active = tab === t.key;
            const Icon = t.Icon;
            const n = counts[t.key];
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={
                  'flex shrink-0 items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition ' +
                  (active ? 'bg-em-accent/15 text-em-accent' : 'text-em-text-dim hover:bg-white/5 hover:text-em-text')
                }
              >
                <Icon className="h-[18px] w-[18px]" />
                <span>{t.label}</span>
                {n > 0 && <span className={'grid h-4 min-w-4 place-items-center rounded-full px-1 text-[10px] font-bold ' + (active ? 'bg-em-accent text-em-bg' : 'bg-white/10 text-em-text-dim')}>{n}</span>}
              </button>
            );
          })}
        </div>

        {/* Scrollable body */}
        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          {aiError && <p className="mb-3 rounded-lg border border-red-400/30 bg-red-400/10 px-3 py-2 text-xs text-red-300">{aiError}</p>}

          {/* ── BASICS ── */}
          {tab === 'basics' && (
            <div className="space-y-4">
              {/* AI generate */}
              <div className="rounded-2xl border border-em-accent/25 bg-em-accent/[0.06] p-3">
                <div className="mb-2 text-sm font-semibold text-em-accent">✨ Generate with AI</div>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <input
                    value={concept}
                    onChange={(e) => setConcept(e.target.value)}
                    placeholder="Concept (e.g. a cynical space-pirate captain) — or leave blank for random"
                    className={inputCls + ' flex-1'}
                  />
                  <button
                    onClick={aiGenerateCharacter}
                    disabled={!!aiBusy}
                    className="shrink-0 rounded-xl bg-em-accent px-4 py-2 font-semibold text-em-bg transition enabled:hover:bg-emerald-300 disabled:opacity-50"
                  >
                    {aiBusy === 'char' ? 'Generating…' : 'Generate card'}
                  </button>
                </div>
                <p className="mt-1 text-xs text-em-text-dim">Fills name, description, tags & instructions. Existing images are kept.</p>
              </div>

              {/* Import from Shikimori (anime DB) */}
              <div className="rounded-2xl border border-sky-400/20 bg-sky-400/[0.05] p-3">
                <div className="mb-2 flex items-center gap-2">
                  <span className="grid h-7 w-7 place-items-center rounded-lg bg-sky-400/15 text-sky-300"><Download className="h-4 w-4" /></span>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-sky-200">Import from Shikimori</div>
                    <div className="text-[11px] text-em-text-dim">Pull an anime character's name, tags, description & avatar in one click.</div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <input
                    value={shikiQ}
                    onChange={(e) => setShikiQ(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); doShikiSearch(); } }}
                    placeholder="e.g. Akame, Makima, Rem…"
                    className={inputCls}
                  />
                  <button type="button" onClick={doShikiSearch} disabled={shikiBusy} className="shrink-0 rounded-xl bg-sky-400 px-4 py-2 font-semibold text-sky-950 transition enabled:hover:bg-sky-300 disabled:opacity-50">
                    {shikiBusy ? '…' : 'Search'}
                  </button>
                </div>
                {shikiResults.length > 0 && (
                  <div className="mt-2 grid max-h-64 grid-cols-2 gap-2 overflow-y-auto sm:grid-cols-4">
                    {shikiResults.map((r) => (
                      <button key={r.id} type="button" onClick={() => importShiki(r)} disabled={shikiBusy}
                        className="group/shiki overflow-hidden rounded-xl border border-white/10 bg-white/[0.03] text-left transition hover:border-sky-400/50 hover:bg-white/[0.06] disabled:opacity-50">
                        <div className="aspect-[3/4] w-full overflow-hidden bg-em-bg">
                          {r.image
                            ? <img src={avatarSrc(r.image)} alt="" className="h-full w-full object-cover transition group-hover/shiki:scale-105" />
                            : <div className="flex h-full w-full items-center justify-center text-2xl text-em-text-dim/40">🎴</div>}
                        </div>
                        <div className="p-1.5">
                          <div className="truncate text-xs font-medium text-em-text">{r.name}</div>
                          {r.russian && <div className="truncate text-[10px] text-em-text-dim">{r.russian}</div>}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex gap-4">
                <div className="flex flex-col items-center gap-2">
                  <div className="h-24 w-24 overflow-hidden rounded-2xl border border-white/10 bg-em-bg">
                    {avatar ? <img src={avatarSrc(avatar)} alt="" className="h-full w-full object-cover" /> : <div className="flex h-full w-full items-center justify-center text-3xl text-em-text-dim/40">👤</div>}
                  </div>
                  <label className="cursor-pointer rounded-lg border border-white/10 px-2 py-1 text-xs text-em-text-dim transition hover:border-em-accent/40 hover:text-em-text">
                    Upload
                    <input type="file" accept="image/*" className="hidden" onChange={pickAvatar} />
                  </label>
                  <button type="button" onClick={aiGenerateAvatar} disabled={aiBusy === 'avatar'} title="Generate an avatar with your Photos provider" className="rounded-lg border border-em-accent/30 bg-em-accent/10 px-2 py-1 text-xs font-medium text-em-accent transition hover:bg-em-accent/20 disabled:opacity-40">{aiBusy === 'avatar' ? '…' : '✨ Generate'}</button>
                </div>
                <div className="flex-1 space-y-4">
                  <Field label="Name">
                    <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Akame" className={inputCls} />
                  </Field>
                  <Field label="Avatar URL" hint="Or paste an image URL (proxied automatically).">
                    <input value={/^https?:\/\//i.test(avatar) ? avatar : ''} onChange={(e) => setAvatar(e.target.value)} placeholder="https://…" className={inputCls} />
                  </Field>
                </div>
              </div>

              <Field label="Tags" hint="Comma-separated, e.g. anime, dark fantasy, assassin">
                <input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="anime, isekai" className={inputCls} />
              </Field>

              <Field label="Description" hint="Who they are: personality, speech, appearance. Write facts plainly OR in a creative voice — both work. {{char}} / {{user}} supported.">
                <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={6} className={inputCls} />
                <span className="mt-1 block text-right text-[11px] text-em-text-dim/70">{description.length} chars · ~{Math.ceil(description.length / 4)} tokens</span>
              </Field>
            </div>
          )}

          {/* ── PERSONALITY ── */}
          {tab === 'personality' && (
            <div className="space-y-5">
              <Field label="Relationship to you" hint="Sets the starting dynamic and seeds affection / trust / tension for new chats.">
                <select value={archetype} onChange={(e) => setArchetype(e.target.value)} className={inputCls}>
                  {ARCHETYPES.map((a) => <option key={a.key || 'none'} value={a.key}>{a.label}</option>)}
                </select>
              </Field>
              <div>
                <div className="mb-1 text-sm font-medium text-em-text">Personality</div>
                <p className="mb-3 text-xs text-em-text-dim">Slide toward a trait to make it part of who they are. Centre = no strong lean (not injected).</p>
                <div className="space-y-4">
                  {TRAIT_DEFS.map((d) => {
                    const v = typeof traits[d.key] === 'number' ? traits[d.key] : 50;
                    return (
                      <div key={d.key}>
                        <div className="mb-1 flex items-center justify-between text-xs">
                          <span className="text-em-text-dim">{d.low}</span>
                          <span className="font-semibold text-em-accent">{d.label}</span>
                          <span className="text-em-text-dim">{d.high}</span>
                        </div>
                        <input type="range" min="0" max="100" step="1" value={v} onChange={(e) => setTrait(d.key, parseInt(e.target.value, 10))} className="w-full accent-em-accent" />
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* ── GREETINGS ── */}
          {tab === 'greetings' && (
            <div>
              <div className="mb-1 flex items-center justify-between">
                <span className="text-sm font-medium text-em-text">Greetings / scenarios</span>
                <button onClick={addScenario} className="rounded-lg border border-white/10 px-2 py-0.5 text-xs text-em-text-dim transition hover:border-em-accent/40 hover:text-em-text">＋ Add</button>
              </div>
              <p className="mb-2 text-xs text-em-text-dim">The first message of a new chat. With more than one, you pick which when starting a chat.</p>
              <div className="space-y-3">
                {scenarios.map((s, i) => (
                  <div key={i} className="rounded-2xl border border-white/10 bg-black/20 p-3">
                    <div className="mb-2 flex items-center gap-2">
                      <input value={s.name} onChange={(e) => setScenario(i, 'name', e.target.value)} placeholder="Scenario name" className={inputCls + ' max-w-[14rem] py-1.5'} />
                      <button onClick={() => aiGenerateScenario(i)} disabled={!!aiBusy} title="Generate this scenario with AI" className="rounded-lg border border-em-accent/40 px-2 py-1.5 text-xs text-em-accent transition enabled:hover:bg-em-accent/10 disabled:opacity-50">
                        {aiBusy === 'scenario' ? '…' : '✨ AI'}
                      </button>
                      {scenarios.length > 1 && <button onClick={() => removeScenario(i)} className="ml-auto text-xs text-em-text-dim transition hover:text-red-400">Remove</button>}
                    </div>
                    <textarea value={s.text} onChange={(e) => setScenario(i, 'text', e.target.value)} rows={4} placeholder="First message…" className={inputCls} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── LORE ── */}
          {tab === 'lore' && (
            <Field label="Lore" hint="Background facts. Lines starting with [key1, key2] inject only when a key appears recently.">
              <textarea value={lore} onChange={(e) => setLore(e.target.value)} rows={12} className={inputCls} placeholder="World, history, relationships, secrets…" />
              <span className="mt-1 block text-right text-[11px] text-em-text-dim/70">{lore.length} chars · ~{Math.ceil(lore.length / 4)} tokens</span>
            </Field>
          )}

          {/* ── MEDIA & VOICE ── */}
          {tab === 'media' && (
            <div className="space-y-4">
              <Field label="Chat theme" hint="Apply a saved appearance theme automatically while chatting with this character. Create themes in Settings → Appearance.">
                <select value={themeName} onChange={(e) => setThemeName(e.target.value)} className={inputCls}>
                  <option value="">None (use global look)</option>
                  {savedThemes.map((t) => <option key={t.id} value={t.name}>{t.name}</option>)}
                  {themeName && !savedThemes.some((t) => t.name === themeName) && <option value={themeName}>{themeName} (saved)</option>}
                </select>
              </Field>

              <Field label="Background image" hint="Optional scene backdrop shown behind the chat. Upload, paste a URL, or generate one with AI (uses your Photos provider).">
                <div className="flex items-center gap-3">
                  <div className="h-14 w-24 shrink-0 overflow-hidden rounded-lg border border-white/10 bg-em-bg">
                    {background ? <img src={avatarSrc(background)} alt="" className="h-full w-full object-cover" /> : <div className="flex h-full w-full items-center justify-center text-xs text-em-text-dim/50">none</div>}
                  </div>
                  <input value={/^https?:\/\//i.test(background) ? background : ''} onChange={(e) => setBackground(e.target.value)} placeholder="https://…" className={inputCls} />
                  <label className="shrink-0 cursor-pointer rounded-lg border border-white/10 px-2 py-1.5 text-xs text-em-text-dim transition hover:border-em-accent/40 hover:text-em-text">
                    Upload
                    <input type="file" accept="image/*" className="hidden" onChange={pickBackground} />
                  </label>
                  {background && <button onClick={() => setBackground('')} className="shrink-0 text-xs text-em-text-dim transition hover:text-red-400">Clear</button>}
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <input value={bgPrompt} onChange={(e) => setBgPrompt(e.target.value)} placeholder="Describe the scene to generate (e.g. moonlit dojo, rain) — blank = from character" className={inputCls} />
                  <button
                    type="button"
                    disabled={aiBusy === 'wallpaper'}
                    onClick={aiGenerateWallpaper}
                    className="shrink-0 rounded-lg border border-em-accent/30 bg-em-accent/10 px-3 py-1.5 text-xs font-medium text-em-accent transition hover:bg-em-accent/20 disabled:opacity-40"
                  >
                    {aiBusy === 'wallpaper' ? 'generating…' : '✨ Generate'}
                  </button>
                </div>
              </Field>

              <Field label="Dance clip URL" hint="Optional video (.mp4/.webm) or GIF that loops in the corner while music plays. A real clip — not a still.">
                <div className="flex items-center gap-3">
                  <input value={danceUrl} onChange={(e) => setDanceUrl(e.target.value)} placeholder="https://…/dance.mp4 or .gif" className={inputCls} />
                  {danceUrl && <button onClick={() => setDanceUrl('')} className="shrink-0 text-xs text-em-text-dim transition hover:text-red-400">Clear</button>}
                </div>
              </Field>

              {ttsSupported() && (
                <Field label="Voice (TTS)" hint="This character's speaking voice. Overrides the default voice in Settings.">
                  <select value={voiceURI} onChange={(e) => setVoiceURI(e.target.value)} className={inputCls}>
                    <option value="">(Use default voice)</option>
                    {groupVoices(voices).map(([label, list]) => (
                      <optgroup key={label} label={label}>
                        {list.map((v) => <option key={v.voiceURI} value={v.voiceURI}>{v.name} ({v.lang})</option>)}
                      </optgroup>
                    ))}
                  </select>
                </Field>
              )}

              <Field label="Appearance (for AI photos)" hint="Visual tags for selfie generation. Click ✨ Auto to let the AI identify the character and write Danbooru tags (e.g. 'akame (akame ga kill!)…'). Generated automatically on the first photo if left blank. Enable AI photos in Settings.">
                <div className="flex items-center gap-2">
                  <input value={appearance} onChange={(e) => setAppearance(e.target.value)} placeholder="akame (akame ga kill!), akame ga kill!, long black hair, red eyes…" className={inputCls} />
                  <button
                    type="button"
                    disabled={aiBusy === 'appearance' || !name.trim()}
                    onClick={aiGenerateAppearance}
                    className="shrink-0 rounded-lg border border-em-accent/30 bg-em-accent/10 px-3 py-1.5 text-xs font-medium text-em-accent transition hover:bg-em-accent/20 disabled:opacity-40"
                  >
                    {aiBusy === 'appearance' ? '…' : '✨ Auto'}
                  </button>
                </div>
              </Field>
            </div>
          )}

          {/* ── ADVANCED ── */}
          {tab === 'advanced' && (
            <div className="space-y-4">
              <Field label="AI Instructions" hint="High-priority system instructions for this character.">
                <textarea value={instructions} onChange={(e) => setInstructions(e.target.value)} rows={3} className={inputCls} />
              </Field>
              <Field label="Reminder" hint="Appended near the end of each turn (strong nudge).">
                <textarea value={reminder} onChange={(e) => setReminder(e.target.value)} rows={3} className={inputCls} />
              </Field>
              <Field label="Narrator reminder" hint="Extra nudge used when this character narrates a group/world scene.">
                <textarea value={narratorReminder} onChange={(e) => setNarratorReminder(e.target.value)} rows={3} className={inputCls} />
              </Field>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 border-t border-white/10 px-5 py-4">
          {editing && <button onClick={duplicate} disabled={!name.trim() || busy} className="mr-auto rounded-xl border border-white/10 px-4 py-2 text-em-text-dim transition enabled:hover:border-em-accent/40 enabled:hover:text-em-text disabled:opacity-40" title="Save a copy as a new character">⧉ Duplicate</button>}
          <button onClick={() => onClose()} className="rounded-xl border border-white/10 px-4 py-2 text-em-text-dim transition hover:text-em-text">Cancel</button>
          <button onClick={save} disabled={!name.trim() || busy} className="rounded-xl bg-em-accent px-5 py-2 font-semibold text-em-bg transition enabled:hover:bg-emerald-300 disabled:opacity-40">
            {busy ? 'Saving…' : editing ? 'Save' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  );
}
