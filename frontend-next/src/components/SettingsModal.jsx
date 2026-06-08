import { useEffect, useRef, useState } from 'react';
import { fetchAvailableModels, DEFAULT_SETTINGS } from '../lib/settings.js';
import { ACCENTS, hexToRgba } from '../lib/design.js';
import { ttsSupported, getVoices, onVoicesChanged, groupVoices } from '../lib/tts.js';
import { Brain, Drama, Clapperboard, Palette, Plug, Puzzle, Settings as SettingsGlyph, RotateCcw, Trash2, Upload, Download } from 'lucide-react';
import { loadThemes, saveThemes, themeValuesFrom, exportThemes, importThemes } from '../lib/themes.js';

// One-click looks — each sets the accent + prose colours together.
const THEME_PRESETS = [
  { key: 'emerald', label: 'Emerald', accent: 'emerald', mainTextColor: '#e9f5ef', dialogueColor: '#ffd952', userBubbleColor: '#2ee6a0', aiBubbleColor: '#ffffff' },
  { key: 'midnight', label: 'Midnight', accent: 'blue', mainTextColor: '#e8eefc', dialogueColor: '#7dd3fc', userBubbleColor: '#60a5fa', aiBubbleColor: '#cbd5e1' },
  { key: 'rose', label: 'Rosé', accent: 'rose', mainTextColor: '#fbe9ef', dialogueColor: '#fbbf24', userBubbleColor: '#fb7185', aiBubbleColor: '#ffffff' },
  { key: 'violet', label: 'Amethyst', accent: 'violet', mainTextColor: '#efeafe', dialogueColor: '#c4b5fd', userBubbleColor: '#a78bfa', aiBubbleColor: '#e9d5ff' },
];

const APPEARANCE_KEYS = ['accent', 'charAccent', 'avatarSize', 'fontSize', 'messageSpacing', 'chatWidth', 'avatarShape', 'bubbleLayout', 'mainTextColor', 'dialogueColor', 'userBubbleColor', 'userBubbleOpacity', 'aiBubbleColor', 'aiBubbleOpacity', 'blur'];

function Section({ title, children }) {
  return (
    <div className="py-3">
      <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-em-text-dim">{title}</div>
      <div className="divide-y divide-white/5">{children}</div>
    </div>
  );
}

// Live preview of how messages will look with the current appearance settings.
function BubblePreview({ s }) {
  const userBg = hexToRgba(s.userBubbleColor || '#2ee6a0', s.userBubbleOpacity != null ? s.userBubbleOpacity : 0.15);
  const aiBg = hexToRgba(s.aiBubbleColor || '#ffffff', s.aiBubbleOpacity != null ? s.aiBubbleOpacity : 0.04);
  const blur = (s.blur || 0) + 6;
  const fz = (s.fontSize || 15) + 'px';
  return (
    <div className="rounded-2xl border border-white/10 bg-em-bg/50 p-3" style={{ display: 'flex', flexDirection: 'column', gap: (s.messageSpacing || 20) + 'px' }}>
      <div className="self-start max-w-[85%] rounded-2xl px-3 py-2" style={{ background: `linear-gradient(${aiBg},${aiBg}), rgba(7,18,13,0.5)`, backdropFilter: `blur(${blur}px)` }}>
        <span style={{ color: s.mainTextColor || '#e9f5ef', fontSize: fz }}>She steps closer, </span>
        <span style={{ color: '#5cffc4', fontSize: fz, fontStyle: 'italic' }}>eyes narrowing</span>
        <span style={{ color: s.mainTextColor || '#e9f5ef', fontSize: fz }}>. </span>
        <span style={{ color: s.dialogueColor || '#ffd952', fontSize: fz }}>"You came back."</span>
      </div>
      <div className="self-end max-w-[85%] rounded-2xl px-3 py-2" style={{ background: `linear-gradient(${userBg},${userBg}), rgba(7,18,13,0.5)`, backdropFilter: `blur(${blur}px)` }}>
        <span style={{ color: s.mainTextColor || '#e9f5ef', fontSize: fz }}>I always do.</span>
      </div>
    </div>
  );
}

const inputCls = 'w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-em-text focus:border-em-accent/50 focus:outline-none';
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

