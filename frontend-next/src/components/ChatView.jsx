import { useEffect, useMemo, useRef, useState } from 'react';
import { saveCharacter, savePersona } from '../lib/db.js';
import MemoriesModal from './MemoriesModal.jsx';
import ParticleField from './ParticleField.jsx';
import { PARTICLE_EFFECTS } from '../lib/particles.js';
import {
  genId, displayName, getMessageText, getMessageThink, expandPlaceholders,
  buildMessagesArray, buildGroupMessages, streamCompletion, splitThink, summarizeChat, collectCompletion,
  extractPhotoTag, stripPhotoTag, buildPhotoUrl, getMessageImage, getMessageImageLoading, buildWallpaperUrl,
} from '../lib/chat.js';
import { generateAppearance } from '../lib/aigen.js';
import { fetchAsDataUrl } from '../lib/api.js';
import { defaultRelationship, buildRelationshipUpdateMessages, parseRelationship } from '../lib/relationship.js';
import { presenceFor, buildPresenceText, formatElapsed } from '../lib/presence.js';
import { buildOffscreenMessages, cleanOffscreen } from '../lib/offscreen.js';
import { DEFAULT_SETTINGS, resolveModel } from '../lib/settings.js';
import { renderStreaming, renderFinal, escapeHtml } from '../lib/format.js';
import { avatarUrl, isVideoUrl } from '../lib/media.js';
import { accentFromImage } from '../lib/palette.js';
import { applyDesignSettings } from '../lib/design.js';
import MessageBubble from './ChatMessage.jsx';
import {
  SendIcon, StopIcon, Meter, Pill, PencilIcon, TrashIcon,
  MemoryIcon, MusicIcon, SparkleIcon, CastIcon, PersonaIcon, MoodIcon,
  BackIcon, HeartIcon, GearIcon, ChatsIcon, PlusIcon, PlayIcon, PauseIcon, PinIcon,
} from './icons.jsx';
import useMusic from '../hooks/useMusic.js';
import useTts from '../hooks/useTts.js';
import useSuggestions from '../hooks/useSuggestions.js';
import useChatScroll from '../hooks/useChatScroll.js';
import useLibrary from '../hooks/useLibrary.js';

// Parse the creation timestamp baked into a `chat-<ms>` id (newest first).
function chatTs(id) {
  const n = parseInt(String(id || '').replace('chat-', ''), 10);
  return Number.isNaN(n) ? 0 : n;
}

// After this idle gap, a character proactively reaches out when you reopen the chat.
const PROACTIVE_GAP_MS = 3 * 60 * 60 * 1000;

function newChat(char, scenarioIndex = 0) {
  const sc = char.scenarios && char.scenarios[scenarioIndex];
  const greeting = (sc && sc.text) || (char.scenarios && char.scenarios[0] && char.scenarios[0].text) || char.first_mes || '';
  const history = [];
  if (greeting) {
    history.push({
      id: genId(true), sender: 'ai', type: 'dialog', speakerId: char.id, activeVariant: 0,
      variations: [{ main: expandPlaceholders(greeting, displayName(char), 'User'), think: null }],
    });
  }
  return { id: 'chat-' + Date.now(), name: 'Chat ' + new Date().toLocaleString(), history, memories: '', participants: [char.id], activePersonaId: null, mood: null };
}

// Slash commands surfaced in the composer (type "/" to filter). arg='' = runs immediately.
const SLASH_COMMANDS = [
  { cmd: 'me',       arg: '<action>', icon: '🎬', desc: 'Send an action in italics' },
  { cmd: 'ooc',      arg: '<note>',   icon: '💬', desc: 'Out-of-character aside' },
  { cmd: 'roll',     arg: '[NdM]',    icon: '🎲', desc: 'Roll dice — e.g. 2d6, d20, 3d8+1' },
  { cmd: 'retry',    arg: '',         icon: '↻',  desc: 'Regenerate the last reply' },
  { cmd: 'continue', arg: '',         icon: '⏩', desc: 'Continue the last reply' },
  { cmd: 'new',      arg: '',         icon: '✚',  desc: 'Start a new chat' },
];

