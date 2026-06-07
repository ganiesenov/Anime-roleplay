// Named appearance themes — bundle the whole look (accent, colours, font, width,
// bubbles) so the user can save several "moods" and switch instantly, or share
// them as a JSON file. Stored in localStorage, independent of the active settings.
const KEY = 'aria-next-themes';

// The settings keys a theme captures (must match SettingsModal's APPEARANCE_KEYS).
export const THEME_KEYS = [
  'accent', 'charAccent', 'avatarSize', 'fontSize', 'messageSpacing', 'chatWidth',
  'mainTextColor', 'dialogueColor', 'userBubbleColor', 'userBubbleOpacity',
  'aiBubbleColor', 'aiBubbleOpacity', 'blur',
];

export function loadThemes() {
  try { const v = JSON.parse(localStorage.getItem(KEY)); return Array.isArray(v) ? v : []; }
  catch (e) { return []; }
}

export function saveThemes(list) {
  try { localStorage.setItem(KEY, JSON.stringify(list)); } catch (e) { /* ignore */ }
}

// Pull just the theme-relevant values out of the full settings object.
export function themeValuesFrom(settings) {
  const v = {};
  THEME_KEYS.forEach((k) => { if (settings[k] !== undefined) v[k] = settings[k]; });
  return v;
}

export function exportThemes() {
  const blob = new Blob([JSON.stringify(loadThemes(), null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'aria_themes.json';
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}

// Merge imported themes (by name) into the saved set; returns the new list.
export async function importThemes(file) {
  const text = await file.text();
  const incoming = JSON.parse(text);
  if (!Array.isArray(incoming)) throw new Error('Not a themes file');
  const existing = loadThemes();
  const byName = new Map(existing.map((t) => [t.name, t]));
  incoming.forEach((t) => { if (t && t.name && t.values) byName.set(t.name, { ...t, id: t.id || ('theme-' + t.name) }); });
  const merged = Array.from(byName.values());
  saveThemes(merged);
  return merged;
}
