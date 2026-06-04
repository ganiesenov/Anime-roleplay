// Read-only access to the legacy app's IndexedDB (AriaBD). The new UI is served
// from the same origin (:8000/next), so it shares the exact store the legacy
// my-frontend app seeds from starter_pack_data.js and the user's own edits.
const DB_NAME = 'AriaBD';

function openAriaDB() {
  return new Promise((resolve, reject) => {
    // Open without a version to attach to whatever the legacy app created.
    const req = indexedDB.open(DB_NAME);
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
