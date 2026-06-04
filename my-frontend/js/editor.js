/* editor.js — character/world editor (fields, type toggle, scenarios, world
 * picker, image upload+webp staging, save), token counter, message editor wiring. */
(function () {
    'use strict';
    function $(id) { return document.getElementById(id); }
    function val(id) { const e = $(id); return e ? e.value : ''; }
    function setVal(id, v) { const e = $(id); if (e) e.value = v == null ? '' : v; }

    const MONITORED_FIELDS = ['card-name', 'chat-name', 'char-description', 'char-lore',
        'char-instructions', 'char-reminder', 'char-narrator-reminder'];

    function clearStaging() {
        window.tempUploadedImages = {};
    }

    function resetForm() {
        const form = $('character-form');
        if (form) form.reset();
        setVal('editing-char-id', '');
        setVal('card-name', ''); setVal('chat-name', '');
        setVal('char-avatar', ''); setVal('char-background', '');
        setVal('char-description', ''); setVal('char-lore', ''); setVal('char-tags', '');
        setVal('char-instructions', ''); setVal('char-reminder', ''); setVal('char-narrator-reminder', '');
        setVal('char-music-url', '');
        const img = $('editor-avatar-img'); if (img) { img.src = ''; img.classList.add('hidden'); }
        const ph = $('editor-avatar-placeholder'); if (ph) ph.classList.remove('hidden');
        window.worldCharSelectedIds = new Set();
        const list = $('scenario-editor-list'); if (list) list.innerHTML = '';
    }

    function updateEditorForType(type) {
        const isWorld = type === 'world';
        document.querySelector('.editor-header h2') && (document.querySelector('.editor-header h2').textContent = isWorld ? 'World Editor' : 'Character Editor');
        const labels = {
            'card-name-label': isWorld ? 'World Name:' : 'Card Name:',
            'char-description-label': isWorld ? 'World Description:' : 'Character Description:',
            'char-reminder-label': isWorld ? 'World Rules:' : 'Character Reminder:'
        };
        Object.keys(labels).forEach((id) => { const e = $(id); if (e) e.textContent = labels[id]; });
        const loreLabel = document.querySelector('label[for="char-lore"]');
        if (loreLabel) loreLabel.textContent = isWorld ? 'World Lore:' : 'Lorebook:';
        const narrLabel = document.querySelector('label[for="char-narrator-reminder"]');
        if (narrLabel) narrLabel.textContent = isWorld ? 'World Narrator Reminder:' : 'Narrator Reminder:';
        // Type-specific sections.
        const avatarGroup = $('editor-avatar-url-group');
        if (avatarGroup) avatarGroup.classList.toggle('hidden', isWorld);
        const instrContainer = $('char-instructions-container');
        if (instrContainer) instrContainer.classList.toggle('hidden', isWorld);
        const worldPicker = $('world-char-picker-section');
        if (worldPicker) worldPicker.classList.toggle('hidden', !isWorld);
        const saveTop = $('save-edit-btn-top'), saveBot = $('save-edit-btn-bottom');
        if (saveTop) saveTop.textContent = isWorld ? 'Save World' : 'Save Character';
        if (saveBot) saveBot.textContent = isWorld ? 'Save World' : 'Save Character';
        const aiBtn = $('ai-generate-char-btn');
        if (aiBtn) aiBtn.textContent = isWorld ? '✨ AI Generate World' : '✨ AI Generate Character';
        if (isWorld) { window.worldCharSelectedIds = window.worldCharSelectedIds || new Set(); renderWorldPicker(); }
    }

    function renderWorldPicker() {
        const list = $('world-char-picker-list');
        const search = $('world-char-search');
        if (!list) return;
        const editingId = val('editing-char-id');
        const q = (search ? search.value : '').trim().toLowerCase();
        const chars = Object.values(window.characters)
            .filter((c) => c.type !== 'world' && c.id !== editingId)
            .filter((c) => (c.name || '').toLowerCase().indexOf(q) !== -1)
            .sort((a, b) => String(a.name).localeCompare(b.name, 'de'));
        list.innerHTML = '';
        if (!chars.length) {
            list.innerHTML = '<p class="picker-empty">Create some characters first to add them to a world.</p>';
            return;
        }
        chars.forEach((c) => {
            const row = document.createElement('label');
            row.className = 'world-char-row';
            const cb = document.createElement('input');
            cb.type = 'checkbox';
            cb.checked = window.worldCharSelectedIds.has(c.id);
            cb.addEventListener('change', () => {
                if (cb.checked) window.worldCharSelectedIds.add(c.id);
                else window.worldCharSelectedIds.delete(c.id);
            });
            const nm = document.createElement('span');
            nm.textContent = c.name;
            row.appendChild(cb); row.appendChild(nm);
            list.appendChild(row);
        });
    }

    // ── Scenarios ───────────────────────────────────────────────────────────
    function createScenarioInput(text, name) {
        const list = $('scenario-editor-list');
        if (!list) return null;
        const entry = document.createElement('div');
        entry.className = 'scenario-entry';
        const nameInput = document.createElement('input');
        nameInput.className = 'scenario-name-input';
        nameInput.placeholder = 'Scenario title';
        nameInput.value = name || '';
        const ta = document.createElement('textarea');
        ta.className = 'scenario-text-input';
        ta.rows = 1;
        ta.value = text || '';
        ta.addEventListener('input', (e) => { window.autoResizeTextarea(e); updateEditorTokenCount(); });
        const del = document.createElement('button');
        del.type = 'button';
        del.className = 'delete-scenario-btn';
        del.textContent = '🗑️';
        del.addEventListener('click', async () => {
            const ok = await window.showCustomConfirm('Delete this scenario?', true);
            if (ok) { entry.remove(); updateEditorTokenCount(); }
        });
        entry.appendChild(nameInput);
        entry.appendChild(ta);
        entry.appendChild(del);
        list.appendChild(entry);
        requestAnimationFrame(() => window.autoResizeTextarea(ta));
        return entry;
    }

    function rebuildScenarios(scenarios) {
        const list = $('scenario-editor-list');
        if (list) list.innerHTML = '';
        (scenarios || []).forEach((sc, i) => {
            if (typeof sc === 'string') createScenarioInput(sc, 'Scenario ' + (i + 1));
            else createScenarioInput(sc.text, sc.name);
        });
    }

    function collectScenarios() {
        const out = [];
        document.querySelectorAll('#scenario-editor-list .scenario-entry').forEach((e) => {
            const text = e.querySelector('.scenario-text-input').value.trim();
            if (!text) return;
            const name = e.querySelector('.scenario-name-input').value.trim() || 'Unnamed Scenario';
            out.push({ name: name, text: text });
        });
        return out;
    }

    // ── Open flows ──────────────────────────────────────────────────────────
    function openEditorForNew() {
        resetForm();
        clearStaging();
        const radio = $('type-character');
        if (radio) radio.checked = true;
        updateEditorForType('character');
        createScenarioInput('', 'Main Greeting');
        setVal('editing-char-id', '');
        const modal = $('character-editor-modal');
        if (modal) modal.classList.remove('hidden');
        updateEditorTokenCount();
        autoResizeMonitored();
    }

    function openEditorForEdit() {
        const char = window.characters[window.currentCharacterId];
        if (!char) return;
        resetForm();
        clearStaging();
        setVal('editing-char-id', char.id);
        setVal('card-name', char.name);
        setVal('chat-name', char.chatName || char.name);
        setVal('char-avatar', char.avatar);
        setVal('char-background', char.background);
        setVal('char-description', char.description);
        setVal('char-lore', char.lore);
        setVal('char-tags', char.tags);
        setVal('char-instructions', char.instructions);
        setVal('char-reminder', char.reminder);
        setVal('char-narrator-reminder', char.narratorReminder);
        setVal('char-music-url', char.musicUrl);
        const isWorld = char.type === 'world';
        const radio = isWorld ? $('type-world') : $('type-character');
        if (radio) radio.checked = true;
        window.worldCharSelectedIds = new Set(char.characterIds || []);
        updateEditorForType(char.type || 'character');
        rebuildScenarios(char.scenarios);
        // Preview.
        const previewSrc = isWorld ? char.background : char.avatar;
        const img = $('editor-avatar-img');
        const ph = $('editor-avatar-placeholder');
        if (previewSrc && img) { img.src = window.getImageUrl(previewSrc); img.classList.remove('hidden'); if (ph) ph.classList.add('hidden'); }
        if (char.background) window.applyBackground($('chat-list-screen'), char.background);
        const modal = $('character-editor-modal');
        if (modal) modal.classList.remove('hidden');
        updateEditorTokenCount();
        autoResizeMonitored();
    }

    function closeEditor() {
        const modal = $('character-editor-modal');
        if (modal) modal.classList.add('hidden');
        clearStaging();
    }

    function autoResizeMonitored() {
        MONITORED_FIELDS.forEach((id) => { const e = $(id); if (e && e.tagName === 'TEXTAREA') window.autoResizeTextarea(e); });
        const tags = $('char-tags'); if (tags) window.autoResizeTextarea(tags);
    }

    // ── Save ────────────────────────────────────────────────────────────────
    async function handleFormSubmit(e) {
        if (e && e.preventDefault) e.preventDefault();
        const type = ($('type-world') && $('type-world').checked) ? 'world' : 'character';
        const isWorld = type === 'world';
        const editingId = val('editing-char-id');

        let avatar = val('char-avatar');
        let background = val('char-background');
        // Staged images take precedence; replace blob: urls.
        if (window.tempUploadedImages.avatar) avatar = window.tempUploadedImages.avatar;
        else if (avatar.indexOf('blob:') === 0 && window.tempUploadedImages.avatarOriginal) avatar = window.tempUploadedImages.avatarOriginal;
        if (window.tempUploadedImages.background) background = window.tempUploadedImages.background;
        else if (background.indexOf('blob:') === 0 && window.tempUploadedImages.backgroundOriginal) background = window.tempUploadedImages.backgroundOriginal;
        if (isWorld) avatar = '';

        const scenarios = collectScenarios();
        const characterIds = isWorld ? [...(window.worldCharSelectedIds || [])] : [];

        const data = {
            name: val('card-name').trim(),
            chatName: val('chat-name').trim() || val('card-name').trim(),
            avatar: avatar,
            background: background,
            description: val('char-description'),
            lore: val('char-lore'),
            tags: val('char-tags'),
            instructions: val('char-instructions'),
            reminder: val('char-reminder'),
            narratorReminder: val('char-narrator-reminder'),
            musicUrl: val('char-music-url'),
            scenarios: scenarios,
            type: type,
            characterIds: characterIds
        };

        closeEditor();

        let char;
        if (editingId && window.characters[editingId]) {
            char = window.characters[editingId];
            Object.assign(char, data);
        } else {
            char = Object.assign({
                id: 'char-' + Date.now(),
                chats: {}, isFavorite: false, isArchived: false,
                particleEffect: 'none', particleIntensityLevel: 50
            }, data);
            window.characters[char.id] = char;
        }
        window.normalizeCharacter(char);
        await window.saveSingleCharacterToDB(char);
        window.renderCharacterList();
        if (window.currentCharacterId === char.id && !$('chat-list-screen').classList.contains('is-inactive')) {
            window.showChatList(char.id);
        }
    }

    // ── Token counter ───────────────────────────────────────────────────────
    function updateEditorTokenCount() {
        let len = 0;
        [val('chat-name'), val('char-description'), val('char-lore'),
        val('char-instructions'), val('char-reminder'), val('char-narrator-reminder')]
            .forEach((t) => { len += String(t || '').length; });
        document.querySelectorAll('#scenario-editor-list .scenario-text-input').forEach((t) => { len += t.value.length; });
        const counter = $('editor-token-counter');
        if (counter) counter.textContent = 'Estimated Tokens: ~' + Math.round(len / 4);
    }
    function updatePersonaEditorTokenCount() {
        const len = (val('persona-name') + val('persona-description')).length;
        const counter = $('persona-editor-token-counter');
        if (counter) counter.textContent = 'Estimated Tokens: ~' + Math.round(len / 4);
    }

    // ── Image upload (webp staging) ─────────────────────────────────────────
    let uploadTarget = 'avatar';
    function triggerUpload(target) {
        uploadTarget = target;
        const inp = $('image-uploader');
        if (inp) { inp.value = ''; inp.click(); }
    }
    function triggerPersonaUpload() {
        uploadTarget = 'personaAvatar';
        const inp = $('image-uploader');
        if (inp) { inp.value = ''; inp.click(); }
    }
    async function handleImageUpload(e) {
        const file = e.target.files && e.target.files[0];
        if (!file) return;
        try {
            const result = await window.imageFileToWebp(file, 0.80);
            window.tempUploadedImages[uploadTarget] = result.dataUrl;
            window.tempUploadedImages[uploadTarget + 'Original'] = result.dataUrl;
            if (uploadTarget === 'avatar') {
                setVal('char-avatar', result.objectUrl);
                $('char-avatar') && $('char-avatar').dispatchEvent(new Event('input'));
                previewEditorAvatar(result.objectUrl);
            } else if (uploadTarget === 'background') {
                setVal('char-background', result.objectUrl);
                $('char-background') && $('char-background').dispatchEvent(new Event('input'));
            } else if (uploadTarget === 'personaAvatar') {
                setVal('persona-avatar', result.objectUrl);
                previewPersonaAvatar(result.objectUrl);
            }
        } catch (err) {
            window.showCustomAlert('Could not process the image.');
        }
    }
    function previewEditorAvatar(src) {
        const img = $('editor-avatar-img');
        const ph = $('editor-avatar-placeholder');
        if (img) { img.src = src; img.classList.remove('hidden'); }
        if (ph) ph.classList.add('hidden');
    }
    function previewPersonaAvatar(src) {
        const img = $('persona-editor-avatar-img');
        const ph = $('persona-editor-avatar-placeholder');
        if (img) { img.src = src; img.classList.remove('hidden'); }
        if (ph) ph.classList.add('hidden');
    }

    window.openEditorForNew = openEditorForNew;
    window.openEditorForEdit = openEditorForEdit;
    window.closeEditor = closeEditor;
    window.handleFormSubmit = handleFormSubmit;
    window.updateEditorForType = updateEditorForType;
    window.createScenarioInput = createScenarioInput;
    window.updateEditorTokenCount = updateEditorTokenCount;
    window.updatePersonaEditorTokenCount = updatePersonaEditorTokenCount;
    window.renderWorldPicker = renderWorldPicker;
    window.triggerUpload = triggerUpload;
    window.triggerPersonaUpload = triggerPersonaUpload;
    window.handleImageUpload = handleImageUpload;
    window.previewEditorAvatar = previewEditorAvatar;
    window.previewPersonaAvatar = previewPersonaAvatar;
})();
