// Chat helpers ported/adapted from the legacy js/chat.js so the new chat is
// prompt- and storage-compatible with the backend and AriaBD.
import { splitThink } from './format.js';

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

// Builds the system prompt for a single-character dialog (the common path).
// World/story/multi-character narration aren't ported yet.
export function buildSystemPrompt(char, chat, personas) {
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
  return sections.join('\n\n');
}

export function buildMessagesArray(char, chat, personas, lastUserText) {
  const cName = displayName(char);
  const uName = personaName(chat, personas);
  const messages = [{ role: 'system', content: buildSystemPrompt(char, chat, personas) }];

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
    model: 'local-qwen',
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

export { splitThink };
