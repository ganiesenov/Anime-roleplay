// =============================================================
// ai-gen.js — In-app AI generation: model-picker dialog, simple
// one-shot AI calls, reply-suggestion dropdown, and the scenario /
// character / world generators. Extracted from main.js.
// Loaded AFTER main.js. Called at runtime from chat.js & settings.js.
// =============================================================
    function showModelPickerAndConfirm({ title, infoText, warningText, confirmLabel, defaultModelId }) {
        return new Promise(resolve => {
            const overlay = document.createElement('div');
            overlay.className = 'custom-alert-overlay';
            const modal = document.createElement('div');
            modal.className = 'custom-alert-modal';
            modal.style.maxWidth = '480px';

            const h3 = document.createElement('h3');
            h3.style.cssText = 'margin:0 0 10px;font-size:1.05em;';
            h3.textContent = title;
            modal.appendChild(h3);

            const p = document.createElement('p');
            p.style.cssText = 'margin:0 0 10px;font-size:0.9em;color:#ccc;line-height:1.5;';
            p.textContent = infoText;
            modal.appendChild(p);

            if (warningText) {
                const warn = document.createElement('p');
                warn.style.cssText = 'margin:0 0 12px;font-size:0.85em;color:#ffaa44;background:rgba(255,150,50,0.08);padding:8px 10px;border-radius:6px;border:1px solid rgba(255,150,50,0.25);';
                warn.textContent = warningText;
                modal.appendChild(warn);
            }

            const modelLabel = document.createElement('label');
            modelLabel.textContent = 'AI Model:';
            modelLabel.style.cssText = 'display:block;margin:0 0 5px;font-size:0.85em;color:#bbb;';
            modal.appendChild(modelLabel);

            const modelDropdown = document.createElement('select');
            modelDropdown.style.cssText = 'width:100%;background:#2a2a3a;color:#fff;border:1px solid rgba(255,255,255,0.15);border-radius:6px;padding:7px 8px;font-size:0.88em;margin-bottom:14px;box-sizing:border-box;';
            const models = appSettings.availableModels || [];
            if (models.length === 0) {
                const opt = document.createElement('option');
                opt.value = '';
                opt.textContent = 'No models configured';
                modelDropdown.appendChild(opt);
            } else {
                models.forEach(m => {
                    const opt = document.createElement('option');
                    opt.value = m.id;
                    opt.textContent = m.name || m.id;
                    if (m.id === defaultModelId) opt.selected = true;
                    modelDropdown.appendChild(opt);
                });
            }
            modal.appendChild(modelDropdown);

            const btns = document.createElement('div');
            btns.className = 'custom-dialog-buttons';
            const cancelBtn = document.createElement('button');
            cancelBtn.textContent = 'Cancel';
            cancelBtn.className = 'secondary-btn';
            const confirmBtn = document.createElement('button');
            confirmBtn.textContent = confirmLabel || 'Confirm';
            confirmBtn.className = 'action-btn';
            if (models.length === 0) confirmBtn.disabled = true;
            btns.appendChild(cancelBtn);
            btns.appendChild(confirmBtn);
            modal.appendChild(btns);
            overlay.appendChild(modal);
            document.body.appendChild(overlay);
            confirmBtn.focus();
            confirmBtn.addEventListener('click', () => { overlay.remove(); resolve(modelDropdown.value || null); });
            cancelBtn.addEventListener('click', () => { overlay.remove(); resolve(null); });
        });
    }

    async function callAISimple(systemPrompt, userMessage, selectedModelId, signal = null) {
        const modelId = selectedModelId || modelSelect?.value || defaultSettings.model;
        const lookupId = modelId.replace(/:online$/, '');
        const modelSettings = (appSettings.availableModels || []).find(m => m.id === lookupId);
        const apiKeyToSend = (modelSettings?.apiKey) || appSettings.apiKey;
        const targetApiUrlToSend = (modelSettings?.targetApiUrl) || DEFAULT_API_URL;
        const messages = [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userMessage }
        ];
        const response = await fetch(targetApiUrlToSend, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKeyToSend}`,
                'HTTP-Referer': window.location.href,
                'X-Title': 'Casual Character Chat'
            },
            body: JSON.stringify({ model: modelId, messages, temperature: 0.7, top_p: 0.95, stream: true }),
            ...(signal ? { signal } : {})
        });
        if (!response.ok) throw new Error(await response.text());
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let fullText = '';
        let sseBuffer = '';
        while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            sseBuffer += decoder.decode(value, { stream: true });
            const lines = sseBuffer.split('\n');
            sseBuffer = lines.pop() || '';
            for (const rawLine of lines) {
                const line = rawLine.trim();
                if (!line.startsWith('data:')) continue;
                const dataContent = line.slice(5).trim();
                if (dataContent === '[DONE]') break;
                try {
                    const parsed = JSON.parse(dataContent);
                    const delta = parsed.choices?.[0]?.delta;
                    if (delta?.content) fullText += delta.content;
                } catch (_) {}
            }
        }
        return fullText.trim();
    }

    function _formatAIError(err, context) {
        const msg = (err && err.message) ? err.message : String(err || '');
        if (msg.includes('fetch') || msg.includes('network') || msg.toLowerCase().includes('failed to fetch')) {
            return `${context} failed: Could not reach the AI provider. Check internet connection and API settings.`;
        }
        if (msg.includes('401') || msg.includes('403') || msg.toLowerCase().includes('unauthorized') || msg.toLowerCase().includes('forbidden')) {
            return `${context} failed: API key invalid or access denied. Check your API key in App Settings.`;
        }
        if (msg.includes('404') || (msg.toLowerCase().includes('model') && msg.toLowerCase().includes('not found'))) {
            return `${context} failed: Model not found. Try a different model.`;
        }
        if (msg.includes('429') || msg.toLowerCase().includes('rate limit') || msg.toLowerCase().includes('quota')) {
            return `${context} failed: Rate limit or quota exceeded. Wait a moment and try again.`;
        }
        if (msg.includes('500') || msg.includes('502') || msg.includes('503')) {
            return `${context} failed: The AI provider returned a server error. Try again later.`;
        }
        return `${context} failed: ${msg || 'Unknown error.'}`;
    }

    // ── Reply Suggestions helpers ──

    function showReplyOptionsDropdown() {
        if (!replyOptionsEnabled) return;
        const dropdown = document.getElementById('reply-options-dropdown');
        if (!dropdown) return;
        if (!pendingReplyOptions && !replyOptionsLoading) return;
        if (replyOptionsLoading) {
            dropdown.classList.remove('hidden');
            return;
        }
        const [opt1El, opt2El] = dropdown.querySelectorAll('.reply-option-btn');
        if (opt1El) { opt1El.textContent = pendingReplyOptions[0]; opt1El.className = 'reply-option-btn'; opt1El.style.display = ''; }
        if (opt2El) { opt2El.textContent = pendingReplyOptions[1]; opt2El.className = 'reply-option-btn'; opt2El.style.display = ''; }
        dropdown.classList.remove('hidden');
    }

    function hideReplyOptionsDropdown() {
        const dropdown = document.getElementById('reply-options-dropdown');
        if (dropdown) dropdown.classList.add('hidden');
    }

    function _setReplyDropdownLoading() {
        const dropdown = document.getElementById('reply-options-dropdown');
        if (!dropdown) return;
        const [btn1, btn2] = dropdown.querySelectorAll('.reply-option-btn');
        if (btn1) { btn1.textContent = ''; btn1.className = 'reply-option-btn reply-option-loading'; btn1.style.display = ''; }
        if (btn2) { btn2.textContent = ''; btn2.className = 'reply-option-btn reply-option-loading'; btn2.style.display = ''; }
    }

    function _setReplyDropdownOptions(opt1, opt2) {
        const dropdown = document.getElementById('reply-options-dropdown');
        if (!dropdown) return;
        const [btn1, btn2] = dropdown.querySelectorAll('.reply-option-btn');
        if (btn1) { btn1.textContent = opt1; btn1.className = 'reply-option-btn'; btn1.style.display = ''; }
        if (btn2) { btn2.textContent = opt2; btn2.className = 'reply-option-btn'; btn2.style.display = ''; }
        dropdown.classList.remove('hidden');
    }

    function _setReplyDropdownError(msg) {
        const dropdown = document.getElementById('reply-options-dropdown');
        if (!dropdown) return;
        const [btn1, btn2] = dropdown.querySelectorAll('.reply-option-btn');
        const shortMsg = msg.length > 90 ? msg.substring(0, 87) + '…' : msg;
        if (btn1) { btn1.textContent = `⚠ ${shortMsg}`; btn1.className = 'reply-option-btn reply-option-error'; btn1.style.display = ''; }
        if (btn2) { btn2.textContent = ''; btn2.className = 'reply-option-btn'; btn2.style.display = 'none'; }
        dropdown.classList.remove('hidden');
    }

    async function generateReplyOptionsInBackground() {
        if (!replyOptionsEnabled) return;
        const chat = characters[currentCharacterId]?.chats?.[currentChatId];
        if (!chat || !chat.history || chat.history.length === 0) return;

        const lastAIMsg = [...chat.history].reverse().find(m => m.sender !== 'user');
        if (!lastAIMsg) return;
        const lastAIText = (lastAIMsg.variations?.[lastAIMsg.activeVariant ?? 0]?.main || '').trim();
        if (!lastAIText || lastAIText.length < 5) return;

        pendingReplyOptions = null;
        replyOptionsLoading = true;
        const reqId = ++replyOptionsReqId;

        _setReplyDropdownLoading();

        const character = characters[currentCharacterId];
        const charName = character?.chatName || character?.cardName || 'the character';
        const persona = chat.activePersonaId ? personas[chat.activePersonaId] : null;
        const personaContext = persona
            ? ` The user is playing as "${persona.name}" (${(persona.description || '').substring(0, 200)}).`
            : '';
        const modelId = suggestionModelId || modelSelect?.value || defaultSettings.model;

        const systemPrompt = `You are a creative assistant for a character roleplay app. Generate exactly 2 short reply options that the HUMAN USER can send to the AI character. These are the user's own words — what the user says or does in response to the character's latest message. Never write from the character's perspective. Each option must be a single sentence in first-person voice from the user's point of view. No narration, no stage directions — just the user's spoken reply. Make them plot-relevant and scene-specific, offering two distinct directions the user could take.${personaContext} Output ONLY a JSON array with exactly 2 strings, like: ["Option one.", "Option two."]`;
        const userMsg = `${charName} just said: "${lastAIText.substring(0, 600)}"\n\nProvide 2 reply options for the user.`;

        try {
            const result = await callAISimple(systemPrompt, userMsg, modelId);
            if (replyOptionsReqId !== reqId) return;
            const cleaned = stripThinkTags(result).trim();
            let parsed = null;
            try { parsed = JSON.parse(cleaned); } catch (_) {}
            if (!Array.isArray(parsed)) {
                const start = cleaned.indexOf('[');
                if (start !== -1) {
                    let pos = start;
                    while (pos < cleaned.length) {
                        const end = cleaned.indexOf(']', pos);
                        if (end === -1) break;
                        try {
                            const candidate = JSON.parse(cleaned.slice(start, end + 1));
                            if (Array.isArray(candidate)) { parsed = candidate; break; }
                        } catch (_) {}
                        pos = end + 1;
                    }
                }
            }
            if (Array.isArray(parsed) && parsed.length >= 2 && typeof parsed[0] === 'string' && typeof parsed[1] === 'string') {
                pendingReplyOptions = [String(parsed[0]).trim(), String(parsed[1]).trim()];
                _setReplyDropdownOptions(pendingReplyOptions[0], pendingReplyOptions[1]);
            } else {
                throw new Error('Could not parse reply suggestions from AI response.');
            }
        } catch (err) {
            if (replyOptionsReqId !== reqId) return;
            pendingReplyOptions = null;
            _setReplyDropdownError(_formatAIError(err, 'Suggestions'));
        } finally {
            if (replyOptionsReqId === reqId) replyOptionsLoading = false;
        }
    }

    document.getElementById('reply-options-dropdown')?.addEventListener('mousedown', (e) => {
        const btn = e.target.closest('.reply-option-btn');
        if (!btn) return;
        e.preventDefault();
        messageInput.value = btn.textContent;
        autoResizeTextarea({ target: messageInput });
        hideReplyOptionsDropdown();
        messageInput.focus();
    });

    // ── AI Scenario Generator ──

    function showScenarioGeneratorModal(charName) {
        return new Promise(resolve => {
            const overlay = document.createElement('div');
            overlay.className = 'custom-alert-overlay';
            const modal = document.createElement('div');
            modal.className = 'custom-alert-modal';
            modal.style.maxWidth = '480px';

            const h3 = document.createElement('h3');
            h3.style.cssText = 'margin:0 0 10px;font-size:1.05em;';
            h3.textContent = '✨ AI Generate Scenario';
            modal.appendChild(h3);

            const p = document.createElement('p');
            p.style.cssText = 'margin:0 0 12px;font-size:0.9em;color:#ccc;line-height:1.5;';
            p.textContent = `Optionally describe elements that must be part of the scenario for ${charName} (genre, setting, relationship, circumstances…). Leave empty for a random scenario.`;
            modal.appendChild(p);

            const hintLabel = document.createElement('label');
            hintLabel.textContent = 'Scenario hints (optional):';
            hintLabel.style.cssText = 'display:block;margin:0 0 5px;font-size:0.85em;color:#bbb;';
            modal.appendChild(hintLabel);

            const hintInput = document.createElement('textarea');
            hintInput.placeholder = 'e.g. "Rainy night, enemies to lovers, first meeting after a long absence…"';
            hintInput.rows = 3;
            hintInput.style.cssText = 'width:100%;background:#2a2a3a;color:#fff;border:1px solid rgba(255,255,255,0.15);border-radius:6px;padding:7px 8px;font-size:0.88em;margin-bottom:14px;box-sizing:border-box;resize:vertical;font-family:inherit;';
            modal.appendChild(hintInput);

            const modelLabel = document.createElement('label');
            modelLabel.textContent = 'AI Model:';
            modelLabel.style.cssText = 'display:block;margin:0 0 5px;font-size:0.85em;color:#bbb;';
            modal.appendChild(modelLabel);

            const modelDropdown = document.createElement('select');
            modelDropdown.style.cssText = 'width:100%;background:#2a2a3a;color:#fff;border:1px solid rgba(255,255,255,0.15);border-radius:6px;padding:7px 8px;font-size:0.88em;margin-bottom:14px;box-sizing:border-box;';
            const models = appSettings.availableModels || [];
            const currentModelId = modelSelect?.value || defaultSettings.model;
            if (models.length === 0) {
                const opt = document.createElement('option');
                opt.value = '';
                opt.textContent = 'No models configured';
                modelDropdown.appendChild(opt);
            } else {
                models.forEach(m => {
                    const opt = document.createElement('option');
                    opt.value = m.id;
                    opt.textContent = m.name || m.id;
                    if (m.id === currentModelId) opt.selected = true;
                    modelDropdown.appendChild(opt);
                });
            }
            modal.appendChild(modelDropdown);

            const btns = document.createElement('div');
            btns.className = 'custom-dialog-buttons';
            const cancelBtn = document.createElement('button');
            cancelBtn.textContent = 'Cancel';
            cancelBtn.className = 'secondary-btn';
            const confirmBtn = document.createElement('button');
            confirmBtn.textContent = 'Generate';
            confirmBtn.className = 'action-btn';
            if (models.length === 0) confirmBtn.disabled = true;
            btns.appendChild(cancelBtn);
            btns.appendChild(confirmBtn);
            modal.appendChild(btns);
            overlay.appendChild(modal);
            document.body.appendChild(overlay);
            hintInput.focus();

            confirmBtn.addEventListener('click', () => {
                overlay.remove();
                resolve({ hints: hintInput.value.trim(), modelId: modelDropdown.value || null });
            });
            cancelBtn.addEventListener('click', () => { overlay.remove(); resolve(null); });
        });
    }

    async function handleAIGenerateScenario() {
        const charName = document.getElementById('chat-name')?.value.trim()
            || document.getElementById('card-name')?.value.trim()
            || 'the character';
        const charDesc = document.getElementById('char-description')?.value || '';
        const charLore = document.getElementById('char-lore')?.value || '';

        if (!charDesc.trim() && !charLore.trim()) {
            showCustomAlert('Please fill in the Character Description or Lorebook first so the AI can create an authentic scenario.');
            return;
        }

        const result = await showScenarioGeneratorModal(charName);
        if (!result) return;

        const { hints, modelId } = result;
        const btn = document.getElementById('ai-scenario-btn');
        const originalText = btn.textContent;
        btn.innerHTML = '<span class="btn-spinner"></span> Generating…';
        btn.disabled = true;

        try {
            const hintSection = hints
                ? `\n\nUser-specified scenario requirements: ${hints}`
                : '\n\nCreate a surprising, vivid scenario that fits this character\'s world and leaves the user eager to respond.';

            const systemPrompt = `You are a creative writer for a character roleplay app. Write a medium-length opening scenario paragraph (10-15 sentences) for a chat with ${charName}. The paragraph must:
- Address the user directly as "you" in second person — the user is the protagonist of the scene.
- Describe the relationship and dynamic between ${charName} and "you" (the user) — how you know each other, your history, etc.
- Describe what is currently happening in the scene and what ${charName} wants, feels, or intends toward "you" (the user).
- Weave in three lines of dialog spoken by ${charName} (in quotation marks), integrated naturally into the narration.
- Be written in a direct and objective style with concise sentences — no long nested sentences, no flowery language, no purple prose.
- Be entirely specific to the character's world, personality, and lore — no generic or placeholder content.
- End on an open note that naturally invites "you" (the user) to respond.

Character details:
Name: ${charName}
Description: ${charDesc.substring(0, 900)}
Lore/Background: ${charLore.substring(0, 700)}${hintSection}

Output ONLY the scenario paragraph. No title, no labels, no extra commentary.`;

            const text = await callAISimple(systemPrompt, 'Generate the scenario now.', modelId);
            if (!text || !text.trim()) throw new Error('Empty response from AI.');

            const autoTitle = text.split(/\s+/).slice(0, 5).join(' ').replace(/[.,"!?…]+$/, '') + '…';
            createScenarioInput({ name: autoTitle, text: text.trim() });

            const scenarioList = document.getElementById('scenario-editor-list');
            if (scenarioList?.lastElementChild) {
                scenarioList.lastElementChild.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
        } catch (err) {
            showCustomAlert(_formatAIError(err, 'Scenario generation'));
        } finally {
            btn.textContent = originalText;
            btn.disabled = false;
        }
    }

    // Feature 3: Auto-summarize chat into memory
    document.getElementById('summarize-memories-btn')?.addEventListener('click', async () => {
        const chat = characters[currentCharacterId]?.chats?.[currentChatId];
        if (!chat || !chat.history || chat.history.length === 0) {
            showCustomAlert('No messages to summarize yet.');
            return;
        }
        const currentModelId = modelSelect?.value || defaultSettings.model;
        const selectedModelId = await showModelPickerAndConfirm({
            title: '✨ Auto-summarize Chat',
            infoText: 'The selected AI model will read the last 40 messages of this chat and generate a concise bullet-point summary of key events, facts, and story developments. The result will be appended to your Chat Memories — you can review and edit it before saving.',
            confirmLabel: 'Summarize',
            defaultModelId: currentModelId
        });
        if (!selectedModelId) return;
        const btn = document.getElementById('summarize-memories-btn');
        const originalText = btn.textContent;
        btn.innerHTML = '<span class="btn-spinner"></span> Summarizing…';
        btn.disabled = true;
        try {
            const historyText = chat.history.slice(-40).map(msg => {
                if (msg.sender === 'user') return `User: ${msg.main || ''}`;
                const text = msg.variations?.[msg.activeVariant]?.main || '';
                const charName = characters[msg.speakerId || currentCharacterId]?.chatName || 'Character';
                return `${charName}: ${text}`;
            }).join('\n\n');
            const systemPrompt = `You are a concise summarization assistant. Summarize the key story events, facts, and character developments from a roleplay chat. Output only 5-10 bullet points. No intro, no outro, no markdown headers.`;
            const userMessage = `Summarize the key events and facts from this roleplay conversation:\n\n${historyText}`;
            const summary = await callAISimple(systemPrompt, userMessage, selectedModelId);
            const existing = chatMemoriesTextarea.value.trim();
            chatMemoriesTextarea.value = existing
                ? `${existing}\n\n--- Summary (${new Date().toLocaleDateString()}) ---\n${summary}`
                : summary;
            autoResizeTextarea({ target: chatMemoriesTextarea });
        } catch (err) {
            showCustomAlert(`Summarization failed: ${err.message}`);
        } finally {
            btn.textContent = originalText;
            btn.disabled = false;
        }
    });

    function showCharacterGeneratorModal(isEditing, isWorld = false) {
        return new Promise(resolve => {
            const overlay = document.createElement('div');
            overlay.className = 'custom-alert-overlay';
            const modal = document.createElement('div');
            modal.className = 'custom-alert-modal';
            modal.style.maxWidth = '480px';

            const h3 = document.createElement('h3');
            h3.style.cssText = 'margin:0 0 10px;font-size:1.05em;';
            h3.textContent = isWorld ? '✨ AI Generate World' : '✨ AI Generate Character';
            modal.appendChild(h3);

            const p = document.createElement('p');
            p.style.cssText = 'margin:0 0 12px;font-size:0.9em;color:#ccc;line-height:1.5;';
            p.textContent = isWorld
                ? 'Describe the world you want to create. The AI will generate a complete world card — name, setting description, lore, narrator instructions, and tags.'
                : 'Describe the character you want to create. The AI will generate a complete character card — name, description, tags, and AI instructions.';
            modal.appendChild(p);

            if (isEditing) {
                const warn = document.createElement('p');
                warn.style.cssText = 'margin:0 0 12px;font-size:0.85em;color:#ffaa44;background:rgba(255,150,50,0.08);padding:8px 10px;border-radius:6px;border:1px solid rgba(255,150,50,0.25);';
                warn.textContent = isWorld
                    ? '⚠️ You are editing an existing world. All text fields (description, lore, tags, instructions) will be OVERWRITTEN with newly generated content. Images are kept. This cannot be undone automatically.'
                    : '⚠️ You are editing an existing character. All text fields (description, tags, instructions, names) will be OVERWRITTEN with newly generated content. Images are kept. This cannot be undone automatically.';
                modal.appendChild(warn);
            }

            const descLabel = document.createElement('label');
            descLabel.textContent = isWorld ? 'World concept (optional):' : 'Character concept (optional):';
            descLabel.style.cssText = 'display:block;margin:0 0 5px;font-size:0.85em;color:#bbb;';
            modal.appendChild(descLabel);

            const descInput = document.createElement('textarea');
            descInput.placeholder = isWorld
                ? 'e.g. "A grimdark post-apocalyptic steampunk empire run by immortal machine-gods."\n\nor paste a lore wiki URL below.'
                : 'e.g. "A sarcastic tsundere vampire knight from medieval Japan who loves poetry."\n\nor: "Makima, your possessive mother." (with fandom wiki url)';
            descInput.rows = 4;
            descInput.style.cssText = 'width:100%;background:#2a2a3a;color:#fff;border:1px solid rgba(255,255,255,0.15);border-radius:6px;padding:7px 8px;font-size:0.88em;margin-bottom:14px;box-sizing:border-box;resize:vertical;font-family:inherit;';
            modal.appendChild(descInput);

            const modelLabel = document.createElement('label');
            modelLabel.textContent = 'AI Model:';
            modelLabel.style.cssText = 'display:block;margin:0 0 5px;font-size:0.85em;color:#bbb;';
            modal.appendChild(modelLabel);

            const modelDropdown = document.createElement('select');
            modelDropdown.style.cssText = 'width:100%;background:#2a2a3a;color:#fff;border:1px solid rgba(255,255,255,0.15);border-radius:6px;padding:7px 8px;font-size:0.88em;margin-bottom:14px;box-sizing:border-box;';
            const models = appSettings.availableModels || [];
            const currentModelId = modelSelect?.value || defaultSettings.model;
            if (models.length === 0) {
                const opt = document.createElement('option');
                opt.value = '';
                opt.textContent = 'No models configured';
                modelDropdown.appendChild(opt);
            } else {
                models.forEach(m => {
                    const opt = document.createElement('option');
                    opt.value = m.id;
                    opt.textContent = m.name || m.id;
                    if (m.id === currentModelId) opt.selected = true;
                    modelDropdown.appendChild(opt);
                });
            }
            modal.appendChild(modelDropdown);

            const urlLabel = document.createElement('label');
            urlLabel.textContent = 'Reference URL (optional):';
            urlLabel.style.cssText = 'display:block;margin:0 0 5px;font-size:0.85em;color:#bbb;';
            modal.appendChild(urlLabel);

            const urlInput = document.createElement('input');
            urlInput.type = 'url';
            urlInput.placeholder = 'https://onepiece.fandom.com/wiki/Roronoa_Zoro';
            urlInput.style.cssText = 'width:100%;background:#2a2a3a;color:#fff;border:1px solid rgba(255,255,255,0.15);border-radius:6px;padding:7px 8px;font-size:0.88em;margin-bottom:4px;box-sizing:border-box;';
            modal.appendChild(urlInput);

            const urlNote = document.createElement('p');
            urlNote.style.cssText = 'margin:0 0 14px;font-size:0.78em;color:#777;line-height:1.4;';
            urlNote.textContent = isWorld
                ? 'Paste a world wiki or lore page. The AI will read its content and use it as reference for the world card.'
                : 'Paste a character wiki or profile page. The AI will read its content and use it as reference for the character card.';
            modal.appendChild(urlNote);

            const btns = document.createElement('div');
            btns.className = 'custom-dialog-buttons';
            const cancelBtn = document.createElement('button');
            cancelBtn.textContent = 'Cancel';
            cancelBtn.className = 'secondary-btn';
            const confirmBtn = document.createElement('button');
            confirmBtn.textContent = 'Generate';
            confirmBtn.className = 'action-btn';
            if (models.length === 0) confirmBtn.disabled = true;
            btns.appendChild(cancelBtn);
            btns.appendChild(confirmBtn);
            modal.appendChild(btns);
            overlay.appendChild(modal);
            document.body.appendChild(overlay);
            descInput.focus();

            confirmBtn.addEventListener('click', () => {
                overlay.remove();
                resolve({ desc: descInput.value.trim(), modelId: modelDropdown.value || null, referenceUrl: urlInput.value.trim() });
            });
            cancelBtn.addEventListener('click', () => { overlay.remove(); resolve(null); });
        });
    }

    // Feature 4: AI-assisted character/world creation
    let charGenAbortController = null;
    document.getElementById('ai-generate-char-btn')?.addEventListener('click', async () => {
        const isEditing = !!editingCharField.value;
        const isWorld = cardTypeWorldRadio.checked;
        const result = await showCharacterGeneratorModal(isEditing, isWorld);
        if (!result || !result.modelId) return;
        const { desc, modelId: selectedModelId, referenceUrl } = result;
        const btn = document.getElementById('ai-generate-char-btn');
        const originalText = btn.textContent;
        btn.innerHTML = '<span class="btn-spinner"></span> Generating…';
        btn.disabled = true;
        charGenAbortController = new AbortController();
        const { signal } = charGenAbortController;
        try {
            let refContent = '';
            let refFailed = false;
            if (referenceUrl) {
                btn.innerHTML = '<span class="btn-spinner"></span> Reading reference…';
                try {
                    const fandomMatch = referenceUrl.match(/^https?:\/\/([a-z0-9-]+\.fandom\.com)\/wiki\/([^#?]+)/i);
                    if (fandomMatch) {
                        // Fandom wiki: use MediaWiki API directly — has native CORS support, never bot-blocked
                        const articleTitle = decodeURIComponent(fandomMatch[2].replace(/_/g, ' '));
                        const apiUrl = `https://${fandomMatch[1]}/api.php?action=parse&page=${encodeURIComponent(articleTitle)}&prop=wikitext&format=json&origin=*`;
                        const res = await fetch(apiUrl, { signal });
                        if (res.ok) {
                            const data = await res.json();
                            const wikitext = data?.parse?.wikitext?.['*'];
                            if (wikitext && wikitext.length >= 200) refContent = wikitext.slice(0, 8000);
                            else refFailed = true;
                        } else { refFailed = true; }
                    } else {
                        // Non-Fandom URL: use Jina Reader
                        const jinaRes = await fetch(`https://r.jina.ai/${referenceUrl}`, { headers: { Accept: 'text/plain' }, signal });
                        if (jinaRes.ok) {
                            refContent = (await jinaRes.text()).slice(0, 8000);
                            if (refContent.length < 200) { refContent = ''; refFailed = true; }
                        } else { refFailed = true; }
                    }
                } catch (e) { if (e?.name === 'AbortError') throw e; refFailed = true; }
                btn.innerHTML = '<span class="btn-spinner"></span> Generating…';
            }
            let systemPrompt, userMessage;
            if (isWorld) {
                systemPrompt = `You are a creative world designer for an AI roleplay app. Given a world concept, output a JSON object with exactly these keys:
- worldName: full display name for the world card (e.g. "The Iron Reaches - Steampunk Empire")
- chatName: short narrator label used in chat (e.g. "Narrator", "The Oracle", or a world-specific term)
- description: a single plain string — a rich and detailed setting overview covering geography/environment, atmosphere/tone, society/factions, key locations/social places. Plain text, no nested JSON.
- lore: a single plain string — a bunch of relationships between relevant characters, key historical events, notable conflicts, threats, and secrets of this world. Plain text.
- worldRules: short bullet-point rules the AI must always follow in this world (e.g. "Magic is forbidden by law.\\nWomen never experience pain."). These are critical rules that may never be broken.
- tags: 10-20 comma-separated tags (genre, atmosphere, setting type, era, tone, etc.)
Be detailed and write between 500 and 1000 words. 
Do not write about future events of the series or its characters.
Write direct and factual. No purple prose and no complex, nested sentences. 
Stay always in-universe! No meta and no fourth-wall talk.
Output ONLY the raw JSON object. No markdown fences, no commentary.`;
                userMessage = refContent
                    ? `Create a world based on the following reference material${desc ? ` and this concept: ${desc}` : ''}.\n\nReference:\n${refContent}`
                    : desc ? `Create a world based on this concept: ${desc}` : 'Create a random interesting world.';
            } else {
                systemPrompt = `You are a creative character designer for an AI roleplay app. Given a character concept, output a JSON object with exactly these keys:
- cardName: full display name for the card (e.g. "Yuki Tanaka - Vampire Knight")
- chatName: short in-chat first name (e.g. "Yuki")
- description: a single plain string — detailed character sheet, with these 8 numbered headings written as plain text (NOT as nested JSON keys). Write each section as short phrases, separated by semicolons. No future events for the character, no fourth-wall talk. Always stay in-universe. Total description between 300 and 600 words:
  1. Identity/Role — full name; gender; species; age group; social status/work
  [insert line break]
  2. Personality — core traits, temperament, exceptions/unexpected behaviors
  [insert line break]
  3. Speech Style — main characteristics, sentence structure, verbal quirks
  [insert line break]
  4. Abilities — main skills, talents, superhuman attributes/weapons if character has any
  [insert line break]
  5. Appearance — physical look, clothing, notable features
  [insert line break]
  6. Likes/Dislikes — what they love and what they hate (can include fun facts)
  [insert line break]
  7. Past —  heritage, formative experiences
  [insert line break]
  8. Dialog Examples — 5 lines they might actually say in positive, negative, and romantic contexts (as bullet points, in between quotation marks)
- tags: 10-20 comma-separated tags (genre, personality type, hair color etc.)
- instructions: A few bullet points of AI behavior guidance (e.g. "Stay in character and respond in a dry formal tone.")
Output ONLY the raw JSON object. No markdown fences, no commentary.`;
                userMessage = refContent
                    ? `Create a character based on the following reference material${desc ? ` and this concept: ${desc}` : ''}.\n\nReference:\n${refContent}`
                    : desc ? `Create a character based on this concept: ${desc}` : 'Create a random interesting character.';
            }
            // Escape bare newlines/tabs inside JSON string values (common AI output issue)
            const normalizeJson = s => s.replace(/"(?:[^"\\]|\\.)*"/gs, m => m.replace(/\n/g, '\\n').replace(/\r/g, '\\r').replace(/\t/g, '\\t'));
            const result = normalizeJson(await callAISimple(systemPrompt, userMessage, selectedModelId, signal));
            let parsed;
            try {
                // Bracket-counting extraction: handles preamble {braces} before the JSON
                let depth = 0, jsonStart = -1;
                for (let i = 0; i < result.length; i++) {
                    if (result[i] === '{') { if (depth++ === 0) jsonStart = i; }
                    else if (result[i] === '}' && depth > 0 && --depth === 0) {
                        const candidate = result.slice(jsonStart, i + 1);
                        try { parsed = JSON.parse(candidate); break; } catch (_) {}
                        jsonStart = -1;
                    }
                }
                // Repair truncated JSON (response cut off mid-generation)
                if (!parsed && jsonStart !== -1) {
                    try {
                        let frag = result.slice(jsonStart);
                        let inStr = false, esc = false, openD = 0;
                        for (const ch of frag) {
                            if (esc) { esc = false; continue; }
                            if (ch === '\\' && inStr) { esc = true; continue; }
                            if (ch === '"') { inStr = !inStr; continue; }
                            if (!inStr) { if (ch === '{') openD++; else if (ch === '}') openD--; }
                        }
                        let repaired = frag;
                        if (inStr) repaired += '"';
                        while (openD-- > 0) repaired += '}';
                        parsed = JSON.parse(normalizeJson(repaired));
                    } catch (_) {}
                }
                if (!parsed) throw new Error();
            } catch (e) {
                throw new Error(`Could not parse AI response. Got: "${result.slice(0, 120)}"`);
            }
            if (isWorld) {
                if (parsed.worldName) {
                    document.getElementById('card-name').value = parsed.worldName;
                    autoResizeTextarea({ target: document.getElementById('card-name') });
                }
                if (parsed.chatName) document.getElementById('chat-name').value = parsed.chatName;
                if (parsed.description) {
                    charDescriptionInput.value = String(parsed.description);
                    autoResizeTextarea({ target: charDescriptionInput });
                }
                if (parsed.lore) {
                    charLoreInput.value = String(parsed.lore);
                    autoResizeTextarea({ target: charLoreInput });
                }
                if (parsed.worldRules) {
                    const reminderEl = document.getElementById('char-reminder');
                    reminderEl.value = String(parsed.worldRules);
                    autoResizeTextarea({ target: reminderEl });
                }
                if (parsed.tags) document.getElementById('char-tags').value = parsed.tags;
            } else {
                if (parsed.cardName) {
                    document.getElementById('card-name').value = parsed.cardName;
                    autoResizeTextarea({ target: document.getElementById('card-name') });
                }
                if (parsed.chatName) document.getElementById('chat-name').value = parsed.chatName;
                if (parsed.description) {
                    const descRaw = parsed.description;
                    charDescriptionInput.value = typeof descRaw === 'object'
                        ? Object.entries(descRaw).map(([k, v]) => `${k}\n${v}`).join('\n\n')
                        : String(descRaw);
                    autoResizeTextarea({ target: charDescriptionInput });
                }
                if (parsed.tags) document.getElementById('char-tags').value = parsed.tags;
                if (parsed.instructions) {
                    charInstructionsInput.value = parsed.instructions;
                    autoResizeTextarea({ target: charInstructionsInput });
                }
            }
            updateEditorTokenCount();
            if (refFailed) showCustomAlert(`⚠️ The reference URL could not be read (the page may block bots or require login). The ${isWorld ? 'world' : 'character'} was generated without it — you can edit the fields manually.`);
        } catch (err) {
            if (err?.name === 'AbortError') return;
            showCustomAlert(_formatAIError(err, isWorld ? 'World generation' : 'Character generation'));
        } finally {
            charGenAbortController = null;
            btn.textContent = originalText;
            btn.disabled = false;
        }
    });

    // --- END NEW FEATURES ---
