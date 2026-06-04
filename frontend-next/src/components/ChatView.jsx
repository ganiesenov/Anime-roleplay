import { useEffect, useMemo, useRef, useState } from 'react';
import { saveCharacter, getAllPersonas, savePersona } from '../lib/db.js';
import MemoriesModal from './MemoriesModal.jsx';
import {
  genId, displayName, getMessageText, getMessageThink, expandPlaceholders,
  buildMessagesArray, streamCompletion, splitThink, summarizeChat,
} from '../lib/chat.js';
import { DEFAULT_SETTINGS } from '../lib/settings.js';
import { renderStreaming, renderFinal, escapeHtml } from '../lib/format.js';

function avatarUrl(url) {
  if (!url) return '';
  if (/^https?:\/\//i.test(url)) return '/api/img?url=' + encodeURIComponent(url);
  return url;
}

function newChat(char) {
  const greeting = (char.scenarios && char.scenarios[0] && char.scenarios[0].text) || char.first_mes || '';
  const history = [];
  if (greeting) {
    history.push({
      id: genId(true), sender: 'ai', type: 'dialog', speakerId: char.id, activeVariant: 0,
      variations: [{ main: expandPlaceholders(greeting, displayName(char), 'User'), think: null }],
    });
  }
  return { id: 'chat-' + Date.now(), name: 'Chat ' + new Date().toLocaleString(), history, memories: '', participants: [char.id], activePersonaId: null, mood: null };
}

export default function ChatView({ character, onBack, onEdit, settings = DEFAULT_SETTINGS }) {
  const [char, setChar] = useState(character);
  const [personas, setPersonas] = useState({});
  const [chatId, setChatId] = useState(null);
  const [streaming, setStreaming] = useState(false);
  const [input, setInput] = useState('');
  const [showMemories, setShowMemories] = useState(false);
  const [, force] = useState(0);          // re-render trigger for in-place mutations
  const rerender = () => force((n) => n + 1);
  const controllerRef = useRef(null);
  const scrollRef = useRef(null);
  const autoScroll = useRef(true);
  const autoSumRef = useRef(false);

  const chats = char.chats || (char.chats = {});

  // Reflect edits made via the editor (parent passes a refreshed character).
  useEffect(() => { setChar(character); }, [character]);

  // Pick most-recent existing chat, or create one.
  useEffect(() => {
    getAllPersonas().then((ps) => {
      const map = {};
      ps.forEach((p) => { if (p && p.id) map[p.id] = p; });
      setPersonas(map);
    });
    const ids = Object.keys(chats);
    if (ids.length) {
      ids.sort((a, b) => parseInt(b.replace('chat-', ''), 10) - parseInt(a.replace('chat-', ''), 10));
      setChatId(ids[0]);
    } else {
      const c = newChat(char);
      chats[c.id] = c;
      setChatId(c.id);
      saveCharacter(char);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const chat = chatId ? chats[chatId] : null;

  useEffect(() => {
    if (autoScroll.current && scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  });

  function onScroll() {
    const el = scrollRef.current;
    if (!el) return;
    autoScroll.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  }

  function startNewChat() {
    const c = newChat(char);
    chats[c.id] = c;
    setChatId(c.id);
    saveCharacter(char);
  }

  async function runStream(aiMsg, lastUserText) {
    const variantIndex = aiMsg.streamingVariant != null ? aiMsg.streamingVariant : aiMsg.activeVariant;
    const controller = new AbortController();
    controllerRef.current = controller;
    setStreaming(true);
    let mainAcc = '';
    let reasonAcc = '';
    let rafPending = false;
    let finished = false;

    const apply = () => {
      const split = splitThink(mainAcc);
      const v = aiMsg.variations[variantIndex];
      if (v) { v.main = split.main != null ? split.main : mainAcc; v.think = (split.think || reasonAcc) || null; }
      rerender();
    };
    const schedule = () => {
      if (rafPending || finished) return;
      rafPending = true;
      requestAnimationFrame(() => { rafPending = false; if (!finished) apply(); });
    };

    try {
      await streamCompletion(buildMessagesArray(char, chat, personas, lastUserText, { replyLength: settings.replyLength }), {
        signal: controller.signal,
        characterId: char.id,
        chatId: chat.id,
        model: settings.model,
        temperature: settings.temperature,
        onContent: (c) => { mainAcc += c; schedule(); },
        onReasoning: (r) => { reasonAcc += r; schedule(); },
      });
    } catch (err) {
      if (!controller.signal.aborted) {
        const v = aiMsg.variations[variantIndex];
        if (v && !v.main) v.main = '[--- ERROR: ' + String(err.message || err).slice(0, 160) + ' ---]';
      }
    } finally {
      finished = true;
      const split = splitThink(mainAcc);
      const v = aiMsg.variations[variantIndex];
      if (v && mainAcc) { v.main = split.main != null ? split.main : mainAcc; v.think = (split.think || reasonAcc) || null; }
      aiMsg.isStreaming = false;
      aiMsg.streamingVariant = null;
      aiMsg.activeVariant = variantIndex;
      controllerRef.current = null;
      setStreaming(false);
      await saveCharacter(char);
      rerender();
      if (mainAcc) maybeAutoSummarize();
    }
  }

  // Opt-in: distill old turns into chat.memories once the chat grows by N msgs.
  // Fire-and-forget; one at a time; preempted by nothing (runs after a reply).
  async function maybeAutoSummarize() {
    if (!settings.autoSummarize || !chat || autoSumRef.current) return;
    const every = Math.max(10, parseInt(settings.autoSummarizeEvery, 10) || 30);
    const len = chat.history.length;
    const prev = chat._lastAutoSummaryLen || 0;
    if (len - prev < every) return;
    autoSumRef.current = true;
    chat._lastAutoSummaryLen = len;
    try {
      const bullets = await summarizeChat(char, chat, personas);
      if (bullets && bullets.trim()) {
        const header = '--- Auto-summary (' + new Date().toLocaleDateString() + ') ---\n';
        chat.memories = (chat.memories || '').trim();
        chat.memories = (chat.memories ? chat.memories + '\n\n' : '') + header + bullets.trim();
        await saveCharacter(char);
        rerender();
      } else {
        chat._lastAutoSummaryLen = prev;
      }
    } catch (e) {
      chat._lastAutoSummaryLen = prev;
    } finally {
      autoSumRef.current = false;
    }
  }

  async function send() {
    const text = input.trim();
    if (!text || streaming || !chat) return;
    setInput('');
    autoScroll.current = true;
    chat.history.push({ id: genId(), sender: 'user', main: text });
    const aiMsg = {
      id: genId(), sender: 'ai', type: 'dialog', speakerId: char.id,
      activeVariant: 0, variations: [{ main: '', think: null }], isStreaming: true, streamingVariant: 0,
    };
    chat.history.push(aiMsg);
    rerender();
    await runStream(aiMsg, text);
  }

  async function regenerate(msg) {
    if (streaming) return;
    msg.variations.push({ main: '', think: null });
    msg.activeVariant = msg.variations.length - 1;
    msg.streamingVariant = msg.activeVariant;
    msg.isStreaming = true;
    // last preceding user turn
    const idx = chat.history.indexOf(msg);
    const prior = chat.history.slice(0, idx);
    const lastUser = [...prior].reverse().find((m) => m.sender === 'user');
    const lastUserText = lastUser ? getMessageText(lastUser) : 'Continue the roleplay.';
    const saved = chat.history;
    chat.history = prior;
    rerender();
    await runStream(msg, lastUserText);
    chat.history = saved;
    rerender();
  }

  function swipe(msg, dir) {
    const n = msg.variations.length;
    msg.activeVariant = (msg.activeVariant + dir + n) % n;
    saveCharacter(char);
    rerender();
  }

  function stop() {
    if (controllerRef.current) { try { controllerRef.current.abort(); } catch (e) { /* ignore */ } }
  }

  function setMood(v) { chat.mood = v || null; saveCharacter(char); rerender(); }
  function setPersona(id) { chat.activePersonaId = id || null; saveCharacter(char); rerender(); }
  function saveMemories(text) { chat.memories = text; setShowMemories(false); saveCharacter(char); rerender(); }

  async function createPersona() {
    const name = window.prompt('New persona name (this is who YOU are in the chat):');
    if (!name || !name.trim()) return;
    const p = { id: 'persona-' + Date.now(), name: name.trim(), description: '' };
    await savePersona(p);
    setPersonas((prev) => ({ ...prev, [p.id]: p }));
    setPersona(p.id);
  }

  const MOODS = ['happy', 'sad', 'angry', 'flirty', 'scared', 'calm', 'excited', 'nervous'];

  const history = chat ? chat.history : [];

  return (
    <div className="flex h-screen flex-col">
      {/* Header */}
      <header className="flex items-center gap-3 border-b border-white/10 bg-em-bg/70 px-4 py-3 backdrop-blur-xl">
        <button onClick={onBack} className="rounded-lg border border-white/10 px-3 py-1.5 text-sm text-em-text-dim transition hover:border-em-accent/40 hover:text-em-text">← Back</button>
        <div className="h-9 w-9 overflow-hidden rounded-full bg-em-panel">
          {char.avatar ? <img src={avatarUrl(char.avatar)} alt="" className="h-full w-full object-cover" /> : <div className="flex h-full w-full items-center justify-center">👤</div>}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate font-semibold">{displayName(char)}</div>
          {chat && chat.memories && <div className="text-[11px] text-em-accent">🧠 memory active</div>}
        </div>
        {onEdit && <button onClick={() => onEdit(char)} className="rounded-lg border border-white/10 px-3 py-1.5 text-sm text-em-text-dim transition hover:border-em-accent/40 hover:text-em-text">✎ Edit</button>}
        <button onClick={startNewChat} className="rounded-lg border border-white/10 px-3 py-1.5 text-sm text-em-text-dim transition hover:border-em-accent/40 hover:text-em-text">＋ New chat</button>
      </header>

      {/* Tools: persona · mood · memories */}
      {chat && (
        <div className="flex flex-wrap items-center gap-2 border-b border-white/5 bg-white/[0.02] px-4 py-2 text-sm">
          <label className="flex items-center gap-1.5 text-em-text-dim">
            <span>👤 You as</span>
            <select
              value={chat.activePersonaId || ''}
              onChange={(e) => { if (e.target.value === '__new') createPersona(); else setPersona(e.target.value); }}
              className="rounded-lg border border-white/10 bg-em-panel px-2 py-1 text-em-text focus:border-em-accent/50 focus:outline-none"
            >
              <option value="">User</option>
              {Object.values(personas).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              <option value="__new">＋ New persona…</option>
            </select>
          </label>

          <label className="flex items-center gap-1.5 text-em-text-dim">
            <span>🎭 Mood</span>
            <select
              value={chat.mood || ''}
              onChange={(e) => setMood(e.target.value)}
              className="rounded-lg border border-white/10 bg-em-panel px-2 py-1 text-em-text focus:border-em-accent/50 focus:outline-none"
            >
              <option value="">none</option>
              {MOODS.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </label>

          <button
            onClick={() => setShowMemories(true)}
            className={'rounded-lg border px-2.5 py-1 transition ' + (chat.memories && chat.memories.trim() ? 'border-em-accent/50 text-em-accent' : 'border-white/10 text-em-text-dim hover:text-em-text')}
          >
            🧠 Memories
          </button>
        </div>
      )}

      {/* Messages */}
      <div ref={scrollRef} onScroll={onScroll} className="mx-auto w-full max-w-3xl flex-1 space-y-5 overflow-y-auto px-4 py-6">
        {history.map((m) => (
          <MessageBubble
            key={m.id}
            msg={m}
            char={char}
            streaming={streaming}
            showThink={settings.showThink}
            onRegenerate={() => regenerate(m)}
            onSwipe={(d) => swipe(m, d)}
          />
        ))}
        {history.length === 0 && <div className="py-20 text-center text-em-text-dim">Say hello to start the scene…</div>}
      </div>

      {/* Composer */}
      <div className="border-t border-white/10 bg-em-bg/70 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-3xl items-end gap-2 px-4 py-3">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
            rows={1}
            placeholder={`Message ${displayName(char)}…`}
            className="max-h-40 min-h-[44px] flex-1 resize-none rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-em-text placeholder:text-em-text-dim/60 focus:border-em-accent/50 focus:outline-none"
          />
          {streaming ? (
            <button onClick={stop} className="rounded-xl bg-red-500/80 px-5 py-3 font-semibold text-white transition hover:bg-red-500">■ Stop</button>
          ) : (
            <button onClick={send} disabled={!input.trim()} className="rounded-xl bg-em-accent px-5 py-3 font-semibold text-em-bg transition enabled:hover:bg-emerald-300 disabled:opacity-40">Send ↵</button>
          )}
        </div>
      </div>

      {showMemories && chat && (
        <MemoriesModal char={char} chat={chat} personas={personas} onSave={saveMemories} onClose={() => setShowMemories(false)} />
      )}
    </div>
  );
}

function MessageBubble({ msg, char, streaming, showThink: showThinkSetting = true, onRegenerate, onSwipe }) {
  const [showThink, setShowThink] = useState(false);
  const isUser = msg.sender === 'user';
  const text = getMessageText(msg);
  const think = showThinkSetting ? getMessageThink(msg) : '';
  const nVariants = isUser ? 1 : (msg.variations ? msg.variations.length : 1);
  const isStreamingThis = msg.isStreaming;

  const html = isStreamingThis ? renderStreaming(text) : renderFinal(text);

  return (
    <div className={'flex flex-col gap-1 ' + (isUser ? 'items-end' : 'items-start')}>
      <div
        className={
          'max-w-[85%] rounded-2xl px-4 py-3 leading-relaxed shadow ' +
          (isUser ? 'bg-em-accent/15 text-em-text' : 'border border-white/10 bg-white/[0.04] text-em-text')
        }
      >
        {!isUser && think && (
          <details open={showThink} onToggle={(e) => setShowThink(e.target.open)} className="mb-2 rounded-lg bg-black/30 text-xs text-em-text-dim">
            <summary className="cursor-pointer select-none px-2 py-1">💭 Thoughts</summary>
            <div className="px-2 pb-2" dangerouslySetInnerHTML={{ __html: escapeHtml(think).replace(/\n/g, '<br>') }} />
          </details>
        )}
        {isStreamingThis && !text ? (
          <span className="inline-flex gap-1">
            <span className="h-2 w-2 animate-bounce rounded-full bg-em-text-dim [animation-delay:-0.2s]" />
            <span className="h-2 w-2 animate-bounce rounded-full bg-em-text-dim [animation-delay:-0.1s]" />
            <span className="h-2 w-2 animate-bounce rounded-full bg-em-text-dim" />
          </span>
        ) : (
          <div className="chat-md" dangerouslySetInnerHTML={{ __html: html }} />
        )}
      </div>

      {/* Controls (AI, not streaming) */}
      {!isUser && !isStreamingThis && (
        <div className="flex items-center gap-2 px-1 text-em-text-dim">
          {nVariants > 1 && (
            <span className="flex items-center gap-1 text-xs">
              <button onClick={() => onSwipe(-1)} className="hover:text-em-text">‹</button>
              {(msg.activeVariant || 0) + 1}/{nVariants}
              <button onClick={() => onSwipe(1)} className="hover:text-em-text">›</button>
            </span>
          )}
          <button onClick={onRegenerate} disabled={streaming} className="text-sm transition hover:text-em-accent disabled:opacity-40" title="Regenerate">🔄</button>
        </div>
      )}
    </div>
  );
}
