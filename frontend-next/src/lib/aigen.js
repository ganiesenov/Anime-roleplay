// AI helpers for the character editor — one-shot LLM calls that fill in a whole
// character card or an opening scenario. Ported from the legacy ai-gen.js so the
// prompt shape + tolerant JSON parsing match. Routing (local/remote endpoint +
// key) is supplied by the caller via resolveModel(settings).

import { collectCompletion } from './chat.js';

const CHAR_SYS =
  'Output a single raw JSON object (no markdown fences) with keys: '
  + 'cardName, chatName (short first name), description (one plain string structured as 8 numbered headings: '
  + 'Identity/Role, Personality, Speech Style, Abilities, Appearance, Likes/Dislikes, Past, Dialog Examples; 300-600 words), '
  + 'tags (10-20 comma-separated), instructions (AI behavior bullets).';

const SCENARIO_SYS =
  'You write a 10-15 sentence opening scenario paragraph addressing the user as "you" (second person), '
  + "describing the relationship/dynamic, the current scene, the character's wants, weaving in three quoted lines of dialogue, "
  + 'concise direct prose, world-specific, ending on an open invitation. Output the paragraph only.';

export function formatGenError(err) {
  const m = String((err && err.message) || err).toLowerCase();
  if (/failed to fetch|network/.test(m)) return 'Network error — is the backend reachable?';
  if (/401|403/.test(m)) return 'API key invalid.';
  if (/404|not found/.test(m)) return 'Model not found.';
  if (/429|rate|quota/.test(m)) return 'Rate-limited or quota exceeded.';
  if (/50\d/.test(m)) return 'Server error.';
  return 'Generation failed.';
}

