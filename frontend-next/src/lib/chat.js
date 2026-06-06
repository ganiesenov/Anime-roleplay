// Chat helpers ported/adapted from the legacy js/chat.js so the new chat is
// prompt- and storage-compatible with the backend and AriaBD.
import { splitThink } from './format.js';
import { relationshipSection } from './relationship.js';

export function genId(first) {
  if (first) return 'msg-' + Date.now();
  return 'msg-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
}

export function displayName(char) {
  return (char && (char.chatName || char.name)) || 'Character';
}

export function getMessageText(m) {
  if (!m) return '';
  if (m.sender === 'user') return m.main || '';
  const v = m.variations && m.variations[m.activeVariant || 0];
  return v ? v.main || '' : '';
}

export function getMessageThink(m) {
  if (!m || m.sender === 'user') return '';
  const v = m.variations && m.variations[m.activeVariant || 0];
  return v ? v.think || '' : '';
}

export function expandPlaceholders(text, charName, userName) {
  return String(text == null ? '' : text)
    .replace(/\{\{char\}\}/gi, charName || 'Character')
    .replace(/\{\{user\}\}/gi, userName || 'User');
}

function personaName(chat, personas) {
  if (chat && chat.activePersonaId && personas[chat.activePersonaId]) {
    return personas[chat.activePersonaId].name || 'User';
  }
  return 'User';
}

const REPLY_LEN = { short: '3-4', medium: '6-7', long: '9-10', verylong: '12-13' };

const REPLY_LEN_MAP = { short: '3-4', medium: '6-7', long: '9-10', verylong: '12-13' };

// Anti-sycophancy: a short, high-priority push toward genuine autonomy. Kept
// deliberately concise so it doesn't bloat the system prompt.
const AUTONOMY_DIRECTIVE = '--- AUTONOMY (you are a person, not an assistant) ---\n'
  + 'You have your own will, opinions, moods and boundaries. Disagree, tease, refuse, change the subject '
  + 'or be in a bad mood when it fits you — do NOT simply mirror, flatter or accommodate the user. You may be '
  + 'wrong, withhold, or have your own agenda. Never break character to be helpful.';

const PHOTO_DIRECTIVE = '--- SENDING PHOTOS ---\n'
  + 'You can send the user a photo of yourself when it genuinely fits the moment — flirting, showing off, '
  + 'reacting, or when asked. To do so, add ONE tag on its own line at the very END of your reply: '
  + '[photo: comma-separated Danbooru-style tags describing THIS shot — your expression/emotion, pose, framing, '
  + 'what you are wearing OR your state of undress, and the setting]. Match the scene: if the moment is intimate or '
  + 'sexual you may be fully explicit (concrete tags like nude, topless, lingerie, etc.) — do not censor or soften it. '
  + 'Use concrete tags, not prose. Use it sparingly, only when it feels natural. Do not mention the tag in your spoken text.';

// Pull a [photo: ...] tag out of a reply. Returns { clean, prompt } — clean has all
// such tags removed; prompt is the first tag's description (or '' if none).
export function extractPhotoTag(text) {
  const s = String(text || '');
  const re = /\[\s*photo\s*:\s*([^\]]+)\]/gi;
  let prompt = '';
  const m = re.exec(s);
  if (m) prompt = m[1].trim();
  const clean = s.replace(/\[\s*photo\s*:\s*[^\]]+\]/gi, '').replace(/\n{3,}/g, '\n\n').trim();
  return { clean, prompt };
}

// Remove a (possibly half-streamed) photo tag for display, so it never flashes.
export function stripPhotoTag(text) {
  return String(text || '').replace(/\[\s*photo\s*:[^\]]*\]?/gi, '');
}

function appearanceForPhoto(char) {
  const name = ((char && char.name) || '').trim();
  const app = ((char && char.appearance && char.appearance.trim()) || (char && char.tags) || '').trim();
  // Always lead with the character name — anime (Danbooru-trained) models like
  // Animagine recognise known characters by name/tag, so this sharpens the likeness.
  return [name, app].filter(Boolean).join(', ');
}

