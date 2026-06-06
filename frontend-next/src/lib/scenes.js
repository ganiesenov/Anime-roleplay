// Scenes — reusable roleplay situations (Character.AI-style). Each scene is a
// setup + optional art; you "play" it by picking any character, which spins up a
// fresh chat seeded with the scene's opening. Stored in localStorage (no DB
// migration); the launched chat is a normal chat record so the rest of the app
// (streaming, history, RAG) works unchanged.

import { genId, displayName, expandPlaceholders } from './chat.js';

const KEY = 'aria-next-scenes';

const DEFAULT_SCENES = [
  {
    id: 'scene-seed-1',
    title: 'First day at the academy',
    tags: 'school, slice of life',
    image: '',
    setup: 'The morning bell echoes across the courtyard as {{user}} steps through the academy gates for the first time. {{char}} is leaning against the old cherry tree, watching the newcomer with mild curiosity. "You\'re new here, aren\'t you?"',
  },
  {
    id: 'scene-seed-2',
    title: 'Stranded after the storm',
    tags: 'survival, drama',
    image: '',
    setup: 'The wreck still smolders on the black-sand beach. {{user}} and {{char}} are the only two who made it ashore. Night is coming, the jungle hums behind them, and {{char}} turns, jaw set. "We need shelter before dark. Can you walk?"',
  },
  {
    id: 'scene-seed-3',
    title: 'Late-night rooftop',
    tags: 'romance, quiet',
    image: '',
    setup: 'City lights spill out below. {{char}} found {{user}} alone on the rooftop, two cans of coffee in hand. They sit down without a word, then offer one over. "Couldn\'t sleep either, huh?"',
  },
];

export function loadScenes() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULT_SCENES.slice();
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : DEFAULT_SCENES.slice();
  } catch (e) {
    return DEFAULT_SCENES.slice();
  }
}

export function saveScenes(scenes) {
  try { localStorage.setItem(KEY, JSON.stringify(scenes || [])); } catch (e) { /* ignore */ }
}

export function newSceneId() {
  return 'scene-' + Date.now();
}

// Build a normal chat record for `char` opened on `scene` (highest timestamp so
// ChatView auto-selects it). The scene art rides on the chat as a per-chat backdrop.
export function buildSceneChat(char, scene) {
  const setup = (scene && scene.setup) || '';
  const history = [];
  if (setup.trim()) {
    history.push({
      id: genId(true), sender: 'ai', type: 'dialog', speakerId: char.id, activeVariant: 0,
      variations: [{ main: expandPlaceholders(setup, displayName(char), 'User'), think: null }],
    });
  }
  return {
    id: 'chat-' + Date.now(),
    name: (scene && scene.title) || 'Scene',
    history,
    memories: '',
    participants: [char.id],
    activePersonaId: null,
    mood: null,
    background: (scene && scene.image) || '',  // per-chat backdrop (ChatView falls back to char.background)
    sceneTitle: (scene && scene.title) || '',
  };
}
