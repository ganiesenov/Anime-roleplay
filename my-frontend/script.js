// === Refactor step 0: DOMContentLoaded wrapper removed (scripts now load at end of <body>) ===
// Shared namespace for cross-file access (variant A: bare top-level names stay shared across <script> tags).
window.App = window.App || {};
document.body.style.opacity = '1';

// db -> declared in js/state.js (openDB below assigns the global)

// openDB -> moved to js/storage.js



// availableModels, APP_VERSION, DEFAULT_API_URL, defaultSettings -> moved to js/state.js

    // audioCtx, soundEnabled, thinkEnabled, replyOptionsEnabled, ttsEnabled,
    // ttsCurrentVoiceURI, replyLength, replyOptionsLoading, pendingReplyOptions,
    // replyOptionsReqId, suggestionModelId, characters, currentCharacterId,
    // tempUploadedImages, currentChatId, worldCharSelectedIds, activeGroupParticipantId,
    // personas, appSettings, currentStreamController -> moved to js/state.js
    const stopStreamBtn = document.getElementById('stop-stream-btn');

    

    // --- GET ELEMENTS ---
    const characterSelectionScreen = document.getElementById('character-selection-screen');
    const chatListScreen = document.getElementById('chat-list-screen');
    const chatScreen = document.getElementById('chat-screen');
    const newCharacterBtn = document.getElementById('new-character-btn');
    const searchInput = document.getElementById('search-input');
    const characterList = document.getElementById('character-list');
    const archiveSection = document.getElementById('archive-section');
    const archiveToggleBtn = document.getElementById('archive-toggle-btn');
    const archiveContent = document.getElementById('archive-content');
    const archivedCharacterList = document.getElementById('archived-character-list');
    const starsContainer = document.getElementById('stars-container');
    // Persona Management Elements
    const managePersonasBtn = document.getElementById('manage-personas-btn');
    const personaListModal = document.getElementById('persona-list-modal');
    const closePersonaListBtn = document.getElementById('close-persona-list-btn');
    const createNewPersonaBtn = document.getElementById('create-new-persona-btn');
    const personaEditorModal = document.getElementById('persona-editor-modal');
    const cancelPersonaEditBtn = document.getElementById('cancel-persona-edit-btn');
    const personaForm = document.getElementById('persona-form');
    const personaAvatarInput = document.getElementById('persona-avatar');
    const personaEditorAvatarImg = document.getElementById('persona-editor-avatar-img');
    const personaEditorAvatarPlaceholder = document.getElementById('persona-editor-avatar-placeholder');
    const personaListSearchInput = document.getElementById('persona-list-search-input');
    const personaEditorTokenCounter = document.getElementById('persona-editor-token-counter');
    // Persona Selection Elements
    const selectPersonaBtn = document.getElementById('select-persona-btn');
    const personaSelectionModal = document.getElementById('persona-selection-modal');
    const personaSelectionList = document.getElementById('persona-selection-list');
    const cancelPersonaSelectBtn = document.getElementById('cancel-persona-select-btn');
    // Other Elements
    const backToMainBtn = document.getElementById('back-to-main-btn');
    const backToSelectionBtn = document.getElementById('back-to-selection-btn');
    const chatSessionListDiv = document.getElementById('chat-session-list');
    const startNewChatBtn = document.getElementById('start-new-chat-btn');
    const editCharacterBtn = document.getElementById('edit-character-btn');
    const copyCharacterBtn = document.getElementById('copy-character-btn');
    const characterEditorModal = document.getElementById('character-editor-modal');
    const characterForm = document.getElementById('character-form');
    const cancelEditBtn = document.getElementById('cancel-edit-btn');
    const editingCharField = document.getElementById('editing-char-id');
    const characterEditorModalContent = document.getElementById('character-editor-modal-content');
    const chatWindow = document.getElementById('chat-window');
    const chatForm = document.getElementById('chat-form');
    const groupCharDropdown      = document.getElementById('group-char-dropdown');
    const groupCharBubble        = document.getElementById('group-char-bubble');
    const groupCharBubbleName    = document.getElementById('group-char-bubble-name');
    const groupCharBubbleDismiss = document.getElementById('group-char-bubble-dismiss');
    const messageInput = document.getElementById('message-input');
    const chatAvatar = document.getElementById('chat-avatar');
    const chatCharacterName = document.getElementById('chat-character-name');
    const exportBtn = document.getElementById('export-btn');
    const importBtn = document.getElementById('import-btn');
    const fileInput = document.getElementById('file-importer');
    const loadingIndicator = document.getElementById('loading-indicator');
    const messageEditorModal = document.getElementById('message-editor-modal');
    const dialogBtn = document.getElementById('dialog-btn');
    const storyBtn = document.getElementById('story-btn');
    const messageEditorTextarea = document.getElementById('message-editor-textarea');
    const saveMessageEditBtn = document.getElementById('save-message-edit-btn');
    const cancelMessageEditBtn = document.getElementById('cancel-message-edit-btn');
    const chatMemoriesBtn = document.getElementById('chat-memories-btn');
    const chatMemoriesModal = document.getElementById('chat-memories-modal');
    const chatMemoriesTextarea = document.getElementById('chat-memories-textarea');
    const saveMemoriesEditBtn = document.getElementById('save-memories-edit-btn');
    const cancelMemoriesEditBtn = document.getElementById('cancel-memories-edit-btn');
    if (dialogBtn) {
        dialogBtn.setAttribute('aria-label', 'Send as Character');
    }
    if (storyBtn) {
        storyBtn.setAttribute('aria-label', 'Send as Narrator');
    }
    const settingsBtn = document.getElementById('settings-btn');
    const settingsPanel = document.getElementById('settings-panel');
    const settingsContainer = document.getElementById('settings-container');
    const fontSizeSlider = document.getElementById('font-size-slider');
    const fontSizeValue = document.getElementById('font-size-value');
    const temperatureSlider = document.getElementById('temperature-slider');
    const temperatureValue = document.getElementById('temperature-value');
    const mainTextColorPicker = document.getElementById('main-text-color-picker');
    const dialogueColorPicker = document.getElementById('dialogue-color-picker');
    const userBubbleColorPicker = document.getElementById('user-bubble-color-picker');
    const userBubbleOpacitySlider = document.getElementById('user-bubble-opacity-slider');
    const userBubbleOpacityValue = document.getElementById('user-bubble-opacity-value');
    const aiBubbleColorPicker = document.getElementById('ai-bubble-color-picker');
    const aiBubbleOpacitySlider = document.getElementById('ai-bubble-opacity-slider');
    const aiBubbleOpacityValue = document.getElementById('ai-bubble-opacity-value');
    const resetSettingsBtn = document.getElementById('reset-settings-btn');
    const spacingSlider = document.getElementById('spacing-slider');
    const spacingValue = document.getElementById('spacing-value');
    const soundToggle = document.getElementById('sound-toggle');
    const thinkToggle = document.getElementById('think-toggle');
    const replyOptionsToggle = document.getElementById('reply-options-toggle');
    const scrollTopFab = document.getElementById('scroll-top-fab');
    const deleteCharacterBtnDashboard = document.getElementById('delete-character-btn-dashboard');
    const blurSlider = document.getElementById('blur-slider');
    const blurValue = document.getElementById('blur-value');
    const avatarSizeSlider = document.getElementById('avatar-size-slider');
    const avatarSizeValue = document.getElementById('avatar-size-value');
    const modelSelect = document.getElementById('model-select');
    const suggestionModelSelect = document.getElementById('suggestion-model-select');
    const MOBILE_BREAKPOINT_PX = 768;
    const MOBILE_FONT_SIZE_MAX = 24;
    const MOBILE_AVATAR_SIZE_MAX = 180;
    const DESKTOP_FONT_SIZE_MAX = fontSizeSlider ? Number(fontSizeSlider.max) || MOBILE_FONT_SIZE_MAX : MOBILE_FONT_SIZE_MAX;
    const DESKTOP_AVATAR_SIZE_MAX = avatarSizeSlider ? Number(avatarSizeSlider.max) || MOBILE_AVATAR_SIZE_MAX : MOBILE_AVATAR_SIZE_MAX;
    const responsiveViewportQuery = typeof window !== 'undefined' && window.matchMedia
        ? window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT_PX}px)`)
        : null;
    const chatAvatarPlaceholder = document.getElementById('chat-avatar-placeholder');
    const chatListAvatarPlaceholder = document.getElementById('chat-list-avatar-placeholder');
    chatListScreen.classList.add('is-inactive');
    chatScreen.classList.add('is-inactive');
    characterSelectionScreen.style.pointerEvents = 'auto';
    chatListScreen.style.pointerEvents = 'none';
    chatScreen.style.pointerEvents = 'none';
    starsContainer.style.pointerEvents = 'none';

    const tokenTooltip = document.getElementById('token-tooltip');
    const editorTokenCounter = document.getElementById('editor-token-counter');
    // Elements for the scenario selection modal
    const scenarioSelectionModal = document.getElementById('scenario-selection-modal');
    const scenarioSelectionList = document.getElementById('scenario-selection-list');
    const startEmptyChatBtn = document.getElementById('start-empty-chat-btn');
    const cancelScenarioSelectionBtn = document.getElementById('cancel-scenario-selection-btn');
    // Get upper editor buttons
    const saveEditBtnTop = document.getElementById('save-edit-btn-top');
    const cancelEditBtnTop = document.getElementById('cancel-edit-btn-top');
    // Get new elements for the editor
    const editorAvatarImg = document.getElementById('editor-avatar-img');
    const editorAvatarPlaceholder = document.getElementById('editor-avatar-placeholder');
    const charInstructionsInput = document.getElementById('char-instructions');
    const charDescriptionInput = document.getElementById('char-description');
    const charLoreInput = document.getElementById('char-lore');
    // World editor elements
    const cardTypeCharacterRadio = document.getElementById('type-character');
    const cardTypeWorldRadio = document.getElementById('type-world');
    const typeOptionCharacter = document.getElementById('type-option-character');
    const typeOptionWorld = document.getElementById('type-option-world');
    const editorAvatarUrlGroup = document.getElementById('editor-avatar-url-group');
    const worldCharPickerSection = document.getElementById('world-char-picker-section');
    const worldCharPickerList = document.getElementById('world-char-picker-list');
    const chatWorldBadge = document.getElementById('chat-world-badge');
    // Group Chat and search elements
    const addParticipantBtn = document.getElementById('add-participant-btn');
    const participantIconList = document.getElementById('participant-icon-list');
    const participantSelectionModal = document.getElementById('participant-selection-modal');
    const participantSelectionList = document.getElementById('participant-selection-list');
    const cancelParticipantSelectionBtn = document.getElementById('cancel-participant-selection-btn');
    const participantSearchInput = document.getElementById('participant-search-input');
    const personaSearchInput = document.getElementById('persona-search-input');
    // App Settings Modal Elements
    const appSettingsModal = document.getElementById('app-settings-modal');
    const appSettingsBtn = document.getElementById('app-settings-btn');
    const appSettingsForm = document.getElementById('app-settings-form');
    const modelListContainer = document.getElementById('model-list-container');
    const addModelBtn = document.getElementById('add-model-btn');
    const resetAppSettingsBtn = document.getElementById('reset-app-settings-btn');
    const cancelAppSettingsBtn = document.getElementById('cancel-app-settings-btn');
    const appSettingsModalContent = document.getElementById('app-settings-modal-content');
    let dragSrcEl = null;
    let dragScrollRAF = null;
    let dragScrollDir = 0;
    function updateDragScroll() {
        if (dragScrollDir !== 0) {
            appSettingsModalContent.scrollTop += dragScrollDir * 10;
            dragScrollRAF = requestAnimationFrame(updateDragScroll);
        } else {
            dragScrollRAF = null;
        }
    }
    document.addEventListener('dragover', (e) => {
        if (!dragSrcEl) return;
        const modalRect = appSettingsModalContent.getBoundingClientRect();
        if (e.clientY < modalRect.top + 80) {
            dragScrollDir = -1;
        } else if (e.clientY > modalRect.bottom - 80) {
            dragScrollDir = 1;
        } else {
            dragScrollDir = 0;
        }
        if (dragScrollDir !== 0 && !dragScrollRAF) {
            dragScrollRAF = requestAnimationFrame(updateDragScroll);
        }
    });





    // --- FUNCTIONS ---

// freezeLayout, unfreezeLayout, __freezeScrollY -> moved to js/utils.js



// showCustomAlert, showCustomPrompt, showCustomLargePrompt, showCustomConfirm, showChoiceDialog -> moved to js/dialogs.js



// extractDataFromPng, sanitizeCardNotes, convertExternalCardToCCC -> moved to js/cards.js



  function adjustFontSizeToFit(element) {
    const MIN_FONT_SIZE = 8;
    const inner = element.querySelector('span') || element;

    element.style.fontSize = '';

    // Element has no layout (inside a hidden/collapsed parent) — skip
    if (element.clientHeight <= 0) return;

    const style = window.getComputedStyle(element);
    const paddingV = parseFloat(style.paddingTop) + parseFloat(style.paddingBottom);
    const maxHeight = element.clientHeight - paddingV;

    let size = parseFloat(style.fontSize);
    while (size > MIN_FONT_SIZE) {
      if (inner.scrollHeight <= maxHeight) break;
      size -= 1;
      element.style.fontSize = size + 'px';
    }
  }



    function getImageUrl(source) {
  if (source instanceof Blob) {
    return URL.createObjectURL(source);
  }
  return source || ''; 
}



// smartObjectFit, smartObjectFitAll, applyCharPlaceholder, applyUserPlaceholder -> moved to js/utils.js



// APP settings + design settings + saveSettingToDB/loadAndApplySettingsFromDB -> moved to js/settings.js


function enforceResponsiveSettingLimits() {
    if (!fontSizeSlider || !avatarSizeSlider) return;

    const isMobileViewport = responsiveViewportQuery
        ? responsiveViewportQuery.matches
        : (typeof window !== 'undefined' ? window.innerWidth <= MOBILE_BREAKPOINT_PX : false);
    const targetFontMax = isMobileViewport ? MOBILE_FONT_SIZE_MAX : DESKTOP_FONT_SIZE_MAX;
    const targetAvatarMax = isMobileViewport ? MOBILE_AVATAR_SIZE_MAX : DESKTOP_AVATAR_SIZE_MAX;

    if (Number(fontSizeSlider.max) !== targetFontMax) {
        fontSizeSlider.max = String(targetFontMax);
    }

    if (Number(avatarSizeSlider.max) !== targetAvatarMax) {
        avatarSizeSlider.max = String(targetAvatarMax);
    }

    if (Number(fontSizeSlider.value) > targetFontMax) {
        fontSizeSlider.value = String(targetFontMax);
    }

    if (Number(avatarSizeSlider.value) > targetAvatarMax) {
        avatarSizeSlider.value = String(targetAvatarMax);
    }

    applySetting('fontSize', fontSizeSlider.value);
    applySetting('avatarSize', avatarSizeSlider.value);
}


function autoResizeTextarea(event) {
    const ta = event.target;
    if (!ta) return;

    const modalContent = ta.closest('.modal-content');
    const originalScrollTop = modalContent ? modalContent.scrollTop : 0;
    const isMobileViewport = responsiveViewportQuery
        ? responsiveViewportQuery.matches
        : (typeof window !== 'undefined' ? window.innerWidth <= MOBILE_BREAKPOINT_PX : false);

    const cssMaxValue = getComputedStyle(ta).maxHeight;
    const cssMax = parseInt(cssMaxValue, 10);
    let maxH = Number.isFinite(cssMax) ? cssMax : Infinity;

    if (ta.id === 'message-input' && isMobileViewport && typeof window !== 'undefined') {
        if (typeof cssMaxValue === 'string' && /(?:d|s|l)?vh$/.test(cssMaxValue.trim()) && Number.isFinite(cssMax)) {
            maxH = window.innerHeight * (cssMax / 100);
        } else if (!Number.isFinite(maxH)) {
            maxH = window.innerHeight * 0.38;
        }
    }

    ta.style.height = 'auto';
    const sh = Math.ceil(ta.scrollHeight);
    const newH = Math.min(sh, maxH);
    ta.style.height = newH + 'px';

    if (ta.id === 'message-input') {
        ta.style.overflowY = (isMobileViewport && ta.scrollHeight > maxH) ? 'auto' : 'hidden';
    } else {
        ta.style.overflowY = (ta.scrollHeight > maxH ? 'auto' : 'hidden');
    }

    if (modalContent) {
        modalContent.scrollTop = originalScrollTop;
    }
}



    function handleTextareaEnter(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        document.getElementById('dialog-btn').click();
    }
}



function createAvatarWithEffect(imageUrl, size, altText = '') {
  const container = document.createElement('div');
  container.className = 'avatar-container';
  container.style.width = size;
  container.style.height = size;

  if (imageUrl) {
    container.style.backgroundImage = `url('${imageUrl}')`;
    container.innerHTML = `<img src="${imageUrl}" alt="${altText}" loading="lazy">`;
  } else {
    container.innerHTML = `<div class="placeholder-icon">👤</div>`;
  }
  return container;
}



    function handleExport() {
  if (
    Object.keys(characters).length === 0 &&
    Object.keys(personas).length === 0 &&
    !(appSettings && appSettings.availableModels && appSettings.availableModels.length > 0)
  ) {
    showCustomAlert("There is nothing to export.");
    return;
  }
  const settingsToExport = {
    availableModels: (appSettings && Array.isArray(appSettings.availableModels) ? appSettings.availableModels : []).map(m => ({
      name: m.name || "",
      id: m.id || "",
      instructions: m.instructions || "",
      reminder: m.reminder || "",
      narratorReminder: m.narratorReminder || ""
    }))
  };
  const exportData = {
    version: 3, 
    characters: characters,
    personas: personas,
    appSettings: settingsToExport
  };
  const dataStr = JSON.stringify(exportData, null, 2);
  const dataBlob = new Blob([dataStr], {type: "application/json"});
  const url = URL.createObjectURL(dataBlob);
  const link = document.createElement('a');
  link.href = url;
  const date = new Date().toISOString().slice(0, 10);
  link.download = `casualcharacterchat_export_${date}.json`; 
  link.click();
  URL.revokeObjectURL(url);
}



  async function handleFileImport(event) {
    const file = event.target.files[0];
    if (!file) { return; }

    if (file.type === 'image/png') {
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const arrayBuffer = e.target.result;
                const externalCardJson = extractDataFromPng(arrayBuffer);
                
                if (externalCardJson) {
                        if (await showCustomConfirm("Character Card PNG detected. Do you want to import this single character?")) {
            const { dataURL } = await imageFileToWebp(file, 0.80); 
            const newCharacter = convertExternalCardToCCC(externalCardJson, dataURL); 
            if (characters[newCharacter.id]) {
                                showCustomAlert("A character with a similar generated ID already exists. Import aborted to prevent overwrite.");
                                return;
                            }
                            characters[newCharacter.id] = newCharacter;
                            await saveSingleCharacterToDB(newCharacter);
                            renderCharacterList();
                            showCustomAlert(`Successfully imported "${newCharacter.name}" from PNG Character Card!`);
                        }
                } else {
                    showCustomAlert("This PNG file does not seem to contain any character data.");
                }
            } catch (error) {
                showCustomAlert("Error processing the PNG file: " + error.message);
            }
        };
        reader.readAsArrayBuffer(file);
    } 
    
    else if (file.type === 'application/json') {
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const importedData = JSON.parse(e.target.result);

                if (importedData.spec && importedData.spec.startsWith('chara_card_v')) {
                    if (await showCustomConfirm("Character Card JSON detected. Do you want to import this single character?")) {
                        const newCharacter = convertExternalCardToCCC(importedData, null); 
                        if (characters[newCharacter.id]) {
                           showCustomAlert("A character with a similar generated ID already exists. Import aborted.");
                           return;
                        }
                        characters[newCharacter.id] = newCharacter;
                        await saveSingleCharacterToDB(newCharacter);
                        renderCharacterList();
                        showCustomAlert(`Successfully imported "${newCharacter.name}" from PNG Character Card!`);
                    }
                }
                else if (importedData.version === 3 && importedData.characters) {
                    const importedChars = importedData.characters || {};
                    const importedPersonas = importedData.personas || {};
                    const importedAppSettings = importedData.appSettings || null;
                    if (await showCustomConfirm("JSON backup file detected. Do you want to merge the imported data with your current collection?")) {
                        const initialCharCount = Object.keys(characters).length;
                        const initialPersonaCount = Object.keys(personas).length;
                        let charsAdded = 0, personasAdded = 0, charsSkipped = 0, personasSkipped = 0;
                        for (const charId in importedChars) {
                    if (!characters[charId]) {
                        characters[charId] = importedChars[charId];
                        await saveSingleCharacterToDB(importedChars[charId]); 
                        charsAdded++;
                    } else { charsSkipped++; }
                }
                for (const personaId in importedPersonas) {
                            if (!personas[personaId]) {
                                personas[personaId] = importedPersonas[personaId];
                                personasAdded++;
                            } else { personasSkipped++; }
                        }
                        let modelsAdded = 0, modelsSkipped = 0, modelsHydrated = 0;
                        if (importedAppSettings) {
                           appSettings = appSettings || {};
                           appSettings.availableModels = Array.isArray(appSettings.availableModels) ? appSettings.availableModels : [];
                           const existingById = {};
                           (appSettings.availableModels || []).forEach(m => {
                               if (m && m.id) existingById[m.id] = m;
                           });
                           const incoming = Array.isArray(importedAppSettings.availableModels) ? importedAppSettings.availableModels : [];
                           incoming.forEach(m => {
                               if (m && m.id && !existingById[m.id]) {
                                   appSettings.availableModels.push({
                                       name: m.name || "", id: m.id || "",
                                       instructions: m.instructions || "", reminder: m.reminder || "", narratorReminder: m.narratorReminder || ""
                                   });
                                   modelsAdded++;
                               } else if (m && m.id && existingById[m.id]) {
                                   const target = existingById[m.id];
                                   let updated = false;
                                   if ((!target.instructions || target.instructions.trim() === "") && (m.instructions && m.instructions.trim() !== "")) {
                                       target.instructions = m.instructions; updated = true;
                                   }
                                   if ((!target.reminder || target.reminder.trim() === "") && (m.reminder && m.reminder.trim() !== "")) {
                                       target.reminder = m.reminder; updated = true;
                                   }
                                   if ((!target.narratorReminder || target.narratorReminder.trim() === "") && (m.narratorReminder && m.narratorReminder.trim() !== "")) {
                                       target.narratorReminder = m.narratorReminder; updated = true;
                                   }
                                   if (updated) { modelsHydrated++; } else { modelsSkipped++; }
                               } else { modelsSkipped++; }
                           });
                           if (db) {
                               const transaction = db.transaction(['settings'], 'readwrite');
                               const store = transaction.objectStore('settings');
                               store.put({ key: 'appSettings', value: appSettings });
                           }
                           populateModelSelector();
                           if (typeof createModelEntry === 'function') {
                               modelListContainer.innerHTML = '';
                               (appSettings.availableModels || []).forEach(model => createModelEntry(model));
                           }
                        }
                        await savePersonasToDB();
                        renderCharacterList();
                        if (!personaListModal.classList.contains('hidden')) { openPersonaListModal(); }
                        showCustomAlert(
    `Import Complete!\n\n` +
    `Added from file: ${charsAdded} characters, ${personasAdded} personas.\n` +
    `Skipped duplicates: ${charsSkipped} characters, ${personasSkipped} personas.\n\n` +
    (importedAppSettings ? `Models added: ${modelsAdded}, skipped: ${modelsSkipped}\nPrompts hydrated: ${modelsHydrated}` : ``)
);
                    }
                }
                else {
                    showCustomAlert("Unknown or unsupported JSON format.");
                }
            } catch (error) {
                showCustomAlert("Error reading the JSON file: " + error.message);
            }
        };
        reader.readAsText(file);
    } 
    else {
        showCustomAlert("Please select a valid .json or .png file.");
    }
    
    event.target.value = '';
}





// saveCharactersToDB, saveSingleCharacterToDB, deleteSingleCharacterFromDB,
// deleteMultipleCharactersFromDB, loadCharactersFromDB, savePersonasToDB -> moved to js/storage.js



// populateModelSelector -> moved to js/settings.js



// loadPersonasFromDB -> moved to js/storage.js



// renderCharacterList -> moved to js/characters.js



// CHAT core (list nav, memories, start/create chat, message render, send/regenerate/continue + streaming) -> moved to js/chat.js



// CHARACTER/WORLD editor + message-editor save -> moved to js/editor.js



function restoreLastSession() {
    const lastCharId = localStorage.getItem('activeCharacterId');
    const lastChatId = localStorage.getItem('activeChatId');

    if (lastCharId && lastChatId && characters[lastCharId] && characters[lastCharId].chats[lastChatId]) {
        startChat(lastCharId, lastChatId);
    } else if (lastCharId && characters[lastCharId]) {
        showChatList(lastCharId);
    } else {
    characterSelectionScreen.classList.remove('is-inactive');

    starsContainer.style.transition = 'none';
    starsContainer.classList.add('visible');
    setTimeout(() => {
        starsContainer.style.transition = 'opacity 0.5s ease-in-out';
    }, 10);
}
}






    // --- EVENT LISTENERS & INITIALIZATION ---
    



let currentUploadTargetId = null;
const uploadAvatarBtn = document.getElementById('upload-avatar-btn');
const uploadBgBtn = document.getElementById('upload-bg-btn');
const uploadPersonaAvatarBtn = document.getElementById('upload-persona-avatar-btn');
const imageUploader = document.getElementById('image-uploader');

uploadAvatarBtn.addEventListener('click', () => {
  currentUploadTargetId = 'char-avatar'; 
  imageUploader.click(); 
});

uploadBgBtn.addEventListener('click', () => {
  currentUploadTargetId = 'char-background'; 
  imageUploader.click(); 
});

uploadPersonaAvatarBtn.addEventListener('click', () => {
  currentUploadTargetId = 'persona-avatar';
  imageUploader.click();
});

imageUploader.addEventListener('change', async (event) => {
    if (!currentUploadTargetId) return;
    const file = event.target.files[0];
    if (!file) return;

    try {
        const { dataURL, blob, originalDataURL } = await imageFileToWebp(file, 0.80);
        const objectURL = URL.createObjectURL(blob);

        if (currentUploadTargetId === 'char-avatar') {
            tempUploadedImages.avatar = dataURL;
            tempUploadedImages.avatarOriginal = originalDataURL;
        } else if (currentUploadTargetId === 'char-background') {
            tempUploadedImages.background = dataURL;
            tempUploadedImages.backgroundOriginal = originalDataURL;
        } else if (currentUploadTargetId === 'persona-avatar') {
            tempUploadedImages.personaAvatar = dataURL;
            tempUploadedImages.personaAvatarOriginal = originalDataURL;
        }

        const targetInput = document.getElementById(currentUploadTargetId);
        if (targetInput) {
            targetInput.value = objectURL; 
            targetInput.dispatchEvent(new Event('input', { bubbles: true }));
        }
    } catch (error) {
        console.error("Error converting file to Data URL:", error);
        showCustomAlert("There was an error processing the image file.");
    }

    imageUploader.value = '';
    currentUploadTargetId = null;
});



const editorFieldsToMonitor = [
  'card-name', 'char-description', 'char-lore', 'char-instructions',
  'char-reminder', 'char-narrator-reminder'
];
editorFieldsToMonitor.forEach(id => {
  const element = document.getElementById(id);
  if (element) {
    element.addEventListener('input', updateEditorTokenCount);
    if (element.tagName === 'TEXTAREA') {
      element.addEventListener('input', autoResizeTextarea);
    }
  }
});

document.getElementById('scenario-editor-list').addEventListener('input', updateEditorTokenCount);

const personaEditorFieldsToMonitor = ['persona-name', 'persona-description'];
personaEditorFieldsToMonitor.forEach(id => {
    const element = document.getElementById(id);
    if (element) {
        element.addEventListener('input', updatePersonaEditorTokenCount);
        if (element.tagName === 'TEXTAREA') {
            element.addEventListener('input', autoResizeTextarea);
        }
    }

const personaAvatarInput = document.getElementById('persona-avatar');
const personaEditorAvatarImg = document.getElementById('persona-editor-avatar-img');
const personaEditorAvatarPlaceholder = document.getElementById('persona-editor-avatar-placeholder');
personaAvatarInput.addEventListener('input', () => {
    const url = personaAvatarInput.value;
    const container = document.getElementById('persona-editor-avatar-container'); 

    if (url) {
        personaEditorAvatarImg.src = url;
        smartObjectFit(personaEditorAvatarImg);
        personaEditorAvatarImg.classList.remove('hidden');
        personaEditorAvatarPlaceholder.classList.add('hidden');
        container.classList.add('effect-container');
        container.style.backgroundImage = `url('${url}')`;
    } else {
        personaEditorAvatarImg.classList.add('hidden');
        personaEditorAvatarPlaceholder.classList.remove('hidden');
        container.classList.remove('effect-container');
        container.style.backgroundImage = 'none';
    }
});

personaEditorAvatarImg.onerror = () => {
    personaEditorAvatarImg.classList.add('hidden');
    personaEditorAvatarPlaceholder.classList.remove('hidden');
    const container = personaEditorAvatarImg.parentElement;
    container.classList.remove('effect-container');
    container.style.backgroundImage = 'none';
};
});

    document.body.addEventListener('click', () => {
        if (!audioCtx) {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }
    }, { once: true });
    function addSettingListener(element, key, eventType = 'input') {
    const isCheckbox = element.type === 'checkbox';
    element.addEventListener(eventType, async () => {
        const value = isCheckbox ? element.checked.toString() : element.value;
        applySetting(key, value);
        await saveSettingToDB(key, value);
    });
}

    // --- NEW FEATURES ---

    // ── Feature F: Quick-Swap ──
    const quickSwapBtn = document.getElementById('quick-swap-btn');
    const quickSwapModal = document.getElementById('quick-swap-modal');
    const quickSwapCharacterList = document.getElementById('quick-swap-character-list');
    const quickSwapSearchInput = document.getElementById('quick-swap-search-input');
    const cancelQuickSwapBtn = document.getElementById('cancel-quick-swap-btn');

    function renderQuickSwapList(filter) {
        if (!quickSwapCharacterList) return;
        quickSwapCharacterList.innerHTML = '';
        const lc = (filter || '').toLowerCase();
        const items = Object.values(characters).filter(c =>
            c.id !== currentCharacterId && c.type !== 'world' && c.name.toLowerCase().includes(lc)
        ).sort((a, b) => a.name.localeCompare(b.name));
        if (!items.length) {
            quickSwapCharacterList.innerHTML = '<p style="text-align:center;opacity:0.6;padding:16px">No characters found.</p>';
            return;
        }
        items.forEach(c => {
            const item = document.createElement('button');
            item.className = 'participant-option-btn';
            const imageUrl = getImageUrl(c.avatar);
            const avatarHtml = `
    <img src="${imageUrl}" class="${c.avatar ? '' : 'hidden'}" onerror="this.style.display='none'; this.nextElementSibling.classList.remove('hidden');">
    <div class="placeholder-icon ${c.avatar ? 'hidden' : ''}">👤</div>`;
            item.innerHTML = avatarHtml;
            const nameSpan = document.createElement('span');
            nameSpan.textContent = c.name;
            item.appendChild(nameSpan);
            item.addEventListener('click', () => performQuickSwap(c.id));
            quickSwapCharacterList.appendChild(item);
        });
        smartObjectFitAll('.participant-option-btn img');
    }

    async function performQuickSwap(newCharId) {
        if (!currentCharacterId || !currentChatId) return;
        const oldChar = characters[currentCharacterId];
        const newChar = characters[newCharId];
        if (!oldChar || !newChar || !oldChar.chats || !oldChar.chats[currentChatId]) return;
        const chatToMove = oldChar.chats[currentChatId];
        if (!newChar.chats) newChar.chats = {};
        newChar.chats[currentChatId] = chatToMove;
        delete oldChar.chats[currentChatId];
        if (quickSwapModal) quickSwapModal.classList.add('hidden');
        await saveSingleCharacterToDB(oldChar);
        await saveSingleCharacterToDB(newChar);
        await startChat(newCharId, currentChatId);
    }

    if (quickSwapBtn) {
        quickSwapBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (quickSwapSearchInput) quickSwapSearchInput.value = '';
            renderQuickSwapList('');
            if (quickSwapModal) quickSwapModal.classList.remove('hidden');
        });
    }
    if (cancelQuickSwapBtn) cancelQuickSwapBtn.addEventListener('click', () => { if (quickSwapModal) quickSwapModal.classList.add('hidden'); });
    if (quickSwapModal) quickSwapModal.addEventListener('click', (e) => { if (e.target === quickSwapModal) quickSwapModal.classList.add('hidden'); });
    if (quickSwapSearchInput) quickSwapSearchInput.addEventListener('input', () => renderQuickSwapList(quickSwapSearchInput.value.trim()));

    // ── Feature A: Mood System ──
    const moodBtn = document.getElementById('mood-btn');
    const moodPickerEl = document.getElementById('mood-picker');

    const MOOD_EMOJIS = {
        Happy: '😊', Sad: '😢', Angry: '😠', Excited: '🤩',
        Nervous: '😰', Flirty: '😏', Tired: '😴', Curious: '🧐', Scared: '😨', Bored: '😑'
    };

    function updateMoodButton() {
        const chat = characters[currentCharacterId]?.chats?.[currentChatId];
        if (!moodBtn) return;
        const mood = chat?.mood || null;
        moodBtn.textContent = mood ? (MOOD_EMOJIS[mood] || '😊') : '😊';
        moodBtn.title = mood ? `Mood: ${mood}` : 'Set Character Mood';
        moodBtn.classList.toggle('mood-active', !!mood);
    }

    if (moodBtn) {
        moodBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (moodPickerEl) moodPickerEl.classList.toggle('hidden');
        });
    }
    document.addEventListener('click', (e) => {
        if (moodPickerEl && !moodPickerEl.classList.contains('hidden') &&
            !moodBtn?.contains(e.target) && !moodPickerEl.contains(e.target)) {
            moodPickerEl.classList.add('hidden');
        }
    });
    if (moodPickerEl) {
        moodPickerEl.addEventListener('click', async (e) => {
            const btn = e.target.closest('.mood-option');
            if (!btn) return;
            const mood = btn.dataset.mood || null;
            const chat = characters[currentCharacterId]?.chats?.[currentChatId];
            if (!chat) return;
            chat.mood = mood || null;
            moodPickerEl.classList.add('hidden');
            updateMoodButton();
            await saveSingleCharacterToDB(characters[currentCharacterId]);
        });
    }

    // ── Feature E: Ambient Particle Effects ──
    const particleCanvas = document.getElementById('particle-canvas');
    const particleCtx = particleCanvas ? particleCanvas.getContext('2d') : null;
    let particleAnimId = null;
    let particlesList = [];
    let currentParticleEffect = 'none';
    const particleBtn = document.getElementById('particle-btn');
    const particlePickerModal = document.getElementById('particle-picker-modal');
    const closeParticlePickerBtn = document.getElementById('close-particle-picker-btn');
    let particleIntensityLevel = 50;
    let intensityFactor = 1.0;
    const particleIntensitySlider = document.getElementById('particle-intensity-slider');
    const particleIntensityValue = document.getElementById('particle-intensity-value');
    const particleIntensityRow = document.getElementById('particle-intensity-row');

    const PARTICLE_EMOJIS = { none:'✨', snow:'❄️', rain:'🌧️', sparks:'🔥', fireflies:'🟢', sakura:'🌸', fog:'🌫️', steam:'♨️', aurora:'🌌', leaves:'🍂', darkness:'🌑' };
    function updateParticleButton() {
        if (!particleBtn) return;
        const effect = characters[currentCharacterId]?.particleEffect || 'none';
        particleBtn.textContent = PARTICLE_EMOJIS[effect] || '✨';
        particleBtn.title = effect !== 'none' ? `Effect: ${effect.charAt(0).toUpperCase()+effect.slice(1)}` : 'Ambient Effects';
        particleBtn.classList.toggle('particle-active', effect !== 'none');
    }

    let W = window.innerWidth, H = window.innerHeight;
    function resizeParticleCanvas() {
        if (!particleCanvas) return;
        W = window.innerWidth;
        H = window.innerHeight;
        particleCanvas.width = W;
        particleCanvas.height = H;
    }
    resizeParticleCanvas();
    window.addEventListener('resize', resizeParticleCanvas);

    function stopParticles() {
        if (particleAnimId) { cancelAnimationFrame(particleAnimId); particleAnimId = null; }
        if (particleCtx && particleCanvas) particleCtx.clearRect(0, 0, particleCanvas.width, particleCanvas.height);
        particlesList = [];
        currentParticleEffect = 'none';
    }

    function startParticles(effect, savedIntensity) {
        stopParticles();
        if (effect === 'none' || !particleCtx || !particleCanvas) return;
        if (savedIntensity !== undefined) {
            particleIntensityLevel = savedIntensity;
            intensityFactor = particleIntensityLevel / 50;
            if (particleIntensitySlider) particleIntensitySlider.value = particleIntensityLevel;
            if (particleIntensityValue) particleIntensityValue.textContent = particleIntensityLevel;
        }
        currentParticleEffect = effect;
        resizeParticleCanvas();

        if (effect === 'snow') {
            const BASE = 120;
            const spawnSnow = () => ({ x: Math.random()*W, y: Math.random()*H, r: Math.random()*4+1.5, s: Math.random()*1.2+0.4, drift: (Math.random()-0.5)*0.5, opacity: Math.random()*0.3+0.7 });
            for (let i = 0; i < Math.round(BASE * intensityFactor); i++) particlesList.push(spawnSnow());
            (function drawSnow() {
                if (currentParticleEffect !== 'snow') return;
                const target = Math.round(BASE * intensityFactor);
                while (particlesList.length < target) particlesList.push(spawnSnow());
                if (particlesList.length > target) particlesList.length = target;
                particleCtx.clearRect(0,0,W,H);
                particlesList.forEach(p => {
                    particleCtx.shadowBlur=8; particleCtx.shadowColor='rgba(200,230,255,0.7)';
                    particleCtx.fillStyle=`rgba(255,255,255,${Math.min(p.opacity*intensityFactor,1)})`;
                    particleCtx.strokeStyle='rgba(120,170,220,0.45)'; particleCtx.lineWidth=0.8;
                    particleCtx.beginPath(); particleCtx.arc(p.x,p.y,p.r,0,Math.PI*2);
                    particleCtx.fill(); particleCtx.stroke(); particleCtx.shadowBlur=0;
                    p.y+=p.s; p.x+=p.drift;
                    if (p.y>H) { p.y=-5; p.x=Math.random()*W; }
                    if (p.x<0||p.x>W) p.x=Math.random()*W;
                });
                particleAnimId = requestAnimationFrame(drawSnow);
            })();

        } else if (effect === 'rain') {
            const BASE = 150;
            const spawnRain = () => ({ x: Math.random()*W, y: Math.random()*H, len: Math.random()*25+15, s: Math.random()*6+10, opacity: Math.random()*0.35+0.55 });
            for (let i = 0; i < Math.round(BASE * intensityFactor); i++) particlesList.push(spawnRain());
            (function drawRain() {
                if (currentParticleEffect !== 'rain') return;
                const target = Math.round(BASE * intensityFactor);
                while (particlesList.length < target) particlesList.push(spawnRain());
                if (particlesList.length > target) particlesList.length = target;
                particleCtx.clearRect(0,0,W,H);
                particlesList.forEach(p => {
                    particleCtx.shadowBlur=3; particleCtx.shadowColor='rgba(0,0,0,0.25)';
                    particleCtx.strokeStyle=`rgba(180,220,255,${Math.min(p.opacity*intensityFactor,1)})`; particleCtx.lineWidth=1.5;
                    particleCtx.beginPath(); particleCtx.moveTo(p.x,p.y); particleCtx.lineTo(p.x-p.len*0.2,p.y+p.len); particleCtx.stroke();
                    particleCtx.shadowBlur=0;
                    p.y+=p.s; p.x-=p.s*0.2;
                    if (p.y>H) { p.y=-p.len; p.x=Math.random()*(W+50); }
                });
                particleAnimId = requestAnimationFrame(drawRain);
            })();

        } else if (effect === 'sparks') {
            const BASE = 140;
            const spawnSpark = () => ({ x: Math.random()*W, y: H+Math.random()*60, vx: (Math.random()-0.5)*6, vy: -(Math.random()*6+3), life: Math.random(), maxLife: Math.random()*0.75+0.5, r: Math.random()*4+1.5 });
            for (let i = 0; i < Math.round(BASE * intensityFactor); i++) particlesList.push(spawnSpark());
            (function drawSparks() {
                if (currentParticleEffect !== 'sparks') return;
                const target = Math.round(BASE * intensityFactor);
                while (particlesList.length < target) particlesList.push(spawnSpark());
                if (particlesList.length > target) particlesList.length = target;
                particleCtx.clearRect(0,0,W,H);
                const baseGrad=particleCtx.createLinearGradient(0,H,0,H-200);
                baseGrad.addColorStop(0,`rgba(255,55,0,${Math.min(0.25*intensityFactor,0.55)})`);
                baseGrad.addColorStop(0.45,`rgba(255,110,0,${Math.min(0.10*intensityFactor,0.22)})`);
                baseGrad.addColorStop(1,'rgba(255,60,0,0)');
                particleCtx.fillStyle=baseGrad; particleCtx.fillRect(0,H-200,W,200);
                particleCtx.globalCompositeOperation='lighter';
                particlesList.forEach(p => {
                    const t=p.life/p.maxLife;
                    let rv,gv,bv;
                    if (t>0.72){rv=255;gv=255;bv=Math.floor(220*(t-0.72)/0.28);}
                    else if (t>0.38){rv=255;gv=Math.floor(100+155*(t-0.38)/0.34);bv=0;}
                    else{rv=255;gv=Math.floor(70*t/0.38);bv=0;}
                    const alpha=Math.min(Math.min(1,t*2.2)*0.75*intensityFactor,1);
                    const gr=p.r*4.5;
                    const grad=particleCtx.createRadialGradient(p.x,p.y,0,p.x,p.y,gr);
                    grad.addColorStop(0,`rgba(255,255,220,${alpha})`);
                    grad.addColorStop(0.2,`rgba(${rv},${gv},${bv},${alpha*0.9})`);
                    grad.addColorStop(0.55,`rgba(${rv},${Math.floor(gv*0.4)},0,${alpha*0.35})`);
                    grad.addColorStop(1,'rgba(180,15,0,0)');
                    particleCtx.fillStyle=grad;
                    particleCtx.beginPath(); particleCtx.arc(p.x,p.y,gr,0,Math.PI*2); particleCtx.fill();
                    p.x+=p.vx; p.y+=p.vy; p.vy+=0.038; p.vx*=0.992; p.life-=0.007;
                    if (p.life<=0){p.x=Math.random()*W;p.y=H+Math.random()*20;p.vx=(Math.random()-0.5)*6;p.vy=-(Math.random()*6+3);p.life=p.maxLife;p.r=Math.random()*4+1.5;}
                });
                particleCtx.globalCompositeOperation='source-over';
                particleAnimId = requestAnimationFrame(drawSparks);
            })();

        } else if (effect === 'fireflies') {
            const BASE = 55;
            const spawnFirefly = () => ({ x: Math.random()*W, y: Math.random()*H, r: Math.random()*4+2.5, phase: Math.random()*Math.PI*2, vx: (Math.random()-0.5)*0.5, vy: (Math.random()-0.5)*0.5, hue: 55+Math.random()*30 });
            for (let i = 0; i < Math.round(BASE * intensityFactor); i++) particlesList.push(spawnFirefly());
            let ff = 0;
            (function drawFireflies() {
                if (currentParticleEffect !== 'fireflies') return;
                const target = Math.round(BASE * intensityFactor);
                while (particlesList.length < target) particlesList.push(spawnFirefly());
                if (particlesList.length > target) particlesList.length = target;
                particleCtx.clearRect(0,0,W,H); ff+=0.025;
                // Pass 1: additive soft outer halo, elongated along travel direction
                particleCtx.globalCompositeOperation='lighter';
                particlesList.forEach(p => {
                    const glow=(Math.sin(ff+p.phase)+1)/2;
                    if (glow<0.15) return;
                    const angle=Math.atan2(p.vy,p.vx);
                    const haloR=p.r*(2+glow*2);
                    particleCtx.save();
                    particleCtx.translate(p.x,p.y); particleCtx.rotate(angle); particleCtx.scale(1.4,0.65);
                    const hg=particleCtx.createRadialGradient(0,0,0,0,0,haloR);
                    hg.addColorStop(0,`hsla(${p.hue},100%,80%,${Math.min(glow*0.18*intensityFactor,1)})`);
                    hg.addColorStop(1,`hsla(${p.hue},100%,60%,0)`);
                    particleCtx.fillStyle=hg;
                    particleCtx.beginPath(); particleCtx.arc(0,0,haloR,0,Math.PI*2); particleCtx.fill();
                    particleCtx.restore();
                });
                particleCtx.globalCompositeOperation='source-over';
                // Pass 2: elongated body with shadowBlur shine + physics
                particlesList.forEach(p => {
                    const glow=(Math.sin(ff+p.phase)+1)/2;
                    const angle=Math.atan2(p.vy,p.vx);
                    const bodyR=p.r*Math.max(glow,0.2);
                    particleCtx.save();
                    particleCtx.translate(p.x,p.y); particleCtx.rotate(angle);
                    particleCtx.shadowBlur=14*glow+4; particleCtx.shadowColor=`hsla(${p.hue},100%,72%,${glow*0.6})`;
                    particleCtx.fillStyle=`hsla(${p.hue},100%,75%,${Math.min(0.2+glow*0.8*intensityFactor,1)})`;
                    particleCtx.beginPath(); particleCtx.ellipse(0,0,bodyR*1.5,bodyR*0.75,0,0,Math.PI*2); particleCtx.fill();
                    if (glow>0.35){
                        particleCtx.shadowBlur=4; particleCtx.shadowColor=`rgba(255,255,230,${glow*0.5})`;
                        particleCtx.fillStyle=`rgba(255,255,230,${Math.min(glow*0.85*intensityFactor,1)})`;
                        particleCtx.beginPath(); particleCtx.ellipse(0,0,bodyR*0.55,bodyR*0.32,0,0,Math.PI*2); particleCtx.fill();
                    }
                    particleCtx.shadowBlur=0;
                    particleCtx.restore();
                    p.x+=p.vx; p.y+=p.vy;
                    if (p.x<0||p.x>W) p.vx*=-1; if (p.y<0||p.y>H) p.vy*=-1;
                });
                particleCtx.shadowBlur=0;
                particleAnimId = requestAnimationFrame(drawFireflies);
            })();

        } else if (effect === 'sakura') {
            const BASE = 35;
            const spawnSakura = () => ({ x: Math.random()*W, y: Math.random()*H, r: Math.random()*10+7, s: Math.random()*0.7+0.25, drift: (Math.random()-0.5)*1.5, wobble: Math.random()*Math.PI*2, wobbleSpeed: Math.random()*0.03+0.01, rotation: Math.random()*Math.PI*2, rotSpeed: (Math.random()-0.5)*0.04, opacity: Math.random()*0.2+0.78 });
            for (let i = 0; i < Math.round(BASE * intensityFactor); i++) particlesList.push(spawnSakura());
            (function drawSakura() {
                if (currentParticleEffect !== 'sakura') return;
                const target = Math.round(BASE * intensityFactor);
                while (particlesList.length < target) particlesList.push(spawnSakura());
                if (particlesList.length > target) particlesList.length = target;
                particleCtx.clearRect(0,0,W,H);
                particlesList.forEach(p => {
                    p.wobble+=p.wobbleSpeed; p.rotation+=p.rotSpeed;
                    particleCtx.save();
                    particleCtx.translate(p.x,p.y); particleCtx.rotate(p.rotation);
                    const baseOpacity = Math.min(p.opacity * (0.5 + intensityFactor * 0.5), 1);
                    for (let k=0;k<5;k++){
                        particleCtx.save();
                        particleCtx.rotate(k*Math.PI*2/5);
                        const pg = particleCtx.createRadialGradient(0,-p.r*0.4,0,0,-p.r*0.4,p.r*0.85);
                        pg.addColorStop(0,`rgba(255,235,245,${baseOpacity})`);
                        pg.addColorStop(0.55,`rgba(255,185,215,${baseOpacity})`);
                        pg.addColorStop(1,`rgba(230,140,180,${baseOpacity*0.5})`);
                        particleCtx.fillStyle=pg;
                        particleCtx.strokeStyle=`rgba(210,120,155,${baseOpacity*0.55})`;
                        particleCtx.lineWidth=0.8;
                        particleCtx.beginPath();
                        const pr=p.r;
                        particleCtx.moveTo(0,0);
                        particleCtx.bezierCurveTo(-pr*0.5,-pr*0.15,-pr*0.48,-pr*0.65,-pr*0.18,-pr);
                        particleCtx.quadraticCurveTo(0,-pr*0.68,pr*0.18,-pr);
                        particleCtx.bezierCurveTo(pr*0.48,-pr*0.65,pr*0.5,-pr*0.15,0,0);
                        particleCtx.closePath();
                        particleCtx.fill();
                        particleCtx.stroke();
                        particleCtx.restore();
                    }
                    particleCtx.fillStyle=`rgba(255,150,180,${baseOpacity})`;
                    particleCtx.beginPath(); particleCtx.arc(0,0,p.r*0.15,0,Math.PI*2); particleCtx.fill();
                    particleCtx.restore();
                    p.y+=p.s; p.x+=Math.sin(p.wobble)*p.drift;
                    if (p.y>H+15){p.y=-15;p.x=Math.random()*W;}
                });
                particleAnimId = requestAnimationFrame(drawSakura);
            })();

        } else if (effect === 'fog') {
            const BASE = 30;
            const spawnFog = () => ({ x: Math.random()*W, y: H*0.15+Math.random()*H*0.9, rx: Math.random()*320+200, ry: Math.random()*110+65, opacity: Math.random()*0.18+0.13, vx: (Math.random()*0.5+0.1)*(Math.random()<0.5?1:-1), phase: Math.random()*Math.PI*2, layer: Math.floor(Math.random()*3) });
            for (let i = 0; i < Math.round(BASE * Math.max(intensityFactor, 0.3)); i++) particlesList.push(spawnFog());
            let fogT=0;
            (function drawFog() {
                if (currentParticleEffect !== 'fog') return;
                const target = Math.round(BASE * Math.max(intensityFactor, 0.3));
                while (particlesList.length < target) particlesList.push(spawnFog());
                if (particlesList.length > target) particlesList.length = target;
                particleCtx.clearRect(0,0,W,H); fogT+=0.003;
                [...particlesList].sort((a,b)=>a.layer-b.layer).forEach(p => {
                    const yOff=Math.sin(fogT+p.phase)*24;
                    particleCtx.save();
                    particleCtx.translate(p.x,p.y+yOff);
                    particleCtx.scale(1,p.ry/p.rx);
                    const scaledOpacity=Math.min(p.opacity*intensityFactor*2.5,0.85);
                    const grad=particleCtx.createRadialGradient(0,0,0,0,0,p.rx);
                    grad.addColorStop(0,`rgba(200,215,232,${scaledOpacity})`);
                    grad.addColorStop(0.42,`rgba(190,208,228,${scaledOpacity*0.62})`);
                    grad.addColorStop(1,`rgba(185,205,225,0)`);
                    particleCtx.fillStyle=grad;
                    particleCtx.beginPath(); particleCtx.arc(0,0,p.rx,0,Math.PI*2); particleCtx.fill();
                    particleCtx.restore();
                    p.x+=p.vx;
                    if (p.x<-p.rx*1.5) p.x=W+p.rx;
                    if (p.x>W+p.rx*1.5) p.x=-p.rx;
                });
                particleAnimId=requestAnimationFrame(drawFog);
            })();

        } else if (effect === 'steam') {
            const BASE = 55;
            const spawnSteam = () => ({ x: Math.random()*W, y: H*0.1+Math.random()*H, r: Math.random()*32+16, vy: -(Math.random()*0.95+0.3), vx: (Math.random()-0.5)*0.55, life: Math.random(), maxLife: Math.random()*0.75+0.45, opacity: Math.random()*0.17+0.1 });
            for (let i = 0; i < Math.round(BASE * intensityFactor); i++) particlesList.push(spawnSteam());
            (function drawSteam() {
                if (currentParticleEffect !== 'steam') return;
                const target = Math.round(BASE * intensityFactor);
                while (particlesList.length < target) particlesList.push(spawnSteam());
                if (particlesList.length > target) particlesList.length = target;
                particleCtx.clearRect(0,0,W,H);
                particlesList.forEach(p => {
                    const t=p.life/p.maxLife;
                    const cr=p.r+t*140;
                    const alpha=Math.min(p.opacity*intensityFactor*2.5*(1-t*t*0.82),0.7);
                    const grad=particleCtx.createRadialGradient(p.x,p.y,0,p.x,p.y,cr);
                    grad.addColorStop(0,`rgba(245,249,255,${alpha})`);
                    grad.addColorStop(0.38,`rgba(230,243,255,${alpha*0.58})`);
                    grad.addColorStop(1,`rgba(220,240,255,0)`);
                    particleCtx.fillStyle=grad;
                    particleCtx.beginPath(); particleCtx.arc(p.x,p.y,cr,0,Math.PI*2); particleCtx.fill();
                    p.y+=p.vy; p.x+=p.vx+Math.sin(p.life*7)*0.55; p.life+=0.0024;
                    if (p.life>=p.maxLife){p.x=Math.random()*W;p.y=H*0.45+Math.random()*H*0.65;p.life=0;p.r=Math.random()*32+16;p.maxLife=Math.random()*0.75+0.45;}
                });
                particleAnimId=requestAnimationFrame(drawSteam);
            })();

        } else if (effect === 'aurora') {
            const BASE = 5;
            const AURORA_HUES = [125, 155, 175, 195, 270, 300];
            const spawnBand = (i) => ({
                hue: AURORA_HUES[i % AURORA_HUES.length]+Math.random()*14-7,
                phase: Math.random()*Math.PI*2,
                phaseSpeed: (Math.random()*0.003+0.0008)*(Math.random()<0.5?1:-1),
                flickerPhase: Math.random()*Math.PI*2,
                flickerSpeed: Math.random()*0.018+0.006,
                ampFrac: Math.random()*0.055+0.025,
                freq: Math.random()*1.2+0.5,
                yFrac: 0.08+(i/Math.max(BASE,5))*0.28+Math.random()*0.04,
                thickFrac: Math.random()*0.075+0.045
            });
            for (let i = 0; i < Math.round(BASE * intensityFactor); i++) particlesList.push(spawnBand(i));
            (function drawAurora() {
                if (currentParticleEffect !== 'aurora') return;
                const target = Math.round(BASE * intensityFactor);
                while (particlesList.length < target) particlesList.push(spawnBand(particlesList.length));
                if (particlesList.length > target) particlesList.length = target;
                particleCtx.clearRect(0,0,W,H);
                particleCtx.globalCompositeOperation='lighter';
                particlesList.forEach(b => {
                    b.phase+=b.phaseSpeed; b.flickerPhase+=b.flickerSpeed;
                    const flicker=(Math.sin(b.flickerPhase)+1)/2;
                    const opacity=Math.min((0.05+flicker*0.09)*intensityFactor,0.9);
                    const yBase=b.yFrac*H, amp=b.ampFrac*H, thick=b.thickFrac*H;
                    const STEPS=90;
                    particleCtx.save();
                    particleCtx.beginPath();
                    for (let i=0;i<=STEPS;i++){const x=(i/STEPS)*W,y=yBase+Math.sin(x/W*Math.PI*2*b.freq+b.phase)*amp-thick*0.3;i===0?particleCtx.moveTo(x,y):particleCtx.lineTo(x,y);}
                    for (let i=STEPS;i>=0;i--){const x=(i/STEPS)*W,y=yBase+Math.sin(x/W*Math.PI*2*b.freq+b.phase)*amp+thick*1.5;particleCtx.lineTo(x,y);}
                    particleCtx.closePath();
                    const grad=particleCtx.createLinearGradient(0,yBase-thick*0.5,0,yBase+thick*1.8);
                    grad.addColorStop(0,`hsla(${b.hue},100%,80%,0)`);
                    grad.addColorStop(0.2,`hsla(${b.hue},100%,75%,${opacity})`);
                    grad.addColorStop(0.6,`hsla(${b.hue},100%,60%,${opacity*0.45})`);
                    grad.addColorStop(1,`hsla(${b.hue},100%,50%,0)`);
                    particleCtx.fillStyle=grad; particleCtx.fill(); particleCtx.restore();
                });
                particleCtx.globalCompositeOperation='source-over';
                particleAnimId=requestAnimationFrame(drawAurora);
            })();

        } else if (effect === 'leaves') {
            const BASE = 40;
            const LEAF_PALETTE = [{h:88,s:52,l:36},{h:102,s:57,l:38},{h:118,s:48,l:34},{h:92,s:62,l:42},{h:108,s:55,l:40},{h:74,s:62,l:44},{h:79,s:58,l:46},{h:50,s:72,l:54},{h:54,s:68,l:50},{h:26,s:78,l:52},{h:28,s:80,l:48},{h:22,s:76,l:50},{h:30,s:72,l:48},{h:9,s:66,l:46},{h:13,s:70,l:44},{h:27,s:42,l:38}];
            const spawnLeaf = () => { const c=LEAF_PALETTE[Math.floor(Math.random()*LEAF_PALETTE.length)]; return {x:Math.random()*W,y:Math.random()*H,r:Math.random()*15+10,aspect:Math.random()*0.2+0.45,vy:Math.random()*0.9+0.35,drift:(Math.random()-0.5)*0.5,wobble:Math.random()*Math.PI*2,wobbleSpeed:Math.random()*0.022+0.008,rotation:Math.random()*Math.PI*2,rotSpeed:(Math.random()-0.5)*0.04,h:c.h,sat:c.s,l:c.l,opacity:Math.random()*0.2+0.75}; };
            for (let i = 0; i < Math.round(BASE * intensityFactor); i++) particlesList.push(spawnLeaf());
            (function drawLeaves() {
                if (currentParticleEffect !== 'leaves') return;
                const target = Math.round(BASE * intensityFactor);
                while (particlesList.length < target) particlesList.push(spawnLeaf());
                if (particlesList.length > target) particlesList.length = target;
                particleCtx.clearRect(0,0,W,H);
                particlesList.forEach(p => {
                    p.wobble+=p.wobbleSpeed; p.rotation+=p.rotSpeed;
                    p.x+=p.drift+Math.sin(p.wobble)*0.35; p.y+=p.vy;
                    if (p.y>H+p.r*2){p.y=-p.r*2;p.x=Math.random()*W;}
                    if (p.x<-p.r*2) p.x=W+p.r*2; if (p.x>W+p.r*2) p.x=-p.r*2;
                    const baseOp=Math.min(p.opacity*(0.5+intensityFactor*0.5),1);
                    particleCtx.save();
                    particleCtx.translate(p.x,p.y); particleCtx.rotate(p.rotation);
                    const lg=particleCtx.createLinearGradient(0,-p.r,0,p.r);
                    lg.addColorStop(0,`hsla(${p.h},${p.sat}%,${Math.min(p.l+10,65)}%,${baseOp})`);
                    lg.addColorStop(1,`hsla(${p.h},${p.sat}%,${Math.max(p.l-8,20)}%,${baseOp})`);
                    particleCtx.fillStyle=lg;
                    particleCtx.strokeStyle=`hsla(${p.h},${p.sat-10}%,${p.l-18}%,${baseOp*0.45})`;
                    particleCtx.lineWidth=0.5;
                    particleCtx.beginPath();
                    particleCtx.moveTo(0,-p.r);
                    particleCtx.bezierCurveTo(p.r*p.aspect,-p.r*0.25,p.r*p.aspect,p.r*0.25,0,p.r);
                    particleCtx.bezierCurveTo(-p.r*p.aspect,p.r*0.25,-p.r*p.aspect,-p.r*0.25,0,-p.r);
                    particleCtx.closePath(); particleCtx.fill(); particleCtx.stroke();
                    particleCtx.strokeStyle=`hsla(${p.h},${p.sat-15}%,${p.l-22}%,${baseOp*0.3})`;
                    particleCtx.lineWidth=0.55;
                    particleCtx.beginPath(); particleCtx.moveTo(0,-p.r*0.8); particleCtx.lineTo(0,p.r*0.8); particleCtx.stroke();
                    particleCtx.restore();
                });
                particleAnimId=requestAnimationFrame(drawLeaves);
            })();

        } else if (effect === 'darkness') {
            const BASE = 18;
            const spawnWisp = () => ({x:Math.random()*W,y:Math.random()*H,r:Math.random()*220+100,vx:(Math.random()-0.5)*0.22,vy:(Math.random()-0.5)*0.14,pulsePhase:Math.random()*Math.PI*2,pulseSpeed:Math.random()*0.007+0.003,baseOp:Math.random()*0.18+0.12,purple:Math.random()<0.28});
            for (let i = 0; i < Math.round(BASE * intensityFactor); i++) particlesList.push(spawnWisp());
            (function drawDarkness() {
                if (currentParticleEffect !== 'darkness') return;
                const target = Math.round(BASE * intensityFactor);
                while (particlesList.length < target) particlesList.push(spawnWisp());
                if (particlesList.length > target) particlesList.length = target;
                particleCtx.clearRect(0,0,W,H);
                particleCtx.fillStyle=`rgba(0,0,0,${Math.min(0.25*intensityFactor,0.6)})`; particleCtx.fillRect(0,0,W,H);
                particlesList.forEach(p => {
                    p.pulsePhase+=p.pulseSpeed;
                    const pulse=(Math.sin(p.pulsePhase)+1)/2;
                    const op=Math.min((p.baseOp+pulse*0.1)*intensityFactor,0.75);
                    const r=p.r*(0.82+pulse*0.28);
                    const grad=particleCtx.createRadialGradient(p.x,p.y,0,p.x,p.y,r);
                    if (p.purple){grad.addColorStop(0,`rgba(12,0,22,${op})`);grad.addColorStop(0.55,`rgba(6,0,12,${op*0.5})`);}
                    else{grad.addColorStop(0,`rgba(0,0,0,${op})`);grad.addColorStop(0.55,`rgba(0,0,2,${op*0.45})`);}
                    grad.addColorStop(1,'rgba(0,0,0,0)');
                    particleCtx.fillStyle=grad; particleCtx.beginPath(); particleCtx.arc(p.x,p.y,r,0,Math.PI*2); particleCtx.fill();
                    p.x+=p.vx; p.y+=p.vy;
                    if (p.x<-p.r) p.x=W+p.r; if (p.x>W+p.r) p.x=-p.r;
                    if (p.y<-p.r) p.y=H+p.r; if (p.y>H+p.r) p.y=-p.r;
                });
                const vig=particleCtx.createRadialGradient(W/2,H/2,H*0.25,W/2,H/2,Math.max(W,H)*0.8);
                vig.addColorStop(0,'rgba(0,0,0,0)');
                vig.addColorStop(1,`rgba(0,0,0,${Math.min(0.4*intensityFactor,0.7)})`);
                particleCtx.fillStyle=vig; particleCtx.fillRect(0,0,W,H);
                particleAnimId=requestAnimationFrame(drawDarkness);
            })();
        }
    }

    if (particleBtn) {
        particleBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const character = characters[currentCharacterId];
            if (particlePickerModal) {
                const currentEffect = character?.particleEffect || 'none';
                particlePickerModal.querySelectorAll('.particle-option-btn').forEach(b => {
                    b.classList.toggle('active', b.dataset.effect === currentEffect);
                });
                const savedLevel = character?.particleIntensityLevel ?? 50;
                particleIntensityLevel = savedLevel;
                intensityFactor = particleIntensityLevel / 50;
                if (particleIntensitySlider) particleIntensitySlider.value = particleIntensityLevel;
                if (particleIntensityValue) particleIntensityValue.textContent = particleIntensityLevel;
                if (particleIntensityRow) particleIntensityRow.classList.toggle('hidden', currentEffect === 'none');
                particlePickerModal.classList.remove('hidden');
            }
        });
    }
    if (closeParticlePickerBtn) closeParticlePickerBtn.addEventListener('click', () => { if (particlePickerModal) particlePickerModal.classList.add('hidden'); });
    if (particleIntensitySlider) {
        particleIntensitySlider.addEventListener('input', async () => {
            particleIntensityLevel = parseInt(particleIntensitySlider.value, 10);
            intensityFactor = particleIntensityLevel / 50;
            if (particleIntensityValue) particleIntensityValue.textContent = particleIntensityLevel;
            const character = characters[currentCharacterId];
            if (character) {
                character.particleIntensityLevel = particleIntensityLevel;
                await saveSingleCharacterToDB(character);
            }
        });
    }
    if (particlePickerModal) {
        particlePickerModal.addEventListener('click', async (e) => {
            if (e.target === particlePickerModal) { particlePickerModal.classList.add('hidden'); return; }
            const btn = e.target.closest('.particle-option-btn');
            if (!btn) return;
            const effect = btn.dataset.effect;
            const character = characters[currentCharacterId];
            if (!character) return;
            character.particleEffect = effect;
            particlePickerModal.querySelectorAll('.particle-option-btn').forEach(b => b.classList.toggle('active', b.dataset.effect === effect));
            if (particleIntensityRow) particleIntensityRow.classList.toggle('hidden', effect === 'none');
            await saveSingleCharacterToDB(character);
            startParticles(effect);
            updateParticleButton();
        });
    }

    // ── Feature B: Background Music ──
    const musicBtn = document.getElementById('music-btn');
    const musicPanel = document.getElementById('music-panel');
    const musicUrlInput = document.getElementById('music-url-input');
    const musicPlayBtn = document.getElementById('music-play-btn');
    const musicStopBtn = document.getElementById('music-stop-btn');
    let musicAudioEl = null;
    let musicIframeEl = null;
    let musicIsPlaying = false;

    function extractYouTubeId(url) {
        const m = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|v\/))([A-Za-z0-9_-]{11})/);
        return m ? m[1] : null;
    }

    function stopMusic() {
        if (musicAudioEl) {
            musicAudioEl.pause();
            musicAudioEl.currentTime = 0;
            musicAudioEl.src = '';
            musicAudioEl.remove();
            musicAudioEl = null;
        }
        if (musicIframeEl) {
            musicIframeEl.src = '';
            musicIframeEl.remove();
            musicIframeEl = null;
        }
        musicIsPlaying = false;
        if (musicPlayBtn) musicPlayBtn.textContent = '▶ Play';
    }

    function pauseMusic() {
        if (musicAudioEl) musicAudioEl.pause();
        if (musicIframeEl) musicIframeEl.contentWindow.postMessage(JSON.stringify({ event: 'command', func: 'pauseVideo', args: [] }), '*');
        musicIsPlaying = false;
        if (musicPlayBtn) musicPlayBtn.textContent = '▶ Play';
    }

    function resumeMusic() {
        if (musicAudioEl) musicAudioEl.play().catch(() => {});
        if (musicIframeEl) musicIframeEl.contentWindow.postMessage(JSON.stringify({ event: 'command', func: 'playVideo', args: [] }), '*');
        musicIsPlaying = true;
        if (musicPlayBtn) musicPlayBtn.textContent = '⏸ Pause';
    }

    function playMusic(url) {
        stopMusic();
        if (!url) return;
        const ytId = extractYouTubeId(url);
        if (ytId) {
            musicIframeEl = document.createElement('iframe');
            musicIframeEl.src = `https://www.youtube.com/embed/${ytId}?autoplay=1&loop=1&playlist=${ytId}&enablejsapi=1`;
            musicIframeEl.allow = 'autoplay';
            musicIframeEl.style.cssText = 'display:none;width:0;height:0;border:0;position:absolute;';
            document.body.appendChild(musicIframeEl);
            musicIsPlaying = true;
            if (musicPlayBtn) musicPlayBtn.textContent = '⏸ Pause';
        } else {
            const audio = document.createElement('audio');
            audio.src = url;
            audio.loop = true;
            document.body.appendChild(audio);
            musicAudioEl = audio;
            audio.play().catch(() => {
                musicIsPlaying = false;
                if (musicPlayBtn) musicPlayBtn.textContent = '▶ Play';
            });
            musicIsPlaying = true;
            if (musicPlayBtn) musicPlayBtn.textContent = '⏸ Pause';
        }
    }

    if (musicBtn) {
        musicBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (musicPanel) musicPanel.classList.toggle('hidden');
        });
    }
    document.addEventListener('click', (e) => {
        if (musicPanel && !musicPanel.classList.contains('hidden') &&
            !musicBtn?.contains(e.target) && !musicPanel.contains(e.target)) {
            musicPanel.classList.add('hidden');
        }
    });
    if (musicPlayBtn) {
        musicPlayBtn.addEventListener('click', () => {
            if (musicIsPlaying) {
                pauseMusic();
            } else {
                if (musicAudioEl || musicIframeEl) {
                    resumeMusic();
                } else if (musicUrlInput) {
                    playMusic(musicUrlInput.value.trim());
                }
            }
        });
    }
    if (musicStopBtn) musicStopBtn.addEventListener('click', stopMusic);
    if (musicUrlInput) {
        musicUrlInput.addEventListener('input', () => {
            const val = musicUrlInput.value.trim();
            const charId = currentCharacterId;
            if (!charId) return;
            if (val) {
                localStorage.setItem(`userMusicUrl:${charId}`, val);
            } else {
                localStorage.removeItem(`userMusicUrl:${charId}`);
            }
        });
    }
    // Mark Feature B as ready; auto-play if a URL was already populated during startChat
    window._musicFeatureReady = true;
    const _initMusicUrl = musicUrlInput ? musicUrlInput.value.trim() : '';
    if (_initMusicUrl && currentCharacterId) playMusic(_initMusicUrl);

    // ── Feature C: TTS ──
    function populateTTSVoices() {
        if (!('speechSynthesis' in window)) return;
        const sel = document.getElementById('tts-voice-select');
        if (!sel) return;
        const voices = speechSynthesis.getVoices();
        sel.innerHTML = '<option value="">(Default voice)</option>';
        const groups = [
            { prefix: 'en', label: 'English', voices: [] },
            { prefix: 'de', label: 'German', voices: [] },
            { prefix: 'ja', label: 'Japanese', voices: [] },
        ];
        voices.forEach(v => {
            const lang = v.lang.toLowerCase();
            const g = groups.find(gr => lang.startsWith(gr.prefix));
            if (g) g.voices.push(v);
        });
        groups.forEach(g => {
            if (!g.voices.length) return;
            const og = document.createElement('optgroup');
            og.label = g.label;
            g.voices.forEach(v => {
                const opt = document.createElement('option');
                opt.value = v.voiceURI;
                opt.textContent = `${v.name} (${v.lang})`;
                og.appendChild(opt);
            });
            sel.appendChild(og);
        });
        if (ttsCurrentVoiceURI) sel.value = ttsCurrentVoiceURI;
    }
    if ('speechSynthesis' in window) {
        speechSynthesis.onvoiceschanged = populateTTSVoices;
        populateTTSVoices();
    }

    function speakText(text, messageId) {
        if (!('speechSynthesis' in window)) return;
        speechSynthesis.cancel();
        if (!text) return;
        const utter = new SpeechSynthesisUtterance(text);
        const sel = document.getElementById('tts-voice-select');
        const voiceURI = sel?.value || ttsCurrentVoiceURI;
        if (voiceURI) {
            const voice = speechSynthesis.getVoices().find(v => v.voiceURI === voiceURI);
            if (voice) utter.voice = voice;
        }
        const btn = messageId ? document.querySelector(`[data-message-id="${messageId}"] .tts-btn`) : null;
        if (btn) btn.textContent = '⏹';
        utter.onend = () => { if (btn) btn.textContent = '🔊'; };
        speechSynthesis.speak(utter);
    }

    const ttsToggleEl2 = document.getElementById('tts-toggle');
    const ttsVoiceSelectEl2 = document.getElementById('tts-voice-select');
    if (ttsToggleEl2) addSettingListener(ttsToggleEl2, 'ttsEnabled', 'change');
    if (ttsVoiceSelectEl2) addSettingListener(ttsVoiceSelectEl2, 'ttsVoiceURI', 'change');



    // ── Feature E: Reply Length ──
    const replyLengthSelectEl2 = document.getElementById('reply-length-select');
    if (replyLengthSelectEl2) addSettingListener(replyLengthSelectEl2, 'replyLength', 'change');

    let lastDeletedSnapshot = null;

    function showUndoDeleteFab() {
        chatWindow.querySelectorAll('.inline-undo-delete').forEach(el => el.remove());
        const wrapper = document.createElement('div');
        wrapper.className = 'inline-undo-delete';
        const btn = document.createElement('button');
        btn.className = 'inline-undo-delete-btn';
        btn.textContent = '↩ Undo Delete';
        btn.addEventListener('click', undoDeleteAction);
        wrapper.appendChild(btn);
        chatWindow.appendChild(wrapper);
        chatWindow.scrollTop = chatWindow.scrollHeight;
    }

    function hideUndoDeleteFab() {
        chatWindow.querySelectorAll('.inline-undo-delete').forEach(el => el.remove());
        lastDeletedSnapshot = null;
    }

    async function undoDeleteAction() {
        if (!lastDeletedSnapshot) return;
        const { charId, chatId, fromIndex, messages } = lastDeletedSnapshot;
        const chat = characters[charId]?.chats?.[chatId];
        if (!chat) { hideUndoDeleteFab(); return; }
        chat.history.splice(fromIndex, 0, ...messages);
        await saveSingleCharacterToDB(characters[charId]);
        updateTokenCount();
        const currentScroll = chatWindow.scrollTop;
        startChat(charId, chatId);
        chatWindow.scrollTop = currentScroll;
        hideUndoDeleteFab();
    }

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

    newCharacterBtn.addEventListener('click', openEditorForNew);
    editCharacterBtn.addEventListener('click', openEditorForEdit);
    copyCharacterBtn.addEventListener('click', handleCopyCharacter);
    searchInput.addEventListener('input', () => {
    const searchTerm = searchInput.value.trim();
    renderCharacterList(searchTerm);
});

