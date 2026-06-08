// Face-swap helpers — register the user's face once (backend caches it by id), then
// reference it from photo/video GET URLs. The actual swap runs in local ComfyUI (ReActor).

function simpleHash(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) { h = (h * 31 + s.charCodeAt(i)) | 0; }
  return (h >>> 0).toString(36);
}

// Register a face image (data: URL or http URL) and return its short id. Cached in
// localStorage keyed by the image's hash, so we only upload it once.
export async function registerFace(faceRef) {
  if (!faceRef) return '';
  const key = 'aria-face:' + simpleHash(faceRef);
  const cached = localStorage.getItem(key);
  if (cached) return cached;
  try {
    const r = await fetch('/api/face', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: faceRef }),
    });
    if (!r.ok) return '';
    const j = await r.json();
    if (j && j.id) { localStorage.setItem(key, j.id); return j.id; }
  } catch (e) { /* offline / backend down → no swap */ }
  return '';
}

// Wrap a generated photo URL so the user's face is swapped onto it via ReActor.
export function faceSwapPhotoUrl(photoUrl, faceId, settings) {
  const base = ((settings && settings.comfyUrl) || 'http://127.0.0.1:8188').trim();
  return '/api/faceswap?image=' + encodeURIComponent(photoUrl)
    + '&face=' + encodeURIComponent(faceId)
    + '&url=' + encodeURIComponent(base);
}
