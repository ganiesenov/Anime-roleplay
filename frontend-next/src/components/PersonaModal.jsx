import { useState } from 'react';
import { fileToDataUrl } from '../lib/api.js';
import Avatar from './Avatar.jsx';
import { TrashIcon, PersonaIcon } from './icons.jsx';

const inputCls =
  'w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-em-text placeholder:text-em-text-dim/60 focus:border-em-accent/50 focus:outline-none';

// A proper "create yourself" persona editor — who YOU are in the chat. Replaces
// the old window.prompt(name) flow. Supports avatar + description, plus delete.
export default function PersonaModal({ persona, onSave, onClose, onDelete }) {
  const editing = !!(persona && persona.id);
  const [name, setName] = useState(persona?.name || '');
  const [avatar, setAvatar] = useState(persona?.avatar || '');
  const [description, setDescription] = useState(persona?.description || '');
  const [faceRef, setFaceRef] = useState(persona?.faceRef || '');
  const [gender, setGender] = useState(persona?.gender || 'no');

  async function pickAvatar(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    try { setAvatar(await fileToDataUrl(file)); } catch (err) { /* ignore */ }
  }

  async function pickFace(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    try { setFaceRef(await fileToDataUrl(file)); } catch (err) { /* ignore */ }
  }

  function save() {
    if (!name.trim()) return;
    onSave({
      id: persona?.id || 'persona-' + Date.now(),
      name: name.trim(),
      avatar,
      description: description.trim(),
      faceRef,
      gender,
    });
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-lg rounded-3xl glass-panel p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-1 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-xl font-bold"><span className="text-em-accent"><PersonaIcon /></span>{editing ? 'Edit persona' : 'Create your persona'}</h2>
          <button onClick={onClose} className="rounded-lg px-3 py-1.5 text-em-text-dim transition hover:text-em-text">✕</button>
        </div>
        <p className="mb-5 text-sm text-em-text-dim">This is <span className="text-em-text">who YOU are</span> in the story — the character will treat you as this person.</p>

        <div className="flex gap-4">
          <div className="flex flex-col items-center gap-2">
            <div className="h-24 w-24 overflow-hidden rounded-2xl border border-white/10 bg-em-bg">
              <Avatar src={avatar} name={name || 'You'} size={96} rounded="rounded-2xl" />
            </div>
            <label className="cursor-pointer rounded-lg border border-white/10 px-2 py-1 text-xs text-em-text-dim transition hover:border-em-accent/40 hover:text-em-text">
              Upload
              <input type="file" accept="image/*" className="hidden" onChange={pickAvatar} />
            </label>
            {avatar && <button onClick={() => setAvatar('')} className="text-[11px] text-em-text-dim transition hover:text-red-400">Remove</button>}
          </div>
          <div className="flex-1 space-y-4">
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-em-text">Your name</span>
              <input autoFocus value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') save(); }} placeholder="e.g. Alex, or your own name" className={inputCls} />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-em-text">Avatar URL <span className="font-normal text-em-text-dim">(optional)</span></span>
              <input value={/^https?:\/\//i.test(avatar) ? avatar : ''} onChange={(e) => setAvatar(e.target.value)} placeholder="https://…" className={inputCls} />
            </label>
          </div>
        </div>

        <label className="mt-4 block">
          <span className="mb-1 block text-sm font-medium text-em-text">About you</span>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            placeholder="Describe yourself: age, looks, personality, how you speak, your backstory… The character reads this to know who they're talking to."
            className={inputCls}
          />
          <span className="mt-1 block text-xs text-em-text-dim">Fed to the model as your exact persona. {'{{user}}'} / {'{{char}}'} supported.</span>
        </label>

        <div className="mt-4 flex items-center gap-3 rounded-xl border border-white/10 p-3">
          <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl border border-white/10 bg-em-bg">
            {faceRef
              ? <img src={faceRef} alt="face" className="h-full w-full object-cover" />
              : <div className="flex h-full w-full items-center justify-center text-2xl">🙂</div>}
          </div>
          <div className="flex-1">
            <div className="text-sm font-medium text-em-text">Your face <span className="font-normal text-em-text-dim">(for face-swap into scenes)</span></div>
            <div className="mt-0.5 text-xs text-em-text-dim">A clear front-facing photo. Used locally (ReActor) to put your real face into generated photos/videos. Enable “Face-swap” in Settings → Photos.</div>
            <div className="mt-1.5 flex items-center gap-2">
              <label className="cursor-pointer rounded-lg border border-white/10 px-2 py-1 text-xs text-em-text-dim transition hover:border-em-accent/40 hover:text-em-text">
                Upload face
                <input type="file" accept="image/*" className="hidden" onChange={pickFace} />
              </label>
              {faceRef && <button onClick={() => setFaceRef('')} className="text-[11px] text-em-text-dim transition hover:text-red-400">Remove</button>}
              <span className="ml-auto flex items-center gap-1 text-[11px] text-em-text-dim">
                I'm a
                <select value={gender} onChange={(e) => setGender(e.target.value)} className="rounded-md border border-white/10 bg-white/[0.04] px-1.5 py-0.5 text-em-text focus:border-em-accent/50 focus:outline-none">
                  <option value="no">person</option>
                  <option value="male">man</option>
                  <option value="female">woman</option>
                </select>
              </span>
            </div>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-end gap-2">
          {editing && onDelete && (
            <button onClick={() => onDelete(persona.id)} className="mr-auto inline-flex items-center gap-1.5 rounded-xl border border-white/10 px-3 py-2 text-sm text-em-text-dim transition hover:border-red-400/40 hover:text-red-400">
              <TrashIcon /> Delete
            </button>
          )}
          <button onClick={onClose} className="rounded-xl border border-white/10 px-4 py-2 text-em-text-dim transition hover:text-em-text">Cancel</button>
          <button onClick={save} disabled={!name.trim()} className="rounded-xl bg-em-accent px-5 py-2 font-semibold text-em-bg transition enabled:hover:bg-emerald-300 disabled:opacity-40">{editing ? 'Save' : 'Create'}</button>
        </div>
      </div>
    </div>
  );
}
