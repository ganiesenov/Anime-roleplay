// =============================================================
// editor.js — character/world editor: open/close, type toggle,
// world character picker, new/edit flows, copy character, form
// submit (save), scenario inputs, and the message editor save.
// Depends on globals resolved at call time (state, storage, dialogs,
// renderCharacterList, startChat, DOM refs, charGenAbortController...).
// =============================================================

    function closeEditor() {
    if (charGenAbortController) { charGenAbortController.abort(); charGenAbortController = null; }
    const genBtn = document.getElementById('ai-generate-char-btn');
    if (genBtn) { genBtn.textContent = cardTypeWorldRadio.checked ? '✨ AI Generate World' : '✨ AI Generate Character'; genBtn.disabled = false; }
    document.getElementById('card-name').style.height = 'auto';
    tempUploadedImages = {};
    characterEditorModalContent.scrollTop = 0;
    characterEditorModal.classList.add('hidden');
}



    function updateEditorForType(type) {
    const isWorld = type === 'world';
    editorAvatarUrlGroup.classList.toggle('hidden', isWorld);
    worldCharPickerSection.classList.toggle('hidden', !isWorld);
    typeOptionCharacter.classList.toggle('is-active', !isWorld);
    typeOptionWorld.classList.toggle('is-active', isWorld);
    document.querySelector('.editor-header h2').textContent = isWorld ? 'World Editor' : 'Character Editor';
    document.getElementById('save-edit-btn-top').textContent = isWorld ? 'Save World' : 'Save Character';
    document.getElementById('save-edit-btn-bottom').textContent = isWorld ? 'Save World' : 'Save Character';
    document.getElementById('char-reminder-label').textContent = isWorld ? 'World Rules:' : 'Character Reminder:';
    document.getElementById('char-description-label').textContent = isWorld ? 'World Description:' : 'Character Description:';
    const genBtn = document.getElementById('ai-generate-char-btn');
    if (genBtn) genBtn.textContent = isWorld ? '✨ AI Generate World' : '✨ AI Generate Character';
    document.getElementById('card-name').placeholder = isWorld
        ? "e.g., 'The Iron Reaches - Steampunk Empire'"
        : "e.g., 'Natsuki Subaru - Re:Zero'";
    document.getElementById('chat-name').placeholder = isWorld ? "e.g., 'Narrator'" : "e.g., 'Subaru'";
    document.getElementById('char-description').placeholder = isWorld
        ? 'Setting overview, geography, atmosphere, society, factions, tone etc.'
        : 'Identity, Appearance, Personality, Abilities, Speech Style, Dialog Examples etc.';
    document.getElementById('char-lore').placeholder = isWorld
        ? 'Historical events, myths, creation stories, notable conflicts, secrets of this world etc.'
        : 'Deeper Background Story, World & Relationships of the Character, Fun Facts etc.';
    const instrContainer = document.getElementById('char-instructions-container');
    if (instrContainer) instrContainer.style.display = isWorld ? 'none' : '';
    document.getElementById('char-instructions').placeholder = "General AI Instructions for this character... (e.g., 'Be creative and drive the plot forward.')";
    document.getElementById('char-reminder').placeholder = isWorld
        ? "World rules the AI must always follow... (e.g., 'Magic is forbidden by law.')"
        : "Character Reminder for this character... (e.g., 'Reply only as {{char}} now.')";
    document.getElementById('char-narrator-reminder').placeholder = isWorld
        ? "Narrator Reminder... (e.g., 'Switch to third-person narrator voice now.')"
        : "Narrator Reminder for this character... (e.g., 'Reply only as an omniscient narrator now.')";
    const loreLabelEl = document.querySelector('label[for="char-lore"]');
    if (loreLabelEl) loreLabelEl.textContent = isWorld ? 'World Lore:' : 'Lorebook:';
    const instrLabelEl = document.querySelector('label[for="char-instructions"]');
    if (instrLabelEl) instrLabelEl.textContent = 'AI Instructions:';
    const narrReminderLabelEl = document.querySelector('label[for="char-narrator-reminder"]');
    if (narrReminderLabelEl) narrReminderLabelEl.textContent = isWorld ? 'World Narrator Reminder:' : 'Narrator Reminder:';
    if (isWorld) {
        const worldCharSearch = document.getElementById('world-char-search');
        if (worldCharSearch) {
            worldCharSearch.value = '';
            worldCharSearch.oninput = () => populateWorldCharPicker();
        }
        populateWorldCharPicker();
    }
}

