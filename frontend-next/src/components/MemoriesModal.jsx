import { useState } from 'react';
import { summarizeChat } from '../lib/chat.js';

export default function MemoriesModal({ char, chat, personas, onSave, onClose }) {
  const [text, setText] = useState(chat.memories || '');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function summarize() {
    setBusy(true);
    setErr('');
    try {
      const bullets = await summarizeChat(char, chat, personas);
      if (bullets && bullets.trim()) {
        const header = '--- Summary (' + new Date().toLocaleDateString() + ') ---\n';
        setText((prev) => (prev.trim() ? prev.trim() + '\n\n' : '') + header + bullets.trim());
      } else {
        setErr('Nothing to summarize yet.');
      }
    } catch (e) {
      setErr('Summarize failed: ' + String(e.message || e).slice(0, 120));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="w-full max-w-xl rounded-3xl glass-panel p-6 shadow-2xl">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-xl font-bold">🧠 Chat Memories</h2>
          <button onClick={onClose} className="rounded-lg px-3 py-1.5 text-em-text-dim transition hover:text-em-text">✕</button>
        </div>
        <p className="mb-3 text-sm text-em-text-dim">High-priority notes for this chat. They are sent with every request.</p>
        <button onClick={summarize} disabled={busy} className="mb-3 w-full rounded-xl border border-em-accent/40 bg-em-accent/10 py-2 font-semibold text-em-accent transition enabled:hover:bg-em-accent/20 disabled:opacity-50">
          {busy ? 'Summarizing…' : '✨ Summarize chat into memory'}
        </button>
        {err && <p className="mb-2 text-sm text-red-400">{err}</p>}
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={10}
          placeholder="- Key facts the character should always remember…"
          className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-em-text placeholder:text-em-text-dim/60 focus:border-em-accent/50 focus:outline-none"
        />
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-xl border border-white/10 px-4 py-2 text-em-text-dim transition hover:text-em-text">Cancel</button>
          <button onClick={() => onSave(text)} className="rounded-xl bg-em-accent px-5 py-2 font-semibold text-em-bg transition hover:bg-emerald-300">Save</button>
        </div>
      </div>
    </div>
  );
}