const TABS = [
  { key: 'model', Icon: Brain, label: 'Model' },
  { key: 'roleplay', Icon: Drama, label: 'Roleplay' },
  { key: 'media', Icon: Clapperboard, label: 'Photos & Voice' },
  { key: 'appearance', Icon: Palette, label: 'Appearance' },
  { key: 'providers', Icon: Plug, label: 'Providers' },
  { key: 'memory', Icon: Puzzle, label: 'Memory' },
];

function Row({ label, hint, children }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2.5">
      <div className="min-w-0">
        <div className="text-sm font-medium text-em-text">{label}</div>
        {hint && <div className="text-xs text-em-text-dim">{hint}</div>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

// iOS-style toggle switch — replaces the bare checkboxes for a cleaner look.
function Toggle({ checked, onChange }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={!!checked}
      onClick={() => onChange(!checked)}
      className={'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-200 ' + (checked ? 'bg-em-accent' : 'bg-white/15')}
    >
      <span className={'inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform duration-200 ' + (checked ? 'translate-x-[22px]' : 'translate-x-0.5')} />
    </button>
  );
}

export default function SettingsModal({ settings, onSave, onClose }) {
  const [s, setS] = useState(settings);
  const [tab, setTab] = useState('model');
  const [models, setModels] = useState([]);
  const [voices, setVoices] = useState([]);
  const [themes, setThemes] = useState(loadThemes);
  const [themeName, setThemeName] = useState('');
  const themeFileRef = useRef(null);
  const set = (k, v) => setS((prev) => ({ ...prev, [k]: v }));

  function applyThemeValues(v) { Object.keys(v || {}).forEach((k) => set(k, v[k])); }
  function saveCurrentTheme() {
    const name = themeName.trim();
    if (!name) return;
    const next = [...themes.filter((t) => t.name !== name), { id: 'theme-' + Date.now(), name, values: themeValuesFrom(s) }];
    setThemes(next); saveThemes(next); setThemeName('');
  }
  function deleteTheme(id) { const next = themes.filter((t) => t.id !== id); setThemes(next); saveThemes(next); }
  async function onImportThemes(e) {
    const f = e.target.files && e.target.files[0]; e.target.value = '';
    if (!f) return;
    try { setThemes(await importThemes(f)); } catch (err) { window.alert('Import failed: not a themes file.'); }
  }

  useEffect(() => { fetchAvailableModels().then(setModels); }, []);
  useEffect(() => {
    if (!ttsSupported()) return undefined;
    setVoices(getVoices());
    return onVoicesChanged(setVoices);
  }, []);

  const remoteModels = s.remoteModels || [];
  const setRemote = (i, k, v) => set('remoteModels', remoteModels.map((m, j) => (j === i ? { ...m, [k]: v } : m)));
  const addRemote = (preset) => set('remoteModels', [...remoteModels, { name: '', id: '', apiUrl: preset || '', apiKey: '' }]);
  const removeRemote = (i) => set('remoteModels', remoteModels.filter((_, j) => j !== i));

  function ModelOptions({ withInherit }) {
    return (
      <>
        {withInherit && <option value="">(same as chat model)</option>}
        <option value="local-qwen">Default (backend)</option>
        {models.length > 0 && (
          <optgroup label="Local (Ollama)">
            {models.map((m) => <option key={m} value={m}>{m}</option>)}
          </optgroup>
        )}
        {remoteModels.filter((m) => m.id).length > 0 && (
          <optgroup label="Remote">
            {remoteModels.filter((m) => m.id).map((m) => <option key={m.id} value={m.id}>{m.name || m.id}</option>)}
          </optgroup>
        )}
      </>
    );
  }

  const rows = 'divide-y divide-white/5';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl glass-panel shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <h2 className="flex items-center gap-2 text-xl font-bold"><span className="text-em-accent"><SettingsGlyph className="h-5 w-5" /></span> Settings</h2>
          <button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-lg text-em-text-dim transition hover:bg-white/5 hover:text-em-text">✕</button>
        </div>

        <div className="flex min-h-0 flex-1">
          {/* Section rail */}
          <nav className="flex w-14 shrink-0 flex-col gap-1 overflow-y-auto border-r border-white/10 bg-black/20 p-2 sm:w-44 sm:p-3">
            {TABS.map((t) => {
              const active = tab === t.key;
              const Icon = t.Icon;
              return (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  title={t.label}
                  className={
                    'flex items-center justify-center gap-2.5 rounded-xl px-2 py-2.5 text-left text-sm transition sm:justify-start sm:px-3 ' +
                    (active ? 'bg-em-accent/15 font-semibold text-em-accent shadow-[inset_2px_0_0_var(--color-em-accent)]' : 'text-em-text-dim hover:bg-white/5 hover:text-em-text')
                  }
                >
                  <Icon className="h-[18px] w-[18px] shrink-0" />
                  <span className="hidden truncate sm:inline">{t.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Active section */}
          <div className="min-w-0 flex-1 overflow-y-auto p-5">
            {tab === 'model' && (
              <div className={rows}>
                <Row label="Chat model" hint="Local Ollama routes through the backend; remote models call their own endpoint.">
                  <select value={s.model} onChange={(e) => set('model', e.target.value)} className={inputCls + ' min-w-52'}><ModelOptions withInherit={false} /></select>
                </Row>
                <Row label="Suggestion model" hint="Model for reply suggestions.">
                  <select value={s.suggestionModelId || ''} onChange={(e) => set('suggestionModelId', e.target.value)} className={inputCls + ' min-w-52'}><ModelOptions withInherit /></select>
                </Row>
                <Row label="Summary model" hint="Model for auto-summarize / memory.">
                  <select value={s.summaryModelId || ''} onChange={(e) => set('summaryModelId', e.target.value)} className={inputCls + ' min-w-52'}><ModelOptions withInherit /></select>
                </Row>
                <Row label="Temperature" hint={`Higher = more creative (${Number(s.temperature).toFixed(2)}).`}>
                  <input type="range" min="0.1" max="1.2" step="0.05" value={s.temperature} onChange={(e) => set('temperature', parseFloat(e.target.value))} className="w-44 accent-em-accent" />
                </Row>
                <Row label="Reply length">
                  <select value={s.replyLength} onChange={(e) => set('replyLength', e.target.value)} className={inputCls + ' min-w-40'}>
                    <option value="default">Default</option>
                    <option value="short">Short</option>
                    <option value="medium">Medium</option>
                    <option value="long">Long</option>
                    <option value="verylong">Very long</option>
                  </select>
                </Row>
                <Row label="Writing style" hint="How replies are written.">
                  <select value={s.style || 'default'} onChange={(e) => set('style', e.target.value)} className={inputCls + ' min-w-40'}>
                    <option value="default">Default</option>
                    <option value="novelistic">Novelistic</option>
                    <option value="concise">Concise</option>
                    <option value="dialogue">Dialogue-heavy</option>
                    <option value="dramatic">Dramatic</option>
                  </select>
                </Row>
                <Row label="Show think blocks" hint="Display the model's reasoning.">
                  <Toggle checked={s.showThink} onChange={(v) => set('showThink', v)} />
                </Row>
              </div>
            )}

            {tab === 'roleplay' && (
              <div className={rows}>
                <Row label="Suggest replies" hint="Offer 2 quick user replies after each AI turn.">
                  <Toggle checked={s.replyOptions} onChange={(v) => set('replyOptions', v)} />
                </Row>
                <Row label="Living relationship" hint="Character tracks affection / trust / tension and acts on it over time.">
                  <Toggle checked={s.relationship} onChange={(v) => set('relationship', v)} />
                </Row>
                <Row label="Autonomy (no people-pleasing)" hint="Character keeps its own will, opinions and boundaries instead of mirroring you.">
                  <Toggle checked={s.autonomy} onChange={(v) => set('autonomy', v)} />
                </Row>
                <Row label="Living presence" hint="Time-of-day awareness, a sleep schedule, and proactive messages when you return.">
                  <Toggle checked={s.presence} onChange={(v) => set('presence', v)} />
                </Row>
                <Row label="Off-screen life" hint="Character lives their own day while you're away; it colours how they greet you back.">
                  <Toggle checked={s.offscreenLife} onChange={(v) => set('offscreenLife', v)} />
                </Row>
              </div>
            )}

            {tab === 'media' && (
              <div className={rows}>
                <Row label="AI photos" hint="Character can send AI-generated selfies when it fits. Set a per-character Appearance for better likeness.">
                  <Toggle checked={s.aiPhotos} onChange={(v) => set('aiPhotos', v)} />
                </Row>
                {s.aiPhotos && (
                  <Row label="Auto-selfie" hint="Let the character send a photo on its OWN initiative now and then — not only when you ask.">
                    <Toggle checked={s.autoSelfie} onChange={(v) => set('autoSelfie', v)} />
                  </Row>
                )}
                {s.aiPhotos && (
                  <Row label="Photo provider" hint="Local ComfyUI / SD WebUI (free, uncensored) or Pollinations (hosted, needs a token).">
                    <select value={s.imageProvider || 'pollinations'} onChange={(e) => set('imageProvider', e.target.value)} className={inputCls + ' min-w-52'}>
                      <option value="comfy">Local ComfyUI</option>
                      <option value="a1111">Local Stable Diffusion (A1111)</option>
                      <option value="pollinations">Pollinations (hosted + token)</option>
                    </select>
                  </Row>
                )}
                {s.aiPhotos && s.imageProvider === 'comfy' && (
                  <>
                    <Row label="ComfyUI URL" hint="Run ComfyUI with --listen (or default). Usually http://127.0.0.1:8188.">
                      <input value={s.comfyUrl || ''} onChange={(e) => set('comfyUrl', e.target.value)} placeholder="http://127.0.0.1:8188" className={inputCls + ' min-w-52'} />
                    </Row>
                    <Row label="Checkpoint (optional)" hint="Model filename, e.g. dreamshaper_8.safetensors. Blank = first installed.">
                      <input value={s.comfyModel || ''} onChange={(e) => set('comfyModel', e.target.value)} placeholder="(first available)" className={inputCls + ' min-w-52'} />
                    </Row>
                  </>
                )}
                {s.aiPhotos && s.imageProvider === 'a1111' && (
                  <Row label="Stable Diffusion URL" hint="Run Automatic1111 with --api. Default http://127.0.0.1:7860.">
                    <input value={s.sdUrl || ''} onChange={(e) => set('sdUrl', e.target.value)} placeholder="http://127.0.0.1:7860" className={inputCls + ' min-w-52'} />
                  </Row>
                )}
                {s.aiPhotos && (s.imageProvider || 'pollinations') === 'pollinations' && (
                  <Row label="Pollinations token" hint="Free anonymous access is rate-limited. Get a free token at pollinations.ai and paste it here.">
                    <input type="password" value={s.imageToken || ''} onChange={(e) => set('imageToken', e.target.value)} placeholder="token…" className={inputCls + ' min-w-52'} />
                  </Row>
                )}
                {s.aiPhotos && (
                  <Row label="Photo size" hint="Higher = sharper but slower.">
                    <select value={s.photoSize || 768} onChange={(e) => set('photoSize', parseInt(e.target.value, 10))} className={inputCls + ' min-w-40'}>
                      <option value={512}>512 × 512 (fast)</option>
                      <option value={768}>768 × 768</option>
                      <option value={1024}>1024 × 1024 (best)</option>
                    </select>
                  </Row>
                )}
                {ttsSupported() ? (
                  <>
                    <Row label="Speak replies (TTS)" hint="Read each AI reply aloud.">
                      <Toggle checked={s.tts} onChange={(v) => set('tts', v)} />
                    </Row>
                    {s.tts && (
                      <Row label="Default voice" hint="Characters can override this with their own voice in the editor.">
                        <select value={s.ttsVoiceURI} onChange={(e) => set('ttsVoiceURI', e.target.value)} className={inputCls + ' min-w-52'}>
                          <option value="">(Browser default)</option>
                          {groupVoices(voices).map(([label, list]) => (
                            <optgroup key={label} label={label}>
                              {list.map((v) => <option key={v.voiceURI} value={v.voiceURI}>{v.name} ({v.lang})</option>)}
                            </optgroup>
                          ))}
                        </select>
                      </Row>
                    )}
                    {s.tts && (
                      <Row label="Speak dialogue only" hint="Read only the character's quoted speech aloud, skipping *actions* and narration.">
                        <Toggle checked={s.ttsDialogueOnly} onChange={(v) => set('ttsDialogueOnly', v)} />
                      </Row>
                    )}
                    <Row label="Voice call language" hint="Speech recognition language for the 📞 voice call.">
                      <select value={s.sttLang || ''} onChange={(e) => set('sttLang', e.target.value)} className={inputCls + ' min-w-40'}>
                        <option value="">Auto (browser)</option>
                        <option value="en-US">English</option>
                        <option value="ru-RU">Русский</option>
                        <option value="ja-JP">日本語</option>
                        <option value="de-DE">Deutsch</option>
                        <option value="es-ES">Español</option>
                        <option value="fr-FR">Français</option>
                      </select>
                    </Row>
                  </>
                ) : (
                  <p className="py-3 text-sm text-em-text-dim">Text-to-speech isn’t available in this browser.</p>
                )}
              </div>
            )}

            {tab === 'appearance' && (
              <div>
                {/* Live preview */}
                <div className="mb-3 sticky top-0 z-10 -mx-5 -mt-5 bg-em-panel/80 px-5 pb-3 pt-5 backdrop-blur">
                  <div className="mb-1.5 flex items-center justify-between">
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-em-text-dim">Preview</span>
                    <button
                      onClick={() => { const d = DEFAULT_SETTINGS; APPEARANCE_KEYS.forEach((k) => set(k, d[k])); }}
                      className="inline-flex items-center gap-1 rounded-lg border border-white/10 px-2 py-1 text-[11px] text-em-text-dim transition hover:border-em-accent/40 hover:text-em-text"
                    >
                      <RotateCcw className="h-3 w-3" /> Reset
                    </button>
                  </div>
                  <BubblePreview s={s} />
                </div>

                <Section title="My themes">
                  <input ref={themeFileRef} type="file" accept=".json" className="hidden" onChange={onImportThemes} />
                  {themes.length > 0 && (
                    <div className="flex flex-wrap gap-2 py-2">
                      {themes.map((t) => (
                        <div key={t.id} className="group flex items-center gap-1 rounded-xl border border-white/10 bg-white/[0.03] py-1 pl-3 pr-1 text-sm">
                          <button onClick={() => applyThemeValues(t.values)} className="text-em-text transition hover:text-em-accent">{t.name}</button>
                          <button onClick={() => deleteTheme(t.id)} title="Delete theme" className="grid h-6 w-6 place-items-center rounded text-em-text-dim transition hover:text-red-400"><Trash2 className="h-3.5 w-3.5" /></button>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="flex items-center gap-2 py-2">
                    <input value={themeName} onChange={(e) => setThemeName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') saveCurrentTheme(); }} placeholder="Save current look as…" className={inputCls + ' flex-1'} />
                    <button onClick={saveCurrentTheme} disabled={!themeName.trim()} className="shrink-0 rounded-xl bg-em-accent px-3 py-2 text-sm font-semibold text-em-bg transition enabled:hover:bg-emerald-300 disabled:opacity-40">Save</button>
                  </div>
                  <div className="flex gap-2 py-1">
                    <button onClick={exportThemes} disabled={!themes.length} className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-xs text-em-text-dim transition hover:border-em-accent/40 hover:text-em-text disabled:opacity-40"><Download className="h-3.5 w-3.5" /> Export</button>
                    <button onClick={() => themeFileRef.current && themeFileRef.current.click()} className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-xs text-em-text-dim transition hover:border-em-accent/40 hover:text-em-text"><Upload className="h-3.5 w-3.5" /> Import</button>
                  </div>
                </Section>

                <Section title="Theme presets">
                  <div className="flex flex-wrap gap-2 py-2">
                    {THEME_PRESETS.map((p) => {
                      const a = ACCENTS[p.accent];
                      const active = s.accent === p.accent && s.dialogueColor === p.dialogueColor;
                      return (
                        <button
                          key={p.key}
                          onClick={() => { p.accent && set('accent', p.accent); set('mainTextColor', p.mainTextColor); set('dialogueColor', p.dialogueColor); set('userBubbleColor', p.userBubbleColor); set('aiBubbleColor', p.aiBubbleColor); }}
                          className={'flex items-center gap-2 rounded-xl border px-3 py-2 text-sm transition ' + (active ? 'border-em-accent/60 bg-em-accent/10 text-em-text' : 'border-white/10 text-em-text-dim hover:border-em-accent/40 hover:text-em-text')}
                        >
                          <span className="flex -space-x-1">
                            <span className="h-4 w-4 rounded-full border border-em-bg" style={{ background: a.accent }} />
                            <span className="h-4 w-4 rounded-full border border-em-bg" style={{ background: p.dialogueColor }} />
                          </span>
                          {p.label}
                        </button>
                      );
                    })}
                  </div>
                </Section>

                <Section title="Accent & theme">
                  <Row label="Accent color" hint="Recolors the whole UI.">
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(ACCENTS).map(([key, a]) => (
                        <button key={key} type="button" onClick={() => set('accent', key)} title={a.label}
                          className={'h-7 w-7 rounded-full border-2 transition ' + ((s.accent || 'emerald') === key ? 'border-white scale-110' : 'border-white/20 hover:border-white/50')}
                          style={{ background: a.accent }} />
                      ))}
                    </div>
                  </Row>
                  <Row label="Theme per character" hint="Tint the UI with a colour pulled from the character's avatar while chatting.">
                    <Toggle checked={s.charAccent !== false} onChange={(v) => set('charAccent', v)} />
                  </Row>
                </Section>

                <Section title="Layout & text">
                  <Row label="Message layout" hint="Bubbles, a flat log, or compact.">
                    <select value={s.bubbleLayout || 'bubbles'} onChange={(e) => set('bubbleLayout', e.target.value)} className={inputCls + ' min-w-40'}>
                      <option value="bubbles">Bubbles</option>
                      <option value="flat">Flat (log)</option>
                      <option value="compact">Compact</option>
                    </select>
                  </Row>
                  <Row label="Avatar shape">
                    <select value={s.avatarShape || 'circle'} onChange={(e) => set('avatarShape', e.target.value)} className={inputCls + ' min-w-40'}>
                      <option value="circle">Circle</option>
                      <option value="rounded">Rounded</option>
                      <option value="square">Square</option>
                    </select>
                  </Row>
                  <Row label={`Chat width: ${s.chatWidth || 896}px`} hint="How wide the message column is.">
                    <input type="range" min="640" max="1280" step="16" value={s.chatWidth || 896} onChange={(e) => set('chatWidth', parseInt(e.target.value, 10))} className="w-44 accent-em-accent" />
                  </Row>
                  <Row label={`AI avatar size: ${s.avatarSize || 40}px`} hint="Avatar shown beside each reply.">
                    <input type="range" min="24" max="96" step="2" value={s.avatarSize || 40} onChange={(e) => set('avatarSize', parseInt(e.target.value, 10))} className="w-44 accent-em-accent" />
                  </Row>
                  <Row label={`Font size: ${s.fontSize || 15}px`}>
                    <input type="range" min="11" max="28" step="1" value={s.fontSize || 15} onChange={(e) => set('fontSize', parseInt(e.target.value, 10))} className="w-44 accent-em-accent" />
                  </Row>
                  <Row label={`Message spacing: ${s.messageSpacing || 20}px`}>
                    <input type="range" min="4" max="48" step="2" value={s.messageSpacing || 20} onChange={(e) => set('messageSpacing', parseInt(e.target.value, 10))} className="w-44 accent-em-accent" />
                  </Row>
                  <Row label="Main text color">
                    <input type="color" value={s.mainTextColor || '#e9f5ef'} onChange={(e) => set('mainTextColor', e.target.value)} className="h-8 w-12 cursor-pointer rounded border border-white/10 bg-transparent" />
                  </Row>
                  <Row label="Dialogue color" hint='Colour of "quoted speech".'>
                    <input type="color" value={s.dialogueColor || '#ffd952'} onChange={(e) => set('dialogueColor', e.target.value)} className="h-8 w-12 cursor-pointer rounded border border-white/10 bg-transparent" />
                  </Row>
                </Section>

                <Section title="Message bubbles">
                  <Row label="User bubble" hint={`Opacity ${Math.round((s.userBubbleOpacity != null ? s.userBubbleOpacity : 0.15) * 100)}%`}>
                    <div className="flex items-center gap-2">
                      <input type="color" value={s.userBubbleColor || '#2ee6a0'} onChange={(e) => set('userBubbleColor', e.target.value)} className="h-8 w-12 cursor-pointer rounded border border-white/10 bg-transparent" />
                      <input type="range" min="0" max="1" step="0.05" value={s.userBubbleOpacity != null ? s.userBubbleOpacity : 0.15} onChange={(e) => set('userBubbleOpacity', parseFloat(e.target.value))} className="w-28 accent-em-accent" />
                    </div>
                  </Row>
                  <Row label="AI bubble" hint={`Opacity ${Math.round((s.aiBubbleOpacity != null ? s.aiBubbleOpacity : 0.04) * 100)}%`}>
                    <div className="flex items-center gap-2">
                      <input type="color" value={s.aiBubbleColor || '#ffffff'} onChange={(e) => set('aiBubbleColor', e.target.value)} className="h-8 w-12 cursor-pointer rounded border border-white/10 bg-transparent" />
                      <input type="range" min="0" max="1" step="0.05" value={s.aiBubbleOpacity != null ? s.aiBubbleOpacity : 0.04} onChange={(e) => set('aiBubbleOpacity', parseFloat(e.target.value))} className="w-28 accent-em-accent" />
                    </div>
                  </Row>
                  <Row label={`Bubble blur: ${s.blur || 0}px`}>
                    <input type="range" min="0" max="20" step="1" value={s.blur || 0} onChange={(e) => set('blur', parseInt(e.target.value, 10))} className="w-44 accent-em-accent" />
                  </Row>
                </Section>
              </div>
            )}

            {tab === 'providers' && (
              <div>
                <Row label="API key" hint="Default key for remote models that don't set their own.">
                  <input type="password" value={s.apiKey || ''} onChange={(e) => set('apiKey', e.target.value)} placeholder="sk-or-..." className={inputCls + ' min-w-52'} />
                </Row>
                <div className="space-y-3 py-2">
                  {remoteModels.map((m, i) => (
                    <div key={i} className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
                      <div className="mb-2 flex items-center justify-between">
                        <span className="text-xs font-medium text-em-text-dim">Model #{i + 1}</span>
                        <button onClick={() => removeRemote(i)} className="text-xs text-em-text-dim transition hover:text-red-400" title="Remove">✕ Remove</button>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <input value={m.name || ''} onChange={(e) => setRemote(i, 'name', e.target.value)} placeholder="Display name" className={inputCls} />
                        <input value={m.id || ''} onChange={(e) => setRemote(i, 'id', e.target.value)} placeholder="model id (e.g. z-ai/glm-4.5-air:free)" className={inputCls} />
                        <input value={m.apiUrl || ''} onChange={(e) => setRemote(i, 'apiUrl', e.target.value)} placeholder="API URL" className={inputCls + ' col-span-2'} />
                        <input type="password" value={m.apiKey || ''} onChange={(e) => setRemote(i, 'apiKey', e.target.value)} placeholder="API key (optional — falls back to above)" className={inputCls + ' col-span-2'} />
                        <input type="number" min="512" step="512" value={m.numCtx || ''} onChange={(e) => setRemote(i, 'numCtx', e.target.value)} placeholder="num_ctx (optional)" className={inputCls + ' col-span-2'} />
                      </div>
                    </div>
                  ))}
                  <div className="flex gap-2">
                    <button onClick={() => addRemote(OPENROUTER_URL)} className="rounded-lg border border-em-accent/40 px-3 py-1.5 text-sm text-em-accent transition hover:bg-em-accent/10">＋ OpenRouter model</button>
                    <button onClick={() => addRemote('')} className="rounded-lg border border-white/10 px-3 py-1.5 text-sm text-em-text-dim transition hover:text-em-text">＋ Custom endpoint</button>
                  </div>
                </div>
              </div>
            )}

            {tab === 'memory' && (
              <div className={rows}>
                <Row label="Durable facts memory" hint="Keep a permanent list of stable facts (names, job, life events) the character always remembers — shown in the 💗 inner-life panel.">
                  <Toggle checked={s.factMemory !== false} onChange={(v) => set('factMemory', v)} />
                </Row>
                <Row label="Auto-summarize to memory" hint="Distill old turns into memory automatically.">
                  <Toggle checked={s.autoSummarize} onChange={(v) => set('autoSummarize', v)} />
                </Row>
                {s.autoSummarize && (
                  <Row label={`Summarize every: ${s.autoSummarizeEvery} messages`}>
                    <input type="range" min="10" max="100" step="5" value={s.autoSummarizeEvery} onChange={(e) => set('autoSummarizeEvery', parseInt(e.target.value, 10))} className="w-44 accent-em-accent" />
                  </Row>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-white/10 px-5 py-4">
          <button onClick={onClose} className="rounded-xl border border-white/10 px-4 py-2 text-em-text-dim transition hover:text-em-text">Cancel</button>
          <button onClick={() => onSave(s)} className="rounded-xl bg-em-accent px-5 py-2 font-semibold text-em-bg transition hover:bg-emerald-300">Save</button>
        </div>
      </div>
    </div>
  );
}
