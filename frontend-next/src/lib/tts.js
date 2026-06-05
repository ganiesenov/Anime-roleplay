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

export function speak(text, opts = {}) {
  if (!ttsSupported()) return false;
  const content = plain(text);
  if (!content) return false;
  try { window.speechSynthesis.cancel(); } catch (e) { /* ignore */ }
  const utter = new SpeechSynthesisUtterance(content);
  if (opts.voiceURI) {
    const v = getVoices().find((x) => x.voiceURI === opts.voiceURI);
    if (v) utter.voice = v;
  }
  if (opts.onend) { utter.onend = opts.onend; utter.onerror = opts.onend; }
  window.speechSynthesis.speak(utter);
  return true;
}

export function cancelSpeech() {
  if (ttsSupported()) { try { window.speechSynthesis.cancel(); } catch (e) { /* ignore */ } }
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
