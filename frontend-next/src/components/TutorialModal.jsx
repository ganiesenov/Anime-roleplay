import { useState } from 'react';

export const TUTORIAL_FLAG = 'ariaNextTutorialSeen';

const STEPS = [
  {
    icon: '🪐',
    title: 'Welcome to Aria',
    body: 'A local-first AI roleplay chat. Everything — characters, chats, settings — lives in your browser. Pick a character below and start a story.',
  },
  {
    icon: '🔎',
    title: 'Browse & find',
    body: 'Use the category pills and search to filter the library. Tap the ☆ on a card to favorite it — favorites get their own shelf up top.',
  },
  {
    icon: '✨',
    title: 'Create your own',
    body: 'Hit “+ Create” to make a character. Stuck? Type a concept and let “Generate with AI” fill in the description, tags and greeting for you.',
  },
  {
    icon: '💬',
    title: 'Living chats',
    body: 'Swipe between reply variations, regenerate, continue, edit or branch any message. Characters track a relationship, live their own off-screen day and can text you first.',
  },
  {
    icon: '🎛️',
    title: 'Make it yours',
    body: 'In ⚙ Settings: pick a model (local Ollama or OpenRouter), tune temperature & reply length, and restyle the chat — fonts, colours, bubbles, avatars. Per-character you also get music 🎵, ambient effects ✨ and a scene background.',
  },
];

export default function TutorialModal({ onClose }) {
  const [i, setI] = useState(0);
  const step = STEPS[i];
  const last = i === STEPS.length - 1;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-3xl border border-em-accent/25 bg-em-panel/95 p-7 text-center shadow-2xl shadow-black/60">
        <div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-2xl bg-em-accent/10 text-4xl">{step.icon}</div>
        <h2 className="mb-2 text-xl font-bold text-em-text">{step.title}</h2>
        <p className="mx-auto max-w-sm text-sm leading-relaxed text-em-text-dim">{step.body}</p>

        <div className="mt-5 flex items-center justify-center gap-1.5">
          {STEPS.map((_, j) => (
            <span key={j} className={'h-1.5 rounded-full transition-all ' + (j === i ? 'w-5 bg-em-accent' : 'w-1.5 bg-white/15')} />
          ))}
        </div>

        <div className="mt-6 flex items-center justify-between gap-2">
          <button onClick={onClose} className="rounded-xl px-3 py-2 text-sm text-em-text-dim transition hover:text-em-text">Skip</button>
          <div className="flex gap-2">
            {i > 0 && <button onClick={() => setI(i - 1)} className="rounded-xl border border-white/10 px-4 py-2 text-sm text-em-text-dim transition hover:text-em-text">Back</button>}
            <button
              onClick={() => (last ? onClose() : setI(i + 1))}
              className="rounded-xl bg-em-accent px-5 py-2 text-sm font-semibold text-em-bg transition hover:bg-emerald-300"
            >
              {last ? "Let's go" : 'Next'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
