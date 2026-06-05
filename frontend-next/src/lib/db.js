// Access to the shared IndexedDB (AriaBD). The new UI is served from the same
// origin (:8000/next), so it shares the exact store the legacy my-frontend app
// seeds from starter_pack_data.js and the user's own edits.
import { splitThink } from './format.js';

const DB_NAME = 'AriaBD';
// Must match the legacy app (js/state.js): same name + version + stores, so both
// UIs share one database. We open WITH the version + an upgrade handler so the
// new app is self-sufficient — it can create the stores on a profile where the
// legacy app never ran (otherwise reads return [] and writes silently no-op).
const DB_VERSION = 3;

function ensureStores(db) {
  if (!db.objectStoreNames.contains('characters'))
    db.createObjectStore('characters', { keyPath: 'id' });
  if (!db.objectStoreNames.contains('personas'))
    db.createObjectStore('personas', { keyPath: 'id' });
  if (!db.objectStoreNames.contains('settings'))
    db.createObjectStore('settings', { keyPath: 'key' });
}

function openAriaDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => ensureStores(req.result);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error('IndexedDB open blocked'));
  });
}

function getAllFromStore(db, store) {
  return new Promise((resolve) => {
    if (!db.objectStoreNames.contains(store)) {
      resolve([]);
      return;
    }
    const tx = db.transaction(store, 'readonly');
    const req = tx.objectStore(store).getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => resolve([]);
  });
}

export async function getAllCharacters() {
  try {
    const db = await openAriaDB();
    const chars = await getAllFromStore(db, 'characters');
    db.close();
    return Array.isArray(chars) ? chars : [];
  } catch (e) {
    return [];
  }
}

export async function getAllPersonas() {
  try {
    const db = await openAriaDB();
    const ps = await getAllFromStore(db, 'personas');
    db.close();
    return Array.isArray(ps) ? ps : [];
  } catch (e) {
    return [];
  }
}

