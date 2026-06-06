// Shikimori (anime database) character import. The backend proxies the API
// (server-side User-Agent + no CORS); here we just call our endpoints and clean
// the description for use as a character card.

export async function searchShikimori(q) {
  const r = await fetch('/api/shikimori/search?q=' + encodeURIComponent(q));
  if (!r.ok) throw new Error('Shikimori search failed (' + r.status + ')');
  return await r.json();
}

export async function getShikimoriCharacter(id) {
  const r = await fetch('/api/shikimori/character?id=' + encodeURIComponent(id));
  if (!r.ok) throw new Error('Shikimori fetch failed (' + r.status + ')');
  return await r.json();
}

// Shikimori descriptions are HTML with [bbcode]-style links — strip to plain text.
export function cleanShikiDescription(html) {
  let s = String(html || '');
  s = s.replace(/<br\s*\/?>/gi, '\n').replace(/<\/(p|div)>/gi, '\n').replace(/<[^>]+>/g, '');
  s = s.replace(/\[[^\]]*\]/g, '');
  s = s.replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"')
       .replace(/&#0?39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>');
  return s.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}
