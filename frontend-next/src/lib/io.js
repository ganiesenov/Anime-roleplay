// Import / export for the new UI. Reads/writes the same AriaBD store as the
// legacy app, so backups and SillyTavern V2 character cards stay interoperable.
import { getAllCharacters, getAllPersonas, saveCharacter, savePersona } from './db.js';

// ── file readers ────────────────────────────────────────────────────────────
function readText(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = reject;
    r.readAsText(file);
  });
}
function readArrayBuffer(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = reject;
    r.readAsArrayBuffer(file);
  });
}
function readDataURL(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

// ── export ──────────────────────────────────────────────────────────────────
export async function exportBackup() {
  const charList = await getAllCharacters();
  const personaList = await getAllPersonas();
  if (!charList.length && !personaList.length) { window.alert('Nothing to export.'); return; }

  const characters = {};
  charList.forEach((c) => { if (c && c.id) characters[c.id] = c; });
  const personas = {};
  personaList.forEach((p) => { if (p && p.id) personas[p.id] = p; });

  const payload = { version: 3, characters, personas, appSettings: { availableModels: [] } };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const d = new Date();
  const ymd = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  a.href = url;
  a.download = 'aria_export_' + ymd + '.json';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ── single-character sharing (file card + copyable code) ────────────────────
// A "card" is the character minus its chat history (which is personal). Shared as
// a v3 payload so it round-trips through the existing import path.
function cardOf(char) {
  const c = { ...(char || {}) };
  delete c.chats;
  return normalizeCharacter(c);
}

// Download one character as a .json card (the same shape Import understands).
export function exportCharacterCard(char) {
  if (!char) return;
  const payload = { version: 3, characters: [cardOf(char)], personas: [] };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = (char.name || 'character').replace(/[^\w-]+/g, '_').slice(0, 50) + '.json';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// UTF-8-safe base64 helpers for the share code.
function toB64(str) { return btoa(unescape(encodeURIComponent(str))); }
function fromB64(b64) { return decodeURIComponent(escape(atob(b64))); }

// A short(ish) copy-paste code for a character. Heavy embedded media (data: URLs)
// is dropped so the code stays pasteable — use the file export to keep the avatar.
export function characterToCode(char) {
  const c = cardOf(char);
  if (typeof c.avatar === 'string' && c.avatar.startsWith('data:')) c.avatar = '';
  if (typeof c.background === 'string' && c.background.startsWith('data:')) c.background = '';
  if (typeof c.danceUrl === 'string' && c.danceUrl.startsWith('data:')) c.danceUrl = '';
  return 'ARIA1:' + toB64(JSON.stringify(c));
}

// Decode an ARIA1 share code (or a bare/v3 JSON) and save it under a fresh id.
export async function importCode(code) {
  const s = String(code || '').trim().replace(/^ARIA1:/i, '');
  if (!s) return null;
  let card;
  try { card = JSON.parse(fromB64(s)); }
  catch (e) { window.alert('That doesn’t look like a valid character code.'); return null; }
  let chr = card;
  if (card && card.version === 3 && card.characters) {
    const list = Array.isArray(card.characters) ? card.characters : Object.values(card.characters);
    chr = list[0];
  }
  if (!chr || !chr.name) { window.alert('That code didn’t contain a character.'); return null; }
  const norm = normalizeCharacter({ ...chr, id: 'char-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8) });
  await saveCharacter(norm);
  window.alert('Imported "' + norm.name + '".');
  return { type: 'card', char: norm };
}

// ── import (auto-routed by file type/content) ───────────────────────────────
export async function importFile(file) {
  const name = (file.name || '').toLowerCase();
  if (file.type === 'image/png' || name.endsWith('.png')) return importPng(file);
  if (file.type === 'application/json' || name.endsWith('.json')) return importJson(file);
  window.alert('Unsupported file type. Use .png or .json.');
  return null;
}

async function importPng(file) {
  const buf = await readArrayBuffer(file);
  const json = extractPngText(new Uint8Array(buf));
  if (!json) { window.alert('No embedded character data found in this PNG.'); return null; }
  const avatar = await readDataURL(file).catch(() => '');   // the PNG itself becomes the avatar
  const char = mapExternalCard(json, avatar);
  await saveCharacter(char);
  window.alert('Imported "' + char.name + '".');
  return { type: 'card', char };
}

async function importJson(file) {
  let data;
  try { data = JSON.parse(await readText(file)); }
  catch (e) { window.alert('Could not parse JSON file.'); return null; }

  if (data && typeof data.spec === 'string' && data.spec.indexOf('chara_card_v') === 0) {
    const char = mapExternalCard(data, '');
    await saveCharacter(char);
    window.alert('Imported "' + char.name + '".');
    return { type: 'card', char };
  }
  if (data && data.version === 3 && data.characters) return mergeBackup(data);

  window.alert('Unknown or unsupported JSON format.');
  return null;
}

async function mergeBackup(data) {
  const existingChars = await getAllCharacters();
  const charIds = new Set(existingChars.map((c) => c.id));
  let added = 0, skipped = 0;
  for (const id of Object.keys(data.characters || {})) {
    if (charIds.has(id)) { skipped++; continue; }
    await saveCharacter(normalizeCharacter(data.characters[id]));
    added++;
  }
  const existingPers = await getAllPersonas();
  const persIds = new Set(existingPers.map((p) => p.id));
  let addedP = 0;
  for (const id of Object.keys(data.personas || {})) {
    if (persIds.has(id)) continue;
    await savePersona(data.personas[id]);
    addedP++;
  }
  window.alert('Import complete: ' + added + ' characters added, ' + skipped + ' skipped, ' + addedP + ' personas.');
  return { type: 'backup', added, skipped, addedP };
}

// ── PNG tEXt extraction (V2 cards store JSON under the `chara` keyword) ──────
function extractPngText(bytes) {
  const sig = [137, 80, 78, 71, 13, 10, 26, 10];
  for (let i = 0; i < 8; i++) if (bytes[i] !== sig[i]) return null;
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let off = 8;
  while (off + 8 <= bytes.length) {
    const len = dv.getUint32(off);
    const type = String.fromCharCode(bytes[off + 4], bytes[off + 5], bytes[off + 6], bytes[off + 7]);
    const dataStart = off + 8;
    if (type === 'tEXt') {
      const text = new TextDecoder('utf-8').decode(bytes.subarray(dataStart, dataStart + len));
      const sep = text.indexOf('\0') !== -1 ? text.indexOf('\0') : text.indexOf(' ');
      if (sep !== -1) {
        const keyword = text.slice(0, sep);
        const payload = text.slice(sep + 1);
        if (keyword === 'chara') {
          const parsed = tryParseCardPayload(payload);
          if (parsed) return parsed;
        }
      }
    }
    off = dataStart + len + 4; // data + CRC
  }
  return null;
}

function tryParseCardPayload(payload) {
  try { return JSON.parse(payload); } catch (e) { /* try base64 */ }
  try { return JSON.parse(decodeURIComponent(escape(atob(payload)))); } catch (e) { return null; }
}

// ── V2 card → internal character ────────────────────────────────────────────
function mapExternalCard(external, avatarDataUrl) {
  const card = (external && external.data) ? external.data : external;
  const join = (arr) => arr.filter((x) => x && String(x).trim()).join('\n\n');

  const description = join([
    card.card_description || card.tagline,
    (card.personality || card.description || card.mes_example) ? '--- CHARACTER DESCRIPTION ---' : '',
    card.personality,
    card.description,
    card.mes_example ? '--- EXAMPLE MESSAGES ---' : '',
    card.mes_example,
  ]);

  const lorePieces = [];
  const cardDesc = card.card_description || card.tagline;
  const pushLore = (piece) => { if (piece && piece !== cardDesc) lorePieces.push(piece); };
  if (card.character_book) {
    if (typeof card.character_book === 'string') pushLore(card.character_book);
    else if (Array.isArray(card.character_book.entries)) {
      card.character_book.entries.forEach((en) => {
        const keys = (en.keys || (en.key ? [en.key] : [])).join(', ');
        pushLore('[' + keys + ']\n' + (en.content || en.value || ''));
      });
    }
  }
  pushLore(card.lorebook);
  pushLore(card.lore);
  pushLore(card.world_scenario);
  const notes = card.card_notes || card.creator_notes || card.creator_note || card.notes;
  if (notes) lorePieces.push('--- CARD NOTES ---\n' + sanitizeNotes(notes));
  const lore = lorePieces.join('\n\n');

  const scenarios = [];
  const mainGreeting = [card.scenario, card.first_mes].filter((x) => x && String(x).trim()).join('\n\n');
  if (mainGreeting) scenarios.push({ name: 'Main Greeting', text: mainGreeting });
  (card.alternate_greetings || []).forEach((g, i) => {
    if (g && String(g).trim()) scenarios.push({ name: 'Alternate Greeting ' + (i + 1), text: g });
  });

  const tags = Array.isArray(card.tags) ? card.tags.join(', ') : '';

  return normalizeCharacter({
    id: 'char-' + Date.now() + '-' + Math.random().toString(36).slice(2, 11),
    name: card.name || 'Unnamed Import',
    chatName: card.name || 'Unnamed Import',
    avatar: avatarDataUrl || card.avatar || '',
    background: '',
    description,
    lore,
    instructions: card.system_prompt || '',
    reminder: card.post_history_instructions || '',
    narratorReminder: '',
    tags,
    musicUrl: '',
    scenarios,
    type: 'character',
    characterIds: [],
    chats: {},
    isFavorite: false,
    isArchived: false,
  });
}

// Fill the fields the app relies on without dropping any extras already present.
function normalizeCharacter(c) {
  c = c || {};
  const tags = typeof c.tags === 'string' ? c.tags : (Array.isArray(c.tags) ? c.tags.join(', ') : '');
  return {
    ...c,
    id: c.id || ('char-' + Date.now() + '-' + Math.random().toString(36).slice(2, 11)),
    name: c.name || 'Unnamed',
    chatName: c.chatName || c.name || 'Unnamed',
    tags,
    scenarios: Array.isArray(c.scenarios) ? c.scenarios : [],
    type: c.type || 'character',
    chats: c.chats && typeof c.chats === 'object' ? c.chats : {},
    isFavorite: !!c.isFavorite,
    isArchived: !!c.isArchived,
  };
}

// Strip card-notes HTML down to readable text, preserving any image links.
function sanitizeNotes(html) {
  let s = String(html || '');
  const imgUrls = [];
  const imgRe = /https?:\/\/[^\s"'<>]+\.(?:png|jpe?g|gif|webp|bmp|svg)/gi;
  let m;
  while ((m = imgRe.exec(s))) imgUrls.push(m[0]);
  s = s.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '');
  s = s.replace(/<br\s*\/?>/gi, '\n').replace(/<\/p>/gi, '\n\n')
    .replace(/<\/div>/gi, '\n').replace(/<\/li>/gi, '\n').replace(/<li>/gi, '- ')
    .replace(/<\/?h[1-6][^>]*>/gi, '');
  s = s.replace(/<[^>]+>/g, '');
  s = decodeHtmlEntities(s);
  s = s.replace(/\r\n/g, '\n').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  if (imgUrls.length) s += '\n\nImage links:\n' + [...new Set(imgUrls)].join('\n');
  return s;
}

function decodeHtmlEntities(s) {
  const t = document.createElement('textarea');
  t.innerHTML = String(s || '');
  return t.value;
}
