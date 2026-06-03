// =============================================================
// settings.js — app settings (API key / model list) and chat
// design settings (fonts, colors, sound, think/reply toggles),
// plus model-select population and the model-list editor entries.
// Depends on state (appSettings/defaultSettings/availableModels),
// DOM refs, storage (db) and dialogs — all resolved at call time.
// =============================================================

// --- app settings + design settings ---
function closeAppSettingsModal() {
    const textareas = appSettingsModal.querySelectorAll('.global-prompts-content textarea');
    textareas.forEach(textarea => {
        textarea.style.height = 'auto';
        textarea.style.overflowY = 'hidden';
    });
    appSettingsModalContent.scrollTop = 0;
    appSettingsModal.classList.add('hidden');
}



async function saveAppSettings() {
    const models = [];
    document.querySelectorAll('.model-entry').forEach(entry => {
        const name = entry.querySelector('.model-name-input').value.trim();
        const id = entry.querySelector('.model-id-input').value.trim();
        const targetApiUrl = entry.querySelector('.model-target-api-url-input').value.trim(); 
        const apiKey = entry.querySelector('.model-api-key-input').value.trim();
        const instructions = entry.querySelector('.model-instructions-input').value.trim();
        const reminder = entry.querySelector('.model-reminder-input').value.trim();
        const narratorReminder = entry.querySelector('.model-narrator-reminder-input').value.trim();
        const numCtxRaw = entry.querySelector('.model-num-ctx-input').value;
        const numCtx = numCtxRaw !== '' ? parseInt(numCtxRaw, 10) : null;

        if (name && id) {
            models.push({ name, id, targetApiUrl, apiKey, instructions, reminder, narratorReminder, numCtx });
        }
    });

    const newSettings = {
        apiKey: document.getElementById('api-key-input').value.trim(),
        availableModels: models
    };

    if (db) {
        const transaction = db.transaction(['settings'], 'readwrite');
        const store = transaction.objectStore('settings');
        store.put({ key: 'appSettings', value: newSettings });
    }

    appSettings = newSettings;
    populateModelSelector();
    appSettingsModalContent.scrollTop = 0;
    appSettingsModal.classList.add('hidden');
}



async function loadAppSettingsFromDB() {
    const defaultSettings = {
        availableModels: availableModels
    };

    if (db) {
        const transaction = db.transaction(['settings'], 'readonly');
        const store = transaction.objectStore('settings');
        const settingsRecord = await new Promise((resolve, reject) => {
            const request = store.get('appSettings');
            request.onsuccess = () => resolve(request.result);
            request.onerror = (event) => reject(event.target.error);
        });

        appSettings = settingsRecord ? settingsRecord.value : defaultSettings;
    } else {
        appSettings = defaultSettings;
    }

    document.getElementById('api-key-input').value = appSettings.apiKey || '';
    modelListContainer.innerHTML = '';
    // Always surface OUR local Qwen backend first. Non-destructive: only prepend
    // it if no existing model already points at the local endpoint (so user's
    // own models — incl. the seeded Z.AI example — are kept, just not on top).
    const models = appSettings.availableModels ? [...appSettings.availableModels] : [];
    const hasLocal = models.some(m =>
        m.id === 'local-qwen' || (m.targetApiUrl || '').includes('127.0.0.1:8000'));
    if (!hasLocal) {
        models.unshift({ id: 'local-qwen', name: 'Qwen (local backend)', targetApiUrl: DEFAULT_API_URL });
    }
    models.forEach(model => createModelEntry(model));
    // surface downloaded Ollama models as a pick-list (fire-and-forget)
    if (typeof loadOllamaModels === 'function') loadOllamaModels();
}



async function resetAppSettings() {
  if (await showCustomConfirm('Are you sure you want to reset all settings to their default values?', true)) {
    modelListContainer.innerHTML = '';
    availableModels.forEach(m => createModelEntry({
      name: m.name,
      id: m.id,
      targetApiUrl: m.targetApiUrl || '',
      instructions: '',
      reminder: '',
      narratorReminder: ''
    }));
    await saveAppSettings();
  }
}



