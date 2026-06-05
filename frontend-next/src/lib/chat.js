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
  if (char.description) sections.push('--- CHARACTER DESCRIPTION ---\n' + exp(char.description));
  if (char.lore) sections.push('--- LORE / BACKGROUND KNOWLEDGE ---\n' + exp(char.lore));
  if (chat.mood) sections.push('--- CHARACTER CURRENT MOOD (IMPORTANT) ---\n' + cName + ' is currently feeling ' + chat.mood + '.');
  if (chat.memories && chat.memories.trim()) {
    sections.push('--- CHAT MEMORIES (HIGH PRIORITY - always honor these) ---\n' + exp(chat.memories));
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
export async function streamCompletion(messages, opts) {
  opts = opts || {};
  const body = {
    model: opts.model || 'local-qwen',
    messages,
    temperature: opts.temperature != null ? opts.temperature : 0.7,
    top_p: 0.95,
    stream: true,
    character_id: opts.characterId,
    chat_id: opts.chatId,
    options: { num_ctx: 131072, top_p: 0.95 },
  };
  const resp = await fetch('/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
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
export async function summarizeChat(char, chat, personas, signal) {
  const uName = personaName(chat, personas);
  const transcript = (chat.history || [])
    .filter((m) => !m.isStreaming)
    .slice(-40)
    .map((m) => (m.sender === 'user' ? uName : displayName(char)) + ': ' + getMessageText(m))
    .join('\n');
  if (!transcript.trim()) return '';
  const sys = 'Summarize the conversation into 5-10 concise bullet points capturing key events, '
    + 'facts, relationships and unresolved threads. No markdown headers, no intro/outro — bullets only.';
  return collectCompletion([{ role: 'system', content: sys }, { role: 'user', content: transcript }], { signal });
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
    { model: opts.model, temperature: 0.7, signal: opts.signal },
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
  if (speaker.lore) sections.push('--- LORE / BACKGROUND KNOWLEDGE ---\n' + exp(speaker.lore));
  if (chat.mood) sections.push('--- CURRENT MOOD (IMPORTANT) ---\n' + sName + ' is currently feeling ' + chat.mood + '.');
  if (chat.memories && chat.memories.trim()) {
    sections.push('--- CHAT MEMORIES (HIGH PRIORITY - always honor these) ---\n' + exp(chat.memories));
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
