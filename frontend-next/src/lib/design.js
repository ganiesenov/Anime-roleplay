// Appearance / design settings → CSS custom properties on :root. The chat view
// (and index.css) read these vars, so changing a setting restyles live without a
// re-render. Ported from the legacy app's applySetting() design branch; defaults
// match the current new-app look so nothing shifts until the user adjusts a control.

function clamp01(n) {
  const v = parseFloat(n);
  if (!Number.isFinite(v)) return 1;
  return Math.max(0, Math.min(1, v));
}

// "#rrggbb" + opacity → "rgba(r,g,b,a)". Falls back to the hex if it can't parse.
export function hexToRgba(hex, opacity) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || '').trim());
  if (!m) return hex || 'transparent';
  const n = parseInt(m[1], 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  return `rgba(${r}, ${g}, ${b}, ${clamp01(opacity)})`;
}

export function applyDesignSettings(s) {
  s = s || {};
  const root = document.documentElement.style;
  const num = (v, d) => (Number.isFinite(parseFloat(v)) ? parseFloat(v) : d);
  root.setProperty('--chat-font-size', num(s.fontSize, 15) + 'px');
  root.setProperty('--message-spacing', num(s.messageSpacing, 20) + 'px');
  root.setProperty('--main-text-color', s.mainTextColor || '#e9f5ef');
  root.setProperty('--dialogue-color', s.dialogueColor || '#ffd952');
  root.setProperty('--user-bubble-color', hexToRgba(s.userBubbleColor || '#2ee6a0', s.userBubbleOpacity != null ? s.userBubbleOpacity : 0.15));
  root.setProperty('--ai-bubble-color', hexToRgba(s.aiBubbleColor || '#ffffff', s.aiBubbleOpacity != null ? s.aiBubbleOpacity : 0.04));
  root.setProperty('--message-blur', num(s.blur, 0) + 'px');
}