// ─────────────────────────────────────────────────────────────
// Providers: model discovery (local Ollama + cloud OpenRouter)
// ─────────────────────────────────────────────────────────────
function _addModelEntryAndScroll(model) {
    createModelEntry(model);
    const last = modelListContainer.lastElementChild;
    if (last) {
        last.scrollIntoView({ behavior: 'smooth', block: 'center' });
        last.classList.add('model-entry-flash');
        setTimeout(() => last.classList.remove('model-entry-flash'), 1200);
    }
}

// Downloaded Ollama models -> clickable chips.
// Source is /api/health (it already returns available_models + the current
// model), so this works without restarting the backend. There's also a richer
// /api/ollama/models if the backend is restarted, but health is enough here.
async function loadOllamaModels() {
    const box = document.getElementById('ollama-models-list');
    if (!box) return;
    box.innerHTML = '<span class="provider-loading">Loading models from Ollama…</span>';
    try {
        const res = await fetch('/api/health');
        const data = await res.json();
        const models = data.available_models || [];
        if (!models.length) {
            box.innerHTML = data.error
                ? `<span class="provider-empty">Ollama is unreachable — is it running? (${data.error})</span>`
                : '<span class="provider-empty">No models in Ollama yet. Pull one, e.g.: <code>ollama pull qwen2.5</code></span>';
            return;
        }
        const def = data.model;
        box.innerHTML = '';
        models.forEach(name => {
            const isDefault = name === def;
            const chip = document.createElement('button');
            chip.type = 'button';
            chip.className = 'provider-chip' + (isDefault ? ' is-default' : '');
            chip.title = 'Add this model to the list';
            chip.innerHTML = `<span class="chip-dot"></span><span class="chip-name">${name}</span>${isDefault ? '<span class="chip-meta">default</span>' : ''}`;
            chip.addEventListener('click', () =>
                _addModelEntryAndScroll({ name: name, id: name, targetApiUrl: DEFAULT_API_URL }));
            box.appendChild(chip);
        });
    } catch (e) {
        box.innerHTML = `<span class="provider-empty">Couldn't fetch the list (${e.message}).</span>`;
    }
}

// Public OpenRouter model list -> searchable datalist
let _openrouterLoaded = false;
async function loadOpenRouterModels() {
    const dl = document.getElementById('openrouter-models-datalist');
    const btn = document.getElementById('load-openrouter-btn');
    if (!dl) return;
    if (btn) { btn.disabled = true; btn.textContent = 'Loading…'; }
    try {
        const res = await fetch('https://openrouter.ai/api/v1/models');
        const data = await res.json();
        const models = data.data || [];
        dl.innerHTML = '';
        models.forEach(m => {
            const opt = document.createElement('option');
            opt.value = m.id;
            opt.label = m.name || m.id;
            dl.appendChild(opt);
        });
        _openrouterLoaded = true;
        if (btn) btn.textContent = `Loaded: ${models.length}`;
    } catch (e) {
        if (btn) btn.textContent = 'Load failed';
        if (typeof showToast === 'function') showToast('Couldn\'t fetch OpenRouter list: ' + e.message);
    } finally {
        if (btn) setTimeout(() => {
            btn.disabled = false;
            if (!_openrouterLoaded) btn.textContent = 'Load list';
        }, 1600);
    }
}

// Add the chosen OpenRouter model as an entry (URL + current key)
function addOpenRouterModel() {
    const input = document.getElementById('openrouter-model-input');
    const id = (input && input.value || '').trim();
    if (!id) {
        if (typeof showToast === 'function') showToast('Type or pick an OpenRouter model.');
        return;
    }
    const key = (document.getElementById('api-key-input')?.value || '').trim();
    _addModelEntryAndScroll({
        name: id,
        id: id,
        targetApiUrl: 'https://openrouter.ai/api/v1/chat/completions',
        apiKey: key,
    });
    if (input) input.value = '';
}

