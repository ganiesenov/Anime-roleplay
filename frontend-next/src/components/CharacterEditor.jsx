import { useState } from 'react';
import { saveCharacter } from '../lib/db.js';
import { syncCharacterToServer, fileToDataUrl } from '../lib/api.js';

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

export default function CharacterEditor({ char, onClose, onSaved }) {
  const editing = !!(char && char.id);
  const [name, setName] = useState(char?.name || '');
  const [avatar, setAvatar] = useState(char?.avatar || '');
  const [tags, setTags] = useState(char?.tags || '');
  const [description, setDescription] = useState(char?.description || '');
  const [greeting, setGreeting] = useState(
    (char?.scenarios && char.scenarios[0] && char.scenarios[0].text) || char?.first_mes || ''
  );
  const [lore, setLore] = useState(char?.lore || '');
  const [instructions, setInstructions] = useState(char?.instructions || '');
  const [reminder, setReminder] = useState(char?.reminder || '');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [busy, setBusy] = useState(false);

  async function pickAvatar(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    try { setAvatar(await fileToDataUrl(file)); } catch (err) { /* ignore */ }
  }

  async function save() {
    if (!name.trim() || busy) return;
    setBusy(true);
    const base = editing
      ? { ...char }
      : { id: 'char-' + Date.now(), chats: {}, isFavorite: false, isArchived: false, particleEffect: 'none', particleIntensityLevel: 50 };
    const updated = {
      ...base,
      name: name.trim(),
      chatName: (char?.chatName || '').trim() || name.trim(),
      avatar,
      background: base.background || '',
      description,
      lore,
      tags,
      instructions,
      reminder,
      narratorReminder: base.narratorReminder || '',
      scenarios: greeting.trim() ? [{ name: 'Greeting', text: greeting }] : (base.scenarios || []),
      type: 'character',
      characterIds: base.characterIds || [],
    };
    await saveCharacter(updated);
    syncCharacterToServer(updated);
    setBusy(false);
    onSaved && onSaved(updated);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-4 backdrop-blur-sm">
      <div className="my-8 w-full max-w-2xl rounded-3xl border border-white/10 bg-em-panel/95 p-6 shadow-2xl shadow-black/60">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-xl font-bold">{editing ? 'Edit character' : 'Create character'}</h2>
          <button onClick={() => onClose()} className="rounded-lg px-3 py-1.5 text-em-text-dim transition hover:text-em-text">✕</button>
        </div>

        <div className="space-y-4">
          <div className="flex gap-4">
            <div className="flex flex-col items-center gap-2">
              <div className="h-24 w-24 overflow-hidden rounded-2xl border border-white/10 bg-em-bg">
                {avatar ? <img src={avatarSrc(avatar)} alt="" className="h-full w-full object-cover" /> : <div className="flex h-full w-full items-center justify-center text-3xl text-em-text-dim/40">👤</div>}
              </div>
              <label className="cursor-pointer rounded-lg border border-white/10 px-2 py-1 text-xs text-em-text-dim transition hover:border-em-accent/40 hover:text-em-text">
                Upload
                <input type="file" accept="image/*" className="hidden" onChange={pickAvatar} />
              </label>
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

          <Field label="Description" hint="Who they are: personality, speech, appearance. {{char}} / {{user}} supported.">
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} className={inputCls} />
          </Field>

          <Field label="Greeting" hint="First message the character sends when a new chat starts.">
            <textarea value={greeting} onChange={(e) => setGreeting(e.target.value)} rows={3} className={inputCls} />
          </Field>

          <Field label="Lore" hint="Background facts. Lines starting with [key1, key2] inject only when a key appears recently.">
            <textarea value={lore} onChange={(e) => setLore(e.target.value)} rows={3} className={inputCls} />
          </Field>

          <button onClick={() => setShowAdvanced((v) => !v)} className="text-sm text-em-text-dim transition hover:text-em-text">
            {showAdvanced ? '▾' : '▸'} Advanced
          </button>
          {showAdvanced && (
            <div className="space-y-4 rounded-2xl border border-white/10 bg-black/20 p-4">
              <Field label="AI Instructions" hint="High-priority system instructions for this character.">
                <textarea value={instructions} onChange={(e) => setInstructions(e.target.value)} rows={2} className={inputCls} />
              </Field>
              <Field label="Reminder" hint="Appended near the end of each turn (strong nudge).">
                <textarea value={reminder} onChange={(e) => setReminder(e.target.value)} rows={2} className={inputCls} />
              </Field>
            </div>
          )}
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button onClick={() => onClose()} className="rounded-xl border border-white/10 px-4 py-2 text-em-text-dim transition hover:text-em-text">Cancel</button>
          <button onClick={save} disabled={!name.trim() || busy} className="rounded-xl bg-em-accent px-5 py-2 font-semibold text-em-bg transition enabled:hover:bg-emerald-300 disabled:opacity-40">
            {busy ? 'Saving…' : editing ? 'Save' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  );
}
