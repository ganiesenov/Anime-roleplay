/* ui-helpers.js — screen/navigation model, settings live-apply, small DOM helpers. */
(function () {
    'use strict';

    function $(id) { return document.getElementById(id); }

    // ── Screen activeness ───────────────────────────────────────────────────
    function activateScreen(id) {
        const el = $(id);
        if (!el) return;
        el.classList.remove('is-inactive');
        el.style.pointerEvents = 'auto';
    }
    function deactivateScreen(id) {
        const el = $(id);
        if (!el) return;
        el.classList.add('is-inactive');
        el.style.pointerEvents = 'none';
    }
    function showStars(visible) {
        const stars = $('stars-container');
        if (!stars) return;
        stars.style.pointerEvents = 'none';
        if (visible) stars.classList.add('visible');
        else stars.classList.remove('visible');
    }
    function getActiveScreenName() {
        if (!$('character-selection-screen')) return 'character-selection';
        if (!$('chat-screen').classList.contains('is-inactive')) return 'chat';
        if (!$('chat-list-screen').classList.contains('is-inactive')) return 'chat-list';
        return 'character-selection';
    }

    function applyBackground(screenEl, bgSrc) {
        if (!screenEl) return;
        if (bgSrc) {
            screenEl.style.backgroundImage = 'url("' + window.getImageUrl(bgSrc) + '")';
            screenEl.style.backgroundSize = 'cover';
            screenEl.style.backgroundPosition = 'center';
            showStars(false);
        } else {
            screenEl.style.backgroundImage = '';
            showStars(true);
        }
    }

    // ── Navigation ──────────────────────────────────────────────────────────
    function showMainScreen() {
        deactivateScreen('chat-list-screen');
        deactivateScreen('chat-screen');
        activateScreen('character-selection-screen');
        showStars(true);
        window.currentCharacterId = null;
        window.currentChatId = null;
        localStorage.removeItem('activeCharacterId');
        localStorage.removeItem('activeChatId');
    }

    function showCharacterSelection() {
        if (window.stopParticles) window.stopParticles();
        if (window._musicFeatureReady && window.stopMusic) window.stopMusic();
        if (window.speechSynthesis) { try { window.speechSynthesis.cancel(); } catch (e) { /* ignore */ } }
        deactivateScreen('chat-screen');
        const sp = $('settings-panel');
        if (sp) sp.classList.add('hidden');
        const lastChar = window.currentCharacterId;
        window.currentChatId = null;
        localStorage.removeItem('activeChatId');
        if (lastChar && window.characters[lastChar]) {
            window.showChatList(lastChar);
        } else {
            showMainScreen();
        }
    }

    function showChatList(charId) {
        const char = window.characters[charId];
        if (!char) { showMainScreen(); return; }
        window.freezeLayout();
        window.currentCharacterId = charId;
        localStorage.setItem('activeCharacterId', charId);
        localStorage.removeItem('activeChatId');
        window.currentChatId = null;

        activateScreen('chat-list-screen');
        deactivateScreen('character-selection-screen');
        deactivateScreen('chat-screen');

        // Avatar / name / background.
        const isWorld = char.type === 'world';
        const avatarImg = $('chat-list-avatar');
        const avatarContainer = $('chat-list-avatar-container');
        const placeholder = $('chat-list-avatar-placeholder');
        const imgSrc = isWorld ? char.background : char.avatar;
        if (imgSrc) {
            if (avatarImg) { avatarImg.src = window.getImageUrl(imgSrc); avatarImg.classList.remove('hidden'); }
            if (avatarContainer) avatarContainer.style.backgroundImage = 'url("' + window.getImageUrl(imgSrc) + '")';
            if (placeholder) placeholder.classList.add('hidden');
        } else {
            if (avatarImg) { avatarImg.src = ''; avatarImg.classList.add('hidden'); }
            if (avatarContainer) avatarContainer.style.backgroundImage = '';
            if (placeholder) { placeholder.textContent = isWorld ? '🌍' : '👤'; placeholder.classList.remove('hidden'); }
        }
        const nameEl = $('chat-list-character-name');
        if (nameEl) nameEl.textContent = char.name || '';

        applyBackground($('chat-list-screen'), char.background);

        window.renderChatSessionList(char);
        const list = $('chat-session-list');
        if (list) list.scrollTop = 0;

        if (window.tutorialOnScreenChange) window.tutorialOnScreenChange('chat-list');
        window.unfreezeLayout();
    }

    function renderChatSessionList(char) {
        const list = $('chat-session-list');
        if (!list) return;
        list.innerHTML = '';
        const chats = Object.values(char.chats || {}).sort((a, b) =>
            window.tsFromId(b.id, 'chat') - window.tsFromId(a.id, 'chat'));
        if (!chats.length) {
            list.innerHTML = '<p class="chat-list-empty">No chats yet.</p>';
            return;
        }
        chats.forEach((chat) => {
            const entry = document.createElement('div');
            entry.className = 'chat-session-entry';
            const name = document.createElement('span');
            name.className = 'chat-session-name';
            name.dataset.chatId = chat.id;
            name.textContent = chat.name || 'Chat';
            const rename = document.createElement('button');
            rename.className = 'rename-chat-btn';
            rename.dataset.chatId = chat.id;
            rename.textContent = '✏️';
            rename.title = 'Rename chat';
            const del = document.createElement('button');
            del.className = 'delete-chat-btn';
            del.dataset.chatId = chat.id;
            del.textContent = '🗑️';
            del.title = 'Delete chat';
            entry.appendChild(name);
            entry.appendChild(rename);
            entry.appendChild(del);
            list.appendChild(entry);
        });
    }

    function restoreLastSession() {
        const charId = localStorage.getItem('activeCharacterId');
        const chatId = localStorage.getItem('activeChatId');
        if (charId && window.characters[charId]) {
            const char = window.characters[charId];
            if (chatId && char.chats && char.chats[chatId]) {
                window.startChat(charId, chatId);
                return;
            }
            showChatList(charId);
            return;
        }
        // Land on selection.
        activateScreen('character-selection-screen');
        deactivateScreen('chat-list-screen');
        deactivateScreen('chat-screen');
        setTimeout(() => showStars(true), 0);
    }

    // ── Settings live-apply ─────────────────────────────────────────────────
    function rootVar(name, value) { document.documentElement.style.setProperty(name, value); }

    function composeBubble(colorHex, opacity) {
        const rgb = window.parseHex(colorHex);
        if (!rgb) return null;
        return 'rgba(' + rgb.r + ', ' + rgb.g + ', ' + rgb.b + ', ' + opacity + ')';
    }

    function currentDesignValue(key) {
        // Read from the bound input, falling back to defaults.
        const map = window._settingsValueMap || {};
        if (map[key] != null) return map[key];
        return window.defaultSettings[key];
    }

    function applySetting(key, value) {
        window._settingsValueMap = window._settingsValueMap || {};
        window._settingsValueMap[key] = value;
        const setLabel = (id, txt) => { const el = $(id); if (el) el.textContent = txt; };
        switch (key) {
            case 'avatarSize': {
                const v = parseInt(value, 10) || 200;
                rootVar('--ai-avatar-size', v + 'px');
                rootVar('--ai-placeholder-icon-size', Math.round(v * 0.6) + 'px');
                setLabel('avatar-size-value', v + 'px');
                break;
            }
            case 'fontSize': {
                const v = parseInt(value, 10) || 18;
                rootVar('--chat-font-size', v + 'px');
                setLabel('font-size-value', v + 'px');
                break;
            }
            case 'messageSpacing': {
                const v = parseInt(value, 10) || 50;
                rootVar('--message-spacing', v + 'px');
                setLabel('spacing-value', v + 'px');
                break;
            }
            case 'mainTextColor':
                rootVar('--main-text-color', value);
                break;
            case 'dialogueColor':
                rootVar('--dialogue-color', value);
                break;
            case 'userBubbleColor':
            case 'userBubbleOpacity': {
                const color = currentDesignValue('userBubbleColor');
                const op = currentDesignValue('userBubbleOpacity');
                const rgba = composeBubble(color, op);
                if (rgba) rootVar('--user-bubble-color', rgba);
                setLabel('user-bubble-opacity-value', Math.round(parseFloat(op) * 100) + '%');
                break;
            }
            case 'aiBubbleColor':
            case 'aiBubbleOpacity': {
                const color = currentDesignValue('aiBubbleColor');
                const op = currentDesignValue('aiBubbleOpacity');
                const rgba = composeBubble(color, op);
                if (rgba) rootVar('--ai-bubble-color', rgba);
                setLabel('ai-bubble-opacity-value', Math.round(parseFloat(op) * 100) + '%');
                break;
            }
            case 'blur': {
                const v = parseInt(value, 10) || 0;
                rootVar('--message-blur', v + 'px');
                setLabel('blur-value', v + 'px');
                break;
            }
            case 'temperature':
                setLabel('temperature-value', parseFloat(value).toFixed(2));
                break;
            case 'model':
                window.runtimeFlags.model = value;
                break;
            case 'replyLength':
                window.runtimeFlags.replyLength = value;
                break;
            case 'suggestionModelId':
                window.runtimeFlags.suggestionModelId = value;
                break;
            case 'soundEnabled':
                window.runtimeFlags.soundEnabled = (value === true || value === 'true');
                break;
            case 'thinkEnabled':
                window.runtimeFlags.thinkEnabled = (value === true || value === 'true');
                break;
            case 'autoSummarizeEnabled':
                window.runtimeFlags.autoSummarizeEnabled = (value === true || value === 'true');
                break;
            case 'autoSummarizeEvery': {
                const n = Math.max(10, parseInt(value, 10) || 30);
                window.runtimeFlags.autoSummarizeEvery = n;
                setLabel('auto-summarize-every-value', String(n));
                break;
            }
            case 'summaryModelId':
                window.runtimeFlags.summaryModelId = value;
                break;
            case 'replyOptionsEnabled':
                window.runtimeFlags.replyOptionsEnabled = (value === true || value === 'true');
                window.replyOptionsEnabled = window.runtimeFlags.replyOptionsEnabled;
                if (!window.replyOptionsEnabled) {
                    window.pendingReplyOptions = null;
                    if (window.hideReplyOptionsDropdown) window.hideReplyOptionsDropdown();
                }
                break;
            case 'ttsEnabled':
                window.runtimeFlags.ttsEnabled = (value === true || value === 'true');
                break;
            case 'ttsVoiceURI':
                window.runtimeFlags.ttsVoiceURI = value;
                break;
            default:
                break;
        }
    }

    window.$id = $;
    window.activateScreen = activateScreen;
    window.deactivateScreen = deactivateScreen;
    window.showStars = showStars;
    window.getActiveScreenName = getActiveScreenName;
    window.applyBackground = applyBackground;
    window.showMainScreen = showMainScreen;
    window.showCharacterSelection = showCharacterSelection;
    window.showChatList = showChatList;
    window.renderChatSessionList = renderChatSessionList;
    window.restoreLastSession = restoreLastSession;
    window.applySetting = applySetting;
})();
