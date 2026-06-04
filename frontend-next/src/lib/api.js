// Backend helpers (same endpoints the legacy app uses).

// Persist a card definition to the server (chats sync separately). Fire-and-forget.
export function syncCharacterToServer(char) {
  if (!char || !char.id) return Promise.resolve();
  const copy = { ...char };
  delete copy.chats;
  return fetch('/api/characters', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(copy),
  }).catch(() => { /* offline: ignore */ });
}

export function deleteCharacterFromServer(id) {
  if (!id) return Promise.resolve();
  return fetch('/api/characters/' + encodeURIComponent(id), { method: 'DELETE' }).catch(() => {});
}

// Read a File as a data: URL (base64) for avatar/background storage.
export function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}
