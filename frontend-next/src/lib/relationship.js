// "Living relationship" state — a small emotional/relational model the character
// reads (to stay consistent) and updates after each exchange. Kept per-chat in
// AriaBD (chat.relationship). Pure module: no imports, so callers wire the LLM.

export function defaultRelationship() {
  return { affection: 50, trust: 50, tension: 10, mood: '', beats: [] };
}

export function clampRel(r) {
  const num = (v, d) => {
    const x = Math.round(Number(v));
    return Number.isFinite(x) ? Math.max(0, Math.min(100, x)) : d;
  };
  r = r || {};
  return {
    affection: num(r.affection, 50),
    trust: num(r.trust, 50),
    tension: num(r.tension, 10),
    mood: String(r.mood || '').slice(0, 80),
    beats: Array.isArray(r.beats) ? r.beats.map((b) => String(b).slice(0, 120)).filter(Boolean).slice(0, 5) : [],
  };
}

function band(v, low, mid, high) { return v < 34 ? low : (v < 67 ? mid : high); }

// The prompt layer injected so the model behaves consistently with the state.
export function relationshipSection(rel, charName, userName) {
  if (!rel) return '';
  const lines = [
    'Affection toward ' + userName + ': ' + rel.affection + '/100 (' + band(rel.affection, 'cold / distant', 'neutral', 'warm / affectionate') + ')',
    'Trust: ' + rel.trust + '/100 (' + band(rel.trust, 'wary', 'cautious', 'open') + ')',
    'Tension: ' + rel.tension + '/100 (' + band(rel.tension, 'at ease', 'some friction', 'strained') + ')',
  ];
  if (rel.mood) lines.push('Current inner state toward ' + userName + ': ' + rel.mood);
  if (rel.beats && rel.beats.length) lines.push('Ongoing between you:\n' + rel.beats.map((b) => '- ' + b).join('\n'));
  return '--- RELATIONSHIP STATE (stay consistent — SHOW this through ' + charName + "'s tone and choices, never state the numbers) ---\n"
    + lines.join('\n');
}

// Messages for the one-shot "update the relationship after this exchange" call.
export function buildRelationshipUpdateMessages(charName, userName, prevRel, transcript) {
  const sys = 'You maintain a private relationship model between the character "' + charName + '" and the user "' + userName + '". '
    + 'Given the current state and the latest exchange, output the UPDATED state as STRICT JSON with keys: '
    + 'affection (0-100), trust (0-100), tension (0-100), '
    + "mood (a short phrase for the character's current inner feeling toward the user), "
    + 'beats (array of up to 5 short ongoing relational facts: promises, inside jokes, unresolved tension). '
    + 'Move the numbers GRADUALLY — at most about 10 points per update, and only when the exchange clearly justifies it. '
    + 'Output JSON only, no prose.';
  const user = 'CURRENT STATE:\n' + JSON.stringify(prevRel) + '\n\nLATEST EXCHANGE:\n' + transcript + '\n\nReturn the updated JSON.';
  return [{ role: 'system', content: sys }, { role: 'user', content: user }];
}

// Parse the model's JSON, merging onto the previous state so missing keys persist.
export function parseRelationship(raw, prev) {
  let s = String(raw || '').replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
  let obj = null;
  try { obj = JSON.parse(s); } catch (e) {
    const i = s.indexOf('{'); const j = s.lastIndexOf('}');
    if (i !== -1 && j > i) { try { obj = JSON.parse(s.slice(i, j + 1)); } catch (e2) { /* give up */ } }
  }
  if (!obj || typeof obj !== 'object') return null;
  return clampRel({ ...(prev || defaultRelationship()), ...obj });
}
