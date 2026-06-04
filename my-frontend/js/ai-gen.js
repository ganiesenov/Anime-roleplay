/* ai-gen.js — one-shot LLM helper, model-picker dialog, reply suggestions,
 * scenario generator, auto-summarize, character/world generator. */
(function () {
    'use strict';
    function $(id) { return document.getElementById(id); }

    function backendOrigin() {
        if (location.protocol === 'http:' || location.protocol === 'https:') return location.origin;
        try { return new URL(window.DEFAULT_API_URL).origin; } catch (e) { return 'http://127.0.0.1:8000'; }
    }
    function isLocalUrl(url) {
        try {
            const h = new URL(url).hostname;
            return h === 'localhost' || h === '127.0.0.1' || h === '::1' ||
                /^10\./.test(h) || /^192\.168\./.test(h) || /^172\.(1[6-9]|2\d|3[01])\./.test(h);
        } catch (e) { return false; }
    }

    function findModel(modelId) {
        const base = String(modelId || '').replace(/:online$/, '');
        return (window.appSettings.availableModels || []).find((m) => m.id === base || m.id === modelId);
    }

    // ── One-shot completion ─────────────────────────────────────────────────
    async function callAISimple(modelId, systemContent, userContent, signal) {
        const model = findModel(modelId) || { id: modelId };
        const url = (model && model.targetApiUrl) || window.DEFAULT_API_URL;
        const headers = { 'Content-Type': 'application/json' };
        if (!isLocalUrl(url)) {
            const key = (model && model.apiKey) || window.appSettings.apiKey || '';
            if (key) headers['Authorization'] = 'Bearer ' + key;
            headers['HTTP-Referer'] = location.origin || 'https://aria.local';
            headers['X-Title'] = 'Aria';
        }
        const body = {
            model: modelId || model.id,
            messages: [{ role: 'system', content: systemContent }, { role: 'user', content: userContent }],
            temperature: 0.7, top_p: 0.95, stream: true
        };
        const resp = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body), signal });
        if (!resp.ok) { const t = await resp.text().catch(() => ''); throw new Error(t || ('HTTP ' + resp.status)); }
        const reader = resp.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '', out = '';
        while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop();
            for (const line of lines) {
                const t = line.trim();
                if (!t.startsWith('data:')) continue;
                const payload = t.slice(5).trim();
                if (payload === '[DONE]') return out.trim();
                try {
                    const json = JSON.parse(payload);
                    const c = json.choices && json.choices[0] && json.choices[0].delta && json.choices[0].delta.content;
                    if (c) out += c;
                } catch (e) { /* skip */ }
            }
        }
        return out.trim();
    }

    function formatGenError(err) {
        const m = String(err && err.message || err).toLowerCase();
        if (/failed to fetch|network/.test(m)) return 'Network error — is the backend reachable?';
        if (/401|403/.test(m)) return 'API key invalid.';
        if (/404|not found/.test(m)) return 'Model not found.';
        if (/429|rate|quota/.test(m)) return 'Rate-limited or quota exceeded.';
        if (/50\d/.test(m)) return 'Server error.';
        return 'Generation failed.';
    }

    // ── Model picker dialog ─────────────────────────────────────────────────
    function showModelPickerDialog(opts) {
        opts = opts || {};
        return new Promise((resolve) => {
            const overlay = document.createElement('div');
            overlay.className = 'custom-alert-overlay';
            const modal = document.createElement('div');
            modal.className = 'custom-alert-modal';
            let html = '<h2>' + window.escapeHtml(opts.title || 'Choose a Model') + '</h2>';
            if (opts.info) html += '<p>' + window.escapeHtml(opts.info) + '</p>';
            if (opts.warning) html += '<div class="amber-warning">' + window.escapeHtml(opts.warning) + '</div>';
            html += '<select class="picker-model-select settings-input"></select>';
            if (opts.showHints) html += '<textarea class="picker-hints settings-input" rows="3" placeholder="Optional hints..."></textarea>';
            if (opts.showReferenceUrl) html += '<input class="picker-ref-url settings-input" type="url" placeholder="Optional reference URL (Fandom or any page)">';
            if (opts.showConcept) html += '<textarea class="picker-concept settings-input" rows="3" placeholder="Optional concept..."></textarea>';
            html += '<div class="custom-dialog-buttons"><button class="secondary-btn picker-cancel">Cancel</button>' +
                '<button class="action-btn picker-confirm">Confirm</button></div>';
            modal.innerHTML = html;
            overlay.appendChild(modal);
            document.body.appendChild(overlay);

            const select = modal.querySelector('.picker-model-select');
            const models = window.appSettings.availableModels || [];
            if (!models.length) {
                const o = document.createElement('option'); o.textContent = 'No models configured'; o.disabled = true; select.appendChild(o);
                modal.querySelector('.picker-confirm').disabled = true;
            } else {
                models.forEach((m) => { const o = document.createElement('option'); o.value = m.id; o.textContent = m.name || m.id; select.appendChild(o); });
                const def = opts.defaultModel || (document.getElementById('model-select') && document.getElementById('model-select').value);
                if (def && models.some((m) => m.id === def)) select.value = def;
            }
            const done = (val) => { overlay.remove(); resolve(val); };
            modal.querySelector('.picker-cancel').addEventListener('click', () => done(null));
            modal.querySelector('.picker-confirm').addEventListener('click', () => {
                const result = { modelId: select.value };
                if (opts.showHints) result.hints = modal.querySelector('.picker-hints').value.trim();
                if (opts.showReferenceUrl) result.referenceUrl = modal.querySelector('.picker-ref-url').value.trim();
                if (opts.showConcept) result.desc = modal.querySelector('.picker-concept').value.trim();
                done(result);
            });
            overlay.addEventListener('click', (e) => { if (e.target === overlay) done(null); });
        });
    }

    // ── Reply suggestions ───────────────────────────────────────────────────
    async function generateReplyOptionsInBackground() {
        if (!window.runtimeFlags.replyOptionsEnabled) return;
        const char = window.characters[window.currentCharacterId];
        const chat = char && char.chats[window.currentChatId];
        if (!char || !chat) return;
        const lastAi = [...chat.history].reverse().find((m) => m.sender !== 'user');
        if (!lastAi) return;
        const aiText = window.getMessageText(lastAi);
        if (!aiText || aiText.length < 5) return;

        const reqId = ++window.replyOptionsReqId;
        showReplyOptionsLoading();

        let personaCtx = '';
        if (chat.activePersonaId && window.personas[chat.activePersonaId]) {
            const p = window.personas[chat.activePersonaId];
            personaCtx = '\nThe user is roleplaying as "' + p.name + '": ' + (p.description || '').slice(0, 200);
        }
        const sys = 'You generate exactly 2 short reply options spoken by the human user (first person, single sentence each, ' +
            'specific to the scene, two distinct directions, no narration).' + personaCtx +
            '\nOutput strictly a JSON array of 2 strings, e.g. ["...","..."].';
        const user = 'Character: ' + (char.chatName || char.name) + '\nLast message: ' + aiText.slice(0, 600) +
            '\nGenerate the 2 user replies now as a JSON array.';

        const modelId = window.runtimeFlags.suggestionModelId ||
            (document.getElementById('model-select') && document.getElementById('model-select').value);
        try {
            const raw = await callAISimple(modelId, sys, user);
            if (reqId !== window.replyOptionsReqId) return;
            const options = parseReplyOptions(raw);
            if (options && options.length) showReplyOptions(options);
            else showReplyOptionsError('Could not parse suggestions');
        } catch (err) {
            if (reqId !== window.replyOptionsReqId) return;
            showReplyOptionsError(formatGenError(err));
        }
    }

    function parseReplyOptions(raw) {
        let s = window.stripThinkTags(raw || '').trim();
        try { const arr = JSON.parse(s); if (Array.isArray(arr)) return arr.slice(0, 2).map(String); } catch (e) { /* fallback */ }
        // Bracket scan.
        const starts = [];
        for (let i = 0; i < s.length; i++) if (s[i] === '[') starts.push(i);
        for (const start of starts) {
            for (let end = s.length; end > start; end--) {
                if (s[end - 1] !== ']') continue;
                try {
                    const arr = JSON.parse(s.slice(start, end));
                    if (Array.isArray(arr) && arr.length) return arr.slice(0, 2).map(String);
                } catch (e) { /* keep scanning */ }
            }
        }
        return null;
    }

    function showReplyOptionsLoading() {
        const dd = $('reply-options-dropdown');
        const b1 = $('reply-opt-1'), b2 = $('reply-opt-2');
        if (!dd) return;
        [b1, b2].forEach((b) => { if (b) { b.className = 'reply-option-btn reply-option-loading'; b.textContent = '…'; } });
        dd.classList.remove('hidden');
    }
    function showReplyOptions(options) {
        const dd = $('reply-options-dropdown');
        const b1 = $('reply-opt-1'), b2 = $('reply-opt-2');
        if (!dd) return;
        [b1, b2].forEach((b, i) => {
            if (!b) return;
            b.className = 'reply-option-btn';
            b.textContent = options[i] || '';
            b.classList.toggle('hidden', !options[i]);
        });
        dd.classList.remove('hidden');
    }
    function showReplyOptionsError(msg) {
        const dd = $('reply-options-dropdown');
        const b1 = $('reply-opt-1'), b2 = $('reply-opt-2');
        if (!dd) return;
        if (b1) { b1.className = 'reply-option-btn reply-option-error'; b1.textContent = '⚠ ' + String(msg).slice(0, 90); }
        if (b2) { b2.className = 'reply-option-btn hidden'; b2.textContent = ''; }
        dd.classList.remove('hidden');
    }
    function showReplyOptionsDropdown() {
        const dd = $('reply-options-dropdown');
        if (dd && dd.querySelector('.reply-option-btn') && dd.querySelector('.reply-option-btn').textContent)
            dd.classList.remove('hidden');
    }
    function hideReplyOptionsDropdown() {
        const dd = $('reply-options-dropdown');
        if (dd) dd.classList.add('hidden');
    }
    function pickReplyOption(text) {
        const input = $('message-input');
        if (input) { input.value = text; window.autoResizeTextarea(input); }
        hideReplyOptionsDropdown();
        if (input) input.focus();
    }

    // ── Scenario generator ──────────────────────────────────────────────────
    async function handleAIGenerateScenario() {
        const name = (document.getElementById('chat-name') && document.getElementById('chat-name').value.trim()) ||
            (document.getElementById('card-name') && document.getElementById('card-name').value.trim()) || 'the character';
        const desc = document.getElementById('char-description') ? document.getElementById('char-description').value : '';
        const lore = document.getElementById('char-lore') ? document.getElementById('char-lore').value : '';
        if (!desc.trim() && !lore.trim()) { await window.showCustomAlert('Add a description or lore first.'); return; }
        const choice = await showModelPickerDialog({ title: 'Generate Scenario', info: 'Pick a model and add optional hints.', showHints: true });
        if (!choice || !choice.modelId) return;
        const btn = document.getElementById('ai-scenario-btn');
        if (btn) { btn.disabled = true; btn.innerHTML = '<span class="btn-spinner"></span> Generating…'; }
        const sys = 'You write a 10-15 sentence opening scenario paragraph addressing the user as "you" (second person), ' +
            'describing the relationship/dynamic, the current scene, the character\'s wants, weaving in three quoted lines of dialogue, ' +
            'concise direct prose, world-specific, ending on an open invitation. Output the paragraph only.';
        const user = 'Character name: ' + name + '\nDescription: ' + desc.slice(0, 900) + '\nLore: ' + lore.slice(0, 700) +
            (choice.hints ? '\nHints: ' + choice.hints : '');
        try {
            const text = await callAISimple(choice.modelId, sys, user);
            const words = text.split(/\s+/).slice(0, 5).join(' ');
            const entry = window.createScenarioInput(text, words + '…');
            if (entry) entry.scrollIntoView({ behavior: 'smooth', block: 'center' });
            if (window.updateEditorTokenCount) window.updateEditorTokenCount();
        } catch (err) {
            await window.showCustomAlert(formatGenError(err));
        } finally {
            if (btn) { btn.disabled = false; btn.textContent = '✨ AI Generate Scenario'; }
        }
    }

    // ── Auto-summarize memories ─────────────────────────────────────────────
    async function handleSummarizeMemories() {
        const char = window.characters[window.currentCharacterId];
        const chat = char && char.chats[window.currentChatId];
        if (!char || !chat || !chat.history.length) { await window.showCustomAlert('No chat history to summarize.'); return; }
        const choice = await showModelPickerDialog({ title: 'Auto-summarize Chat', info: 'Summarize the recent chat into memory bullet points.' });
        if (!choice || !choice.modelId) return;
        const recent = chat.history.slice(-40).map((m) => {
            const speaker = m.sender === 'user' ? 'User' : window.displayChatName(window.characters[m.speakerId] || char);
            return speaker + ': ' + window.getMessageText(m);
        }).join('\n');
        const sys = 'Summarize the conversation into 5-10 concise bullet points capturing key events and facts. ' +
            'No markdown headers, no intro/outro — bullets only.';
        try {
            const result = await callAISimple(choice.modelId, sys, recent);
            const ta = document.getElementById('chat-memories-textarea');
            if (ta) {
                const header = '--- Summary (' + new Date().toLocaleDateString() + ') ---\n';
                ta.value = (ta.value.trim() ? ta.value.trim() + '\n\n' : '') + header + result;
                window.autoResizeTextarea(ta);
            }
        } catch (err) {
            await window.showCustomAlert(formatGenError(err));
        }
    }

    // ── Character / world generator ─────────────────────────────────────────
    async function handleAIGenerateCharacter() {
        const isWorld = document.getElementById('type-world') && document.getElementById('type-world').checked;
        const editing = document.getElementById('editing-char-id') && document.getElementById('editing-char-id').value;
        const choice = await showModelPickerDialog({
            title: isWorld ? 'AI Generate World' : 'AI Generate Character',
            info: 'Generate fields from a concept or reference.',
            warning: editing ? 'All text fields will be OVERWRITTEN (images are kept).' : '',
            showConcept: true, showReferenceUrl: true
        });
        if (!choice || !choice.modelId) return;

        const controller = new AbortController();
        let reference = '';
        let refFailed = false;
        if (choice.referenceUrl) {
            try { reference = await fetchReference(choice.referenceUrl, controller.signal); }
            catch (e) { refFailed = true; }
            if (!reference) refFailed = true;
        }

        const sys = isWorld ? worldSystemPrompt() : characterSystemPrompt();
        let user;
        if (reference) user = 'Base it on this reference material:\n' + reference;
        else if (choice.desc) user = 'Concept: ' + choice.desc;
        else user = 'Invent something interesting at random.';

        const btn = document.getElementById('ai-generate-char-btn');
        if (btn) { btn.disabled = true; btn.dataset.prev = btn.textContent; btn.innerHTML = '<span class="btn-spinner"></span> Generating…'; }
        try {
            const raw = await callAISimple(choice.modelId, sys, user, controller.signal);
            const obj = robustJsonParse(raw);
            insertGeneratedFields(obj, isWorld);
            if (refFailed) await window.showCustomAlert('The reference URL could not be read; generated without it.');
        } catch (err) {
            if (err && err.name === 'AbortError') return;
            await window.showCustomAlert(formatGenError(err));
        } finally {
            if (btn) { btn.disabled = false; btn.textContent = btn.dataset.prev || (isWorld ? '✨ AI Generate World' : '✨ AI Generate Character'); }
        }
    }

    function characterSystemPrompt() {
        return 'Output a single raw JSON object (no markdown fences) with keys: ' +
            'cardName, chatName (short first name), description (one plain string structured as 8 numbered headings: ' +
            'Identity/Role, Personality, Speech Style, Abilities, Appearance, Likes/Dislikes, Past, Dialog Examples; 300-600 words), ' +
            'tags (10-20 comma-separated), instructions (AI behavior bullets).';
    }
    function worldSystemPrompt() {
        return 'Output a single raw JSON object (no markdown fences) with keys: ' +
            'worldName, chatName (narrator label), description (setting overview), lore, worldRules (critical rules, bullet lines), ' +
            'tags (10-20 comma-separated). 500-1000 words, in-universe only, no future events.';
    }

    async function fetchReference(url, signal) {
        const fandom = url.match(/^https?:\/\/([^./]+)\.fandom\.com\/wiki\/(.+)$/);
        if (fandom) {
            const api = 'https://' + fandom[1] + '.fandom.com/api.php?action=parse&page=' +
                encodeURIComponent(decodeURIComponent(fandom[2])) + '&prop=wikitext&format=json&origin=*';
            const r = await fetch(api, { signal });
            const data = await r.json();
            const text = data && data.parse && data.parse.wikitext && data.parse.wikitext['*'];
            if (text && text.length >= 200) return text.slice(0, 8000);
            return '';
        }
        const r = await fetch('https://r.jina.ai/' + url, { headers: { Accept: 'text/plain' }, signal });
        const text = await r.text();
        if (text && text.length >= 200) return text.slice(0, 8000);
        return '';
    }

    function robustJsonParse(raw) {
        let s = String(raw || '');
        // Escape bare newlines/tabs inside string literals.
        let inStr = false, esc = false, out = '';
        for (let i = 0; i < s.length; i++) {
            const ch = s[i];
            if (esc) { out += ch; esc = false; continue; }
            if (ch === '\\') { out += ch; esc = true; continue; }
            if (ch === '"') { inStr = !inStr; out += ch; continue; }
            if (inStr && ch === '\n') { out += '\\n'; continue; }
            if (inStr && ch === '\t') { out += '\\t'; continue; }
            out += ch;
        }
        s = out;
        // Brace-counting extractor for the first balanced {...}.
        const startIdx = s.indexOf('{');
        if (startIdx !== -1) {
            let depth = 0, end = -1, strMode = false, e2 = false;
            for (let i = startIdx; i < s.length; i++) {
                const ch = s[i];
                if (e2) { e2 = false; continue; }
                if (ch === '\\') { e2 = true; continue; }
                if (ch === '"') { strMode = !strMode; continue; }
                if (strMode) continue;
                if (ch === '{') depth++;
                else if (ch === '}') { depth--; if (depth === 0) { end = i + 1; break; } }
            }
            if (end !== -1) {
                const candidate = s.slice(startIdx, end);
                try { return JSON.parse(candidate); } catch (e) { /* try repair */ }
            }
            // Truncation repair: close open string and braces.
            let repaired = s.slice(startIdx);
            if ((repaired.match(/"/g) || []).length % 2 !== 0) repaired += '"';
            const opens = (repaired.match(/{/g) || []).length;
            const closes = (repaired.match(/}/g) || []).length;
            for (let i = 0; i < opens - closes; i++) repaired += '}';
            try { return JSON.parse(repaired); } catch (e) { /* fail */ }
        }
        throw new Error('Could not parse generated JSON: ' + s.slice(0, 120));
    }

    function insertGeneratedFields(obj, isWorld) {
        if (!obj) return;
        const setText = (id, v) => { const e = document.getElementById(id); if (e && v != null) { e.value = v; window.autoResizeTextarea(e); } };
        if (isWorld) {
            setText('card-name', obj.worldName);
            setText('chat-name', obj.chatName);
            setText('char-description', obj.description);
            setText('char-lore', obj.lore);
            setText('char-reminder', obj.worldRules);
            setText('char-tags', obj.tags);
        } else {
            setText('card-name', obj.cardName);
            setText('chat-name', obj.chatName);
            let desc = obj.description;
            if (desc && typeof desc === 'object') {
                desc = Object.keys(desc).map((k) => k + '\n' + desc[k]).join('\n\n');
            }
            setText('char-description', desc);
            setText('char-tags', obj.tags);
            setText('char-instructions', obj.instructions);
        }
        if (window.updateEditorTokenCount) window.updateEditorTokenCount();
    }

    window.callAISimple = callAISimple;
    window.showModelPickerDialog = showModelPickerDialog;
    window.generateReplyOptionsInBackground = generateReplyOptionsInBackground;
    window.showReplyOptionsDropdown = showReplyOptionsDropdown;
    window.hideReplyOptionsDropdown = hideReplyOptionsDropdown;
    window.pickReplyOption = pickReplyOption;
    window.handleAIGenerateScenario = handleAIGenerateScenario;
    window.handleSummarizeMemories = handleSummarizeMemories;
    window.handleAIGenerateCharacter = handleAIGenerateCharacter;
})();