function populateWorldCharPicker() {
    worldCharPickerList.innerHTML = '';
    const searchTerm = (document.getElementById('world-char-search')?.value || '').toLowerCase().trim();
    const editingId = editingCharField.value;
    const chars = Object.values(characters)
        .filter(c => c.type !== 'world' && c.id !== editingId && (searchTerm === '' || (c.name || '').toLowerCase().includes(searchTerm)))
        .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
    if (chars.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'world-char-picker-empty';
        empty.textContent = 'No characters yet. Create some characters first.';
        worldCharPickerList.appendChild(empty);
        return;
    }
    chars.forEach(char => {
        const avatarUrl = getImageUrl(char.avatar);
        const avatarHtml = avatarUrl
            ? `<img src="${avatarUrl}" alt="Avatar" onerror="this.style.display='none';this.nextElementSibling.classList.remove('hidden');"><div class="placeholder-icon hidden">👤</div>`
            : `<div class="placeholder-icon">👤</div>`;

        const row = document.createElement('label');
        row.className = 'participant-option-btn';
        row.style.justifyContent = 'space-between';
        row.style.boxSizing = 'border-box';

        const left = document.createElement('div');
        left.style.cssText = 'display:flex;align-items:center;gap:10px;';
        left.innerHTML = `${avatarHtml}<span>${char.name}</span>`;

        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.value = char.id;
        cb.checked = worldCharSelectedIds.has(char.id);
        cb.addEventListener('change', () => {
            if (cb.checked) worldCharSelectedIds.add(char.id);
            else worldCharSelectedIds.delete(char.id);
        });

        row.appendChild(left);
        row.appendChild(cb);
        worldCharPickerList.appendChild(row);
    });
}

// (cardType radio listeners moved to js/main.js)

    function openEditorForNew() {
    tempUploadedImages = {};
    characterForm.reset();
    cardTypeCharacterRadio.checked = true;
    updateEditorForType('character');
    const textareas = characterForm.querySelectorAll('textarea');
    textareas.forEach(ta => {
        ta.style.height = 'auto';
        ta.style.overflowY = 'hidden';
    });
    document.getElementById('scenario-editor-list').innerHTML = '';
    createScenarioInput({ name: 'Main Greeting', text: '' });
    editingCharField.value = '';
    document.getElementById('chat-list-screen').style.backgroundImage = 'none';
    editorAvatarImg.src = '';
    editorAvatarImg.classList.add('hidden');
    editorAvatarPlaceholder.classList.remove('hidden');

    const editorAvatarContainer = editorAvatarImg.parentElement;
    editorAvatarContainer.classList.remove('effect-container');
    editorAvatarContainer.style.backgroundImage = 'none';

    characterEditorModal.classList.remove('hidden');
    updateEditorTokenCount();
}




  function openEditorForEdit() {
  if (!currentCharacterId) return;
  const character = characters[currentCharacterId];
  if (!character) return;
  const textareas = characterForm.querySelectorAll('textarea');
    textareas.forEach(ta => {
    ta.style.height = 'auto';
    ta.style.overflowY = 'hidden';
});

  characterForm.reset();

  const charType = character.type || 'character';
  const isWorld = charType === 'world';
  if (isWorld) {
      cardTypeWorldRadio.checked = true;
  } else {
      cardTypeCharacterRadio.checked = true;
  }
  worldCharSelectedIds = new Set(character.characterIds || []);
  updateEditorForType(charType);

  const avatarUrl = getImageUrl(character.avatar);
  const backgroundUrl = getImageUrl(character.background);
  const editorAvatarContainer = editorAvatarImg.parentElement;

  const editorDisplayUrl = isWorld ? backgroundUrl : avatarUrl;
if (editorDisplayUrl) {
    editorAvatarImg.src = editorDisplayUrl;
    smartObjectFit(editorAvatarImg);
    editorAvatarImg.classList.remove('hidden');
    editorAvatarPlaceholder.classList.add('hidden');
    editorAvatarContainer.classList.add('effect-container');
    editorAvatarContainer.style.backgroundImage = `url('${editorDisplayUrl}')`;
} else {
    editorAvatarImg.src = '';
    editorAvatarImg.classList.add('hidden');
    editorAvatarPlaceholder.classList.remove('hidden');
    editorAvatarContainer.classList.remove('effect-container');
    editorAvatarContainer.style.backgroundImage = 'none';
}

  document.getElementById('card-name').value = character.name || '';
  document.getElementById('chat-name').value = character.chatName || character.name || '';
  document.getElementById('char-avatar').value = avatarUrl;
  document.getElementById('char-background').value = backgroundUrl;
  document.getElementById('chat-list-screen').style.backgroundImage = backgroundUrl ? `url('${backgroundUrl}')` : 'none';
  charInstructionsInput.value = character.instructions || '';
  charDescriptionInput.value = character.description || '';
  charLoreInput.value = character.lore || '';
  document.getElementById('char-tags').value = character.tags || '';
  document.getElementById('char-reminder').value = character.reminder || '';
  document.getElementById('char-narrator-reminder').value = character.narratorReminder || '';
  document.getElementById('char-music-url').value = character.musicUrl || '';

  const scenarioListDiv = document.getElementById('scenario-editor-list');
  scenarioListDiv.innerHTML = '';
  if (character.scenarios && character.scenarios.length > 0 && typeof character.scenarios[0] === 'string') {
      character.scenarios = character.scenarios.map((text, index) => ({ name: `Scenario ${index + 1}`, text }));
  }
  if (character.scenarios && character.scenarios.length > 0) {
      character.scenarios.forEach(createScenarioInput);
  } else {
      createScenarioInput({ name: '', text: '' });
  }
  
  editingCharField.value = currentCharacterId;
  updateEditorTokenCount();
  
  characterEditorModal.classList.remove('hidden');

  setTimeout(() => {
    const textareasToResize = [
      'card-name', 'char-instructions', 'char-description', 'char-lore',
      'char-reminder', 'char-narrator-reminder'
    ];
    textareasToResize.forEach(id => {
      const textarea = document.getElementById(id);
      if (textarea) autoResizeTextarea({ target: textarea });
    });
  }, 0);
}



