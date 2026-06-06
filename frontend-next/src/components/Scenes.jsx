import { useState } from 'react';
import { loadScenes, saveScenes, newSceneId } from '../lib/scenes.js';
import { buildWallpaperUrl } from '../lib/chat.js';
import { fetchAsDataUrl } from '../lib/api.js';

function sceneImg(url) {
  if (!url) return '';
  if (/^https?:\/\//i.test(url)) return '/api/img?url=' + encodeURIComponent(url);
  return url;
}

// Home-page shelf of reusable scenes. Playing one spins up a fresh chat for the
// chosen character, seeded with the scene's opening (handled by the parent).
export default function Scenes({ chars, settings, onPlay }) {
  const [scenes, setScenes] = useState(loadScenes);
  const [editing, setEditing] = useState(null);  // scene being edited/created, or null
  const [playing, setPlaying] = useState(null);   // scene being launched, or null

  function persist(next) { setScenes(next); saveScenes(next); }
  function upsert(scene) {
    const exists = scenes.some((s) => s.id === scene.id);
    persist(exists ? scenes.map((s) => (s.id === scene.id ? scene : s)) : [scene, ...scenes]);
    setEditing(null);
  }
  function remove(id) { persist(scenes.filter((s) => s.id !== id)); setEditing(null); }

  return (
    <section className="mx-auto max-w-7xl px-5 pb-6">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-bold">Scenes</h2>
        <button onClick={() => setEditing({ id: newSceneId(), title: '', setup: '', tags: '', image: '' })}
          className="rounded-lg border border-em-accent/30 bg-em-accent/10 px-3 py-1.5 text-sm font-medium text-em-accent transition hover:bg-em-accent/20">
          ＋ New scene
        </button>
      </div>
      <div className="flex gap-4 overflow-x-auto pb-2">
        {scenes.map((s) => (
          <div key={s.id} className="group/scene relative w-52 shrink-0">
            <button
              onClick={() => setPlaying(s)}
              className="char-card flex h-64 w-52 flex-col overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] text-left"
            >
              <div className="relative h-full w-full overflow-hidden bg-em-panel">
                {s.image
                  ? <img src={sceneImg(s.image)} alt="" className="h-full w-full object-cover transition duration-300 group-hover/scene:scale-105" />
                  : <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-em-panel to-em-bg text-4xl text-em-text-dim/30">🎬</div>}
                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 p-3">
                  <h3 className="line-clamp-2 text-sm font-semibold text-white drop-shadow">{s.title || 'Untitled scene'}</h3>
                  {s.tags && <div className="mt-1 truncate text-[10px] text-em-accent">{s.tags}</div>}
                </div>
              </div>
            </button>
            <span
              role="button" tabIndex={0}
              onClick={(e) => { e.stopPropagation(); setEditing(s); }}
              className="absolute right-2 top-2 z-10 grid h-7 w-7 place-items-center rounded-full bg-black/55 text-white/70 opacity-0 backdrop-blur transition hover:text-em-accent group-hover/scene:opacity-100"
              title="Edit scene"
            >✎</span>
          </div>
        ))}
      </div>

      {editing && <SceneEditor scene={editing} settings={settings} onSave={upsert} onDelete={remove} onClose={() => setEditing(null)} />}
      {playing && <ScenePlay scene={playing} chars={chars} onPlay={(s, c) => { setPlaying(null); onPlay(s, c); }} onClose={() => setPlaying(null)} />}
    </section>
  );
}

function SceneEditor({ scene, settings, onSave, onDelete, onClose }) {
  const [title, setTitle] = useState(scene.title || '');
  const [tags, setTags] = useState(scene.tags || '');
  const [setup, setSetup] = useState(scene.setup || '');
  const [image, setImage] = useState(scene.image || '');
  const [busy, setBusy] = useState(false);
  const inputCls = 'w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-em-text placeholder:text-em-text-dim/60 focus:border-em-accent/50 focus:outline-none';

  async function genImage() {
    setBusy(true);
    try {
      const desc = (title + ', ' + tags).trim().replace(/^,|,$/g, '') || 'atmospheric scene';
      setImage(await fetchAsDataUrl(buildWallpaperUrl(desc, settings)));
    } catch (e) { window.alert('Image generation failed — check your Photos provider in Settings.'); }
    finally { setBusy(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="my-8 w-full max-w-lg rounded-3xl border border-white/10 bg-em-panel/95 p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">{scene.title ? 'Edit scene' : 'New scene'}</h2>
          <button onClick={onClose} className="rounded-lg px-3 py-1.5 text-em-text-dim transition hover:text-em-text">✕</button>
        </div>
        <div className="space-y-3">
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Scene title (e.g. Stranded after the storm)" className={inputCls} />
          <input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="Tags (comma-separated)" className={inputCls} />
          <textarea value={setup} onChange={(e) => setSetup(e.target.value)} rows={6}
            placeholder="Opening setup — the scene the character speaks first. {{char}} / {{user}} supported."
            className={inputCls + ' resize-y'} />
          <div className="flex items-center gap-3">
            <div className="h-16 w-28 shrink-0 overflow-hidden rounded-lg border border-white/10 bg-em-bg">
              {image ? <img src={sceneImg(image)} alt="" className="h-full w-full object-cover" /> : <div className="flex h-full w-full items-center justify-center text-xs text-em-text-dim/50">no art</div>}
            </div>
            <button onClick={genImage} disabled={busy} className="rounded-lg border border-em-accent/30 bg-em-accent/10 px-3 py-1.5 text-xs font-medium text-em-accent transition hover:bg-em-accent/20 disabled:opacity-40">
              {busy ? 'generating…' : '✨ Generate art'}
            </button>
            {image && <button onClick={() => setImage('')} className="text-xs text-em-text-dim transition hover:text-red-400">Clear</button>}
          </div>
        </div>
        <div className="mt-5 flex items-center justify-between">
          {scene.title ? <button onClick={() => onDelete(scene.id)} className="text-sm text-em-text-dim transition hover:text-red-400">Delete</button> : <span />}
          <button onClick={() => title.trim() && setup.trim() && onSave({ ...scene, title: title.trim(), tags: tags.trim(), setup, image })}
            disabled={!title.trim() || !setup.trim()}
            className="rounded-lg bg-em-accent px-4 py-2 font-semibold text-em-bg transition hover:bg-emerald-300 disabled:opacity-40">Save</button>
        </div>
      </div>
    </div>
  );
}

function ScenePlay({ scene, chars, onPlay, onClose }) {
  const [charId, setCharId] = useState((chars && chars[0] && chars[0].id) || '');
  const char = (chars || []).find((c) => c.id === charId);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-md rounded-3xl border border-white/10 bg-em-panel/95 p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold">{scene.title}</h2>
          <button onClick={onClose} className="rounded-lg px-3 py-1.5 text-em-text-dim transition hover:text-em-text">✕</button>
        </div>
        <p className="mb-4 max-h-40 overflow-y-auto whitespace-pre-wrap text-sm text-em-text-dim">{scene.setup}</p>
        <label className="mb-1 block text-sm font-medium">Play as character</label>
        <select value={charId} onChange={(e) => setCharId(e.target.value)}
          className="mb-4 w-full rounded-xl border border-white/10 bg-em-panel px-3 py-2 text-em-text focus:border-em-accent/50 focus:outline-none">
          {(chars || []).map((c) => <option key={c.id} value={c.id}>{c.name || 'Unnamed'}</option>)}
        </select>
        <button onClick={() => char && onPlay(scene, char)} disabled={!char}
          className="w-full rounded-lg bg-em-accent px-4 py-2.5 font-semibold text-em-bg transition hover:bg-emerald-300 disabled:opacity-40">
          ▶ Start scene
        </button>
      </div>
    </div>
  );
}
