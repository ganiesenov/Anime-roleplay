import { useEffect, useState } from 'react';
import { fetchAvailableModels } from '../lib/settings.js';
import { ttsSupported, getVoices, onVoicesChanged, groupVoices } from '../lib/tts.js';

const inputCls = 'w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-em-text focus:border-em-accent/50 focus:outline-none';
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

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

function Section({ title, children }) {
  return (
    <div className="py-2">
      <h3 className="mb-1 mt-2 text-xs font-bold uppercase tracking-wide text-em-accent/80">{title}</h3>
      <div className="divide-y divide-white/5">{children}</div>
    </div>
  );
}

export default function SettingsModal({ settings, onSave, onClose }) {
  const [s, setS] = useState(settings);
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

  // Options shared by the chat/suggestion/summary model pickers.
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="flex max-h-[90vh] w-full max-w-lg flex-col rounded-3xl border border-white/10 bg-em-panel/95 p-6 shadow-2xl">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-xl font-bold">⚙ Settings</h2>
          <button onClick={onClose} className="rounded-lg px-3 py-1.5 text-em-text-dim transition hover:text-em-text">✕</button>
        </div>

        <div className="-mr-2 overflow-y-auto pr-2">
          <Section title="Models">
            <Row label="Chat model" hint="Local Ollama routes through the backend; remote models call their own endpoint.">
              <select value={s.model} onChange={(e) => set('model', e.target.value)} className={inputCls + ' min-w-52'}>
                <ModelOptions withInherit={false} />
              </select>
            </Row>
            <Row label="Suggestion model" hint="Model for reply suggestions.">
              <select value={s.suggestionModelId || ''} onChange={(e) => set('suggestionModelId', e.target.value)} className={inputCls + ' min-w-52'}>
                <ModelOptions withInherit />
              </select>
            </Row>
            <Row label="Summary model" hint="Model for auto-summarize / memory.">
              <select value={s.summaryModelId || ''} onChange={(e) => set('summaryModelId', e.target.value)} className={inputCls + ' min-w-52'}>
                <ModelOptions withInherit />
              </select>
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
            <Row label="Show think blocks" hint="Display the model's reasoning.">
              <input type="checkbox" checked={s.showThink} onChange={(e) => set('showThink', e.target.checked)} className="h-5 w-5 accent-em-accent" />
            </Row>
          </Section>

          <Section title="Remote models (OpenRouter, etc.)">
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
                  </div>
                </div>
              ))}
              <div className="flex gap-2">
                <button onClick={() => addRemote(OPENROUTER_URL)} className="rounded-lg border border-em-accent/40 px-3 py-1.5 text-sm text-em-accent transition hover:bg-em-accent/10">＋ OpenRouter model</button>
                <button onClick={() => addRemote('')} className="rounded-lg border border-white/10 px-3 py-1.5 text-sm text-em-text-dim transition hover:text-em-text">＋ Custom endpoint</button>
              </div>
            </div>
          </Section>

          <Section title="Behavior">
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
            {ttsSupported() && (
              <Row label="Speak replies (TTS)" hint="Read each AI reply aloud.">
                <input type="checkbox" checked={s.tts} onChange={(e) => set('tts', e.target.checked)} className="h-5 w-5 accent-em-accent" />
              </Row>
            )}
            {ttsSupported() && s.tts && (
              <Row label="Voice">
                <select value={s.ttsVoiceURI} onChange={(e) => set('ttsVoiceURI', e.target.value)} className={inputCls + ' min-w-52'}>
                  <option value="">(Default voice)</option>
                  {groupVoices(voices).map(([label, list]) => (
                    <optgroup key={label} label={label}>
                      {list.map((v) => <option key={v.voiceURI} value={v.voiceURI}>{v.name} ({v.lang})</option>)}
                    </optgroup>
                  ))}
                </select>
              </Row>
            )}
          </Section>

          <Section title="Appearance">
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
          </Section>

          <Section title="Memory">
            <Row label="Auto-summarize to memory" hint="Distill old turns into memory automatically.">
              <input type="checkbox" checked={s.autoSummarize} onChange={(e) => set('autoSummarize', e.target.checked)} className="h-5 w-5 accent-em-accent" />
            </Row>
            {s.autoSummarize && (
              <Row label={`Summarize every: ${s.autoSummarizeEvery} messages`}>
                <input type="range" min="10" max="100" step="5" value={s.autoSummarizeEvery} onChange={(e) => set('autoSummarizeEvery', parseInt(e.target.value, 10))} className="w-44 accent-em-accent" />
              </Row>
            )}
          </Section>
        </div>

        <div className="mt-4 flex justify-end gap-2 border-t border-white/10 pt-4">
          <button onClick={onClose} className="rounded-xl border border-white/10 px-4 py-2 text-em-text-dim transition hover:text-em-text">Cancel</button>
          <button onClick={() => onSave(s)} className="rounded-xl bg-em-accent px-5 py-2 font-semibold text-em-bg transition hover:bg-emerald-300">Save</button>
        </div>
      </div>
    </div>
  );
}