async function handleCopyCharacter() {
    if (!currentCharacterId) return;

    const originalCharacter = characters[currentCharacterId];
    if (!originalCharacter) return;

    if (await showCustomConfirm(`Do you really want to copy the character "${originalCharacter.name}"?`)) {

        const newCharacter = JSON.parse(JSON.stringify(originalCharacter));

        newCharacter.id = 'char-' + Date.now();
        newCharacter.name = originalCharacter.name + " (Copy)";
        newCharacter.chats = {};

        characters[newCharacter.id] = newCharacter;

        await saveSingleCharacterToDB(newCharacter);
        renderCharacterList();
        showCustomAlert(`Character "${originalCharacter.name}" was successfully copied!`);
        showMainScreen();
    }
}



// GROUP CHAT participant functions -> moved to js/groups.js



// PERSONA management + selection-in-chat functions -> moved to js/personas.js



    async function handleFormSubmit(event) {
  event.preventDefault();
  const charIdToEdit = editingCharField.value;
  
  const cardName = document.getElementById('card-name').value;
  const chatName = document.getElementById('chat-name').value;
  const avatarValue = document.getElementById('char-avatar').value;
  const backgroundValue = document.getElementById('char-background').value;

    let finalAvatar = avatarValue;
    let finalBackground = backgroundValue;

    if (tempUploadedImages.avatar) {
        finalAvatar = tempUploadedImages.avatar;
    }
    if (tempUploadedImages.background) {
        finalBackground = tempUploadedImages.background;
    } else {
    if (avatarValue.startsWith('blob:')) {
      finalAvatar = tempUploadedImages.avatar;
    }
    if (backgroundValue.startsWith('blob:')) {
      finalBackground = tempUploadedImages.background;
    }
  }

  const instructions = charInstructionsInput.value;
  const description = charDescriptionInput.value;
  const lore = charLoreInput.value;
  const tags = document.getElementById('char-tags').value;
  const reminder = document.getElementById('char-reminder').value;
  const narratorReminder = document.getElementById('char-narrator-reminder').value;
  const musicUrl = document.getElementById('char-music-url').value.trim();
  const cardType = cardTypeWorldRadio.checked ? 'world' : 'character';
  const characterIds = cardType === 'world' ? Array.from(worldCharSelectedIds) : [];
  const scenarioEntries = document.querySelectorAll('.scenario-entry');
  const scenarios = [];
  scenarioEntries.forEach(entry => {
    const nameInput = entry.querySelector('.scenario-name-input');
    const textInput = entry.querySelector('textarea');
    if (textInput.value.trim() !== "") {
      scenarios.push({
        name: nameInput.value.trim() || 'Unnamed Scenario',
        text: textInput.value
      });
    }
  });
    closeEditor();

  if (charIdToEdit) {
    const character = characters[charIdToEdit];
    character.name = cardName;
    character.chatName = chatName;
    character.avatar = cardType === 'world' ? '' : finalAvatar;
    character.background = finalBackground;
    character.instructions = instructions;
    character.description = description;
    character.lore = lore;
    character.tags = tags;
    character.reminder = reminder;
    character.narratorReminder = narratorReminder;
    character.musicUrl = musicUrl;
    character.scenarios = scenarios;
    character.type = cardType;
    character.characterIds = characterIds;
    await saveSingleCharacterToDB(character);
  } else {
    const newCharacter = {
      id: 'char-' + Date.now(),
      name: cardName,
      chatName: chatName,
      avatar: cardType === 'world' ? '' : finalAvatar,
      background: finalBackground,
      instructions: instructions,
      description: description,
      lore: lore,
      tags: tags,
      reminder: reminder,
      narratorReminder: narratorReminder,
      musicUrl: musicUrl,
      scenarios: scenarios,
      type: cardType,
      characterIds: characterIds,
      chats: {}
    };
    characters[newCharacter.id] = newCharacter;
    await saveSingleCharacterToDB(newCharacter);
  }

  renderCharacterList();
  if (currentCharacterId) {
    showChatList(currentCharacterId);
  }

}



