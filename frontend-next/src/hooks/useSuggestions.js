import { useRef, useState } from 'react';
import { suggestReplies, suggestStoryChoices } from '../lib/chat.js';
import { resolveModel } from '../lib/settings.js';

// Suggested-reply state: quick user replies (2 chips) OR, when "Story choices"
// (Mini-Theater) is on, 3-4 branching action choices generated after an AI turn.
// Stale requests are invalidated by id so only the latest result lands.
export default function useSuggestions(settings) {
  const [suggestions, setSuggestions] = useState([]);
  const [suggesting, setSuggesting] = useState(false);
  const [choiceMode, setChoiceMode] = useState(false); // true → render as story choices
  const reqRef = useRef(0);

  function clear() {
    reqRef.current++;                 // invalidate any in-flight request
    setSuggestions([]);
    setSuggesting(false);
  }

  async function generate(char, chat, personas) {
    const story = !!settings.storyChoices;
    if ((!settings.replyOptions && !story) || !chat) return;
    const reqId = ++reqRef.current;
    setChoiceMode(story);
    setSuggestions([]);
    setSuggesting(true);
    try {
      const model = resolveModel(settings, settings.suggestionModelId || settings.model);
      const opts = story
        ? await suggestStoryChoices(char, chat, personas, model)
        : await suggestReplies(char, chat, personas, model);
      if (reqId !== reqRef.current) return;
      setSuggestions(opts || []);
    } catch (e) {
      if (reqId !== reqRef.current) return;
      setSuggestions([]);
    } finally {
      if (reqId === reqRef.current) setSuggesting(false);
    }
  }

  return { suggestions, suggesting, choiceMode, generate, clear };
}
