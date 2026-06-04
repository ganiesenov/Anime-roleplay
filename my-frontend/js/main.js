/* main.js — DOM event wiring + bootstrap (loaded after domain modules). */
(function () {
    'use strict';
    function $(id) { return document.getElementById(id); }
    function on(id, ev, fn) { const e = $(id); if (e) e.addEventListener(ev, fn); }

    // ── Branding (drive DOM to "Aria" per spec §2.7 without editing markup) ──
    function applyBranding() {
        document.title = 'Aria';
        document.querySelectorAll('.brand-logo').forEach((e) => { e.textContent = 'Aria'; });
        const loaderTitle = $('app-loader-title'); if (loaderTitle) loaderTitle.textContent = 'Aria';
        const copyright = $('copyright-notice'); if (copyright) copyright.textContent = '© 2026 Aria';
    }

    // ── Starter pack ────────────────────────────────────────────────────────
    async function loadStarterPack() {
        try {
            let pack = window.STARTER_PACK_DATA;
            if (!pack) {
                try { const r = await fetch('starter_pack_data.json'); pack = await r.json(); } catch (e) { /* none */ }
            }
            if (!pack) return;
            const chars = Array.isArray(pack) ? pack : (pack.characters || []);
            const list = Array.isArray(chars) ? chars : Object.values(chars);
            for (const c of list) {
                if (!c || !c.id) continue;
                window.characters[c.id] = window.normalizeCharacter(c);
                await window.saveSingleCharacterToDB(window.characters[c.id]);
            }
            if (!Array.isArray(pack)) {
                if (pack.personas) {
                    const ps = Array.isArray(pack.personas) ? pack.personas : Object.values(pack.personas);
                    ps.forEach((p) => { if (p && p.id) window.personas[p.id] = p; });
                    await window.savePersonasToDB();
                }
                if (pack.appSettings) {
                    window.appSettings = pack.appSettings;
                    window.ensureLocalBackendModel();
                    await window.saveAppSettingsToDB();
                }
            }
        } catch (e) { console.warn('Starter pack load failed:', e); }
    }

    // ── Bootstrap ───────────────────────────────────────────────────────────
    async function init() {
        document.body.style.opacity = '1';
        applyBranding();
        try {
            await window.openDB();
            await Promise.all([
                window.loadCharactersFromDB(),
                window.loadPersonasFromDB(),
                window.loadAppSettingsFromDB()
            ]);
            window.populateModelSelector();
            await window.loadAndApplySettingsFromDB();
            if (!Object.keys(window.characters).length) {
                await loadStarterPack();
            }
            window.enforceResponsiveSettingLimits();
            window.renderCharacterList();
        } catch (err) {
            console.error(err);
            window.showCustomAlert('Could not load database. Please check browser permissions or try clearing site data.');
            return;
        }
        window.restoreLastSession();
        if (window.tutorialInit) window.tutorialInit();
        if (window.populateTtsVoices) window.populateTtsVoices();
        // Fire-and-forget silent server restore.
        if (window.restoreChatsFromServer) {
            window.restoreChatsFromServer({ silent: true }).catch(() => { /* swallow */ });
        }
    }

    // ── Wiring ──────────────────────────────────────────────────────────────
    function wire() {
        // Landing / home.
        on('new-character-btn', 'click', () => window.openEditorForNew());
        on('manage-personas-btn', 'click', () => window.openPersonaListModal());
        on('app-settings-btn', 'click', async () => { await window.loadAppSettingsFromDB(); window.openAppSettingsModal(); });
        on('import-btn', 'click', () => window.triggerImport());
        on('export-btn', 'click', () => window.handleExport());
        on('file-importer', 'change', (e) => window.handleFileImport(e));
        on('search-input', 'input', () => window.renderCharacterList());
        on('sort-select', 'change', (e) => { window.sortMode = e.target.value; window.renderCharacterList(); });
        document.querySelectorAll('.browse-tab').forEach((tab) =>
            tab.addEventListener('click', () => window.setBrowseFilter(tab.dataset.filter)));
        on('bulk-delete-btn', 'click', () => window.openBulkCharacterDeleteModal());
        on('archive-toggle-btn', 'click', () => window.toggleArchiveCollapse());

        // Grid + archive delegated clicks.
        ['character-list', 'archived-character-list', 'shelves-container'].forEach((id) => {
            const el = $(id);
            if (el) el.addEventListener('click', handleCardClick);
        });

        // Help dot.
        wireHelp();

        // Chat list screen.
        on('back-to-main-btn', 'click', () => window.showMainScreen());
        on('delete-character-btn-dashboard', 'click', () => window.handleDeleteCurrentCharacter());
        on('edit-character-btn', 'click', () => window.openEditorForEdit());
        on('copy-character-btn', 'click', () => window.handleCopyCharacter());
        on('start-new-chat-btn', 'click', () => window.openScenarioSelection());
        const sessionList = $('chat-session-list');
        if (sessionList) sessionList.addEventListener('click', handleSessionListClick);
        on('start-empty-chat-btn', 'click', () => { $('scenario-selection-modal').classList.add('hidden'); window.createNewChat(); });
        on('cancel-scenario-selection-btn', 'click', () => $('scenario-selection-modal').classList.add('hidden'));

        // Composer.
        on('chat-form', 'submit', (e) => { e.preventDefault(); window.handleChatSubmit('dialog'); });
        on('dialog-btn', 'click', (e) => { e.preventDefault(); window.handleChatSubmit('dialog'); });
        on('story-btn', 'click', (e) => { e.preventDefault(); window.handleChatSubmit('story'); });
        on('stop-stream-btn', 'click', () => window.abortStream());
        wireMessageInput();
        on('back-to-selection-btn', 'click', () => window.showCharacterSelection());

        // Group dropdown.
        const groupDropdown = $('group-char-dropdown');
        if (groupDropdown) groupDropdown.addEventListener('mousedown', (e) => {
            const item = e.target.closest('.group-char-dropdown-item');
            if (item) { e.preventDefault(); window.setActiveGroupParticipant(item.dataset.charId); }
        });
        on('group-char-bubble-dismiss', 'click', () => window.clearActiveGroupParticipant());
        const partIcons = $('participant-icon-list');
        if (partIcons) partIcons.addEventListener('click', (e) => {
            const wrap = e.target.closest('.participant-icon-wrapper');
            if (wrap) window.removeParticipant(wrap.dataset.charId);
        });
        on('add-participant-btn', 'click', () => window.openParticipantModal());
        on('participant-search-input', 'input', (e) => window.renderParticipantSelectionList(e.target.value));
        on('cancel-participant-selection-btn', 'click', () => $('participant-selection-modal').classList.add('hidden'));
        on('select-persona-btn', 'click', () => window.togglePersonaSelect());
        on('persona-search-input', 'input', (e) => window.renderPersonaSelectionList(e.target.value));
        on('cancel-persona-select-btn', 'click', () => $('persona-selection-modal').classList.add('hidden'));

        // Chat header tools.
        on('quick-swap-btn', 'click', () => window.openQuickSwapModal());
        on('quick-swap-search-input', 'input', () => window.openQuickSwapModal());
        on('cancel-quick-swap-btn', 'click', () => $('quick-swap-modal').classList.add('hidden'));
        wireMood();
        on('chat-memories-btn', 'click', () => window.openChatMemoriesModal());
        wireMemories();
        on('summarize-memories-btn', 'click', () => window.handleSummarizeMemories());
        wireScrollFab();
        wireParticles();
        wireMusic();

        // Chat window message actions.
        const chatWindow = $('chat-window');
        if (chatWindow) {
            chatWindow.addEventListener('click', handleMessageAction);
            chatWindow.addEventListener('dblclick', handleMessageDblClick);
            chatWindow.addEventListener('scroll', handleChatScroll);
        }
        document.addEventListener('keydown', handleChatKeydown);

        // Message editor.
        on('save-message-edit-btn', 'click', () => window.saveAndCloseMessageEditor());
        on('cancel-message-edit-btn', 'click', () => window.cancelMessageEditor());
        wireMessageEditorModal();

        // Settings panel.
        wireSettingsPanel();
        if (window.wireSettingListeners) window.wireSettingListeners();
        on('reset-settings-btn', 'click', () => window.resetAppSettingsDesign());

        // App settings modal.
        on('app-settings-form', 'submit', (e) => window.saveAppSettings(e));
        on('cancel-app-settings-btn', 'click', () => window.closeAppSettingsModal());
        on('add-model-btn', 'click', () => window.addModelEntry({}));
        on('reset-app-settings-btn', 'click', () => window.resetAppSettings());
        on('refresh-ollama-btn', 'click', () => window.fetchOllamaModels());
        on('load-openrouter-btn', 'click', () => window.loadOpenRouterModels());
        on('add-openrouter-model-btn', 'click', () => window.addOpenRouterModel());
        on('restore-chats-btn', 'click', () => window.restoreChatsFromServer({ silent: false }));
        wheelSwallow(['app-settings-modal', 'persona-editor-modal', 'persona-list-modal']);

        // Editor.
        wireEditor();

        // Personas.
        on('persona-list-search-input', 'input', (e) => window.renderPersonaList(e.target.value));
        on('close-persona-list-btn', 'click', () => $('persona-list-modal').classList.add('hidden'));
        on('create-new-persona-btn', 'click', () => window.openPersonaEditor());
        on('cancel-persona-edit-btn', 'click', () => window.closePersonaEditor());
        on('persona-form', 'submit', (e) => window.handlePersonaFormSubmit(e));
        on('upload-persona-avatar-btn', 'click', () => window.triggerPersonaUpload());
        ['persona-name', 'persona-description'].forEach((id) =>
            on(id, 'input', () => window.updatePersonaEditorTokenCount()));
        on('persona-description', 'input', (e) => window.autoResizeTextarea(e));

        // Reply suggestion buttons.
        ['reply-opt-1', 'reply-opt-2'].forEach((id) => {
            const b = $(id);
            if (b) b.addEventListener('mousedown', (e) => { e.preventDefault(); if (b.textContent && !b.classList.contains('reply-option-error') && !b.classList.contains('reply-option-loading')) window.pickReplyOption(b.textContent); });
        });

        // Tutorial.
        if (window.wireTutorial) window.wireTutorial();

        // Global.
        wireGlobal();
    }

    // ── Card click delegation ───────────────────────────────────────────────
    function handleCardClick(e) {
        const favBtn = e.target.closest('.favorite-btn');
        const archBtn = e.target.closest('.archive-btn');
        const card = e.target.closest('.character-card');
        if (!card) return;
        const id = card.dataset.charId;
        if (favBtn) { e.stopPropagation(); window.toggleFavorite(id); return; }
        if (archBtn) { e.stopPropagation(); window.toggleArchiveState(id); return; }
        window.showChatList(id);
    }

    function handleSessionListClick(e) {
        const open = e.target.closest('.chat-session-name');
        const rename = e.target.closest('.rename-chat-btn');
        const del = e.target.closest('.delete-chat-btn');
        if (rename) { window.renameChat(rename.dataset.chatId); return; }
        if (del) { window.deleteChat(del.dataset.chatId); return; }
        if (open) { window.startChat(window.currentCharacterId, open.dataset.chatId); }
    }

    // ── Message input ───────────────────────────────────────────────────────
    function wireMessageInput() {
        const input = $('message-input');
        if (!input) return;
        input.addEventListener('input', (e) => window.autoResizeTextarea(e));
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                window.handleChatSubmit('dialog');
            }
        });
        const onFocus = () => {
            window.showGroupCharDropdown && window.showGroupCharDropdown();
            window.showReplyOptionsDropdown && window.showReplyOptionsDropdown();
            const chat = currentChatSafe();
            if (window.runtimeFlags.replyOptionsEnabled && chat && chat.history.length &&
                chat.history[chat.history.length - 1].sender !== 'user') {
                window.generateReplyOptionsInBackground && window.generateReplyOptionsInBackground();
            }
        };
        input.addEventListener('focus', onFocus);
        input.addEventListener('click', onFocus);
        input.addEventListener('blur', () => setTimeout(() => window.hideGroupCharDropdown && window.hideGroupCharDropdown(), 200));
    }
    function currentChatSafe() {
        const c = window.characters[window.currentCharacterId];
        return c && c.chats ? c.chats[window.currentChatId] : null;
    }

    // ── Message actions ─────────────────────────────────────────────────────
    function handleMessageAction(e) {
        const bubble = e.target.closest('.message');
        if (!bubble) return;
        const id = bubble.dataset.messageId;
        if (e.target.closest('.delete-message-btn')) { window.handleDeleteMessage(id); return; }
        if (e.target.closest('.edit-message-btn')) { window.openMessageEditor(id); return; }
        if (e.target.closest('.regenerate-btn')) { window.handleRegenerate(id); return; }
        if (e.target.closest('.continue-btn')) { window.handleContinue(id); return; }
        if (e.target.closest('.prev-variant-btn')) { window.swipeVariant(id, -1); return; }
        if (e.target.closest('.next-variant-btn')) { window.swipeVariant(id, 1); return; }
        if (e.target.closest('.tts-btn')) {
            const chat = currentChatSafe();
            const m = chat && chat.history.find((x) => x.id === id);
            if (m) window.toggleTts(id, window.getMessageText(m));
            return;
        }
    }
    function handleMessageDblClick(e) {
        const part = e.target.closest('[data-edit-part="main"]');
        if (!part) return;
        const bubble = e.target.closest('.message');
        if (bubble) window.openMessageEditor(bubble.dataset.messageId);
    }
    function handleChatScroll(e) {
        const win = e.target;
        const nearBottom = win.scrollHeight - win.scrollTop - win.clientHeight < 50;
        win._autoScroll = nearBottom;
        const fab = $('scroll-top-fab');
        if (fab) fab.classList.toggle('visible', win.scrollTop > 400);
        if (window.currentCharacterId && window.currentChatId)
            localStorage.setItem('chatScrollPos:' + window.currentCharacterId + ':' + window.currentChatId, String(win.scrollTop));
    }
    function handleChatKeydown(e) {
        if ($('chat-screen').classList.contains('is-inactive')) return;
        const tag = (e.target.tagName || '').toLowerCase();
        if (tag === 'input' || tag === 'textarea' || e.target.isContentEditable) return;
        const chat = currentChatSafe();
        if (!chat) return;
        const lastAi = [...chat.history].reverse().find((m) => m.sender === 'ai');
        if (!lastAi) return;
        if (e.key === 'ArrowLeft') { e.preventDefault(); window.swipeVariant(lastAi.id, -1); }
        else if (e.key === 'ArrowRight') { e.preventDefault(); window.swipeVariant(lastAi.id, 1); }
    }

    // ── Message editor modal ────────────────────────────────────────────────
    function wireMessageEditorModal() {
        const modal = $('message-editor-modal');
        const ta = $('message-editor-textarea');
        if (ta) ta.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); window.saveAndCloseMessageEditor(); }
            else if (e.key === 'Escape') { window.cancelMessageEditor(); }
        });
        if (modal) modal.addEventListener('dblclick', (e) => { if (e.target === modal) window.saveAndCloseMessageEditor(); });
    }

    // ── Mood ────────────────────────────────────────────────────────────────
    function wireMood() {
        on('mood-btn', 'click', (e) => { e.stopPropagation(); const p = $('mood-picker'); if (p) p.classList.toggle('hidden'); });
        document.querySelectorAll('.mood-option').forEach((opt) =>
            opt.addEventListener('click', () => window.setMood(opt.dataset.mood)));
        document.addEventListener('click', (e) => {
            const picker = $('mood-picker');
            if (picker && !picker.classList.contains('hidden') &&
                !e.target.closest('#mood-picker') && !e.target.closest('#mood-btn')) picker.classList.add('hidden');
        });
    }

    // ── Memories ────────────────────────────────────────────────────────────
    function wireMemories() {
        on('save-memories-edit-btn', 'click', () => window.saveChatMemories());
        on('cancel-memories-edit-btn', 'click', () => window.closeChatMemoriesModal());
        const ta = $('chat-memories-textarea');
        if (ta) {
            ta.addEventListener('input', (e) => window.autoResizeTextarea(e));
            ta.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); window.saveChatMemories(); }
                else if (e.key === 'Escape') window.closeChatMemoriesModal();
            });
        }
        const modal = $('chat-memories-modal');
        if (modal) modal.addEventListener('dblclick', (e) => { if (e.target === modal) window.saveChatMemories(); });
    }

    // ── Scroll fab ──────────────────────────────────────────────────────────
    function wireScrollFab() {
        on('scroll-top-fab', 'click', () => { const w = $('chat-window'); if (w) w.scrollTo({ top: 0, behavior: 'smooth' }); });
    }

    // ── Particles ───────────────────────────────────────────────────────────
    function wireParticles() {
        on('particle-btn', 'click', () => window.openParticlePicker());
        document.querySelectorAll('.particle-option-btn').forEach((b) =>
            b.addEventListener('click', () => window.pickParticleEffect(b.dataset.effect)));
        on('particle-intensity-slider', 'input', (e) => window.setParticleIntensity(parseInt(e.target.value, 10)));
        on('close-particle-picker-btn', 'click', () => window.closeParticlePicker());
        const modal = $('particle-picker-modal');
        if (modal) modal.addEventListener('click', (e) => { if (e.target === modal) window.closeParticlePicker(); });
    }

    // ── Music ───────────────────────────────────────────────────────────────
    function wireMusic() {
        on('music-btn', 'click', (e) => { e.stopPropagation(); const p = $('music-panel'); if (p) p.classList.toggle('hidden'); });
        on('music-play-btn', 'click', () => window.togglePlay());
        on('music-stop-btn', 'click', () => window.clearMusicForCharacter());
        document.addEventListener('click', (e) => {
            const panel = $('music-panel');
            if (panel && !panel.classList.contains('hidden') &&
                !e.target.closest('#music-panel') && !e.target.closest('#music-btn')) panel.classList.add('hidden');
        });
    }

    // ── Settings panel ──────────────────────────────────────────────────────
    function wireSettingsPanel() {
        on('settings-btn', 'click', (e) => { e.stopPropagation(); const p = $('settings-panel'); if (p) p.classList.toggle('hidden'); });
        document.querySelectorAll('#settings-panel .accordion-header').forEach((h) =>
            h.addEventListener('click', () => {
                const section = h.closest('.accordion-section');
                const wasOpen = section.classList.contains('open');
                document.querySelectorAll('#settings-panel .accordion-section').forEach((s) => s.classList.remove('open'));
                if (!wasOpen) section.classList.add('open');
            }));
        document.addEventListener('click', (e) => {
            const panel = $('settings-panel');
            if (panel && !panel.classList.contains('hidden') &&
                !e.target.closest('#settings-panel') && !e.target.closest('#settings-btn')) panel.classList.add('hidden');
        });
    }

    // ── Editor ──────────────────────────────────────────────────────────────
    function wireEditor() {
        on('character-form', 'submit', (e) => window.handleFormSubmit(e));
        on('save-edit-btn-top', 'click', () => window.handleFormSubmit());
        on('cancel-edit-btn-top', 'click', () => window.closeEditor());
        on('cancel-edit-btn', 'click', () => window.closeEditor());
        on('type-character', 'change', () => window.updateEditorForType('character'));
        on('type-world', 'change', () => window.updateEditorForType('world'));
        on('world-char-search', 'input', () => window.renderWorldPicker());
        on('add-scenario-btn', 'click', () => { window.createScenarioInput('', ''); window.updateEditorTokenCount(); });
        on('ai-scenario-btn', 'click', () => window.handleAIGenerateScenario());
        on('ai-generate-char-btn', 'click', () => window.handleAIGenerateCharacter());
        on('upload-avatar-btn', 'click', () => window.triggerUpload('avatar'));
        on('upload-bg-btn', 'click', () => window.triggerUpload('background'));
        on('image-uploader', 'change', (e) => window.handleImageUpload(e));
        ['card-name', 'chat-name', 'char-description', 'char-lore', 'char-instructions',
            'char-reminder', 'char-narrator-reminder', 'char-tags'].forEach((id) => {
                on(id, 'input', (e) => { window.autoResizeTextarea(e); window.updateEditorTokenCount(); });
            });
        // Live preview avatar/background.
        on('char-avatar', 'input', (e) => { if (e.target.value && !($('type-world') && $('type-world').checked)) window.previewEditorAvatar(window.getImageUrl(e.target.value)); });
        on('char-background', 'input', (e) => { if (e.target.value) window.applyBackground($('chat-list-screen'), e.target.value); });
    }

    // ── Wheel swallow on modal backdrops ────────────────────────────────────
    function wheelSwallow(ids) {
        ids.forEach((id) => {
            const el = $(id);
            if (el) el.addEventListener('wheel', (e) => { if (e.target === el) e.preventDefault(); }, { passive: false });
        });
    }

    // ── Help dot ────────────────────────────────────────────────────────────
    function wireHelp() {
        const dot = $('help-notification-dot');
        const tip = $('help-tooltip');
        if (!localStorage.getItem('hasSeenHelpNotification')) {
            if (dot) dot.classList.remove('hidden');
            if (tip) tip.classList.remove('hidden');
        }
        on('help-btn', 'click', () => {
            localStorage.setItem('hasSeenHelpNotification', '1');
            if (dot) dot.classList.add('hidden');
            if (tip) tip.classList.add('hidden');
        });
    }

    // ── Global ──────────────────────────────────────────────────────────────
    function wireGlobal() {
        document.body.addEventListener('click', function lazyAudio() {
            if (!window.audioCtx) {
                try { window.audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { /* ignore */ }
            }
        }, { once: false });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'f' || e.key === 'F') {
                const tag = (e.target.tagName || '').toLowerCase();
                if (tag === 'input' || tag === 'textarea' || e.target.isContentEditable) return;
                if (document.fullscreenElement) document.exitFullscreen();
                else document.documentElement.requestFullscreen && document.documentElement.requestFullscreen();
            }
        });
        document.addEventListener('fullscreenchange', () => {
            document.body.classList.toggle('fullscreen-active', !!document.fullscreenElement);
            window.dispatchEvent(new Event('resize'));
        });

        // Global tooltip for .setting-info-icon[data-tooltip].
        const tooltip = $('global-setting-tooltip');
        document.addEventListener('mouseover', (e) => {
            const icon = e.target.closest && e.target.closest('.setting-info-icon[data-tooltip]');
            if (icon && tooltip) {
                tooltip.textContent = icon.dataset.tooltip;
                const r = icon.getBoundingClientRect();
                tooltip.style.left = r.left + 'px';
                tooltip.style.top = (r.bottom + 6) + 'px';
                tooltip.classList.add('visible');
            }
        });
        document.addEventListener('mouseout', (e) => {
            if (e.target.closest && e.target.closest('.setting-info-icon[data-tooltip]') && tooltip)
                tooltip.classList.remove('visible');
        });

        // Responsive limit listeners.
        window.matchMedia('(max-width: ' + window.MOBILE_BREAKPOINT + 'px)')
            .addEventListener('change', () => window.enforceResponsiveSettingLimits());
        window.addEventListener('resize', () => window.enforceResponsiveSettingLimits());
    }

    // ── Go ──────────────────────────────────────────────────────────────────
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => { wire(); init(); });
    } else {
        wire(); init();
    }

    window.loadStarterPack = loadStarterPack;
    window.App = window.App || {};
})();