function createScenarioInput(scenario) {
    const scenarioListDiv = document.getElementById('scenario-editor-list');
    const entryDiv = document.createElement('div');
    entryDiv.className = 'scenario-entry';
    const fieldsWrapper = document.createElement('div');
    fieldsWrapper.style.flexGrow = '1';
    const nameInput = document.createElement('input');

    nameInput.type = 'text';
    nameInput.className = 'scenario-name-input';
    nameInput.placeholder = 'Scenario title';
    nameInput.value = scenario.name || '';

    const textarea = document.createElement('textarea');
    textarea.rows = 7;
    textarea.placeholder = "Scenario description, User role, Story progression, First scene, First character message etc.";
    textarea.value = scenario.text || '';
    textarea.addEventListener('dblclick', (e) => e.target.style.height = `${e.target.scrollHeight}px`);
    textarea.addEventListener('input', autoResizeTextarea);

    const deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.className = 'delete-scenario-btn';
    deleteBtn.title = 'Delete Scenario';
    deleteBtn.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>`;

    fieldsWrapper.appendChild(nameInput);
    fieldsWrapper.appendChild(textarea);
    entryDiv.appendChild(fieldsWrapper);
    entryDiv.appendChild(deleteBtn);
    scenarioListDiv.appendChild(entryDiv);
}

// (scenario listeners moved to js/main.js)



// createModelEntry -> moved to js/settings.js



    async function saveAndCloseMessageEditor() {
        const messageId = messageEditorModal.dataset.editingMessageId;
        const chat = characters[currentCharacterId]?.chats?.[currentChatId];
        if (!chat || !messageId) return;

        const messageToUpdate = chat.history.find(m => m.id === messageId);
        if (!messageToUpdate) return;
        if(messageToUpdate.sender === 'ai') {
            const activeVariant = messageToUpdate.variations[messageToUpdate.activeVariant];
            activeVariant.main = messageEditorTextarea.value;
        } else {
             messageToUpdate.main = messageEditorTextarea.value;
        }
        
        const characterToSave = characters[currentCharacterId];
        await saveSingleCharacterToDB(characterToSave); 

messageEditorModal.classList.add('hidden');
        delete messageEditorModal.dataset.editingMessageId;
        
        const currentScroll = chatWindow.scrollTop;
    startChat(currentCharacterId, currentChatId);
    setTimeout(() => {
        chatWindow.scrollTop = currentScroll;
    }, 0);
    updateTokenCount();
}
