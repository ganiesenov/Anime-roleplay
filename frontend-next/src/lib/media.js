// Small media-URL helpers shared by the chat view and message components.

// Remote images go through the backend proxy (avoids CORS / hotlink issues);
// data: URLs and same-origin paths pass through untouched.
export function avatarUrl(url) {
  if (!url) return '';
  if (/^https?:\/\//i.test(url)) return '/api/img?url=' + encodeURIComponent(url);
  return url;
}

// A dance-clip URL that points at a <video>-playable file (vs a GIF/image).
export function isVideoUrl(url) {
  return /\.(mp4|webm|ogg|ogv|mov|m4v)(\?|#|$)/i.test(String(url || ''));
}
