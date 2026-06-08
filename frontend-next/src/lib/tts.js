// Text-to-speech via the browser SpeechSynthesis API (no backend involved).

export function ttsSupported() {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

export function getVoices() {
  if (!ttsSupported()) return [];
  return window.speechSynthesis.getVoices() || [];
}

// Voices load asynchronously in some browsers; fire `cb` whenever they change.
// Returns an unsubscribe function.
export function onVoicesChanged(cb) {
  if (!ttsSupported()) return () => {};
  const handler = () => cb(getVoices());
  window.speechSynthesis.addEventListener('voiceschanged', handler);
  return () => window.speechSynthesis.removeEventListener('voiceschanged', handler);
}

// Strip think blocks, HTML and roleplay markdown so the spoken text is clean.
function plain(text) {
  return String(text || '')
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/[*_`#>]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// "Dialogue only" — speak just the character's quoted speech, skipping *actions*
// and narration, so TTS sounds like the character talking rather than a narrator
// reading prose. Falls back to the full clean text if no quotes are found.
function dialogueOnly(text) {
  const cleaned = String(text || '')
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/\*[^*]*\*/g, ' ')          // drop *action* spans entirely
    .replace(/<[^>]+>/g, '');
  const quotes = cleaned.match(/[""«»"]([^""«»"]+)[""«»"]/g) || [];
  if (!quotes.length) return plain(text);
  const speech = quotes.map((q) => q.replace(/[""«»"]/g, '')).join(' … ');
  return plain(speech);
}

// Currently-playing Kokoro (backend) audio element, so cancelSpeech can stop it.
let _remoteAudio = null;

function stopRemote() {
  if (_remoteAudio) {
    try { _remoteAudio.onended = null; _remoteAudio.pause(); if (_remoteAudio.src) URL.revokeObjectURL(_remoteAudio.src); } catch (e) { /* ignore */ }
    _remoteAudio = null;
  }
}

// Speak via the local Kokoro backend (/api/tts) → natural per-character voices.
// Returns true once playback is kicked off; calls opts.onend when done or on error.
function speakRemote(text, opts) {
  const content = opts.dialogueOnly ? dialogueOnly(text) : plain(text);
  if (!content) return false;
  stopRemote();
  const url = '/api/tts?text=' + encodeURIComponent(content.slice(0, 1800))
    + '&voice=' + encodeURIComponent(opts.voice || 'af_heart')
    + '&speed=' + (opts.speed || 1.0);
  const audio = new Audio();
  _remoteAudio = audio;
  const done = () => { if (_remoteAudio === audio) stopRemote(); if (opts.onend) opts.onend(); };
  fetch(url)
    .then((r) => { if (!r.ok) throw new Error('tts ' + r.status); return r.blob(); })
    .then((blob) => {
      if (_remoteAudio !== audio) return;          // superseded by a newer call
      audio.src = URL.createObjectURL(blob);
      audio.onended = done;
      audio.onerror = done;
      audio.play().catch(done);
    })
    .catch(done);
  return true;
}

export function speak(text, opts = {}) {
  // Local neural voice (Kokoro) when selected; otherwise the browser SpeechSynthesis.
  if (opts.engine === 'kokoro') return speakRemote(text, opts);
  if (!ttsSupported()) return false;
  const content = opts.dialogueOnly ? dialogueOnly(text) : plain(text);
  if (!content) return false;
  try { window.speechSynthesis.cancel(); } catch (e) { /* ignore */ }
  const utter = new SpeechSynthesisUtterance(content);
  if (opts.voice) {
    const v = getVoices().find((x) => x.voiceURI === opts.voice);
    if (v) utter.voice = v;
  }
  if (opts.onend) { utter.onend = opts.onend; utter.onerror = opts.onend; }
  window.speechSynthesis.speak(utter);
  return true;
}

export function cancelSpeech() {
  stopRemote();
  if (ttsSupported()) { try { window.speechSynthesis.cancel(); } catch (e) { /* ignore */ } }
}

// Fetch the Kokoro voice list from the backend (for the editor/settings pickers).
export async function fetchKokoroVoices() {
  try {
    const r = await fetch('/api/tts/voices');
    if (!r.ok) return { available: false, voices: [] };
    return await r.json();
  } catch (e) { return { available: false, voices: [] }; }
}

// Group voices by the languages the legacy app surfaced (English/German/Japanese).
export function groupVoices(voices) {
  const groups = { en: [], de: [], ja: [] };
  (voices || []).forEach((v) => {
    const lang = (v.lang || '').slice(0, 2);
    if (groups[lang]) groups[lang].push(v);
  });
  return [
    ['English', groups.en],
    ['German', groups.de],
    ['Japanese', groups.ja],
  ].filter(([, list]) => list.length);
}
