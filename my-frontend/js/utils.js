/* utils.js — text formatting, sanitization, image conversion, small helpers. */
(function () {
    'use strict';

    function escapeHtml(s) {
        return String(s == null ? '' : s)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    // Rich-text formatter: *italics*, "quoted dialogue", line breaks.
    function formatSubString(text) {
        if (text == null) return '';
        let html = escapeHtml(text);
        // Quoted dialogue -> .dialogue span (handles straight & curly quotes).
        html = html.replace(/&quot;([^&]*?)&quot;/g, '<span class="dialogue">&quot;$1&quot;</span>');
        html = html.replace(/[“]([^”]*?)[”]/g, '<span class="dialogue">“$1”</span>');
        // *italics* and _italics_
        html = html.replace(/\*([^*\n]+?)\*/g, '<em>$1</em>');
        html = html.replace(/(^|\s)_([^_\n]+?)_(?=\s|$)/g, '$1<em>$2</em>');
        // Line breaks
        html = html.replace(/\r\n|\r|\n/g, '<br>');
        return html;
    }

    // Streaming display helper: provisionally close a single trailing unterminated
    // inline marker (* italics, " dialogue) so partial tokens render styled instead
    // of flashing a raw delimiter. Display-only — never applied to stored text.
    function balanceInlineMarkup(text) {
        if (text == null) return '';
        let s = String(text);
        // Single-* italics: if odd count and the dangling open is on the last line
        // (so formatSubString's same-line regex can match), provisionally close it.
        if (((s.match(/\*/g) || []).length) % 2 === 1) {
            const li = s.lastIndexOf('*');
            if (s.indexOf('\n', li) === -1) s += '*';
        }
        // Straight double-quote dialogue.
        if (((s.match(/"/g) || []).length) % 2 === 1) s += '"';
        // Curly-quote dialogue.
        if ((s.match(/“/g) || []).length > (s.match(/”/g) || []).length) s += '”';
        return s;
    }

    // Strip C0/C1 control chars (keep \t \n \r) and known LLM special tokens.
    function sanitizeModelText(text) {
        if (text == null) return '';
        let s = String(text);
        s = s.replace(/<\|im_start\|>/g, '')
            .replace(/<\|im_end\|>/g, '')
            .replace(/<\|begin_of_text\|>/g, '')
            .replace(/<\|end_of_text\|>/g, '')
            .replace(/<\|eot_id\|>/g, '')
            .replace(/<\|endoftext\|>/g, '')
            .replace(/<\|start_header_id\|>[\s\S]*?<\|end_header_id\|>/g, '');
        // Remove C0 (except \t \n \r) and C1 control chars.
        s = s.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, '');
        return s;
    }

    function stripThinkTags(text) {
        if (text == null) return '';
        return String(text).replace(/<\/?think>/gi, '');
    }

    // Extract <think>...</think> -> { think, main } handling streaming partials.
    function splitThink(content) {
        if (content == null) return { think: '', main: '' };
        let s = String(content);
        const open = s.indexOf('<think>');
        const close = s.indexOf('</think>');
        if (close !== -1 && open === -1) {
            // Headless reasoning: everything before </think> is think.
            return { think: s.slice(0, close).trim(), main: s.slice(close + 8) };
        }
        if (open !== -1 && close !== -1 && close > open) {
            const think = s.slice(open + 7, close);
            const main = (s.slice(0, open) + s.slice(close + 8));
            return { think: think.trim(), main: main };
        }
        if (open !== -1 && close === -1) {
            // Open but unclosed: keep think out of main.
            return { think: s.slice(open + 7).trim(), main: s.slice(0, open), open: true };
        }
        return { think: '', main: s };
    }

    function estimateTokens(text) {
        return Math.round((String(text || '').length) / 4);
    }

    function compactNumber(n) {
        n = Number(n) || 0;
        if (n < 1000) return String(n);
        const k = n / 1000;
        if (n >= 10000) return Math.round(k) + 'k';
        return (Math.round(k * 10) / 10) + 'k';
    }

    function genMessageId(first) {
        if (first) return 'msg-' + Date.now();
        return 'msg-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
    }

    function tsFromId(id, prefix) {
        if (!id) return 0;
        const m = String(id).match(new RegExp('^' + prefix + '-(\\d+)'));
        return m ? parseInt(m[1], 10) : 0;
    }

    function getImageUrl(src) {
        if (!src) return '';
        return src;
    }

    // Convert a File to a WebP data-url (JPEG fallback). Returns {dataUrl, objectUrl}.
    function imageFileToWebp(file, quality) {
        quality = quality == null ? 0.80 : quality;
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
                const img = new Image();
                img.onload = () => {
                    try {
                        const canvas = document.createElement('canvas');
                        canvas.width = img.naturalWidth || img.width;
                        canvas.height = img.naturalHeight || img.height;
                        const ctx = canvas.getContext('2d');
                        ctx.drawImage(img, 0, 0);
                        let dataUrl = canvas.toDataURL('image/webp', quality);
                        if (!dataUrl || dataUrl.indexOf('data:image/webp') !== 0) {
                            dataUrl = canvas.toDataURL('image/jpeg', quality);
                        }
                        canvas.toBlob((blob) => {
                            const objectUrl = blob ? URL.createObjectURL(blob) : dataUrl;
                            resolve({ dataUrl: dataUrl, objectUrl: objectUrl, original: reader.result });
                        }, dataUrl.indexOf('webp') !== -1 ? 'image/webp' : 'image/jpeg', quality);
                    } catch (e) { reject(e); }
                };
                img.onerror = reject;
                img.src = reader.result;
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    function autoResizeTextarea(elOrEvent) {
        const el = elOrEvent && elOrEvent.target ? elOrEvent.target : elOrEvent;
        if (!el || el.tagName !== 'TEXTAREA') return;
        el.style.height = 'auto';
        el.style.height = (el.scrollHeight) + 'px';
    }

    function autoResizeAll(selector, root) {
        (root || document).querySelectorAll(selector).forEach(autoResizeTextarea);
    }

    function handleTextareaEnter(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            return true;
        }
        return false;
    }

    function smartObjectFit(img) {
        if (!img) return;
        try {
            const w = img.naturalWidth, h = img.naturalHeight;
            if (!w || !h) return;
            img.style.objectFit = 'cover';
        } catch (e) { /* ignore */ }
    }

    function smartObjectFitAll(selector, root) {
        (root || document).querySelectorAll(selector).forEach(smartObjectFit);
    }

    // Shrink a name's font-size until it fits its container.
    function adjustFontSizeToFit(el) {
        if (!el) return;
        const parent = el.parentElement;
        if (!parent) return;
        let size = 18;
        el.style.fontSize = size + 'px';
        let guard = 0;
        while ((el.scrollWidth > parent.clientWidth || el.scrollHeight > parent.clientHeight) && size > 9 && guard < 40) {
            size -= 1;
            el.style.fontSize = size + 'px';
            guard++;
        }
    }

    function freezeLayout() { /* layout-freeze hook (no-op safe stub) */ }
    function unfreezeLayout() { /* layout-unfreeze hook */ }

    function parseHex(hex) {
        if (!hex) return null;
        const m = String(hex).trim().match(/^#?([0-9a-fA-F]{6})$/);
        if (!m) return null;
        const n = parseInt(m[1], 16);
        return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
    }

    function decodeHtmlEntities(str) {
        const ta = document.createElement('textarea');
        ta.innerHTML = str;
        return ta.value;
    }

    window.escapeHtml = escapeHtml;
    window.formatSubString = formatSubString;
    window.balanceInlineMarkup = balanceInlineMarkup;
    window.sanitizeModelText = sanitizeModelText;
    window.stripThinkTags = stripThinkTags;
    window.splitThink = splitThink;
    window.estimateTokens = estimateTokens;
    window.compactNumber = compactNumber;
    window.genMessageId = genMessageId;
    window.tsFromId = tsFromId;
    window.getImageUrl = getImageUrl;
    window.imageFileToWebp = imageFileToWebp;
    window.autoResizeTextarea = autoResizeTextarea;
    window.autoResizeAll = autoResizeAll;
    window.handleTextareaEnter = handleTextareaEnter;
    window.smartObjectFit = smartObjectFit;
    window.smartObjectFitAll = smartObjectFitAll;
    window.adjustFontSizeToFit = adjustFontSizeToFit;
    window.freezeLayout = freezeLayout;
    window.unfreezeLayout = unfreezeLayout;
    window.parseHex = parseHex;
    window.decodeHtmlEntities = decodeHtmlEntities;
})();
