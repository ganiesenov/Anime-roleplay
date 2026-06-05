import { useEffect, useMemo, useRef, useState } from 'react';
import { saveCharacter, getAllPersonas, savePersona, getAllCharacters } from '../lib/db.js';
import MemoriesModal from './MemoriesModal.jsx';
import ParticleField from './ParticleField.jsx';
import { PARTICLE_EFFECTS } from '../lib/particles.js';
import {
  genId, displayName, getMessageText, getMessageThink, expandPlaceholders,
  buildMessagesArray, buildGroupMessages, streamCompletion, splitThink, summarizeChat, suggestReplies, collectCompletion,
} from '../lib/chat.js';
import { defaultRelationship, buildRelationshipUpdateMessages, parseRelationship } from '../lib/relationship.js';
import { presenceFor, buildPresenceText, formatElapsed } from '../lib/presence.js';
import { buildOffscreenMessages, cleanOffscreen } from '../lib/offscreen.js';
import { DEFAULT_SETTINGS } from '../lib/settings.js';
import { renderStreaming, renderFinal, escapeHtml } from '../lib/format.js';
import { speak, cancelSpeech, ttsSupported } from '../lib/tts.js';
import { audioSrcFor, musicKey } from '../lib/music.js';

function avatarUrl(url) {
  if (!url) return '';
  if (/^https?:\/\//i.test(url)) return '/api/img?url=' + encodeURIComponent(url);
  return url;
}

// Parse the creation timestamp baked into a `chat-<ms>` id (newest first).
function chatTs(id) {
  const n = parseInt(String(id || '').replace('chat-', ''), 10);
  return Number.isNaN(n) ? 0 : n;
}

// After this idle gap, a character proactively reaches out when you reopen the chat.
const PROACTIVE_GAP_MS = 3 * 60 * 60 * 1000;

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
  const [showChats, setShowChats] = useState(false);   // chat-session list panel
  const [undo, setUndo] = useState(null);              // { fromIndex, messages } after a delete
  const [suggestions, setSuggestions] = useState([]);  // suggested user replies
  const [suggesting, setSuggesting] = useState(false);
  const [speakingId, setSpeakingId] = useState(null);  // id of the message being read aloud
  const [showMusic, setShowMusic] = useState(false);   // background-music panel
  const [musicUrl, setMusicUrl] = useState('');
  const [musicPlaying, setMusicPlaying] = useState(false);
  const [showEffects, setShowEffects] = useState(false); // ambient-effects picker
  const [charsById, setCharsById] = useState({});        // whole library, for group casting
  const [showCast, setShowCast] = useState(false);       // group cast panel
  const [showInner, setShowInner] = useState(false);     // relationship + diary viewer
  const [, force] = useState(0);          // re-render trigger for in-place mutations
  const rerender = () => force((n) => n + 1);
  const controllerRef = useRef(null);
  const suggestReqRef = useRef(0);        // cancels stale suggestion requests
  const inputRef = useRef(null);
  const scrollRef = useRef(null);
  const audioRef = useRef(null);          // background-music <audio>
  const proactiveTriedRef = useRef(false); // ensures the "texts first" check fires once per open
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
    getAllCharacters().then((list) => {
      const map = {};
      list.forEach((c) => { if (c && c.id) map[c.id] = c; });
      setCharsById(map);
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
    setShowChats(false);
    setUndo(null);
    clearSuggestions();
    cancelSpeech();
    setSpeakingId(null);
    saveCharacter(char);
  }

  // ── Chat session list (switch / rename / delete) ──────────────────────────
  function switchChat(id) {
    if (!chats[id] || id === chatId) { setShowChats(false); return; }
    setUndo(null);
    clearSuggestions();
    cancelSpeech();
    setSpeakingId(null);
    setChatId(id);
    setShowChats(false);
  }

  function renameChat(id) {
    const c = chats[id];
    if (!c) return;
    const name = window.prompt('Rename chat:', c.name || '');
    if (name == null) return;
    c.name = name.trim() || c.name;
    saveCharacter(char);
    rerender();
  }

  function deleteChatSession(id) {
    if (!chats[id]) return;
    if (!window.confirm('Delete this chat? This cannot be undone.')) return;
    delete chats[id];
    if (id === chatId) {
      const ids = Object.keys(chats).sort((a, b) => chatTs(b) - chatTs(a));
      if (ids.length) {
        setChatId(ids[0]);
      } else {
        const c = newChat(char);
        chats[c.id] = c;
        setChatId(c.id);
      }
      setUndo(null);
    }
    saveCharacter(char);
    rerender();
  }

  // ── Per-message edit / delete (+ undo) ────────────────────────────────────
  function saveMessageEdit(msg, text) {
    if (msg.sender === 'ai') {
      const v = msg.variations[msg.activeVariant || 0];
      if (v) v.main = text;
    } else {
      msg.main = text;
    }
    saveCharacter(char);
    rerender();
  }

  function deleteMessage(msg) {
    if (streaming || !chat) return;
    const idx = chat.history.indexOf(msg);
    if (idx === -1) return;
    if (!window.confirm('Delete this message and all following messages?')) return;
    const removed = chat.history.splice(idx);
    setUndo({ fromIndex: idx, messages: removed });
    saveCharacter(char);
    rerender();
  }

  function undoDelete() {
    if (!undo || !chat) return;
    chat.history.splice(undo.fromIndex, 0, ...undo.messages);
    setUndo(null);
    saveCharacter(char);
    rerender();
  }

  // Extend an AI turn in place: keep its current text and stream a continuation
  // onto the same variant (no new variant), prompting from history up to it.
  async function continueMessage(msg) {
    if (streaming || !chat || msg.sender !== 'ai') return;
    const idx = chat.history.indexOf(msg);
    if (idx === -1) return;
    const original = getMessageText(msg);
    if (!original.trim()) { regenerate(msg); return; }   // nothing to continue → regenerate
    // Build the prompt before flagging streaming, so this message's text is part
    // of the assistant context; the continuation instruction goes as the user turn.
    const tempChat = { ...chat, history: chat.history.slice(0, idx + 1) };
    const instruction = original + '\n[Continue: drive the scene forward, complete any cut-off sentence, do not repeat.]';
    const messages = isGroup()
      ? buildGroupMessages(speakerOf(msg), activeParticipants(), charsById, tempChat, personas, instruction, promptOpts(speakerOf(msg)))
      : buildMessagesArray(char, tempChat, personas, instruction, promptOpts(char));
    setUndo(null);
    msg.isStreaming = true;
    msg.streamingVariant = msg.activeVariant || 0;
    autoScroll.current = true;
    rerender();
    await runStream(msg, instruction, { seed: original, messages });
  }

  // ── Suggested replies ─────────────────────────────────────────────────────
  function clearSuggestions() {
    suggestReqRef.current++;        // invalidate any in-flight request
    setSuggestions([]);
    setSuggesting(false);
  }

  async function generateSuggestions() {
    if (!settings.replyOptions || !chat) return;
    const reqId = ++suggestReqRef.current;
    setSuggestions([]);
    setSuggesting(true);
    try {
      const opts = await suggestReplies(char, chat, personas, { model: settings.model });
      if (reqId !== suggestReqRef.current) return;
      setSuggestions(opts || []);
    } catch (e) {
      if (reqId !== suggestReqRef.current) return;
      setSuggestions([]);
    } finally {
      if (reqId === suggestReqRef.current) setSuggesting(false);
    }
  }

  function pickSuggestion(text) {
    setInput(text);
    clearSuggestions();
    if (inputRef.current) inputRef.current.focus();
  }

  // ── Text-to-speech ────────────────────────────────────────────────────────
  function speakMessage(msg) {
    if (speakingId === msg.id) { cancelSpeech(); setSpeakingId(null); return; }
    const ok = speak(getMessageText(msg), { voiceURI: settings.ttsVoiceURI, onend: () => setSpeakingId(null) });
    setSpeakingId(ok ? msg.id : null);
  }

  // Stop any speech when the view unmounts.
  useEffect(() => () => cancelSpeech(), []);

  // Ensure the chat has a relationship state so the header/prompt have something to show.
  useEffect(() => {
    if (chat && !chat.relationship) { chat.relationship = defaultRelationship(); rerender(); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatId]);

  // ── Background music ──────────────────────────────────────────────────────
  // Load the saved/character music URL and stop any track from a prior character.
  useEffect(() => {
    let saved = '';
    try { saved = localStorage.getItem(musicKey(char.id)) || ''; } catch (e) { /* ignore */ }
    setMusicUrl(saved || char.musicUrl || '');
    if (audioRef.current) { audioRef.current.pause(); audioRef.current.removeAttribute('src'); }
    setMusicPlaying(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [char.id]);

  useEffect(() => () => { if (audioRef.current) { audioRef.current.pause(); audioRef.current.src = ''; } }, []);

  function playMusic(url) {
    const u = String(url != null ? url : musicUrl).trim();
    if (!u) return;
    let a = audioRef.current;
    if (!a) {
      a = new Audio();
      a.loop = true;
      a.addEventListener('ended', () => setMusicPlaying(false));
      a.addEventListener('error', () => setMusicPlaying(false));
      audioRef.current = a;
    }
    a.src = audioSrcFor(u);
    a.play().then(() => setMusicPlaying(true)).catch(() => setMusicPlaying(false));
    try { localStorage.setItem(musicKey(char.id), u); } catch (e) { /* ignore */ }
  }

  function toggleMusic() {
    const a = audioRef.current;
    if (!a || !a.src) { playMusic(); return; }
    if (a.paused) { a.play().then(() => setMusicPlaying(true)).catch(() => {}); }
    else { a.pause(); setMusicPlaying(false); }
  }

  function stopMusic() {
    const a = audioRef.current;
    if (a) { a.pause(); a.currentTime = 0; }
    setMusicPlaying(false);
  }

  async function runStream(aiMsg, lastUserText, opts = {}) {
    const variantIndex = aiMsg.streamingVariant != null ? aiMsg.streamingVariant : aiMsg.activeVariant;
    const seed = opts.seed || '';                 // existing text to keep + append onto (continue)
    const controller = new AbortController();
    controllerRef.current = controller;
    setStreaming(true);
    clearSuggestions();
    let mainAcc = '';
    let reasonAcc = '';
    let rafPending = false;
    let finished = false;
    let errored = false;

    const composed = (newMain) => (seed ? (newMain ? seed + ' ' + newMain : seed) : newMain);

    const apply = () => {
      const split = splitThink(mainAcc);
      const v = aiMsg.variations[variantIndex];
      if (v) { v.main = composed(split.main != null ? split.main : mainAcc); v.think = (split.think || reasonAcc) || null; }
      rerender();
    };
    const schedule = () => {
      if (rafPending || finished) return;
      rafPending = true;
      requestAnimationFrame(() => { rafPending = false; if (!finished) apply(); });
    };

    try {
      await streamCompletion(opts.messages || buildMessagesArray(char, chat, personas, lastUserText, promptOpts(char)), {
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
        errored = true;
        const v = aiMsg.variations[variantIndex];
        const errTxt = '[--- ERROR: ' + String(err.message || err).slice(0, 160) + ' ---]';
        if (v) {
          if (seed) v.main = seed + '\n' + errTxt;
          else if (!v.main) v.main = errTxt;
        }
      }
    } finally {
      finished = true;
      const split = splitThink(mainAcc);
      const v = aiMsg.variations[variantIndex];
      if (v && !errored && (mainAcc || seed)) { v.main = composed(split.main != null ? split.main : mainAcc); v.think = (split.think || reasonAcc) || null; }
      aiMsg.isStreaming = false;
      aiMsg.streamingVariant = null;
      aiMsg.activeVariant = variantIndex;
      controllerRef.current = null;
      setStreaming(false);
      await saveCharacter(char);
      rerender();
      if (mainAcc && !errored && !controller.signal.aborted) {
        maybeAutoSummarize();
        maybeUpdateRelationship();
        generateSuggestions();
        if (settings.tts) {
          const ok = speak(getMessageText(aiMsg), { voiceURI: settings.ttsVoiceURI, onend: () => setSpeakingId(null) });
          if (ok) setSpeakingId(aiMsg.id);
        }
      }
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

  // Update the living relationship state from the latest exchange (fire-and-forget).
  async function maybeUpdateRelationship() {
    if (!settings.relationship || !chat) return;
    const prev = chat.relationship || defaultRelationship();
    const uName = (chat.activePersonaId && personas[chat.activePersonaId] && personas[chat.activePersonaId].name) || 'User';
    const transcript = (chat.history || [])
      .filter((m) => !m.isStreaming)
      .slice(-8)
      .map((m) => (m.sender === 'user' ? uName : displayName(speakerOf(m))) + ': ' + getMessageText(m))
      .join('\n');
    if (!transcript.trim()) return;
    try {
      const raw = await collectCompletion(
        buildRelationshipUpdateMessages(displayName(char), uName, prev, transcript),
        { model: settings.model },
      );
      const next = parseRelationship(raw, prev);
      if (next) { chat.relationship = next; await saveCharacter(char); rerender(); }
    } catch (e) { /* best effort */ }
  }

  // The character reaches out first after you've been away for a while — grounded
  // in what they "did" off-screen while you were gone.
  async function sendProactive(gapMs) {
    if (!chat || streaming) return;
    const speaker = resolveSpeaker();
    const gapText = formatElapsed(gapMs);

    let offscreen = '';
    if (settings.offscreenLife) {
      const uName = (chat.activePersonaId && personas[chat.activePersonaId] && personas[chat.activePersonaId].name) || 'User';
      const mood = chat.relationship && chat.relationship.mood;
      try {
        const raw = await collectCompletion(
          buildOffscreenMessages(displayName(speaker), uName, gapText, mood),
          { model: settings.model },
        );
        offscreen = cleanOffscreen(raw);
      } catch (e) { /* best effort */ }
    }

    const aiMsg = {
      id: genId(), sender: 'ai', type: 'dialog', speakerId: speaker.id,
      activeVariant: 0, variations: [{ main: '', think: null }], isStreaming: true, streamingVariant: 0,
      proactive: true, offscreen: offscreen || undefined,
    };
    if (offscreen) chat.diary = [...(chat.diary || []), { ts: Date.now(), text: offscreen }].slice(-10);
    chat.history.push(aiMsg);
    autoScroll.current = true;
    rerender();

    const instruction = 'The user has just come back after being away for ' + gapText + '.'
      + (offscreen ? ' While they were gone, you (' + displayName(speaker) + ') were busy with your own life: "' + offscreen + '". Let that colour how you greet them — you may mention it naturally.' : '')
      + ' As ' + displayName(speaker) + ', reach out to them FIRST — greet them and react to their absence and the time of day, in character. Keep it natural and fairly short.';
    const messages = isGroup()
      ? groupMessagesFor(speaker, instruction)
      : buildMessagesArray(char, chat, personas, instruction, promptOpts(speaker));
    await runStream(aiMsg, instruction, { messages });
  }

  // Reset the once-per-open guard whenever the active chat changes.
  useEffect(() => { proactiveTriedRef.current = false; }, [chatId]);

  // On (re)opening a chat after a long enough gap, let the character text first.
  useEffect(() => {
    if (!settings.presence || !chat || streaming || proactiveTriedRef.current) return;
    const hist = chat.history.filter((m) => !m.isStreaming);
    if (!hist.length) return;
    const last = hist[hist.length - 1];
    if (last.proactive) return;          // don't stack proactive on proactive
    const ts = tsFromMsgId(last.id);
    if (!ts || Date.now() - ts < PROACTIVE_GAP_MS) return;
    proactiveTriedRef.current = true;
    sendProactive(Date.now() - ts);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatId, chat, streaming, settings.presence]);

  async function send() {
    const text = input.trim();
    if (!text || streaming || !chat) return;
    setInput('');
    setUndo(null);
    autoScroll.current = true;
    const speaker = resolveSpeaker();
    chat.history.push({ id: genId(), sender: 'user', main: text });
    const aiMsg = {
      id: genId(), sender: 'ai', type: 'dialog', speakerId: speaker.id,
      activeVariant: 0, variations: [{ main: '', think: null }], isStreaming: true, streamingVariant: 0,
    };
    chat.history.push(aiMsg);
    rerender();
    const opts = isGroup() ? { messages: groupMessagesFor(speaker, text) } : {};
    await runStream(aiMsg, text, opts);
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
    const opts = isGroup() ? { messages: groupMessagesFor(speakerOf(msg), lastUserText) } : {};
    await runStream(msg, lastUserText, opts);
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

  function setEffect(key) {
    char.particleEffect = key;
    if (char.particleIntensityLevel == null) char.particleIntensityLevel = 50;
    saveCharacter(char);
    rerender();
  }
  function setEffectIntensity(level) {
    char.particleIntensityLevel = level;
    saveCharacter(char);
    rerender();
  }

  // ── Group / cast ──────────────────────────────────────────────────────────
  function participantIds() {
    const ids = Array.isArray(chat && chat.participants) ? chat.participants.slice() : [];
    if (!ids.includes(char.id)) ids.unshift(char.id);
    return ids;
  }
  function activeParticipants() {
    return participantIds()
      .map((id) => charsById[id] || (id === char.id ? char : null))
      .filter(Boolean);
  }
  function isGroup() { return activeParticipants().length > 1; }

  // Whose turn it is: the manually-pinned speaker, else auto-rotate to the next
  // participant after whoever spoke last.
  function resolveSpeaker() {
    const parts = activeParticipants();
    if (parts.length <= 1) return char;
    if (chat.activeSpeakerId) {
      const pinned = parts.find((c) => c.id === chat.activeSpeakerId);
      if (pinned) return pinned;
    }
    const lastAi = [...chat.history].reverse().find((m) => m.sender !== 'user');
    const idx = parts.findIndex((c) => c.id === (lastAi && lastAi.speakerId));
    return parts[(idx + 1) % parts.length] || parts[0];
  }

  function speakerOf(msg) {
    if (msg && msg.speakerId && charsById[msg.speakerId]) return charsById[msg.speakerId];
    return char;
  }

  function groupMessagesFor(speaker, lastUserText) {
    return buildGroupMessages(speaker, activeParticipants(), charsById, chat, personas, lastUserText, promptOpts(speaker));
  }

  function addParticipant(id) {
    if (!id || !charsById[id]) return;
    const ids = participantIds();
    if (ids.includes(id)) return;
    chat.participants = [...ids, id];
    saveCharacter(char);
    rerender();
  }
  function removeParticipant(id) {
    if (id === char.id) return;          // the host always stays
    chat.participants = participantIds().filter((x) => x !== id);
    if (chat.activeSpeakerId === id) chat.activeSpeakerId = null;
    saveCharacter(char);
    rerender();
  }
  function setSpeaker(id) {
    chat.activeSpeakerId = id || null;   // null = Auto (rotate)
    saveCharacter(char);
    rerender();
  }

  // ── Time / presence ───────────────────────────────────────────────────────
  function tsFromMsgId(id) {
    const n = parseInt(String(id || '').replace(/^msg-/, ''), 10);
    return Number.isNaN(n) ? 0 : n;
  }
  function lastMsgTs() {
    const hist = (chat && chat.history) || [];
    for (let i = hist.length - 1; i >= 0; i--) {
      if (!hist[i].isStreaming) return tsFromMsgId(hist[i].id);
    }
    return 0;
  }
  // Shared prompt options (reply length + the living-relationship & presence layers).
  function promptOpts(speaker) {
    const spk = speaker || char;
    return {
      replyLength: settings.replyLength,
      relationship: settings.relationship,
      autonomy: settings.autonomy,
      presenceText: settings.presence ? buildPresenceText(displayName(spk), spk.id, new Date(), lastMsgTs()) : '',
    };
  }
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
  const sessions = Object.values(chats).sort((a, b) => chatTs(b.id) - chatTs(a.id));

  return (
    <div className="flex h-screen flex-col">
      <ParticleField effect={char.particleEffect} intensity={char.particleIntensityLevel} />
      {/* Header */}
      <header className="relative flex items-center gap-3 border-b border-white/10 bg-em-bg/70 px-4 py-3 backdrop-blur-xl">
        <button onClick={onBack} className="rounded-lg border border-white/10 px-3 py-1.5 text-sm text-em-text-dim transition hover:border-em-accent/40 hover:text-em-text">← Back</button>
        <div className="h-9 w-9 overflow-hidden rounded-full bg-em-panel">
          {char.avatar ? <img src={avatarUrl(char.avatar)} alt="" className="h-full w-full object-cover" /> : <div className="flex h-full w-full items-center justify-center">👤</div>}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate font-semibold">{displayName(char)}</div>
          {chat && chat.memories && <div className="text-[11px] text-em-accent">🧠 memory active</div>}
        </div>
        {settings.presence && (
          <span title={`${displayName(char)} is ${presenceFor(char.id).label}`} className="hidden text-sm sm:inline" aria-label="presence">
            {presenceFor(char.id).badge}
          </span>
        )}
        {settings.relationship && chat && chat.relationship && (
          <button
            onClick={() => setShowInner(true)}
            title="Inner life — relationship & diary"
            className="hidden items-center gap-1 rounded-lg border border-white/10 px-2 py-1 text-xs text-em-text-dim transition hover:border-em-accent/40 hover:text-em-text sm:flex"
          >
            💗 {chat.relationship.affection}
          </button>
        )}
        {onEdit && <button onClick={() => onEdit(char)} className="rounded-lg border border-white/10 px-3 py-1.5 text-sm text-em-text-dim transition hover:border-em-accent/40 hover:text-em-text">✎ Edit</button>}
        <button onClick={() => setShowChats((v) => !v)} className={'rounded-lg border px-3 py-1.5 text-sm transition ' + (showChats ? 'border-em-accent/50 text-em-accent' : 'border-white/10 text-em-text-dim hover:border-em-accent/40 hover:text-em-text')}>💬 Chats ({sessions.length})</button>
        <button onClick={startNewChat} className="rounded-lg border border-white/10 px-3 py-1.5 text-sm text-em-text-dim transition hover:border-em-accent/40 hover:text-em-text">＋ New chat</button>

        {/* Chat session list */}
        {showChats && (
          <>
            <div className="fixed inset-0 z-30" onClick={() => setShowChats(false)} />
            <div className="absolute right-3 top-full z-40 mt-1 max-h-[70vh] w-72 overflow-y-auto rounded-xl border border-white/10 bg-em-panel p-1.5 shadow-2xl">
              <div className="flex items-center justify-between px-2 py-1.5 text-xs font-semibold uppercase tracking-wide text-em-text-dim">
                <span>Chats</span>
                <button onClick={startNewChat} className="rounded-md px-2 py-0.5 text-em-accent transition hover:bg-em-accent/10">＋ New</button>
              </div>
              {sessions.length === 0 && <p className="px-2 py-3 text-center text-sm text-em-text-dim">No chats yet.</p>}
              {sessions.map((s) => {
                const active = s.id === chatId;
                const count = (s.history || []).length;
                return (
                  <div key={s.id} className={'group flex items-center gap-1 rounded-lg px-2 py-1.5 ' + (active ? 'bg-em-accent/15' : 'hover:bg-white/5')}>
                    <button onClick={() => switchChat(s.id)} className="min-w-0 flex-1 text-left">
                      <div className={'truncate text-sm ' + (active ? 'font-semibold text-em-accent' : 'text-em-text')}>{s.name || 'Chat'}</div>
                      <div className="text-[11px] text-em-text-dim">{count} message{count === 1 ? '' : 's'}</div>
                    </button>
                    <button onClick={() => renameChat(s.id)} title="Rename chat" className="rounded p-1 text-em-text-dim opacity-0 transition hover:text-em-text group-hover:opacity-100">✏️</button>
                    <button onClick={() => deleteChatSession(s.id)} title="Delete chat" className="rounded p-1 text-em-text-dim opacity-0 transition hover:text-red-400 group-hover:opacity-100">🗑️</button>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </header>

      {/* Tools: persona · mood · memories · music */}
      {chat && (
        <>
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

          <button
            onClick={() => setShowMusic((v) => !v)}
            className={'rounded-lg border px-2.5 py-1 transition ' + (musicPlaying ? 'border-em-accent/50 text-em-accent' : 'border-white/10 text-em-text-dim hover:text-em-text')}
          >
            🎵 Music
          </button>

          <button
            onClick={() => setShowEffects((v) => !v)}
            className={'rounded-lg border px-2.5 py-1 transition ' + (char.particleEffect && char.particleEffect !== 'none' ? 'border-em-accent/50 text-em-accent' : 'border-white/10 text-em-text-dim hover:text-em-text')}
          >
            ✨ Effects
          </button>

          <button
            onClick={() => setShowCast((v) => !v)}
            className={'rounded-lg border px-2.5 py-1 transition ' + (isGroup() ? 'border-em-accent/50 text-em-accent' : 'border-white/10 text-em-text-dim hover:text-em-text')}
          >
            👥 Cast{isGroup() ? ' (' + activeParticipants().length + ')' : ''}
          </button>
        </div>

        {showCast && (
          <div className="border-b border-white/5 bg-white/[0.02] px-4 py-2 text-sm">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span className="text-em-text-dim">In scene:</span>
              {activeParticipants().map((c) => (
                <span key={c.id} className="flex items-center gap-1 rounded-full border border-white/10 bg-em-panel px-2 py-1">
                  {c.id === char.id ? '★ ' : ''}{displayName(c)}
                  {c.id !== char.id && (
                    <button onClick={() => removeParticipant(c.id)} className="text-em-text-dim transition hover:text-red-400" title="Remove from scene">✕</button>
                  )}
                </span>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-1.5 text-em-text-dim">
                <span>＋ Add</span>
                <select
                  value=""
                  onChange={(e) => { addParticipant(e.target.value); e.target.value = ''; }}
                  className="rounded-lg border border-white/10 bg-em-panel px-2 py-1 text-em-text focus:border-em-accent/50 focus:outline-none"
                >
                  <option value="">character…</option>
                  {Object.values(charsById)
                    .filter((c) => !participantIds().includes(c.id) && !c.isArchived)
                    .sort((a, b) => (a.name || '').localeCompare(b.name || ''))
                    .map((c) => <option key={c.id} value={c.id}>{displayName(c)}</option>)}
                </select>
              </label>
              {isGroup() && (
                <label className="flex items-center gap-1.5 text-em-text-dim">
                  <span>🎙 Speaker</span>
                  <select
                    value={chat.activeSpeakerId || ''}
                    onChange={(e) => setSpeaker(e.target.value)}
                    className="rounded-lg border border-white/10 bg-em-panel px-2 py-1 text-em-text focus:border-em-accent/50 focus:outline-none"
                  >
                    <option value="">Auto (rotate)</option>
                    {activeParticipants().map((c) => <option key={c.id} value={c.id}>{displayName(c)}</option>)}
                  </select>
                </label>
              )}
            </div>
          </div>
        )}

        {showEffects && (
          <div className="flex flex-wrap items-center gap-2 border-b border-white/5 bg-white/[0.02] px-4 py-2 text-sm">
            {PARTICLE_EFFECTS.map((fx) => {
              const active = (char.particleEffect || 'none') === fx.key;
              return (
                <button
                  key={fx.key}
                  onClick={() => setEffect(fx.key)}
                  title={fx.label}
                  className={'rounded-lg border px-2.5 py-1 transition ' + (active ? 'border-em-accent/60 bg-em-accent/15 text-em-accent' : 'border-white/10 text-em-text-dim hover:text-em-text')}
                >
                  {fx.emoji} {fx.label}
                </button>
              );
            })}
            {char.particleEffect && char.particleEffect !== 'none' && (
              <label className="ml-auto flex items-center gap-2 text-em-text-dim">
                <span>Intensity</span>
                <input
                  type="range" min="10" max="150" step="5"
                  value={char.particleIntensityLevel || 50}
                  onChange={(e) => setEffectIntensity(parseInt(e.target.value, 10))}
                  className="w-36 accent-em-accent"
                />
                <span className="w-8 text-right">{char.particleIntensityLevel || 50}</span>
              </label>
            )}
          </div>
        )}

        {showMusic && (
          <div className="flex flex-wrap items-center gap-2 border-b border-white/5 bg-white/[0.02] px-4 py-2 text-sm">
            <input
              value={musicUrl}
              onChange={(e) => setMusicUrl(e.target.value)}
              placeholder="Music URL (direct audio or YouTube)…"
              className="min-w-0 flex-1 rounded-lg border border-white/10 bg-em-panel px-3 py-1.5 text-em-text placeholder:text-em-text-dim/60 focus:border-em-accent/50 focus:outline-none"
            />
            <button onClick={() => (musicPlaying ? toggleMusic() : playMusic())} className="rounded-lg border border-white/10 px-3 py-1.5 text-em-text-dim transition hover:border-em-accent/40 hover:text-em-text">
              {musicPlaying ? '⏸ Pause' : '▶ Play'}
            </button>
            <button onClick={stopMusic} className="rounded-lg border border-white/10 px-3 py-1.5 text-em-text-dim transition hover:border-em-accent/40 hover:text-em-text">⏹ Stop</button>
          </div>
        )}
        </>
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
            onContinue={() => continueMessage(m)}
            onSwipe={(d) => swipe(m, d)}
            onEditSave={(text) => saveMessageEdit(m, text)}
            onDelete={() => deleteMessage(m)}
            onSpeak={() => speakMessage(m)}
            speaking={speakingId === m.id}
            speaker={speakerOf(m)}
            group={isGroup()}
          />
        ))}
        {history.length === 0 && <div className="py-20 text-center text-em-text-dim">Say hello to start the scene…</div>}
      </div>

      {/* Undo a delete */}
      {undo && (
        <div className="pointer-events-none fixed inset-x-0 bottom-24 z-30 flex justify-center">
          <button onClick={undoDelete} className="pointer-events-auto rounded-full border border-white/10 bg-em-panel px-4 py-2 text-sm font-medium text-em-text shadow-2xl transition hover:border-em-accent/50">
            ↩ Undo delete ({undo.messages.length})
          </button>
        </div>
      )}

      {/* Composer */}
      <div className="border-t border-white/10 bg-em-bg/70 backdrop-blur-xl">
        {settings.replyOptions && !streaming && chat && (suggesting || suggestions.length > 0) && (
          <div className="mx-auto flex w-full max-w-3xl flex-wrap gap-2 px-4 pt-3">
            {suggesting && suggestions.length === 0 ? (
              <span className="rounded-full border border-white/10 px-3 py-1.5 text-sm text-em-text-dim">💡 thinking of replies…</span>
            ) : (
              suggestions.map((sug, i) => (
                <button
                  key={i}
                  onClick={() => pickSuggestion(sug)}
                  className="max-w-full truncate rounded-full border border-em-accent/30 bg-em-accent/10 px-3 py-1.5 text-left text-sm text-em-text transition hover:border-em-accent/60 hover:bg-em-accent/20"
                  title={sug}
                >
                  💬 {sug}
                </button>
              ))
            )}
          </div>
        )}
        <div className="mx-auto flex w-full max-w-3xl items-end gap-2 px-4 py-3">
          <textarea
            ref={inputRef}
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

      {showInner && chat && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" onClick={() => setShowInner(false)}>
          <div className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-3xl border border-white/10 bg-em-panel/95 p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold">💗 {displayName(char)} — inner life</h2>
              <button onClick={() => setShowInner(false)} className="rounded-lg px-3 py-1.5 text-em-text-dim transition hover:text-em-text">✕</button>
            </div>

            {chat.relationship ? (
              <div className="space-y-3">
                <Meter label="Affection" value={chat.relationship.affection} />
                <Meter label="Trust" value={chat.relationship.trust} />
                <Meter label="Tension" value={chat.relationship.tension} />
                {chat.relationship.mood && (
                  <div className="text-sm"><span className="text-em-text-dim">Current mood:</span> {chat.relationship.mood}</div>
                )}
                {chat.relationship.beats && chat.relationship.beats.length > 0 && (
                  <div>
                    <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-em-text-dim">Ongoing between you</div>
                    <ul className="space-y-1 text-sm">
                      {chat.relationship.beats.map((b, i) => <li key={i} className="flex gap-2"><span className="text-em-accent">•</span><span>{b}</span></li>)}
                    </ul>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-em-text-dim">No relationship state yet — keep chatting.</p>
            )}

            {chat.diary && chat.diary.length > 0 && (
              <div className="mt-5 border-t border-white/10 pt-4">
                <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-em-text-dim">📔 Diary (off-screen)</div>
                <ul className="space-y-2 text-sm">
                  {[...chat.diary].reverse().map((d, i) => (
                    <li key={i} className="text-em-text-dim">
                      <span className="text-[11px]">{new Date(d.ts).toLocaleString()}</span>
                      <div className="text-em-text">{d.text}</div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Meter({ label, value }) {
  const v = Math.max(0, Math.min(100, Number(value) || 0));
  return (
    <div>
      <div className="mb-1 flex justify-between text-xs text-em-text-dim"><span>{label}</span><span>{v}</span></div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
        <div className="h-full rounded-full bg-em-accent" style={{ width: v + '%' }} />
      </div>
    </div>
  );
}

function MessageBubble({ msg, char, streaming, showThink: showThinkSetting = true, onRegenerate, onContinue, onSwipe, onEditSave, onDelete, onSpeak, speaking, speaker, group }) {
  const [showThink, setShowThink] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const isUser = msg.sender === 'user';
  const text = getMessageText(msg);
  const think = showThinkSetting ? getMessageThink(msg) : '';
  const nVariants = isUser ? 1 : (msg.variations ? msg.variations.length : 1);
  const isStreamingThis = msg.isStreaming;

  const html = isStreamingThis ? renderStreaming(text) : renderFinal(text);

  function beginEdit() { setDraft(getMessageText(msg)); setEditing(true); }
  function commitEdit() { onEditSave(draft); setEditing(false); }
  function cancelEdit() { setEditing(false); }

  return (
    <div className={'flex flex-col gap-1 ' + (isUser ? 'items-end' : 'items-start')}>
      {!isUser && msg.offscreen && (
        <div className="max-w-[85%] px-1 text-[11px] italic text-em-text-dim">📔 While you were away: {msg.offscreen}</div>
      )}
      {!isUser && group && speaker && (
        <div className="flex items-center gap-1.5 px-1 text-xs text-em-text-dim">
          <span className="flex h-5 w-5 items-center justify-center overflow-hidden rounded-full bg-em-panel">
            {speaker.avatar ? <img src={avatarUrl(speaker.avatar)} alt="" className="h-full w-full object-cover" /> : '👤'}
          </span>
          <span className="font-medium text-em-text">{displayName(speaker)}</span>
        </div>
      )}
      <div
        className={
          'max-w-[85%] rounded-2xl px-4 py-3 leading-relaxed shadow ' +
          (isUser ? 'bg-em-accent/15 text-em-text' : 'border border-white/10 bg-white/[0.04] text-em-text')
        }
      >
        {!isUser && think && !editing && (
          <details open={showThink} onToggle={(e) => setShowThink(e.target.open)} className="mb-2 rounded-lg bg-black/30 text-xs text-em-text-dim">
            <summary className="cursor-pointer select-none px-2 py-1">💭 Thoughts</summary>
            <div className="px-2 pb-2" dangerouslySetInnerHTML={{ __html: escapeHtml(think).replace(/\n/g, '<br>') }} />
          </details>
        )}
        {editing ? (
          <div className="flex w-[min(70vw,40rem)] max-w-full flex-col gap-2">
            <textarea
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); commitEdit(); }
                else if (e.key === 'Escape') cancelEdit();
              }}
              rows={Math.min(14, Math.max(2, draft.split('\n').length))}
              className="w-full resize-y rounded-lg border border-white/10 bg-em-bg/60 px-3 py-2 text-em-text focus:border-em-accent/50 focus:outline-none"
            />
            <div className="flex items-center justify-end gap-2 text-sm">
              <button onClick={cancelEdit} className="rounded-lg px-3 py-1 text-em-text-dim transition hover:text-em-text">Cancel</button>
              <button onClick={commitEdit} className="rounded-lg bg-em-accent px-3 py-1 font-semibold text-em-bg transition hover:bg-emerald-300">Save</button>
            </div>
          </div>
        ) : isStreamingThis && !text ? (
          <span className="inline-flex gap-1">
            <span className="h-2 w-2 animate-bounce rounded-full bg-em-text-dim [animation-delay:-0.2s]" />
            <span className="h-2 w-2 animate-bounce rounded-full bg-em-text-dim [animation-delay:-0.1s]" />
            <span className="h-2 w-2 animate-bounce rounded-full bg-em-text-dim" />
          </span>
        ) : (
          <div className="chat-md" dangerouslySetInnerHTML={{ __html: html }} />
        )}
      </div>

      {/* Controls (not while this message streams or is being edited) */}
      {!isStreamingThis && !editing && (
        <div className="flex items-center gap-2 px-1 text-em-text-dim opacity-70 transition hover:opacity-100">
          {!isUser && nVariants > 1 && (
            <span className="flex items-center gap-1 text-xs">
              <button onClick={() => onSwipe(-1)} className="hover:text-em-text">‹</button>
              {(msg.activeVariant || 0) + 1}/{nVariants}
              <button onClick={() => onSwipe(1)} className="hover:text-em-text">›</button>
            </span>
          )}
          {!isUser && <button onClick={onRegenerate} disabled={streaming} className="text-sm transition hover:text-em-accent disabled:opacity-40" title="Regenerate">🔄</button>}
          {!isUser && <button onClick={onContinue} disabled={streaming} className="text-sm transition hover:text-em-accent disabled:opacity-40" title="Continue this reply">⏩</button>}
          {!isUser && ttsSupported() && <button onClick={onSpeak} className={'text-sm transition hover:text-em-accent ' + (speaking ? 'text-em-accent' : '')} title={speaking ? 'Stop' : 'Read aloud'}>{speaking ? '⏹' : '🔊'}</button>}
          <button onClick={beginEdit} disabled={streaming} className="text-sm transition hover:text-em-accent disabled:opacity-40" title="Edit message">✎</button>
          <button onClick={onDelete} disabled={streaming} className="text-sm transition hover:text-red-400 disabled:opacity-40" title="Delete this and following messages">🗑</button>
        </div>
      )}
    </div>
  );
}