export async function savePersona(persona) {
  if (!persona || !persona.id) return;
  try {
    const db = await openAriaDB();
    if (!db.objectStoreNames.contains('personas')) { db.close(); return; }
    await new Promise((resolve, reject) => {
      const tx = db.transaction('personas', 'readwrite');
      tx.objectStore('personas').put(persona);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch (e) { /* best effort */ }
}

// Persist a full character record (same store the legacy app writes, so chat
// edits stay in sync across both UIs).
export async function saveCharacter(char) {
  if (!char || !char.id) return;
  try {
    const db = await openAriaDB();
    if (!db.objectStoreNames.contains('characters')) { db.close(); return; }
    await new Promise((resolve, reject) => {
      const tx = db.transaction('characters', 'readwrite');
      tx.objectStore('characters').put(char);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch (e) {
    /* ignore — best effort */
  }
}

// Load the 130-character starter pack from `/starter_pack_data.js` (a ~38 MB
// `const STARTER_PACK_DATA = {…};` served from the my-frontend mount). We can't
// inject it as a <script> and read `window.STARTER_PACK_DATA` — a top-level
// `const` in a classic script is a lexical binding, NOT a window property — and
// from an ES module the binding is unreachable. So we fetch the text and parse
// the object literal (it's `JSON.stringify` output, so the slice between the
// first `{` and last `}` is valid JSON) instead of re-bundling 38 MB into the app.
async function loadStarterPackData() {
  try {
    const text = await fetch('/starter_pack_data.js').then((r) => (r.ok ? r.text() : ''));
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start === -1 || end <= start) return null;
    return JSON.parse(text.slice(start, end + 1));
  } catch (e) {
    return null;
  }
}

function putAll(db, store, records) {
  return new Promise((resolve, reject) => {
    if (!records.length || !db.objectStoreNames.contains(store)) { resolve(); return; }
    const tx = db.transaction(store, 'readwrite');
    const os = tx.objectStore(store);
    for (const r of records) { if (r && r.id) os.put(r); }
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

const SEED_FLAG = 'ariaNextStarterSeeded';

// Seed the 130 starter characters into AriaBD, merging by id: we only add
// starters that aren't already present, so the user's own characters and any
// edited starters are never clobbered. Runs once (guarded by a localStorage
// flag) so deleting a starter doesn't make it reappear on the next visit and the
// 38 MB pack isn't re-fetched every load. Returns the number of records added.
export async function seedStarterPackIfNeeded() {
  try {
    if (localStorage.getItem(SEED_FLAG)) return 0;

    const db = await openAriaDB();
    const existing = await getAllFromStore(db, 'characters');
    const existingIds = new Set(existing.map((c) => c && c.id));

    const pack = await loadStarterPackData();
    if (!pack) { db.close(); return 0; }

    const rawChars = pack.characters || pack;
    const allChars = Array.isArray(rawChars) ? rawChars : Object.values(rawChars);
    const missing = allChars.filter((c) => c && c.id && !existingIds.has(c.id));

    const rawPersonas = pack.personas;
    const allPersonas = rawPersonas
      ? (Array.isArray(rawPersonas) ? rawPersonas : Object.values(rawPersonas))
      : [];
    const existingPersonas = await getAllFromStore(db, 'personas');
    const personaIds = new Set(existingPersonas.map((p) => p && p.id));
    const missingPersonas = allPersonas.filter((p) => p && p.id && !personaIds.has(p.id));

    await putAll(db, 'characters', missing);
    await putAll(db, 'personas', missingPersonas);
    db.close();
    localStorage.setItem(SEED_FLAG, '1');
    return missing.length;
  } catch (e) {
    return 0;
  }
}

// Map a flat backend message ({role, content}) into the new app's variant-based
// message shape — same conversion the legacy app's `backendMsgToLocal` does.
function restoredMsg(m, chatId, idx, charId) {
  const split = splitThink(m.content || '');
  if (m.role === 'assistant') {
    return {
      id: 'msg-restored-' + chatId + '-' + idx,
      sender: 'ai', type: 'dialog', speakerId: charId, activeVariant: 0,
      variations: [{ main: split.main || m.content || '', think: split.think || null }],
    };
  }
  return { id: 'msg-restored-' + chatId + '-' + idx, sender: 'user', main: split.main || m.content || '' };
}

function chatLabel(chatId) {
  const ts = parseInt(String(chatId).replace(/^chat-/, ''), 10);
  if (!Number.isNaN(ts)) return new Date(ts).toLocaleString();
  return 'Restored chat';
}

// Restore characters + their chats from the backend's disk backups
// (data/characters, data/chats), merging into AriaBD: never clobbers a
// locally-present character, and only fills a chat when the server copy has more
// turns than the local one. Mirrors the legacy app's restoreCharactersFromServer
// + restoreChatsFromServer. Returns {characters, chats} counts that changed.
export async function restoreFromServer() {
  try {
    const db = await openAriaDB();
    const localChars = await getAllFromStore(db, 'characters');
    const byId = new Map(localChars.map((c) => [c.id, c]));

    // 1) pull cards that are missing locally
    let list = [];
    try { const r = await fetch('/api/characters'); if (r.ok) list = await r.json(); } catch (e) { /* offline */ }
    let addedChars = 0;
    const touched = new Set();
    for (const item of Array.isArray(list) ? list : []) {
      if (!item || !item.id || byId.has(item.id)) continue;
      try {
        const r = await fetch('/api/characters/' + encodeURIComponent(item.id));
        if (!r.ok) continue;
        const full = await r.json();
        if (full && full.id) { byId.set(full.id, full); touched.add(full.id); addedChars++; }
      } catch (e) { /* skip */ }
    }

    // 2) restore/fill chats from the server backups
    let summaries = [];
    try { const r = await fetch('/api/chats'); if (r.ok) summaries = await r.json(); } catch (e) { /* offline */ }
    for (const s of Array.isArray(summaries) ? summaries : []) {
      const char = byId.get(s.character_id);
      if (!char) continue;                       // orphan backup — no card
      char.chats = char.chats || {};
      const local = char.chats[s.chat_id];
      if (local && (local.history || []).length >= s.turns) continue; // local is newer/equal
      let full;
      try {
        const r = await fetch('/api/chats/' + encodeURIComponent(s.character_id) + '/' + encodeURIComponent(s.chat_id));
        if (!r.ok) continue;
        full = await r.json();
      } catch (e) { continue; }
      const history = (full.messages || [])
        .filter((m) => m.role !== 'system')
        .map((m, i) => restoredMsg(m, s.chat_id, i, char.id));
      if (local) {
        local.history = history;
      } else {
        char.chats[s.chat_id] = {
          id: s.chat_id, name: chatLabel(s.chat_id), history,
          memories: '', participants: [s.character_id], activePersonaId: null, mood: null,
        };
      }
      touched.add(char.id);
    }

    const toSave = [...touched].map((id) => byId.get(id)).filter(Boolean);
    await putAll(db, 'characters', toSave);
    db.close();
    return { characters: addedChars, chats: touched.size };
  } catch (e) {
    return { characters: 0, chats: 0 };
  }
}

// Derive lightweight stats from a character (mirrors the legacy id-timestamp scheme).
export function characterStats(char) {
  const chats = char && char.chats ? Object.values(char.chats) : [];
  let messages = 0;
  let lastTs = 0;
  for (const c of chats) {
    const h = (c && c.history) || [];
    messages += h.length;
    const t = parseInt(String(c.id || '').replace(/^chat-/, ''), 10);
    if (!Number.isNaN(t) && t > lastTs) lastTs = t;
  }
  const created = parseInt(String((char && char.id) || '').replace(/^char-/, ''), 10);
  return {
    chats: chats.length,
    messages,
    lastTs,
    createdTs: Number.isNaN(created) ? 0 : created,
  };
}
