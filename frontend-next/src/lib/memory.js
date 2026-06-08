// Durable "known facts" memory — a small, deduplicated store of STABLE facts about
// the user and the relationship (names, job, where they live, preferences, key life
// events, promises). Distinct from the rolling narrative summary (which captures the
// evolving story) and from RAG (which retrieves raw old turns): these are always
// injected verbatim so the character never forgets the basics. Kept per-chat on
// chat.facts (array of short strings). Pure module: callers wire the LLM.

export function clampFacts(arr) {
  if (!Array.isArray(arr)) return [];
  const seen = new Set();
  const out = [];
  for (const f of arr) {
    const s = String(f || '').replace(/\s+/g, ' ').trim().slice(0, 160);
    const key = s.toLowerCase();
    if (s && !seen.has(key)) { seen.add(key); out.push(s); }
  }
  return out.slice(0, 30);
}

// The "KNOWN FACTS" prompt section, always injected so basics never drift.
export function factsSection(facts, charName, userName) {
  const list = clampFacts(facts);
  if (!list.length) return '';
  return '--- KNOWN FACTS (durable — always remember these about ' + (userName || 'the user') + ' and your relationship) ---\n'
    + list.map((f) => '- ' + f).join('\n');
}

// One-shot "merge new durable facts from this exchange into the existing list" call.
// We pass the current facts so the model UPDATES/keeps them rather than starting over.
export function buildFactsUpdateMessages(charName, userName, prevFacts, transcript) {
  const sys = 'You maintain a concise list of DURABLE facts that the character "' + charName + '" should permanently remember '
    + 'about the user "' + userName + '" and their relationship: names, age, job/studies, where they live, family/pets, '
    + 'firm preferences and dislikes, important promises, and major life events. '
    + 'ONLY include stable, lasting facts — NOT fleeting mood, small talk, or what is happening this scene. '
    + 'Given the current list and the latest exchange, return the COMPLETE updated list as a STRICT JSON array of short strings '
    + '(merge new facts in, keep still-true old ones, drop nothing that is still true, correct anything contradicted). '
    + 'Keep each fact under ~15 words. Return at most 30. Output JSON array only, no prose.';
  const user = 'CURRENT FACTS:\n' + JSON.stringify(clampFacts(prevFacts))
    + '\n\nLATEST EXCHANGE:\n' + transcript + '\n\nReturn the updated JSON array.';
  return [{ role: 'system', content: sys }, { role: 'user', content: user }];
}

// Parse the model's JSON array, falling back to the previous list on failure.
export function parseFacts(raw, prev) {
  let s = String(raw || '').replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
  let arr = null;
  try { arr = JSON.parse(s); } catch (e) {
    const i = s.indexOf('['); const j = s.lastIndexOf(']');
    if (i !== -1 && j > i) { try { arr = JSON.parse(s.slice(i, j + 1)); } catch (e2) { /* give up */ } }
  }
  if (!Array.isArray(arr)) return clampFacts(prev);
  return clampFacts(arr);
}