// Tolerant JSON extractor — escapes bare newlines/tabs inside strings, then
// brace-counts the first balanced {...}, with a truncation-repair fallback.
export function robustJsonParse(raw) {
  let s = String(raw || '');
  let inStr = false, esc = false, out = '';
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (esc) { out += ch; esc = false; continue; }
    if (ch === '\\') { out += ch; esc = true; continue; }
    if (ch === '"') { inStr = !inStr; out += ch; continue; }
    if (inStr && ch === '\n') { out += '\\n'; continue; }
    if (inStr && ch === '\t') { out += '\\t'; continue; }
    out += ch;
  }
  s = out;
  const startIdx = s.indexOf('{');
  if (startIdx !== -1) {
    let depth = 0, end = -1, strMode = false, e2 = false;
    for (let i = startIdx; i < s.length; i++) {
      const ch = s[i];
      if (e2) { e2 = false; continue; }
      if (ch === '\\') { e2 = true; continue; }
      if (ch === '"') { strMode = !strMode; continue; }
      if (strMode) continue;
      if (ch === '{') depth++;
      else if (ch === '}') { depth--; if (depth === 0) { end = i + 1; break; } }
    }
    if (end !== -1) {
      try { return JSON.parse(s.slice(startIdx, end)); } catch (e) { /* try repair */ }
    }
    let repaired = s.slice(startIdx);
    if ((repaired.match(/"/g) || []).length % 2 !== 0) repaired += '"';
    const opens = (repaired.match(/\{/g) || []).length;
    const closes = (repaired.match(/\}/g) || []).length;
    for (let i = 0; i < opens - closes; i++) repaired += '}';
    try { return JSON.parse(repaired); } catch (e) { /* fail */ }
  }
  throw new Error('Could not parse generated JSON: ' + s.slice(0, 120));
}

// Generate a full character card from a free-text concept (or random if blank).
// `req` is the result of resolveModel(settings, ...): { model, endpoint, apiKey }.
// Returns { name, chatName, description, tags, instructions }.
export async function generateCharacter(concept, req, signal) {
  const user = concept && concept.trim() ? 'Concept: ' + concept.trim() : 'Invent something interesting at random.';
  const raw = await collectCompletion(
    [{ role: 'system', content: CHAR_SYS }, { role: 'user', content: user }],
    { ...(req || {}), temperature: 0.8, signal },
  );
  const obj = robustJsonParse(raw);
  let desc = obj.description;
  if (desc && typeof desc === 'object') desc = Object.keys(desc).map((k) => k + '\n' + desc[k]).join('\n\n');
  return {
    name: obj.cardName || obj.chatName || '',
    chatName: obj.chatName || '',
    description: desc || '',
    tags: obj.tags || '',
    instructions: obj.instructions || '',
  };
}

const APPEARANCE_SYS =
  'You are an expert Danbooru tagger for anime image generation. Output ONE line of comma-separated Danbooru tags '
  + 'identifying this character.\n'
  + '• If they are a RECOGNIZABLE existing character, output ONLY: their exact Danbooru character tag as '
  + '"name (series)", then the series copyright tag, then 1girl or 1boy — and NOTHING else. Do NOT add hair/eye '
  + 'colour or any physical attributes: the image model already knows this character and your guesses would override '
  + 'the canonical look (e.g. output exactly "makima (chainsaw man), chainsaw man, 1girl").\n'
  + '• Only for ORIGINAL/unknown characters: add 1girl/1boy + hair colour & length + eye colour + notable body features.\n'
  + 'Never include outfit/clothing (decided per scene). Lowercase, tags only — no sentences, no quotes, no markdown.';

// Derive Danbooru-style appearance tags for a character via the LLM (it knows
// famous characters). Returns a single comma-separated line.
export async function generateAppearance({ name, description, tags }, req, signal) {
  const user = 'Character name: ' + (name || 'unknown')
    + '\nDescription: ' + String(description || '').slice(0, 700)
    + (tags ? '\nExisting tags: ' + tags : '');
  const text = await collectCompletion(
    [{ role: 'system', content: APPEARANCE_SYS }, { role: 'user', content: user }],
    { ...(req || {}), temperature: 0.4, signal },
  );
  return String(text || '')
    .replace(/```/g, '')
    .split('\n').map((s) => s.trim()).filter(Boolean).join(', ')
    .replace(/^["']|["']$/g, '')
    .trim();
}

// Translate a free-text (any language) image request into English Danbooru tags
// for the image model. Content-neutral: passes through whatever the user wrote.
export async function tagsFromText(text, req, signal) {
  const out = await collectCompletion(
    [
      { role: 'system', content: 'You are a translator to Danbooru tags. Convert the user\'s image request into ONE single line of comma-separated ENGLISH Danbooru tags for an anime image model. Translate any non-English words to English. Do NOT roleplay, do NOT add prose or quotes — output ONLY the tag line.' },
      { role: 'user', content: String(text || '') },
    ],
    { ...(req || {}), temperature: 0.2, signal },
  );
  const lines = String(out || '').replace(/```/g, '').split('\n')
    .map((s) => s.trim())
    .filter(Boolean)
    .filter((l) => !/[Ѐ-ӿ]/.test(l));            // drop any Cyrillic RP prose
  const tagLines = lines.filter((l) => l.includes(','));
  const pick = (tagLines.length ? tagLines[tagLines.length - 1] : lines[lines.length - 1]) || '';
  return pick.replace(/^["'*\s-]+|["'*\s]+$/g, '').trim();
}

// Turn the CURRENT roleplay moment into concrete Danbooru tags for the shot, so a
// generated photo actually depicts what's happening — not a generic portrait. The
// chat model often softens its own inline [photo:] tag; this dedicated pass is told
// to match the scene faithfully and uncensored (the user runs a local image model).
// Returns action/pose/clothing/framing tags only — identity is added separately.
export async function tagsFromScene({ name, transcript, hint }, req, signal) {
  const sys = 'You write the prompt for an uncensored anime image model (Danbooru tags). '
    + 'Given a roleplay excerpt, output ONE line of comma-separated ENGLISH Danbooru tags describing EXACTLY this single photo of '
    + (name || 'the character') + ' at this moment: facial expression/emotion, pose and body position, what they are wearing OR their state of undress, '
    + 'any physical action or sexual act happening, who else is in frame, camera framing/angle, and the setting. '
    + 'Match the scene faithfully and literally — if the moment is sexual or explicit, use the concrete explicit tags for it; do NOT censor, soften, or substitute vague words. '
    + 'Do NOT include the character\'s fixed appearance (hair/eye colour etc.) — only what is specific to THIS shot. '
    + 'Output ONLY the tag line: no prose, no quotes, no commentary.';
  const user = (hint ? 'The character intended this shot: ' + hint + '\n\n' : '')
    + 'Roleplay excerpt (most recent last):\n' + String(transcript || '').slice(-1500);
  const out = await collectCompletion(
    [{ role: 'system', content: sys }, { role: 'user', content: user }],
    { ...(req || {}), temperature: 0.5, signal },
  );
  const lines = String(out || '').replace(/```/g, '').replace(/<think>[\s\S]*?<\/think>/gi, '')
    .split('\n').map((s) => s.trim()).filter(Boolean)
    .filter((l) => !/[Ѐ-ӿ]/.test(l));
  const tagLines = lines.filter((l) => l.includes(','));
  const pick = (tagLines.length ? tagLines[tagLines.length - 1] : lines[lines.length - 1]) || '';
  return pick.replace(/^["'*\s-]+|["'*\s]+$/g, '').trim();
}

// Generate an opening-scenario paragraph from the current name/description/lore.
export async function generateScenario({ name, description, lore, hints }, req, signal) {
  const user = 'Character name: ' + (name || 'the character')
    + '\nDescription: ' + String(description || '').slice(0, 900)
    + '\nLore: ' + String(lore || '').slice(0, 700)
    + (hints ? '\nHints: ' + hints : '');
  const text = await collectCompletion(
    [{ role: 'system', content: SCENARIO_SYS }, { role: 'user', content: user }],
    { ...(req || {}), temperature: 0.8, signal },
  );
  return text.trim();
}
