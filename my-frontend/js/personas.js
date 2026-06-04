/* personas.js — persona CRUD, list modal, editor, in-chat selection. */
(function () {
    'use strict';
    function $(id) { return document.getElementById(id); }
    function val(id) { const e = $(id); return e ? e.value : ''; }
    function setVal(id, v) { const e = $(id); if (e) e.value = v == null ? '' : v; }

    function placeholderAvatar() { return '<span class="placeholder-icon">👤</span>'; }

    function sortedPersonas(filter) {
        const q = (filter || '').trim().toLowerCase();
        return Object.values(window.personas)
            .filter((p) => (p.name || '').toLowerCase().indexOf(q) !== -1)
            .sort((a, b) => String(a.name).localeCompare(b.name, 'de'));
    }

    // ── List modal ──────────────────────────────────────────────────────────
    function openPersonaListModal(filter) {
        const search = $('persona-list-search-input');
        if (search && filter == null) search.value = '';
        renderPersonaList(filter != null ? filter : (search ? search.value : ''));
        const modal = $('persona-list-modal');
        if (modal) modal.classList.remove('hidden');
    }
    function renderPersonaList(filter) {
        const container = $('persona-list-container');
        if (!container) return;
        container.innerHTML = '';
        const list = sortedPersonas(filter);
        if (!list.length) {
            const has = Object.keys(window.personas).length;
            container.innerHTML = '<p class="picker-empty">' + (has ? 'No personas found.' : 'No personas created yet.') + '</p>';
            return;
        }
        list.forEach((p) => {
            const row = document.createElement('div');
            row.className = 'persona-list-row';
            const av = document.createElement('div');
            av.className = 'persona-row-avatar';
            av.innerHTML = p.avatar ? '<img src="' + window.getImageUrl(p.avatar) + '" onerror="this.outerHTML=\'<span class=&quot;placeholder-icon&quot;>👤</span>\'">' : placeholderAvatar();
            const nm = document.createElement('span');
            nm.className = 'persona-row-name';
            nm.textContent = p.name;
            const edit = document.createElement('button');
            edit.className = 'persona-edit-btn';
            edit.textContent = '✏️';
            edit.addEventListener('click', () => openPersonaEditor(p.id));
            const del = document.createElement('button');
            del.className = 'persona-delete-btn';
            del.textContent = '🗑️';
            del.addEventListener('click', () => handleDeletePersona(p.id));
            row.appendChild(av); row.appendChild(nm); row.appendChild(edit); row.appendChild(del);
            container.appendChild(row);
        });
    }

    // ── Editor ──────────────────────────────────────────────────────────────
    function openPersonaEditor(id) {
        const modal = $('persona-editor-modal');
        const header = modal && modal.querySelector('.editor-header h2');
        const img = $('persona-editor-avatar-img');
        const ph = $('persona-editor-avatar-placeholder');
        window.tempUploadedImages.personaAvatar = null;
        if (id && window.personas[id]) {
            const p = window.personas[id];
            setVal('editing-persona-id', id);
            setVal('persona-name', p.name);
            setVal('persona-avatar', p.avatar);
            setVal('persona-description', p.description);
            if (header) header.textContent = 'Edit Persona';
            if (p.avatar && img) { img.src = window.getImageUrl(p.avatar); img.classList.remove('hidden'); if (ph) ph.classList.add('hidden'); }
            else { if (img) img.classList.add('hidden'); if (ph) ph.classList.remove('hidden'); }
        } else {
            setVal('editing-persona-id', '');
            setVal('persona-name', '');
            setVal('persona-avatar', '');
            setVal('persona-description', '');
            if (header) header.textContent = 'Create new Persona';
            if (img) img.classList.add('hidden');
            if (ph) ph.classList.remove('hidden');
        }
        if (modal) modal.classList.remove('hidden');
        if (window.updatePersonaEditorTokenCount) window.updatePersonaEditorTokenCount();
        const desc = $('persona-description'); if (desc) window.autoResizeTextarea(desc);
    }
    function closePersonaEditor() {
        const modal = $('persona-editor-modal');
        if (modal) modal.classList.add('hidden');
    }

    async function handlePersonaFormSubmit(e) {
        if (e && e.preventDefault) e.preventDefault();
        const id = val('editing-persona-id');
        let avatar = val('persona-avatar');
        if (window.tempUploadedImages.personaAvatar) avatar = window.tempUploadedImages.personaAvatar;
        const data = { name: val('persona-name').trim(), avatar: avatar, description: val('persona-description') };
        if (!data.name) { await window.showCustomAlert('Persona name is required.'); return; }
        if (id && window.personas[id]) {
            window.personas[id] = Object.assign({}, window.personas[id], data);
        } else {
            const newId = 'persona-' + Date.now();
            window.personas[newId] = Object.assign({ id: newId }, data);
        }
        await window.savePersonasToDB();
        closePersonaEditor();
        openPersonaListModal();
    }

    async function handleDeletePersona(id) {
        const p = window.personas[id];
        if (!p) return;
        const ok = await window.showCustomConfirm('Delete persona "' + p.name + '"?', true);
        if (!ok) return;
        delete window.personas[id];
        await window.savePersonasToDB();
        renderPersonaList($('persona-list-search-input') ? $('persona-list-search-input').value : '');
    }

    // ── In-chat selection ───────────────────────────────────────────────────
    function openPersonaSelectionModal(filter) {
        const modal = $('persona-selection-modal');
        const search = $('persona-search-input');
        if (search && filter == null) search.value = '';
        renderPersonaSelectionList(filter != null ? filter : (search ? search.value : ''));
        if (modal) modal.classList.remove('hidden');
    }
    function renderPersonaSelectionList(filter) {
        const list = $('persona-selection-list');
        if (!list) return;
        list.innerHTML = '';
        const personas = sortedPersonas(filter);
        if (!personas.length) {
            list.innerHTML = '<p class="picker-empty">No personas. Create one first.</p>';
            return;
        }
        personas.forEach((p) => {
            const btn = document.createElement('button');
            btn.className = 'participant-option-btn';
            btn.innerHTML = (p.avatar ? '<img class="opt-avatar" src="' + window.getImageUrl(p.avatar) + '">' : placeholderAvatar()) +
                '<span>' + window.escapeHtml(p.name) + '</span>';
            btn.addEventListener('click', () => setActivePersonaForChat(p.id));
            list.appendChild(btn);
        });
    }

    async function setActivePersonaForChat(id) {
        const char = window.characters[window.currentCharacterId];
        const chat = char && char.chats[window.currentChatId];
        if (!char || !chat) return;
        const ok = await window.showCustomConfirm('Use this persona for the chat?');
        if (!ok) return;
        chat.activePersonaId = id;
        await window.saveSingleCharacterToDB(char);
        if (window.updateTokenCount) window.updateTokenCount();
        const modal = $('persona-selection-modal');
        if (modal) modal.classList.add('hidden');
        window.startChat(window.currentCharacterId, window.currentChatId);
    }

    async function unselectPersonaForChat() {
        const char = window.characters[window.currentCharacterId];
        const chat = char && char.chats[window.currentChatId];
        if (!char || !chat) return;
        const ok = await window.showCustomConfirm('Remove the active persona from this chat?');
        if (!ok) return;
        chat.activePersonaId = null;
        await window.saveSingleCharacterToDB(char);
        if (window.updateTokenCount) window.updateTokenCount();
        window.startChat(window.currentCharacterId, window.currentChatId);
    }

    function togglePersonaSelect() {
        const char = window.characters[window.currentCharacterId];
        const chat = char && char.chats[window.currentChatId];
        if (chat && chat.activePersonaId) unselectPersonaForChat();
        else openPersonaSelectionModal();
    }

    window.openPersonaListModal = openPersonaListModal;
    window.renderPersonaList = renderPersonaList;
    window.openPersonaEditor = openPersonaEditor;
    window.closePersonaEditor = closePersonaEditor;
    window.handlePersonaFormSubmit = handlePersonaFormSubmit;
    window.handleDeletePersona = handleDeletePersona;
    window.openPersonaSelectionModal = openPersonaSelectionModal;
    window.renderPersonaSelectionList = renderPersonaSelectionList;
    window.setActivePersonaForChat = setActivePersonaForChat;
    window.togglePersonaSelect = togglePersonaSelect;
})();
