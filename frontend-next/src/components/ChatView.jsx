import { useEffect, useMemo, useRef, useState, Fragment } from 'react';
import { saveCharacter, savePersona, deletePersona } from '../lib/db.js';
import MemoriesModal from './MemoriesModal.jsx';
import PersonaModal from './PersonaModal.jsx';
import Avatar from './Avatar.jsx';
import ParticleField from './ParticleField.jsx';
import { PARTICLE_EFFECTS } from '../lib/particles.js';
import {
  genId, displayName, getMessageText, getMessageThink, expandPlaceholders,
  buildMessagesArray, buildGroupMessages, streamCompletion, splitThink, summarizeChat, collectCompletion,
  extractPhotoTag, extractImagePrompt, stripPhotoTag, buildPhotoUrl, buildVideoUrl, getMessageImage, getMessageImageLoading, buildWallpaperUrl, isPhotoRequest, impersonateReply,
} from '../lib/chat.js';
import { generateAppearance, tagsFromText, tagsFromScene } from '../lib/aigen.js';
import { fetchAsDataUrl } from '../lib/api.js';
import { defaultRelationship, buildRelationshipUpdateMessages, parseRelationship, stageFor, REL_STAGES, trustEffect, tensionEffect } from '../lib/relationship.js';
import { buildFactsUpdateMessages, parseFacts } from '../lib/memory.js';
import { archetypeRelationship } from '../lib/personality.js';
import { presenceFor, buildPresenceText, formatElapsed } from '../lib/presence.js';
import { buildOffscreenMessages, cleanOffscreen } from '../lib/offscreen.js';
import { DEFAULT_SETTINGS, resolveModel, fetchAvailableModels } from '../lib/settings.js';
import { renderStreaming, renderFinal, escapeHtml } from '../lib/format.js';
import { avatarUrl, isVideoUrl } from '../lib/media.js';
import { accentFromImage } from '../lib/palette.js';
import { applyDesignSettings } from '../lib/design.js';
import { speak, cancelSpeech, ttsSupported } from '../lib/tts.js';
import { Phone, PhoneOff, Mic, MicOff, PanelRight, ArrowDown, Clapperboard, Download as DownloadGlyph, PenLine, Images, Folder, Dices } from 'lucide-react';
import MessageBubble from './ChatMessage.jsx';
import {
  SendIcon, StopIcon, Meter, Pill, PencilIcon, TrashIcon,
  MemoryIcon, MusicIcon, SparkleIcon, WallpaperIcon, CastIcon, PersonaIcon, MoodIcon,
  BackIcon, HeartIcon, GearIcon, ChatsIcon, PlusIcon, PlayIcon, PauseIcon, PinIcon, CheckIcon, SearchIcon, DownloadIcon, ContinueIcon,
} from './icons.jsx';
import useMusic from '../hooks/useMusic.js';
import useTts from '../hooks/useTts.js';
import useSuggestions from '../hooks/useSuggestions.js';
import useChatScroll from '../hooks/useChatScroll.js';
import useLibrary from '../hooks/useLibrary.js';

// A friendly day label for the in-chat date dividers.
function dayLabel(ts) {
  const d = new Date(ts);
  const today = new Date();
  const yest = new Date(); yest.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === yest.toDateString()) return 'Yesterday';
  return d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: d.getFullYear() === today.getFullYear() ? undefined : 'numeric' });
}

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
  const seed = archetypeRelationship(char.archetype);
  return {
    id: 'chat-' + Date.now(), name: 'Chat ' + new Date().toLocaleString(), history,
    memories: '', participants: [char.id], activePersonaId: null, mood: null,
    relationship: seed ? { affection: 50, trust: 50, tension: 10, mood: '', beats: [], ...seed } : undefined,
  };
}

// Director quick-actions — one-tap storytelling nudges sent as a stage direction.
const DIRECTOR_ACTIONS = [
  { icon: '⏭', label: 'Time skip', text: 'skip ahead in time; briefly narrate the transition, then continue the scene' },
  { icon: '🌪', label: 'Plot twist', text: 'introduce an unexpected but fitting twist into the scene right now' },
  { icon: '🗺', label: 'Describe scene', text: 'pause and vividly describe the current surroundings, atmosphere and mood' },
  { icon: '🔥', label: 'Raise the stakes', text: 'raise the tension and stakes — make something happen that demands a reaction' },
  { icon: '🌙', label: 'New scene', text: 'transition to a new scene or location; set it up in a sentence or two, then continue' },
  { icon: '🎬', label: 'Wrap up scene', text: 'bring the current scene to a natural, satisfying close' },
];

// Slash commands surfaced in the composer (type "/" to filter). arg='' = runs immediately.
const SLASH_COMMANDS = [
  { cmd: 'me',       arg: '<action>', icon: '🎬', desc: 'Send an action in italics' },
  { cmd: 'ooc',      arg: '<note>',   icon: '💬', desc: 'Out-of-character aside' },
  { cmd: 'roll',     arg: '[NdM]',    icon: '🎲', desc: 'Roll dice — e.g. 2d6, d20, 3d8+1' },
  { cmd: 'retry',    arg: '',         icon: '↻',  desc: 'Regenerate the last reply' },
  { cmd: 'continue', arg: '',         icon: '⏩', desc: 'Continue the last reply' },
  { cmd: 'new',      arg: '',         icon: '✚',  desc: 'Start a new chat' },
  { cmd: 'photo',    arg: '<tags>',   icon: '🖼', desc: 'Generate a photo from your own tags' },
  { cmd: 'photoraw', arg: '<prompt>', icon: '🖼', desc: 'Generate from your exact prompt (verbatim, no extras)' },
  { cmd: 'video',    arg: '<tags>',   icon: '🎞', desc: 'Animate a short video selfie (ComfyUI + SVD)' },
];

