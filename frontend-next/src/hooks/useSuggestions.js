import { useRef, useState } from 'react';
import { suggestReplies } from '../lib/chat.js';
import { resolveModel } from '../lib/settings.js';

// Suggested-reply state: two quick user replies generated after an AI turn.
// Stale requests are invalidated by id so only the latest result lands.
export default function useSuggestions(settings) {
  const [suggestions, setSuggestions] = useState([]);
  const [suggesting, setSuggesting] = useState(false);
  const reqRef = useRef(0);

  function clear() {
    reqRef.current++;                 // invalidate any in-flight request
    setSuggestions([]);
    setSuggesting(false);
  }

  async function generate(char, chat, personas) {
    if (!settings.replyOptions || !chat) return;
    const reqId = ++reqRef.current;
    setSuggestions([]);
    setSuggesting(true);
    try {
      const opts = await suggestReplies(char, chat, personas, resolveModel(settings, settings.suggestionModelId || settings.model));
      if (reqId !== reqRef.current) return;
      setSuggestions(opts || []);
    } catch (e) {
      if (reqId !== reqRef.current) return;
      setSuggestions([]);
    } finally {
      if (reqId === reqRef.current) setSuggesting(false);
    }
  }

  return { suggestions, suggesting, generate, clear };
}