// Build a GET image URL for a character selfie. Returns a URL an <img> can load
// directly — the provider is chosen in settings:
//  • 'a1111'       → local Stable Diffusion via our backend (/api/txt2img)
//  • 'pollinations'→ hosted service via the image proxy (needs a free token now)
export function buildPhotoUrl(char, prompt, settings) {
  settings = settings || {};
  // Quality tags only — do NOT force a "selfie/looking at viewer" framing here, or it
  // fights any scene the [photo:] tag describes. The tag itself carries the composition.
  const QUALITY = 'masterpiece, best quality, very aesthetic, absurdres';
  const full = [appearanceForPhoto(char), prompt, QUALITY].filter(Boolean).join(', ');
  const seed = Math.floor(Math.random() * 1e6);
  const size = [512, 768, 1024].includes(settings.photoSize) ? settings.photoSize : 768;
  const dims = '&width=' + size + '&height=' + size;

  if (settings.imageProvider === 'comfy') {
    const base = (settings.comfyUrl || 'http://127.0.0.1:8188').trim();
    let u = '/api/txt2img?backend=comfy&prompt=' + encodeURIComponent(full) + '&url=' + encodeURIComponent(base) + dims + '&seed=' + seed;
    if (settings.comfyModel && settings.comfyModel.trim()) u += '&model=' + encodeURIComponent(settings.comfyModel.trim());
    return u;
  }

  if (settings.imageProvider === 'a1111') {
    const base = (settings.sdUrl || 'http://127.0.0.1:7860').trim();
    return '/api/txt2img?backend=a1111&prompt=' + encodeURIComponent(full) + '&url=' + encodeURIComponent(base) + dims + '&seed=' + seed;
  }

  // Pollinations (default). Append the user's token if they have one.
  let src = 'https://image.pollinations.ai/prompt/' + encodeURIComponent(full)
    + '?nologo=true&seed=' + seed + dims;
  if (settings.imageToken && settings.imageToken.trim()) src += '&token=' + encodeURIComponent(settings.imageToken.trim());
  return '/api/img?url=' + encodeURIComponent(src);
}

// Active-variant image for an AI message (set after a reply that included a photo tag).
export function getMessageImage(m) {
  if (!m) return '';
  if (m.variations && m.variations.length) {
    const v = m.variations[m.activeVariant || 0];
    return (v && v.image) || '';
  }
  return m.image || '';
}

// Whether the active variant's photo is still being generated (show a spinner).
export function getMessageImageLoading(m) {
  if (!m || !m.variations) return false;
  const v = m.variations[m.activeVariant || 0];
  return !!(v && v.imageLoading);
}

// Builds the system prompt for a single-character dialog (the common path).
// World/story/multi-character narration aren't ported yet.
export function buildSystemPrompt(char, chat, personas, opts) {
  opts = opts || {};
  const cName = displayName(char);
  const uName = personaName(chat, personas);
  const exp = (t) => expandPlaceholders(t, cName, uName);
  const sections = [];

  if (chat.activePersonaId && personas[chat.activePersonaId]) {
    const p = personas[chat.activePersonaId];
    sections.push('--- EXACT USER PERSONA ---\n' + (p.name || 'User') + (p.description ? '\n' + exp(p.description) : ''));
  }
  if (char.instructions) sections.push('--- CHARACTER AI INSTRUCTIONS ---\n' + exp(char.instructions));
  if (opts.autonomy) sections.push(AUTONOMY_DIRECTIVE);
  if (opts.aiPhotos) sections.push(PHOTO_DIRECTIVE);
  if (char.description) sections.push('--- CHARACTER DESCRIPTION ---\n' + exp(char.description));
  if (char.lore) sections.push('--- LORE / BACKGROUND KNOWLEDGE ---\n' + exp(char.lore));
  if (chat.mood) sections.push('--- CHARACTER CURRENT MOOD (IMPORTANT) ---\n' + cName + ' is currently feeling ' + chat.mood + '.');
  if (chat.memories && chat.memories.trim()) {
    sections.push('--- CHAT MEMORIES (HIGH PRIORITY - always honor these) ---\n' + exp(chat.memories));
  }
  if (opts.pinned && opts.pinned.length) {
    sections.push('--- PINNED (the user marked these as important — always keep them in mind) ---\n' + opts.pinned.map((t) => '- ' + t).join('\n'));
  }
  if (opts.relationship && chat.relationship) {
    sections.push(relationshipSection(chat.relationship, cName, uName));
  }
  if (opts.presenceText) sections.push(opts.presenceText);
  if (REPLY_LEN_MAP[opts.replyLength]) {
    sections.push('--- REPLY LENGTH ---\nWrite roughly ' + REPLY_LEN_MAP[opts.replyLength] + ' sentences.');
  }
  return sections.join('\n\n');
}