export default function ChatView({ character, onBack, onEdit, settings = DEFAULT_SETTINGS, onOpenSettings, onChangeModel }) {
  const [char, setChar] = useState(character);
  const [chatId, setChatId] = useState(null);
  const [streaming, setStreaming] = useState(false);
  const [input, setInput] = useState('');
  const [slashIdx, setSlashIdx] = useState(0); // highlighted slash-command suggestion
  const [showMemories, setShowMemories] = useState(false);
  const [showChats, setShowChats] = useState(false);   // chat-session list panel
  const [showPinned, setShowPinned] = useState(false); // pinned-messages panel
  const [showWallpaper, setShowWallpaper] = useState(false); // per-chat wallpaper panel
  // ── Voice call ──
  const [inCall, setInCall] = useState(false);
  const [callStatus, setCallStatus] = useState('idle');   // listening | thinking | speaking
  const [callTranscript, setCallTranscript] = useState('');
  const [callError, setCallError] = useState('');
  const [callMuted, setCallMuted] = useState(false);
  const recognitionRef = useRef(null);
  const inCallRef = useRef(false);
  const prevStreamingRef = useRef(false);
  const callTranscriptRef = useRef('');
  const callMutedRef = useRef(false);
  const [showScenarioPick, setShowScenarioPick] = useState(false); // greeting picker on + New chat
  const [undo, setUndo] = useState(null);              // { fromIndex, messages } after a delete
  const sug = useSuggestions(settings);                // suggested-reply state + helpers
  const tts = useTts();                                // text-to-speech (speakingId + helpers)
  const { personas, setPersonas, charsById, setCharsById } = useLibrary(); // personas + character library
  const { scrollRef, onScroll, stick, atBottom, scrollToBottom } = useChatScroll(); // message-list auto-scroll + jump-to-latest
  const [showEffects, setShowEffects] = useState(false); // ambient-effects picker
  const [showCast, setShowCast] = useState(false);       // group cast panel
  const [showInner, setShowInner] = useState(false);     // relationship + diary viewer
  const [showMoodMenu, setShowMoodMenu] = useState(false);   // mood chip popover
  const [showPersonaMenu, setShowPersonaMenu] = useState(false); // persona switcher popover
  const [personaEdit, setPersonaEdit] = useState(null);  // null=closed; {} new; persona = edit
  const [showAddCast, setShowAddCast] = useState(false); // visual add-character picker
  const [castQuery, setCastQuery] = useState('');        // cast picker search
  const [showSidebar, setShowSidebar] = useState(true);  // right profile sidebar (wide screens)
  const [renamingId, setRenamingId] = useState(null);    // chat id being renamed inline
  const [renameDraft, setRenameDraft] = useState('');    // inline rename input value
  const [foldingId, setFoldingId] = useState(null);      // chat id whose folder is being set
  const [folderDraft, setFolderDraft] = useState('');    // inline folder input value
  const [searchAll, setSearchAll] = useState(false);     // search scope: this chat vs all
  const [toast, setToast] = useState(null);              // transient bottom toast
  const toastTimer = useRef(null);
  const [lightbox, setLightbox] = useState(null);        // full-size image overlay (src)
  const [showGallery, setShowGallery] = useState(false); // all chat images on one screen
  const [showDirector, setShowDirector] = useState(false); // director quick-actions menu
  const [showSearch, setShowSearch] = useState(false);   // in-chat message search
  const [searchQ, setSearchQ] = useState('');            // search query
  const [summarizing, setSummarizing] = useState(false); // manual "summarize now" in progress
  const [impersonating, setImpersonating] = useState(false); // "write my reply" in progress
  const [confirm, setConfirm] = useState(null);          // { message, label, onYes } in-app confirm
  function askConfirm(message, onYes, label = 'Delete') { setConfirm({ message, onYes, label }); }
  const [localModels, setLocalModels] = useState([]);    // downloaded Ollama models for the in-chat picker
  useEffect(() => { if (onChangeModel) fetchAvailableModels().then(setLocalModels); }, [onChangeModel]);
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

  // Per-character starting theme: if the character has an assigned look, apply it
  // while this chat is open and restore the global look on leave/switch.
  useEffect(() => {
    if (!char.themeValues) return undefined;
    applyDesignSettings({ ...settings, ...char.themeValues });
    return () => applyDesignSettings(settings);
  }, [char.id, char.themeValues, settings]); // eslint-disable-line react-hooks/exhaustive-deps

  // Per-character accent: tint the whole UI with a vibrant colour pulled from the
  // avatar while this chat is open; restore the user's global accent on leave/switch.
  // Skipped when the character has its own assigned theme (that wins).
  useEffect(() => {
    if (!settings.charAccent || !char.avatar || char.themeValues) return undefined;
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
    showToast('🌱 New chat forked from here');
  }

  // React to a message (single emoji, toggle off with ''). A reaction is a real
  // signal: it nudges the living relationship and the character is told about it
  // (woven into the prompt) so it can acknowledge how you felt.
  const REACTION_AFFECTION = { '❤️': 4, '🔥': 4, '😂': 2, '👍': 2, '😮': 0, '😢': -1 };
  function reactMessage(msg, emoji) {
    const adding = !!emoji && msg.reaction !== emoji;
    msg.reaction = emoji || undefined;
    if (adding && settings.relationship && chat && chat.relationship && msg.sender === 'ai') {
      const d = REACTION_AFFECTION[emoji] || 0;
      if (d) {
        const r = chat.relationship;
        r.affection = Math.max(0, Math.min(100, (r.affection || 50) + d));
        showToast(emoji + (d > 0 ? '  +affection' : '  noted'));
      }
    }
    saveCharacter(char);
    rerender();
  }

  // Pin / unpin a message — pinned messages are kept in the prompt context.
  function togglePin(msg) {
    msg.pinned = !msg.pinned;
    saveCharacter(char);
    rerender();
  }
  function jumpToMessage(id) {
    setShowPinned(false);
    // Defer so the modal is gone before we scroll/measure.
    setTimeout(() => {
      const el = document.getElementById('msg-' + id);
      if (!el) return;
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('flash-jump');
      setTimeout(() => el.classList.remove('flash-jump'), 1400);
    }, 60);
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

  // Pin a chat session to the top of the list.
  function togglePinChat(id) { const c = chats[id]; if (!c) return; c.pinned = !c.pinned; saveCharacter(char); rerender(); }

  // "Move to folder" — pick an existing folder, type a new one, or remove.
  function beginFolder(c) { setFoldingId(c.id); setFolderDraft(''); }
  function moveToFolder(id, name) {
    const c = chats[id];
    if (c) { c.folder = (name || '').trim() || undefined; saveCharacter(char); }
    setFoldingId(null);
    rerender();
  }
  // Distinct existing folder names across this character's chats.
  const folderNames = Array.from(new Set(Object.values(chats).map((c) => (c.folder || '').trim()).filter(Boolean))).sort();

  // Jump to a message in any chat (switch first if needed), then flash it.
  function jumpAcross(sessionId, msgId) {
    setShowSearch(false);
    if (sessionId && sessionId !== chatId) {
      switchChat(sessionId);
      setTimeout(() => jumpToMessage(msgId), 160);
    } else {
      jumpToMessage(msgId);
    }
  }

  // Inline rename inside the Chats modal (no native window.prompt).
  function beginRename(c) { setRenamingId(c.id); setRenameDraft(c.name || ''); }
  function commitRename() {
    const c = chats[renamingId];
    if (c) { c.name = renameDraft.trim() || c.name; saveCharacter(char); }
    setRenamingId(null);
    rerender();
  }

  // Transient toast (e.g. after forking a chat) so actions are legible.
  function showToast(msg) {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2600);
  }

  // Manually distill the conversation into chat.memories right now (one click).
  async function summarizeNow() {
    if (!chat || summarizing) return;
    setSummarizing(true);
    try {
      const bullets = await summarizeChat(char, chat, personas, resolveModel(settings, settings.summaryModelId || settings.model));
      if (bullets && bullets.trim()) {
        const header = '--- Summary (' + new Date().toLocaleDateString() + ') ---\n';
        chat.memories = ((chat.memories || '').trim() ? chat.memories.trim() + '\n\n' : '') + header + bullets.trim();
        chat._lastAutoSummaryLen = chat.history.length;
        // Actually compact: fold everything but the last few turns into memory so
        // the prompt (and the context meter) shrink.
        const nonStream = chat.history.filter((m) => !m.isStreaming).length;
        chat.promptFloor = Math.max(0, nonStream - 8);
        await saveCharacter(char);
        rerender();
        showToast('🧠 Summarized — context compacted');
      } else {
        showToast('Nothing to summarize yet');
      }
    } catch (e) {
      showToast('Summarize failed');
    } finally {
      setSummarizing(false);
    }
  }

  // Export the active chat as a Markdown transcript (download).
  function exportChat() {
    if (!chat) return;
    const uName = (chat.activePersonaId && personas[chat.activePersonaId] && personas[chat.activePersonaId].name) || 'You';
    const lines = ['# ' + (chat.name || 'Chat') + ' — ' + displayName(char), ''];
    chat.history.filter((m) => !m.isStreaming).forEach((m) => {
      const who = m.sender === 'user' ? uName : displayName(speakerOf(m));
      const txt = stripPhotoTag(getMessageText(m)).trim();
      if (txt) lines.push('**' + who + ':** ' + txt, '');
    });
    const blob = new Blob([lines.join('\n')], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = (chat.name || 'chat').replace(/[^\w-]+/g, '_').slice(0, 60) + '.md';
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
    showToast('⬇ Chat exported');
  }

  function deleteChatSession(id) {
    if (!chats[id]) return;
    askConfirm('Delete this chat? This cannot be undone.', () => doDeleteChatSession(id));
  }
  function doDeleteChatSession(id) {
    if (!chats[id]) return;
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
    askConfirm('Delete this message and all following messages?', () => {
      const removed = chat.history.splice(idx);
      setUndo({ fromIndex: idx, messages: removed });
      saveCharacter(char);
      rerender();
    });
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

  // "Write my reply" — let the AI draft the user's next turn in their persona
  // voice and drop it into the composer to edit/send.
  async function impersonate() {
    if (impersonating || streaming || !chat) return;
    setImpersonating(true);
    try {
      const text = await impersonateReply(char, chat, personas, resolveModel(settings, settings.suggestionModelId || settings.model));
      if (text) { setInput(text); focusInputEnd(); }
      else showToast('Could not write a reply');
    } catch (e) { showToast('Could not write a reply'); }
    finally { setImpersonating(false); }
  }

  // ── Suggested replies ─────────────────────────────────────────────────────
  function pickSuggestion(text) {
    // Story-mode choices read as actions — send straight away (as a *…* action) so
    // the visual-novel branch advances on a single tap; plain replies drop into the
    // composer for editing first.
    if (sug.choiceMode) {
      sug.clear();
      const action = /^[*"]/.test(text) ? text : '*' + text + '*';
      sendText(action);
      return;
    }
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
  function speakMessage(msg) { tts.toggle(msg, voiceFor(msg), settings.ttsDialogueOnly); }

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
      let forcePhoto = false;
      let rawImage = false;     // true → send photoPrompt verbatim to the image model
      if (v && !errored && settings.aiPhotos && v.main) {
        const ip = extractImagePrompt(v.main);
        const ex = ip.prompt ? null : extractPhotoTag(v.main);
        // Always strip any emitted tag from the visible text, even if we won't render it.
        if (ip.prompt) v.main = ip.clean;
        else if (ex && ex.prompt) v.main = ex.clean;
        const modelEmitted = !!(ip.prompt || (ex && ex.prompt));
        // Generate when the user explicitly asked this turn, OR — with "Auto-selfie"
        // on — when the character chose to emit a photo tag on its own initiative.
        if (opts.forcePhoto || (settings.autoSelfie && modelEmitted)) {
          if (ip.prompt) { photoPrompt = ip.prompt; rawImage = true; }   // [IMAGE PROMPT] → verbatim
          else if (ex && ex.prompt) { photoPrompt = ex.prompt; }          // legacy tag → scene-aware
          else { forcePhoto = true; }                                     // no tag → build from scene
          v.imageLoading = true;
        }
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
        maybeUpdateFacts();
        sug.generate(char, chat, personas);
        if (settings.tts) {
          tts.autoSpeak(aiMsg, voiceFor(aiMsg), settings.ttsDialogueOnly);
        }
        if (photoPrompt || forcePhoto) {
          const speakerC = charsById[aiMsg.speakerId] || char;
          if (rawImage) {
            generatePhoto(v, speakerC, photoPrompt, true);   // [IMAGE PROMPT] → verbatim to ComfyUI
          } else {
            const uName = (chat.activePersonaId && personas[chat.activePersonaId] && personas[chat.activePersonaId].name) || 'User';
            const transcript = chat.history.filter((m) => !m.isStreaming).slice(-6)
              .map((m) => (m.sender === 'user' ? uName : displayName(speakerOf(m))) + ': ' + stripPhotoTag(getMessageText(m)))
              .join('\n');
            generatePhoto(v, speakerC, photoPrompt, false, transcript);
          }
        }
      } else if (v && v.imageLoading) {
        v.imageLoading = false;
      }
    }
  }

  // Generate the selfie for a message variant: derive Danbooru appearance once
  // (the LLM knows famous characters), cache it on the character, then set the image.
  async function generatePhoto(v, pchar, prompt, raw, scene) {
    try {
      // raw → send the prompt verbatim (no identity/scene/quality added).
      if (raw) { v.image = buildPhotoUrl(pchar, prompt, settings, { raw: true }); v.imagePrompt = prompt; return; }
      // Ensure we have stable appearance tags for likeness (derive once, cache).
      if (!pchar.appearance || !pchar.appearance.trim()) {
        try {
          const appr = await generateAppearance(
            { name: displayName(pchar), description: pchar.description, tags: pchar.tags },
            resolveModel(settings, settings.model),
          );
          if (appr) { pchar.appearance = appr; await saveCharacter(pchar === char ? char : pchar); }
        } catch (e) { /* fall back to name+tags */ }
      }
      // Scene-aware: rebuild the shot's tags from what's actually happening, so the
      // photo matches the moment instead of a generic portrait. The chat model's own
      // [photo:] tag (prompt) is passed as a hint; identity is added by buildPhotoUrl.
      let shot = prompt;
      if (scene) {
        try {
          const t = await tagsFromScene({ name: displayName(pchar), transcript: scene, hint: prompt }, resolveModel(settings, settings.model));
          if (t) shot = t;
        } catch (e) { /* keep the model's own tag */ }
      }
      v.image = buildPhotoUrl(pchar, shot, settings, {});
      v.imagePrompt = shot;   // surface the exact tag used (transparency / debug)
    } finally {
      v.imageLoading = false;
      await saveCharacter(char);
      rerender();
    }
  }

  // ── Voice call (browser STT → chat → TTS, looped) ─────────────────────────
  const SpeechRec = (typeof window !== 'undefined') && (window.SpeechRecognition || window.webkitSpeechRecognition);
  const voiceSupported = !!SpeechRec && ttsSupported();

  function startListening() {
    if (!inCallRef.current || callMutedRef.current) return;
    let rec;
    try { rec = new SpeechRec(); } catch (e) { setCallError('Mic/speech not available.'); return; }
    rec.lang = settings.sttLang || (typeof navigator !== 'undefined' && navigator.language) || 'en-US';
    rec.interimResults = true;
    rec.continuous = false;
    rec.onresult = (e) => {
      let txt = '';
      for (let i = 0; i < e.results.length; i++) txt += e.results[i][0].transcript;
      callTranscriptRef.current = txt;
      setCallTranscript(txt);
      if (e.results[e.results.length - 1].isFinal) { try { rec.stop(); } catch (er) { /* */ } }
    };
    rec.onerror = (ev) => {
      const err = ev && ev.error;
      // no-speech/aborted are normal (silence / restart) — surface the real failures.
      if (err && err !== 'no-speech' && err !== 'aborted') {
        setCallError(
          err === 'network' ? 'Speech recognition needs internet — Chrome streams audio to Google’s servers.'
          : err === 'not-allowed' || err === 'service-not-allowed' ? 'Microphone blocked — allow mic access for this site.'
          : err === 'audio-capture' ? 'No microphone found.'
          : 'Speech error: ' + err,
        );
      }
    };
    rec.onend = () => {
      if (!inCallRef.current) return;
      const t = callTranscriptRef.current.trim();
      if (t) {
        callTranscriptRef.current = ''; setCallTranscript('');
        setCallStatus('thinking');
        sendText(t);                 // reply will be spoken by the effect below
      } else if (!callMutedRef.current) {
        startListening();            // heard nothing → keep listening
      }
    };
    recognitionRef.current = rec;
    setCallStatus('listening'); setCallError('');
    try { rec.start(); } catch (e) { /* already started */ }
  }

  function startCall() {
    if (!voiceSupported) { setCallError('Voice needs Chrome (Web Speech API).'); setInCall(true); return; }
    inCallRef.current = true; prevStreamingRef.current = false;
    setInCall(true); setCallError(''); setCallTranscript('');
    startListening();
  }
  function endCall() {
    inCallRef.current = false; setInCall(false); setCallStatus('idle');
    try { recognitionRef.current && recognitionRef.current.stop(); } catch (e) { /* */ }
    cancelSpeech();
  }
  function toggleCallMute() {
    const next = !callMutedRef.current; callMutedRef.current = next; setCallMuted(next);
    if (next) { try { recognitionRef.current && recognitionRef.current.stop(); } catch (e) { /* */ } setCallStatus('idle'); }
    else if (inCallRef.current && callStatus !== 'speaking') startListening();
  }
  // Barge-in: cut the character off mid-sentence and start listening immediately.
  // Tap-based rather than always-on VAD so the mic never echoes the TTS audio.
  function interruptSpeaking() {
    if (!inCallRef.current || callStatus !== 'speaking') return;
    cancelSpeech();
    if (!callMutedRef.current) startListening();
  }

  // When a reply finishes streaming during a call, speak it, then resume listening.
  useEffect(() => {
    if (inCall && prevStreamingRef.current && !streaming) {
      const last = lastAiMessage();
      const text = last ? getMessageText(last) : '';
      if (text) {
        setCallStatus('speaking');
        const ok = speak(text, {
          voiceURI: char.voiceURI || settings.ttsVoiceURI,
          dialogueOnly: settings.ttsDialogueOnly,
          onend: () => { if (inCallRef.current && !callMutedRef.current) startListening(); },
        });
        if (!ok && inCallRef.current && !callMutedRef.current) startListening();
      } else if (inCallRef.current && !callMutedRef.current) startListening();
    }
    prevStreamingRef.current = streaming;
  }, [streaming, inCall]); // eslint-disable-line react-hooks/exhaustive-deps

  // Tidy up the call on unmount.
  useEffect(() => () => { inCallRef.current = false; try { recognitionRef.current && recognitionRef.current.stop(); } catch (e) { /* */ } cancelSpeech(); }, []);

  // Opt-in: distill old turns into chat.memories once the chat grows by N msgs.
  // Fire-and-forget; one at a time; preempted by nothing (runs after a reply).
  async function maybeAutoSummarize() {
    if (!settings.autoSummarize || !chat || autoSumRef.current) return;
    const every = Math.max(10, parseInt(settings.autoSummarizeEvery, 10) || 30);
    const len = chat.history.length;
    const prev = chat._lastAutoSummaryLen || 0;
    // Fire on the message-count cadence OR when the context window is filling up
    // (rough estimate), so long chats compact themselves before turns get dropped.
    const byCount = len - prev >= every;
    const tokens = (chat.history || []).filter((m) => !m.isStreaming).slice(chat.promptFloor || 0)
      .reduce((n, m) => n + getMessageText(m).length, 0) / 4;
    const maxCtx = resolveModel(settings, settings.model).numCtx || 131072;
    const byContext = tokens / maxCtx > 0.85 && len - prev >= 6;
    if (!byCount && !byContext) return;
    autoSumRef.current = true;
    chat._lastAutoSummaryLen = len;
    try {
      const bullets = await summarizeChat(char, chat, personas, resolveModel(settings, settings.summaryModelId || settings.model));
      if (bullets && bullets.trim()) {
        const header = '--- Auto-summary (' + new Date().toLocaleDateString() + ') ---\n';
        chat.memories = (chat.memories || '').trim();
        chat.memories = (chat.memories ? chat.memories + '\n\n' : '') + header + bullets.trim();
        const nonStream = chat.history.filter((m) => !m.isStreaming).length;
        chat.promptFloor = Math.max(0, nonStream - 8);
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
      if (next) {
        chat.relationship = next;
        // Stamp the change onto the AI turn that caused it, so the user can SEE the
        // scale move (e.g. +3 affection, −2 tension) instead of it shifting invisibly.
        const delta = {
          affection: next.affection - prev.affection,
          trust: next.trust - prev.trust,
          tension: next.tension - prev.tension,
        };
        if (delta.affection || delta.trust || delta.tension) {
          for (let i = chat.history.length - 1; i >= 0; i--) {
            if (chat.history[i].sender === 'ai' && !chat.history[i].isStreaming) { chat.history[i].relDelta = delta; break; }
          }
        }
        await saveCharacter(char); rerender();
      }
    } catch (e) { /* best effort */ }
  }

  // Maintain the durable "known facts" list from the latest exchange. Throttled to
  // ~every 6 turns so it doesn't tie up the single local model on every reply.
  async function maybeUpdateFacts() {
    if (!settings.factMemory || !chat) return;
    const turns = (chat.history || []).filter((m) => !m.isStreaming).length;
    if (turns - (chat._lastFactsLen || 0) < 6) return;
    chat._lastFactsLen = turns;
    const uName = (chat.activePersonaId && personas[chat.activePersonaId] && personas[chat.activePersonaId].name) || 'User';
    const transcript = (chat.history || [])
      .filter((m) => !m.isStreaming)
      .slice(-12)
      .map((m) => (m.sender === 'user' ? uName : displayName(speakerOf(m))) + ': ' + getMessageText(m))
      .join('\n');
    if (!transcript.trim()) return;
    try {
      const raw = await collectCompletion(
        buildFactsUpdateMessages(displayName(char), uName, chat.facts || [], transcript),
        resolveModel(settings, settings.summaryModelId || settings.model),
      );
      const next = parseFacts(raw, chat.facts || []);
      if (next && next.length) { chat.facts = next; await saveCharacter(char); rerender(); }
    } catch (e) { chat._lastFactsLen = (chat._lastFactsLen || 0) - 6; /* retry next turn */ }
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

  // Stream one group member's turn, reacting to the conversation so far.
  async function groupTurn(speaker, userText) {
    const aiMsg = {
      id: genId(), sender: 'ai', type: 'dialog', speakerId: speaker.id,
      activeVariant: 0, variations: [{ main: '', think: null }], isStreaming: true, streamingVariant: 0,
    };
    chat.history.push(aiMsg);
    stick();
    rerender();
    await runStream(aiMsg, userText, { messages: groupMessagesFor(speaker, userText) });
  }

  // Let the scene advance with no new user message — the character (or, in an
  // Auto group, the next speaker) acts on their own and moves things forward.
  async function continueScene() {
    if (streaming || !chat) return;
    setUndo(null);
    stick();
    const speaker = resolveSpeaker();
    if (isGroup() && !chat.activeSpeakerId) {
      await groupTurn(speaker, '(Continue the scene — respond in character as ' + displayName(speaker) + ', reacting to what was just said.)');
      return;
    }
    const aiMsg = {
      id: genId(), sender: 'ai', type: 'dialog', speakerId: speaker.id,
      activeVariant: 0, variations: [{ main: '', think: null }], isStreaming: true, streamingVariant: 0,
    };
    chat.history.push(aiMsg);
    rerender();
    const instr = '(Continue the scene on your own — move it forward in character; do not wait for the user.)';
    const opts = isGroup() ? { messages: groupMessagesFor(speaker, instr) } : {};
    await runStream(aiMsg, instr, opts);
  }

  // Actually push a user turn + stream the reply. `send` wraps this with slash-command parsing.
  async function sendText(raw, extra) {
    const text = String(raw || '').trim();
    if (!text || streaming || !chat) return;
    setInput('');
    setUndo(null);
    stick();
    // Auto-title a still-default chat from its first user message.
    const isFirstUser = !chat.history.some((m) => m.sender === 'user');
    if (isFirstUser && /^Chat\s/.test(chat.name || '')) {
      chat.name = text.slice(0, 40).trim() + (text.length > 40 ? '…' : '');
    }
    chat.history.push({ id: genId(), sender: 'user', main: text, ...(extra || {}) });
    rerender();

    // "@Name …" → that character answers directly. If they're not in the scene yet,
    // summon them (add to the cast) so a 1-on-1 can pull someone in on the fly.
    const mention = mentionedSpeaker(text);
    if (mention) {
      const ids = Array.isArray(chat.participants) ? chat.participants.slice() : [];
      if (mention.id !== char.id && !ids.includes(mention.id)) {
        if (!ids.includes(char.id)) ids.unshift(char.id);
        ids.push(mention.id);
        chat.participants = ids;
        await saveCharacter(char);
        rerender();
      }
      await groupTurn(mention, text);
      return;
    }

    // Group + Auto speaker → let several cast members reply in turn so they
    // actually interact with each other (and the user), not just one answer.
    if (isGroup() && !chat.activeSpeakerId) {
      const rounds = Math.min(activeParticipants().length, 3);
      for (let i = 0; i < rounds; i++) {
        const speaker = resolveSpeaker();
        const turnText = i === 0 ? text : '(Continue the scene — respond in character as ' + displayName(speaker) + ', reacting to what was just said.)';
        await groupTurn(speaker, turnText);
      }
      return;
    }

    const speaker = resolveSpeaker();
    const aiMsg = {
      id: genId(), sender: 'ai', type: 'dialog', speakerId: speaker.id,
      activeVariant: 0, variations: [{ main: '', think: null }], isStreaming: true, streamingVariant: 0,
    };
    chat.history.push(aiMsg);
    rerender();
    const forcePhoto = settings.aiPhotos && isPhotoRequest(text);
    const opts = isGroup() ? { messages: groupMessagesFor(speaker, text), forcePhoto } : { forcePhoto };
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
      case 'roll':     { const r = rollDice(rest || 'd20'); sendText(r.text, r.dice ? { dice: r.dice } : undefined); return true; }
      case 'retry':
      case 'regen':    { const last = lastAiMessage(); if (last) regenerate(last); return true; }
      case 'continue': { const last = lastAiMessage(); if (last) continueMessage(last); return true; }
      case 'new':      newChatClicked(); return true;
      case 'photo':    if (rest) manualPhoto(rest, false); return true;
      case 'photoraw': if (rest) manualPhoto(rest, true); return true;
      case 'video':    if (rest) manualVideo(rest); return true;
      default:         return false;
    }
  }

  // Manual image: generate a photo of the speaker from tags the user types.
  // Non-Latin input (e.g. Russian) is auto-translated to English Danbooru tags first.
  async function manualPhoto(tags, raw) {
    if (!chat) return;
    const speaker = resolveSpeaker();
    stick();
    const v = { main: '', think: null, imageLoading: true };
    const msg = { id: genId(), sender: 'ai', type: 'dialog', speakerId: speaker.id, activeVariant: 0, variations: [v] };
    chat.history.push(msg);
    rerender();
    let prompt = tags;
    if ([...tags].some((ch) => ch.charCodeAt(0) > 127)) {   // non-ASCII (Russian etc.) -> auto-translate to EN tags
      try { prompt = (await tagsFromText(tags, resolveModel(settings, settings.model))) || tags; }
      catch (e) { /* fall back to raw input */ }
    }
    generatePhoto(v, speaker, prompt, raw);
  }

  // Manual video selfie: animate a generated still into a short clip via ComfyUI + SVD.
  // The animated WebP renders in the same image bubble. Needs an SVD checkpoint installed.
  async function manualVideo(tags) {
    if (!chat) return;
    const speaker = resolveSpeaker();
    stick();
    const v = { main: '', think: null, imageLoading: true };
    const msg = { id: genId(), sender: 'ai', type: 'dialog', speakerId: speaker.id, activeVariant: 0, variations: [v] };
    chat.history.push(msg);
    rerender();
    let prompt = tags;
    if ([...tags].some((ch) => ch.charCodeAt(0) > 127)) {
      try { prompt = (await tagsFromText(tags, resolveModel(settings, settings.model))) || tags; }
      catch (e) { /* fall back to raw input */ }
    }
    v.image = buildVideoUrl(speaker, prompt, settings);
    v.imagePrompt = prompt;
    v.imageLoading = false;
    await saveCharacter(char);
    rerender();
  }

  // Parse a dice spec like "2d6", "d20", "3d8+1" and return both a clean text line
  // (for the prompt, so the character reacts to the roll) and structured `dice`
  // metadata so the message renders as a real dice chip instead of plain italics.
  function rollDice(spec) {
    const m = String(spec).replace(/\s+/g, '').match(/^(\d*)d(\d+)([+-]\d+)?$/i);
    if (!m) return { text: '*rolls the dice*' };
    const n = Math.min(Math.max(parseInt(m[1] || '1', 10), 1), 20);
    const sides = Math.min(Math.max(parseInt(m[2], 10), 2), 1000);
    const modStr = m[3] || '';
    const mod = parseInt(modStr || '0', 10);
    const rolls = [];
    let sum = 0;
    for (let i = 0; i < n; i++) { const r = 1 + Math.floor(Math.random() * sides); rolls.push(r); sum += r; }
    sum += mod;
    const label = `${n}d${sides}${modStr}`;
    return { text: `rolls ${label} → ${sum}`, dice: { label, n, sides, modStr, rolls, sum } };
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

  async function regenerate(msg, tweak) {
    if (streaming) return;
    msg.variations.push({ main: '', think: null });
    msg.activeVariant = msg.variations.length - 1;
    msg.streamingVariant = msg.activeVariant;
    msg.isStreaming = true;
    // last preceding user turn
    const idx = chat.history.indexOf(msg);
    const prior = chat.history.slice(0, idx);
    const lastUser = [...prior].reverse().find((m) => m.sender === 'user');
    let lastUserText = lastUser ? getMessageText(lastUser) : 'Continue the roleplay.';
    if (tweak) lastUserText += '\n[Rewrite your previous reply — same moment, but: ' + tweak + ']';
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

  // "@Name …" directs the turn to that character. Matches a current cast member,
  // or any character in the library (which is then summoned into the scene).
  function mentionedSpeaker(text) {
    const m = /(?:^|\s)@([\p{L}][\p{L}\d_-]{1,})/u.exec(String(text || ''));
    if (!m) return null;
    const tag = m[1].toLowerCase();
    const match = (c) => {
      if (!c) return false;
      const n = displayName(c).toLowerCase();
      return n === tag || n.split(/\s+/)[0] === tag || n.replace(/\s+/g, '').startsWith(tag);
    };
    return activeParticipants().find(match) || Object.values(charsById).find(match) || null;
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
      autoSelfie: settings.aiPhotos && settings.autoSelfie,
      pinned: chat ? chat.history.filter((m) => m.pinned).map((m) => getMessageText(m)).filter(Boolean) : [],
      presenceText: settings.presence ? buildPresenceText(displayName(spk), spk.id, new Date(), lastMsgTs()) : '',
    };
  }
  function saveMemories(text) { chat.memories = text; setShowMemories(false); saveCharacter(char); rerender(); }

  // ── Personas (you in the chat) — full editor modal ────────────────────────
  function newPersona() { setShowPersonaMenu(false); setPersonaEdit({}); }
  function editPersona(p) { setShowPersonaMenu(false); setPersonaEdit(p); }
  async function savePersonaFromModal(p) {
    const isNew = !personas[p.id];
    await savePersona(p);
    setPersonas((prev) => ({ ...prev, [p.id]: p }));
    if (isNew || (chat && chat.activePersonaId === p.id)) setPersona(p.id);
    setPersonaEdit(null);
  }
  async function deletePersonaFromModal(id) {
    await deletePersona(id);
    setPersonas((prev) => { const next = { ...prev }; delete next[id]; return next; });
    if (chat && chat.activePersonaId === id) setPersona(null);
    setPersonaEdit(null);
  }
  const activePersona = chat && chat.activePersonaId ? personas[chat.activePersonaId] : null;

  const MOODS = [
    { key: 'happy', emoji: '😊' }, { key: 'sad', emoji: '😢' }, { key: 'angry', emoji: '😠' },
    { key: 'flirty', emoji: '😏' }, { key: 'scared', emoji: '😨' }, { key: 'calm', emoji: '😌' },
    { key: 'excited', emoji: '🤩' }, { key: 'nervous', emoji: '😰' }, { key: 'playful', emoji: '😜' },
    { key: 'tired', emoji: '🥱' }, { key: 'jealous', emoji: '😒' }, { key: 'loving', emoji: '🥰' },
  ];
  const moodEmoji = (k) => (MOODS.find((m) => m.key === k) || {}).emoji || '🎭';

  const history = chat ? chat.history : [];
  const sessions = Object.values(chats).sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || chatTs(b.id) - chatTs(a.id));
  const pinnedMsgs = history.filter((m) => m.pinned);

  // Slash-command autocomplete: only while typing the command word (no space yet).
  const slashQuery = (() => { const m = input.match(/^\/(\w*)$/); return m ? m[1].toLowerCase() : null; })();
  const slashMatches = slashQuery != null ? SLASH_COMMANDS.filter((c) => c.cmd.startsWith(slashQuery)) : [];
  const slashActive = Math.min(slashIdx, Math.max(0, slashMatches.length - 1));

  return (
    <div className="relative isolate flex h-screen flex-col">
      {((chat && chat.background) || char.background) && (
        <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
          <img src={avatarUrl((chat && chat.background) || char.background)} alt="" className="h-full w-full object-cover opacity-50" />
          {/* cinematic: art visible mid-frame, darker under header/composer for legibility */}
          <div className="absolute inset-0 bg-gradient-to-b from-em-bg/85 via-em-bg/45 to-em-bg/95" />
          {/* vignette */}
          <div className="absolute inset-0" style={{ background: 'radial-gradient(120% 75% at 50% 38%, transparent 35%, rgba(5,16,11,0.65) 100%)' }} />
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
            title={`Inner life — ${stageFor(chat.relationship.affection).label} (${chat.relationship.affection})`}
            className="hidden items-center gap-1 rounded-lg border border-white/10 px-2 py-1 text-xs text-em-text-dim transition hover:border-rose-300/40 hover:text-rose-300 sm:flex"
          >
            <span className="text-base leading-none">{stageFor(chat.relationship.affection).emoji}</span>
            <span className="rounded bg-rose-400/15 px-1 text-[10px] font-bold text-rose-300">Lv.{REL_STAGES.indexOf(stageFor(chat.relationship.affection)) + 1}</span>
            <span className="text-rose-400"><HeartIcon /></span> {chat.relationship.affection}
          </button>
        )}
        {onEdit && <button onClick={() => onEdit(char)} title="Edit character" className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1.5 text-sm text-em-text-dim transition duration-150 hover:-translate-y-0.5 hover:border-em-accent/40 hover:bg-white/[0.06] hover:text-em-text active:scale-95"><PencilIcon /><span className="hidden sm:inline">Edit</span></button>}
        {onOpenSettings && <button onClick={onOpenSettings} title="Settings" className="grid h-9 w-9 place-items-center rounded-lg border border-white/10 bg-white/[0.03] text-em-text-dim transition duration-150 hover:-translate-y-0.5 hover:border-em-accent/40 hover:bg-white/[0.06] hover:text-em-text active:scale-95"><GearIcon /></button>}
        <button onClick={() => { setShowSearch(true); setSearchQ(''); }} title="Search in chat" className="grid h-9 w-9 place-items-center rounded-lg border border-white/10 text-em-text-dim transition hover:border-em-accent/40 hover:text-em-text"><SearchIcon /></button>
        <button onClick={() => setShowSidebar((v) => !v)} title="Toggle profile panel" className={'hidden h-9 w-9 place-items-center rounded-lg border transition xl:grid ' + (showSidebar ? 'border-em-accent/50 text-em-accent' : 'border-white/10 text-em-text-dim hover:border-em-accent/40 hover:text-em-text')}><PanelRight className="h-4 w-4" /></button>
        <button onClick={() => { setShowWallpaper((v) => !v); setShowPinned(false); }} title="Wallpaper (this chat)" className={'grid h-9 w-9 place-items-center rounded-lg border transition ' + (showWallpaper ? 'border-em-accent/50 text-em-accent' : 'border-white/10 text-em-text-dim hover:border-em-accent/40 hover:text-em-text')}><WallpaperIcon /></button>
        <button onClick={startCall} title="Voice call" className="grid h-9 w-9 place-items-center rounded-lg border border-white/10 bg-white/[0.03] text-em-text-dim transition duration-150 hover:-translate-y-0.5 hover:border-em-accent/40 hover:bg-white/[0.06] hover:text-em-accent active:scale-95"><Phone className="h-4 w-4" /></button>
        {pinnedMsgs.length > 0 && (
          <button onClick={() => { setShowPinned((v) => !v); setShowWallpaper(false); }} title="Pinned messages" className={'inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-sm transition ' + (showPinned ? 'border-em-accent/50 text-em-accent' : 'border-white/10 text-em-text-dim hover:border-em-accent/40 hover:text-em-text')}><PinIcon /> {pinnedMsgs.length}</button>
        )}
        <button onClick={() => setShowChats((v) => !v)} title="Chats" className={'inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm transition ' + (showChats ? 'border-em-accent/50 text-em-accent' : 'border-white/10 text-em-text-dim hover:border-em-accent/40 hover:text-em-text')}><ChatsIcon /><span className="hidden sm:inline">Chats</span> ({sessions.length})</button>
        <button onClick={newChatClicked} title="New chat" className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1.5 text-sm text-em-text-dim transition duration-150 hover:-translate-y-0.5 hover:border-em-accent/40 hover:bg-white/[0.06] hover:text-em-text active:scale-95"><PlusIcon /><span className="hidden sm:inline">New chat</span></button>

      </header>

      {/* Header dropdowns rendered as full modals OUTSIDE <header> — the header's
          backdrop-filter would otherwise trap position:fixed and shove them off-frame. */}
        {/* Chat session list (centered modal) */}
        {showChats && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" onClick={() => setShowChats(false)}>
            <div className="flex max-h-[80vh] w-full max-w-md flex-col overflow-hidden rounded-3xl glass-panel shadow-2xl" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
                <h2 className="flex items-center gap-2 text-lg font-bold"><ChatsIcon /> Chats <span className="text-em-text-dim">({sessions.length})</span></h2>
                <div className="flex items-center gap-1">
                  <button onClick={exportChat} title="Export current chat (Markdown)" className="grid h-8 w-8 place-items-center rounded-lg text-em-text-dim transition hover:bg-white/5 hover:text-em-text"><DownloadIcon /></button>
                  <button onClick={newChatClicked} className="inline-flex items-center gap-1 rounded-lg border border-em-accent/40 px-2.5 py-1 text-sm text-em-accent transition hover:bg-em-accent/10"><PlusIcon /> New</button>
                  <button onClick={() => setShowChats(false)} className="grid h-8 w-8 place-items-center rounded-lg text-em-text-dim transition hover:bg-white/5 hover:text-em-text">✕</button>
                </div>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto p-2">
                {sessions.length === 0 && <p className="px-2 py-3 text-center text-sm text-em-text-dim">No chats yet.</p>}
                {(() => {
                  const groups = {};
                  sessions.forEach((s) => { const f = (s.folder || '').trim(); (groups[f] = groups[f] || []).push(s); });
                  const names = Object.keys(groups).sort((a, b) => (a === '' ? -1 : b === '' ? 1 : a.localeCompare(b)));
                  const renderRow = (s) => {
                    const active = s.id === chatId;
                    const count = (s.history || []).length;
                    if (renamingId === s.id) {
                      return (
                        <div key={s.id} className="flex items-center gap-1 rounded-xl bg-white/5 px-3 py-2">
                          <input autoFocus value={renameDraft} onChange={(e) => setRenameDraft(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') commitRename(); else if (e.key === 'Escape') setRenamingId(null); }} onBlur={commitRename} placeholder="Chat name" className="min-w-0 flex-1 rounded-lg border border-em-accent/40 bg-em-bg/60 px-2 py-1 text-sm text-em-text focus:outline-none" />
                          <button onMouseDown={(e) => { e.preventDefault(); commitRename(); }} title="Save" className="grid h-7 w-7 place-items-center rounded text-em-accent hover:bg-em-accent/10"><CheckIcon /></button>
                        </div>
                      );
                    }
                    if (foldingId === s.id) {
                      return (
                        <div key={s.id} className="rounded-xl bg-white/5 px-3 py-2.5">
                          <div className="mb-1.5 flex items-center justify-between">
                            <span className="text-[11px] text-em-text-dim">Move <span className="text-em-text">{s.name || 'chat'}</span> to…</span>
                            <button onClick={() => setFoldingId(null)} className="text-em-text-dim transition hover:text-em-text">✕</button>
                          </div>
                          <div className="mb-2 flex flex-wrap gap-1.5">
                            {folderNames.map((f) => (
                              <button key={f} onClick={() => moveToFolder(s.id, f)} className={'rounded-full border px-2.5 py-1 text-xs transition ' + (s.folder === f ? 'border-em-accent/60 bg-em-accent/15 text-em-accent' : 'border-white/10 text-em-text-dim hover:border-em-accent/40 hover:text-em-text')}>{f}</button>
                            ))}
                            {s.folder && <button onClick={() => moveToFolder(s.id, '')} className="rounded-full border border-white/10 px-2.5 py-1 text-xs text-em-text-dim transition hover:border-red-400/40 hover:text-red-400">✕ No folder</button>}
                          </div>
                          <input autoFocus value={folderDraft} onChange={(e) => setFolderDraft(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') moveToFolder(s.id, folderDraft); else if (e.key === 'Escape') setFoldingId(null); }} placeholder="＋ New folder…" className="w-full rounded-lg border border-white/10 bg-em-bg/60 px-2.5 py-1.5 text-sm text-em-text placeholder:text-em-text-dim/60 focus:border-em-accent/50 focus:outline-none" />
                        </div>
                      );
                    }
                    return (
                      <div
                        key={s.id}
                        draggable
                        onDragStart={(e) => { e.dataTransfer.setData('text/chatid', s.id); e.dataTransfer.effectAllowed = 'move'; }}
                        className={'group flex cursor-grab items-center gap-1 rounded-xl px-3 py-2 active:cursor-grabbing ' + (active ? 'bg-em-accent/15' : 'hover:bg-white/5')}
                      >
                        <button onClick={() => switchChat(s.id)} className="min-w-0 flex-1 text-left">
                          <div className={'flex items-center gap-1 truncate text-sm ' + (active ? 'font-semibold text-em-accent' : 'text-em-text')}>{s.pinned && <span className="text-em-accent"><PinIcon /></span>}<span className="truncate">{s.name || 'Chat'}</span></div>
                          <div className="text-[11px] text-em-text-dim">{count} message{count === 1 ? '' : 's'}</div>
                        </button>
                        <button onClick={() => togglePinChat(s.id)} title={s.pinned ? 'Unpin chat' : 'Pin chat to top'} className={'grid h-7 w-7 place-items-center rounded transition ' + (s.pinned ? 'text-em-accent' : 'text-em-text-dim opacity-0 hover:text-em-text group-hover:opacity-100')}><PinIcon /></button>
                        <button onClick={() => beginFolder(s)} title="Move to folder" className="grid h-7 w-7 place-items-center rounded text-em-text-dim opacity-0 transition hover:text-em-text group-hover:opacity-100"><Folder className="h-4 w-4" /></button>
                        <button onClick={() => beginRename(s)} title="Rename chat" className="grid h-7 w-7 place-items-center rounded text-em-text-dim opacity-0 transition hover:text-em-text group-hover:opacity-100"><PencilIcon /></button>
                        <button onClick={() => deleteChatSession(s.id)} title="Delete chat" className="grid h-7 w-7 place-items-center rounded text-em-text-dim opacity-0 transition hover:text-red-400 group-hover:opacity-100"><TrashIcon /></button>
                      </div>
                    );
                  };
                  const onDropTo = (folder) => (e) => { e.preventDefault(); const id = e.dataTransfer.getData('text/chatid'); if (id) moveToFolder(id, folder); };
                  const hasFolders = folderNames.length > 0;
                  return names.map((fn) => (
                    <Fragment key={'grp-' + fn}>
                      {(fn || hasFolders) && (
                        <div
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={onDropTo(fn)}
                          className={'group/fold relative mt-3 flex items-center gap-3 overflow-hidden rounded-xl px-3 py-2.5 transition first:mt-0 ' + (fn ? 'border border-em-accent/25 bg-em-accent/[0.08] hover:bg-em-accent/[0.12]' : 'border border-white/5 bg-white/[0.03] hover:bg-white/[0.05]')}
                          title="Drop a chat here to move it"
                        >
                          {/* accent spine */}
                          <span className={'absolute inset-y-0 left-0 w-1 ' + (fn ? 'bg-em-accent/70' : 'bg-white/15')} />
                          <span className={'grid h-8 w-8 shrink-0 place-items-center rounded-lg ' + (fn ? 'bg-em-accent/15 text-em-accent' : 'bg-white/5 text-em-text-dim')}>
                            <Folder className="h-[18px] w-[18px]" />
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className={'truncate text-[15px] font-semibold leading-tight ' + (fn ? 'text-em-text' : 'text-em-text-dim')}>{fn || 'No folder'}</div>
                            <div className="text-[11px] text-em-text-dim/70">{groups[fn].length} {groups[fn].length === 1 ? 'chat' : 'chats'}</div>
                          </div>
                          <span className={'grid h-6 min-w-6 shrink-0 place-items-center rounded-full px-2 text-xs font-semibold tabular-nums ' + (fn ? 'bg-em-accent/20 text-em-accent' : 'bg-white/10 text-em-text-dim')}>{groups[fn].length}</span>
                        </div>
                      )}
                      {groups[fn].map(renderRow)}
                    </Fragment>
                  ));
                })()}
              </div>
            </div>
          </div>
        )}

        {/* Pinned messages (centered modal) */}
        {showPinned && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" onClick={() => setShowPinned(false)}>
            <div className="flex max-h-[80vh] w-full max-w-lg flex-col overflow-hidden rounded-3xl glass-panel shadow-2xl" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
                <h2 className="flex items-center gap-2 text-lg font-bold"><PinIcon /> Pinned <span className="text-em-text-dim">({pinnedMsgs.length})</span></h2>
                <button onClick={() => setShowPinned(false)} className="grid h-8 w-8 place-items-center rounded-lg text-em-text-dim transition hover:bg-white/5 hover:text-em-text">✕</button>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto p-2">
                {pinnedMsgs.length === 0 && <p className="px-2 py-6 text-center text-sm text-em-text-dim">No pinned messages yet — pin one with the 📌 on any bubble.</p>}
                {pinnedMsgs.map((m) => (
                  <div key={m.id} className="group flex items-start gap-2 rounded-xl px-3 py-2 hover:bg-white/5">
                    <button onClick={() => jumpToMessage(m.id)} className="min-w-0 flex-1 text-left">
                      <div className="text-[11px] font-medium text-em-accent">{m.sender === 'user' ? 'You' : displayName(speakerOf(m))}</div>
                      <div className="line-clamp-3 text-sm text-em-text/90">{stripPhotoTag(getMessageText(m)).slice(0, 240) || '(empty)'}</div>
                    </button>
                    <button onClick={() => togglePin(m)} title="Unpin" className="grid h-7 w-7 shrink-0 place-items-center rounded text-em-text-dim opacity-0 transition hover:text-red-400 group-hover:opacity-100"><PinIcon /></button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Per-chat wallpaper (centered modal) */}
        {showWallpaper && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" onClick={() => setShowWallpaper(false)}>
            <div className="w-full max-w-md rounded-3xl glass-panel p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="flex items-center gap-2 text-lg font-bold"><WallpaperIcon /> Wallpaper <span className="text-sm font-normal text-em-text-dim">(this chat)</span></h2>
                <button onClick={() => setShowWallpaper(false)} className="grid h-8 w-8 place-items-center rounded-lg text-em-text-dim transition hover:bg-white/5 hover:text-em-text">✕</button>
              </div>
              <div className="mb-3 h-32 w-full overflow-hidden rounded-xl border border-white/10 bg-em-bg">
                {chat && chat.background
                  ? <img src={avatarUrl(chat.background)} alt="" className="h-full w-full object-cover" />
                  : <div className="flex h-full w-full items-center justify-center text-xs text-em-text-dim/50">{char.background ? 'using character background' : 'none'}</div>}
              </div>
              <input
                id="wallpaper-prompt"
                placeholder="Describe a scene to generate…"
                className="mb-3 w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-em-text placeholder:text-em-text-dim/60 focus:border-em-accent/50 focus:outline-none"
                onKeyDown={(e) => { if (e.key === 'Enter') generateChatWallpaper(e.currentTarget.value); }}
              />
              <div className="flex items-center gap-2">
                <button onClick={() => generateChatWallpaper(document.getElementById('wallpaper-prompt').value)} disabled={wpBusy} className="flex-1 rounded-xl bg-em-accent px-3 py-2 text-sm font-semibold text-em-bg transition hover:bg-emerald-300 disabled:opacity-40">{wpBusy ? 'generating…' : '✨ Generate'}</button>
                {chat && chat.background && <button onClick={() => setChatWallpaper('')} className="rounded-xl border border-white/10 px-3 py-2 text-sm text-em-text-dim transition hover:text-red-400">Clear</button>}
              </div>
            </div>
          </div>
        )}

      {/* Tools: persona · mood · memories · music */}
      {chat && (
        <>
        <div className="flex flex-wrap items-center gap-2 border-b border-white/5 bg-white/[0.02] px-4 py-2 text-sm">
          {/* You as (persona) */}
          <div className="relative">
            <button
              onClick={() => { setShowPersonaMenu((v) => !v); setShowMoodMenu(false); }}
              title="You as — your persona in this chat"
              className={'flex items-center gap-1.5 rounded-lg border px-2 py-1 transition ' + (showPersonaMenu ? 'border-em-accent/50 text-em-accent' : 'border-white/10 bg-white/[0.03] text-em-text-dim hover:border-em-accent/40 hover:text-em-text')}
            >
              {activePersona
                ? <Avatar src={activePersona.avatar} name={activePersona.name} size={20} />
                : <PersonaIcon />}
              <span className="hidden text-em-text-dim sm:inline">You:</span>
              <span className="max-w-[8rem] truncate font-medium text-em-text">{activePersona ? activePersona.name : 'User'}</span>
            </button>
            {showPersonaMenu && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setShowPersonaMenu(false)} />
                <div className="pop-in absolute left-0 top-full z-40 mt-1.5 max-h-[60vh] w-64 overflow-y-auto rounded-xl border border-white/10 bg-em-panel p-1.5 shadow-2xl" style={{ transformOrigin: 'top left' }}>
                  <div className="px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-em-text-dim">Play as</div>
                  <button onClick={() => { setPersona(null); setShowPersonaMenu(false); }} className={'flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left transition ' + (!chat.activePersonaId ? 'bg-em-accent/15 text-em-accent' : 'hover:bg-white/5 text-em-text')}>
                    <span className="grid h-7 w-7 place-items-center rounded-full bg-white/5"><PersonaIcon /></span>
                    <span className="flex-1 text-sm">User <span className="text-em-text-dim">(default)</span></span>
                  </button>
                  {Object.values(personas).map((p) => {
                    const active = chat.activePersonaId === p.id;
                    return (
                      <div key={p.id} className={'group flex items-center gap-2 rounded-lg px-2 py-1.5 ' + (active ? 'bg-em-accent/15' : 'hover:bg-white/5')}>
                        <button onClick={() => { setPersona(p.id); setShowPersonaMenu(false); }} className="flex min-w-0 flex-1 items-center gap-2 text-left">
                          <Avatar src={p.avatar} name={p.name} size={28} className="shrink-0" />
                          <span className={'truncate text-sm ' + (active ? 'font-semibold text-em-accent' : 'text-em-text')}>{p.name}</span>
                        </button>
                        <button onClick={() => editPersona(p)} title="Edit persona" className="grid h-7 w-7 shrink-0 place-items-center rounded text-em-text-dim opacity-0 transition hover:text-em-text group-hover:opacity-100"><PencilIcon /></button>
                      </div>
                    );
                  })}
                  <button onClick={newPersona} className="mt-1 flex w-full items-center gap-2 rounded-lg border border-em-accent/30 px-2 py-1.5 text-sm font-medium text-em-accent transition hover:bg-em-accent/10">
                    <PlusIcon /> Create persona
                  </button>
                </div>
              </>
            )}
          </div>

          {/* Mood */}
          <div className="relative">
            <button
              onClick={() => { setShowMoodMenu((v) => !v); setShowPersonaMenu(false); }}
              title="Set the character's current mood"
              className={'flex items-center gap-1.5 rounded-lg border px-2 py-1 transition ' + (chat.mood ? 'border-em-accent/50 bg-em-accent/15 text-em-accent' : (showMoodMenu ? 'border-em-accent/50 text-em-accent' : 'border-white/10 bg-white/[0.03] text-em-text-dim hover:border-em-accent/40 hover:text-em-text'))}
            >
              <span className="text-base leading-none">{chat.mood ? moodEmoji(chat.mood) : <MoodIcon />}</span>
              <span className="font-medium capitalize">{chat.mood || 'Mood'}</span>
            </button>
            {showMoodMenu && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setShowMoodMenu(false)} />
                <div className="pop-in absolute left-0 top-full z-40 mt-1.5 w-64 rounded-xl border border-white/10 bg-em-panel p-2 shadow-2xl" style={{ transformOrigin: 'top left' }}>
                  <div className="mb-1.5 flex items-center justify-between px-1">
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-em-text-dim">Mood</span>
                    {chat.mood && <button onClick={() => { setMood(''); setShowMoodMenu(false); }} className="text-[11px] text-em-text-dim transition hover:text-red-400">Clear</button>}
                  </div>
                  <div className="grid grid-cols-3 gap-1.5">
                    {MOODS.map((m) => {
                      const active = chat.mood === m.key;
                      return (
                        <button
                          key={m.key}
                          onClick={() => { setMood(m.key); setShowMoodMenu(false); }}
                          className={'flex flex-col items-center gap-0.5 rounded-lg border px-1 py-2 text-xs capitalize transition ' + (active ? 'border-em-accent/60 bg-em-accent/15 text-em-accent' : 'border-white/10 text-em-text-dim hover:border-em-accent/40 hover:bg-white/5 hover:text-em-text')}
                        >
                          <span className="text-xl leading-none">{m.emoji}</span>
                          {m.key}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </>
            )}
          </div>

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

          {/* In-chat model switcher (table-stakes; switch mid-conversation) */}
          {onChangeModel && (
            <label className="ml-auto flex items-center gap-1.5 text-em-text-dim" title="Model used for replies">
              <span className="hidden sm:inline">Model</span>
              <select
                value={settings.model}
                onChange={(e) => onChangeModel(e.target.value)}
                className="max-w-[10rem] rounded-lg border border-white/10 bg-em-panel px-2 py-1 text-em-text focus:border-em-accent/50 focus:outline-none"
              >
                <option value="local-qwen">Default (backend)</option>
                {localModels.length > 0 && (
                  <optgroup label="Local (Ollama)">
                    {localModels.map((m) => <option key={m} value={m}>{m}</option>)}
                  </optgroup>
                )}
                {(settings.remoteModels || []).filter((m) => m.id).length > 0 && (
                  <optgroup label="Remote">
                    {(settings.remoteModels || []).filter((m) => m.id).map((m) => <option key={m.id} value={m.id}>{m.name || m.id}</option>)}
                  </optgroup>
                )}
              </select>
            </label>
          )}
        </div>

        {showCast && (
          <div className="border-b border-white/5 bg-white/[0.02] px-4 py-3 text-sm">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span className="text-em-text-dim">In scene:</span>
              {activeParticipants().map((c) => {
                const host = c.id === char.id;
                const speaking = !!chat.activeSpeakerId && chat.activeSpeakerId === c.id;
                return (
                  <span key={c.id} className={'flex items-center gap-1.5 rounded-full border py-1 pl-1 pr-2 ' + (speaking ? 'border-em-accent/60 bg-em-accent/10' : 'border-white/10 bg-em-panel')}>
                    <Avatar src={c.avatar} name={displayName(c)} size={22} />
                    <span className="font-medium text-em-text">{displayName(c)}</span>
                    {host && <span title="Host" className="text-[10px] text-em-accent">★</span>}
                    {!host && (
                      <button onClick={() => removeParticipant(c.id)} className="text-em-text-dim transition hover:text-red-400" title="Remove from scene">✕</button>
                    )}
                  </span>
                );
              })}

              {/* Visual add-character picker */}
              <div className="relative">
                <button
                  onClick={() => { setShowAddCast((v) => !v); setCastQuery(''); }}
                  className={'flex items-center gap-1.5 rounded-full border px-3 py-1.5 transition ' + (showAddCast ? 'border-em-accent/50 text-em-accent' : 'border-dashed border-white/20 text-em-text-dim hover:border-em-accent/40 hover:text-em-text')}
                >
                  <PlusIcon /> Add character
                </button>
                {showAddCast && (
                  <>
                    <div className="fixed inset-0 z-30" onClick={() => setShowAddCast(false)} />
                    <div className="pop-in absolute left-0 top-full z-40 mt-1.5 w-72 rounded-xl border border-white/10 bg-em-panel p-2 shadow-2xl" style={{ transformOrigin: 'top left' }}>
                      <input
                        autoFocus
                        value={castQuery}
                        onChange={(e) => setCastQuery(e.target.value)}
                        placeholder="Search your characters…"
                        className="mb-2 w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-sm text-em-text placeholder:text-em-text-dim/60 focus:border-em-accent/50 focus:outline-none"
                      />
                      <div className="grid max-h-72 grid-cols-3 gap-1.5 overflow-y-auto">
                        {Object.values(charsById)
                          .filter((c) => !participantIds().includes(c.id) && !c.isArchived)
                          .filter((c) => !castQuery.trim() || displayName(c).toLowerCase().includes(castQuery.trim().toLowerCase()))
                          .sort((a, b) => (a.name || '').localeCompare(b.name || ''))
                          .map((c) => (
                            <button
                              key={c.id}
                              onClick={() => { addParticipant(c.id); setShowAddCast(false); }}
                              title={displayName(c)}
                              className="flex flex-col items-center gap-1 rounded-lg border border-transparent p-1.5 text-center transition hover:border-em-accent/40 hover:bg-white/5"
                            >
                              <Avatar src={c.avatar} name={displayName(c)} size={48} rounded="rounded-xl" />
                              <span className="w-full truncate text-[11px] text-em-text">{displayName(c)}</span>
                            </button>
                          ))}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
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
          <div className="border-b border-white/5 bg-white/[0.02] px-4 py-3">
            <div style={{ maxWidth: 'var(--chat-max-width)' }} className="mx-auto flex w-full items-center gap-3 rounded-2xl border border-white/10 bg-em-panel/60 p-2.5 backdrop-blur">
              {/* big play/pause */}
              <button
                onClick={() => (musicPlaying ? toggleMusic() : playMusic())}
                title={musicPlaying ? 'Pause' : 'Play'}
                className={'grid h-11 w-11 shrink-0 place-items-center rounded-full transition active:scale-90 ' + (musicPlaying ? 'bg-em-accent text-em-bg beat-ring' : 'border border-em-accent/40 text-em-accent hover:bg-em-accent/10')}
              >
                {musicPlaying ? <PauseIcon className="h-5 w-5" /> : <PlayIcon className="h-5 w-5" />}
              </button>
              <div className="min-w-0 flex-1">
                <div className="mb-1 flex items-center gap-2 text-[11px] font-medium uppercase tracking-wide text-em-text-dim">
                  <MusicIcon className="h-3.5 w-3.5" />
                  {musicPlaying ? <span className="flex items-center gap-1.5 text-em-accent">Now playing <span className="eq"><i /><i /><i /><i /></span></span> : 'Background music'}
                </div>
                <input
                  value={musicUrl}
                  onChange={(e) => setMusicUrl(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') playMusic(); }}
                  placeholder="Paste a YouTube link or direct audio URL…"
                  className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-sm text-em-text placeholder:text-em-text-dim/60 focus:border-em-accent/50 focus:outline-none"
                />
              </div>
              <div className="hidden items-center gap-1.5 text-em-text-dim sm:flex" title="Volume">
                <span className="text-base">{musicVolume < 0.01 ? '🔇' : musicVolume < 0.5 ? '🔉' : '🔊'}</span>
                <input
                  type="range" min="0" max="1" step="0.01"
                  value={musicVolume}
                  onChange={(e) => setMusicVolume(parseFloat(e.target.value))}
                  className="h-1.5 w-24 cursor-pointer accent-em-accent"
                />
              </div>
              <button onClick={stopMusic} title="Stop" className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-white/10 text-em-text-dim transition hover:border-red-400/40 hover:text-red-400"><StopIcon /></button>
            </div>
          </div>
        )}
        </>
      )}

      {/* Chat body + profile sidebar */}
      <div className="flex min-h-0 flex-1 overflow-hidden">
      <div className="relative flex min-w-0 flex-1 flex-col">
      {/* Messages (wrapped so the jump button anchors above the composer) */}
      <div className="relative flex min-h-0 flex-1 flex-col">
      <div ref={scrollRef} onScroll={onScroll} style={{ gap: 'var(--message-spacing)', maxWidth: 'var(--chat-max-width)' }} className="mx-auto flex w-full flex-1 flex-col overflow-y-auto px-4 py-6">
        {chat && chat.promptFloor > 0 && (
          <div className="flex items-center justify-center py-1">
            <span className="rounded-full border border-em-accent/25 bg-em-accent/5 px-3 py-0.5 text-[11px] text-em-text-dim">📚 {chat.promptFloor} earlier message{chat.promptFloor === 1 ? '' : 's'} folded into memory — still shown, kept out of active context</span>
          </div>
        )}
        {history.map((m, i) => {
          const ts = tsFromMsgId(m.id);
          const prevTs = i > 0 ? tsFromMsgId(history[i - 1].id) : 0;
          const divider = ts && (i === 0 || new Date(ts).toDateString() !== new Date(prevTs).toDateString());
          return (
            <Fragment key={m.id}>
              {divider ? (
                <div className="flex items-center justify-center py-1" style={{ marginTop: i === 0 ? 0 : 'calc(var(--message-spacing) / 2)' }}>
                  <span className="rounded-full border border-white/10 bg-em-bg/60 px-3 py-0.5 text-[11px] text-em-text-dim backdrop-blur">{dayLabel(ts)}</span>
                </div>
              ) : null}
              <MessageBubble
                anchorId={'msg-' + m.id}
                msg={m}
                char={char}
                ts={ts}
                streaming={streaming}
                showThink={settings.showThink}
                onRegenerate={() => regenerate(m)}
                onRegenerateTweak={(t) => regenerate(m, t)}
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
                onOpenImage={setLightbox}
                onReact={(emoji) => reactMessage(m, emoji)}
              />
            </Fragment>
          );
        })}
        {history.length === 0 && <div className="py-20 text-center text-em-text-dim">Say hello to start the scene…</div>}
      </div>

      {/* Jump to latest (only when scrolled up) — anchored to the bottom of the
          messages area so it floats just above the composer, not over it. */}
      {!atBottom && history.length > 0 && (
        <button
          onClick={scrollToBottom}
          title="Jump to latest"
          className="pop-in absolute bottom-3 left-1/2 z-20 grid h-10 w-10 -translate-x-1/2 place-items-center rounded-full border border-em-accent/40 bg-em-panel/95 text-em-accent shadow-2xl backdrop-blur transition hover:bg-em-panel active:scale-90"
        >
          <ArrowDown className="h-5 w-5" />
        </button>
      )}
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

      {/* Image gallery — every generated photo in this chat */}
      {showGallery && (() => {
        const imgs = [];
        (history || []).forEach((m) => (m.variations || []).forEach((v) => { if (v.image) imgs.push(v.image); }));
        return (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" onClick={() => setShowGallery(false)}>
            <div className="flex max-h-[85vh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl glass-panel shadow-2xl" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
                <h2 className="flex items-center gap-2 text-lg font-bold"><Images className="h-5 w-5" /> Gallery <span className="text-em-text-dim">({imgs.length})</span></h2>
                <button onClick={() => setShowGallery(false)} className="grid h-8 w-8 place-items-center rounded-lg text-em-text-dim transition hover:bg-white/5 hover:text-em-text">✕</button>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto p-4">
                {imgs.length === 0 ? (
                  <p className="py-10 text-center text-sm text-em-text-dim">No photos in this chat yet.</p>
                ) : (
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
                    {imgs.map((src, i) => (
                      <button key={i} onClick={() => { setShowGallery(false); setLightbox(src); }} className="aspect-square overflow-hidden rounded-xl border border-white/10 transition hover:border-em-accent/50">
                        <img src={src} alt="" className="h-full w-full object-cover transition hover:scale-105" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* Image lightbox — view a generated photo full-size */}
      {lightbox && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 p-4 backdrop-blur-sm" onClick={() => setLightbox(null)}>
          <img src={lightbox} alt="" className="max-h-[90vh] max-w-[95vw] rounded-xl object-contain shadow-2xl" onClick={(e) => e.stopPropagation()} />
          <div className="absolute right-4 top-4 flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
            <a href={lightbox} download={'aria-' + Date.now() + '.png'} target="_blank" rel="noreferrer" title="Download / open" className="grid h-10 w-10 place-items-center rounded-full border border-white/20 bg-em-panel/80 text-em-text transition hover:border-em-accent/50 hover:text-em-accent"><DownloadGlyph className="h-5 w-5" /></a>
            <button onClick={() => setLightbox(null)} title="Close" className="grid h-10 w-10 place-items-center rounded-full border border-white/20 bg-em-panel/80 text-em-text transition hover:text-em-text">✕</button>
          </div>
        </div>
      )}

      {/* In-chat message search */}
      {showSearch && (
        <div className="fixed inset-0 z-[60] flex items-start justify-center bg-black/70 p-4 pt-[10vh] backdrop-blur-sm" onClick={() => setShowSearch(false)}>
          <div className="flex max-h-[75vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl glass-panel shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2 border-b border-white/10 px-4 py-3">
              <SearchIcon className="h-4 w-4 shrink-0 text-em-text-dim" />
              <input autoFocus value={searchQ} onChange={(e) => setSearchQ(e.target.value)} placeholder={searchAll ? 'Search all chats…' : 'Search this conversation…'} className="w-full bg-transparent text-em-text placeholder:text-em-text-dim/60 focus:outline-none" />
              <div className="flex shrink-0 overflow-hidden rounded-lg border border-white/10 text-[11px]">
                <button onClick={() => setSearchAll(false)} className={'px-2 py-1 transition ' + (!searchAll ? 'bg-em-accent/20 text-em-accent' : 'text-em-text-dim hover:text-em-text')}>This chat</button>
                <button onClick={() => setSearchAll(true)} className={'px-2 py-1 transition ' + (searchAll ? 'bg-em-accent/20 text-em-accent' : 'text-em-text-dim hover:text-em-text')}>All chats</button>
              </div>
              <button onClick={() => setShowSearch(false)} className="text-em-text-dim transition hover:text-em-text">✕</button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-1.5">
              {(() => {
                const s = searchQ.trim().toLowerCase();
                if (!s) return <p className="px-3 py-6 text-center text-sm text-em-text-dim">Type to search messages.</p>;
                const snip = (txt) => { const at = txt.toLowerCase().indexOf(s); return (at > 40 ? '…' : '') + txt.slice(Math.max(0, at - 40), at + 80) + (txt.length > at + 80 ? '…' : ''); };
                const scopes = searchAll ? sessions : [chat];
                const rows = [];
                scopes.forEach((sess) => (sess.history || []).forEach((m) => {
                  const txt = stripPhotoTag(getMessageText(m));
                  if (txt.toLowerCase().includes(s)) rows.push({ sess, m, txt });
                }));
                if (!rows.length) return <p className="px-3 py-6 text-center text-sm text-em-text-dim">No matches.</p>;
                return rows.slice(0, 100).map(({ sess, m, txt }) => (
                  <button key={sess.id + ':' + m.id} onClick={() => jumpAcross(sess.id, m.id)} className="block w-full rounded-xl px-3 py-2 text-left transition hover:bg-white/5">
                    <div className="flex items-center gap-1.5 text-[11px] font-medium text-em-accent">
                      {m.sender === 'user' ? 'You' : displayName(charsById[m.speakerId] || char)}
                      {searchAll && <span className="text-em-text-dim/70">· {sess.name || 'Chat'}</span>}
                    </div>
                    <div className="line-clamp-2 text-sm text-em-text/90">{snip(txt)}</div>
                  </button>
                ));
              })()}
            </div>
          </div>
        </div>
      )}

      {/* In-app confirm (replaces window.confirm) */}
      {confirm && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" onClick={() => setConfirm(null)}>
          <div className="w-full max-w-sm rounded-2xl glass-panel p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <p className="mb-4 text-sm text-em-text">{confirm.message}</p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setConfirm(null)} className="rounded-xl border border-white/10 px-4 py-2 text-sm text-em-text-dim transition hover:text-em-text">Cancel</button>
              <button autoFocus onClick={() => { const fn = confirm.onYes; setConfirm(null); fn && fn(); }} className="rounded-xl bg-red-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-600">{confirm.label}</button>
            </div>
          </div>
        </div>
      )}

      {/* Transient toast (fork, etc.) */}
      {toast && (
        <div className="pointer-events-none fixed inset-x-0 bottom-28 z-40 flex justify-center">
          <div className="pop-in rounded-full border border-em-accent/40 bg-em-panel px-4 py-2 text-sm font-medium text-em-text shadow-2xl">{toast}</div>
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
        {(settings.replyOptions || settings.storyChoices) && !streaming && chat && (sug.suggesting || sug.suggestions.length > 0) && (
          sug.choiceMode ? (
            <div style={{ maxWidth: 'var(--chat-max-width)' }} className="mx-auto w-full px-4 pt-3">
              {sug.suggesting && sug.suggestions.length === 0 ? (
                <span className="text-sm text-em-text-dim">🎭 weighing your options…</span>
              ) : (
                <div className="grid gap-2 sm:grid-cols-2">
                  {sug.suggestions.map((opt, i) => (
                    <button
                      key={i}
                      onClick={() => pickSuggestion(opt)}
                      className="group flex items-center gap-2.5 rounded-xl border border-em-accent/25 bg-em-accent/[0.07] px-3 py-2.5 text-left text-sm text-em-text transition hover:-translate-y-0.5 hover:border-em-accent/60 hover:bg-em-accent/15"
                      title={opt}
                    >
                      <span className="grid h-5 w-5 shrink-0 place-items-center rounded-md bg-em-accent/20 text-[11px] font-bold text-em-accent">{i + 1}</span>
                      <span className="min-w-0 flex-1">{opt}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div style={{ maxWidth: 'var(--chat-max-width)' }} className="mx-auto flex w-full flex-wrap gap-2 px-4 pt-3">
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
          )
        )}
        <div style={{ maxWidth: 'var(--chat-max-width)' }} className="relative mx-auto w-full px-4 py-3">
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
              <button onClick={() => { const r = rollDice('d20'); sendText(r.text, r.dice ? { dice: r.dice } : undefined); }} disabled={streaming} title="Roll a d20" className="grid h-9 w-9 place-items-center rounded-xl border border-white/10 text-em-text-dim transition hover:border-em-accent/40 hover:text-em-accent disabled:opacity-40"><Dices className="h-4 w-4" /></button>
              <button onClick={continueScene} disabled={streaming || history.length === 0} title="Continue the scene (no new message)" className="grid h-9 w-9 place-items-center rounded-xl border border-white/10 text-em-text-dim transition hover:border-em-accent/40 hover:text-em-accent disabled:opacity-40"><ContinueIcon /></button>
              <button onClick={impersonate} disabled={streaming || impersonating || history.length === 0} title="Write my reply for me (impersonate)" className="grid h-9 w-9 place-items-center rounded-xl border border-white/10 text-em-text-dim transition hover:border-em-accent/40 hover:text-em-accent disabled:opacity-40">{impersonating ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-em-accent border-t-transparent" /> : <PenLine className="h-4 w-4" />}</button>
              {/* Director — storytelling nudges */}
              <div className="relative">
                <button onClick={() => setShowDirector((v) => !v)} disabled={streaming} title="Director — steer the story" className={'grid h-9 w-9 place-items-center rounded-xl border transition disabled:opacity-40 ' + (showDirector ? 'border-em-accent/50 text-em-accent' : 'border-white/10 text-em-text-dim hover:border-em-accent/40 hover:text-em-accent')}><Clapperboard className="h-4 w-4" /></button>
                {showDirector && (
                  <>
                    <div className="fixed inset-0 z-30" onClick={() => setShowDirector(false)} />
                    <div className="pop-in absolute bottom-full left-0 z-40 mb-2 w-56 rounded-xl border border-white/10 bg-em-panel p-1.5 shadow-2xl" style={{ transformOrigin: 'bottom left' }}>
                      <div className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-em-text-dim">🎬 Director</div>
                      {DIRECTOR_ACTIONS.map((d) => (
                        <button
                          key={d.label}
                          onClick={() => { setShowDirector(false); sendText('(Director note — act on this, do not quote it: ' + d.text + '.)'); }}
                          className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm text-em-text transition hover:bg-white/5"
                        >
                          <span className="w-5 text-center">{d.icon}</span>{d.label}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
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
      </div>

      {/* Profile sidebar — fills wide-screen side space with character context */}
      {showSidebar && (
        <aside className="hidden w-72 shrink-0 flex-col gap-4 overflow-y-auto border-l border-white/10 bg-em-bg/40 p-4 backdrop-blur-xl xl:flex">
          <div className="flex flex-col items-center text-center">
            <div className={'relative ' + (musicPlaying ? 'beat-ring rounded-2xl' : '')}>
              <Avatar src={char.avatar} name={displayName(char)} size={96} rounded="rounded-2xl" className={musicPlaying ? 'avatar-dancing' : ''} />
              {settings.presence && (() => {
                const p = presenceFor(char.id);
                const asleep = p.state === 'asleep';
                return <span title={p.label} className={'absolute -bottom-1 -right-1 h-5 w-5 rounded-full border-2 border-em-bg ' + (asleep ? 'bg-indigo-400' : 'bg-em-accent')} />;
              })()}
            </div>
            <div className="mt-3 text-lg font-bold">{displayName(char)}</div>
            {settings.presence && <div className="text-xs capitalize text-em-text-dim">{presenceFor(char.id).label}</div>}
            {char.tags && (
              <div className="mt-2 flex flex-wrap justify-center gap-1">
                {String(char.tags).split(',').map((t) => t.trim()).filter(Boolean).slice(0, 6).map((t) => (
                  <span key={t} className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] text-em-text-dim">{t}</span>
                ))}
              </div>
            )}
          </div>

          {char.description && (
            <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-3">
              <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-em-text-dim">About</div>
              <p className="line-clamp-5 text-xs leading-relaxed text-em-text/80">{expandPlaceholders(char.description, displayName(char), activePersona ? activePersona.name : 'User')}</p>
            </div>
          )}

          {settings.relationship && chat && chat.relationship && (
            <button onClick={() => setShowInner(true)} className="rounded-2xl border border-white/10 bg-white/[0.02] p-3 text-left transition hover:border-em-accent/40">
              <div className="mb-2 flex items-center gap-2">
                <span className="text-xl leading-none">{stageFor(chat.relationship.affection).emoji}</span>
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-em-accent">{stageFor(chat.relationship.affection).label}</div>
                  <div className="text-[10px] text-em-text-dim">tap for inner life →</div>
                </div>
              </div>
              <div className="space-y-1.5">
                <Meter label="Affection" value={chat.relationship.affection} />
                <Meter label="Trust" value={chat.relationship.trust} />
                <Meter label="Tension" value={chat.relationship.tension} />
              </div>
            </button>
          )}

          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => setShowMemories(true)} className="flex items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.02] px-2 py-2 text-xs text-em-text-dim transition hover:border-em-accent/40 hover:text-em-text"><MemoryIcon /> Memory</button>
            <button onClick={startCall} className="flex items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.02] px-2 py-2 text-xs text-em-text-dim transition hover:border-em-accent/40 hover:text-em-text"><Phone className="h-4 w-4" /> Call</button>
            {onEdit && <button onClick={() => onEdit(char)} className="flex items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.02] px-2 py-2 text-xs text-em-text-dim transition hover:border-em-accent/40 hover:text-em-text"><PencilIcon /> Edit</button>}
            <button onClick={newChatClicked} className="flex items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.02] px-2 py-2 text-xs text-em-text-dim transition hover:border-em-accent/40 hover:text-em-text"><PlusIcon /> New chat</button>
            <button onClick={() => setShowGallery(true)} className="col-span-2 flex items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.02] px-2 py-2 text-xs text-em-text-dim transition hover:border-em-accent/40 hover:text-em-text"><Images className="h-4 w-4" /> Gallery</button>
          </div>

          {/* Context fill — rough estimate of how much of the model's window the chat uses */}
          {chat && (() => {
            const active = (chat.history || []).filter((m) => !m.isStreaming).slice(chat.promptFloor || 0);
            const histChars = active.reduce((n, m) => n + getMessageText(m).length, 0);
            const extra = (char.description || '').length + (chat.memories || '').length + (char.lore || '').length;
            const tokens = Math.round((histChars + extra) / 4);
            const max = resolveModel(settings, settings.model).numCtx || 131072;
            const pct = Math.min(100, Math.round((tokens / max) * 100));
            return (
              <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-3">
                <div className="mb-1 flex items-center justify-between text-[11px] text-em-text-dim">
                  <span className="font-semibold uppercase tracking-wide">Context</span>
                  <span>{tokens >= 1000 ? (tokens / 1000).toFixed(1) + 'k' : tokens} / {max >= 1000 ? Math.round(max / 1000) + 'k' : max} tok</span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                  <div className={'h-full rounded-full ' + (pct > 85 ? 'bg-red-400' : pct > 60 ? 'bg-amber-400' : 'bg-em-accent')} style={{ width: Math.max(2, pct) + '%' }} />
                </div>
                <button onClick={summarizeNow} disabled={summarizing} className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg border border-white/10 px-2 py-1.5 text-[11px] text-em-text-dim transition hover:border-em-accent/40 hover:text-em-text disabled:opacity-50">
                  <MemoryIcon /> {summarizing ? 'Summarizing…' : 'Summarize to memory'}
                </button>
                {pct > 85 && <div className="mt-1 text-[10px] text-red-300/80">Nearly full — older turns may drop.</div>}
              </div>
            );
          })()}
        </aside>
      )}
      </div>

      {/* Voice call overlay */}
      {inCall && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 bg-em-bg/95 backdrop-blur-xl">
          <button
            onClick={interruptSpeaking}
            disabled={callStatus !== 'speaking'}
            title={callStatus === 'speaking' ? 'Tap to interrupt' : ''}
            className={'relative h-40 w-40 overflow-hidden rounded-full border-2 ' + (callStatus === 'speaking' ? 'beat-ring border-em-accent cursor-pointer' : 'border-white/15 cursor-default')}
          >
            <Avatar src={char.avatar} name={char.name} size={156} className={callStatus === 'listening' ? 'avatar-dancing' : ''} />
          </button>
          <div className="text-2xl font-bold">{displayName(char)}</div>
          <div className="flex items-center gap-2 text-sm text-em-text-dim">
            {callError
              ? <span className="text-red-400">{callError}</span>
              : <>
                  <span className="eq"><i /><i /><i /><i /></span>
                  {callStatus === 'listening' ? 'Listening…' : callStatus === 'thinking' ? 'Thinking…' : callStatus === 'speaking' ? 'Speaking… (tap avatar to interrupt)' : 'On call'}
                </>}
          </div>
          {callTranscript && <div className="max-w-md px-6 text-center text-em-text">{callTranscript}</div>}
          <div className="mt-2 flex items-center gap-5">
            <button onClick={toggleCallMute} title={callMuted ? 'Unmute' : 'Mute'} className={'grid h-14 w-14 place-items-center rounded-full border transition ' + (callMuted ? 'border-white/15 bg-white/10 text-em-text-dim' : 'border-em-accent/40 bg-em-accent/15 text-em-accent')}>
              {callMuted ? <MicOff className="h-6 w-6" /> : <Mic className="h-6 w-6" />}
            </button>
            <button onClick={endCall} title="Hang up" className="grid h-16 w-16 place-items-center rounded-full bg-red-500 text-white shadow-lg transition hover:bg-red-600 active:scale-95">
              <PhoneOff className="h-7 w-7" />
            </button>
          </div>
          {!voiceSupported && <div className="text-xs text-em-text-dim">Tip: voice recognition works in Chrome/Edge.</div>}
        </div>
      )}

      {showMemories && chat && (
        <MemoriesModal char={char} chat={chat} personas={personas} onSave={saveMemories} onClose={() => setShowMemories(false)} />
      )}

      {personaEdit && (
        <PersonaModal
          persona={personaEdit && personaEdit.id ? personaEdit : null}
          onSave={savePersonaFromModal}
          onDelete={deletePersonaFromModal}
          onClose={() => setPersonaEdit(null)}
        />
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
                {(() => {
                  const st = stageFor(chat.relationship.affection);
                  const idx = REL_STAGES.indexOf(st);
                  const next = REL_STAGES[idx + 1];
                  return (
                    <div className="rounded-2xl border border-em-accent/25 bg-em-accent/[0.06] p-3">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl leading-none">{st.emoji}</span>
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-em-accent">{st.label}</div>
                          <div className="text-[11px] text-em-text-dim">How {displayName(char)} acts toward you right now</div>
                        </div>
                      </div>
                      {st.unlocks && st.unlocks.length > 0 && (
                        <ul className="mt-2.5 space-y-1">
                          {st.unlocks.map((u, i) => (
                            <li key={i} className="flex items-start gap-1.5 text-[12px] text-em-text"><span className="mt-px text-em-accent">✓</span><span>{u}</span></li>
                          ))}
                        </ul>
                      )}
                      {(() => { const te = trustEffect(chat.relationship.trust), xe = tensionEffect(chat.relationship.tension); return (te || xe) ? (
                        <div className="mt-2 space-y-0.5 border-t border-white/10 pt-2 text-[11px] text-em-text-dim">
                          {te && <div>🤝 {te}</div>}
                          {xe && <div>⚡ {xe}</div>}
                        </div>
                      ) : null; })()}
                      {next ? (
                        <div className="mt-2 border-t border-white/10 pt-2">
                          <div className="mb-1 flex items-center justify-between text-[11px] text-em-text-dim">
                            <span>Lv.{idx + 1} → Lv.{idx + 2} {next.emoji} {next.label}</span>
                            <span className="text-em-text-dim/70">{next.min - chat.relationship.affection} to go</span>
                          </div>
                          <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                            <div className="h-full rounded-full bg-gradient-to-r from-rose-400 to-em-accent transition-all" style={{ width: Math.max(4, Math.min(100, Math.round((chat.relationship.affection - st.min) / (next.min - st.min) * 100))) + '%' }} />
                          </div>
                        </div>
                      ) : (
                        <div className="mt-2 border-t border-white/10 pt-2 text-[11px] font-semibold text-em-accent">★ Max level reached</div>
                      )}
                    </div>
                  );
                })()}
                {/* Stage ladder — visible progression: unlocked ✓ / current / locked 🔒 */}
                {(() => {
                  const cur = REL_STAGES.indexOf(stageFor(chat.relationship.affection));
                  return (
                    <div className="flex items-stretch gap-1">
                      {REL_STAGES.map((s, i) => (
                        <div key={s.key} title={`Lv.${i + 1} ${s.label} · ${s.min}+ affection`}
                          className={'flex flex-1 flex-col items-center gap-0.5 rounded-lg border px-0.5 py-1.5 text-center transition ' +
                            (i === cur ? 'border-em-accent/50 bg-em-accent/15' : i < cur ? 'border-white/10 bg-white/[0.04]' : 'border-white/5 bg-transparent opacity-50')}>
                          <span className="text-base leading-none">{i <= cur ? s.emoji : '🔒'}</span>
                          <span className={'text-[9px] leading-none ' + (i === cur ? 'font-bold text-em-accent' : 'text-em-text-dim')}>Lv.{i + 1}</span>
                        </div>
                      ))}
                    </div>
                  );
                })()}
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

            {chat.facts && chat.facts.length > 0 && (
              <div className="mt-5 border-t border-white/10 pt-4">
                <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-em-text-dim">🧠 Known facts ({chat.facts.length})</div>
                <ul className="space-y-1 text-sm">
                  {chat.facts.map((f, i) => <li key={i} className="flex gap-2 text-em-text"><span className="text-em-accent">•</span><span>{f}</span></li>)}
                </ul>
              </div>
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
