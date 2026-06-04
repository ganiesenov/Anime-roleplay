/* groups.js — group chat participants: icons, add modal, active-speaker dropdown. */
(function () {
    'use strict';
    function $(id) { return document.getElementById(id); }
    function curChar() { return window.characters[window.currentCharacterId]; }
    function curChat() { const c = curChar(); return c && c.chats ? c.chats[window.currentChatId] : null; }
    function dispName(c) { return (c && (c.chatName || c.name)) || 'Character'; }

    function guests(chat) {
        return (chat.participants || []).slice(1).map((id) => window.characters[id]).filter(Boolean);
    }

    function renderParticipantIcons() {
        const list = $('participant-icon-list');
        const chat = curChat();
        if (!list || !chat) return;
        list.innerHTML = '';
        guests(chat).forEach((c) => {
            const wrap = document.createElement('div');
            wrap.className = 'participant-icon-wrapper';
            wrap.dataset.charId = c.id;
            if (c.avatar) {
                const img = document.createElement('img');
                img.src = window.getImageUrl(c.avatar);
                img.addEventListener('error', () => { wrap.innerHTML = '<span class="placeholder-icon">👤</span>'; appendHint(wrap); });
                wrap.appendChild(img);
            } else {
                wrap.innerHTML = '<span class="placeholder-icon">👤</span>';
            }
            appendHint(wrap);
            wrap.title = dispName(c);
            list.appendChild(wrap);
        });
    }
    function appendHint(wrap) {
        const hint = document.createElement('span');
        hint.className = 'participant-remove-hint';
        hint.textContent = '×';
        wrap.appendChild(hint);
    }

    async function removeParticipant(charId) {
        const char = curChar();
        const chat = curChat();
        if (!char || !chat) return;
        const ok = await window.showCustomConfirm('Remove this character from the group chat?', true);
        if (!ok) return;
        chat.participants = (chat.participants || []).filter((id) => id !== charId);
        if (window.activeGroupParticipantId === charId) clearActiveGroupParticipant();
        await window.saveSingleCharacterToDB(char);
        renderParticipantIcons();
        if (window.updateTokenCount) window.updateTokenCount();
    }

    // ── Add participant modal ───────────────────────────────────────────────
    function openParticipantModal(filter) {
        const modal = $('participant-selection-modal');
        const search = $('participant-search-input');
        if (search && filter == null) search.value = '';
        renderParticipantSelectionList(filter != null ? filter : (search ? search.value : ''));
        if (modal) modal.classList.remove('hidden');
    }
    function renderParticipantSelectionList(filter) {
        const list = $('participant-selection-list');
        const chat = curChat();
        if (!list || !chat) return;
        const q = (filter || '').trim().toLowerCase();
        list.innerHTML = '';
        const existing = new Set(chat.participants || []);
        const candidates = Object.values(window.characters)
            .filter((c) => c.type !== 'world' && !existing.has(c.id))
            .filter((c) => (c.name || '').toLowerCase().indexOf(q) !== -1)
            .sort((a, b) => String(a.name).localeCompare(b.name, 'de'));
        if (!candidates.length) {
            list.innerHTML = '<p class="picker-empty">No characters available.</p>';
            return;
        }
        candidates.forEach((c) => {
            const btn = document.createElement('button');
            btn.className = 'participant-option-btn';
            btn.innerHTML = (c.avatar ? '<img class="opt-avatar" src="' + window.getImageUrl(c.avatar) + '">' : '<span class="placeholder-icon">👤</span>') +
                '<span>' + window.escapeHtml(c.name) + '</span>';
            btn.addEventListener('click', () => addParticipantToChat(c.id));
            list.appendChild(btn);
        });
    }

    async function addParticipantToChat(id) {
        const char = curChar();
        const chat = curChat();
        if (!char || !chat) return;
        if (!Array.isArray(chat.participants)) chat.participants = [char.id];
        if (chat.participants.indexOf(id) === -1) chat.participants.push(id);
        await window.saveSingleCharacterToDB(char);
        if (window.updateTokenCount) window.updateTokenCount();
        renderParticipantIcons();
        const modal = $('participant-selection-modal');
        if (modal) modal.classList.add('hidden');
    }

    // ── Active speaker ──────────────────────────────────────────────────────
    function showGroupCharDropdown() {
        const dropdown = $('group-char-dropdown');
        const chat = curChat();
        if (!dropdown || !chat) return;
        const g = guests(chat);
        if (!g.length) { dropdown.classList.add('hidden'); return; }
        dropdown.innerHTML = '';
        g.forEach((c) => {
            const item = document.createElement('div');
            item.className = 'group-char-dropdown-item' + (window.activeGroupParticipantId === c.id ? ' selected' : '');
            item.dataset.charId = c.id;
            item.textContent = dispName(c);
            dropdown.appendChild(item);
        });
        dropdown.classList.remove('hidden');
    }
    function hideGroupCharDropdown() {
        const dropdown = $('group-char-dropdown');
        if (dropdown) dropdown.classList.add('hidden');
    }
    function setActiveGroupParticipant(id) {
        const c = window.characters[id];
        if (!c) return;
        window.activeGroupParticipantId = id;
        const bubble = $('group-char-bubble');
        const name = $('group-char-bubble-name');
        if (name) name.textContent = dispName(c);
        if (bubble) bubble.classList.remove('hidden');
        hideGroupCharDropdown();
        const input = $('message-input');
        if (input) input.focus();
    }
    function clearActiveGroupParticipant() {
        window.activeGroupParticipantId = null;
        const bubble = $('group-char-bubble');
        if (bubble) bubble.classList.add('hidden');
    }

    window.renderParticipantIcons = renderParticipantIcons;
    window.removeParticipant = removeParticipant;
    window.openParticipantModal = openParticipantModal;
    window.renderParticipantSelectionList = renderParticipantSelectionList;
    window.addParticipantToChat = addParticipantToChat;
    window.showGroupCharDropdown = showGroupCharDropdown;
    window.hideGroupCharDropdown = hideGroupCharDropdown;
    window.setActiveGroupParticipant = setActiveGroupParticipant;
    window.clearActiveGroupParticipant = clearActiveGroupParticipant;
})();