export function buildMessagesArray(char, chat, personas, lastUserText, opts) {
  const cName = displayName(char);
  const uName = personaName(chat, personas);
  const messages = [{ role: 'system', content: buildSystemPrompt(char, chat, personas, opts) }];

  let history = (chat.history || []).filter((m) => !m.isStreaming);
  if (lastUserText != null && history.length && history[history.length - 1].sender === 'user') {
    history = history.slice(0, -1);
  }
  history.forEach((m) => {
    messages.push({ role: m.sender === 'user' ? 'user' : 'assistant', content: getMessageText(m) });
  });

  if (lastUserText != null) {
    let content = lastUserText;
    if (char.reminder) content += '\n[' + char.reminder + ']';
    if (chat.mood) content += '[MOOD — TOP PRIORITY: right now ' + cName + ' is feeling ' + chat.mood + '. Make this emotion unmistakable in this reply.]';
    messages.push({ role: 'user', content: expandPlaceholders(content, cName, uName) });
  }
  return messages;
}

// Stream a completion from the local backend. onContent/onReasoning get deltas.
// A request targets the local backend (default) unless opts.endpoint points
// elsewhere. Remote endpoints (e.g. OpenRouter) get a Bearer key from opts.apiKey
// and the OpenRouter attribution headers, and the request goes straight from the
// browser — so the backend RAG/summary/depth only apply to local models.
function isLocalEndpoint(url) {
  return !url || url.startsWith('/') || /^https?:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/.test(url);
}

export async function streamCompletion(messages, opts) {
  opts = opts || {};
  const endpoint = opts.endpoint || '/v1/chat/completions';
  const local = isLocalEndpoint(endpoint);
  const body = {
    model: opts.model || 'local-qwen',
    messages,
    temperature: opts.temperature != null ? opts.temperature : 0.7,
    top_p: 0.95,
    stream: true,
    character_id: opts.characterId,
    chat_id: opts.chatId,
    options: { num_ctx: opts.numCtx || 131072, top_p: 0.95 },
  };
  const headers = { 'Content-Type': 'application/json' };
  if (!local && opts.apiKey) {
    headers['Authorization'] = 'Bearer ' + opts.apiKey;
    if (endpoint.indexOf('openrouter') !== -1) {
      headers['HTTP-Referer'] = (typeof location !== 'undefined' && location.origin) || 'https://aria.local';
      headers['X-Title'] = 'Aria';
    }
  }
  const resp = await fetch(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    signal: opts.signal,
  });
  if (!resp.ok) {
    const t = await resp.text().catch(() => '');
    throw new Error('HTTP ' + resp.status + (t ? ': ' + t : ''));
  }
  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop();
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data:')) continue;
      const payload = trimmed.slice(5).trim();
      if (payload === '[DONE]') return;
      try {
        const json = JSON.parse(payload);
        const delta = json.choices && json.choices[0] && json.choices[0].delta;
        if (delta) {
          if (delta.content) opts.onContent && opts.onContent(delta.content);
          if (delta.reasoning) opts.onReasoning && opts.onReasoning(delta.reasoning);
        }
      } catch (e) { /* skip malformed */ }
    }
  }
}

