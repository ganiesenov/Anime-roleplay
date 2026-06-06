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

// ── Relationship "stages" ──────────────────────────────────────────────────
// Affection crosses thresholds that unlock concrete, observable behaviour. This
// is what makes the inner-life model actually *do* something rather than just
// track a number: each stage feeds a behaviour directive into the prompt and is
// surfaced in the inner-life panel so the user can see what they've unlocked.
export const REL_STAGES = [
  { min: 0,  key: 'cold',       label: 'Cold',        emoji: '🧊',
    behave: 'You feel cold and guarded toward {user}. Keep your distance, give short clipped replies, do not open up, and do not initiate affection.' },
  { min: 25, key: 'wary',       label: 'Wary',        emoji: '🌫️',
    behave: 'You are still wary of {user}. Be polite but reserved; reveal little about yourself and test them before trusting.' },
  { min: 45, key: 'warming',    label: 'Warming up',  emoji: '🌤️',
    behave: 'You are warming up to {user}. Show small signs of interest, ask about them, and occasionally let your guard down.' },
  { min: 65, key: 'close',      label: 'Close',       emoji: '💛',
    behave: 'You genuinely care about {user}. Be warm and open, initiate topics, tease playfully, and show you remember and value them.' },
  { min: 80, key: 'devoted',    label: 'Devoted',     emoji: '💗',
    behave: 'You are devoted to {user}. Be openly affectionate, take initiative, make plans together, express how much they mean to you, and act protective/possessive in-character. Sometimes start the scene with your own idea or a small gesture rather than waiting.' },
  { min: 92, key: 'inseparable',label: 'Inseparable', emoji: '🔥',
    behave: 'You are deeply, unmistakably in love with / bonded to {user}. Let it saturate everything — initiative, vulnerability, intimacy appropriate to the scene, and a strong pull toward them.' },
];

export function stageFor(affection) {
  const v = Math.max(0, Math.min(100, Number(affection) || 0));
  let s = REL_STAGES[0];
  for (const st of REL_STAGES) if (v >= st.min) s = st;
  return s;
}

// Extra behaviour layers driven by trust / tension so those meters matter too.
function tensionDirective(t) {
  if (t >= 75) return 'There is strong unresolved tension between you and {user} — let friction, defensiveness or an edge show; do not pretend everything is fine.';
  if (t >= 50) return 'There is some friction with {user} — a little guardedness or sharpness is natural right now.';
  return '';
}
function trustDirective(tr) {
  if (tr >= 75) return 'You trust {user} deeply — you can be vulnerable, share secrets, and rely on them.';
  if (tr < 30) return 'You do not really trust {user} yet — hold back secrets and stay a little skeptical of their intentions.';
  return '';
}

// The high-priority behaviour directive derived from the *current* numbers. This
// is the part that changes how the character acts as the relationship evolves.
export function relationshipDirective(rel, charName, userName) {
  if (!rel) return '';
  const sub = (s) => String(s || '').replace(/\{user\}/g, userName).replace(/\{char\}/g, charName);
  const parts = [sub(stageFor(rel.affection).behave)];
  const tn = tensionDirective(rel.tension); if (tn) parts.push(sub(tn));
  const tr = trustDirective(rel.trust); if (tr) parts.push(sub(tr));
  return '--- HOW YOU FEEL & ACT TOWARD ' + (userName || 'them').toUpperCase()
    + ' RIGHT NOW (let this drive your behaviour this turn — never state the numbers) ---\n'
    + parts.join('\n');
}

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
    + lines.join('\n')
    + '\n\n' + relationshipDirective(rel, charName, userName);
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
