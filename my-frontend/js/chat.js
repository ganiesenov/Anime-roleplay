/* chat.js — chat core: open/create/switch, rendering, streaming, edit/delete,
 * memories, mood, system-prompt assembly, token estimate, server restore. */
(function () {
    'use strict';
    function $(id) { return document.getElementById(id); }

    // ── Helpers for current chat ────────────────────────────────────────────
    function curChar() { return window.characters[window.currentCharacterId]; }
    function curChat() {
        const c = curChar();
        return c && c.chats ? c.chats[window.currentChatId] : null;
    }
    function displayName(char) { return (char && (char.chatName || char.name)) || 'User'; }
    function personaName() {
        const chat = curChat();
        if (chat && chat.activePersonaId && window.personas[chat.activePersonaId])
            return window.personas[chat.activePersonaId].name || 'User';
        return 'User';
    }

    function applyCharPlaceholder(text, name) {
        return String(text || '').replace(/\{\{char\}\}/g, name || 'Character');
    }
    function applyUserPlaceholder(text, name) {
        return String(text || '').replace(/\{\{user\}\}/g, name || 'User');
    }
    function expandPlaceholders(text, charName, userName) {
        return applyUserPlaceholder(applyCharPlaceholder(text, charName), userName);
    }

    // ── Chat session list (rename/delete) ───────────────────────────────────
    async function renameChat(chatId) {
        const char = curChar();
        if (!char || !char.chats[chatId]) return;
        const name = await window.showCustomPrompt('Rename chat:', char.chats[chatId].name || '');
        if (name == null) return;
        char.chats[chatId].name = name.trim() || char.chats[chatId].name;
        await window.saveSingleCharacterToDB(char);
        window.renderChatSessionList(char);
    }
    async function deleteChat(chatId) {
        const char = curChar();
        if (!char || !char.chats[chatId]) return;
        const ok = await window.showCustomConfirm('Delete this chat? This cannot be undone.', true);
        if (!ok) return;
        delete char.chats[chatId];
        await window.saveSingleCharacterToDB(char);
        window.renderChatSessionList(char);
    }

    // ── Open chat ───────────────────────────────────────────────────────────
    function startChat(charId, chatId) {
        const char = window.characters[charId];
        if (!char || !char.chats || !char.chats[chatId]) { window.showChatList(charId); return; }
        const chat = char.chats[chatId];

        // Cancel pending reply suggestions, clear group participant.
        window.replyOptionsReqId++;
        if (window.hideReplyOptionsDropdown) window.hideReplyOptionsDropdown();
        if (window.clearActiveGroupParticipant) window.clearActiveGroupParticipant();

        window.currentCharacterId = charId;
        window.currentChatId = chatId;
        localStorage.setItem('activeCharacterId', charId);
        localStorage.setItem('activeChatId', chatId);

        // Backfill.
        if (!Array.isArray(chat.participants)) chat.participants = [charId];
        if (chat.activePersonaId === undefined) chat.activePersonaId = null;
        if (chat.memories == null) chat.memories = '';
        if (!Array.isArray(chat.history)) chat.history = [];
        if (chat.mood === undefined) chat.mood = null;

        window.activateScreen('chat-screen');
        window.deactivateScreen('character-selection-screen');
        window.deactivateScreen('chat-list-screen');

        // Header.
        const isWorld = char.type === 'world';
        const avatar = $('chat-avatar');
        const ph = $('chat-avatar-placeholder');
        const imgSrc = isWorld ? char.background : char.avatar;
        if (imgSrc && !isWorld) {
            if (avatar) { avatar.src = window.getImageUrl(imgSrc); avatar.classList.remove('hidden'); }
            if (ph) ph.classList.add('hidden');
        } else {
            if (avatar) { avatar.src = ''; avatar.classList.add('hidden'); }
            if (ph) { ph.textContent = isWorld ? '🌍' : '👤'; ph.classList.remove('hidden'); }
        }
        const nameEl = $('chat-character-name');
        if (nameEl) nameEl.textContent = char.name || '';
        const badge = $('chat-world-badge');
        if (badge) badge.classList.toggle('hidden', !isWorld);
        window.applyBackground($('chat-screen'), char.background);

        // Render messages.
        const win = $('chat-window');
        if (win) win.innerHTML = '';
        chat.history.forEach((m) => renderMessage(m, char, chat));

        if (window.renderParticipantIcons) window.renderParticipantIcons();
        updateMoodButton();
        updateMemoriesButton();
        updateTokenCount();
        if (window.updateParticleButton) window.updateParticleButton();

        // Particles + music.
        if (window.startParticles && char.particleEffect && char.particleEffect !== 'none')
            window.startParticles(char.particleEffect, char.particleIntensityLevel);
        else if (window.stopParticles) window.stopParticles();
        startCharacterMusic(char);

        // Scroll.
        if (win) {
            if (win._scrollToBottomNext) {
                win.scrollTop = win.scrollHeight;
                win._scrollToBottomNext = false;
            } else {
                const saved = localStorage.getItem('chatScrollPos:' + charId + ':' + chatId) ||
                    localStorage.getItem('chatScrollPos');
                win.scrollTop = saved ? parseInt(saved, 10) : win.scrollHeight;
            }
            win._autoScroll = true;
        }

        if (window.tutorialOnScreenChange) window.tutorialOnScreenChange('chat');
    }

    function startCharacterMusic(char) {
        const stored = localStorage.getItem('userMusicUrl:' + char.id);
        const url = stored || char.musicUrl;
        if (url && window.playMusicUrl) {
            const inp = $('music-url-input');
            if (inp) inp.value = url;
            window.playMusicUrl(url, true);
        }
    }

    // ── New chat ────────────────────────────────────────────────────────────
    async function createNewChat(scenarioText, scenarioName) {
        const char = curChar();
        if (!char) return;
        const now = new Date();
        const dateStr = now.toLocaleDateString() + ', ' + now.toLocaleTimeString();
        const id = 'chat-' + Date.now();
        const isWorld = char.type === 'world';
        const participants = isWorld ? [char.id].concat(char.characterIds || []) : [char.id];
        const chat = {
            id: id,
            name: (scenarioName ? scenarioName + ' - ' : 'New Chat - ') + dateStr,
            history: [],
            memories: '',
            participants: participants,
            activePersonaId: null,
            mood: null
        };
        if (scenarioText) {
            chat.history.push({
                id: window.genMessageId(true),
                sender: 'ai',
                type: isWorld ? 'story' : 'dialog',
                speakerId: char.id,
                activeVariant: 0,
                variations: [{ main: expandPlaceholders(scenarioText, displayName(char), personaName()), think: null }]
            });
        }
        char.chats[id] = chat;
        await window.saveSingleCharacterToDB(char);
        const win = $('chat-window');
        if (win) win._scrollToBottomNext = true;
        startChat(char.id, id);
    }

    // ── Scenario selection ──────────────────────────────────────────────────
    function openScenarioSelection() {
        const char = curChar();
        if (!char) return;
        if (!char.scenarios || !char.scenarios.length) { createNewChat(); return; }
        const modal = $('scenario-selection-modal');
        const list = $('scenario-selection-list');
        if (!modal || !list) { createNewChat(); return; }
        list.innerHTML = '';
        char.scenarios.forEach((sc) => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'scenario-select-btn participant-option-btn';
            btn.innerHTML = '<strong>' + window.escapeHtml(sc.name || 'Scenario') + '</strong><br>' +
                window.escapeHtml((sc.text || '').slice(0, 120));
            btn.addEventListener('click', () => {
                modal.classList.add('hidden');
                createNewChat(sc.text, sc.name);
            });
            list.appendChild(btn);
        });
        modal.classList.remove('hidden');
    }

    // ── Message rendering ───────────────────────────────────────────────────
    function speakerChar(message, hostChar) {
        if (message.speakerId && window.characters[message.speakerId]) return window.characters[message.speakerId];
        return hostChar;
    }

    function renderMessage(message, char, chat) {
        const win = $('chat-window');
        if (!win) return;
        const wrapper = document.createElement('div');

        if (message.sender === 'user') {
            const persona = chat.activePersonaId && window.personas[chat.activePersonaId];
            if (persona && persona.avatar) {
                wrapper.className = 'user-message-container';
                const av = document.createElement('div');
                av.className = 'message-avatar';
                const img = document.createElement('img');
                img.src = window.getImageUrl(persona.avatar);
                img.addEventListener('error', () => { av.innerHTML = '<span class="placeholder-icon">👤</span>'; });
                av.appendChild(img);
                wrapper.appendChild(av);
                const bubble = buildMessageBubble(message, char, chat, 'user-message');
                wrapper.appendChild(bubble);
            } else {
                const bubble = buildMessageBubble(message, char, chat, 'user-message');
                wrapper.className = '';
                wrapper.appendChild(bubble);
            }
        } else {
            wrapper.className = 'ai-message-container';
            const isStory = message.type === 'story';
            if (!isStory) {
                const sp = speakerChar(message, char);
                const av = document.createElement('div');
                av.className = 'message-avatar effect-container';
                if (sp && sp.avatar) {
                    const img = document.createElement('img');
                    img.src = window.getImageUrl(sp.avatar);
                    img.addEventListener('error', () => { av.innerHTML = '<span class="placeholder-icon">👤</span>'; });
                    av.appendChild(img);
                } else {
                    av.innerHTML = '<span class="placeholder-icon">👤</span>';
                }
                wrapper.appendChild(av);
            }
            const bubble = buildMessageBubble(message, char, chat, 'ai-message' + (isStory ? ' story-message' : ''));
            wrapper.appendChild(bubble);
        }
        win.appendChild(wrapper);
        if (win._autoScroll !== false) win.scrollTop = win.scrollHeight;
    }

    function getMessageText(message) {
        if (message.sender === 'user') return message.main || '';
        const v = message.variations && message.variations[message.activeVariant || 0];
        return v ? (v.main || '') : '';
    }
    function getMessageThink(message) {
        if (message.sender === 'user') return '';
        const v = message.variations && message.variations[message.activeVariant || 0];
        return v ? (v.think || '') : '';
    }

    function buildMessageBubble(message, char, chat, cls) {
        const bubble = document.createElement('div');
        bubble.className = 'message ' + cls;
        bubble.dataset.messageId = message.id;

        // Think block.
        if (message.sender === 'ai') {
            const think = getMessageThink(message);
            const details = document.createElement('details');
            details.className = 'think-block' + (think && window.runtimeFlags.thinkEnabled ? '' : ' hidden');
            const summary = document.createElement('summary');
            summary.className = 'think-block-summary';
            summary.textContent = 'Show Thoughts';
            const content = document.createElement('div');
            content.className = 'think-block-content';
            content.innerHTML = think ? ('&lt;think&gt;<br>' + window.escapeHtml(think).replace(/\n/g, '<br>') + '<br>&lt;/think&gt;') : '';
            details.appendChild(summary);
            details.appendChild(content);
            bubble.appendChild(details);
        }

        // Main content.
        const main = document.createElement('div');
        main.className = 'main-content';
        main.dataset.editPart = 'main';
        const text = getMessageText(message);
        if (message.isStreaming && text === '...') {
            main.innerHTML = '<span class="typing-dots"><span class="typing-dot"></span><span class="typing-dot"></span><span class="typing-dot"></span></span>';
        } else {
            main.innerHTML = window.formatSubString(window.sanitizeModelText(text));
        }
        bubble.appendChild(main);

        // Action group.
        const actions = document.createElement('div');
        actions.className = 'message-action-group';
        const del = document.createElement('button');
        del.className = 'delete-message-btn';
        del.title = 'Delete';
        del.textContent = '🗑️';
        const edit = document.createElement('button');
        edit.className = 'edit-message-btn';
        edit.title = 'Edit';
        edit.textContent = '✏️';
        actions.appendChild(del);
        actions.appendChild(edit);
        if (message.sender === 'ai' && window.speechSynthesis) {
            const tts = document.createElement('button');
            tts.className = 'tts-btn';
            tts.title = 'Read aloud';
            tts.textContent = '🔊';
            actions.appendChild(tts);
        }
        bubble.appendChild(actions);

        // AI controls.
        if (message.sender === 'ai') {
            const controls = document.createElement('div');
            controls.className = 'message-controls' + (message.isStreaming ? ' is-streaming' : '');
            if (message.isStreaming) bubble.classList.add('msg-streaming');
            const n = (message.variations || []).length;
            if (n > 1) {
                const prev = document.createElement('button');
                prev.className = 'prev-variant-btn';
                prev.textContent = '‹';
                prev.disabled = (message.activeVariant || 0) <= 0;
                const counter = document.createElement('span');
                counter.className = 'variant-counter';
                counter.textContent = ((message.activeVariant || 0) + 1) + '/' + n;
                const next = document.createElement('button');
                next.className = 'next-variant-btn';
                next.textContent = '›';
                next.disabled = (message.activeVariant || 0) >= n - 1;
                controls.appendChild(prev);
                controls.appendChild(counter);
                controls.appendChild(next);
            }
            const regen = document.createElement('button');
            regen.className = 'regenerate-btn';
            regen.textContent = '🔄';
            regen.title = 'Regenerate';
            regen.disabled = !!message.isStreaming;
            const cont = document.createElement('button');
            cont.className = 'continue-btn';
            cont.textContent = '➡️';
            cont.title = 'Continue';
            cont.disabled = !!message.isStreaming;
            controls.appendChild(regen);
            controls.appendChild(cont);
            bubble.appendChild(controls);
        }
        return bubble;
    }

    function updateSingleMessageView(messageId) {
        const chat = curChat();
        const char = curChar();
        if (!chat) return;
        const message = chat.history.find((m) => m.id === messageId);
        if (!message) return;
        const el = document.querySelector('.message[data-message-id="' + messageId + '"]');
        if (!el) return;
        const cls = el.className.replace(/^message /, '');
        const fresh = buildMessageBubble(message, char, chat, cls);
        el.replaceWith(fresh);
    }

    // ── Sanitize re-export ──────────────────────────────────────────────────

    // ── System prompt assembly ──────────────────────────────────────────────
    function selectedModel() {
        const sel = $('model-select');
        const id = sel ? sel.value : window.runtimeFlags.model;
        return (window.appSettings.availableModels || []).find((m) => m.id === id) ||
            (window.appSettings.availableModels || [])[0] || { id: id };
    }

    function buildSystemPrompt(char, chat, type, targetCharId) {
        const sections = [];
        const cName = displayName(char);
        const uName = personaName();
        const exp = (t) => expandPlaceholders(t, cName, uName);
        const model = selectedModel();

        if (model && model.instructions) sections.push('--- GLOBAL AI INSTRUCTIONS ---\n' + exp(model.instructions));

        if (chat.activePersonaId && window.personas[chat.activePersonaId]) {
            const p = window.personas[chat.activePersonaId];
            sections.push('--- EXACT USER PERSONA ---\n' + (p.name || 'User') + (p.description ? '\n' + exp(p.description) : ''));
        }

        const isWorld = char.type === 'world';
        if (isWorld) {
            if (char.description) sections.push('--- WORLD CONTEXT ---\n' + exp(char.description));
            if (char.lore) sections.push('--- WORLD LORE & HISTORY ---\n' + exp(char.lore));
            if (char.reminder) sections.push('--- WORLD RULES (CRITICAL - obey at all times) ---\n' + exp(char.reminder));
            const target = targetCharId && window.characters[targetCharId];
            if (target && target.id !== char.id) {
                sections.push("Respond only as '" + displayName(target) + "'.");
                if (target.instructions) sections.push('--- CHARACTER AI INSTRUCTIONS ---\n' + exp(target.instructions));
                if (target.description) sections.push('--- CHARACTER DESCRIPTION ---\n' + exp(target.description));
                if (target.lore) sections.push('--- LORE / BACKGROUND KNOWLEDGE ---\n' + exp(target.lore));
            } else {
                sections.push('You are an omniscient third-person narrator describing this world and its inhabitants.');
                const members = (char.characterIds || []).map((id) => window.characters[id]).filter(Boolean);
                if (members.length) {
                    const block = members.map((m) => displayName(m) + ': ' + exp(m.description || '')).join('\n\n');
                    sections.push('--- CHARACTERS IN THIS WORLD ---\n' + block);
                }
            }
        } else if (type === 'story') {
            sections.push('You are an omniscient third-person narrator. Describe the scene and events vividly.');
            const participants = (chat.participants || []).map((id) => window.characters[id]).filter(Boolean);
            if (participants.length) {
                const block = participants.map((m) => displayName(m) + ': ' + exp(m.description || '')).join('\n\n');
                sections.push('--- CHARACTERS IN SCENE ---\n' + block);
            }
            if (char.lore) sections.push('--- LORE / BACKGROUND KNOWLEDGE ---\n' + exp(char.lore));
        } else {
            const participants = (chat.participants || []).map((id) => window.characters[id]).filter(Boolean);
            if (participants.length > 1) {
                const block = participants.map((m) => displayName(m) + ': ' + exp(m.description || '')).join('\n\n');
                sections.push('--- CHARACTERS IN SCENE ---\n' + block);
                const target = targetCharId && window.characters[targetCharId];
                if (target) sections.push("Respond only as '" + displayName(target) + "'.");
            }
            const speaker = (targetCharId && window.characters[targetCharId]) || char;
            if (speaker.instructions) sections.push('--- CHARACTER AI INSTRUCTIONS ---\n' + exp(speaker.instructions));
            if (speaker.description) sections.push('--- CHARACTER DESCRIPTION ---\n' + exp(speaker.description));
            if (speaker.lore) sections.push('--- LORE / BACKGROUND KNOWLEDGE ---\n' + exp(speaker.lore));
        }

        if (chat.mood) {
            sections.push('--- CHARACTER CURRENT MOOD (IMPORTANT) ---\n' + cName + ' is currently feeling ' + chat.mood + '.');
        }
        if (chat.memories && chat.memories.trim()) {
            sections.push('--- CHAT MEMORIES (HIGH PRIORITY - always honor these) ---\n' + exp(chat.memories));
        }
        const rl = window.runtimeFlags.replyLength;
        const rlMap = { short: '3-4', medium: '6-7', long: '9-10', verylong: '12-13' };
        if (rlMap[rl]) sections.push('--- REPLY LENGTH ---\nWrite roughly ' + rlMap[rl] + ' sentences.');

        return sections.join('\n\n');
    }

    function buildReminder(char, type) {
        const model = selectedModel();
        const parts = [];
        if (type === 'story') {
            if (model && model.narratorReminder) parts.push(model.narratorReminder);
            if (char.narratorReminder) parts.push(char.narratorReminder);
        } else {
            if (model && model.reminder) parts.push(model.reminder);
            if (char.reminder) parts.push(char.reminder);
        }
        return parts.filter(Boolean).join('\n');
    }

    function moodDirective(chat, char) {
        if (!chat.mood) return '';
        const cName = displayName(char);
        return '[MOOD — TOP PRIORITY: right now ' + cName + ' is feeling ' + chat.mood +
            '. Make this emotion unmistakable in this reply.]';
    }

    function buildMessagesArray(char, chat, type, targetCharId, lastUserText) {
        const cName = displayName(char);
        const uName = personaName();
        const sys = buildSystemPrompt(char, chat, type, targetCharId);
        const messages = [{ role: 'system', content: sys }];
        const multi = (chat.participants || []).length > 1;

        // Build the mapped history. When lastUserText is provided we append an
        // augmented user turn at the end; to avoid duplicating a just-pushed user
        // message we drop a single trailing user message from the mapped history.
        let history = chat.history.filter((m) => !m.isStreaming);
        if (lastUserText != null && history.length && history[history.length - 1].sender === 'user') {
            history = history.slice(0, -1);
        }
        history.forEach((m) => {
            const role = m.sender === 'user' ? 'user' : 'assistant';
            let text = getMessageText(m);
            if (multi) {
                const spk = m.sender === 'user' ? uName : displayName(speakerChar(m, char));
                text = spk + ': ' + text;
            }
            messages.push({ role: role, content: text });
        });
        // Augment last user content.
        if (lastUserText != null) {
            const reminder = buildReminder(char, type);
            let content = lastUserText;
            if (reminder) content += '\n[' + reminder + ']';
            const md = moodDirective(chat, char);
            if (md) content += md;
            messages.push({ role: 'user', content: expandPlaceholders(content, cName, uName) });
        }
        return messages;
    }

    // ── Endpoint / request ──────────────────────────────────────────────────
    function isLocalUrl(url) {
        try {
            const u = new URL(url);
            const h = u.hostname;
            if (h === 'localhost' || h === '127.0.0.1' || h === '::1') return true;
            if (/^10\./.test(h)) return true;
            if (/^192\.168\./.test(h)) return true;
            if (/^172\.(1[6-9]|2\d|3[01])\./.test(h)) return true;
            return false;
        } catch (e) { return false; }
    }

    function modelTargetUrl(model) {
        return (model && model.targetApiUrl) || window.DEFAULT_API_URL;
    }

    function buildHeaders(model, url) {
        const headers = { 'Content-Type': 'application/json' };
        if (!isLocalUrl(url)) {
            const key = (model && model.apiKey) || window.appSettings.apiKey || '';
            if (key) headers['Authorization'] = 'Bearer ' + key;
            if (url.indexOf('openrouter') !== -1) {
                headers['HTTP-Referer'] = location.origin || 'https://aria.local';
                headers['X-Title'] = 'Aria';
            }
        }
        return headers;
    }

    async function streamCompletion(messages, opts) {
        opts = opts || {};
        const model = selectedModel();
        const url = modelTargetUrl(model);
        const tempEl = $('temperature-slider');
        const temperature = tempEl ? parseFloat(tempEl.value) : 0.7;
        const body = {
            model: model.id,
            messages: messages,
            temperature: temperature,
            top_p: 0.95,
            stream: true,
            character_id: window.currentCharacterId,
            chat_id: window.currentChatId,
            options: { num_ctx: (model.numCtx || 131072), top_p: 0.95 }
        };
        const resp = await fetch(url, {
            method: 'POST',
            headers: buildHeaders(model, url),
            body: JSON.stringify(body),
            signal: opts.signal
        });
        if (!resp.ok) {
            const txt = await resp.text().catch(() => '');
            throw new Error('HTTP ' + resp.status + (txt ? ': ' + txt : ''));
        }
        const reader = resp.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop();
            for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed.startsWith('data:')) continue;
                const payload = trimmed.slice(5).trim();
                if (payload === '[DONE]') return;
                try {
                    const json = JSON.parse(payload);
                    const delta = json.choices && json.choices[0] && json.choices[0].delta;
                    if (delta) {
                        if (delta.content) opts.onContent && opts.onContent(delta.content);
                        if (delta.reasoning) opts.onReasoning && opts.onReasoning(delta.reasoning);
                    }
                } catch (e) { /* skip malformed */ }
            }
        }
    }

    // ── Notification sound ──────────────────────────────────────────────────
    function playChime() {
        if (!window.runtimeFlags.soundEnabled) return;
        if (!window.audioCtx) return;
        try {
            const ctx = window.audioCtx;
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.frequency.value = 659.26;
            osc.connect(gain); gain.connect(ctx.destination);
            gain.gain.setValueAtTime(0.0001, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + 0.05);
            gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.5);
            osc.start();
            osc.stop(ctx.currentTime + 0.5);
        } catch (e) { /* ignore */ }
    }

    // ── Send a message ──────────────────────────────────────────────────────
    async function handleChatSubmit(mode) {
        const char = curChar();
        const chat = curChat();
        if (!char || !chat) return;
        const type = mode === 'story' ? 'story' : 'dialog';
        const input = $('message-input');
        const raw = input ? input.value : '';
        if (input) { input.value = ''; window.autoResizeTextarea(input); }
        if (window.hideReplyOptionsDropdown) window.hideReplyOptionsDropdown();
        hideUndoFab();

        // Target char (group participant).
        let targetCharId = char.id;
        if (window.activeGroupParticipantId && window.characters[window.activeGroupParticipantId])
            targetCharId = window.activeGroupParticipantId;

        const text = raw.trim();
        let lastUserText;
        if (text) {
            const userMsg = { id: window.genMessageId(), sender: 'user', main: text };
            chat.history.push(userMsg);
            renderMessage(userMsg, char, chat);
            lastUserText = text;
        } else {
            if (!chat.history.length) {
                lastUserText = 'Introduce yourself and start the roleplay in an engaging way.';
            } else {
                const last = chat.history[chat.history.length - 1];
                lastUserText = last.sender === 'ai'
                    ? 'Continue the scene with new content, do not repeat previous text.'
                    : 'Continue the roleplay.';
            }
        }

        // Placeholder AI message.
        const aiMsg = {
            id: window.genMessageId(),
            sender: 'ai',
            type: type,
            speakerId: targetCharId,
            activeVariant: 0,
            variations: [{ main: '...', think: null }],
            isStreaming: true,
            streamingVariant: 0
        };
        chat.history.push(aiMsg);
        renderMessage(aiMsg, char, chat);
        const win = $('chat-window');
        if (win) { win._autoScroll = true; win.scrollTop = win.scrollHeight; }
        await window.saveSingleCharacterToDB(char);
        setSendButtons(false);

        const messages = buildMessagesArray(char, chat, type, targetCharId, lastUserText);
        await runStream(aiMsg, messages, char, chat, { type: type });
    }

    function setSendButtons(enabled) {
        const dialog = $('dialog-btn'), story = $('story-btn'), stop = $('stop-stream-btn'), loading = $('loading-indicator');
        if (dialog) dialog.disabled = !enabled;
        if (story) story.disabled = !enabled;
        if (stop) stop.classList.toggle('hidden', enabled);
        if (loading) loading.classList.toggle('hidden', enabled);
    }

    // Core streaming runner with retry, timers, think split.
    async function runStream(aiMsg, messages, char, chat, opts) {
        opts = opts || {};
        // Preempt a background auto-summary so the user's turn isn't queued behind
        // it on a single local model.
        if (window._autoSummaryController) {
            try { window._autoSummaryController.abort(); } catch (e) { /* ignore */ }
        }
        const variantIndex = aiMsg.streamingVariant != null ? aiMsg.streamingVariant : aiMsg.activeVariant;
        const controller = new AbortController();
        window.currentStreamController = controller;

        const bubble = () => document.querySelector('.message[data-message-id="' + aiMsg.id + '"]');
        let mainAcc = '';
        let reasonAcc = '';
        let firstChunk = false;
        let seed = (opts.continueSeed || '');

        // Safety timers.
        let t20 = setTimeout(() => { if (!mainAcc) setBubbleMain(aiMsg, 'Connecting to AI Model - Please wait or regenerate the message.'); }, 20000);
        let t70 = setTimeout(() => { if (!mainAcc) setBubbleMain(aiMsg, 'The AI provider may be experiencing issues, please wait or regenerate.'); }, 70000);

        const updateView = () => {
            const split = window.splitThink(mainAcc);
            const main = (seed ? seed + ' ' : '') + (split.main != null ? split.main : mainAcc);
            const think = split.think || reasonAcc;
            const v = aiMsg.variations[variantIndex];
            if (v) { v.main = main; v.think = think || null; }
            const el = bubble();
            if (!el) return;
            const mc = el.querySelector('.main-content');
            // Display-only: provisionally close dangling * / " so partial tokens
            // render styled instead of flashing a raw delimiter. Stored v.main stays raw.
            if (mc) mc.innerHTML = window.formatSubString(window.balanceInlineMarkup(window.sanitizeModelText(main || '')));
            const tb = el.querySelector('.think-block');
            const tc = el.querySelector('.think-block-content');
            if (tb && tc) {
                if (think && window.runtimeFlags.thinkEnabled) {
                    tb.classList.remove('hidden');
                    tc.innerHTML = '&lt;think&gt;<br>' + window.escapeHtml(think).replace(/\n/g, '<br>') + '<br>&lt;/think&gt;';
                } else { tb.classList.add('hidden'); }
            }
            const win = $('chat-window');
            if (win && win._autoScroll !== false) win.scrollTop = win.scrollHeight;
        };

        // Coalesce per-chunk renders into one paint per frame (~60fps) so a fast
        // token stream doesn't re-parse + re-layout the whole bubble on every delta.
        let rafPending = false;
        let finished = false;
        const raf = window.requestAnimationFrame
            ? window.requestAnimationFrame.bind(window)
            : (fn) => setTimeout(fn, 16);
        const scheduleView = () => {
            if (rafPending || finished) return;
            rafPending = true;
            raf(() => { rafPending = false; if (!finished) updateView(); });
        };

        let attempts = 0;
        let success = false;
        let lastError = null;
        const startedAt = Date.now();
        while (attempts < 90 && !success) {
            attempts++;
            mainAcc = ''; reasonAcc = '';
            try {
                await streamCompletion(messages, {
                    signal: controller.signal,
                    onContent: (c) => {
                        if (!firstChunk) { firstChunk = true; clearTimeout(t20); clearTimeout(t70); }
                        mainAcc += c;
                        scheduleView();
                    },
                    onReasoning: (r) => { reasonAcc += r; scheduleView(); }
                });
                if (mainAcc.trim() || reasonAcc.trim()) { success = true; }
                else { await sleep(500); } // empty: retry
            } catch (err) {
                lastError = err;
                if (controller.signal.aborted) break;
                const msg = String(err && err.message || err);
                if (/429|rate.?limit|quota/i.test(msg)) {
                    if (Date.now() - startedAt > 20000) setBubbleMain(aiMsg, 'Rate-limited, please wait…');
                    await sleep(1000);
                    continue;
                }
                if (/failed to fetch|maximum capacity/i.test(msg)) { await sleep(1000); continue; }
                // Other error: stop.
                break;
            }
        }

        finished = true; // stop any pending rAF from clobbering the final render
        clearTimeout(t20); clearTimeout(t70);
        window.currentStreamController = null;
        aiMsg.isStreaming = false;
        aiMsg.streamingVariant = null;

        if (controller.signal.aborted && !mainAcc && !success) {
            // Remove empty bubble.
            const idx = chat.history.indexOf(aiMsg);
            if (idx !== -1) {
                const v = aiMsg.variations[variantIndex];
                if (opts.isRegenerate) {
                    aiMsg.variations.splice(variantIndex, 1);
                    aiMsg.activeVariant = Math.max(0, aiMsg.variations.length - 1);
                } else if (v && (v.main === '...' || !v.main)) {
                    chat.history.splice(idx, 1);
                    const el = bubble();
                    if (el && el.parentElement) el.parentElement.remove();
                }
            }
        } else if (!success && lastError) {
            const friendly = formatError(lastError);
            if (opts.isContinue) {
                const v = aiMsg.variations[variantIndex];
                if (v) v.main = (seed || '') + '\n[--- ERROR: ' + friendly + ' ---]';
            } else {
                setBubbleMain(aiMsg, '[--- ERROR: ' + friendly + ' ---]');
            }
        }

        // Finalize.
        const finalSplit = window.splitThink(mainAcc);
        const v = aiMsg.variations[variantIndex];
        if (v && success) {
            v.main = (seed ? seed + ' ' : '') + (finalSplit.main != null ? finalSplit.main : mainAcc);
            v.think = (finalSplit.think || reasonAcc) || null;
        }
        aiMsg.activeVariant = variantIndex;
        await window.saveSingleCharacterToDB(char);
        updateSingleMessageView(aiMsg.id);
        setSendButtons(true);
        updateTokenCount();

        if (success) {
            playChime();
            if (window.runtimeFlags.ttsEnabled && window.speakText) window.speakText(getMessageText(aiMsg), aiMsg.id);
            if (window.runtimeFlags.replyOptionsEnabled && window.generateReplyOptionsInBackground)
                window.generateReplyOptionsInBackground();
            // Background, opt-in: distill older turns into chat memories (non-blocking).
            maybeAutoSummarize(char, chat);
        }
    }

    function formatError(err) {
        const msg = String(err && err.message || err);
        if (/failed to fetch|network/i.test(msg)) return 'Network error — is the backend running?';
        if (/401|403/.test(msg)) return 'API key invalid or unauthorized.';
        if (/404|not found/i.test(msg)) return 'Model not found.';
        if (/429|rate.?limit|quota/i.test(msg)) return 'Rate-limited or quota exceeded.';
        if (/50\d/.test(msg)) return 'Server error from provider.';
        return msg.slice(0, 200);
    }

    function setBubbleMain(aiMsg, text) {
        const el = document.querySelector('.message[data-message-id="' + aiMsg.id + '"] .main-content');
        if (el) el.innerHTML = window.formatSubString(text);
    }

    function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

    function abortStream() {
        if (window.currentStreamController) {
            try { window.currentStreamController.abort(); } catch (e) { /* ignore */ }
        }
        setSendButtons(true);
    }

    // ── Regenerate ──────────────────────────────────────────────────────────
    async function handleRegenerate(messageId) {
        const char = curChar();
        const chat = curChat();
        if (!char || !chat) return;
        const idx = chat.history.findIndex((m) => m.id === messageId);
        if (idx === -1) return;
        const message = chat.history[idx];
        if (message.sender !== 'ai') return;
        message.variations.push({ main: '...', think: null });
        message.activeVariant = message.variations.length - 1;
        message.streamingVariant = message.activeVariant;
        message.isStreaming = true;
        updateSingleMessageView(messageId);
        setSendButtons(false);

        // Build history up to this message; user turn = last preceding user message.
        const priorHistory = chat.history.slice(0, idx);
        const lastUser = [...priorHistory].reverse().find((m) => m.sender === 'user');
        const lastUserText = lastUser ? getMessageText(lastUser) : 'Continue the roleplay.';
        const tempChat = Object.assign({}, chat, { history: priorHistory });
        const messages = buildMessagesArray(char, tempChat, message.type, message.speakerId, lastUserText);
        await runStream(message, messages, char, chat, { type: message.type, isRegenerate: true });
    }

    // ── Continue ────────────────────────────────────────────────────────────
    async function handleContinue(messageId) {
        const char = curChar();
        const chat = curChat();
        if (!char || !chat) return;
        const idx = chat.history.findIndex((m) => m.id === messageId);
        if (idx === -1) return;
        const message = chat.history[idx];
        if (message.sender !== 'ai') return;
        const original = getMessageText(message);
        message.isStreaming = true;
        message.streamingVariant = message.activeVariant;
        updateSingleMessageView(messageId);
        setSendButtons(false);

        const priorHistory = chat.history.slice(0, idx + 1);
        const tempChat = Object.assign({}, chat, { history: priorHistory });
        const contInstruction = original + '\n[Continue: drive the scene forward, complete any cut-off sentence, do not repeat.]';
        const messages = buildMessagesArray(char, tempChat, message.type, message.speakerId, contInstruction);
        await runStream(message, messages, char, chat, { type: message.type, isContinue: true, continueSeed: original });
    }

    // ── Swipe variants ──────────────────────────────────────────────────────
    async function swipeVariant(messageId, dir) {
        const char = curChar();
        const chat = curChat();
        if (!char || !chat) return;
        const message = chat.history.find((m) => m.id === messageId);
        if (!message || message.sender !== 'ai') return;
        const n = message.variations.length;
        let next = (message.activeVariant || 0) + dir;
        if (next < 0) next = 0;
        if (next >= n) {
            if (dir > 0) { handleRegenerate(messageId); return; }
            next = n - 1;
        }
        message.activeVariant = next;
        await window.saveSingleCharacterToDB(char);
        updateSingleMessageView(messageId);
    }

    // ── Edit a message ──────────────────────────────────────────────────────
    function openMessageEditor(messageId) {
        const chat = curChat();
        if (!chat) return;
        const message = chat.history.find((m) => m.id === messageId);
        if (!message) return;
        const modal = $('message-editor-modal');
        const ta = $('message-editor-textarea');
        if (!modal || !ta) return;
        ta.value = getMessageText(message);
        modal.dataset.editingMessageId = messageId;
        modal.classList.remove('hidden');
        ta.focus();
    }

    async function saveAndCloseMessageEditor() {
        const modal = $('message-editor-modal');
        const ta = $('message-editor-textarea');
        if (!modal || !ta) return;
        const messageId = modal.dataset.editingMessageId;
        const char = curChar();
        const chat = curChat();
        if (!char || !chat) { modal.classList.add('hidden'); return; }
        const message = chat.history.find((m) => m.id === messageId);
        if (message) {
            if (message.sender === 'ai') {
                const v = message.variations[message.activeVariant || 0];
                if (v) v.main = ta.value;
            } else {
                message.main = ta.value;
            }
            await window.saveSingleCharacterToDB(char);
        }
        modal.classList.add('hidden');
        delete modal.dataset.editingMessageId;
        const win = $('chat-window');
        const scroll = win ? win.scrollTop : 0;
        startChat(window.currentCharacterId, window.currentChatId);
        if (win) win.scrollTop = scroll;
        updateTokenCount();
    }
    function cancelMessageEditor() {
        const modal = $('message-editor-modal');
        if (modal) { modal.classList.add('hidden'); delete modal.dataset.editingMessageId; }
    }

    // ── Delete + undo ───────────────────────────────────────────────────────
    async function handleDeleteMessage(messageId) {
        const char = curChar();
        const chat = curChat();
        if (!char || !chat) return;
        const idx = chat.history.findIndex((m) => m.id === messageId);
        if (idx === -1) return;
        const ok = await window.showCustomConfirm('Delete this message and all following messages?', true);
        if (!ok) return;
        const removed = chat.history.splice(idx);
        window._undoSnapshot = { charId: char.id, chatId: chat.id, fromIndex: idx, messages: removed };
        await window.saveSingleCharacterToDB(char);
        updateTokenCount();
        const win = $('chat-window');
        const scroll = win ? win.scrollTop : 0;
        startChat(char.id, chat.id);
        if (win) win.scrollTop = scroll;
        showUndoFab();
        if (window.runtimeFlags.replyOptionsEnabled && window.generateReplyOptionsInBackground)
            window.generateReplyOptionsInBackground();
    }

    function showUndoFab() {
        let fab = $('undo-delete-fab');
        if (!fab) {
            fab = document.createElement('button');
            fab.id = 'undo-delete-fab';
            fab.className = 'undo-delete-fab';
            fab.textContent = '↩ Undo Delete';
            fab.addEventListener('click', undoDelete);
            const screen = $('chat-screen');
            if (screen) screen.appendChild(fab);
        }
        fab.classList.remove('hidden');
    }
    function hideUndoFab() {
        const fab = $('undo-delete-fab');
        if (fab) fab.classList.add('hidden');
    }
    async function undoDelete() {
        const snap = window._undoSnapshot;
        if (!snap) return;
        const char = window.characters[snap.charId];
        if (!char || !char.chats[snap.chatId]) return;
        const chat = char.chats[snap.chatId];
        chat.history.splice(snap.fromIndex, 0, ...snap.messages);
        window._undoSnapshot = null;
        await window.saveSingleCharacterToDB(char);
        hideUndoFab();
        if (window.currentCharacterId === snap.charId && window.currentChatId === snap.chatId)
            startChat(snap.charId, snap.chatId);
    }

    // ── Memories ────────────────────────────────────────────────────────────
    function openChatMemoriesModal() {
        const chat = curChat();
        if (!chat) return;
        const modal = $('chat-memories-modal');
        const ta = $('chat-memories-textarea');
        if (!modal || !ta) return;
        ta.value = chat.memories || '';
        window.autoResizeTextarea(ta);
        modal.classList.remove('hidden');
        ta.focus();
    }
    function closeChatMemoriesModal() {
        const modal = $('chat-memories-modal');
        if (modal) modal.classList.add('hidden');
    }
    async function saveChatMemories() {
        const char = curChar();
        const chat = curChat();
        if (!char || !chat) return;
        const ta = $('chat-memories-textarea');
        const val = (ta ? ta.value : '').trim();
        const had = !!(chat.memories && chat.memories.trim());
        chat.memories = val;
        await window.saveSingleCharacterToDB(char);
        updateMemoriesButton();
        updateTokenCount();
        closeChatMemoriesModal();
        window.showToast(val ? '✓ Memories saved' : '✓ Memories cleared');
    }
    function updateMemoriesButton() {
        const chat = curChat();
        const btn = $('chat-memories-btn');
        if (!btn) return;
        const has = !!(chat && chat.memories && chat.memories.trim());
        btn.classList.toggle('active', has);
        btn.title = has ? 'Chat Memories (set)' : 'Chat Memories';
    }

    // ── Auto-summarize to memory (opt-in, background) ─────────────────────────
    // Fires after a reply finishes once the chat has grown by `every` messages
    // since the last auto-summary. Distilled bullets are appended to chat.memories
    // (injected as high-priority context) so the AI keeps long-term recall even
    // after older turns scroll out of the model's window. Non-blocking; preempted
    // by the next user turn (runStream aborts it) so the local model isn't tied up.
    async function maybeAutoSummarize(char, chat) {
        if (!window.runtimeFlags.autoSummarizeEnabled) return;
        if (!char || !chat || !Array.isArray(chat.history)) return;
        if (window._autoSummaryRunning) return;
        const every = Math.max(10, parseInt(window.runtimeFlags.autoSummarizeEvery, 10) || 30);
        const len = chat.history.length;
        const prevLen = chat._lastAutoSummaryLen || 0;
        if (len - prevLen < every) return;

        window._autoSummaryRunning = true;
        chat._lastAutoSummaryLen = len; // mark up front to avoid re-entry
        const controller = new AbortController();
        window._autoSummaryController = controller;
        try {
            const modelId = window.runtimeFlags.summaryModelId
                || window.runtimeFlags.model || 'local-qwen';
            const transcript = chat.history.slice(-Math.max(40, every)).map((m) => {
                const speaker = m.sender === 'user'
                    ? 'User' : displayName(window.characters[m.speakerId] || char);
                return speaker + ': ' + getMessageText(m);
            }).join('\n');
            const sys = 'Summarize the conversation into 5-10 concise bullet points capturing key events, '
                + 'facts, relationships and unresolved threads. No markdown headers, no intro/outro — bullets only.';
            const result = await window.callAISimple(modelId, sys, transcript, controller.signal);
            if (controller.signal.aborted) return;
            if (result && result.trim()) {
                const header = '--- Auto-summary (' + new Date().toLocaleDateString() + ') ---\n';
                const prev = (chat.memories || '').trim();
                chat.memories = (prev ? prev + '\n\n' : '') + header + result.trim();
                // Reflect into the memories textarea if its modal is open.
                const modal = $('chat-memories-modal');
                const ta = $('chat-memories-textarea');
                if (ta && modal && !modal.classList.contains('hidden')) {
                    ta.value = chat.memories;
                    if (window.autoResizeTextarea) window.autoResizeTextarea(ta);
                }
                await window.saveSingleCharacterToDB(char);
                updateMemoriesButton();
                updateTokenCount();
                if (window.showToast) window.showToast('Memory updated (auto-summary)');
            }
        } catch (e) {
            // Silent: a failed/aborted background summary must not disrupt roleplay.
            if (controller.signal.aborted) chat._lastAutoSummaryLen = prevLen; // retry next threshold
        } finally {
            window._autoSummaryRunning = false;
            window._autoSummaryController = null;
        }
    }

    // ── Mood ────────────────────────────────────────────────────────────────
    function updateMoodButton() {
        const chat = curChat();
        const btn = $('mood-btn');
        if (!btn) return;
        const mood = chat && chat.mood;
        btn.classList.toggle('active', !!mood);
        btn.title = mood ? 'Mood: ' + mood : 'Set Character Mood';
    }
    async function setMood(mood) {
        const char = curChar();
        const chat = curChat();
        if (!char || !chat) return;
        chat.mood = mood || null;
        await window.saveSingleCharacterToDB(char);
        updateMoodButton();
        const picker = $('mood-picker');
        if (picker) picker.classList.add('hidden');
    }

    // ── Token estimate ──────────────────────────────────────────────────────
    function updateTokenCount() {
        const char = curChar();
        const chat = curChat();
        const tip = $('token-tooltip');
        if (!char || !chat) { if (tip) tip.textContent = ''; return; }
        let len = 0;
        if (chat.activePersonaId && window.personas[chat.activePersonaId])
            len += (window.personas[chat.activePersonaId].description || '').length;
        len += (chat.memories || '').length;
        chat.history.forEach((m) => { len += getMessageText(m).length; });
        (chat.participants || []).forEach((id) => {
            if (window.characters[id]) len += (window.characters[id].description || '').length;
        });
        len += (char.lore || '').length;
        const tokens = Math.round(len / 4) + 2000;
        if (tip) tip.textContent = 'Estimated Tokens in Context: ~' + tokens;
    }

    // ── Quick swap ──────────────────────────────────────────────────────────
    function openQuickSwapModal() {
        const modal = $('quick-swap-modal');
        const list = $('quick-swap-character-list');
        const search = $('quick-swap-search-input');
        if (!modal || !list) return;
        function render() {
            const q = (search ? search.value : '').trim().toLowerCase();
            list.innerHTML = '';
            Object.values(window.characters)
                .filter((c) => c.type !== 'world' && c.id !== window.currentCharacterId)
                .filter((c) => (c.name || '').toLowerCase().indexOf(q) !== -1)
                .sort((a, b) => String(a.name).localeCompare(b.name, 'de'))
                .forEach((c) => {
                    const btn = document.createElement('button');
                    btn.className = 'participant-option-btn';
                    btn.textContent = c.name;
                    btn.addEventListener('click', () => { modal.classList.add('hidden'); quickSwapTo(c.id); });
                    list.appendChild(btn);
                });
        }
        if (search) { search.value = ''; search.oninput = render; }
        render();
        modal.classList.remove('hidden');
    }
    async function quickSwapTo(targetId) {
        const src = curChar();
        const chat = curChat();
        const target = window.characters[targetId];
        if (!src || !chat || !target) return;
        const moved = JSON.parse(JSON.stringify(chat));
        moved.participants = (moved.participants || []).map((p) => p === src.id ? targetId : p);
        if (moved.participants.indexOf(targetId) === -1) moved.participants.unshift(targetId);
        delete src.chats[chat.id];
        target.chats[chat.id] = moved;
        await window.saveSingleCharacterToDB(src);
        await window.saveSingleCharacterToDB(target);
        startChat(targetId, chat.id);
    }

    // ── Restore from server ─────────────────────────────────────────────────
    function backendOrigin() {
        if (location.protocol === 'http:' || location.protocol === 'https:') return location.origin;
        try { return new URL(window.DEFAULT_API_URL).origin; } catch (e) { return 'http://127.0.0.1:8000'; }
    }

    function backendMsgToLocal(msg, chatId, idx) {
        const split = window.splitThink(msg.content || '');
        const sender = msg.role === 'assistant' ? 'ai' : 'user';
        if (sender === 'user') return { id: 'msg-restored-' + chatId + '-' + idx, sender: 'user', main: split.main || msg.content || '' };
        return {
            id: 'msg-restored-' + chatId + '-' + idx,
            sender: 'ai', type: 'dialog', speakerId: undefined, activeVariant: 0,
            variations: [{ main: split.main || msg.content || '', think: split.think || null }]
        };
    }

    async function restoreChatsFromServer(opts) {
        opts = opts || {};
        const silent = !!opts.silent;
        const status = $('restore-status');
        const setStatus = (t) => { if (!silent && status) status.textContent = t; };
        setStatus('Checking server…');
        let summaries;
        try {
            const r = await fetch(backendOrigin() + '/api/chats');
            if (!r.ok) throw new Error('HTTP ' + r.status);
            summaries = await r.json();
        } catch (e) {
            setStatus('Could not reach backup server.');
            return;
        }
        if (!Array.isArray(summaries)) summaries = [];
        let added = 0, updated = 0, orphans = 0;
        const touched = new Set();
        for (const s of summaries) {
            const char = window.characters[s.character_id];
            if (!char) { orphans++; continue; }
            const localChat = char.chats[s.chat_id];
            if (localChat && (localChat.history || []).length >= s.turns) continue;
            let full;
            try {
                const r = await fetch(backendOrigin() + '/api/chats/' + s.character_id + '/' + s.chat_id);
                if (!r.ok) continue;
                full = await r.json();
            } catch (e) { continue; }
            const history = (full.messages || [])
                .filter((m) => m.role !== 'system')
                .map((m, i) => backendMsgToLocal(m, s.chat_id, i));
            if (localChat) {
                localChat.history = history;
                updated++;
            } else {
                char.chats[s.chat_id] = {
                    id: s.chat_id,
                    name: 'Restored - ' + new Date().toLocaleString(),
                    history: history, memories: '', participants: [s.character_id],
                    activePersonaId: null, mood: null
                };
                added++;
            }
            touched.add(char.id);
        }
        for (const id of touched) await window.saveSingleCharacterToDB(window.characters[id]);
        if (touched.size) window.renderCharacterList();
        const changed = added + updated;
        if (changed || !silent) {
            let msg;
            if (changed) msg = added + ' new, ' + updated + ' updated';
            else msg = 'Everything is already up to date';
            if (orphans) msg += ' (' + orphans + ' orphan' + (orphans === 1 ? '' : 's') + ' skipped)';
            setStatus(msg);
            if (changed) window.showToast(msg);
        }
    }

    // Exports.
    window.startChat = startChat;
    window.createNewChat = createNewChat;
    window.openScenarioSelection = openScenarioSelection;
    window.renameChat = renameChat;
    window.deleteChat = deleteChat;
    window.renderMessage = renderMessage;
    window.updateSingleMessageView = updateSingleMessageView;
    window.handleChatSubmit = handleChatSubmit;
    window.handleRegenerate = handleRegenerate;
    window.handleContinue = handleContinue;
    window.swipeVariant = swipeVariant;
    window.openMessageEditor = openMessageEditor;
    window.saveAndCloseMessageEditor = saveAndCloseMessageEditor;
    window.cancelMessageEditor = cancelMessageEditor;
    window.handleDeleteMessage = handleDeleteMessage;
    window.undoDelete = undoDelete;
    window.openChatMemoriesModal = openChatMemoriesModal;
    window.closeChatMemoriesModal = closeChatMemoriesModal;
    window.saveChatMemories = saveChatMemories;
    window.setMood = setMood;
    window.updateTokenCount = updateTokenCount;
    window.openQuickSwapModal = openQuickSwapModal;
    window.restoreChatsFromServer = restoreChatsFromServer;
    window.abortStream = abortStream;
    window.getMessageText = getMessageText;
    window.displayChatName = displayName;
    window.buildSystemPromptForTest = buildSystemPrompt;
})();
