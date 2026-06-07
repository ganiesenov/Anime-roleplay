// Lightweight personality model borrowed from companion apps (DarLink/PovChat/
// CrushOn): a relationship ARCHETYPE + a few TRAIT sliders that compile into the
// system prompt and seed the living-relationship state. Pure data + helpers.

// Trait sliders (0–100). Only the extremes (≤34 / ≥66) inject into the prompt, so
// a centered slider means "no strong lean".
export const TRAIT_DEFS = [
  { key: 'warmth',    label: 'Warmth',     low: 'cold, distant, hard to reach',    high: 'warm, affectionate, caring' },
  { key: 'energy',    label: 'Energy',     low: 'calm, quiet, composed',           high: 'energetic, lively, excitable' },
  { key: 'humor',     label: 'Humor',      low: 'serious, earnest, literal',       high: 'playful, teasing, witty' },
  { key: 'dominance', label: 'Dominance',  low: 'submissive, deferential, yielding', high: 'dominant, assertive, takes charge' },
  { key: 'openness',  label: 'Openness',   low: 'reserved, guarded, private',      high: 'open, candid, shares freely' },
];

// Relationship archetypes — set the starting dynamic and seed affection/trust/tension.
export const ARCHETYPES = [
  { key: '',           label: '— None —' },
  { key: 'stranger',   label: 'Stranger',          tone: 'You barely know {user} yet — be a little guarded but curious.',                 rel: { affection: 35, trust: 35, tension: 20 } },
  { key: 'friend',     label: 'Friend',            tone: 'You and {user} are friends — easy, familiar, supportive.',                       rel: { affection: 60, trust: 65, tension: 10 } },
  { key: 'bestfriend', label: 'Best friend',       tone: "You are {user}'s closest friend — deep trust, inside jokes, total ease.",       rel: { affection: 80, trust: 85, tension: 8 } },
  { key: 'crush',      label: 'Crush',             tone: 'You have a crush on {user} — a little shy and flustered, eager but unsure.',     rel: { affection: 65, trust: 55, tension: 30 } },
  { key: 'romantic',   label: 'Romantic partner',  tone: 'You are romantically together with {user} — affectionate, flirtatious, intimate.', rel: { affection: 82, trust: 78, tension: 14 } },
  { key: 'mentor',     label: 'Mentor',            tone: "You are {user}'s mentor — wise and guiding, encouraging but honest.",            rel: { affection: 60, trust: 72, tension: 10 } },
  { key: 'rival',      label: 'Rival',             tone: 'You are {user}\'s rival — competitive and sharp-edged, but engaged and respectful underneath.', rel: { affection: 40, trust: 40, tension: 55 } },
  { key: 'family',     label: 'Family',            tone: 'You are family to {user} — caring, protective, unconditionally loyal.',          rel: { affection: 75, trust: 82, tension: 12 } },
];

// Seed relationship numbers for a chosen archetype (or null).
export function archetypeRelationship(key) {
  const a = ARCHETYPES.find((x) => x.key === key);
  return a && a.rel ? { ...a.rel } : null;
}

// The prompt section compiled from archetype + trait sliders.
export function personalitySection(char, userName) {
  if (!char) return '';
  const u = userName || 'the user';
  const t = char.traits || {};
  const traitLines = [];
  TRAIT_DEFS.forEach((d) => {
    const v = t[d.key];
    if (typeof v === 'number') {
      if (v <= 34) traitLines.push('- ' + d.low);
      else if (v >= 66) traitLines.push('- ' + d.high);
    }
  });
  const arch = ARCHETYPES.find((a) => a.key === char.archetype);
  const parts = [];
  if (arch && arch.key) parts.push('Your relationship to ' + u + ': ' + arch.label + '. ' + arch.tone.replace(/\{user\}/g, u));
  if (traitLines.length) parts.push('Personality leanings:\n' + traitLines.join('\n'));
  return parts.length ? '--- PERSONALITY & DYNAMIC ---\n' + parts.join('\n') : '';
}
