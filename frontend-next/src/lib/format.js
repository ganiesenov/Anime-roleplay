// Text formatting ported from the legacy utils.js so rendering matches exactly.

export function escapeHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// *italics*, "quoted dialogue", _italics_, line breaks → HTML.
export function formatSubString(text) {
  if (text == null) return '';
  let html = escapeHtml(text);
  html = html.replace(/&quot;([^&]*?)&quot;/g, '<span class="dlg">&quot;$1&quot;</span>');
  html = html.replace(/[“]([^”]*?)[”]/g, '<span class="dlg">“$1”</span>');
  html = html.replace(/\*([^*\n]+?)\*/g, '<em>$1</em>');
  html = html.replace(/(^|\s)_([^_\n]+?)_(?=\s|$)/g, '$1<em>$2</em>');
  html = html.replace(/\r\n|\r|\n/g, '<br>');
  return html;
}

// Strip LLM special tokens + control chars.
export function sanitizeModelText(text) {
  if (text == null) return '';
  let s = String(text);
  s = s
    .replace(/<\|im_start\|>/g, '')
    .replace(/<\|im_end\|>/g, '')
    .replace(/<\|begin_of_text\|>/g, '')
    .replace(/<\|end_of_text\|>/g, '')
    .replace(/<\|eot_id\|>/g, '')
    .replace(/<\|endoftext\|>/g, '')
    .replace(/<\|start_header_id\|>[\s\S]*?<\|end_header_id\|>/g, '');
  s = s.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, '');
  return s;
}

// Provisionally close a dangling * or " during streaming (display only).
export function balanceInlineMarkup(text) {
  if (text == null) return '';
  let s = String(text);
  if (((s.match(/\*/g) || []).length) % 2 === 1) {
    const li = s.lastIndexOf('*');
    if (s.indexOf('\n', li) === -1) s += '*';
  }
  if (((s.match(/"/g) || []).length) % 2 === 1) s += '"';
  if ((s.match(/“/g) || []).length > (s.match(/”/g) || []).length) s += '”';
  return s;
}

// Extract <think>…</think>, handling streaming partials.
export function splitThink(content) {
  if (content == null) return { think: '', main: '' };
  const s = String(content);
  const open = s.indexOf('<think>');
  const close = s.indexOf('</think>');
  if (close !== -1 && open === -1) return { think: s.slice(0, close).trim(), main: s.slice(close + 8) };
  if (open !== -1 && close !== -1 && close > open) {
    return { think: s.slice(open + 7, close).trim(), main: s.slice(0, open) + s.slice(close + 8) };
  }
  if (open !== -1 && close === -1) return { think: s.slice(open + 7).trim(), main: s.slice(0, open), open: true };
  return { think: '', main: s };
}

export function renderStreaming(text) {
  return formatSubString(balanceInlineMarkup(sanitizeModelText(text || '')));
}
export function renderFinal(text) {
  return formatSubString(sanitizeModelText(text || ''));
}
