/* settings.js — design settings panel, app-settings modal (models/providers),
 * model selectors, discovery (Ollama/OpenRouter), responsive limits. */
(function () {
    'use strict';
    function $(id) { return document.getElementById(id); }

    // Binding: setting key -> {id, type}
    const SETTING_BINDINGS = {
        avatarSize: { id: 'avatar-size-slider', type: 'range' },
        fontSize: { id: 'font-size-slider', type: 'range' },
        messageSpacing: { id: 'spacing-slider', type: 'range' },
        mainTextColor: { id: 'main-text-color-picker', type: 'color' },
        dialogueColor: { id: 'dialogue-color-picker', type: 'color' },
        userBubbleColor: { id: 'user-bubble-color-picker', type: 'color' },
        userBubbleOpacity: { id: 'user-bubble-opacity-slider', type: 'range' },
        aiBubbleColor: { id: 'ai-bubble-color-picker', type: 'color' },
        aiBubbleOpacity: { id: 'ai-bubble-opacity-slider', type: 'range' },
        blur: { id: 'blur-slider', type: 'range' },
        model: { id: 'model-select', type: 'select' },
        temperature: { id: 'temperature-slider', type: 'range' },
        replyLength: { id: 'reply-length-select', type: 'select' },
        replyOptionsEnabled: { id: 'reply-options-toggle', type: 'checkbox' },
        suggestionModelId: { id: 'suggestion-model-select', type: 'select' },
        thinkEnabled: { id: 'think-toggle', type: 'checkbox' },
        autoSummarizeEnabled: { id: 'auto-summarize-toggle', type: 'checkbox' },
        autoSummarizeEvery: { id: 'auto-summarize-every', type: 'range' },
        summaryModelId: { id: 'summary-model-select', type: 'select' },
        ttsVoiceURI: { id: 'tts-voice-select', type: 'select' },
        ttsEnabled: { id: 'tts-toggle', type: 'checkbox' },
        soundEnabled: { id: 'sound-toggle', type: 'checkbox' }
    };

    function readControlValue(binding) {
        const el = $(binding.id);
        if (!el) return null;
        if (binding.type === 'checkbox') return el.checked ? 'true' : 'false';
        return el.value;
    }

    function writeControlValue(binding, value) {
        const el = $(binding.id);
        if (!el) return;
        if (binding.type === 'checkbox') el.checked = (value === true || value === 'true');
        else el.value = value;
    }

    async function loadAndApplySettingsFromDB() {
        const stored = await window.loadAllSettingsRows();
        window._settingsValueMap = {};
        Object.keys(window.defaultSettings).forEach((key) => {
            // Model-select keys are handled after their options are populated.
            if (key === 'suggestionModelId' || key === 'summaryModelId') return;
            const binding = SETTING_BINDINGS[key];
            const value = (stored[key] != null) ? stored[key] : window.defaultSettings[key];
            window._settingsValueMap[key] = value;
            if (binding) writeControlValue(binding, value);
            window.applySetting(key, value);
        });
        // Model selectors only applied if stored (options are populated separately).
        ['suggestionModelId', 'summaryModelId'].forEach((key) => {
            if (stored[key] == null) return;
            window._settingsValueMap[key] = stored[key];
            writeControlValue(SETTING_BINDINGS[key], stored[key]);
            window.applySetting(key, stored[key]);
        });
    }
    // Alias used at bootstrap.
    const loadAndApplySettings = loadAndApplySettingsFromDB;

    function addSettingListener(key) {
        const binding = SETTING_BINDINGS[key];
        if (!binding) return;
        const el = $(binding.id);
        if (!el) return;
        const handler = () => {
            const value = readControlValue(binding);
            window._settingsValueMap = window._settingsValueMap || {};
            window._settingsValueMap[key] = value;
            window.applySetting(key, value);
            window.saveSettingToDB(key, value);
        };
        el.addEventListener('input', handler);
        el.addEventListener('change', handler);
    }

    function wireSettingListeners() {
        Object.keys(SETTING_BINDINGS).forEach(addSettingListener);
    }

    async function resetAppSettingsDesign() {
        const ok = await window.showCustomConfirm('Reset all design settings to defaults?');
        if (!ok) return;
        for (const key of Object.keys(window.defaultSettings)) {
            await window.saveSettingToDB(key, window.defaultSettings[key]);
        }
        await loadAndApplySettingsFromDB();
        enforceResponsiveSettingLimits();
    }

    // ── Responsive limits ───────────────────────────────────────────────────
    function enforceResponsiveSettingLimits() {
        const mobile = window.matchMedia('(max-width: ' + window.MOBILE_BREAKPOINT + 'px)').matches;
        const font = $('font-size-slider');
        const avatar = $('avatar-size-slider');
        if (font) {
            const max = mobile ? window.MOBILE_FONT_MAX : 36;
            font.max = max;
            if (parseInt(font.value, 10) > max) { font.value = max; window.applySetting('fontSize', String(max)); }
        }
        if (avatar) {
            const max = mobile ? window.MOBILE_AVATAR_MAX : 1000;
            avatar.max = max;
            if (parseInt(avatar.value, 10) > max) { avatar.value = max; window.applySetting('avatarSize', String(max)); }
        }
    }

    // ── Model selectors ─────────────────────────────────────────────────────
    function populateModelSelector() {
        const models = window.appSettings.availableModels || [];
        const chatSel = $('model-select');
        const sugSel = $('suggestion-model-select');
        if (chatSel) {
            const prev = chatSel.value;
            chatSel.innerHTML = '';
            models.forEach((m) => {
                const opt = document.createElement('option');
                opt.value = m.id; opt.textContent = m.name || m.id;
                chatSel.appendChild(opt);
            });
            if (models.some((m) => m.id === prev)) chatSel.value = prev;
            else if (models.some((m) => m.id === window.defaultSettings.model)) chatSel.value = window.defaultSettings.model;
            window.runtimeFlags.model = chatSel.value;
        }
        const fillModelDropdown = (sel) => {
            if (!sel) return;
            const prev = sel.value;
            sel.innerHTML = '<option value="">(same as chat model)</option>';
            models.forEach((m) => {
                const opt = document.createElement('option');
                opt.value = m.id; opt.textContent = m.name || m.id;
                sel.appendChild(opt);
            });
            if (prev && models.some((m) => m.id === prev)) sel.value = prev;
        };
        fillModelDropdown(sugSel);
        fillModelDropdown($('summary-model-select'));
    }

    // ── App settings modal ──────────────────────────────────────────────────
    function openAppSettingsModal() {
        renderModelEntries();
        const apiKey = $('api-key-input');
        if (apiKey) apiKey.value = window.appSettings.apiKey || '';
        const modal = $('app-settings-modal');
        if (modal) modal.classList.remove('hidden');
        fetchOllamaModels();
    }
    function closeAppSettingsModal() {
        const modal = $('app-settings-modal');
        if (modal) modal.classList.add('hidden');
        const content = $('app-settings-modal-content');
        if (content) content.scrollTop = 0;
    }

    function createModelEntry(model) {
        model = model || {};
        const entry = document.createElement('div');
        entry.className = 'model-entry';
        entry.innerHTML =
            '<div class="model-entry-top">' +
            '<span class="model-drag-handle" title="Drag to reorder">⠿</span>' +
            '<input class="model-name-input" type="text" placeholder="Display name" value="' + esc(model.name) + '">' +
            '<input class="model-id-input" type="text" placeholder="model id" value="' + esc(model.id) + '">' +
            '<button type="button" class="delete-model-btn" title="Delete">✕</button>' +
            '</div>' +
            '<input class="model-target-api-url-input" type="url" placeholder="API URL (blank = local backend)" value="' + esc(model.targetApiUrl) + '">' +
            '<input class="model-api-key-input" type="password" placeholder="API key (optional)" value="' + esc(model.apiKey) + '">' +
            '<input class="model-num-ctx-input" type="number" min="512" step="512" placeholder="num_ctx (Ollama)" value="' + (model.numCtx != null ? model.numCtx : '') + '">' +
            '<details class="model-prompts"><summary>Global Prompts</summary>' +
            '<textarea class="model-instructions-input" placeholder="Instructions">' + esc(model.instructions) + '</textarea>' +
            '<textarea class="model-reminder-input" placeholder="Reminder">' + esc(model.reminder) + '</textarea>' +
            '<textarea class="model-narrator-reminder-input" placeholder="Narrator Reminder">' + esc(model.narratorReminder) + '</textarea>' +
            '</details>';
        entry.querySelector('.delete-model-btn').addEventListener('click', async () => {
            const ok = await window.showCustomConfirm('Delete this model entry?', true);
            if (ok) entry.remove();
        });
        entry.querySelectorAll('textarea').forEach((t) => {
            t.addEventListener('input', window.autoResizeTextarea);
            requestAnimationFrame(() => window.autoResizeTextarea(t));
        });
        wireDragHandle(entry);
        return entry;
    }
    function esc(s) { return String(s == null ? '' : s).replace(/"/g, '&quot;').replace(/</g, '&lt;'); }

    function renderModelEntries() {
        const container = $('model-list-container');
        if (!container) return;
        container.innerHTML = '';
        (window.appSettings.availableModels || []).forEach((m) => container.appendChild(createModelEntry(m)));
    }

    function addModelEntry(model) {
        const container = $('model-list-container');
        if (!container) return null;
        const entry = createModelEntry(model || {});
        container.appendChild(entry);
        return entry;
    }

    function scrapeModelEntries() {
        const container = $('model-list-container');
        if (!container) return [];
        const out = [];
        container.querySelectorAll('.model-entry').forEach((e) => {
            const name = e.querySelector('.model-name-input').value.trim();
            const id = e.querySelector('.model-id-input').value.trim();
            if (!name || !id) return;
            const numCtxRaw = e.querySelector('.model-num-ctx-input').value;
            out.push({
                name: name, id: id,
                targetApiUrl: e.querySelector('.model-target-api-url-input').value.trim(),
                apiKey: e.querySelector('.model-api-key-input').value.trim(),
                instructions: e.querySelector('.model-instructions-input').value,
                reminder: e.querySelector('.model-reminder-input').value,
                narratorReminder: e.querySelector('.model-narrator-reminder-input').value,
                numCtx: numCtxRaw ? parseInt(numCtxRaw, 10) : null
            });
        });
        return out;
    }

    async function saveAppSettings(e) {
        if (e && e.preventDefault) e.preventDefault();
        const models = scrapeModelEntries();
        const apiKey = $('api-key-input') ? $('api-key-input').value.trim() : '';
        window.appSettings = { apiKey: apiKey, availableModels: models };
        window.ensureLocalBackendModel();
        await window.saveAppSettingsToDB();
        populateModelSelector();
        closeAppSettingsModal();
    }

    async function resetAppSettings() {
        const ok = await window.showCustomConfirm('Reset model list to defaults?', true);
        if (!ok) return;
        window.appSettings = { apiKey: window.appSettings.apiKey || '', availableModels: window.DEFAULT_AVAILABLE_MODELS.map((m) => Object.assign({}, m)) };
        renderModelEntries();
        await saveAppSettings();
    }

    // ── Drag reorder ────────────────────────────────────────────────────────
    function wireDragHandle(entry) {
        const handle = entry.querySelector('.model-drag-handle');
        if (!handle) return;
        handle.addEventListener('mousedown', () => { entry.draggable = true; });
        entry.addEventListener('dragstart', () => entry.classList.add('dragging'));
        entry.addEventListener('dragend', () => {
            entry.classList.remove('dragging'); entry.draggable = false;
            document.querySelectorAll('.model-entry').forEach((e) => e.classList.remove('drag-over-top', 'drag-over-bottom'));
        });
        entry.addEventListener('dragover', (ev) => {
            ev.preventDefault();
            const dragging = document.querySelector('.model-entry.dragging');
            if (!dragging || dragging === entry) return;
            const rect = entry.getBoundingClientRect();
            const after = ev.clientY > rect.top + rect.height / 2;
            entry.classList.toggle('drag-over-bottom', after);
            entry.classList.toggle('drag-over-top', !after);
            const container = $('model-list-container');
            if (after) entry.after(dragging); else entry.before(dragging);
        });
    }

    // ── Ollama discovery ────────────────────────────────────────────────────
    async function fetchOllamaModels() {
        const list = $('ollama-models-list');
        if (!list) return;
        list.innerHTML = '<span class="provider-loading">Loading models from Ollama…</span>';
        let data;
        try {
            const r = await fetch(backendOrigin() + '/api/health');
            data = await r.json();
        } catch (e) {
            list.innerHTML = '<span class="provider-error">Couldn\'t fetch the list (' + window.escapeHtml(String(e.message || e)) + ').</span>';
            return;
        }
        const models = (data && data.available_models) || [];
        if (!models.length) {
            if (data && data.error) {
                list.innerHTML = '<span class="provider-error">Ollama is unreachable: ' + window.escapeHtml(String(data.error)) + '</span>';
            } else {
                list.innerHTML = '<span class="provider-hint">No models found. Try <code>ollama pull qwen2.5</code>.</span>';
            }
            return;
        }
        list.innerHTML = '';
        models.forEach((m) => {
            const chip = document.createElement('button');
            chip.type = 'button';
            chip.className = 'provider-chip' + (data.model === m ? ' is-default' : '');
            chip.textContent = m + (data.model === m ? ' (default)' : '');
            chip.addEventListener('click', () => {
                const entry = addModelEntry({ name: m, id: m, targetApiUrl: window.DEFAULT_API_URL });
                if (entry) { entry.scrollIntoView({ behavior: 'smooth', block: 'center' }); flash(entry); }
            });
            list.appendChild(chip);
        });
    }

    function flash(el) {
        el.classList.add('flash');
        setTimeout(() => el.classList.remove('flash'), 800);
    }

    // ── OpenRouter discovery ────────────────────────────────────────────────
    async function loadOpenRouterModels() {
        const btn = $('load-openrouter-btn');
        const datalist = $('openrouter-models-datalist');
        if (btn) { btn.textContent = 'Loading…'; btn.disabled = true; }
        try {
            const r = await fetch('https://openrouter.ai/api/v1/models');
            const data = await r.json();
            const models = (data && data.data) || [];
            if (datalist) {
                datalist.innerHTML = '';
                models.forEach((m) => {
                    const opt = document.createElement('option');
                    opt.value = m.id; opt.label = m.name || m.id;
                    datalist.appendChild(opt);
                });
            }
            if (btn) btn.textContent = 'Loaded: ' + models.length;
        } catch (e) {
            if (btn) btn.textContent = 'Load failed';
        }
        setTimeout(() => { if (btn) { btn.textContent = 'Load list'; btn.disabled = false; } }, 2500);
    }

    function addOpenRouterModel() {
        const input = $('openrouter-model-input');
        const key = $('api-key-input');
        const id = input ? input.value.trim() : '';
        if (!id) { window.showToast('Enter or pick a model id first.'); return; }
        const entry = addModelEntry({
            name: id, id: id,
            targetApiUrl: 'https://openrouter.ai/api/v1/chat/completions',
            apiKey: key ? key.value.trim() : ''
        });
        if (entry) { entry.scrollIntoView({ behavior: 'smooth', block: 'center' }); flash(entry); }
        if (input) input.value = '';
    }

    function backendOrigin() {
        if (location.protocol === 'http:' || location.protocol === 'https:') return location.origin;
        try { return new URL(window.DEFAULT_API_URL).origin; } catch (e) { return 'http://127.0.0.1:8000'; }
    }

    window.loadAndApplySettings = loadAndApplySettings;
    window.loadAndApplySettingsFromDB = loadAndApplySettingsFromDB;
    window.wireSettingListeners = wireSettingListeners;
    window.addSettingListener = addSettingListener;
    window.resetAppSettingsDesign = resetAppSettingsDesign;
    window.enforceResponsiveSettingLimits = enforceResponsiveSettingLimits;
    window.populateModelSelector = populateModelSelector;
    window.openAppSettingsModal = openAppSettingsModal;
    window.closeAppSettingsModal = closeAppSettingsModal;
    window.createModelEntry = createModelEntry;
    window.addModelEntry = addModelEntry;
    window.saveAppSettings = saveAppSettings;
    window.resetAppSettings = resetAppSettings;
    window.fetchOllamaModels = fetchOllamaModels;
    window.loadOpenRouterModels = loadOpenRouterModels;
    window.addOpenRouterModel = addOpenRouterModel;
})();
