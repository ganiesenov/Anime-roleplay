// Background-music helpers. Direct audio URLs play as-is; YouTube links are
// routed through the backend yt-dlp proxy (same origin as the app).

export function youtubeId(url) {
  const patterns = [
    /youtu\.be\/([A-Za-z0-9_-]{11})/,
    /[?&]v=([A-Za-z0-9_-]{11})/,
    /embed\/([A-Za-z0-9_-]{11})/,
    /\/v\/([A-Za-z0-9_-]{11})/,
  ];
  for (const p of patterns) { const m = String(url || '').match(p); if (m) return m[1]; }
  return null;
}

export function audioSrcFor(url) {
  return youtubeId(url) ? '/api/yt-audio?url=' + encodeURIComponent(url) : url;
}

// localStorage key the legacy app uses for a per-character music override.
export function musicKey(charId) {
  return 'userMusicUrl:' + charId;
}