// Wire the provider controls (DOM is static, present at module load)
document.getElementById('refresh-ollama-btn')?.addEventListener('click', loadOllamaModels);
document.getElementById('load-openrouter-btn')?.addEventListener('click', loadOpenRouterModels);
document.getElementById('add-openrouter-model-btn')?.addEventListener('click', addOpenRouterModel);



    function playNotificationSound() {
        if (!soundEnabled) return;
        if (!audioCtx) return;
        const oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);

        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(659.26, audioCtx.currentTime); 

        gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
        gainNode.gain.linearRampToValueAtTime(0.2, audioCtx.currentTime + 0.02);
        gainNode.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.4);

        oscillator.start(audioCtx.currentTime);
        oscillator.stop(audioCtx.currentTime + 0.5);
    }
    


    function hexToRgb(hex) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ?
            { r: parseInt(result[1], 16), g: parseInt(result[2], 16), b: parseInt(result[3], 16) } : null;
    }



    function applySetting(key, value) {
        const root = document.documentElement;
        switch (key) {
            case 'fontSize':
                fontSizeValue.textContent = `${value}px`;
                root.style.setProperty('--chat-font-size', `${value}px`);
                break;
            case 'temperature':
                temperatureValue.textContent = parseFloat(value).toFixed(2);
                break;
            case 'mainTextColor':
                root.style.setProperty('--main-text-color', value);
                break;
            case 'dialogueColor':
                root.style.setProperty('--dialogue-color', value);
                break;
            case 'userBubbleColor':
            case 'userBubbleOpacity':
                const userColor = hexToRgb(userBubbleColorPicker.value);
                const userOpacity = userBubbleOpacitySlider.value;
                if (userColor) {
                    root.style.setProperty('--user-bubble-color', `rgba(${userColor.r}, ${userColor.g}, ${userColor.b}, ${userOpacity})`);
                }
                userBubbleOpacityValue.textContent = `${Math.round(userOpacity * 100)}%`;
                break;
            case 'aiBubbleColor':
            case 'aiBubbleOpacity':
                const aiColor = hexToRgb(aiBubbleColorPicker.value);
                const aiOpacity = aiBubbleOpacitySlider.value;
                if (aiColor) {
                    root.style.setProperty('--ai-bubble-color', `rgba(${aiColor.r}, ${aiColor.g}, ${aiColor.b}, ${aiOpacity})`);
                }
                aiBubbleOpacityValue.textContent = `${Math.round(aiOpacity * 100)}%`;
                break;
            case 'messageSpacing':
                spacingValue.textContent = `${value}px`;
                root.style.setProperty('--message-spacing', `${value}px`);
                break;
            case 'soundEnabled':
                soundEnabled = (value === 'true' || value === true);
                break;
            case 'thinkEnabled':
                thinkEnabled = (value === 'true' || value === true);
                break;
            case 'replyOptionsEnabled':
                replyOptionsEnabled = (value === 'true' || value === true);
                if (!replyOptionsEnabled) {
                    pendingReplyOptions = null;
                    hideReplyOptionsDropdown();
                }
                break;
            case 'suggestionModelId':
                suggestionModelId = value || null;
                if (suggestionModelSelect) suggestionModelSelect.value = value || '';
                break;
            case 'blur':
                blurValue.textContent = `${value}px`;
                root.style.setProperty('--message-blur', `${value}px`);
                break;
                case 'avatarSize':

                avatarSizeValue.textContent = `${value}px`;

                root.style.setProperty('--ai-avatar-size', `${value}px`);

                const placeholderIconSize = Math.round(value * 0.6);

                root.style.setProperty('--ai-placeholder-icon-size', `${placeholderIconSize}px`);
                break;
            case 'ttsEnabled':
                ttsEnabled = (value === 'true' || value === true);
                const ttsToggleEl = document.getElementById('tts-toggle');
                if (ttsToggleEl) ttsToggleEl.checked = ttsEnabled;
                break;
            case 'ttsVoiceURI':
                ttsCurrentVoiceURI = value || '';
                const ttsVoiceSelectEl = document.getElementById('tts-voice-select');
                if (ttsVoiceSelectEl) ttsVoiceSelectEl.value = ttsCurrentVoiceURI;
                break;
            case 'replyLength':
                replyLength = value || 'default';
                const replyLengthSelectEl = document.getElementById('reply-length-select');
                if (replyLengthSelectEl) replyLengthSelectEl.value = replyLength;
                break;
        }
    }



    async function saveSettingToDB(key, value) {
    if (!db) return;
    const transaction = db.transaction(['settings'], 'readwrite');
    const store = transaction.objectStore('settings');
    store.put({ key: key, value: value });

    return new Promise((resolve, reject) => {
        transaction.oncomplete = () => resolve();
        transaction.onerror = (event) => reject(event.target.error);
    });
}
    


    async function loadAndApplySettingsFromDB() {
    if (!db) return;

    const transaction = db.transaction(['settings'], 'readonly');
    const store = transaction.objectStore('settings');
    const allSettingsRecords = await new Promise((resolve, reject) => {
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = (event) => reject(event.target.error);
    });

    const savedSettings = allSettingsRecords.reduce((map, setting) => {
        map[setting.key] = setting.value;
        return map;
    }, {});

    const settingsMap = {
        fontSize: fontSizeSlider,
        temperature: temperatureSlider,
        mainTextColor: mainTextColorPicker,
        dialogueColor: dialogueColorPicker,
        userBubbleColor: userBubbleColorPicker,
        userBubbleOpacity: userBubbleOpacitySlider,
        aiBubbleColor: aiBubbleColorPicker,
        aiBubbleOpacity: aiBubbleOpacitySlider,
        messageSpacing: spacingSlider,
        soundEnabled: soundToggle,
        thinkEnabled: thinkToggle,
        replyOptionsEnabled: replyOptionsToggle,
        blur: blurSlider,
        avatarSize: avatarSizeSlider,
        model: modelSelect,
        ttsEnabled: document.getElementById('tts-toggle'),
        ttsVoiceURI: document.getElementById('tts-voice-select'),
        replyLength: document.getElementById('reply-length-select'),
    };

    for (const key in defaultSettings) {
        const value = savedSettings[key] || defaultSettings[key];
        const inputElement = settingsMap[key];

        if (inputElement) {
            if (inputElement.type === 'checkbox') {
                inputElement.checked = (value === 'true' || value === true);
            } else {
                inputElement.value = value;
            }
        }
        applySetting(key, value);
    }

    if (savedSettings['suggestionModelId']) {
        applySetting('suggestionModelId', savedSettings['suggestionModelId']);
    }
}