// Collect a full (non-streamed) completion into a string. Used for summaries.
export async function collectCompletion(messages, opts) {
  let out = '';
  await streamCompletion(messages, { ...(opts || {}), onContent: (c) => { out += c; } });
  return out.trim();
}

// Summarize the recent transcript into memory bullets (manual "summarize now").
// opts: { signal, model, endpoint, apiKey } — model routing for the summary call
// (defaults to the local backend). Back-compat: a bare AbortSignal is still accepted.
export async function summarizeChat(char, chat, personas, opts) {
  opts = (opts && typeof opts.aborted === 'boolean') ? { signal: opts } : (opts || {});
  const uName = personaName(chat, personas);
  const transcript = (chat.history || [])
    .filter((m) => !m.isStreaming)
    .slice(-40)
    .map((m) => (m.sender === 'user' ? uName : displayName(char)) + ': ' + getMessageText(m))
    .join('\n');
  if (!transcript.trim()) return '';
  const sys = 'Summarize the conversation into 5-10 concise bullet points capturing key events, '
    + 'facts, relationships and unresolved threads. No markdown headers, no intro/outro — bullets only.';
  return collectCompletion(
    [{ role: 'system', content: sys }, { role: 'user', content: transcript }],
    { signal: opts.signal, model: opts.model, endpoint: opts.endpoint, apiKey: opts.apiKey },
  );
}

// Parse the model's reply-suggestion output into up to 2 strings. Tolerates
// stray prose around the JSON array (think tags, lead-in text) via a bracket scan.
export function parseReplyOptions(raw) {
  let s = String(raw || '').replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
  try { const arr = JSON.parse(s); if (Array.isArray(arr)) return arr.slice(0, 2).map(String); } catch (e) { /* fallback */ }
  const starts = [];
  for (let i = 0; i < s.length; i++) if (s[i] === '[') starts.push(i);
  for (const start of starts) {
    for (let end = s.length; end > start; end--) {
      if (s[end - 1] !== ']') continue;
      try {
        const arr = JSON.parse(s.slice(start, end));
        if (Array.isArray(arr) && arr.length) return arr.slice(0, 2).map(String);
      } catch (e) { /* keep scanning */ }
    }
  }
  return [];
}

// Ask the model for 2 short first-person user replies to the last AI turn.
export async function suggestReplies(char, chat, personas, opts) {
  opts = opts || {};
  const lastAi = [...(chat.history || [])].reverse().find((m) => m.sender !== 'user' && !m.isStreaming);
  if (!lastAi) return [];
  const aiText = getMessageText(lastAi);
  if (!aiText || aiText.length < 5) return [];

  let personaCtx = '';
  if (chat.activePersonaId && personas[chat.activePersonaId]) {
    const p = personas[chat.activePersonaId];
    personaCtx = '\nThe user is roleplaying as "' + (p.name || 'User') + '": ' + String(p.description || '').slice(0, 200);
  }
  const sys = 'You generate exactly 2 short reply options spoken by the human user (first person, single sentence each, '
    + 'specific to the scene, two distinct directions, no narration).' + personaCtx
    + '\nOutput strictly a JSON array of 2 strings, e.g. ["...","..."].';
  const user = 'Character: ' + displayName(char) + '\nLast message: ' + aiText.slice(0, 600)
    + '\nGenerate the 2 user replies now as a JSON array.';

  const raw = await collectCompletion(
    [{ role: 'system', content: sys }, { role: 'user', content: user }],
    { model: opts.model, endpoint: opts.endpoint, apiKey: opts.apiKey, temperature: 0.7, signal: opts.signal },
  );
  return parseReplyOptions(raw);
}

export { splitThink };

// ── Group / multi-character ───────────────────────────────────────────────
// One character ("speaker") replies while aware of every cast member present.

