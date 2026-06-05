// App-level settings for the new UI, persisted in localStorage (independent of
// the legacy app's IndexedDB settings store).
const KEY = 'aria-next-settings';

export const DEFAULT_SETTINGS = {
  model: 'local-qwen',       // '' / 'local-qwen' → backend OLLAMA_MODEL; else exact tag
  temperature: 0.7,
  replyLength: 'default',    // default | short | medium | long | verylong
  showThink: true,
  replyOptions: true,        // suggest 2 user replies after each AI turn
  relationship: true,        // living relationship state (affection/trust/tension)
  presence: true,            // living time/presence + proactive "texts first" on return
  offscreenLife: true,       // character "lives" between sessions; colours the return greeting
  tts: false,                // speak AI replies via SpeechSynthesis
  ttsVoiceURI: '',           // chosen voice (empty = browser default)
  autoSummarize: false,
  autoSummarizeEvery: 30,
};

export function loadSettings() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch (e) {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(s) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) { /* ignore */ }
}

// Downloaded Ollama models, from the backend health endpoint.
export async function fetchAvailableModels() {
  try {
    const r = await fetch('/api/health');
    if (!r.ok) return [];
    const j = await r.json();
    return Array.isArray(j.available_models) ? j.available_models : [];
  } catch (e) {
    return [];
  }
}
