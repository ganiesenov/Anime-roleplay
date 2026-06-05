import { useEffect, useState } from 'react';
import { fetchAvailableModels } from '../lib/settings.js';
import { ttsSupported, getVoices, onVoicesChanged, groupVoices } from '../lib/tts.js';

const inputCls = 'w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-em-text focus:border-em-accent/50 focus:outline-none';

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
  const [models, setModels] = useState([]);
  const [voices, setVoices] = useState([]);
  const set = (k, v) => setS((prev) => ({ ...prev, [k]: v }));

  useEffect(() => { fetchAvailableModels().then(setModels); }, []);
  useEffect(() => {
    if (!ttsSupported()) return undefined;
    setVoices(getVoices());
    return onVoicesChanged(setVoices);
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-3xl border border-white/10 bg-em-panel/95 p-6 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-bold">⚙ Settings</h2>
          <button onClick={onClose} className="rounded-lg px-3 py-1.5 text-em-text-dim transition hover:text-em-text">✕</button>
        </div>

        <div className="divide-y divide-white/5">
          <Row label="Chat model" hint="Local Ollama model for replies.">
            <select value={s.model} onChange={(e) => set('model', e.target.value)} className={inputCls + ' min-w-52'}>
              <option value="local-qwen">Default (backend)</option>
              {models.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </Row>

          <Row label={`Temperature: ${Number(s.temperature).toFixed(2)}`} hint="Higher = more creative.">
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

          <Row label="Suggest replies" hint="Offer 2 quick user replies after each AI turn.">
            <input type="checkbox" checked={s.replyOptions} onChange={(e) => set('replyOptions', e.target.checked)} className="h-5 w-5 accent-em-accent" />
          </Row>

          <Row label="Living relationship" hint="Character tracks affection / trust / tension and acts on it over time.">
            <input type="checkbox" checked={s.relationship} onChange={(e) => set('relationship', e.target.checked)} className="h-5 w-5 accent-em-accent" />
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

          <Row label="Auto-summarize to memory" hint="Distill old turns into memory automatically.">
            <input type="checkbox" checked={s.autoSummarize} onChange={(e) => set('autoSummarize', e.target.checked)} className="h-5 w-5 accent-em-accent" />
          </Row>

          {s.autoSummarize && (
            <Row label={`Summarize every: ${s.autoSummarizeEvery} messages`}>
              <input type="range" min="10" max="100" step="5" value={s.autoSummarizeEvery} onChange={(e) => set('autoSummarizeEvery', parseInt(e.target.value, 10))} className="w-44 accent-em-accent" />
            </Row>
          )}
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-xl border border-white/10 px-4 py-2 text-em-text-dim transition hover:text-em-text">Cancel</button>
          <button onClick={() => onSave(s)} className="rounded-xl bg-em-accent px-5 py-2 font-semibold text-em-bg transition hover:bg-emerald-300">Save</button>
        </div>
      </div>
    </div>
  );
}
