import { useEffect, useState } from 'react';
import { speak, cancelSpeech } from '../lib/tts.js';
import { getMessageText } from '../lib/chat.js';

// Text-to-speech state for the chat: which message is currently being read, and
// helpers to toggle / auto-speak / stop. The caller resolves the voice (so a
// character's own voice can win over the global default).
export default function useTts() {
  const [speakingId, setSpeakingId] = useState(null);

  // Stop any speech when the chat view unmounts.
  useEffect(() => () => cancelSpeech(), []);

  // Click a message's speaker button: start it, or stop if it's already playing.
  function toggle(msg, voiceURI) {
    if (speakingId === msg.id) { cancelSpeech(); setSpeakingId(null); return; }
    const ok = speak(getMessageText(msg), { voiceURI, onend: () => setSpeakingId(null) });
    setSpeakingId(ok ? msg.id : null);
  }

  // Read a freshly finished reply aloud (auto-speak setting).
  function autoSpeak(msg, voiceURI) {
    const ok = speak(getMessageText(msg), { voiceURI, onend: () => setSpeakingId(null) });
    if (ok) setSpeakingId(msg.id);
  }

  function stop() { cancelSpeech(); setSpeakingId(null); }

  return { speakingId, toggle, autoSpeak, stop };
}