export default function ChatView({ character, onBack, onEdit, settings = DEFAULT_SETTINGS, onOpenSettings }) {
  const [char, setChar] = useState(character);
  const [chatId, setChatId] = useState(null);
  const [streaming, setStreaming] = useState(false);
  const [input, setInput] = useState('');
  const [slashIdx, setSlashIdx] = useState(0); // highlighted slash-command suggestion
  const [showMemories, setShowMemories] = useState(false);
  const [showChats, setShowChats] = useState(false);   // chat-session list panel
  const [showPinned, setShowPinned] = useState(false); // pinned-messages panel
  const [showWallpaper, setShowWallpaper] = useState(false); // per-chat wallpaper panel
  const [showScenarioPick, setShowScenarioPick] = useState(false); // greeting picker on + New chat
  const [undo, setUndo] = useState(null);              // { fromIndex, messages } after a delete
  const sug = useSuggestions(settings);                // suggested-reply state + helpers
  const tts = useTts();                                // text-to-speech (speakingId + helpers)
  const { personas, setPersonas, charsById, setCharsById } = useLibrary(); // personas + character library
  const { scrollRef, onScroll, stick } = useChatScroll();                  // message-list auto-scroll
  const [showEffects, setShowEffects] = useState(false); // ambient-effects picker
  const [showCast, setShowCast] = useState(false);       // group cast panel
  const [showInner, setShowInner] = useState(false);     // relationship + diary viewer
  const [, force] = useState(0);          // re-render trigger for in-place mutations
  const rerender = () => force((n) => n + 1);
  const controllerRef = useRef(null);
  const inputRef = useRef(null);
  const proactiveTriedRef = useRef(false); // ensures the "texts first" check fires once per open
  const autoSumRef = useRef(false);

  // Background music (self-contained controller).
  const {
    showMusic, setShowMusic, musicUrl, setMusicUrl, musicPlaying,
    showDancer, setShowDancer, musicVolume, setMusicVolume,
    playMusic, toggleMusic, stopMusic,
  } = useMusic(char);

  const chats = char.chats || (char.chats = {});

  // Reflect edits made via the editor (parent passes a refreshed character).
  useEffect(() => { setChar(character); }, [character]);

  // Per-character accent: tint the whole UI with a vibrant colour pulled from the
  // avatar while this chat is open; restore the user's global accent on leave/switch.
  useEffect(() => {
    if (!settings.charAccent || !char.avatar) return undefined;
    let cancelled = false;
    accentFromImage(avatarUrl(char.avatar)).then((p) => {
      if (cancelled || !p) return;
      const root = document.documentElement.style;
      root.setProperty('--color-em-accent', p.accent);
      root.setProperty('--color-em-accent-dim', p.dim);
      root.setProperty('--accent-rgb', p.rgb);
    });
    return () => { cancelled = true; applyDesignSettings(settings); };
  }, [char.id, settings.charAccent]); // eslint-disable-line react-hooks/exhaustive-deps

  // Pick most-recent existing chat, or create one.
  useEffect(() => {
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

  function startNewChat(scenarioIndex = 0) {
    const c = newChat(char, scenarioIndex);
    chats[c.id] = c;
    setChatId(c.id);
    setShowChats(false);
    setShowScenarioPick(false);
    setUndo(null);
    sug.clear();
    tts.stop();
    saveCharacter(char);
  }

  // With multiple greetings, ask which to open; otherwise start straight away.
  function newChatClicked() {
    if ((char.scenarios || []).length > 1) setShowScenarioPick(true);
    else startNewChat(0);
  }

  // Fork: branch a new chat from the conversation up to and including this message.
  function newChatFromHere(msg) {
    if (!chat) return;
    const idx = chat.history.indexOf(msg);
    if (idx === -1) return;
    const c = newChat(char, 0);
    c.history = chat.history.slice(0, idx + 1).map((m) => JSON.parse(JSON.stringify(m)));
    c.name = 'Fork · ' + (chat.name || 'chat');
    c.participants = Array.isArray(chat.participants) ? [...chat.participants] : c.participants;
    c.activePersonaId = chat.activePersonaId || null;
    c.memories = chat.memories || '';
    if (chat.relationship) c.relationship = JSON.parse(JSON.stringify(chat.relationship));
    chats[c.id] = c;
    setChatId(c.id);
    setShowChats(false);
    setUndo(null);
    sug.clear();
    tts.stop();
    saveCharacter(char);
  }

  // Pin / unpin a message — pinned messages are kept in the prompt context.
  function togglePin(msg) {
    msg.pinned = !msg.pinned;
    saveCharacter(char);
    rerender();
  }
  function jumpToMessage(id) {
    setShowPinned(false);
    const el = document.getElementById('msg-' + id);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  // ── Per-chat wallpaper (Customize) ────────────────────────────────────────
  const [wpBusy, setWpBusy] = useState(false);
  function setChatWallpaper(url) {
    if (!chat) return;
    chat.background = url || '';
    saveCharacter(char);
    rerender();
  }
  async function generateChatWallpaper(promptText) {
    if (!chat || wpBusy) return;
    setWpBusy(true);
    try {
      const desc = (promptText && promptText.trim())
        || [displayName(char), char.tags].filter(Boolean).join(', ') + ', atmospheric environment';
      const dataUrl = await fetchAsDataUrl(buildWallpaperUrl(desc, settings));
      setChatWallpaper(dataUrl);
    } catch (e) {
      window.alert('Wallpaper generation failed — check your Photos provider in Settings.');
    } finally { setWpBusy(false); }
  }

  // ── Chat session list (switch / rename / delete) ──────────────────────────
  function switchChat(id) {
    if (!chats[id] || id === chatId) { setShowChats(false); return; }
    setUndo(null);
    sug.clear();
    tts.stop();
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
    stick();
    rerender();
    await runStream(msg, instruction, { seed: original, messages });
  }

  // ── Suggested replies ─────────────────────────────────────────────────────
  function pickSuggestion(text) {
    setInput(text);
    sug.clear();
    if (inputRef.current) inputRef.current.focus();
  }

  // Auto-grow the composer textarea to fit its content (capped at max-height).
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 160) + 'px';
  }, [input]);
  // Keep the highlighted slash suggestion in range as the query narrows.
  useEffect(() => { setSlashIdx(0); }, [input]);

  // ── Text-to-speech ────────────────────────────────────────────────────────
  // A message is read in its speaker's own voice, falling back to the global one.
  function voiceFor(msg) {
    const spk = speakerOf(msg);
    return (spk && spk.voiceURI) || settings.ttsVoiceURI;
  }
  function speakMessage(msg) { tts.toggle(msg, voiceFor(msg)); }

  // Ensure the chat has a relationship state so the header/prompt have something to show.
  useEffect(() => {
    if (chat && !chat.relationship) { chat.relationship = defaultRelationship(); rerender(); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatId]);

  async function runStream(aiMsg, lastUserText, opts = {}) {
    const variantIndex = aiMsg.streamingVariant != null ? aiMsg.streamingVariant : aiMsg.activeVariant;
    const seed = opts.seed || '';                 // existing text to keep + append onto (continue)
    const controller = new AbortController();
    controllerRef.current = controller;
    setStreaming(true);
    sug.clear();
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
        ...resolveModel(settings, settings.model),
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
      // If photos are on and the reply ended with a [photo: …] tag, strip it now;
      // the actual image generation runs after the text is shown (see below).
      let photoPrompt = '';
      if (v && !errored && settings.aiPhotos && v.main) {
        const ex = extractPhotoTag(v.main);
        if (ex.prompt) { v.main = ex.clean; photoPrompt = ex.prompt; v.imageLoading = true; }
      }
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
        sug.generate(char, chat, personas);
        if (settings.tts) {
          tts.autoSpeak(aiMsg, voiceFor(aiMsg));
        }
        if (photoPrompt) generatePhoto(v, charsById[aiMsg.speakerId] || char, photoPrompt);
      } else if (v && v.imageLoading) {
        v.imageLoading = false;
      }
    }
  }

  // Generate the selfie for a message variant: derive Danbooru appearance once
  // (the LLM knows famous characters), cache it on the character, then set the image.
  async function generatePhoto(v, pchar, prompt) {
    try {
      if (!pchar.appearance || !pchar.appearance.trim()) {
        try {
          const appr = await generateAppearance(
            { name: displayName(pchar), description: pchar.description, tags: pchar.tags },
            resolveModel(settings, settings.model),
          );
          if (appr) { pchar.appearance = appr; await saveCharacter(pchar === char ? char : pchar); }
        } catch (e) { /* fall back to name+tags */ }
      }
      v.image = buildPhotoUrl(pchar, prompt, settings);
    } finally {
      v.imageLoading = false;
      await saveCharacter(char);
      rerender();
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
      const bullets = await summarizeChat(char, chat, personas, resolveModel(settings, settings.summaryModelId || settings.model));
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
        resolveModel(settings, settings.model),
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
          resolveModel(settings, settings.model),
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
    stick();
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

  // Actually push a user turn + stream the reply. `send` wraps this with slash-command parsing.
  async function sendText(raw) {
    const text = String(raw || '').trim();
    if (!text || streaming || !chat) return;
    setInput('');
    setUndo(null);
    stick();
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

  function send() {
    const raw = input.trim();
    if (!raw || streaming || !chat) return;
    if (raw.startsWith('/') && handleSlash(raw)) { setInput(''); return; }
    sendText(raw);
  }

  function lastAiMessage() {
    const h = (chat && chat.history) || [];
    for (let i = h.length - 1; i >= 0; i--) if (h[i].sender === 'ai' && !h[i].isStreaming) return h[i];
    return null;
  }

  // Returns true if the raw text was a recognised slash command (and was handled).
  function handleSlash(raw) {
    const m = raw.match(/^\/(\w+)\s*([\s\S]*)$/);
    if (!m) return false;
    return runSlashCommand(m[1].toLowerCase(), (m[2] || '').trim());
  }

  function runSlashCommand(cmd, rest) {
    switch (cmd) {
      case 'me':       if (rest) sendText('*' + rest + '*'); return true;
      case 'ooc':      if (rest) sendText('(OOC: ' + rest + ')'); return true;
      case 'roll':     sendText(rollDice(rest || 'd20')); return true;
      case 'retry':
      case 'regen':    { const last = lastAiMessage(); if (last) regenerate(last); return true; }
      case 'continue': { const last = lastAiMessage(); if (last) continueMessage(last); return true; }
      case 'new':      newChatClicked(); return true;
      default:         return false;
    }
  }

  // Parse a dice spec like "2d6", "d20", "3d8+1" and return an italic action string.
  function rollDice(spec) {
    const m = String(spec).replace(/\s+/g, '').match(/^(\d*)d(\d+)([+-]\d+)?$/i);
    if (!m) return '*rolls the dice*';
    const n = Math.min(Math.max(parseInt(m[1] || '1', 10), 1), 20);
    const sides = Math.min(Math.max(parseInt(m[2], 10), 2), 1000);
    const mod = parseInt(m[3] || '0', 10);
    const rolls = [];
    let sum = 0;
    for (let i = 0; i < n; i++) { const r = 1 + Math.floor(Math.random() * sides); rolls.push(r); sum += r; }
    sum += mod;
    const detail = rolls.join(' + ') + (mod ? ' ' + m[3] : '');
    const breakdown = (n > 1 || mod) ? ` (${detail})` : '';
    return `*rolls ${n}d${sides}${m[3] || ''} → **${sum}**${breakdown}*`;
  }

  // Focus the composer and drop the caret at the very end of its current value.
  function focusInputEnd() {
    setTimeout(() => {
      const el = inputRef.current;
      if (!el) return;
      el.focus();
      const n = el.value.length;
      try { el.setSelectionRange(n, n); } catch (e) { /* ignore */ }
    }, 0);
  }

  function pickCommand(c) {
    if (c.arg) { setInput('/' + c.cmd + ' '); focusInputEnd(); }
    else { runSlashCommand(c.cmd, ''); setInput(''); }
  }

  function insertAction() {
    setInput((v) => (v ? v.replace(/\s*$/, '') + ' *action*' : '*action*'));
    focusInputEnd();
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
      style: settings.style,
      relationship: settings.relationship,
      autonomy: settings.autonomy,
      aiPhotos: settings.aiPhotos,
      pinned: chat ? chat.history.filter((m) => m.pinned).map((m) => getMessageText(m)).filter(Boolean) : [],
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
  const pinnedMsgs = history.filter((m) => m.pinned);

  // Slash-command autocomplete: only while typing the command word (no space yet).
  const slashQuery = (() => { const m = input.match(/^\/(\w*)$/); return m ? m[1].toLowerCase() : null; })();
  const slashMatches = slashQuery != null ? SLASH_COMMANDS.filter((c) => c.cmd.startsWith(slashQuery)) : [];
  const slashActive = Math.min(slashIdx, Math.max(0, slashMatches.length - 1));

  return (
    <div className="relative isolate flex h-screen flex-col">
      {((chat && chat.background) || char.background) && (
        <div className="pointer-events-none absolute inset-0 -z-10">
          <img src={avatarUrl((chat && chat.background) || char.background)} alt="" className="h-full w-full object-cover opacity-30" />
          <div className="absolute inset-0 bg-em-bg/75" />
        </div>
      )}
      <ParticleField effect={char.particleEffect} intensity={char.particleIntensityLevel} />
      {/* Header */}
      <header className="relative flex items-center gap-3 border-b border-white/10 bg-em-bg/70 px-4 py-3 backdrop-blur-xl">
        <button onClick={onBack} title="Back" className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1.5 text-sm text-em-text-dim transition duration-150 hover:-translate-y-0.5 hover:border-em-accent/40 hover:bg-white/[0.06] hover:text-em-text active:scale-95"><BackIcon /><span className="hidden sm:inline">Back</span></button>
        <div className={'h-9 w-9 overflow-hidden rounded-full bg-em-panel ' + (musicPlaying ? 'beat-ring' : '')}>
          {char.avatar
            ? <img src={avatarUrl(char.avatar)} alt="" className={'h-full w-full object-cover ' + (musicPlaying ? 'avatar-dancing' : '')} />
            : <div className="flex h-full w-full items-center justify-center">👤</div>}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate font-semibold">{displayName(char)}</span>
            {musicPlaying && (
              <span className="eq shrink-0" title="Music playing" aria-label="music playing"><i /><i /><i /><i /></span>
            )}
          </div>
          {chat && chat.memories && <div className="flex items-center gap-1 text-[11px] text-em-accent"><MemoryIcon /> memory active</div>}
        </div>
        {settings.presence && (() => {
          const p = presenceFor(char.id);
          const asleep = p.state === 'asleep';
          return (
            <span
              title={`${displayName(char)} is ${p.label}`}
              aria-label={`presence: ${p.label}`}
              className={'hidden items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium capitalize sm:flex ' +
                (asleep ? 'border-indigo-400/30 bg-indigo-400/10 text-indigo-200' : 'border-em-accent/30 bg-em-accent/10 text-em-accent')}
            >
              <span className={'h-1.5 w-1.5 rounded-full ' + (asleep ? 'bg-indigo-300' : 'bg-em-accent')} />
              {p.label}
            </span>
          );
        })()}
        {settings.relationship && chat && chat.relationship && (
          <button
            onClick={() => setShowInner(true)}
            title="Inner life — relationship & diary"
            className="hidden items-center gap-1 rounded-lg border border-white/10 px-2 py-1 text-xs text-em-text-dim transition hover:border-em-accent/40 hover:text-rose-300 hover:border-rose-300/40 sm:flex"
          >
            <span className="text-rose-400"><HeartIcon /></span> {chat.relationship.affection}
          </button>
        )}
        {onEdit && <button onClick={() => onEdit(char)} title="Edit character" className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1.5 text-sm text-em-text-dim transition duration-150 hover:-translate-y-0.5 hover:border-em-accent/40 hover:bg-white/[0.06] hover:text-em-text active:scale-95"><PencilIcon /><span className="hidden sm:inline">Edit</span></button>}
        {onOpenSettings && <button onClick={onOpenSettings} title="Settings" className="grid h-9 w-9 place-items-center rounded-lg border border-white/10 bg-white/[0.03] text-em-text-dim transition duration-150 hover:-translate-y-0.5 hover:border-em-accent/40 hover:bg-white/[0.06] hover:text-em-text active:scale-95"><GearIcon /></button>}
        <button onClick={() => { setShowWallpaper((v) => !v); setShowPinned(false); }} title="Wallpaper" className={'grid h-9 w-9 place-items-center rounded-lg border transition ' + (showWallpaper ? 'border-em-accent/50 text-em-accent' : 'border-white/10 text-em-text-dim hover:border-em-accent/40 hover:text-em-text')}><SparkleIcon /></button>
        {pinnedMsgs.length > 0 && (
          <button onClick={() => { setShowPinned((v) => !v); setShowWallpaper(false); }} title="Pinned messages" className={'inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-sm transition ' + (showPinned ? 'border-em-accent/50 text-em-accent' : 'border-white/10 text-em-text-dim hover:border-em-accent/40 hover:text-em-text')}><PinIcon /> {pinnedMsgs.length}</button>
        )}
        <button onClick={() => setShowChats((v) => !v)} title="Chats" className={'inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm transition ' + (showChats ? 'border-em-accent/50 text-em-accent' : 'border-white/10 text-em-text-dim hover:border-em-accent/40 hover:text-em-text')}><ChatsIcon /><span className="hidden sm:inline">Chats</span> ({sessions.length})</button>
        <button onClick={newChatClicked} title="New chat" className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1.5 text-sm text-em-text-dim transition duration-150 hover:-translate-y-0.5 hover:border-em-accent/40 hover:bg-white/[0.06] hover:text-em-text active:scale-95"><PlusIcon /><span className="hidden sm:inline">New chat</span></button>

        {/* Chat session list */}
        {showChats && (
          <>
            <div className="fixed inset-0 z-30" onClick={() => setShowChats(false)} />
            <div className="pop-in absolute right-3 top-full z-40 mt-1max-h-[70vh] w-72 overflow-y-auto rounded-xl border border-white/10 bg-em-panel p-1.5 shadow-2xl">
              <div className="flex items-center justify-between px-2 py-1.5 text-xs font-semibold uppercase tracking-wide text-em-text-dim">
                <span>Chats</span>
                <button onClick={newChatClicked} className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-em-accent transition hover:bg-em-accent/10"><PlusIcon /> New</button>
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
                    <button onClick={() => renameChat(s.id)} title="Rename chat" className="grid h-7 w-7 place-items-center rounded text-em-text-dim opacity-0 transition hover:text-em-text group-hover:opacity-100"><PencilIcon /></button>
                    <button onClick={() => deleteChatSession(s.id)} title="Delete chat" className="grid h-7 w-7 place-items-center rounded text-em-text-dim opacity-0 transition hover:text-red-400 group-hover:opacity-100"><TrashIcon /></button>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* Pinned messages */}
        {showPinned && (
          <>
            <div className="fixed inset-0 z-30" onClick={() => setShowPinned(false)} />
            <div className="pop-in absolute right-3 top-full z-40 mt-1max-h-[70vh] w-80 overflow-y-auto rounded-xl border border-white/10 bg-em-panel p-1.5 shadow-2xl">
              <div className="px-2 py-1.5 text-xs font-semibold uppercase tracking-wide text-em-text-dim">📌 Pinned</div>
              {pinnedMsgs.length === 0 && <p className="px-2 py-3 text-center text-sm text-em-text-dim">No pinned messages.</p>}
              {pinnedMsgs.map((m) => (
                <div key={m.id} className="group flex items-start gap-1 rounded-lg px-2 py-1.5 hover:bg-white/5">
                  <button onClick={() => jumpToMessage(m.id)} className="min-w-0 flex-1 text-left">
                    <div className="line-clamp-2 text-sm text-em-text">{stripPhotoTag(getMessageText(m)).slice(0, 160) || '(empty)'}</div>
                    <div className="text-[11px] text-em-text-dim">{m.sender === 'user' ? 'You' : displayName(speakerOf(m))}</div>
                  </button>
                  <button onClick={() => togglePin(m)} title="Unpin" className="grid h-7 w-7 shrink-0 place-items-center rounded text-em-text-dim opacity-0 transition hover:text-red-400 group-hover:opacity-100"><PinIcon /></button>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Per-chat wallpaper (Customize) */}
        {showWallpaper && (
          <>
            <div className="fixed inset-0 z-30" onClick={() => setShowWallpaper(false)} />
            <div className="pop-in absolute right-3 top-full z-40 mt-1w-80 rounded-xl border border-white/10 bg-em-panel p-3 shadow-2xl">
              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-em-text-dim">Wallpaper (this chat)</div>
              <div className="mb-2 h-20 w-full overflow-hidden rounded-lg border border-white/10 bg-em-bg">
                {chat && chat.background
                  ? <img src={avatarUrl(chat.background)} alt="" className="h-full w-full object-cover" />
                  : <div className="flex h-full w-full items-center justify-center text-xs text-em-text-dim/50">{char.background ? 'using character background' : 'none'}</div>}
              </div>
              <input
                id="wallpaper-prompt"
                placeholder="Describe a scene to generate…"
                className="mb-2 w-full rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-sm text-em-text placeholder:text-em-text-dim/60 focus:border-em-accent/50 focus:outline-none"
                onKeyDown={(e) => { if (e.key === 'Enter') generateChatWallpaper(e.currentTarget.value); }}
              />
              <div className="flex items-center gap-2">
                <button onClick={() => generateChatWallpaper(document.getElementById('wallpaper-prompt').value)} disabled={wpBusy} className="flex-1 rounded-lg bg-em-accent px-3 py-1.5 text-sm font-semibold text-em-bg transition hover:bg-emerald-300 disabled:opacity-40">{wpBusy ? 'generating…' : '✨ Generate'}</button>
                {chat && chat.background && <button onClick={() => setChatWallpaper('')} className="rounded-lg border border-white/10 px-3 py-1.5 text-sm text-em-text-dim transition hover:text-red-400">Clear</button>}
              </div>
            </div>
          </>
        )}
      </header>

      {/* Tools: persona · mood · memories · music */}
      {chat && (
        <>
        <div className="flex flex-wrap items-center gap-2 border-b border-white/5 bg-white/[0.02] px-4 py-2 text-sm">
          <label className="flex items-center gap-1.5 text-em-text-dim">
            <PersonaIcon /><span className="hidden sm:inline">You as</span>
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
            <MoodIcon /><span className="hidden sm:inline">Mood</span>
            <select
              value={chat.mood || ''}
              onChange={(e) => setMood(e.target.value)}
              className="rounded-lg border border-white/10 bg-em-panel px-2 py-1 text-em-text focus:border-em-accent/50 focus:outline-none"
            >
              <option value="">none</option>
              {MOODS.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </label>

          <Pill onClick={() => setShowMemories(true)} active={!!(chat.memories && chat.memories.trim())} title="Memories">
            <MemoryIcon /> Memories
          </Pill>
          <Pill onClick={() => setShowMusic((v) => !v)} active={musicPlaying} title="Background music">
            <MusicIcon /> Music
          </Pill>
          <Pill onClick={() => setShowEffects((v) => !v)} active={!!(char.particleEffect && char.particleEffect !== 'none')} title="Ambient effects">
            <SparkleIcon /> Effects
          </Pill>
          <Pill onClick={() => setShowCast((v) => !v)} active={isGroup()} title="Group cast">
            <CastIcon /> Cast{isGroup() ? ' (' + activeParticipants().length + ')' : ''}
          </Pill>
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
            <button onClick={() => (musicPlaying ? toggleMusic() : playMusic())} title={musicPlaying ? 'Pause' : 'Play'} className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-em-text-dim transition hover:border-em-accent/40 hover:text-em-text">
              {musicPlaying ? <PauseIcon /> : <PlayIcon />}{musicPlaying ? 'Pause' : 'Play'}
            </button>
            <button onClick={stopMusic} title="Stop" className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-em-text-dim transition hover:border-em-accent/40 hover:text-em-text"><StopIcon /> Stop</button>
            <div className="flex items-center gap-2 text-em-text-dim" title="Volume">
              <span className="text-base">🔉</span>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={musicVolume}
                onChange={(e) => setMusicVolume(parseFloat(e.target.value))}
                className="h-1.5 w-28 cursor-pointer accent-em-accent"
              />
            </div>
          </div>
        )}
        </>
      )}

      {/* Messages */}
      <div ref={scrollRef} onScroll={onScroll} style={{ gap: 'var(--message-spacing)' }} className="mx-auto flex w-full max-w-3xl flex-1 flex-col overflow-y-auto px-4 py-6">
        {history.map((m) => (
          <MessageBubble
            key={m.id}
            anchorId={'msg-' + m.id}
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
            speaking={tts.speakingId === m.id}
            onFork={() => newChatFromHere(m)}
            onPin={() => togglePin(m)}
            pinned={!!m.pinned}
            speaker={speakerOf(m)}
            group={isGroup()}
          />
        ))}
        {history.length === 0 && <div className="py-20 text-center text-em-text-dim">Say hello to start the scene…</div>}
      </div>

      {/* Now-playing corner: a real dance clip if the character has one, else a calm framed avatar. */}
      {musicPlaying && showDancer && (char.danceUrl || char.avatar) && (
        <div className="dancer-in pointer-events-none absolute bottom-28 left-4 z-20 flex flex-col items-center sm:left-6">
          <div className="group/dancer pointer-events-auto relative">
            <button
              onClick={() => setShowDancer(false)}
              title="Hide"
              className="absolute -right-2 -top-2 z-10 grid h-6 w-6 place-items-center rounded-full border border-white/15 bg-em-bg/80 text-xs text-em-text-dim opacity-0 backdrop-blur transition hover:text-em-text group-hover/dancer:opacity-100"
            >
              ✕
            </button>
            {char.danceUrl ? (
              isVideoUrl(char.danceUrl) ? (
                <video src={char.danceUrl} autoPlay loop muted playsInline className="beat-ring h-40 w-32 rounded-2xl border border-em-accent/30 object-cover shadow-2xl" />
              ) : (
                <img src={avatarUrl(char.danceUrl)} alt="" className="beat-ring h-40 w-32 rounded-2xl border border-em-accent/30 object-cover shadow-2xl" />
              )
            ) : (
              <div className="beat-ring h-28 w-28 overflow-hidden rounded-2xl border border-em-accent/30 bg-em-panel shadow-2xl sm:h-32 sm:w-32">
                <img src={avatarUrl(char.avatar)} alt="" className="h-full w-full object-cover" />
              </div>
            )}
          </div>
          {/* now-playing pill */}
          <div className="pointer-events-auto mt-2 flex items-center gap-2 rounded-full border border-white/10 bg-em-bg/70 px-3 py-1 shadow-lg backdrop-blur">
            <span className="eq"><i /><i /><i /><i /></span>
            <span className="max-w-[7rem] truncate text-xs font-medium text-em-text">{displayName(char)}</span>
          </div>
        </div>
      )}

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
        {settings.replyOptions && !streaming && chat && (sug.suggesting || sug.suggestions.length > 0) && (
          <div className="mx-auto flex w-full max-w-3xl flex-wrap gap-2 px-4 pt-3">
            {sug.suggesting && sug.suggestions.length === 0 ? (
              <span className="rounded-full border border-white/10 px-3 py-1.5 text-sm text-em-text-dim">💡 thinking of replies…</span>
            ) : (
              sug.suggestions.map((opt, i) => (
                <button
                  key={i}
                  onClick={() => pickSuggestion(opt)}
                  className="max-w-full truncate rounded-full border border-em-accent/30 bg-em-accent/10 px-3 py-1.5 text-left text-sm text-em-text transition hover:border-em-accent/60 hover:bg-em-accent/20"
                  title={opt}
                >
                  💬 {opt}
                </button>
              ))
            )}
          </div>
        )}
        <div className="relative mx-auto w-full max-w-3xl px-4 py-3">
          {/* Slash-command autocomplete */}
          {slashMatches.length > 0 && (
            <div className="absolute bottom-full left-4 right-4 mb-2 overflow-hidden rounded-xl glass-panel p-1.5 shadow-2xl backdrop-blur">
              <div className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-em-text-dim">Commands</div>
              {slashMatches.map((c, i) => (
                <button
                  key={c.cmd}
                  onMouseDown={(e) => { e.preventDefault(); pickCommand(c); }}
                  onMouseEnter={() => setSlashIdx(i)}
                  className={'flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left text-sm transition ' + (i === slashActive ? 'bg-em-accent/15' : 'hover:bg-white/5')}
                >
                  <span className="w-5 text-center">{c.icon}</span>
                  <span className={'font-medium ' + (i === slashActive ? 'text-em-accent' : 'text-em-text')}>/{c.cmd}</span>
                  {c.arg && <span className="text-xs text-em-text-dim/80">{c.arg}</span>}
                  <span className="ml-auto truncate text-xs text-em-text-dim">{c.desc}</span>
                </button>
              ))}
            </div>
          )}
          <div className="flex items-end gap-2">
            {/* quick tools */}
            <div className="flex items-center gap-1 pb-0.5">
              <button onClick={() => { setInput((v) => (v === '/' ? '' : '/')); focusInputEnd(); }} title="Commands (/)" className={'grid h-9 w-9 place-items-center rounded-xl border transition ' + (input === '/' ? 'border-em-accent/50 text-em-accent' : 'border-white/10 text-em-text-dim hover:border-em-accent/40 hover:text-em-accent')}>⌘</button>
              <button onClick={insertAction} title="Insert action (*…*)" className="grid h-9 w-9 place-items-center rounded-xl border border-white/10 text-em-text-dim transition hover:border-em-accent/40 hover:text-em-accent"><span className="italic">A</span></button>
              <button onClick={() => sendText(rollDice('d20'))} disabled={streaming} title="Roll a d20" className="grid h-9 w-9 place-items-center rounded-xl border border-white/10 text-em-text-dim transition hover:border-em-accent/40 hover:text-em-accent disabled:opacity-40">🎲</button>
            </div>
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (slashMatches.length > 0) {
                  if (e.key === 'ArrowDown') { e.preventDefault(); setSlashIdx((slashActive + 1) % slashMatches.length); return; }
                  if (e.key === 'ArrowUp') { e.preventDefault(); setSlashIdx((slashActive - 1 + slashMatches.length) % slashMatches.length); return; }
                  if (e.key === 'Tab' || (e.key === 'Enter' && !e.shiftKey)) { e.preventDefault(); pickCommand(slashMatches[slashActive]); return; }
                  if (e.key === 'Escape') { e.preventDefault(); setInput(''); return; }
                }
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
              }}
              rows={1}
              placeholder={`Message ${displayName(char)}…   ( / for commands )`}
              className="max-h-40 min-h-[44px] flex-1 resize-none rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-em-text placeholder:text-em-text-dim/60 focus:border-em-accent/50 focus:outline-none"
            />
            {streaming ? (
              <button onClick={stop} className="flex items-center gap-2 rounded-xl bg-red-500/80 px-5 py-3 font-semibold text-white transition hover:bg-red-500"><StopIcon /> Stop</button>
            ) : (
              <button onClick={send} disabled={!input.trim()} className="flex items-center gap-2 rounded-xl bg-em-accent px-5 py-3 font-semibold text-em-bg transition enabled:hover:bg-emerald-300 disabled:opacity-40">Send <SendIcon /></button>
            )}
          </div>
        </div>
      </div>

      {showMemories && chat && (
        <MemoriesModal char={char} chat={chat} personas={personas} onSave={saveMemories} onClose={() => setShowMemories(false)} />
      )}

      {showScenarioPick && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" onClick={() => setShowScenarioPick(false)}>
          <div className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-3xl glass-panel p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold">Start a new chat</h2>
              <button onClick={() => setShowScenarioPick(false)} className="rounded-lg px-3 py-1.5 text-em-text-dim transition hover:text-em-text">✕</button>
            </div>
            <p className="mb-3 text-sm text-em-text-dim">Choose a greeting to open with:</p>
            <div className="space-y-2">
              {(char.scenarios || []).map((s, i) => (
                <button
                  key={i}
                  onClick={() => startNewChat(i)}
                  className="block w-full rounded-xl border border-white/10 bg-white/[0.03] p-3 text-left transition hover:border-em-accent/50 hover:bg-em-accent/5"
                >
                  <div className="mb-1 text-sm font-semibold text-em-text">{s.name || 'Scenario ' + (i + 1)}</div>
                  <div className="line-clamp-2 text-xs text-em-text-dim">{(s.text || '').slice(0, 160)}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {showInner && chat && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" onClick={() => setShowInner(false)}>
          <div className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-3xl glass-panel p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-lg font-bold"><span className="text-rose-400"><HeartIcon /></span> {displayName(char)} — inner life</h2>
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