// --- model selector ---
function populateModelSelector() {
    const previouslySelectedModel = modelSelect.value;

    modelSelect.innerHTML = '';
    appSettings.availableModels.forEach(model => {
        const option = document.createElement('option');
        option.value = model.id;
        option.textContent = model.name;
        modelSelect.appendChild(option);
    });

    modelSelect.value = previouslySelectedModel || defaultSettings.model;

    if (suggestionModelSelect) {
        const prevSuggModel = suggestionModelSelect.value;
        suggestionModelSelect.innerHTML = '<option value="">(same as chat model)</option>';
        appSettings.availableModels.forEach(model => {
            const option = document.createElement('option');
            option.value = model.id;
            option.textContent = model.name;
            suggestionModelSelect.appendChild(option);
        });
        suggestionModelSelect.value = prevSuggModel || suggestionModelId || '';
    }
}


// --- model list editor entry ---
function createModelEntry(model = {}) {
    const entryDiv = document.createElement('div');
    entryDiv.className = 'model-entry';

    const name = model.name || '';
    const id = model.id || '';
    const targetApiUrl = model.targetApiUrl || '';
    const apiKey = model.apiKey || '';
    const instructions = model.instructions || '';
    const reminder = model.reminder || '';
    const narratorReminder = model.narratorReminder || '';
    const numCtx = model.numCtx != null ? model.numCtx : '';

    entryDiv.innerHTML = `
    <div class="model-drag-handle" title="Drag to reorder">
        <svg width="14" height="12" viewBox="0 0 14 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
            <line x1="2" y1="2" x2="12" y2="2"/>
            <line x1="2" y1="6" x2="12" y2="6"/>
            <line x1="2" y1="10" x2="12" y2="10"/>
        </svg>
    </div>
    <div class="model-content-wrapper">
        <div class="model-entry-inputs">
            <input type="text" class="model-name-input" placeholder="Display Name (e.g., My favorite Model)" value="${name}">
            <input type="text" class="model-id-input" placeholder="Technical Model ID (e.g., provider/model-name)" value="${id}">
            <input type="url" class="model-target-api-url-input" placeholder="Other provider URL (https://.../v1/chat/completions)" value="${targetApiUrl}">
            <input type="password" class="model-api-key-input" placeholder="Other provider API Key (sk-1a2b3c...xyz)" value="${apiKey}">
            <input type="number" class="model-num-ctx-input" placeholder="Context length (only relevant for Ollama - e.g. 8192)" min="512" step="512" value="${numCtx}">
        </div>
        <details class="global-prompts-container">
            <summary class="global-prompts-summary">Global Prompts</summary>
            <div class="global-prompts-content">
                <label>AI Instructions:</label>
                <textarea class="model-instructions-input" rows="2" placeholder="General AI Instructions for this model... (e.g., 'Be creative and drive the plot forward.')">${instructions}</textarea>
                <label>Character Reminder:</label>
                <textarea class="model-reminder-input" rows="2" placeholder="Character Reminder for this model... (e.g., 'Reply only as {{char}} now.')">${reminder}</textarea>
                <label>Narrator Reminder:</label>
                <textarea class="model-narrator-reminder-input" rows="2" placeholder="Narrator Reminder for this model... (e.g., 'Reply only as an omniscient narrator now.')">${narratorReminder}</textarea>
            </div>
        </details>
    </div>
    <button type="button" class="delete-model-btn" title="Delete Model"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg></button>
    `;

    const textareas = entryDiv.querySelectorAll('.global-prompts-content textarea');
    textareas.forEach(textarea => {
        textarea.addEventListener('input', autoResizeTextarea);
    });

    const detailsContainer = entryDiv.querySelector('.global-prompts-container');
    detailsContainer.addEventListener('toggle', () => {
        if (detailsContainer.open) {
            textareas.forEach(textarea => {
                autoResizeTextarea({ target: textarea });
            });
        }
    });

    entryDiv.querySelector('.delete-model-btn').addEventListener('click', async () => {
        if (await showCustomConfirm('Are you sure you want to delete this model?', true)) {
            entryDiv.remove();
        }
    });

    const dragHandle = entryDiv.querySelector('.model-drag-handle');

    dragHandle.addEventListener('mousedown', () => {
        entryDiv.setAttribute('draggable', 'true');
    });

    entryDiv.addEventListener('dragstart', (e) => {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', '');
        setTimeout(() => entryDiv.classList.add('dragging'), 0);
        dragSrcEl = entryDiv;
    });

    entryDiv.addEventListener('dragend', () => {
        entryDiv.removeAttribute('draggable');
        entryDiv.classList.remove('dragging');
        document.querySelectorAll('.model-entry').forEach(el => {
            el.classList.remove('drag-over-top', 'drag-over-bottom');
        });
        dragSrcEl = null;
        if (dragScrollRAF) { cancelAnimationFrame(dragScrollRAF); dragScrollRAF = null; }
        dragScrollDir = 0;
    });

    entryDiv.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        if (!dragSrcEl || dragSrcEl === entryDiv) return;
        const rect = entryDiv.getBoundingClientRect();
        const midY = rect.top + rect.height / 2;
        entryDiv.classList.remove('drag-over-top', 'drag-over-bottom');
        if (e.clientY < midY) {
            entryDiv.classList.add('drag-over-top');
        } else {
            entryDiv.classList.add('drag-over-bottom');
        }
    });

    entryDiv.addEventListener('dragleave', (e) => {
        if (!entryDiv.contains(e.relatedTarget)) {
            entryDiv.classList.remove('drag-over-top', 'drag-over-bottom');
        }
    });

    entryDiv.addEventListener('drop', (e) => {
        e.preventDefault();
        if (!dragSrcEl || dragSrcEl === entryDiv) return;
        entryDiv.classList.remove('drag-over-top', 'drag-over-bottom');
        const rect = entryDiv.getBoundingClientRect();
        const midY = rect.top + rect.height / 2;
        if (e.clientY < midY) {
            modelListContainer.insertBefore(dragSrcEl, entryDiv);
        } else {
            modelListContainer.insertBefore(dragSrcEl, entryDiv.nextSibling);
        }
    });

    modelListContainer.appendChild(entryDiv);
}
