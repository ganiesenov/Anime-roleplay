import { useEffect, useState } from 'react';
import { fetchAvailableModels } from '../lib/settings.js';
import { ACCENTS } from '../lib/design.js';
import { ttsSupported, getVoices, onVoicesChanged, groupVoices } from '../lib/tts.js';

const inputCls = 'w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-em-text focus:border-em-accent/50 focus:outline-none';
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

const TABS = [
  { key: 'model', icon: '🧠', label: 'Model' },
  { key: 'roleplay', icon: '🎭', label: 'Roleplay' },
  { key: 'media', icon: '🎬', label: 'Photos & Voice' },
  { key: 'appearance', icon: '🎨', label: 'Appearance' },
  { key: 'providers', icon: '🔌', label: 'Providers' },
  { key: 'memory', icon: '🧩', label: 'Memory' },
];

function Row({ label, hint, children }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2">
      <div>
        <div className="text-sm font-medium text-em-text">{label}</div>
        {hint && <div className="text-xs text-em-text-dim">{hint}</div>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

export default function SettingsModal({ settings, onSave, onClose }) {
  const [s, setS] = useState(settings);
  const [tab, setTab] = useState('model');
  const [models, setModels] = useState([]);
  const [voices, setVoices] = useState([]);
  const set = (k, v) => setS((prev) => ({ ...prev, [k]: v }));

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
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-3xl glass-panel p-5 shadow-2xl">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-xl font-bold">⚙ Settings</h2>
          <button onClick={onClose} className="rounded-lg px-3 py-1.5 text-em-text-dim transition hover:text-em-text">✕</button>
        </div>

        <div className="flex min-h-0 flex-1 gap-3">
          {/* Section rail */}
          <nav className="flex w-28 shrink-0 flex-col gap-1 overflow-y-auto sm:w-36">
            {TABS.map((t) => {
              const active = tab === t.key;
              return (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className={
                    'flex items-center gap-2 rounded-xl px-2.5 py-2 text-left text-sm transition ' +
                    (active ? 'bg-em-accent/15 font-semibold text-em-accent' : 'text-em-text-dim hover:bg-white/5 hover:text-em-text')
                  }
                >
                  <span className="text-base">{t.icon}</span>
                  <span className="truncate">{t.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Active section */}
          <div className="-mr-2 min-w-0 flex-1 overflow-y-auto pr-2">
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
                  <input type="checkbox" checked={s.showThink} onChange={(e) => set('showThink', e.target.checked)} className="h-5 w-5 accent-em-accent" />
                </Row>
              </div>
            )}

            {tab === 'roleplay' && (
              <div className={rows}>
                <Row label="Suggest replies" hint="Offer 2 quick user replies after each AI turn.">
                  <input type="checkbox" checked={s.replyOptions} onChange={(e) => set('replyOptions', e.target.checked)} className="h-5 w-5 accent-em-accent" />
                </Row>
                <Row label="Living relationship" hint="Character tracks affection / trust / tension and acts on it over time.">
                  <input type="checkbox" checked={s.relationship} onChange={(e) => set('relationship', e.target.checked)} className="h-5 w-5 accent-em-accent" />
                </Row>
                <Row label="Autonomy (no people-pleasing)" hint="Character keeps its own will, opinions and boundaries instead of mirroring you.">
                  <input type="checkbox" checked={s.autonomy} onChange={(e) => set('autonomy', e.target.checked)} className="h-5 w-5 accent-em-accent" />
                </Row>
                <Row label="Living presence" hint="Time-of-day awareness, a sleep schedule, and proactive messages when you return.">
                  <input type="checkbox" checked={s.presence} onChange={(e) => set('presence', e.target.checked)} className="h-5 w-5 accent-em-accent" />
                </Row>
                <Row label="Off-screen life" hint="Character lives their own day while you're away; it colours how they greet you back.">
                  <input type="checkbox" checked={s.offscreenLife} onChange={(e) => set('offscreenLife', e.target.checked)} className="h-5 w-5 accent-em-accent" />
                </Row>
              </div>
            )}

            {tab === 'media' && (
              <div className={rows}>
                <Row label="AI photos" hint="Character can send AI-generated selfies when it fits. Set a per-character Appearance for better likeness.">
                  <input type="checkbox" checked={s.aiPhotos} onChange={(e) => set('aiPhotos', e.target.checked)} className="h-5 w-5 accent-em-accent" />
                </Row>
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
                      <input type="checkbox" checked={s.tts} onChange={(e) => set('tts', e.target.checked)} className="h-5 w-5 accent-em-accent" />
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
              <div className={rows}>
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
                  <input type="checkbox" checked={s.charAccent !== false} onChange={(e) => set('charAccent', e.target.checked)} className="h-5 w-5 accent-em-accent" />
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
                <Row label="Auto-summarize to memory" hint="Distill old turns into memory automatically.">
                  <input type="checkbox" checked={s.autoSummarize} onChange={(e) => set('autoSummarize', e.target.checked)} className="h-5 w-5 accent-em-accent" />
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

        <div className="mt-4 flex justify-end gap-2 border-t border-white/10 pt-4">
          <button onClick={onClose} className="rounded-xl border border-white/10 px-4 py-2 text-em-text-dim transition hover:text-em-text">Cancel</button>
          <button onClick={() => onSave(s)} className="rounded-xl bg-em-accent px-5 py-2 font-semibold text-em-bg transition hover:bg-emerald-300">Save</button>
        </div>
      </div>
    </div>
  );
}