document.getElementById('tag-search-input').addEventListener('input', () => {
    renderCharacterList();
});



appSettingsBtn.addEventListener('click', () => {
    loadAppSettingsFromDB();
    appSettingsModal.classList.remove('hidden');
});

appSettingsForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    await saveAppSettings();
});

cancelAppSettingsBtn.addEventListener('click', () => {
    appSettingsModalContent.scrollTop = 0;
    appSettingsModal.classList.add('hidden');
});

addModelBtn.addEventListener('click', () => {
    createModelEntry();
});
resetAppSettingsBtn.addEventListener('click', resetAppSettings);



async function toggleArchiveState(charId) {
    const character = characters[charId];
    if (!character) return;

    character.isArchived = !character.isArchived;
    if (character.isArchived) character.isFavorite = false;

    await saveSingleCharacterToDB(character);

    const card = document.querySelector(`.character-card[data-char-id="${charId}"]`);
    if (!card) { renderCharacterList(searchInput.value.trim()); return; }

    const archiveBtn = card.querySelector('.archive-btn');
    const upIcon   = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"/></svg>`;
    const downIcon = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>`;
    const starSvg  = `<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>`;

    function insertCardSorted(card, name, list) {
        const existing = [...list.querySelectorAll('.character-card')];
        for (const el of existing) {
            if (name.localeCompare(characters[el.dataset.charId]?.name || '', 'de', { sensitivity: 'base' }) <= 0) {
                list.insertBefore(card, el); return;
            }
        }
        list.appendChild(card);
    }

    if (character.isArchived) {
        archiveBtn.innerHTML = upIcon;
        archiveBtn.title = 'Retrieve from the archive';
        card.querySelector('.favorite-btn')?.remove();

        // Remove from favorites bar
        const favBar = document.getElementById('favorites-bar');
        const favItem = favBar?.querySelector(`[data-char-id="${charId}"]`);
        if (favItem) {
            favItem.remove();
            if (!favBar.querySelector('.favorite-item')) {
                favBar.innerHTML = `<span class="favorites-placeholder">No Favorites selected</span>`;
            }
        }

        insertCardSorted(card, character.name, archivedCharacterList);
        archiveSection.classList.remove('hidden');
    } else {
        archiveBtn.innerHTML = downIcon;
        archiveBtn.title = 'Archive Character';

        const favBtn = document.createElement('button');
        favBtn.className = 'favorite-btn';
        favBtn.title = 'Mark as Favorite';
        favBtn.innerHTML = starSvg;
        card.insertBefore(favBtn, card.firstChild);

        insertCardSorted(card, character.name, characterList);
        if (!archivedCharacterList.querySelector('.character-card')) {
            archiveSection.classList.add('hidden');
        }
    }
}



characterList.addEventListener('click', async (event) => {
    if (event.target.classList.contains('favorite-btn')) {
        event.stopPropagation();
        const card = event.target.closest('.character-card');
        const charId = card.dataset.charId;
        const character = characters[charId];
        if (character) {
            character.isFavorite = !character.isFavorite;
            await saveSingleCharacterToDB(character);

            const favBtn = card.querySelector('.favorite-btn');
            const favBar = document.getElementById('favorites-bar');

            if (character.isFavorite) {
                favBtn.classList.add('is-favorite');

                favBar.querySelector('.favorites-placeholder')?.remove();

                const imageUrl = getImageUrl(character.avatar);
                const favElement = document.createElement('div');
                favElement.className = 'favorite-item';
                favElement.dataset.charId = charId;
                favElement.innerHTML = `
                  <div class="avatar-container">
                    <img src="${imageUrl}" alt="${character.name}" class="${character.avatar ? '' : 'hidden'}" onerror="this.classList.add('is-broken')">
                    <div class="placeholder-icon ${character.avatar ? 'hidden' : ''}">👤</div>
                  </div>
                  <span>${character.name}</span>`;
                favElement.addEventListener('click', () => showChatList(charId));

                const existing = [...favBar.querySelectorAll('.favorite-item')];
                let inserted = false;
                for (const el of existing) {
                    if (character.name.localeCompare(characters[el.dataset.charId]?.name || '', 'de', { sensitivity: 'base' }) <= 0) {
                        favBar.insertBefore(favElement, el);
                        inserted = true;
                        break;
                    }
                }
                if (!inserted) favBar.appendChild(favElement);
            } else {
                favBtn.classList.remove('is-favorite');
                favBar.querySelector(`[data-char-id="${charId}"]`)?.remove();
                if (!favBar.querySelector('.favorite-item')) {
                    favBar.innerHTML = `<span class="favorites-placeholder">No Favorites selected</span>`;
                }
            }

            // Keep avatar stacking z-indices in sync
            favBar.querySelectorAll('.favorite-item .avatar-container').forEach((el, i) => {
                el.style.zIndex = i + 1;
            });
        }
    }
    else if (event.target.classList.contains('archive-btn')) {
        event.stopPropagation();
        const card = event.target.closest('.character-card');
        toggleArchiveState(card.dataset.charId);
    }
});

archivedCharacterList.addEventListener('click', async (event) => {
    if (event.target.classList.contains('archive-btn')) { 
        event.stopPropagation();
        const card = event.target.closest('.character-card');
        toggleArchiveState(card.dataset.charId);
    }
});

archiveToggleBtn.addEventListener('click', () => {
    if (archiveContent.classList.contains('collapsed')) {
        archiveContent.style.opacity = '0';
        archiveContent.classList.remove('collapsed');
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                archiveContent.style.opacity = '';
                archiveContent.querySelectorAll('.card-name-container').forEach(container => {
                    adjustFontSizeToFit(container);
                });
            });
        });
        archiveToggleBtn.textContent = 'Hide all';
    } else {
        archiveContent.style.opacity = '0';
        setTimeout(() => {
            archiveContent.classList.add('collapsed');
            archiveContent.style.opacity = '';
        }, 200);
        archiveToggleBtn.textContent = 'Show Characters';
    }
});

document.getElementById('bulk-delete-btn').addEventListener('click', openBulkCharacterDeleteModal);


    cancelEditBtn.addEventListener('click', closeEditor);
    characterForm.addEventListener('submit', handleFormSubmit);
dialogBtn.addEventListener('click', (e) => {
    e.preventDefault(); 
    handleChatSubmit('dialog');
});
storyBtn.addEventListener('click', () => {
    handleChatSubmit('story');
});



stopStreamBtn.addEventListener('click', () => {
    if (currentStreamController) {
        currentStreamController.abort();
        currentStreamController = null;
        console.log("Stream manually aborted by user.");
        stopStreamBtn.classList.add('hidden');
        loadingIndicator.classList.add('hidden');
        dialogBtn.disabled = false;
        storyBtn.disabled = false;
        // The async stream functions (handleSend / handleRegenerate / handleContinue)
        // each handle their own state cleanup when the AbortError propagates.
    }
});



    if (chatMemoriesBtn) {
        chatMemoriesBtn.addEventListener('click', () => {
            openChatMemoriesModal();
        });
    }

    if (chatMemoriesModal) {
        chatMemoriesModal.addEventListener('dblclick', (event) => {
            if (event.target === chatMemoriesModal) {
                saveChatMemories();
            }
        });
    }

    if (chatMemoriesTextarea) {
        chatMemoriesTextarea.addEventListener('input', autoResizeTextarea);
        chatMemoriesTextarea.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                saveChatMemories();
            } else if (event.key === 'Escape') {
                event.preventDefault();
                closeChatMemoriesModal();
            }
        });
    }



addParticipantBtn.addEventListener('click', () => {
  participantSearchInput.value = ''; 
  openParticipantModal(); 
});

participantSearchInput.addEventListener('input', () => {
  openParticipantModal(participantSearchInput.value);
});

participantSelectionModal.addEventListener('click', (event) => {
  if (event.target.id === 'cancel-participant-selection-btn') {
    participantSelectionModal.classList.add('hidden');
    participantSearchInput.value = '';
  }
});

participantSelectionList.addEventListener('click', (event) => {
    const targetBtn = event.target.closest('.participant-option-btn');
    if (targetBtn) {
        const participantId = targetBtn.dataset.charId;
        addParticipantToChat(participantId);
    }
});

messageInput.addEventListener('focus', () => {
    showGroupCharDropdown();
    showReplyOptionsDropdown();
    if (!pendingReplyOptions && !replyOptionsLoading && replyOptionsEnabled) {
        const chat = characters[currentCharacterId]?.chats?.[currentChatId];
        const lastMsg = chat?.history?.[chat.history.length - 1];
        if (lastMsg && lastMsg.sender !== 'user') {
            generateReplyOptionsInBackground();
        }
    }
});

messageInput.addEventListener('click', () => {
    showGroupCharDropdown();
    showReplyOptionsDropdown();
});

messageInput.addEventListener('blur', () => {
    setTimeout(hideGroupCharDropdown, 200);
});

groupCharDropdown.addEventListener('mousedown', (event) => {
    const item = event.target.closest('.group-char-dropdown-item');
    if (!item) return;
    event.preventDefault(); // keeps textarea focused during selection
    const charId = item.dataset.charId;
    if (charId) setActiveGroupParticipant(charId);
});

groupCharBubbleDismiss.addEventListener('mousedown', (event) => {
    event.preventDefault(); // keeps textarea focused, prevents blur→flash cycle
    clearActiveGroupParticipant();
});

participantIconList.addEventListener('click', async (event) => {
    const iconElement = event.target.closest('[data-char-id]');
    if (!iconElement) return; 

    const charIdToRemove = iconElement.dataset.charId;
    const characterToRemove = characters[charIdToRemove];
    const chat = characters[currentCharacterId]?.chats?.[currentChatId];

    if (!characterToRemove || !chat) return;

    if (await showCustomConfirm(`Do you really want to remove "${characterToRemove.name}" from this chat?`, true)) {
        chat.participants = chat.participants.filter(id => id !== charIdToRemove);
        await saveSingleCharacterToDB(characters[currentCharacterId]);
        updateTokenCount();
        renderParticipantIcons();
        if (charIdToRemove === activeGroupParticipantId) {
            clearActiveGroupParticipant();
        }
        if (!groupCharDropdown.classList.contains('hidden')) {
            showGroupCharDropdown();
        }
    }
});

selectPersonaBtn.addEventListener('click', async () => {
    const chat = characters[currentCharacterId]?.chats?.[currentChatId];
    if (chat?.activePersonaId) {
        const personaName = personas[chat.activePersonaId]?.name || 'the current persona';
        if (await showCustomConfirm(`Do you want to unselect "${personaName}"?`)) {
            chat.activePersonaId = null;
            await saveSingleCharacterToDB(characters[currentCharacterId]);
            updateTokenCount();
            startChat(currentCharacterId, currentChatId);
            showCustomAlert(`Persona "${personaName}" has been unselected.`);
        }
    } else {
        personaSearchInput.value = '';
        openPersonaSelectionModal();
    }
});

personaSearchInput.addEventListener('input', () => {
  openPersonaSelectionModal(personaSearchInput.value);
});

cancelPersonaSelectBtn.addEventListener('click', () => {
    personaSelectionModal.classList.add('hidden');
});

personaSelectionList.addEventListener('click', (event) => {
    const targetBtn = event.target.closest('.participant-option-btn');
    if (targetBtn) {
        const personaId = targetBtn.dataset.personaId;
        setActivePersonaForChat(personaId);
    }
});

backToSelectionBtn.addEventListener('click', showCharacterSelection);
    backToMainBtn.addEventListener('click', showMainScreen);

startNewChatBtn.addEventListener('click', async () => {
    const character = characters[currentCharacterId];
    if (!character.scenarios || character.scenarios.length === 0) {
        await createNewChat();
        return;
    }

    scenarioSelectionList.innerHTML = '';
    character.scenarios.forEach(scenario => {
        const scenarioBtn = document.createElement('button');
        scenarioBtn.className = 'scenario-option-btn';
        scenarioBtn.textContent = scenario.name || 'Unnamed Scenario';
        scenarioBtn.dataset.scenarioText = scenario.text; 
        scenarioSelectionList.appendChild(scenarioBtn);
    });
    scenarioSelectionModal.classList.remove('hidden');
});

scenarioSelectionList.addEventListener('click', async (event) => {
    if (event.target.classList.contains('scenario-option-btn')) {
        const scenarioText = event.target.dataset.scenarioText;
        scenarioSelectionModal.classList.add('hidden');
        const scenarioName = event.target.textContent;
        await createNewChat(scenarioText, scenarioName);
    }
});

startEmptyChatBtn.addEventListener('click', async () => {
    scenarioSelectionModal.classList.add('hidden');
    await createNewChat();
});

cancelScenarioSelectionBtn.addEventListener('click', () => {
    scenarioSelectionModal.classList.add('hidden');
});

    exportBtn.addEventListener('click', handleExport);
    importBtn.addEventListener('click', async () => {
  const choice = await showChoiceDialog(
    "What do you want to import?",
    [
      { label: "Backup (.json)", value: "json", primary: true },
      { label: "Character Card (.png/.json)", value: "card", extraClass: "violet-btn" },
      { label: "Cancel", value: null }
    ]
  );
  if (!choice) return;
  if (choice === "json") {
    fileInput.setAttribute('accept', '.json,application/json');
  } else {
    fileInput.setAttribute('accept', '.json,application/json,image/png');
  }
  fileInput.click();
});
    fileInput.addEventListener('change', handleFileImport);
    messageInput.addEventListener('input', autoResizeTextarea);
    messageInput.addEventListener('keydown', handleTextareaEnter);
    settingsBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        settingsPanel.classList.toggle('hidden');
    });
    document.addEventListener('click', (e) => {
        if (!settingsPanel.classList.contains('hidden') && !settingsContainer.contains(e.target)) {
            settingsPanel.classList.add('hidden');
        }
    });
    settingsPanel.querySelectorAll('.accordion-header').forEach(btn => {
        btn.addEventListener('click', () => {
            const section = btn.closest('.accordion-section');
            const isOpen = section.classList.contains('open');
            settingsPanel.querySelectorAll('.accordion-section').forEach(s => s.classList.remove('open'));
            if (!isOpen) section.classList.add('open');
        });
    });

    addSettingListener(fontSizeSlider, 'fontSize');
    addSettingListener(temperatureSlider, 'temperature');
    addSettingListener(mainTextColorPicker, 'mainTextColor');
    addSettingListener(dialogueColorPicker, 'dialogueColor');
    addSettingListener(userBubbleColorPicker, 'userBubbleColor');
    addSettingListener(userBubbleOpacitySlider, 'userBubbleOpacity');
    addSettingListener(aiBubbleColorPicker, 'aiBubbleColor');
    addSettingListener(aiBubbleOpacitySlider, 'aiBubbleOpacity');
    addSettingListener(spacingSlider, 'messageSpacing');
    addSettingListener(soundToggle, 'soundEnabled', 'change');
    addSettingListener(thinkToggle, 'thinkEnabled', 'change');
    addSettingListener(replyOptionsToggle, 'replyOptionsEnabled', 'change');
    addSettingListener(blurSlider, 'blur');
    addSettingListener(avatarSizeSlider, 'avatarSize');
    addSettingListener(modelSelect, 'model', 'change');
    addSettingListener(avatarSizeSlider, 'avatarSize');
    if (suggestionModelSelect) addSettingListener(suggestionModelSelect, 'suggestionModelId', 'change');

    if (typeof window !== 'undefined') {
        if (responsiveViewportQuery) {
            const viewportChangeHandler = enforceResponsiveSettingLimits;
            if (typeof responsiveViewportQuery.addEventListener === 'function') {
                responsiveViewportQuery.addEventListener('change', viewportChangeHandler);
            } else if (typeof responsiveViewportQuery.addListener === 'function') {
                responsiveViewportQuery.addListener(viewportChangeHandler);
            }
        }
        window.addEventListener('resize', enforceResponsiveSettingLimits);
    }

    resetSettingsBtn.addEventListener('click', async () => {
        if (await showCustomConfirm("Do you really want to reset all settings to the default values?", true)) {
            Object.keys(defaultSettings).forEach(key => localStorage.removeItem(key));
            loadAndApplySettings();
            enforceResponsiveSettingLimits();
        }
    });

    scrollTopFab.addEventListener('click', () => {
        chatWindow.scrollTop = 0;
    });

    chatWindow.addEventListener('scroll', () => {
        if (chatWindow.scrollTop > 400) {
            scrollTopFab.classList.add('visible');
        } else {
            scrollTopFab.classList.remove('visible');
        }
        const k = (currentCharacterId && currentChatId)
  ? `chatScrollPos:${currentCharacterId}:${currentChatId}`
  : 'chatScrollPos';
localStorage.setItem(k, String(chatWindow.scrollTop));
        chatWindow._autoScroll = chatWindow.scrollHeight - chatWindow.clientHeight - chatWindow.scrollTop < 50;
    }, { passive: true });

    chatWindow.addEventListener('dblclick', (event) => {
        const partElement = event.target.closest('[data-edit-part="main"]');
        if (!partElement) return;

        const messageElement = partElement.closest('.message');
        const messageId = messageElement.dataset.messageId;

        const chat = characters[currentCharacterId]?.chats?.[currentChatId];
        if (!chat) return;

        const message = chat.history.find(m => m.id === messageId);
        if (!message) return;
        
        let textToEdit = '';
        if(message.sender === 'user') {
            textToEdit = message.main;
        } else {
            textToEdit = 
            message.variations[message.activeVariant].main;
        }

        messageEditorTextarea.value = textToEdit || '';
        messageEditorModal.dataset.editingMessageId = messageId;
        
        messageEditorModal.classList.remove('hidden');
        messageEditorTextarea.focus();
        messageEditorTextarea.addEventListener('input', autoResizeTextarea);
        autoResizeTextarea({ target: messageEditorTextarea });
    });

    messageEditorModal.addEventListener('dblclick', (event) => {
        if (event.target === messageEditorModal) {
            saveAndCloseMessageEditor();
        }
    });

    messageEditorTextarea.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            saveAndCloseMessageEditor();
        }
    });

    saveMessageEditBtn.addEventListener('click', () => saveAndCloseMessageEditor());
    cancelMessageEditBtn.addEventListener('click', () => {
        messageEditorModal.classList.add('hidden');
        delete messageEditorModal.dataset.editingMessageId;
    });

    saveMemoriesEditBtn.addEventListener('click', () => saveChatMemories());
    cancelMemoriesEditBtn.addEventListener('click', () => closeChatMemoriesModal());

    chatWindow.addEventListener('click', async (event) => {
        const target = event.target;
        const messageElement = target.closest('.message');
        if (!messageElement) return;

        const messageId = messageElement.dataset.messageId;
        
        if (target.classList.contains('regenerate-btn')) {
            await handleRegenerate(messageId);
        }
        else if (target.classList.contains('edit-message-btn')) {
            const chat = characters[currentCharacterId]?.chats?.[currentChatId];
            if (!chat) return;
            const message = chat.history.find(m => m.id === messageId);
            if (!message) return;
            let textToEdit = '';
            if (message.sender === 'user') {
                textToEdit = message.main;
            } else {
                textToEdit = message.variations[message.activeVariant].main;
            }
            messageEditorTextarea.value = textToEdit || '';
            messageEditorModal.dataset.editingMessageId = messageId;
            messageEditorModal.classList.remove('hidden');
            messageEditorTextarea.focus();
            messageEditorTextarea.addEventListener('input', autoResizeTextarea);
            autoResizeTextarea({ target: messageEditorTextarea });
        }
        else if (target.classList.contains('delete-message-btn')) {
             if (await showCustomConfirm("Are you sure you want to permanently delete this message AND ALL FOLLOWING messages?", true)) {
                const chat = characters[currentCharacterId]?.chats?.[currentChatId];
            if (!chat) return;
            const messageIndex = chat.history.findIndex(m => m.id === messageId);
            const currentScroll = chatWindow.scrollTop;
            lastDeletedSnapshot = { charId: currentCharacterId, chatId: currentChatId, fromIndex: messageIndex, messages: chat.history.splice(messageIndex) };
            await saveSingleCharacterToDB(characters[currentCharacterId]);
            updateTokenCount();
            startChat(currentCharacterId, currentChatId);
            chatWindow.scrollTop = currentScroll;
            showUndoDeleteFab();
            generateReplyOptionsInBackground();
                }
             }
             else if (target.classList.contains('continue-btn')) {
        await handleContinue(messageId);
             }
        else if (target.classList.contains('prev-variant-btn') || target.classList.contains('next-variant-btn')) {
        const chat = characters[currentCharacterId]?.chats?.[currentChatId];
        if (!chat) return;
        const message = chat.history.find(m => m.id === messageId);
        if (!message) return;
        
        let changed = false;
        if (target.classList.contains('prev-variant-btn') && message.activeVariant > 0) {
            message.activeVariant--;
            changed = true;
        } else if (target.classList.contains('next-variant-btn') && message.activeVariant < message.variations.length - 1) {
            message.activeVariant++;
            changed = true;
        }

        if (changed) {
            await saveSingleCharacterToDB(characters[currentCharacterId]);
            updateTokenCount();
            updateSingleMessageView(messageId);
        }
    }
    });



    document.addEventListener('keydown', async (event) => {
        if (chatScreen.classList.contains('hidden')) return;
        if (document.activeElement === messageInput || document.activeElement === messageEditorTextarea || document.activeElement === chatMemoriesTextarea) return;
        if (chatMemoriesModal && !chatMemoriesModal.classList.contains('hidden')) return;
        
        const chat = characters[currentCharacterId]?.chats?.[currentChatId];
        if (!chat || chat.history.length === 0) return;
        
        const lastMessage = chat.history[chat.history.length - 1];
        if (!lastMessage || lastMessage.sender !== 'ai') return;

        let changed = false;
        if (event.key === 'ArrowLeft') {
            if (lastMessage.variations.length > 1 && lastMessage.activeVariant > 0) {
                lastMessage.activeVariant--;
                changed = true;
            }
        } else if (event.key === 'ArrowRight') {
             if (lastMessage.activeVariant < lastMessage.variations.length - 1) {
                lastMessage.activeVariant++;
                changed = true;
            } else {
                event.preventDefault();
                await handleRegenerate(lastMessage.id);
                return;
            }
        }

        if (changed) {
            event.preventDefault();
            await saveSingleCharacterToDB(characters[currentCharacterId]);
            const currentScroll = chatWindow.scrollTop;
            startChat(currentCharacterId, currentChatId);
            chatWindow.scrollTop = currentScroll;
        }
    });

    deleteCharacterBtnDashboard.addEventListener('click', async () => {
    if (!currentCharacterId || !characters[currentCharacterId]) return;
    const characterName = characters[currentCharacterId].name;
    if (await showCustomConfirm(`Are you sure you want to permanently delete the character "${characterName}" and all their chats?`, true)) {
        const idToDelete = currentCharacterId; 
        delete characters[idToDelete];
        await deleteSingleCharacterFromDB(idToDelete);
        renderCharacterList();
        showMainScreen();
    }
});

cancelEditBtnTop.addEventListener('click', closeEditor);

saveEditBtnTop.addEventListener('click', () => {
    document.getElementById('save-edit-btn-bottom').click();
});



let targetScrollTop = characterEditorModalContent.scrollTop;
let currentScrollTop = characterEditorModalContent.scrollTop;
let animationFrameId = null;
const smoothing = 0.1;

function smoothScrollLoop() {
    const distance = targetScrollTop - currentScrollTop;

    if (Math.abs(distance) < 0.5) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
        return;
    }

    currentScrollTop += distance * smoothing;
    characterEditorModalContent.scrollTop = currentScrollTop;

    animationFrameId = requestAnimationFrame(smoothScrollLoop);
}

characterEditorModal.addEventListener('wheel', (event) => {
    if (event.target === characterEditorModal) {
        event.preventDefault();

        if (animationFrameId === null) {
            currentScrollTop = characterEditorModalContent.scrollTop;
            targetScrollTop = characterEditorModalContent.scrollTop;
        }

        targetScrollTop += event.deltaY;

        const maxScroll = characterEditorModalContent.scrollHeight - characterEditorModalContent.clientHeight;
        targetScrollTop = Math.max(0, Math.min(maxScroll, targetScrollTop));

        if (animationFrameId === null) {
            animationFrameId = requestAnimationFrame(smoothScrollLoop);
        }
    }
});



const editorTextareasToResize = [
    'char-description',
    'char-lore',
    'char-instructions',
    'char-reminder',
    'char-narrator-reminder',
    'scenario-list'
];

editorTextareasToResize.forEach(id => {
    const textarea = document.getElementById(id);
    if (textarea) {
        textarea.addEventListener('input', autoResizeTextarea);
    }
});



    // --- INITIALIZATION ---


async function initializeApp() {
    try {
        await openDB();
        await Promise.all([
            loadCharactersFromDB(),
            loadPersonasFromDB(),
            loadAppSettingsFromDB(),
        ]);
        populateModelSelector();
        await loadAndApplySettingsFromDB();
        if (Object.keys(characters).length === 0) {
            await loadStarterPack();
        }
        enforceResponsiveSettingLimits();
        renderCharacterList();
        restoreLastSession();
        tutorialInit();
    } catch (error) {
        console.error("Failed to initialize the app:", error);
        showCustomAlert("Could not load database. Please check browser permissions or try clearing site data.");
    }
}
initializeApp();



function adjustCardImageFit() {
    const cardImages = document.querySelectorAll('.card-image-container img');
    cardImages.forEach(img => {
        const checkAndSetFit = (imageElement) => {
            const isPortrait = imageElement.naturalWidth < imageElement.naturalHeight;

            if (isPortrait) {
                imageElement.style.objectFit = 'contain';
                imageElement.parentElement.style.backgroundColor = 'rgba(0,0,0,0.5)';
            } else {
                imageElement.style.objectFit = 'cover';
                imageElement.parentElement.style.backgroundColor = ''; 
            }
        };

        if (img.complete && img.naturalWidth > 0) {
            checkAndSetFit(img);
        } else {
            img.onload = () => checkAndSetFit(img);
        }
    });
}



async function loadStarterPack() {
    try {
        let data;
        if (typeof STARTER_PACK_DATA !== 'undefined') {
            data = STARTER_PACK_DATA;
        } else {
            const response = await fetch('starter_pack_data.json');
            if (!response.ok) throw new Error('Failed to fetch starter_pack_data.json: ' + response.status);
            data = await response.json();
        }

        const starterChars = data.characters;
        if (starterChars && Object.keys(starterChars).length > 0) {
            console.log('First launch: Loading starter pack characters...');

            for (const charId in starterChars) {
                characters[charId] = starterChars[charId];
            }

            await saveCharactersToDB();

            const starterAppSettings = data.appSettings;
            if (starterAppSettings && db) {
                console.log('First launch: Loading app settings from starter pack...');
                const transaction = db.transaction(['settings'], 'readwrite');
                const store = transaction.objectStore('settings');
                store.put({ key: 'appSettings', value: starterAppSettings });
            }
        }

        const starterPersonas = data.personas;
        if (starterPersonas && Object.keys(starterPersonas).length > 0) {
            console.log('First launch: Loading starter pack personas...');
            for (const personaId in starterPersonas) {
                personas[personaId] = starterPersonas[personaId];
            }
            await savePersonasToDB();
        }
    } catch (error) {
        console.warn("Error loading starter pack data from script:", error.message);
    }
}



document.addEventListener('fullscreenchange', () => {
    if (document.fullscreenElement) {
        document.body.classList.add('fullscreen-active');
    } else {
        document.body.classList.remove('fullscreen-active');
    }
    window.dispatchEvent(new Event('resize'));
});

document.addEventListener('keydown', (event) => {
    if (event.key.toLowerCase() === 'f' && 
        document.activeElement.tagName !== 'INPUT' && 
        document.activeElement.tagName !== 'TEXTAREA') {
        
        event.preventDefault(); 

        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen();
        } else {
            document.exitFullscreen();
        }
    }
});



const charAvatarInput = document.getElementById('char-avatar');
charAvatarInput.addEventListener('input', () => {
    const url = charAvatarInput.value;
    const editorAvatarContainer = editorAvatarImg.parentElement;
    if (url) {
        editorAvatarImg.src = url;
        smartObjectFit(editorAvatarImg); 
        editorAvatarImg.classList.remove('hidden');
        editorAvatarPlaceholder.classList.add('hidden');
        editorAvatarContainer.classList.add('effect-container');
        editorAvatarContainer.style.backgroundImage = `url('${url}')`;
    } else {
        editorAvatarImg.classList.add('hidden');
        editorAvatarPlaceholder.classList.remove('hidden');
        editorAvatarContainer.classList.remove('effect-container');
        editorAvatarContainer.style.backgroundImage = 'none';
    }
});

editorAvatarImg.onerror = () => {
    editorAvatarImg.classList.add('hidden');
    editorAvatarPlaceholder.classList.remove('hidden');
    const container = editorAvatarImg.parentElement;
    container.classList.remove('effect-container');
    container.style.backgroundImage = 'none';
};

const charBackgroundInput = document.getElementById('char-background');
const chatListScreenForPreview = document.getElementById('chat-list-screen');

charBackgroundInput.addEventListener('input', () => {
    const url = charBackgroundInput.value;
    if (url) {
        chatListScreenForPreview.style.backgroundImage = `url('${url}')`;
        chatListScreenForPreview.style.backgroundSize = 'cover';
        chatListScreenForPreview.style.backgroundPosition = 'center';
    } else {
        chatListScreenForPreview.style.backgroundImage = 'none';
        chatListScreenForPreview.style.backgroundColor = 'transparent';
    }
});



const modalsToFixScroll = ['app-settings-modal', 'persona-editor-modal', 'persona-list-modal'];

modalsToFixScroll.forEach(modalId => {
    const modalElement = document.getElementById(modalId);
    if (modalElement) {
        modalElement.addEventListener('wheel', (event) => {
            if (event.target === modalElement) {
                event.preventDefault();
            }
        }, { passive: false });
    }
});



const helpBtn = document.getElementById('help-btn');
const helpDot = document.getElementById('help-notification-dot');
const helpTooltip = document.getElementById('help-tooltip');

if (!localStorage.getItem('hasSeenHelpNotification')) {
    helpDot.classList.remove('hidden');
    helpTooltip.classList.remove('hidden');
}

helpBtn.addEventListener('click', () => {
    if (!localStorage.getItem('hasSeenHelpNotification')) {
        localStorage.setItem('hasSeenHelpNotification', 'true');
    }
    helpDot.classList.add('hidden');
    helpTooltip.classList.add('hidden');
});


// =============================================================
// TUTORIAL TOUR MODULE
// =============================================================

const tutorialData = {
    active: false,
    currentStep: 0,
    pendingPhase: null,
    localStorageKey: 'tutorialCompleted',
    steps: [
        // Phase 1 — Character Selection Screen
        {
            phase: 'character-selection',
            targetId: null,
            position: 'center',
            indicator: 'Welcome',
            title: 'Welcome to Casual Character Chat!',
            text: "This quick tour will show you the basics. It only takes a moment — feel free to skip anytime.",
            nextLabel: "Let's Go",
        },
        {
            phase: 'character-selection',
            targetId: 'app-settings-btn',
            position: 'bottom',
            indicator: 'Step 1 of 6',
            title: 'Enter your API Key first',
            text: 'Open Global Settings to add your AI API key. This is your first stop — no key, no AI chat.',
            nextLabel: 'Next',
        },
        {
            phase: 'character-selection',
            targetId: 'new-character-btn',
            position: 'bottom',
            indicator: 'Step 2 of 7',
            title: 'Create your first character',
            text: 'Give them a name, personality, and avatar. This is who you\'ll be chatting with.',
            nextLabel: 'Next',
        },
        {
            phase: 'character-selection',
            targetId: 'manage-personas-btn',
            position: 'bottom',
            indicator: 'Step 3 of 7',
            title: 'Play as your own persona',
            text: 'Optionally create a persona for yourself — useful if you like to roleplay as a specific character or personality across chats.',
            nextLabel: 'Got it',
        },
        // Phase 2 — Chat List Screen
        {
            phase: 'chat-list',
            targetId: 'start-new-chat-btn',
            position: 'top',
            indicator: 'Step 4 of 7',
            title: 'Start a new conversation',
            text: 'Click here to begin a fresh chat session with your character.',
            nextLabel: 'Next',
        },
        {
            phase: 'chat-list',
            targetId: 'edit-character-btn',
            position: 'top',
            indicator: 'Step 5 of 7',
            title: 'Edit your character anytime',
            text: 'Refine their personality, add scenarios, or change their avatar here.',
            nextLabel: 'Got it',
        },
        // Phase 3 — Chat Screen
        {
            phase: 'chat',
            targetId: 'chat-form',
            position: 'top',
            indicator: 'Step 6 of 7',
            title: 'Type your message here',
            text: '"Character" sends an AI reply. "Narrator" adds story narration. Try both!',
            nextLabel: 'Next',
        },
        {
            phase: 'chat',
            targetId: 'settings-container',
            position: 'bottom',
            indicator: 'Step 7 of 7',
            title: 'Your chat control panel',
            text: 'Memories, group chat, persona, and settings all live up here. That\'s the tour!',
            nextLabel: 'Done!',
        },
    ],
};

const tutorialBackdrop        = document.getElementById('tutorial-backdrop');
const tutorialSpotlight       = document.getElementById('tutorial-spotlight');
const tutorialTooltipEl       = document.getElementById('tutorial-tooltip');
const tutorialStepIndicatorEl = document.getElementById('tutorial-step-indicator');
const tutorialTitleEl         = document.getElementById('tutorial-title');
const tutorialTextEl          = document.getElementById('tutorial-text');
const tutorialSkipBtn         = document.getElementById('tutorial-skip-btn');
const tutorialNextBtn         = document.getElementById('tutorial-next-btn');

function tutorialGetActivePhase() {
    if (!characterSelectionScreen.classList.contains('is-inactive')) return 'character-selection';
    if (!chatListScreen.classList.contains('is-inactive'))           return 'chat-list';
    if (!chatScreen.classList.contains('is-inactive'))               return 'chat';
    return null;
}

function tutorialPositionSpotlight(step) {
    if (!step.targetId) {
        tutorialSpotlight.classList.add('tutorial-welcome');
        tutorialSpotlight.style.cssText = '';
        return null;
    }
    tutorialSpotlight.classList.remove('tutorial-welcome');
    const el = document.getElementById(step.targetId);
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    const pad = 7;
    tutorialSpotlight.style.top    = (rect.top    - pad) + 'px';
    tutorialSpotlight.style.left   = (rect.left   - pad) + 'px';
    tutorialSpotlight.style.width  = (rect.width  + pad * 2) + 'px';
    tutorialSpotlight.style.height = (rect.height + pad * 2) + 'px';
    return rect;
}

function tutorialComputeTooltipPos(targetRect, position) {
    const MARGIN = 14;
    const PAD    = 12;
    const tw = tutorialTooltipEl.offsetWidth  || 300;
    const th = tutorialTooltipEl.offsetHeight || 160;
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    if (position === 'center') {
        return { top: (vh - th) / 2, left: (vw - tw) / 2 };
    }

    const midX = targetRect.left + targetRect.width  / 2;
    let top, left;

    if (position === 'bottom') {
        top  = targetRect.bottom + MARGIN;
        left = midX - tw / 2;
    } else if (position === 'top') {
        top  = targetRect.top - th - MARGIN;
        left = midX - tw / 2;
    } else if (position === 'left') {
        top  = targetRect.top + targetRect.height / 2 - th / 2;
        left = targetRect.left - tw - MARGIN;
    } else {
        top  = targetRect.top + targetRect.height / 2 - th / 2;
        left = targetRect.right + MARGIN;
    }

    if (top + th > vh - PAD) top = targetRect.top - th - MARGIN;
    if (top < PAD)           top = targetRect.bottom + MARGIN;
    left = Math.max(PAD, Math.min(left, vw - tw - PAD));

    return { top, left };
}

function tutorialHideUI() {
    tutorialSpotlight.classList.remove('tutorial-visible');
    tutorialTooltipEl.classList.remove('tutorial-visible');
    setTimeout(() => {
        tutorialBackdrop.classList.remove('tutorial-active');
        tutorialSpotlight.classList.remove('tutorial-active', 'tutorial-welcome');
        tutorialTooltipEl.classList.remove('tutorial-active', 'tutorial-centered');
    }, 260);
}

function tutorialComplete() {
    localStorage.setItem(tutorialData.localStorageKey, 'true');
    tutorialData.active = false;
    tutorialData.pendingPhase = null;
    tutorialSpotlight.classList.remove('tutorial-visible');
    tutorialTooltipEl.classList.remove('tutorial-visible');
    setTimeout(() => {
        tutorialBackdrop.classList.remove('tutorial-active');
        tutorialSpotlight.classList.remove('tutorial-active', 'tutorial-welcome');
        tutorialTooltipEl.classList.remove('tutorial-active', 'tutorial-centered');
        tutorialSpotlight.style.cssText = '';
        tutorialTooltipEl.style.cssText = '';
    }, 280);
}

function tutorialShowStep(stepIndex) {
    if (stepIndex >= tutorialData.steps.length) {
        tutorialComplete();
        return;
    }

    const step = tutorialData.steps[stepIndex];
    tutorialData.currentStep = stepIndex;

    const activePhase = tutorialGetActivePhase();
    if (step.phase !== activePhase) {
        tutorialData.pendingPhase = step.phase;
        tutorialHideUI();
        return;
    }

    tutorialData.pendingPhase = null;

    tutorialStepIndicatorEl.textContent = step.indicator;
    tutorialTitleEl.textContent         = step.title;
    tutorialTextEl.textContent          = step.text;
    tutorialNextBtn.textContent         = step.nextLabel;

    tutorialBackdrop.classList.add('tutorial-active');
    tutorialSpotlight.classList.add('tutorial-active');
    tutorialTooltipEl.classList.add('tutorial-active');

    if (step.position === 'center') {
        tutorialTooltipEl.classList.add('tutorial-centered');
    } else {
        tutorialTooltipEl.classList.remove('tutorial-centered');
    }

    const targetRect = tutorialPositionSpotlight(step);

    if (step.position !== 'center') {
        const pos = tutorialComputeTooltipPos(
            targetRect || { top: 0, left: 0, width: 0, height: 0, bottom: 0, right: 0 },
            step.position
        );
        tutorialTooltipEl.style.top  = pos.top  + 'px';
        tutorialTooltipEl.style.left = pos.left + 'px';
    }

    requestAnimationFrame(() => {
        tutorialSpotlight.classList.add('tutorial-visible');
        tutorialTooltipEl.classList.add('tutorial-visible');
    });
}

function tutorialOnScreenChange(screenName) {
    if (!tutorialData.active) return;
    if (tutorialData.pendingPhase !== screenName) return;
    setTimeout(() => {
        const stepIndex = tutorialData.steps.findIndex(s => s.phase === screenName);
        if (stepIndex !== -1) tutorialShowStep(stepIndex);
    }, 260);
}

function tutorialInit() {
    if (localStorage.getItem(tutorialData.localStorageKey)) return;
    tutorialData.active = true;
    const currentPhase = tutorialGetActivePhase();
    if (currentPhase === 'chat-list') {
        const i = tutorialData.steps.findIndex(s => s.phase === 'chat-list');
        tutorialShowStep(i);
    } else if (currentPhase === 'chat') {
        const i = tutorialData.steps.findIndex(s => s.phase === 'chat');
        tutorialShowStep(i);
    } else {
        tutorialShowStep(0);
    }
}

tutorialSkipBtn.addEventListener('click', () => {
    tutorialComplete();
});

tutorialNextBtn.addEventListener('click', () => {
    if (!tutorialData.active) return;
    tutorialShowStep(tutorialData.currentStep + 1);
});

tutorialBackdrop.addEventListener('click', (e) => {
    e.stopPropagation();
});

let tutorialResizeTimer;
window.addEventListener('resize', () => {
    if (!tutorialData.active || tutorialData.pendingPhase !== null) return;
    clearTimeout(tutorialResizeTimer);
    tutorialResizeTimer = setTimeout(() => {
        const step = tutorialData.steps[tutorialData.currentStep];
        if (!step) return;
        const targetRect = tutorialPositionSpotlight(step);
        if (step.position !== 'center' && targetRect) {
            const pos = tutorialComputeTooltipPos(targetRect, step.position);
            tutorialTooltipEl.style.top  = pos.top  + 'px';
            tutorialTooltipEl.style.left = pos.left + 'px';
        }
    }, 120);
});

// =============================================================
// END TUTORIAL TOUR MODULE
// =============================================================

// ── Setting info icon tooltip (position:fixed to escape overflow clipping) ──
{
    const gtt = document.getElementById('global-setting-tooltip');
    if (gtt) {
        document.addEventListener('mouseover', e => {
            const icon = e.target.closest('.setting-info-icon[data-tooltip]');
            if (!icon) return;
            gtt.textContent = icon.dataset.tooltip;
            gtt.style.display = 'block';
            const rect = icon.getBoundingClientRect();
            const w = 220, gap = 7;
            let left = rect.right - w;
            if (left < 8) left = 8;
            if (left + w > window.innerWidth - 8) left = window.innerWidth - w - 8;
            gtt.style.left = left + 'px';
            gtt.style.top = '0px';
            const h = gtt.offsetHeight;
            gtt.style.top = (rect.top - h - gap) + 'px';
            gtt.classList.add('visible');
        });
        document.addEventListener('mouseout', e => {
            if (!e.target.closest('.setting-info-icon[data-tooltip]')) return;
            gtt.classList.remove('visible');
        });
    }
}