export function buildGroupSystemPrompt(speaker, participants, chat, personas, opts) {
  opts = opts || {};
  const uName = personaName(chat, personas);
  const sName = displayName(speaker);
  const exp = (t) => expandPlaceholders(t, sName, uName);
  const names = participants.map((c) => displayName(c)).join(', ');
  const sections = [];

  sections.push(
    '--- GROUP SCENE ---\n'
    + 'This is a group roleplay. Characters present: ' + names + '.\n'
    + 'The user is ' + uName + '.\n'
    + 'You are ' + sName + '. Respond ONLY as ' + sName + ' — never write dialogue or '
    + 'actions for the user or for the other characters.',
  );

  const cast = participants.map((c) => {
    const d = (c.description || '').trim();
    return '• ' + displayName(c) + (d ? ': ' + exp(d).slice(0, 400) : '');
  }).join('\n');
  sections.push('--- CAST ---\n' + cast);

  if (chat.activePersonaId && personas[chat.activePersonaId]) {
    const p = personas[chat.activePersonaId];
    sections.push('--- EXACT USER PERSONA ---\n' + (p.name || 'User') + (p.description ? '\n' + exp(p.description) : ''));
  }
  if (speaker.instructions) sections.push('--- YOUR INSTRUCTIONS (' + sName + ') ---\n' + exp(speaker.instructions));
  if (opts.autonomy) sections.push(AUTONOMY_DIRECTIVE);
  if (opts.aiPhotos) sections.push(PHOTO_DIRECTIVE);
  if (speaker.lore) sections.push('--- LORE / BACKGROUND KNOWLEDGE ---\n' + exp(speaker.lore));
  if (chat.mood) sections.push('--- CURRENT MOOD (IMPORTANT) ---\n' + sName + ' is currently feeling ' + chat.mood + '.');
  if (chat.memories && chat.memories.trim()) {
    sections.push('--- CHAT MEMORIES (HIGH PRIORITY - always honor these) ---\n' + exp(chat.memories));
  }
  if (opts.pinned && opts.pinned.length) {
    sections.push('--- PINNED (the user marked these as important — always keep them in mind) ---\n' + opts.pinned.map((t) => '- ' + t).join('\n'));
  }
  if (opts.relationship && chat.relationship) {
    sections.push(relationshipSection(chat.relationship, sName, uName));
  }
  if (opts.presenceText) sections.push(opts.presenceText);
  if (REPLY_LEN_MAP[opts.replyLength]) {
    sections.push('--- REPLY LENGTH ---\nWrite roughly ' + REPLY_LEN_MAP[opts.replyLength] + ' sentences.');
  }
  return sections.join('\n\n');
}

export function buildGroupMessages(speaker, participants, charsById, chat, personas, lastUserText, opts) {
  opts = opts || {};
  const sName = displayName(speaker);
  const uName = personaName(chat, personas);
  const messages = [{ role: 'system', content: buildGroupSystemPrompt(speaker, participants, chat, personas, opts) }];

  let history = (chat.history || []).filter((m) => !m.isStreaming);
  if (lastUserText != null && history.length && history[history.length - 1].sender === 'user') {
    history = history.slice(0, -1);
  }
  history.forEach((m) => {
    if (m.sender === 'user') {
      messages.push({ role: 'user', content: getMessageText(m) });
    } else {
      // Label each assistant turn with its speaker so the model can follow who said what.
      const spk = (charsById && charsById[m.speakerId]) || speaker;
      messages.push({ role: 'assistant', content: displayName(spk) + ': ' + getMessageText(m) });
    }
  });

  if (lastUserText != null) {
    let content = lastUserText;
    if (speaker.reminder) content += '\n[' + speaker.reminder + ']';
    if (chat.mood) content += '[MOOD — TOP PRIORITY: right now ' + sName + ' is feeling ' + chat.mood + '. Make this emotion unmistakable in this reply.]';
    content = expandPlaceholders(content, sName, uName);
    content += '\n[Now respond as ' + sName + ' only.]';
    messages.push({ role: 'user', content });
  }
  return messages;
}
