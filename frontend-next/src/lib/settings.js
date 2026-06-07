// App-level settings for the new UI, persisted in localStorage (independent of
// the legacy app's IndexedDB settings store).
const KEY = 'aria-next-settings';

export const DEFAULT_SETTINGS = {
  model: 'local-qwen',       // '' / 'local-qwen' → backend OLLAMA_MODEL; else exact tag
  temperature: 0.7,
  replyLength: 'default',    // default | short | medium | long | verylong
  style: 'default',          // writing style preset: default | novelistic | concise | dialogue | dramatic
  showThink: true,
  replyOptions: true,        // suggest 2 user replies after each AI turn
  relationship: true,        // living relationship state (affection/trust/tension)
  autonomy: true,            // anti-sycophancy: character has its own will/boundaries
  presence: true,            // living time/presence + proactive "texts first" on return
  offscreenLife: true,       // character "lives" between sessions; colours the return greeting
  aiPhotos: false,           // character can send AI-generated selfies via a [photo: …] tag
  imageProvider: 'pollinations', // 'pollinations' (hosted, token) | 'comfy' (local ComfyUI) | 'a1111' (local SD WebUI)
  imageToken: '',            // pollinations API token (free signup at pollinations.ai)
  sdUrl: 'http://127.0.0.1:7860', // local Automatic1111 base URL
  comfyUrl: 'http://127.0.0.1:8188', // local ComfyUI base URL
  comfyModel: '',            // ComfyUI checkpoint name (blank = first available)
  photoSize: 768,            // generated selfie resolution (square): 512 | 768 | 1024
  tts: false,                // speak AI replies via SpeechSynthesis
  ttsVoiceURI: '',           // chosen voice (empty = browser default)
  sttLang: '',               // voice-call speech-recognition language ('' = browser default)
  autoSummarize: false,
  autoSummarizeEvery: 30,

  // ── Remote models / providers (e.g. OpenRouter). Local Ollama still routes
  // through the backend at /v1 (so RAG/summary fire); remote models POST straight
  // from the browser to their own endpoint with a Bearer key, like the legacy app. ──
  apiKey: '',                // global API key fallback (used when a model has none)
  remoteModels: [],          // [{ id, name, apiUrl, apiKey }] — id is the model tag sent upstream
  suggestionModelId: '',     // '' = same as chat model; else a model id (local or remote)
  summaryModelId: '',        // '' = same as chat model; used for auto-summarize + memory

  // ── Appearance / design (applied as CSS variables, see lib/design.js). ──
  accent: 'emerald',         // accent palette: emerald | violet | rose | amber | cyan | blue
  charAccent: true,          // tint the UI per-chat with a colour pulled from the character avatar
  avatarSize: 40,            // AI speaker avatar beside each reply (px)
  fontSize: 15,              // chat message font size (px)
  messageSpacing: 20,        // vertical gap between messages (px)
  chatWidth: 896,            // max width of the message column (px) — 896 ≈ max-w-4xl
  avatarShape: 'circle',     // message avatar shape: circle | rounded | square
  bubbleLayout: 'bubbles',   // message layout: bubbles | flat | compact
  mainTextColor: '#e9f5ef',  // narration / main text
  dialogueColor: '#ffd952',  // "quoted speech"
  userBubbleColor: '#2ee6a0',
  userBubbleOpacity: 0.15,
  aiBubbleColor: '#ffffff',
  aiBubbleOpacity: 0.04,
  blur: 0,                   // backdrop blur behind message bubbles (px)
};

export const LOCAL_ENDPOINT = '/v1/chat/completions';

// Resolve a model id to a concrete request target. Local ids go through the
// backend (/v1, where RAG/summary/depth fire); a remote model (matched in
// settings.remoteModels) carries its own endpoint URL + API key so the browser
// talks straight to it (e.g. OpenRouter), exactly like the legacy app did.
export function resolveModel(settings, modelId) {
  const id = modelId || (settings && settings.model) || 'local-qwen';
  const remote = ((settings && settings.remoteModels) || []).find((m) => m && m.id === id);
  if (remote && remote.apiUrl) {
    const numCtx = parseInt(remote.numCtx, 10);
    return {
      model: remote.id,
      endpoint: remote.apiUrl,
      apiKey: remote.apiKey || (settings && settings.apiKey) || '',
      numCtx: Number.isFinite(numCtx) && numCtx > 0 ? numCtx : undefined,
    };
  }
  return { model: id, endpoint: LOCAL_ENDPOINT, apiKey: '' };
}

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
