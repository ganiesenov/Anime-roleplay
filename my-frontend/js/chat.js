// =============================================================
// chat.js — the chat core: chat-list navigation, chat memories,
// start/create chat, message rendering (displayMessage, typewriter,
// think-blocks), and the send/regenerate/continue flows with
// streaming to the backend.
// NOTE: handleChatSubmit/handleRegenerate/handleContinue each carry
// the backend fields `character_id`/`chat_id` in their fetch body —
// preserved verbatim. The three stream blocks remain duplicated
// (intentionally not merged).
// Depends on globals resolved at call time across the other files.
// =============================================================

    function showChatList(charId) {
        const previousCharacterId = currentCharacterId;
        freezeLayout();
  currentCharacterId = charId;
  localStorage.setItem('activeCharacterId', charId);
  localStorage.removeItem('activeChatId');
  characterSelectionScreen.classList.add('is-inactive');
  chatListScreen.classList.remove('is-inactive');
  tutorialOnScreenChange('chat-list');
  chatScreen.classList.add('is-inactive');
  characterSelectionScreen.style.pointerEvents = 'none';
  chatListScreen.style.pointerEvents = 'auto';
  chatScreen.style.pointerEvents = 'none';
  const character = characters[charId];
  
  const backgroundUrl = getImageUrl(character.background);
  if (backgroundUrl) {
    chatListScreen.style.backgroundImage = `url('${backgroundUrl}')`;
    starsContainer.classList.remove('visible');
  } else {
    chatListScreen.style.backgroundImage = 'none';
    starsContainer.classList.add('visible');
  }

  const avatarImg = document.getElementById('chat-list-avatar');
  const nameH2 = document.getElementById('chat-list-character-name');

  const isWorldChatList = character.type === 'world';
  const dashboardAvatarUrl = getImageUrl(isWorldChatList ? character.background : character.avatar);
const avatarContainer = document.getElementById('chat-list-avatar-container');

avatarImg.onerror = () => {
    avatarContainer.classList.add('hidden');
    chatListAvatarPlaceholder.classList.remove('hidden');
    chatListAvatarPlaceholder.textContent = isWorldChatList ? '🌍' : '👤';
};

if (dashboardAvatarUrl) {
    avatarImg.src = dashboardAvatarUrl;
    smartObjectFit(avatarImg);
    avatarContainer.style.backgroundImage = `url('${dashboardAvatarUrl}')`;
    avatarContainer.classList.remove('hidden');
    chatListAvatarPlaceholder.classList.add('hidden');
} else {
    avatarContainer.classList.add('hidden');
    chatListAvatarPlaceholder.classList.remove('hidden');
    chatListAvatarPlaceholder.textContent = isWorldChatList ? '🌍' : '👤';
    avatarContainer.style.backgroundImage = 'none';
}
  nameH2.textContent = character.name;
  chatSessionListDiv.innerHTML = '';
  if (character.chats && Object.keys(character.chats).length > 0) {
    const chatIds = Object.keys(character.chats).sort((a, b) => b.localeCompare(a));
    chatIds.forEach(chatId => {
      const chat = character.chats[chatId];
      const chatEntry = document.createElement('div');
      chatEntry.className = 'chat-session-entry';
      chatEntry.innerHTML = `
        <span class="chat-session-name" data-chat-id="${chatId}">${chat.name}</span>
        <div class="chat-session-actions">
          <button class="rename-chat-btn" data-chat-id="${chatId}">Rename</button>
          <button class="delete-chat-btn" data-chat-id="${chatId}">Delete</button>
        </div>`;
      chatSessionListDiv.appendChild(chatEntry);
    });
  } else {
    chatSessionListDiv.innerHTML = '<p style="color:rgb(233, 233, 233);">No chats yet.</p>';
  }
  document.querySelectorAll('.chat-session-name').forEach(nameSpan => {
  nameSpan.addEventListener('click', async (e) => {
    await startChat(charId, e.target.dataset.chatId);
  });
});
  document.querySelectorAll('.rename-chat-btn').forEach(button => {
    button.addEventListener('click', (e) => handleRenameChat(charId, e.target.dataset.chatId));
  });
  document.querySelectorAll('.delete-chat-btn').forEach(button => {
    button.addEventListener('click', (e) => handleDeleteChat(charId, e.target.dataset.chatId));
  });
  if (previousCharacterId !== charId) {
    chatListScreen.scrollTop = 0;
  }
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      unfreezeLayout();
    });
  });

}



    async function handleDeleteChat(charId, chatId) {
        const chatName = characters[charId].chats[chatId].name;
        if (await showCustomConfirm(`Are you sure you want to delete the chat "${chatName}"?`, true)) {
            delete characters[charId].chats[chatId];
            await saveSingleCharacterToDB(characters[charId]);
            showChatList(charId);
        }
    }



    function updateTokenCount() {
    if (!currentCharacterId || !currentChatId) return;
    const chat = characters[currentCharacterId]?.chats?.[currentChatId];
    if (!chat || !tokenTooltip) return;

    let contextText = '';
    if (chat.activePersonaId && personas[chat.activePersonaId]) {
        contextText += personas[chat.activePersonaId].description || '';
    }
    if (chat.memories) {
        contextText += chat.memories;
    }
    chat.history.forEach(msg => {
        contextText += msg.sender === 'user' ? msg.main : msg.variations[msg.activeVariant].main;
    });
    let totalTokens = Math.round(contextText.length / 4);

    let characterContextText = '';
    
    if (chat.participants) {
        chat.participants.forEach(participantId => {
            const participant = characters[participantId];
            if (participant && participant.description) {
                characterContextText += participant.description;
            }
        });
    }

    const mainCharacter = characters[currentCharacterId];
    if (mainCharacter && mainCharacter.lore) {
        characterContextText += mainCharacter.lore;
    }

    totalTokens += Math.round(characterContextText.length / 4);

    totalTokens += 2000;

    tokenTooltip.textContent = `Estimated Tokens in Context: ~${totalTokens}`;
}



// calculateCharacterTokens, updateEditorTokenCount, updatePersonaEditorTokenCount -> moved to js/characters.js



    
    function updateChatMemoriesButtonState() {
        if (!chatMemoriesBtn) return;
        const chat = characters[currentCharacterId]?.chats?.[currentChatId];
        const hasMemories = !!(chat && chat.memories && chat.memories.trim());
        chatMemoriesBtn.classList.toggle('active', hasMemories);
        chatMemoriesBtn.setAttribute('title', hasMemories ? 'Chat Memories (active)' : 'Chat Memories');
    }



    function closeChatMemoriesModal() {
        if (chatMemoriesModal) {
            chatMemoriesModal.classList.add('hidden');
        }
    }



    function openChatMemoriesModal() {
        const chat = characters[currentCharacterId]?.chats?.[currentChatId];
        if (!chat || !chatMemoriesModal || !chatMemoriesTextarea) return;

        chatMemoriesTextarea.value = chat.memories || '';
        chatMemoriesModal.classList.remove('hidden');
        chatMemoriesTextarea.focus();
        autoResizeTextarea({ target: chatMemoriesTextarea });
        chatMemoriesTextarea.selectionStart = chatMemoriesTextarea.selectionEnd = chatMemoriesTextarea.value.length;
    }



    async function saveChatMemories() {
        const chat = characters[currentCharacterId]?.chats?.[currentChatId];
        if (!chat) return;

        chat.memories = (chatMemoriesTextarea?.value || '').trim();
        await saveSingleCharacterToDB(characters[currentCharacterId]);
        updateChatMemoriesButtonState();
        updateTokenCount();
        closeChatMemoriesModal();
        showToast(chat.memories ? '✓ Memories saved' : '✓ Memories cleared');
    }


        
    async function handleRenameChat(charId, chatId) {
        const chat = characters[charId].chats[chatId];
        const newName = await showCustomPrompt("Enter a new name for the chat:", chat.name);
        if (newName && newName.trim() !== "") {
            chat.name = newName.trim();
            await saveSingleCharacterToDB(characters[charId]);
            showChatList(charId);
        }
    }



        function showMainScreen() {
    chatListScreen.classList.add('is-inactive');
    chatScreen.classList.add('is-inactive');
    characterSelectionScreen.classList.remove('is-inactive');
    characterSelectionScreen.style.pointerEvents = 'auto';
chatListScreen.style.pointerEvents = 'none';
chatScreen.style.pointerEvents = 'none';
    starsContainer.style.transition = 'none';
    starsContainer.classList.add('visible');
    setTimeout(() => {
        starsContainer.style.transition = 'opacity 0.5s ease-in-out';
    }, 10);
    currentCharacterId = null;
    localStorage.removeItem('activeCharacterId');
    localStorage.removeItem('activeChatId');
}



    function showCharacterSelection() {
        stopParticles();
        if (window._musicFeatureReady) stopMusic();
        if ('speechSynthesis' in window) speechSynthesis.cancel();
        chatWindow.style.display = 'none';
    void chatWindow.offsetHeight;
    chatWindow.style.display = 'flex';
    chatScreen.classList.add('is-inactive');
    characterSelectionScreen.style.pointerEvents = 'auto';
chatListScreen.style.pointerEvents = 'none';
chatScreen.style.pointerEvents = 'none';
    settingsPanel.classList.add('hidden');
    const lastCharId = localStorage.getItem('activeCharacterId');
    if (lastCharId && characters[lastCharId]) {
        showChatList(lastCharId);
    } else {
        characterSelectionScreen.classList.remove('is-inactive');
    }
    localStorage.removeItem('activeChatId');
    currentChatId = null;
}



// bulkSelectedCharIds + openBulkCharacterDeleteModal, renderBulkCharacterDeleteList, toggleSelectAllCharacters, updateSelectAllState, performBulkCharacterDelete -> moved to js/characters.js



// escapeHtml (dead duplicate), fileToDataURL, imageFileToWebp -> moved to js/utils.js



    async function startChat(charId, chatId) {
    clearActiveGroupParticipant();
    pendingReplyOptions = null;
    ++replyOptionsReqId;
    hideReplyOptionsDropdown();
    starsContainer.classList.remove('visible');
    currentCharacterId = charId;
    currentChatId = chatId;
    localStorage.setItem('activeCharacterId', charId);
    localStorage.setItem('activeChatId', chatId);

    const character = characters[charId];
    const chat = character.chats[chatId];

    if (!chat.participants) chat.participants = [charId];
    if (chat.activePersonaId === undefined) chat.activePersonaId = null;
    if (chat.memories === undefined) chat.memories = '';
    closeChatMemoriesModal();
    
    selectPersonaBtn.classList.remove('hidden');

    chatListScreen.classList.add('is-inactive');
    characterSelectionScreen.classList.add('is-inactive');
    chatScreen.classList.remove('is-inactive');
    tutorialOnScreenChange('chat');
    characterSelectionScreen.style.pointerEvents = 'none';
chatListScreen.style.pointerEvents = 'none';
chatScreen.style.pointerEvents = 'auto';

    chatCharacterName.textContent = chat.name;

    const isWorldChat = character.type === 'world';
    if (chatWorldBadge) chatWorldBadge.classList.toggle('hidden', !isWorldChat);
    const headerAvatarUrl = isWorldChat ? character.background : character.avatar;

chatAvatar.onerror = () => {
    chatAvatar.classList.add('hidden');
    chatAvatarPlaceholder.classList.remove('hidden');
    chatAvatarPlaceholder.textContent = isWorldChat ? '🌍' : '👤';
};

if (headerAvatarUrl) {
    chatAvatar.src = getImageUrl(headerAvatarUrl);
    smartObjectFit(chatAvatar);
    chatAvatar.classList.remove('hidden');
    chatAvatarPlaceholder.classList.add('hidden');
} else {
    chatAvatar.classList.add('hidden');
    chatAvatarPlaceholder.classList.remove('hidden');
    chatAvatarPlaceholder.textContent = isWorldChat ? '🌍' : '👤';
}

    const chatScreenDiv = document.getElementById('chat-screen');
    if (character.background) {
    chatScreenDiv.style.backgroundImage = `url('${getImageUrl(character.background)}')`;
    starsContainer.classList.remove('visible');
} else {
    chatScreenDiv.style.backgroundImage = 'none';
    starsContainer.classList.add('visible');
}

    chatWindow.innerHTML = '';
    if (!chat.history) chat.history = [];

    chat.history.forEach(message => {
        displayMessage(message);
    });

    renderParticipantIcons();
    updateChatMemoriesButtonState();
    updateTokenCount();
    updateMoodButton();
    updateParticleButton();
    startParticles(character.particleEffect || 'none', character.particleIntensityLevel);
    const musicUrlInputEl = document.getElementById('music-url-input');
    if (musicUrlInputEl) {
        const savedUserUrl = localStorage.getItem(`userMusicUrl:${currentCharacterId}`);
        const effectiveUrl = (savedUserUrl !== null) ? savedUserUrl : (character.musicUrl || '');
        musicUrlInputEl.value = effectiveUrl;
        if (window._musicFeatureReady) {
            if (effectiveUrl) playMusic(effectiveUrl); else stopMusic();
        }
    }
    await saveSingleCharacterToDB(character);
if (window.__scrollToBottomNextStartChat) {
    setTimeout(() => {
        chatWindow.scrollTop = chatWindow.scrollHeight;
        window.__scrollToBottomNextStartChat = false;
    }, 0);
} else {
    const k = `chatScrollPos:${currentCharacterId}:${currentChatId}`;
const saved = localStorage.getItem(k);
if (saved !== null) {
  setTimeout(() => {
    chatWindow.scrollTop = parseInt(saved, 10);
  }, 0);
}
}

}



async function createNewChat(initialMessage = null, scenarioName = null) {
    if (!currentCharacterId) return;
    const character = characters[currentCharacterId];
    if (!character.chats) {
        character.chats = {};
    }
    const isWorldCard = character.type === 'world';
    const newChatId = 'chat-' + Date.now();
    let newName;
    if (scenarioName) {
        const timeOptions = { hour: '2-digit', minute: '2-digit' };
        newName = `${scenarioName} - ${new Date().toLocaleDateString('en-EN')}, ${new Date().toLocaleTimeString('en-EN', timeOptions)}`;
    } else {
        const timeOptions = { hour: '2-digit', minute: '2-digit' };
        newName = `New Chat - ${new Date().toLocaleDateString('en-EN')}, ${new Date().toLocaleTimeString('en-EN', timeOptions)}`;
    }
    let history = [];
    if (initialMessage) {
        const messageObject = {
            id: 'msg-' + Date.now(),
            sender: 'ai',
            type: isWorldCard ? 'story' : 'dialog',
            variations: [{ main: initialMessage, think: null }],
            activeVariant: 0
        };
        history.push(messageObject);
    }
    const worldParticipants = isWorldCard
        ? [currentCharacterId, ...(character.characterIds || []).filter(id => characters[id])]
        : [currentCharacterId];
    character.chats[newChatId] = {
        id: newChatId,
        name: newName,
        history: history,
        memories: '',
        participants: worldParticipants,
        activePersonaId: null,
        mood: null
    };
    await saveSingleCharacterToDB(character);
    window.__scrollToBottomNextStartChat = true;
await startChat(currentCharacterId, newChatId);
}



// escapeHtml -> moved to js/utils.js

function sanitizeModelOutput(text) {
    if (text === null || text === undefined) return '';
    let s = typeof text === 'string' ? text : String(text);
    // Strip null bytes and ASCII control characters (keep tab \x09, newline \x0A, carriage return \x0D)
    s = s.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
    // Strip common LLM special tokens that may leak into output as artifacts
    s = s.replace(/<\|im_start\|>/g, '').replace(/<\|im_end\|>/g, '');
    s = s.replace(/<\|begin_of_text\|>/g, '').replace(/<\|end_of_text\|>/g, '');
    s = s.replace(/<\|eot_id\|>/g, '').replace(/<\|endoftext\|>/g, '');
    s = s.replace(/<\|start_header_id\|>[\s\S]*?<\|end_header_id\|>/g, '');
    return s;
}

function stripThinkTags(text) {
    const safe = sanitizeModelOutput(text);
    if (!safe) return '';
    return safe.replace(/<\s*\/?\s*think\s*>/gi, '').trim();
}

function ensureThinkBlockElements(messageElement) {
    if (!messageElement) return { thinkBlock: null, thinkContent: null };

    let thinkBlock = messageElement.querySelector('.think-block');
    let thinkContent = thinkBlock ? thinkBlock.querySelector('.think-block-content') : null;

    if (!thinkBlock) {
        thinkBlock = document.createElement('details');
        thinkBlock.className = 'think-block hidden';
        thinkBlock.innerHTML = `<summary class="think-block-summary">Show Thoughts</summary><div class="think-block-content"></div>`;

        const mainContent = messageElement.querySelector('.main-content');
        if (mainContent && mainContent.parentNode === messageElement) {
            messageElement.insertBefore(thinkBlock, mainContent);
        } else {
            messageElement.appendChild(thinkBlock);
        }
        thinkContent = thinkBlock.querySelector('.think-block-content');
    } else if (!thinkContent) {
        thinkContent = document.createElement('div');
        thinkContent.className = 'think-block-content';
        thinkBlock.appendChild(thinkContent);
    }

    return { thinkBlock, thinkContent };
}

function extractMainFromReasoning(reasoningText) {
    const safe = sanitizeModelOutput(reasoningText);
    if (!safe) return '';
    const closeIdx = safe.toLowerCase().indexOf("</think>");
    if (closeIdx !== -1) {
        const tail = safe.slice(closeIdx + "</think>".length).trim();
        if (tail) return stripThinkTags(tail);
    }
    return stripThinkTags(safe);
}

// formatSubString -> moved to js/utils.js

function createTypewriter(charsPerFrame = 3) {
    let target = '';
    let displayed = 0;
    let rafId = null;
    let onRender = null;

    function tick() {
        if (displayed < target.length && onRender) {
            displayed = Math.min(displayed + charsPerFrame, target.length);
            onRender(target.slice(0, displayed));
        }
        rafId = displayed < target.length ? requestAnimationFrame(tick) : null;
    }

    return {
        init(text) { target = text; displayed = text.length; },
        update(text, renderer) {
            onRender = renderer;
            if (text.length > target.length) {
                target = text;
                if (!rafId) rafId = requestAnimationFrame(tick);
            }
        },
        flush(text, renderer) {
            if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
            target = text;
            displayed = text.length;
            renderer(text);
        }
    };
}

function createTypingIndicator() {
    const container = document.createElement('span');
    container.className = 'typing-dots';
    for (let i = 0; i < 3; i++) {
        const dot = document.createElement('span');
        dot.className = 'typing-dot';
        container.appendChild(dot);
    }
    return container;
}

function setBubbleLoading(mainContentEl, isLoading, options = {}) {
    if (!mainContentEl) return;
    const preserveText = options.preserveText || false;

    if (isLoading) {
        if (!preserveText) {
            mainContentEl.classList.add('is-loading');
            mainContentEl.innerHTML = '';
        }
        if (!mainContentEl.querySelector('.typing-dots')) {
            const indicator = createTypingIndicator();
            if (preserveText) indicator.classList.add('after-text');
            mainContentEl.appendChild(indicator);
        }
    } else {
        mainContentEl.classList.remove('is-loading');
        const indicator = mainContentEl.querySelector('.typing-dots');
        if (indicator) indicator.remove();
    }
}



function displayMessage(message) {
    let messageWrapper = document.createElement('div');
    const messageElement = document.createElement('div');
    messageElement.classList.add('message');
    messageElement.dataset.messageId = message.id;

    let mainText, thinkText;
    if (message.sender === 'user') {
        const chat = characters[currentCharacterId]?.chats?.[currentChatId];
        const personaId = chat?.activePersonaId;
        const persona = personaId ? personas[personaId] : null;
        const personaAvatarUrl = persona?.avatar;

        if (personaAvatarUrl) {
            messageWrapper.classList.add('user-message-container');
            messageElement.classList.add('user-message');
            mainText = message.main;

            const avatarContainer = document.createElement('div');
avatarContainer.className = 'message-avatar effect-container';
avatarContainer.style.backgroundImage = `url('${getImageUrl(personaAvatarUrl)}')`;

const avatarImg = document.createElement('img');
avatarImg.src = getImageUrl(personaAvatarUrl);
avatarImg.title = persona.name;
smartObjectFit(avatarImg);

const placeholderDiv = document.createElement('div');
placeholderDiv.className = 'message-avatar placeholder-icon hidden';
placeholderDiv.innerHTML = '👤';

avatarImg.onerror = () => {
    avatarImg.style.display = 'none';
    placeholderDiv.classList.remove('hidden');
    avatarContainer.classList.remove('effect-container');
    avatarContainer.style.backgroundImage = 'none';
};

avatarContainer.appendChild(avatarImg);
avatarContainer.appendChild(placeholderDiv); 
messageWrapper.appendChild(messageElement);
messageWrapper.appendChild(avatarContainer);
        } else {

            messageWrapper = messageElement;
            messageWrapper.classList.add('user-message');
            mainText = message.main;
        }
        thinkText = null;

    } else { 
        messageWrapper.classList.add('ai-message-container');
        messageElement.classList.add('ai-message');
        if (message.type === 'story') {
            messageElement.classList.add('story-message');
        }
        const activeVariant = message.variations[message.activeVariant];
        const sanitizedMain = sanitizeModelOutput(activeVariant.main);
        if (sanitizedMain !== activeVariant.main) {
            activeVariant.main = sanitizedMain;
        }
        mainText = sanitizedMain;

        if (activeVariant.think) {
            const sanitizedThink = sanitizeModelOutput(activeVariant.think);
            if (sanitizedThink !== activeVariant.think) {
                activeVariant.think = sanitizedThink;
            }
            thinkText = sanitizedThink;
        } else {
            thinkText = null;
        }
        
        if (message.type !== 'story') {
            const speakerId = message.speakerId || currentCharacterId;
            const speakerCharacter = characters[speakerId];

            if (speakerCharacter && speakerCharacter.type !== 'world') {
                const avatarUrl = speakerCharacter.avatar;
                const avatarContainer = document.createElement('div');
avatarContainer.className = 'message-avatar';

const placeholderDiv = document.createElement('div');
placeholderDiv.className = 'message-avatar placeholder-icon';
placeholderDiv.innerHTML = '👤';
placeholderDiv.title = speakerCharacter.name || 'Unknown';

if (avatarUrl) {
    avatarContainer.classList.add('effect-container');
    avatarContainer.style.backgroundImage = `url('${getImageUrl(avatarUrl)}')`;

    const avatarImg = document.createElement('img');
    avatarImg.src = getImageUrl(avatarUrl);
    avatarImg.title = speakerCharacter.name;
    smartObjectFit(avatarImg);

    placeholderDiv.classList.add('hidden');

    avatarImg.onerror = () => {
        avatarImg.style.display = 'none';
        placeholderDiv.classList.remove('hidden');
        avatarContainer.classList.remove('effect-container');
        avatarContainer.style.backgroundImage = 'none';
    };

    avatarContainer.appendChild(avatarImg);
}

avatarContainer.appendChild(placeholderDiv);
messageWrapper.appendChild(avatarContainer);
            }
        }
    }

    if (message.sender === 'ai' && thinkText) {
        const { thinkBlock, thinkContent } = ensureThinkBlockElements(messageElement);
        if (thinkBlock && thinkContent) {
            thinkBlock.classList.remove('hidden');
            thinkContent.innerHTML = `&lt;think&gt;<br>${formatSubString(thinkText)}<br>&lt;/think&gt;`;
        }
    }
    
    const mainContent = document.createElement('div');
    mainContent.className = 'main-content';
    mainContent.dataset.editPart = 'main';
    const shouldShowLoader = message.sender === 'ai' && message.isStreaming && mainText === '...';
    if (shouldShowLoader) {
        setBubbleLoading(mainContent, true);
    } else if (typeof mainText === 'string') {
        mainContent.innerHTML = formatSubString(mainText);
    }
    messageElement.appendChild(mainContent);

    const actionGroup = document.createElement('div');
    actionGroup.className = 'message-action-group';
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'delete-message-btn message-action-btn';
    deleteBtn.title = 'Delete message and following';
    deleteBtn.innerHTML = `<svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor"><path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z"/><path fill-rule="evenodd" d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"/></svg>`;
    actionGroup.appendChild(deleteBtn);
    const editBtn = document.createElement('button');
    editBtn.className = 'edit-message-btn message-action-btn';
    editBtn.title = 'Edit message';
    editBtn.innerHTML = `<svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor"><path d="M12.854.146a.5.5 0 0 0-.707 0L10.5 1.793 14.207 5.5l1.647-1.646a.5.5 0 0 0 0-.708l-3-3zm.646 6.061L9.793 2.5 3.293 9H3.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.207l6.5-6.5zm-7.468 7.468A.5.5 0 0 1 6 13.5V13h-.5a.5.5 0 0 1-.5-.5V12h-.5a.5.5 0 0 1-.5-.5V11h-.5a.5.5 0 0 1-.5-.5V10h-.5a.499.499 0 0 1-.175-.032l-.179.178a.5.5 0 0 0-.11.168l-2 5a.5.5 0 0 0 .65.65l5-2a.5.5 0 0 0 .168-.11l.178-.178z"/></svg>`;
    actionGroup.appendChild(editBtn);
    if (message.sender === 'ai' && 'speechSynthesis' in window) {
        const ttsBtn = document.createElement('button');
        ttsBtn.className = 'tts-btn message-action-btn';
        ttsBtn.title = 'Read aloud';
        ttsBtn.textContent = '🔊';
        ttsBtn.addEventListener('click', () => {
            if (speechSynthesis.speaking) {
                speechSynthesis.cancel();
                ttsBtn.textContent = '🔊';
            } else {
                speakText(mainText, message.id);
            }
        });
        actionGroup.appendChild(ttsBtn);
    }
    messageElement.appendChild(actionGroup);

    if (message.sender === 'ai') {
        const controls = document.createElement('div');
        controls.className = 'message-controls';
        if (message.isStreaming) controls.classList.add('is-streaming');

        if (message.variations.length > 1) {
            const prevBtn = document.createElement('button');
            prevBtn.className = 'prev-variant-btn';
            prevBtn.innerHTML = '‹';
            prevBtn.disabled = message.activeVariant === 0;

            const counter = document.createElement('span');
            counter.className = 'variant-counter';
            counter.textContent = `${message.activeVariant + 1}/${message.variations.length}`;

            const nextBtn = document.createElement('button');
            nextBtn.className = 'next-variant-btn';
            nextBtn.innerHTML = '›';
            nextBtn.disabled = message.activeVariant >= message.variations.length - 1;

            controls.appendChild(prevBtn);
            controls.appendChild(counter);
            controls.appendChild(nextBtn);
        }

        const regenBtn = document.createElement('button');
        regenBtn.className = 'regenerate-btn';
        regenBtn.innerHTML = `<svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor"><path fill-rule="evenodd" d="M8 3a5 5 0 1 0 4.546 2.914.5.5 0 0 1 .908-.417A6 6 0 1 1 8 2v1z"/><path d="M8 4.466V.534a.25.25 0 0 1 .41-.192l2.36 1.966c.12.1.12.284 0 .384L8.41 4.658A.25.25 0 0 1 8 4.466z"/></svg>`;
        regenBtn.title = 'Regenerate Response';
        controls.appendChild(regenBtn);
        const continueBtn = document.createElement('button');
        continueBtn.className = 'continue-btn';
        continueBtn.innerHTML = `<svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor"><path fill-rule="evenodd" d="M3.646 1.646a.5.5 0 0 1 .708 0l6 6a.5.5 0 0 1 0 .708l-6 6a.5.5 0 0 1-.708-.708L9.293 8 3.646 2.354a.5.5 0 0 1 0-.708z"/><path fill-rule="evenodd" d="M7.646 1.646a.5.5 0 0 1 .708 0l6 6a.5.5 0 0 1 0 .708l-6 6a.5.5 0 0 1-.708-.708L13.293 8 7.646 2.354a.5.5 0 0 1 0-.708z"/></svg>`;
        continueBtn.title = 'Continue Response';
        controls.appendChild(continueBtn);
        messageElement.appendChild(controls);
    }
    
    if (message.sender !== 'user' || !characters[currentCharacterId]?.chats?.[currentChatId]?.activePersonaId) {

        if(message.sender === 'ai') messageWrapper.appendChild(messageElement);
    }

    chatWindow.appendChild(messageWrapper);
    return messageWrapper;
}



async function addNewMessage(rawMessage, sender, type = 'dialog', forceScroll = false) {
    const messageId = 'msg-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
    const chat = characters[currentCharacterId]?.chats?.[currentChatId];
    if (!chat) return;

    let messageObject;

    if (sender === 'user') {
        messageObject = { id: messageId, sender: 'user', main: rawMessage };
    } else { 
        const thinkRegex = /<think>([\s\S]*?)<\/think>/i;
        const thinkMatch = rawMessage.match(thinkRegex);
        let thinkText = null;
        let mainText = rawMessage;
        if (thinkMatch) {
            thinkText = thinkMatch[1].trim();
            mainText = rawMessage.replace(thinkRegex, '').trim();
        }
        mainText = sanitizeModelOutput(mainText);
        if (thinkText) {
            thinkText = sanitizeModelOutput(thinkText);
        }
        messageObject = {
            id: messageId,
            sender: 'ai',
            type: type, 
            variations: [{ main: mainText, think: thinkText }],
            activeVariant: 0
        };
    }

    if (!chat.history) chat.history = [];
    chat.history.push(messageObject);
    await saveCharactersToDB();
    displayMessage(messageObject);
    if (forceScroll) {
        chatWindow.scrollTop = chatWindow.scrollHeight;
    }
}



async function handleChatSubmit(type) {
    hideUndoDeleteFab();
    pendingReplyOptions = null;
    hideReplyOptionsDropdown();
    const userMessageRaw = messageInput.value.trim();
    messageInput.value = '';
    autoResizeTextarea({ target: messageInput });
    messageInput.focus();
    let mainCharacter = characters[currentCharacterId];
    let chat = mainCharacter.chats[currentChatId];
    let targetCharId = currentCharacterId;
    let finalUserMessage = userMessageRaw;

    hideGroupCharDropdown();

    if (chat?.participants && activeGroupParticipantId && chat.participants.includes(activeGroupParticipantId)) {
        targetCharId = activeGroupParticipantId;
    }

    let messageForAPI;
    let historyForAPI;
    let lastMessageInChat = chat.history && chat.history.length > 0 ? chat.history[chat.history.length - 1] : null;

    if (finalUserMessage) {
        addNewMessage(finalUserMessage, 'user', type, true);
        messageForAPI = finalUserMessage;
        const isMultiChar = chat.participants && chat.participants.length > 1;
        historyForAPI = chat.history.slice(0, -1).map(msg => {
    const activePersona = chat.activePersonaId ? personas[chat.activePersonaId] : null;
    if (msg.sender === 'ai') {
        const speaker = characters[msg.speakerId || currentCharacterId];
        const speakerName = speaker ? (speaker.chatName || speaker.name) : 'Character';
        let processedText = applyCharPlaceholder(msg.variations[msg.activeVariant].main, speakerName);
        processedText = applyUserPlaceholder(processedText, activePersona);
        return { sender: 'ai', main: isMultiChar ? `${speakerName}: ${processedText}` : processedText };
    } else {
        const userName = activePersona?.name || 'User';
        let processedText = applyUserPlaceholder(msg.main, activePersona);
        return { sender: 'user', main: isMultiChar ? `${userName}: ${processedText}` : processedText };
    }
});
    } else { 
    if (!chat.history || chat.history.length === 0) {
        messageForAPI = "Introduce yourself in typical manner and start the roleplay with a creative scenario."; 
        historyForAPI = []; 
    } else {
        const historyCopy = [...chat.history];
        const lastMessage = historyCopy.pop();
        const lastVariant = lastMessage.variations ? lastMessage.variations[lastMessage.activeVariant] : null;
        const lastMainText = lastMessage.main || (lastVariant ? lastVariant.main : '');
        const trimmedLastMain = (lastMainText || '').trim();
        messageForAPI = trimmedLastMain || "Continue the scene plausibly based on the latest turn.";
        if (lastMessage.sender === 'ai') {
            messageForAPI += "\n\n(Continue the scene from your previous reply with new content. Do not repeat earlier sentences and drive the scene actively forward.)";
        }
        const isMultiChar = chat.participants && chat.participants.length > 1;
        historyForAPI = historyCopy.map(msg => {
            if (msg.sender === 'ai') {
                const speaker = characters[msg.speakerId || currentCharacterId];
                const speakerName = speaker ? (speaker.chatName || speaker.name) : 'Character';
                const text = applyCharPlaceholder(msg.variations[msg.activeVariant].main, speakerName);
                return { sender: 'ai', main: isMultiChar ? `${speakerName}: ${text}` : text };
            }
            const persona = chat.activePersonaId ? personas[chat.activePersonaId] : null;
            const userName = persona?.name || 'User';
            return { sender: 'user', main: isMultiChar ? `${userName}: ${msg.main}` : msg.main };
        });
    }
}

    const targetCharacter = characters[targetCharId];
    const charNameForAI = targetCharacter.chatName || targetCharacter.name;
    const activePersonaId = chat.activePersonaId;
    const persona = activePersonaId ? personas[activePersonaId] : null;

    const currentModelId = modelSelect.value || defaultSettings.model;
    const modelSettings = appSettings.availableModels.find(m => m.id === currentModelId);

    loadingIndicator.classList.remove('hidden');
    dialogBtn.disabled = true;
    storyBtn.disabled = true;
    stopStreamBtn.classList.remove('hidden');
    const MAX_RETRIES = 90;
    currentStreamController = new AbortController();
    let fullReply = '';
    let streamAbortedByUser = false;
    const newMessageId = 'msg-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
    let isFirstChunk = true;
    const aiMessageObject = {
        id: newMessageId,
        sender: 'ai',
        type: type,
        speakerId: targetCharId,
        variations: [{ main: '...', think: null }],
        activeVariant: 0,
        isStreaming: true,
        streamingVariant: 0
    };
    if (!chat.history) chat.history = [];
    chat.history.push(aiMessageObject);
    await saveSingleCharacterToDB(mainCharacter);
    const messageWrapper = displayMessage(aiMessageObject);
    let mainContentEl = messageWrapper.querySelector('.main-content');
    let thinkBlockEl = messageWrapper.querySelector('.think-block');
    let thinkBlockContentEl = thinkBlockEl ? thinkBlockEl.querySelector('.think-block-content') : null;
    const regenBtn = messageWrapper.querySelector('.regenerate-btn');
    const continueBtn = messageWrapper.querySelector('.continue-btn');
    const controls = messageWrapper.querySelector('.message-controls');
    if (regenBtn) {
        regenBtn.disabled = true;
        regenBtn.classList.add('is-loading');
    }
    if (continueBtn) {
        continueBtn.disabled = true;
    }
    if (controls) { controls.classList.add('is-streaming'); controls.closest('.message')?.classList.add('msg-streaming'); }
    const mainContentElement = messageWrapper.querySelector('.main-content');
    let thinkBlockElement = messageWrapper.querySelector('.think-block');
const coldStartTimer = setTimeout(() => {
    const messageToUpdate = chat.history.find(m => m.id === newMessageId);
    if (messageToUpdate && messageToUpdate.variations[0].main === '...') {
        messageToUpdate.variations[0].main = "Connecting to AI Model - Please wait or regenerate the message.";
        updateSingleMessageView(newMessageId);
    }
}, 20000); 
const serverHungTimer = setTimeout(() => {
    const messageToUpdate = chat.history.find(m => m.id === newMessageId);
    if (messageToUpdate && messageToUpdate.variations[0].main.includes("Connecting to AI Model")) {
        messageToUpdate.variations[0].main = "The AI provider may be experiencing issues - Please wait a moment or try again later.";
        updateSingleMessageView(newMessageId);
    }
}, 70000);

const clearStreamTimers = () => {
    clearTimeout(coldStartTimer);
    clearTimeout(serverHungTimer);
};

const startTime = Date.now();
    chatWindow.scrollTop = chatWindow.scrollHeight;
    chatWindow._autoScroll = true;

    let fullSystemPrompt = '';
    if (modelSettings && modelSettings.instructions && modelSettings.instructions.trim() !== '') {
        fullSystemPrompt += `--- GLOBAL AI INSTRUCTIONS ---\n${applyUserPlaceholder(applyCharPlaceholder(modelSettings.instructions.trim(), charNameForAI), persona)}\n\n`;
    }
    if (persona) {
        fullSystemPrompt += `--- EXACT USER PERSONA ---\nName: ${persona.name}\nDescription: ${applyUserPlaceholder(applyCharPlaceholder(persona.description, charNameForAI), persona)}\n---\n\n`;
    }
    const isWorldChat = characters[currentCharacterId]?.type === 'world';
    const worldChar = isWorldChat ? characters[currentCharacterId] : null;

    if (isWorldChat) {
        const worldName = worldChar.name || 'This World';
        if (worldChar.description) fullSystemPrompt += `--- WORLD CONTEXT ---\nWorld: ${worldName}\n${worldChar.description.trim()}\n\n`;
        if (worldChar.lore) fullSystemPrompt += `--- WORLD LORE & HISTORY ---\n${worldChar.lore.trim()}\n\n`;
        if (worldChar.reminder) fullSystemPrompt += `--- WORLD RULES (CRITICAL — THESE RULES MAY NEVER BE BROKEN UNDER ANY CIRCUMSTANCES) ---\n${worldChar.reminder.trim()}\n\n`;
        if (targetCharId === currentCharacterId || type === 'story') {
            fullSystemPrompt += `[SYSTEM META-INSTRUCTION: Respond only as a third-person omniscient narrator of this world.\nDo not speak directly as any character. Narrate events, scenes, and interactions from a third-person perspective.]\n\n`;
            const worldChars = chat.participants.filter(pid => pid !== currentCharacterId);
            if (worldChars.length > 0) {
                fullSystemPrompt += `--- CHARACTERS IN THIS WORLD ---\n`;
                worldChars.forEach(pid => {
                    const pChar = characters[pid];
                    if (pChar) fullSystemPrompt += `Character: ${pChar.name}\nDescription: ${pChar.description || 'No description available.'}\n---\n`;
                });
                fullSystemPrompt += `\n`;
            }
        } else {
            fullSystemPrompt += `[SYSTEM META-INSTRUCTION: The user is addressing the character '${charNameForAI}' directly.\nRespond only as '${charNameForAI}' and do not respond as any other character.]\n\n`;
            if (targetCharacter.instructions) fullSystemPrompt += `--- CHARACTER AI INSTRUCTIONS ---\n${applyUserPlaceholder(applyCharPlaceholder(targetCharacter.instructions, charNameForAI), persona).trim()}\n\n`;
            if (targetCharacter.description) fullSystemPrompt += `--- CHARACTER DESCRIPTION ---\n${targetCharacter.description.trim()}\n\n`;
            if (targetCharacter.lore) fullSystemPrompt += `--- CHARACTER LORE ---\n${targetCharacter.lore.trim()}\n\n`;
        }
    } else if (type === 'story') {
        fullSystemPrompt += `[SYSTEM META-INSTRUCTION: Respond only as a third-person omniscient narrator.\nDo not speak as any character and narrate the scene objectively.]\n\n`;
        fullSystemPrompt += `--- CHARACTERS IN SCENE ---\n`;
        chat.participants.forEach(pid => {
            const pChar = characters[pid];
            if (pChar) fullSystemPrompt += `Character: ${pChar.name}\nDescription: ${pChar.description || 'No description available.'}\n---\n`;
        });
        const mainCharacterForLore = characters[currentCharacterId];
        if (mainCharacterForLore && mainCharacterForLore.lore) {
            fullSystemPrompt += `\n--- LORE / BACKGROUND KNOWLEDGE ---\n${mainCharacterForLore.lore.trim()}\n\n`;
        }
    } else {
        if (chat.participants && chat.participants.length > 1) {
            fullSystemPrompt += `--- CHARACTERS IN SCENE ---\n`;
            chat.participants.forEach(pid => {
                const pChar = characters[pid];
                if (pChar) fullSystemPrompt += `Character: ${pChar.name}\nDescription: ${pChar.description || 'No description available.'}\n---\n`;
            });
            fullSystemPrompt += `\n`;
        }
        if (targetCharId !== currentCharacterId) {
            fullSystemPrompt += `[SYSTEM META-INSTRUCTION: The user is addressing the character '${charNameForAI}' directly.\nRespond only as '${charNameForAI}' and do not respond as any other character.]\n\n`;
        }
        if (targetCharacter.instructions) fullSystemPrompt += `--- CHARACTER AI INSTRUCTIONS ---\n${applyUserPlaceholder(applyCharPlaceholder(targetCharacter.instructions, charNameForAI), persona).trim()}\n\n`;
        if (targetCharacter.description) fullSystemPrompt += `--- CHARACTER DESCRIPTION ---\n${targetCharacter.description.trim()}\n\n`;
        if (targetCharacter.lore) fullSystemPrompt += `--- LORE / BACKGROUND KNOWLEDGE ---\n${targetCharacter.lore.trim()}\n\n`;
    }
    if (chat.mood) {
        fullSystemPrompt += `--- CHARACTER CURRENT MOOD (IMPORTANT) ---\nRight now ${charNameForAI} is feeling ${chat.mood}. Let this mood clearly and noticeably come through in their tone, word choice, body language, and reactions in this reply — make it obvious to the reader, while still staying in character.\n\n`;
    }
    const chatMemoriesText = (chat.memories || '').trim();
    if (chatMemoriesText) {
        fullSystemPrompt += `--- CHAT MEMORIES (HIGH PRIORITY, persist for this chat only; distinct from the initial scenario / first message) ---\n${chatMemoriesText}\n\n`;
    }
    if (replyLength === 'short') fullSystemPrompt += `--- REPLY LENGTH ---\nYour reply must be three or four sentences in length.\n\n`;
    else if (replyLength === 'medium') fullSystemPrompt += `--- REPLY LENGTH ---\nYour reply must be six or seven sentences in length.\n\n`;
    else if (replyLength === 'long') fullSystemPrompt += `--- REPLY LENGTH ---\nYour reply must be nine or ten sentences in length.\n\n`;
    else if (replyLength === 'verylong') fullSystemPrompt += `--- REPLY LENGTH ---\nYour reply must be twelve or thirteen sentences in length.\n\n`;
    const finalMessageForAPI = messageForAPI;
    const globalDialogReminder = applyUserPlaceholder(applyCharPlaceholder((modelSettings && modelSettings.reminder) ? modelSettings.reminder.trim() : '', charNameForAI), persona);
    const globalNarratorReminder = applyUserPlaceholder(applyCharPlaceholder((modelSettings && modelSettings.narratorReminder) ? modelSettings.narratorReminder.trim() : '', charNameForAI), persona);
    const characterDialogReminder = applyUserPlaceholder((targetCharacter.reminder || ''), persona).replace(/{{char}}/g, charNameForAI).trim();
    const characterNarratorReminder = applyUserPlaceholder((targetCharacter.narratorReminder || ''), persona).replace(/{{char}}/g, charNameForAI).trim();
    const combinedDialogReminder = [globalDialogReminder, characterDialogReminder].filter(Boolean).join('\n');
    const combinedNarratorReminder = [globalNarratorReminder, characterNarratorReminder].filter(Boolean).join('\n');
    const characterForAPI = { ...targetCharacter, description: fullSystemPrompt };

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        if (!currentStreamController) { streamAbortedByUser = true; break; }
        try {
            console.log(`Send request (Attempt ${attempt}/${MAX_RETRIES})...`);
            const currentTemperature = temperatureSlider.value;
            const currentModel = modelSelect.value;
            const lastMessageInHistory = chat.history[chat.history.length - 1];

const apiKeyToSend = (modelSettings && modelSettings.apiKey) || appSettings.apiKey;
const targetApiUrlToSend = (modelSettings && modelSettings.targetApiUrl) || DEFAULT_API_URL;
const isLocal = targetApiUrlToSend && (
    targetApiUrlToSend.includes('localhost') ||
    targetApiUrlToSend.includes('127.0.0.1') ||
    targetApiUrlToSend.includes('::1') ||
    /^https?:\/\/192\.168\./.test(targetApiUrlToSend) ||
    /^https?:\/\/10\./.test(targetApiUrlToSend) ||
    /^https?:\/\/172\.(1[6-9]|2[0-9]|3[01])\./.test(targetApiUrlToSend)
);

const reminderContent = type === 'dialog' ? combinedDialogReminder : combinedNarratorReminder;
const moodDirective = chat.mood ? `\n[MOOD — TOP PRIORITY: right now ${charNameForAI} is feeling ${chat.mood}. This emotion MUST be clearly and unmistakably visible in their tone, word choice, body language and reactions in THIS reply, even if it contrasts with their usual demeanor. Do not write them as calm or neutral — stay in character but let the ${chat.mood} show strongly.]` : '';
const lastUserContent = (reminderContent
    ? `${finalMessageForAPI}\n[${reminderContent}]`
    : finalMessageForAPI) + moodDirective;
const messages = [
    { role: 'system', content: characterForAPI.description },
    ...historyForAPI.map(h => ({ role: h.sender === 'ai' ? 'assistant' : 'user', content: h.main })),
    { role: 'user', content: lastUserContent },
];
const fetchUrl = targetApiUrlToSend;
const fetchBody = JSON.stringify({
    model: currentModel,
    messages,
    temperature: parseFloat(currentTemperature),
    top_p: 0.95,
    stream: true,
    character_id: currentCharacterId,
    chat_id: currentChatId,
    options: {
        num_ctx: modelSettings?.numCtx || 131072,
        top_p: 0.95
    }
});
const response = await fetch(fetchUrl, {
    method: 'POST',
    headers: isLocal
        ? { 'Content-Type': 'application/json' }
        : { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKeyToSend}` },
    signal: currentStreamController.signal,
    body: fetchBody
});

    clearStreamTimers();
            if (response.status === 429) {
                const elapsedTime = Date.now() - startTime;
if (elapsedTime > 20000) {
    const messageToUpdate = chat.history.find(m => m.id === newMessageId);
    if (messageToUpdate) {
        messageToUpdate.variations[0].main = `The selected AI Model experiences heavy traffic or is rate-limited (requests per minute). Please wait...`;
        updateSingleMessageView(newMessageId);
    }
}
                await new Promise(resolve => setTimeout(resolve, 1000));
                if (attempt === MAX_RETRIES) throw new Error("AI Model did not respond after multiple retries. Please try again later or choose another Model.");
                continue;
            }
            if (!response.ok) throw new Error(await response.text());
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            fullReply = '';
            const thinkRegex = /<think>([\s\S]*?)<\/think>/i;
            let reasoningBuf = '';
            let thinkOpened = false;
            let sseBuffer = '';
            const mainTypewriter = createTypewriter();
            const thinkTypewriter = createTypewriter();
            while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    sseBuffer += decoder.decode(value, { stream: true });
    const lines = sseBuffer.split('\n');
    sseBuffer = lines.pop() || '';
    const currentMessageElement = document.querySelector(`[data-message-id="${newMessageId}"]`);
    mainContentEl = currentMessageElement ? currentMessageElement.querySelector('.main-content') : null;
    thinkBlockEl = currentMessageElement ? currentMessageElement.querySelector('.think-block') : null;
    thinkBlockContentEl = thinkBlockEl ? thinkBlockEl.querySelector('.think-block-content') : null;
    const ensureThinkBlockPresent = () => {
        if (!currentMessageElement) return false;
        if (!thinkBlockEl || !thinkBlockContentEl) {
            const refs = ensureThinkBlockElements(currentMessageElement);
            thinkBlockEl = refs.thinkBlock;
            thinkBlockContentEl = refs.thinkContent;
        }
        return !!(thinkBlockEl && thinkBlockContentEl);
    };
    for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line.startsWith('data:')) continue;
        const dataContent = line.slice(5).trim();
        if (dataContent === '[DONE]') { sseBuffer = ''; break; }
        if (isFirstChunk) {
    const messageToUpdate = chat.history.find(m => m.id === newMessageId);
    if (messageToUpdate) {
        messageToUpdate.variations[0].main = '';
        messageToUpdate.isStreaming = false;
        messageToUpdate.streamingVariant = null;
    }
    if (mainContentEl) {
        setBubbleLoading(mainContentEl, false);
        mainContentEl.innerHTML = '';
    }
    isFirstChunk = false;
}
        try {
            const parsed = JSON.parse(dataContent);
            const delta = parsed.choices && parsed.choices[0] && parsed.choices[0].delta;
            if (delta?.content) {
                fullReply += delta.content;

                const openIdx = fullReply.search(/<think>/i);
                const closeIdx = fullReply.toLowerCase().indexOf("</think>");

                let mainOnly;
                let streamThinkText = null;
                let streamThinkComplete = false;

                if (openIdx === -1 && closeIdx !== -1) {
                    // Headless think: content before </think> is reasoning, after is main
                    mainOnly = fullReply.slice(closeIdx + "</think>".length).trimStart();
                    streamThinkText = fullReply.slice(0, closeIdx).trim();
                    streamThinkComplete = true;
                } else if (openIdx !== -1 && closeIdx !== -1 && closeIdx > openIdx) {
                    // Complete <think>...</think> inline block
                    mainOnly = (fullReply.slice(0, openIdx) + fullReply.slice(closeIdx + "</think>".length)).trim();
                    streamThinkText = fullReply.slice(openIdx + "<think>".length, closeIdx).trim();
                    streamThinkComplete = true;
                } else if (openIdx !== -1) {
                    // <think> opened but </think> not yet received — keep think content out of main
                    mainOnly = fullReply.slice(0, openIdx).trim();
                    streamThinkText = fullReply.slice(openIdx + "<think>".length).trim();
                    streamThinkComplete = false;
                } else {
                    mainOnly = fullReply.trim();
                }

                const sanitizedMainOnly = sanitizeModelOutput(mainOnly);
                aiMessageObject.variations[0].main = sanitizedMainOnly;
                mainTypewriter.update(sanitizedMainOnly, t => { if (mainContentEl) { mainContentEl.innerHTML = formatSubString(t); if (chatWindow._autoScroll !== false) chatWindow.scrollTop = chatWindow.scrollHeight; } });

                if (thinkEnabled && streamThinkText !== null && reasoningBuf === '' && ensureThinkBlockPresent()) {
                    thinkBlockEl.classList.remove('hidden');
                    thinkBlockEl.open = true;
                    const sanitizedThink = sanitizeModelOutput(streamThinkText);
                    thinkTypewriter.update(sanitizedThink, t => { if (thinkBlockContentEl) { thinkBlockContentEl.innerHTML = `&lt;think&gt;<br>${formatSubString(t)}<br>&lt;/think&gt;`; if (chatWindow._autoScroll !== false) chatWindow.scrollTop = chatWindow.scrollHeight; } });
                    if (streamThinkComplete) {
                        aiMessageObject.variations[0].think = sanitizedThink;
                    }
                }
            }
            if (delta?.reasoning) {
                reasoningBuf += delta.reasoning;
                if (thinkEnabled && ensureThinkBlockPresent()) {
                    thinkBlockEl.classList.remove('hidden');
                    thinkBlockEl.open = true;
                    const sanitizedReasoning = sanitizeModelOutput(reasoningBuf.trim());
                    thinkTypewriter.update(sanitizedReasoning, t => { if (thinkBlockContentEl) { thinkBlockContentEl.innerHTML = `&lt;think&gt;<br>${formatSubString(t)}<br>&lt;/think&gt;`; if (chatWindow._autoScroll !== false) chatWindow.scrollTop = chatWindow.scrollHeight; } });
                    aiMessageObject.variations[0].think = sanitizedReasoning;
                }
            }
        } catch {
            continue;
        }
    }
}
            const hasAnyReplyText = fullReply.trim() !== '' || reasoningBuf.trim() !== '';
            if (hasAnyReplyText) {
                console.log(`Successful Response after ${attempt} attempts.`);
                const finalThinkMatch = fullReply.match(thinkRegex);
                const finalVariant = aiMessageObject.variations[0];
                const streamMainSnapshot = typeof finalVariant.main === 'string' ? finalVariant.main.trim() : '';
                let finalMainText = streamMainSnapshot
                    ? sanitizeModelOutput(streamMainSnapshot)
                    : sanitizeModelOutput(fullReply.replace(thinkRegex, '').trim());
                finalVariant.main = finalMainText;
                let finalThink = aiMessageObject.variations[0].think
                    ? sanitizeModelOutput(aiMessageObject.variations[0].think)
                    : null;

                if (reasoningBuf.trim()) {
                    finalThink = sanitizeModelOutput(reasoningBuf.trim());
                } else if (finalThinkMatch) {
                    finalThink = sanitizeModelOutput(finalThinkMatch[1].trim());
                }

                if (!finalThink) {
  const hasOpen = /<think>/i.test(fullReply);
  const cIdx = fullReply.toLowerCase().indexOf("</think>");
  if (!hasOpen && cIdx !== -1) {
    finalThink = sanitizeModelOutput(fullReply.slice(0, cIdx).trim());
    const tail = fullReply.slice(cIdx + "</think>".length).trimStart();
    finalMainText = sanitizeModelOutput(tail);
  }
}
                let thinkBlockContentFinal = thinkBlockElement ? thinkBlockElement.querySelector('.think-block-content') : null;
                if (finalThink && !thinkBlockElement) {
  const refs = ensureThinkBlockElements(messageWrapper);
  thinkBlockElement = refs.thinkBlock;
  thinkBlockContentFinal = refs.thinkContent;
}
                if (!finalThink && thinkBlockContentFinal) {
  const domThinkText = thinkBlockContentFinal.textContent || '';
  const cleanedDomThink = sanitizeModelOutput(domThinkText.replace(/<\s*\/?\s*think\s*>/gi, '').trim());
  if (cleanedDomThink) {
    finalThink = cleanedDomThink;
  }
}
                if ((!finalMainText || finalMainText.trim() === '') && reasoningBuf.trim()) {
                    finalMainText = sanitizeModelOutput(extractMainFromReasoning(reasoningBuf));
                }

                if (!thinkEnabled) { finalThink = null; }
                finalVariant.main = finalMainText;
                finalVariant.think = finalThink;
                mainTypewriter.flush(finalMainText || '', t => { if (mainContentElement) mainContentElement.innerHTML = formatSubString(t); });

                if (thinkBlockElement) {
                    if (finalThink) {
                        thinkBlockElement.classList.remove('hidden');
                        if (thinkBlockContentFinal) {
                            thinkTypewriter.flush(finalThink, t => { thinkBlockContentFinal.innerHTML = `&lt;think&gt;<br>${formatSubString(t)}<br>&lt;/think&gt;`; });
                        }
                        thinkBlockElement.open = false;
                    } else {
                        thinkBlockElement.classList.add('hidden');
                        thinkBlockElement.open = false;
                    }
                }

                await saveSingleCharacterToDB(mainCharacter);
                playNotificationSound();
                updateTokenCount();
                if (!streamAbortedByUser && ttsEnabled && finalMainText) {
                    speakText(finalMainText, newMessageId);
                }
                break;
            } else {
                console.log(`Attempt ${attempt} resulted in an empty response. Retry...`);
                if (attempt < MAX_RETRIES) await new Promise(resolve => setTimeout(resolve, 1000));
            }
        } catch (error) {
    clearStreamTimers();
    if (error.name === 'AbortError') {
        console.log('Fetch aborted (Submit).');
        streamAbortedByUser = true;
        break;
    }
    console.error(`Error on attempt ${attempt}:`, error.message);
    const isTemporaryError = (error.message && error.message.includes('maximum capacity')) || (error.message && error.message.includes('Failed to fetch'));
    if (isTemporaryError && attempt < MAX_RETRIES) {
        console.log('Request failed or rate-limited. Retrying...');
        await new Promise(resolve => setTimeout(resolve, 1000));
    } else {
        let errorMsg = `An unexpected error occurred. Please try regenerating the response or start a new chat. If the problem persists, please check the FAQ.`;
        if (error.message.includes('Failed to fetch')) {
            errorMsg = "Could not connect to the AI provider. Please check your API key and internet connection, then try again.";
        }
        aiMessageObject.variations[0].main = errorMsg;
        const freshSendEl = document.querySelector(`[data-message-id="${newMessageId}"] .main-content`);
        if(freshSendEl) freshSendEl.innerHTML = errorMsg;
        else if(mainContentEl) mainContentEl.innerHTML = errorMsg;
        await saveSingleCharacterToDB(mainCharacter);
        break;
    }
}
    }
    clearStreamTimers();
    aiMessageObject.isStreaming = false;
    aiMessageObject.streamingVariant = null;
    setBubbleLoading(mainContentEl, false);

    const variant0 = aiMessageObject?.variations ? aiMessageObject.variations[0] : null;
    const variantMain = variant0 && typeof variant0.main === 'string' ? variant0.main.trim() : '';
    const variantThink = variant0 && typeof variant0.think === 'string' ? variant0.think.trim() : '';
    const hasMeaningfulVariant = (variantMain && variantMain !== '...') || variantThink;
    const hasAnyReplyContent = hasMeaningfulVariant || fullReply.trim() !== '';

    if (streamAbortedByUser && !hasAnyReplyContent) {
        // Aborted before any content arrived — remove the empty bubble entirely
        chat.history = chat.history.filter(m => m.id !== newMessageId);
        if (messageWrapper && messageWrapper.parentNode) messageWrapper.remove();
        await saveSingleCharacterToDB(mainCharacter);
    } else if (!hasAnyReplyContent) {
        const errorMsg = `AI Model did not respond to the request. Please try the following steps:

• Re-enter your default API key (or model-specific API key) in the app settings by copy & paste to ensure that it's correct.
• Check the request limits per minute/per day of the provider you're using, especially in free plans. Connection fails when limits are exceeded.
• Try sending a message again later in case the model is overloaded. Also, use other AI models to see if the AI model itself was the problem.
• In some cases your API provider might have a temporary problem. Try another provider/API key to see if your priveder was the problem.
• Check the FAQ section (help button on main screen) for further details to this error.`;
        aiMessageObject.variations[0].main = errorMsg;
        if (mainContentEl) mainContentEl.innerHTML = errorMsg;
        await saveSingleCharacterToDB(mainCharacter);
    }
    if (!streamAbortedByUser || hasAnyReplyContent) {
        const finalMessageEl = document.querySelector(`[data-message-id="${newMessageId}"]`);
        if (finalMessageEl) {
            const regenBtn = finalMessageEl.querySelector('.regenerate-btn');
            if (regenBtn) { regenBtn.disabled = false; regenBtn.classList.remove('is-loading'); }
            const continueBtn = finalMessageEl.querySelector('.continue-btn');
            if (continueBtn) { continueBtn.disabled = false; continueBtn.classList.remove('is-loading'); }
            const finalControls = finalMessageEl.querySelector('.message-controls');
            if (finalControls) { finalControls.classList.remove('is-streaming'); finalControls.closest('.message')?.classList.remove('msg-streaming'); }
        }
    }
    loadingIndicator.classList.add('hidden');
    dialogBtn.disabled = false;
    storyBtn.disabled = false;
    stopStreamBtn.classList.add('hidden');
    currentStreamController = null;
    if (!streamAbortedByUser) generateReplyOptionsInBackground();
}



async function handleRegenerate(messageId) {
    const chat = characters[currentCharacterId]?.chats?.[currentChatId];
    if (!chat) return;
    const messageIndex = chat.history.findIndex(m => m.id === messageId);
    if (messageIndex === -1) return;

let mainContentEl = null;
let thinkBlockEl = null;
let thinkContentEl = null;
let thinkOpened = false;
let isFirstChunk = true;
let sseBuffer = '';
const messageElement = document.querySelector(`[data-message-id="${messageId}"]`);
if (messageElement) {
    mainContentEl = messageElement.querySelector('.main-content');
    thinkBlockEl = messageElement.querySelector('.think-block');
    thinkContentEl = thinkBlockEl ? thinkBlockEl.querySelector('.think-block-content') : null;
    const regenBtn = messageElement.querySelector('.regenerate-btn');
    if (regenBtn) { regenBtn.disabled = true; regenBtn.classList.add('is-loading'); }
    const continueBtn = messageElement.querySelector('.continue-btn');
    if (continueBtn) continueBtn.disabled = true;
    const regenControls = messageElement.querySelector('.message-controls');
    if (regenControls) { regenControls.classList.add('is-streaming'); regenControls.closest('.message')?.classList.add('msg-streaming'); }
}

    loadingIndicator.classList.remove('hidden');
    stopStreamBtn.classList.remove('hidden');
    dialogBtn.disabled = true;
    storyBtn.disabled = true;
    const message = chat.history[messageIndex];
    const messageType = message.type || 'dialog';
    const speakerId = message.speakerId || currentCharacterId;
    const speakerCharacter = characters[speakerId];
    const charNameForAI = speakerCharacter.chatName || speakerCharacter.name;

    if(messageElement) {
        const regenBtn = messageElement.querySelector('.regenerate-btn');
    const continueBtn = messageElement.querySelector('.continue-btn');
    const prevBtn = messageElement.querySelector('.prev-variant-btn');
    const nextBtn = messageElement.querySelector('.next-variant-btn');
    const counter = messageElement.querySelector('.variant-counter');
    if (regenBtn) {
        regenBtn.disabled = true;
        regenBtn.classList.add('is-loading');
    }
    if (continueBtn) {
        continueBtn.disabled = true;
    }
    if (prevBtn) prevBtn.style.display = 'none';
    if (nextBtn) nextBtn.style.display = 'none';
    if (counter) counter.style.display = 'none';
    }
    
    message.variations.push({ main: '...', think: null });
    message.activeVariant = message.variations.length - 1;
    message.isStreaming = true;
    message.streamingVariant = message.activeVariant;
    updateSingleMessageView(messageId);
    if (thinkBlockEl) thinkBlockEl.open = false;
    const promptHistory = chat.history.slice(0, messageIndex);
    const lastUserMessageInHistory = promptHistory.slice().reverse().find(m => m.sender === 'user');
    const userMessageForAPI = lastUserMessageInHistory ? lastUserMessageInHistory.main : '';
    const historyForAPIcall = lastUserMessageInHistory ? promptHistory.slice(0, promptHistory.lastIndexOf(lastUserMessageInHistory)) : promptHistory;
    const activePersonaId = chat.activePersonaId;
    const persona = activePersonaId ? personas[activePersonaId] : null;
    const currentModelId = modelSelect.value || defaultSettings.model;
    const modelSettings = appSettings.availableModels.find(m => m.id === currentModelId);
    const isMultiChar = chat.participants && chat.participants.length > 1;
    const mappedHistoryForAPI = historyForAPIcall.map(msg => {
    const activePersona = chat.activePersonaId ? personas[chat.activePersonaId] : null;
    if (msg.sender === 'ai') {
        const speaker = characters[msg.speakerId || currentCharacterId];
        const speakerName = speaker ? (speaker.chatName || speaker.name) : 'Character';
        let processedText = applyCharPlaceholder(msg.variations[msg.activeVariant].main, speakerName);
        processedText = applyUserPlaceholder(processedText, activePersona);
        return { sender: 'ai', main: isMultiChar ? `${speakerName}: ${processedText}` : processedText };
    } else {
        const userName = activePersona?.name || 'User';
        let processedText = applyUserPlaceholder(msg.main, activePersona);
        return { sender: 'user', main: isMultiChar ? `${userName}: ${processedText}` : processedText };
    }
});

    let messageForAPIRegen = userMessageForAPI;
const globalDialogReminder = applyUserPlaceholder(applyCharPlaceholder(
    (modelSettings && modelSettings.reminder) ? modelSettings.reminder.trim() : '',
    charNameForAI
), persona);
const globalNarratorReminder = applyUserPlaceholder(applyCharPlaceholder(
    (modelSettings && modelSettings.narratorReminder) ? modelSettings.narratorReminder.trim() : '',
    charNameForAI
), persona);
let characterDialogReminder = applyUserPlaceholder((speakerCharacter.reminder || ''), persona).replace(/{{char}}/g, charNameForAI).trim();
let characterNarratorReminder = applyUserPlaceholder((speakerCharacter.narratorReminder || ''), persona).replace(/{{char}}/g, charNameForAI).trim();
    const combinedDialogReminder = [globalDialogReminder, characterDialogReminder].filter(Boolean).join('\n');
    const combinedNarratorReminder = [globalNarratorReminder, characterNarratorReminder].filter(Boolean).join('\n');

    const characterForAPI = { ...speakerCharacter };
    let fullSystemPrompt = '';
    const isWorldRegenChat = characters[currentCharacterId]?.type === 'world';
    const worldRegenChar = isWorldRegenChat ? characters[currentCharacterId] : null;

    if (modelSettings && modelSettings.instructions && modelSettings.instructions.trim() !== '') {
  fullSystemPrompt += `--- GLOBAL AI INSTRUCTIONS ---\n${
    applyUserPlaceholder(applyCharPlaceholder(modelSettings.instructions.trim(), charNameForAI), persona)
  }\n\n`;
}

    if (persona) {
        fullSystemPrompt += `--- EXACT USER PERSONA ---\nName: ${persona.name}\nDescription: ${applyUserPlaceholder(applyCharPlaceholder(persona.description, charNameForAI), persona)}\n---\n\n`;
    }

    if (isWorldRegenChat) {
        const worldName = worldRegenChar.name || 'This World';
        if (worldRegenChar.description) fullSystemPrompt += `--- WORLD CONTEXT ---\nWorld: ${worldName}\n${worldRegenChar.description.trim()}\n\n`;
        if (worldRegenChar.lore) fullSystemPrompt += `--- WORLD LORE & HISTORY ---\n${worldRegenChar.lore.trim()}\n\n`;
        if (worldRegenChar.reminder) fullSystemPrompt += `--- WORLD RULES (CRITICAL — THESE RULES MAY NEVER BE BROKEN UNDER ANY CIRCUMSTANCES) ---\n${worldRegenChar.reminder.trim()}\n\n`;
        if (speakerId === currentCharacterId || messageType === 'story') {
            fullSystemPrompt += `[SYSTEM META-INSTRUCTION: Respond only as a third-person omniscient narrator of this world.\nDo not speak directly as any character. Narrate events, scenes, and interactions from a third-person perspective.]\n\n`;
            const worldChars = chat.participants.filter(pid => pid !== currentCharacterId);
            if (worldChars.length > 0) {
                fullSystemPrompt += `--- CHARACTERS IN THIS WORLD ---\n`;
                worldChars.forEach(pid => {
                    const pChar = characters[pid];
                    if (pChar) fullSystemPrompt += `Character: ${pChar.name}\nDescription: ${pChar.description || 'No description available.'}\n---\n`;
                });
                fullSystemPrompt += `\n`;
            }
        } else {
            fullSystemPrompt += `[SYSTEM META-INSTRUCTION: The user is addressing the character '${charNameForAI}' directly.\nRespond only as '${charNameForAI}' and do not respond as any other character.]\n\n`;
            if (characterForAPI.instructions) fullSystemPrompt += `--- CHARACTER AI INSTRUCTIONS ---\n${applyUserPlaceholder(applyCharPlaceholder(characterForAPI.instructions, charNameForAI), persona).trim()}\n\n`;
            if (characterForAPI.description) fullSystemPrompt += `--- CHARACTER DESCRIPTION ---\n${characterForAPI.description.trim()}\n\n`;
            if (characterForAPI.lore) fullSystemPrompt += `--- CHARACTER LORE ---\n${characterForAPI.lore.trim()}\n\n`;
        }
    } else {
        const hasCustomNarratorReminder = speakerCharacter.narratorReminder && speakerCharacter.narratorReminder.trim() !== '';
        if (messageType === 'story' && !hasCustomNarratorReminder) {
            fullSystemPrompt += `[SYSTEM INSTRUCTION: Respond only as a third-person omniscient narrator.\nDo not speak as any main character and narrate the scene objectively.]\n\n`;
        }
        if (characterForAPI.instructions) fullSystemPrompt += `--- CHARACTER AI INSTRUCTIONS ---\n${applyUserPlaceholder(applyCharPlaceholder(characterForAPI.instructions, charNameForAI), persona).trim()}\n\n`;
        if (characterForAPI.description) fullSystemPrompt += `--- CHARACTER DESCRIPTION ---\n${characterForAPI.description.trim()}\n\n`;
        if (characterForAPI.lore) fullSystemPrompt += `--- LORE / BACKGROUND KNOWLEDGE ---\n${characterForAPI.lore.trim()}\n\n`;
    }
    if (chat.mood) {
        fullSystemPrompt += `--- CHARACTER CURRENT MOOD (IMPORTANT) ---\nRight now ${charNameForAI} is feeling ${chat.mood}. Let this mood clearly and noticeably come through in their tone, word choice, body language, and reactions in this reply — make it obvious to the reader, while still staying in character.\n\n`;
    }
    const chatMemoriesText = (chat.memories || '').trim();
    if (chatMemoriesText) {
        fullSystemPrompt += `--- CHAT MEMORIES (HIGH PRIORITY, persist for this chat only; distinct from the initial scenario / first message) ---\n${chatMemoriesText}\n\n`;
    }
    if (replyLength === 'short') fullSystemPrompt += `--- REPLY LENGTH ---\nYour reply must be three or four sentences in length.\n\n`;
    else if (replyLength === 'medium') fullSystemPrompt += `--- REPLY LENGTH ---\nYour reply must be six or seven sentences in length.\n\n`;
    else if (replyLength === 'long') fullSystemPrompt += `--- REPLY LENGTH ---\nYour reply must be nine or ten sentences in length.\n\n`;
    else if (replyLength === 'verylong') fullSystemPrompt += `--- REPLY LENGTH ---\nYour reply must be twelve or thirteen sentences in length.\n\n`;
    characterForAPI.description = fullSystemPrompt;
    const MAX_RETRIES = 90;
    currentStreamController = new AbortController();
    let fullReply = '';
    let newVariant = null;
    let streamAbortedByUser = false;

const coldStartTimer = setTimeout(() => {
    const messageToUpdate = chat.history.find(m => m.id === messageId);
    if (messageToUpdate && messageToUpdate.variations[message.activeVariant].main === '...') {
        messageToUpdate.variations[message.activeVariant].main = "Connecting to AI Model - Please wait or regenerate the message.";
        updateSingleMessageView(messageId);
    }
}, 20000);

const serverHungTimer = setTimeout(() => {
    const messageToUpdate = chat.history.find(m => m.id === messageId);
    if (messageToUpdate && messageToUpdate.variations[message.activeVariant].main.includes("Connecting to AI Model")) {
        messageToUpdate.variations[message.activeVariant].main = "The AI provider may be experiencing issues - Please wait a moment or try again later.";
        updateSingleMessageView(messageId);
    }
}, 70000);

const clearStreamTimers = () => {
    clearTimeout(coldStartTimer);
    clearTimeout(serverHungTimer);
};

const startTime = Date.now();
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        if (!currentStreamController) { streamAbortedByUser = true; break; }
        try {
            console.log(`Regenerate request (Attempt ${attempt}/${MAX_RETRIES})...`);

            const currentModel = modelSelect.value;
            const currentTemperature = temperatureSlider.value;
            const apiKeyToSend = (modelSettings && modelSettings.apiKey) || appSettings.apiKey;
const targetApiUrlToSend = (modelSettings && modelSettings.targetApiUrl) || DEFAULT_API_URL;
const isLocal = targetApiUrlToSend && (
    targetApiUrlToSend.includes('localhost') ||
    targetApiUrlToSend.includes('127.0.0.1') ||
    targetApiUrlToSend.includes('::1') ||
    /^https?:\/\/192\.168\./.test(targetApiUrlToSend) ||
    /^https?:\/\/10\./.test(targetApiUrlToSend) ||
    /^https?:\/\/172\.(1[6-9]|2[0-9]|3[01])\./.test(targetApiUrlToSend)
);

const reminderContent = messageType === 'dialog' ? combinedDialogReminder : combinedNarratorReminder;
const moodDirective = chat.mood ? `\n[MOOD — TOP PRIORITY: right now ${charNameForAI} is feeling ${chat.mood}. This emotion MUST be clearly and unmistakably visible in their tone, word choice, body language and reactions in THIS reply, even if it contrasts with their usual demeanor. Do not write them as calm or neutral — stay in character but let the ${chat.mood} show strongly.]` : '';
const lastUserContent = (reminderContent
    ? `${messageForAPIRegen}\n[${reminderContent}]`
    : messageForAPIRegen) + moodDirective;
const messages = [
    { role: 'system', content: characterForAPI.description },
    ...mappedHistoryForAPI.map(h => ({ role: h.sender === 'ai' ? 'assistant' : 'user', content: h.main })),
    { role: 'user', content: lastUserContent },
];
const fetchUrl = targetApiUrlToSend;
const fetchBody = JSON.stringify({
    model: currentModelId,
    messages,
    temperature: parseFloat(currentTemperature),
    top_p: 0.95,
    stream: true,
    character_id: currentCharacterId,
    chat_id: currentChatId,
    options: {
        num_ctx: modelSettings?.numCtx || 131072,
        top_p: 0.95
    }
});
const response = await fetch(fetchUrl, {
    method: 'POST',
    headers: isLocal
        ? { 'Content-Type': 'application/json' }
        : { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKeyToSend}` },
    signal: currentStreamController.signal,
    body: fetchBody
});
            clearStreamTimers();
            if (response.status === 429) {
                const elapsedTime = Date.now() - startTime;
if (elapsedTime > 20000) {
    const messageToUpdate = chat.history.find(m => m.id === messageId);
    if (messageToUpdate) {
        messageToUpdate.variations[message.activeVariant].main = `The selected AI Model experiences heavy traffic or is rate-limited (requests per minute). Please wait...`;
        updateSingleMessageView(messageId);
    }
}
await new Promise(resolve => setTimeout(resolve, 1000));
if (attempt === MAX_RETRIES) throw new Error("AI Model did not respond after multiple retries. Please try again later or choose another Model.");
continue;
            }
            if (!response.ok) throw new Error(await response.text());
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let mainContentEl = messageElement?.querySelector('.main-content');
            let thinkBlockEl = messageElement?.querySelector('.think-block');
            let thinkBlockContentEl = thinkBlockEl ? thinkBlockEl.querySelector('.think-block-content') : null;
            let isFirstChunk = true
            let sseBuffer = '';
            fullReply = '';
            let reasoningBuf = '';
            let thinkOpened = false;
            const mainTypewriter = createTypewriter();
            const thinkTypewriter = createTypewriter();
            while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    sseBuffer += decoder.decode(value, { stream: true });
    const lines = sseBuffer.split('\n');
    sseBuffer = lines.pop() || '';
    const currentMessageElement = document.querySelector(`[data-message-id="${messageId}"]`);
    mainContentEl = currentMessageElement ? currentMessageElement.querySelector('.main-content') : null;
    thinkBlockEl = currentMessageElement ? currentMessageElement.querySelector('.think-block') : null;
    thinkContentEl = thinkBlockEl ? thinkBlockEl.querySelector('.think-block-content') : null;
    const ensureThinkBlockPresent = () => {
        if (!currentMessageElement) return false;
        if (!thinkBlockEl || !thinkContentEl) {
            const refs = ensureThinkBlockElements(currentMessageElement);
            thinkBlockEl = refs.thinkBlock;
            thinkContentEl = refs.thinkContent;
        }
        return !!(thinkBlockEl && thinkContentEl);
    };
    for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line.startsWith('data:')) continue;
        const dataContent = line.slice(5).trim();
        if (dataContent === '[DONE]') { sseBuffer = ''; break; }
        if (isFirstChunk) {
    const messageToUpdate = chat.history.find(m => m.id === messageId);
    if (messageToUpdate) {
        messageToUpdate.variations[message.activeVariant].main = '';
        messageToUpdate.isStreaming = false;
        messageToUpdate.streamingVariant = null;
    }
    if (mainContentEl) {
        setBubbleLoading(mainContentEl, false);
        mainContentEl.innerHTML = '';
    }
    isFirstChunk = false;
}
        try {
            const parsed = JSON.parse(dataContent);
            const delta = parsed.choices && parsed.choices[0] && parsed.choices[0].delta;
            if (delta?.content) {
                fullReply += delta.content;

                const openIdx = fullReply.search(/<think>/i);
                const closeIdx = fullReply.toLowerCase().indexOf("</think>");

                let mainOnly;
                let streamThinkText = null;
                let streamThinkComplete = false;

                if (openIdx === -1 && closeIdx !== -1) {
                    mainOnly = fullReply.slice(closeIdx + "</think>".length).trimStart();
                    streamThinkText = fullReply.slice(0, closeIdx).trim();
                    streamThinkComplete = true;
                } else if (openIdx !== -1 && closeIdx !== -1 && closeIdx > openIdx) {
                    mainOnly = (fullReply.slice(0, openIdx) + fullReply.slice(closeIdx + "</think>".length)).trim();
                    streamThinkText = fullReply.slice(openIdx + "<think>".length, closeIdx).trim();
                    streamThinkComplete = true;
                } else if (openIdx !== -1) {
                    mainOnly = fullReply.slice(0, openIdx).trim();
                    streamThinkText = fullReply.slice(openIdx + "<think>".length).trim();
                    streamThinkComplete = false;
                } else {
                    mainOnly = fullReply.trim();
                }

                const sanitizedMainOnly = sanitizeModelOutput(mainOnly);
                mainTypewriter.update(sanitizedMainOnly, t => { if (mainContentEl) { mainContentEl.innerHTML = formatSubString(t); if (chatWindow._autoScroll !== false) chatWindow.scrollTop = chatWindow.scrollHeight; } });
                message.variations[message.activeVariant].main = sanitizedMainOnly;
                newVariant = { main: sanitizedMainOnly, think: null };

                if (thinkEnabled && streamThinkText !== null && reasoningBuf === '' && ensureThinkBlockPresent()) {
                    thinkBlockEl.classList.remove('hidden');
                    if (!thinkOpened) { thinkBlockEl.open = true; thinkOpened = true; }
                    const sanitizedThink = sanitizeModelOutput(streamThinkText);
                    thinkTypewriter.update(sanitizedThink, t => { if (thinkContentEl) { thinkContentEl.innerHTML = `&lt;think&gt;<br>${formatSubString(t)}<br>&lt;/think&gt;`; if (chatWindow._autoScroll !== false) chatWindow.scrollTop = chatWindow.scrollHeight; } });
                    if (streamThinkComplete) {
                        message.variations[message.activeVariant].think = sanitizedThink;
                        newVariant.think = sanitizedThink;
                    }
                }
            }
            if (delta?.reasoning) {
                reasoningBuf += delta.reasoning;
                if (thinkEnabled && ensureThinkBlockPresent()) {
                    thinkBlockEl.classList.remove('hidden');
                    if (!thinkOpened) { thinkBlockEl.open = true; thinkOpened = true; }
                    const sanitizedReasoning = sanitizeModelOutput(reasoningBuf.trim());
                    thinkTypewriter.update(sanitizedReasoning, t => { if (thinkContentEl) { thinkContentEl.innerHTML = `&lt;think&gt;<br>${formatSubString(t)}<br>&lt;/think&gt;`; if (chatWindow._autoScroll !== false) chatWindow.scrollTop = chatWindow.scrollHeight; } });
                    message.variations[message.activeVariant].think = sanitizedReasoning;
                    newVariant.think = sanitizedReasoning;
                }
            }
        } catch {
            continue;
        }
    }
}
            const hasAnyReplyText = fullReply.trim() !== '' || reasoningBuf.trim() !== '';
            if (hasAnyReplyText) {
                console.log(`Successful response after ${attempt} attempts.`);
                const finalThinkMatch = fullReply.match(/<think>([\s\S]*?)<\/think>/i);
                const finalVariant = message.variations[message.activeVariant];
                let thinkBlockEl = messageElement?.querySelector('.think-block');
                let thinkBlockContentFinal = thinkBlockEl ? thinkBlockEl.querySelector('.think-block-content') : null;
                const streamMainSnapshot = typeof finalVariant.main === 'string' ? finalVariant.main.trim() : '';
                let finalMainText = streamMainSnapshot
                    ? sanitizeModelOutput(streamMainSnapshot)
                    : sanitizeModelOutput(fullReply.replace(/<think>([\s\S]*?)<\/think>/i, '').trim());

                let finalThink = finalVariant.think ? sanitizeModelOutput(finalVariant.think) : null;
                if (reasoningBuf.trim()) {
                    finalThink = sanitizeModelOutput(reasoningBuf.trim());
                } else if (finalThinkMatch) {
                    finalThink = sanitizeModelOutput(finalThinkMatch[1].trim());
                }

                if (!finalThink) {
                    const hasOpen = /<think>/i.test(fullReply);
                    const cIdx = fullReply.toLowerCase().indexOf("</think>");
                    if (!hasOpen && cIdx !== -1) {
                        finalThink = sanitizeModelOutput(fullReply.slice(0, cIdx).trim());
                        const mainTail = fullReply.slice(cIdx + "</think>".length).trimStart();
                        finalMainText = sanitizeModelOutput(mainTail);
                    }
                }

                if (finalThink && !thinkBlockEl) {
                    const refs = ensureThinkBlockElements(messageElement);
                    thinkBlockEl = refs.thinkBlock;
                    thinkBlockContentFinal = refs.thinkContent;
                }

                if (!finalThink && thinkBlockContentFinal) {
                    const domThinkText = thinkBlockContentFinal.textContent || '';
                    const cleanedDomThink = sanitizeModelOutput(domThinkText.replace(/<\s*\/?\s*think\s*>/gi, '').trim());
                    if (cleanedDomThink) {
                        finalThink = cleanedDomThink;
                    }
                }
                if ((!finalMainText || finalMainText.trim() === '') && reasoningBuf.trim()) {
                    finalMainText = sanitizeModelOutput(extractMainFromReasoning(reasoningBuf));
                }

                if (!thinkEnabled) { finalThink = null; }
                finalVariant.main = finalMainText;
                finalVariant.think = finalThink;
                newVariant = { main: finalMainText, think: finalThink };

                if (thinkBlockEl) {
                    if (finalThink) {
                        thinkBlockEl.classList.remove('hidden');
                        if (thinkBlockContentFinal) {
                            thinkTypewriter.flush(finalThink, t => { thinkBlockContentFinal.innerHTML = `&lt;think&gt;<br>${formatSubString(t)}<br>&lt;/think&gt;`; });
                        }
                        thinkBlockEl.open = false;
                    } else {
                        thinkBlockEl.classList.add('hidden');
                        thinkBlockEl.open = false;
                    }
                }
                break;
            } else {
                console.log(`Attempt ${attempt} resulted in an empty response. Retry...`);
                if (attempt < MAX_RETRIES) await new Promise(resolve => setTimeout(resolve, 1000));
            }
} catch (error) {
    clearStreamTimers();
    if (error.name === 'AbortError') {
        console.log('Fetch aborted (Regen).');
        streamAbortedByUser = true;
        break;
    }
    console.error(`Error during regeneration (Attempt ${attempt}):`, error.message);
    const isTemporaryError = (error.message && error.message.includes('maximum capacity')) || (error.message && error.message.includes('Failed to fetch'));
    if (isTemporaryError && attempt < MAX_RETRIES) {
        console.log('Request failed or rate-limited. Retrying...');
        await new Promise(resolve => setTimeout(resolve, 1000));
    } else {
        let errorMsg = `AI Model did not respond to the request. Please try the following steps:

• Re-enter your default API key (or model-specific API key) in the app settings by copy & paste to ensure that it's correct.
• Check the request limits per minute/per day of the provider you're using, especially in free plans. Connection fails when limits are exceeded.
• Try sending a message again later in case the model is overloaded. Also, use other AI models to see if the AI model itself was the problem.
• In some cases your API provider might have a temporary problem. Try another provider/API key to see if your priveder was the problem.
• Check the FAQ section (help button on main screen) for further details to this error.`;
        if (error.message.includes('Failed to fetch')) {
            errorMsg = "Could not connect to the AI provider. Please check your API key and internet connection, then try again.";
        }
        if(mainContentEl) mainContentEl.innerHTML = errorMsg;
        message.variations[message.variations.length - 1] = { main: errorMsg, think: null };
        await saveSingleCharacterToDB(characters[currentCharacterId]);
        break;
    }
}
    }
    clearStreamTimers();
    message.isStreaming = false;
    message.streamingVariant = null;
    setBubbleLoading(mainContentEl, false);
    if (streamAbortedByUser && !newVariant) {
        // Aborted before any content arrived — revert the empty new variant
        if (message.variations.length > 1) {
            message.variations.pop();
            message.activeVariant = message.variations.length - 1;
        }
    } else if (newVariant) {
        message.variations[message.variations.length - 1] = newVariant;
        message.activeVariant = message.variations.length - 1;
        if (!streamAbortedByUser) {
            playNotificationSound();
            updateTokenCount();
        }
    }
    const finalMessageElement = document.querySelector(`[data-message-id="${messageId || newMessageId}"]`);
    if (finalMessageElement) {
        const regenBtn = finalMessageElement.querySelector('.regenerate-btn');
        const continueBtn = finalMessageElement.querySelector('.continue-btn');
        if (regenBtn) {
            regenBtn.disabled = false;
            regenBtn.classList.remove('is-loading');
        }
        if (continueBtn) {
            continueBtn.disabled = false;
            continueBtn.classList.remove('is-loading');
        }

        const controlsContainer = finalMessageElement.querySelector('.message-controls');
        if (controlsContainer) { controlsContainer.classList.remove('is-streaming'); controlsContainer.closest('.message')?.classList.remove('msg-streaming'); }
        let prevBtn = finalMessageElement.querySelector('.prev-variant-btn');
        let counter = finalMessageElement.querySelector('.variant-counter');
        let nextBtn = finalMessageElement.querySelector('.next-variant-btn');

        if (message.variations.length > 1) {
            if (!prevBtn && !counter && !nextBtn && controlsContainer && regenBtn) {
                prevBtn = document.createElement('button');
                prevBtn.className = 'prev-variant-btn';
                prevBtn.innerHTML = '‹';

                counter = document.createElement('span');
                counter.className = 'variant-counter';

                nextBtn = document.createElement('button');
                nextBtn.className = 'next-variant-btn';
                nextBtn.innerHTML = '›';

                controlsContainer.insertBefore(prevBtn, regenBtn);
                controlsContainer.insertBefore(counter, regenBtn);
                controlsContainer.insertBefore(nextBtn, regenBtn);
            } else {
                if (prevBtn) prevBtn.style.display = '';
                if (nextBtn) nextBtn.style.display = '';
                if (counter) counter.style.display = '';
            }
        } else {
            if (prevBtn) prevBtn.style.display = 'none';
            if (nextBtn) nextBtn.style.display = 'none';
            if (counter) counter.style.display = 'none';
        }
    }
    loadingIndicator.classList.add('hidden');
    stopStreamBtn.classList.add('hidden');
    dialogBtn.disabled = false;
    storyBtn.disabled = false;
    currentStreamController = null;
    generateReplyOptionsInBackground();
    await saveSingleCharacterToDB(characters[currentCharacterId]);
    updateSingleMessageView(messageId);
}



async function handleContinue(messageId) {
    const chat = characters[currentCharacterId]?.chats?.[currentChatId];
    if (!chat) return;
    const messageIndex = chat.history.findIndex(m => m.id === messageId);
    if (messageIndex === -1) return;

let mainContentEl = null;
let thinkBlockEl = null;
let thinkContentEl = null;
let thinkOpened = false;
let isFirstChunk = true;
let sseBuffer = '';
const messageElement = document.querySelector(`[data-message-id="${messageId}"]`);
if (messageElement) {
    mainContentEl = messageElement.querySelector('.main-content');
    thinkBlockEl = messageElement.querySelector('.think-block');
    thinkContentEl = thinkBlockEl ? thinkBlockEl.querySelector('.think-block-content') : null;
    const regenBtn = messageElement.querySelector('.regenerate-btn');
    if (regenBtn) regenBtn.disabled = true;
    const continueBtn = messageElement.querySelector('.continue-btn');
    if (continueBtn) {
        continueBtn.disabled = true;
        continueBtn.classList.add('is-loading');
    }
    const contControls = messageElement.querySelector('.message-controls');
    if (contControls) { contControls.classList.add('is-streaming'); contControls.closest('.message')?.classList.add('msg-streaming'); }
}

    loadingIndicator.classList.remove('hidden');
    stopStreamBtn.classList.remove('hidden');
    dialogBtn.disabled = true;
    storyBtn.disabled = true;
    const message = chat.history[messageIndex];
    message.isStreaming = true;
    message.streamingVariant = message.activeVariant;
    if (mainContentEl) {
        setBubbleLoading(mainContentEl, true, { preserveText: true });
    }
    const activeVariant = message.variations[message.activeVariant];
    const originalText = activeVariant.main;

    const speakerId = message.speakerId || currentCharacterId;
    const speakerCharacter = characters[speakerId];
    const charNameForAI = speakerCharacter.chatName || speakerCharacter.name;
    const messageType = message.type || 'dialog';
    if(messageElement) {
        const regenBtn = messageElement.querySelector('.regenerate-btn');
    const continueBtn = messageElement.querySelector('.continue-btn');
    const prevBtn = messageElement.querySelector('.prev-variant-btn');
    const nextBtn = messageElement.querySelector('.next-variant-btn');
    const counter = messageElement.querySelector('.variant-counter');

    if (regenBtn) {
        regenBtn.disabled = true;
    }
    if (continueBtn) {
        continueBtn.disabled = true;
        continueBtn.classList.add('is-loading');
    }
    if (prevBtn) prevBtn.style.display = 'none';
    if (nextBtn) nextBtn.style.display = 'none';
    if (counter) counter.style.display = 'none';
    }

    const historyCopy = chat.history.slice(0, messageIndex + 1);
    const lastMessage = historyCopy.pop(); 
    let messageForAPI = lastMessage.variations[lastMessage.activeVariant].main; 
    messageForAPI += "\n\n(Please drive the current point of the scene actively forward to the next point of the scene. Keep it concise and write only one short paragraph maximum. In case a sentence or dialog was cut off, complete it seamlessly (without three dots '...') and then move on with fresh sentences. Do not repeat any of the previous sentences.)";
    const activePersonaId = chat.activePersonaId;
    const persona = activePersonaId ? personas[activePersonaId] : null;
    const currentModelId = modelSelect.value || defaultSettings.model;
    const modelSettings = appSettings.availableModels.find(m => m.id === currentModelId);

    const globalDialogReminder = applyUserPlaceholder(applyCharPlaceholder(
    (modelSettings && modelSettings.reminder) ? modelSettings.reminder.trim() : '',
    charNameForAI
), persona);
const globalNarratorReminder = applyUserPlaceholder(applyCharPlaceholder(
    (modelSettings && modelSettings.narratorReminder) ? modelSettings.narratorReminder.trim() : '',
    charNameForAI
), persona);
let characterDialogReminder = applyUserPlaceholder((speakerCharacter.reminder || ''), persona).replace(/{{char}}/g, charNameForAI).trim();
let characterNarratorReminder = applyUserPlaceholder((speakerCharacter.narratorReminder || ''), persona).replace(/{{char}}/g, charNameForAI).trim();
    const combinedDialogReminder = [globalDialogReminder, characterDialogReminder].filter(Boolean).join('\n');
    const combinedNarratorReminder = [globalNarratorReminder, characterNarratorReminder].filter(Boolean).join('\n');

    const isMultiChar = chat.participants && chat.participants.length > 1;
    const historyForAPIcall = historyCopy.map(msg => {
    const activePersona = chat.activePersonaId ? personas[chat.activePersonaId] : null;
    if (msg.sender === 'ai') {
        const speaker = characters[msg.speakerId || currentCharacterId];
        const speakerName = speaker ? (speaker.chatName || speaker.name) : 'Character';
        let processedText = applyCharPlaceholder(msg.variations[msg.activeVariant].main, speakerName);
        processedText = applyUserPlaceholder(processedText, activePersona);
        return { sender: 'ai', main: isMultiChar ? `${speakerName}: ${processedText}` : processedText };
    } else {
        const userName = activePersona?.name || 'User';
        let processedText = applyUserPlaceholder(msg.main, activePersona);
        return { sender: 'user', main: isMultiChar ? `${userName}: ${processedText}` : processedText };
    }
});

    const characterForAPI = { ...speakerCharacter };
    let fullSystemPrompt = '';
    const isWorldContChat = characters[currentCharacterId]?.type === 'world';
    const worldContChar = isWorldContChat ? characters[currentCharacterId] : null;

    if (modelSettings && modelSettings.instructions && modelSettings.instructions.trim() !== '') {
        fullSystemPrompt += `--- GLOBAL AI INSTRUCTIONS ---\n${applyUserPlaceholder(applyCharPlaceholder(modelSettings.instructions.trim(), charNameForAI), persona)}\n\n`;
    }
    if (persona) {
        fullSystemPrompt += `--- EXACT USER PERSONA ---\nName: ${persona.name}\nDescription: ${applyUserPlaceholder(applyCharPlaceholder(persona.description, charNameForAI), persona)}\n---\n\n`;
    }
    if (isWorldContChat) {
        const worldName = worldContChar.name || 'This World';
        if (worldContChar.description) fullSystemPrompt += `--- WORLD CONTEXT ---\nWorld: ${worldName}\n${worldContChar.description.trim()}\n\n`;
        if (worldContChar.lore) fullSystemPrompt += `--- WORLD LORE & HISTORY ---\n${worldContChar.lore.trim()}\n\n`;
        if (worldContChar.reminder) fullSystemPrompt += `--- WORLD RULES (CRITICAL — THESE RULES MAY NEVER BE BROKEN UNDER ANY CIRCUMSTANCES) ---\n${worldContChar.reminder.trim()}\n\n`;
        if (speakerId === currentCharacterId || messageType === 'story') {
            fullSystemPrompt += `[SYSTEM META-INSTRUCTION: Respond only as a third-person omniscient narrator of this world.\nDo not speak directly as any character. Narrate events, scenes, and interactions from a third-person perspective.]\n\n`;
            const worldChars = chat.participants.filter(pid => pid !== currentCharacterId);
            if (worldChars.length > 0) {
                fullSystemPrompt += `--- CHARACTERS IN THIS WORLD ---\n`;
                worldChars.forEach(pid => {
                    const pChar = characters[pid];
                    if (pChar) fullSystemPrompt += `Character: ${pChar.name}\nDescription: ${pChar.description || 'No description available.'}\n---\n`;
                });
                fullSystemPrompt += `\n`;
            }
        } else {
            fullSystemPrompt += `[SYSTEM META-INSTRUCTION: The user is addressing the character '${charNameForAI}' directly.\nRespond only as '${charNameForAI}' and do not respond as any other character.]\n\n`;
            if (characterForAPI.instructions) fullSystemPrompt += `--- CHARACTER AI INSTRUCTIONS ---\n${applyUserPlaceholder(applyCharPlaceholder(characterForAPI.instructions, charNameForAI), persona).trim()}\n\n`;
            if (characterForAPI.description) fullSystemPrompt += `--- CHARACTER DESCRIPTION ---\n${characterForAPI.description.trim()}\n\n`;
            if (characterForAPI.lore) fullSystemPrompt += `--- CHARACTER LORE ---\n${characterForAPI.lore.trim()}\n\n`;
        }
    } else {
        if (characterForAPI.instructions) fullSystemPrompt += `--- CHARACTER AI INSTRUCTIONS ---\n${applyUserPlaceholder(applyCharPlaceholder(characterForAPI.instructions, charNameForAI), persona).trim()}\n\n`;
        if (characterForAPI.description) fullSystemPrompt += `--- CHARACTER DESCRIPTION ---\n${characterForAPI.description.trim()}\n\n`;
        if (characterForAPI.lore) fullSystemPrompt += `--- LORE / BACKGROUND KNOWLEDGE ---\n${characterForAPI.lore.trim()}\n\n`;
    }
    if (chat.mood) {
        fullSystemPrompt += `--- CHARACTER CURRENT MOOD (IMPORTANT) ---\nRight now ${charNameForAI} is feeling ${chat.mood}. Let this mood clearly and noticeably come through in their tone, word choice, body language, and reactions in this reply — make it obvious to the reader, while still staying in character.\n\n`;
    }
    const chatMemoriesText = (chat.memories || '').trim();
    if (chatMemoriesText) {
        fullSystemPrompt += `--- CHAT MEMORIES (HIGH PRIORITY, persist for this chat only; distinct from the initial scenario / first message) ---\n${chatMemoriesText}\n\n`;
    }
    if (replyLength === 'short') fullSystemPrompt += `--- REPLY LENGTH ---\nYour reply must be three or four sentences in length.\n\n`;
    else if (replyLength === 'medium') fullSystemPrompt += `--- REPLY LENGTH ---\nYour reply must be six or seven sentences in length.\n\n`;
    else if (replyLength === 'long') fullSystemPrompt += `--- REPLY LENGTH ---\nYour reply must be nine or ten sentences in length.\n\n`;
    else if (replyLength === 'verylong') fullSystemPrompt += `--- REPLY LENGTH ---\nYour reply must be twelve or thirteen sentences in length.\n\n`;
    characterForAPI.description = fullSystemPrompt;

    const MAX_RETRIES = 90;
    currentStreamController = new AbortController();
    let fullReply = '';
    let reasoningBuf = '';
const startTime = Date.now();
const coldStartTimer = setTimeout(() => {
    const messageToUpdate = chat.history.find(m => m.id === messageId);
    if (messageToUpdate) {
        messageToUpdate.variations[message.activeVariant].main = originalText + " " + "Connecting to AI Model - Please wait or regenerate the message.";
        updateSingleMessageView(messageId);
    }
}, 20000);
const serverHungTimer = setTimeout(() => {
    const messageToUpdate = chat.history.find(m => m.id === messageId);
    if (messageToUpdate && messageToUpdate.variations[message.activeVariant].main.includes("Connecting to AI Model")) {
        messageToUpdate.variations[message.activeVariant].main = originalText + " " + "The AI provider may be experiencing issues - Please wait a moment or try again later.";
        updateSingleMessageView(messageId);
    }
}, 70000);

const clearStreamTimers = () => {
    clearTimeout(coldStartTimer);
    clearTimeout(serverHungTimer);
};
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        if (!currentStreamController) { streamAbortedByUser = true; break; }
        try {
            console.log(`Continue request (Attempt ${attempt}/${MAX_RETRIES})...`);

            const currentModel = modelSelect.value;
            const currentTemperature = temperatureSlider.value;
            const apiKeyToSend = (modelSettings && modelSettings.apiKey) || appSettings.apiKey;
const targetApiUrlToSend = (modelSettings && modelSettings.targetApiUrl) || DEFAULT_API_URL;
const isLocal = targetApiUrlToSend && (
    targetApiUrlToSend.includes('localhost') ||
    targetApiUrlToSend.includes('127.0.0.1') ||
    targetApiUrlToSend.includes('::1') ||
    /^https?:\/\/192\.168\./.test(targetApiUrlToSend) ||
    /^https?:\/\/10\./.test(targetApiUrlToSend) ||
    /^https?:\/\/172\.(1[6-9]|2[0-9]|3[01])\./.test(targetApiUrlToSend)
);

const reminderContent = messageType === 'dialog' ? combinedDialogReminder : combinedNarratorReminder;
const moodDirective = chat.mood ? `\n[MOOD — TOP PRIORITY: right now ${charNameForAI} is feeling ${chat.mood}. This emotion MUST be clearly and unmistakably visible in their tone, word choice, body language and reactions in THIS reply, even if it contrasts with their usual demeanor. Do not write them as calm or neutral — stay in character but let the ${chat.mood} show strongly.]` : '';
const lastUserContent = (reminderContent
    ? `${messageForAPI}\n[${reminderContent}]`
    : messageForAPI) + moodDirective;
const messages = [
    { role: 'system', content: characterForAPI.description },
    ...historyForAPIcall.map(h => ({ role: h.sender === 'ai' ? 'assistant' : 'user', content: h.main })),
    { role: 'user', content: lastUserContent },
];
const fetchUrl = targetApiUrlToSend;
const fetchBody = JSON.stringify({
    model: currentModelId,
    messages,
    temperature: parseFloat(currentTemperature),
    top_p: 0.95,
    stream: true,
    character_id: currentCharacterId,
    chat_id: currentChatId,
    options: {
        num_ctx: modelSettings?.numCtx || 131072,
        top_p: 0.95
    }
});
const response = await fetch(fetchUrl, {
    method: 'POST',
    headers: isLocal
        ? { 'Content-Type': 'application/json' }
        : { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKeyToSend}` },
    signal: currentStreamController.signal,
    body: fetchBody
});
            clearStreamTimers();

            if (response.status === 429) {
    const elapsedTime = Date.now() - startTime;
    if (elapsedTime > 20000) {
    const messageToUpdate = chat.history.find(m => m.id === messageId);
    if (messageToUpdate) {
        messageToUpdate.variations[message.activeVariant].main = originalText + " " + `The selected AI Model experiences heavy traffic or is rate-limited (requests per minute). Please wait...`;
        updateSingleMessageView(messageId);
    }
    }
    await new Promise(resolve => setTimeout(resolve, 1000));
    if (attempt === MAX_RETRIES) throw new Error("AI Model did not respond after multiple retries. Please try again later or choose another Model.");
    continue;
}
            if (!response.ok) throw new Error(await response.text());

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let sseBuffer = '';
            fullReply = '';
            reasoningBuf = '';
            let thinkOpened = false;
            const thinkRegex = /<think>([\s\S]*?)<\/think>/i;
            const mainTypewriter = createTypewriter();
            const thinkTypewriter = createTypewriter();
            mainTypewriter.init(sanitizeModelOutput(originalText || ''));

            while (true) {
                const { value, done } = await reader.read();
                if (done) break;
                sseBuffer += decoder.decode(value, { stream: true });
                const lines = sseBuffer.split('\n');
                sseBuffer = lines.pop() || '';
                const currentMessageElement = document.querySelector(`[data-message-id="${messageId}"]`);
                mainContentEl = currentMessageElement ? currentMessageElement.querySelector('.main-content') : null;
                thinkBlockEl = currentMessageElement ? currentMessageElement.querySelector('.think-block') : null;
                thinkContentEl = thinkBlockEl ? thinkBlockEl.querySelector('.think-block-content') : null;
                const ensureThinkBlockPresent = () => {
                    if (!currentMessageElement) return false;
                    if (!thinkBlockEl || !thinkContentEl) {
                        const refs = ensureThinkBlockElements(currentMessageElement);
                        thinkBlockEl = refs.thinkBlock;
                        thinkContentEl = refs.thinkContent;
                    }
                    return !!(thinkBlockEl && thinkContentEl);
                };
                for (const rawLine of lines) {
                    const line = rawLine.trim();
                    if (!line.startsWith('data:')) continue;
                    const dataContent = line.slice(5).trim();
                    if (dataContent === '[DONE]') { sseBuffer = ''; break; }
                    
                    try {
                        const parsed = JSON.parse(dataContent);
                        const delta = parsed.choices && parsed.choices[0] && parsed.choices[0].delta;

                        if (isFirstChunk && (delta?.content || delta?.reasoning)) {
                            message.isStreaming = false;
                            message.streamingVariant = null;
                            if (mainContentEl) setBubbleLoading(mainContentEl, false);
                            isFirstChunk = false;
                        }

                        if (delta?.content) {
                            fullReply += delta.content;

                            const openIdx = fullReply.search(/<think>/i);
                            const closeIdx = fullReply.toLowerCase().indexOf("</think>");

                            let mainOnly;
                            let streamThinkText = null;
                            let streamThinkComplete = false;

                            if (openIdx === -1 && closeIdx !== -1) {
                                mainOnly = fullReply.slice(closeIdx + "</think>".length).trimStart();
                                streamThinkText = fullReply.slice(0, closeIdx).trim();
                                streamThinkComplete = true;
                            } else if (openIdx !== -1 && closeIdx !== -1 && closeIdx > openIdx) {
                                mainOnly = (fullReply.slice(0, openIdx) + fullReply.slice(closeIdx + "</think>".length)).trim();
                                streamThinkText = fullReply.slice(openIdx + "<think>".length, closeIdx).trim();
                                streamThinkComplete = true;
                            } else if (openIdx !== -1) {
                                mainOnly = fullReply.slice(0, openIdx).trim();
                                streamThinkText = fullReply.slice(openIdx + "<think>".length).trim();
                                streamThinkComplete = false;
                            } else {
                                mainOnly = fullReply.trim();
                            }

                            const combinedTextRaw = (originalText ? `${originalText} ${mainOnly}` : mainOnly).trim();
                            const sanitizedCombined = sanitizeModelOutput(combinedTextRaw);
                            mainTypewriter.update(sanitizedCombined, t => { if (mainContentEl) { mainContentEl.innerHTML = formatSubString(t); if (chatWindow._autoScroll !== false) chatWindow.scrollTop = chatWindow.scrollHeight; } });
                            activeVariant.main = sanitizedCombined;

                            if (thinkEnabled && streamThinkText !== null && reasoningBuf === '' && ensureThinkBlockPresent()) {
                                thinkBlockEl.classList.remove('hidden');
                                if (!thinkOpened) { thinkBlockEl.open = true; thinkOpened = true; }
                                const sanitizedThink = sanitizeModelOutput(streamThinkText);
                                thinkTypewriter.update(sanitizedThink, t => { if (thinkContentEl) { thinkContentEl.innerHTML = `&lt;think&gt;<br>${formatSubString(t)}<br>&lt;/think&gt;`; if (chatWindow._autoScroll !== false) chatWindow.scrollTop = chatWindow.scrollHeight; } });
                                if (streamThinkComplete) {
                                    activeVariant.think = sanitizedThink;
                                }
                            }
                        }
                        if (delta?.reasoning) {
                           reasoningBuf += delta.reasoning;
                           if (thinkEnabled && ensureThinkBlockPresent()) {
                               const sanitizedReasoning = sanitizeModelOutput(reasoningBuf.trim());
                               thinkBlockEl.classList.remove('hidden');
                               if (!thinkOpened) { thinkBlockEl.open = true; thinkOpened = true; }
                               thinkTypewriter.update(sanitizedReasoning, t => { if (thinkContentEl) { thinkContentEl.innerHTML = `&lt;think&gt;<br>${formatSubString(t)}<br>&lt;/think&gt;`; if (chatWindow._autoScroll !== false) chatWindow.scrollTop = chatWindow.scrollHeight; } });
                               activeVariant.think = sanitizedReasoning;
                           }
                        }
                    } catch { continue; }
                }
            }

            const hasAnyReplyText = fullReply.trim() !== '' || reasoningBuf.trim() !== '';
            if (hasAnyReplyText) {
                console.log(`Successful response after ${attempt} attempts.`);
                const finalThinkMatch = fullReply.match(thinkRegex);
                const mainOnly = fullReply.replace(thinkRegex, '').trim();
                const combinedFinalRaw = (originalText ? `${originalText} ${mainOnly}` : mainOnly).trim();
                const reasoningMainFallback = extractMainFromReasoning(reasoningBuf);
                activeVariant.main = sanitizeModelOutput(combinedFinalRaw); 
                
                let finalThink = null;
                if (reasoningBuf.trim()) {
                    finalThink = sanitizeModelOutput(reasoningBuf.trim());
                } else if (finalThinkMatch) {
                    finalThink = sanitizeModelOutput(finalThinkMatch[1].trim());
                }
                
if (!finalThink) {
  const hasOpen = /<think>/i.test(fullReply);
  const closeIdx = fullReply.toLowerCase().indexOf("</think>");
  if (!hasOpen && closeIdx !== -1) {
    finalThink = sanitizeModelOutput(fullReply.slice(0, closeIdx).trim());
    const mainTail = fullReply.slice(closeIdx + "</think>".length).trimStart();
    const combinedTail = (originalText ? `${originalText} ${mainTail}` : mainTail).trim();
    activeVariant.main = sanitizeModelOutput(combinedTail);
  }
}

                if (!finalThink && reasoningBuf.trim()) {
                    finalThink = sanitizeModelOutput(reasoningBuf.trim());
                }
                if (!finalThink) {
  const hasOpen = /<think>/i.test(fullReply);
  const cIdx = fullReply.toLowerCase().indexOf("</think>");
  if (!hasOpen && cIdx !== -1) {
    finalThink = sanitizeModelOutput(fullReply.slice(0, cIdx).trim());
    const mainTail = fullReply.slice(cIdx + "</think>".length).trimStart();
    const combinedTail = (originalText ? `${originalText} ${mainTail}` : mainTail).trim();
    activeVariant.main = sanitizeModelOutput(combinedTail);
  }
}
                if ((!mainOnly || mainOnly.trim() === '') && reasoningMainFallback) {
                    const combinedFallback = (originalText ? `${originalText} ${reasoningMainFallback}` : reasoningMainFallback).trim();
                    activeVariant.main = sanitizeModelOutput(combinedFallback);
                }

                if (!thinkEnabled) { finalThink = null; }
                activeVariant.think = finalThink;

                if (finalThink && (!thinkBlockEl || !thinkContentEl)) {
                    const refs = ensureThinkBlockElements(messageElement);
                    thinkBlockEl = refs.thinkBlock;
                    thinkContentEl = refs.thinkContent;
                }

                if (thinkBlockEl) {
                    if (finalThink) {
                        thinkBlockEl.classList.remove('hidden');
                        if (thinkContentEl) {
                            thinkTypewriter.flush(finalThink, t => { thinkContentEl.innerHTML = `&lt;think&gt;<br>${formatSubString(t)}<br>&lt;/think&gt;`; });
                        }
                        thinkBlockEl.open = false;
                    } else {
                        thinkBlockEl.classList.add('hidden');
                        thinkBlockEl.open = false;
                    }
                }
                playNotificationSound();
                updateTokenCount();
                break; 
            } else {
                if (attempt < MAX_RETRIES) await new Promise(resolve => setTimeout(resolve, 1000));
            }

        } catch (error) {
            clearStreamTimers();
            if (error.name === 'AbortError') {
                console.log('Fetch aborted (Continue).');
                break;
    }
    console.error(`Error during continue (Attempt ${attempt}):`, error.message);
    const isTemporaryError = (error.message && error.message.includes('maximum capacity')) || (error.message && error.message.includes('Failed to fetch'));
    if (isTemporaryError && attempt < MAX_RETRIES) {
        await new Promise(resolve => setTimeout(resolve, 1000));
    } else {
        let errorMsg = `AI Model did not respond to the request. Please try the following steps:

• Re-enter your default API key (or model-specific API key) in the app settings by copy & paste to ensure that it's correct.
• Check the request limits per minute/per day of the provider you're using, especially in free plans. Connection fails when limits are exceeded.
• Try sending a message again later in case the model is overloaded. Also, use other AI models to see if the AI model itself was the problem.
• In some cases your API provider might have a temporary problem. Try another provider/API key to see if your provider was the problem.
• Check the FAQ section (help button on main screen) for further details to this error.`;
        if (error.message.includes('Failed to fetch')) {
            errorMsg = "Could not connect to the AI provider. Please check your API key and internet connection, then try again.";
        }
        if(mainContentEl) {
            const sanitizedError = sanitizeModelOutput(`${originalText}\n\n[--- ERROR: ${errorMsg} ---]`);
            mainContentEl.innerHTML = formatSubString(sanitizedError);
        }
        break;
    }
}
    }

    message.isStreaming = false;
    message.streamingVariant = null;
    setBubbleLoading(mainContentEl, false);
    loadingIndicator.classList.add('hidden');
    stopStreamBtn.classList.add('hidden');
    dialogBtn.disabled = false;
    storyBtn.disabled = false;
    currentStreamController = null;
    generateReplyOptionsInBackground();
    await saveSingleCharacterToDB(characters[currentCharacterId]);
    updateSingleMessageView(messageId);

    const finalMessageElement = document.querySelector(`[data-message-id="${messageId}"]`);
    if (finalMessageElement) {
        const regenBtn = finalMessageElement.querySelector('.regenerate-btn');
        const continueBtn = finalMessageElement.querySelector('.continue-btn');
        if (regenBtn) {
            regenBtn.disabled = false;
            regenBtn.classList.remove('is-loading');
        }
        if (continueBtn) {
            continueBtn.disabled = false;
            continueBtn.classList.remove('is-loading');
        }
        const finalControls = finalMessageElement.querySelector('.message-controls');
        if (finalControls) finalControls.classList.remove('is-streaming');

        const prevBtn = finalMessageElement.querySelector('.prev-variant-btn');
        const nextBtn = finalMessageElement.querySelector('.next-variant-btn');
        const counter = finalMessageElement.querySelector('.variant-counter');

        if (prevBtn) prevBtn.style.display = '';
        if (nextBtn) nextBtn.style.display = '';
        if (counter) counter.style.display = '';
    }
}



function updateSingleMessageView(messageId) {
    const chat = characters[currentCharacterId]?.chats?.[currentChatId];
    if (!chat) return;

    const message = chat.history.find(m => m.id === messageId);
    if (!message) return;

    const messageElement = document.querySelector(`[data-message-id="${messageId}"]`);
    let mainContentEl = messageElement?.querySelector('.main-content');
    let thinkBlockEl = messageElement?.querySelector('.think-block');
    let thinkContentEl = thinkBlockEl ? thinkBlockEl.querySelector('.think-block-content') : null;
    if (!messageElement) return;

    const mainContent = messageElement.querySelector('.main-content');
    const thinkBlock = messageElement.querySelector('.think-block');
    const controls = messageElement.querySelector('.message-controls');

    const activeVariant = message.variations[message.activeVariant];
    const shouldShowLoader = message.sender === 'ai'
        && message.isStreaming
        && message.streamingVariant === message.activeVariant
        && activeVariant.main === '...';

    if (mainContent) {
        if (shouldShowLoader) {
            setBubbleLoading(mainContent, true);
        } else {
            setBubbleLoading(mainContent, false);
            const sanitizedMain = sanitizeModelOutput(activeVariant.main);
            if (sanitizedMain !== activeVariant.main) {
                activeVariant.main = sanitizedMain;
            }
            mainContent.innerHTML = formatSubString(sanitizedMain);
        }
    }

    if (thinkBlock) {
        if (activeVariant.think) {
            const sanitizedThink = sanitizeModelOutput(activeVariant.think);
            if (sanitizedThink !== activeVariant.think) {
                activeVariant.think = sanitizedThink;
            }
            const thinkContent = thinkBlock.querySelector('.think-block-content');
            thinkContent.innerHTML = `&lt;think&gt;<br>${formatSubString(sanitizedThink)}<br>&lt;/think&gt;`;
            thinkBlock.classList.remove('hidden');
        } else {
            thinkBlock.classList.add('hidden');
        }
    }

    if (controls) {
        const prevBtn = controls.querySelector('.prev-variant-btn');
        const nextBtn = controls.querySelector('.next-variant-btn');
        const counter = controls.querySelector('.variant-counter');

        if (prevBtn) prevBtn.disabled = message.activeVariant === 0;
        if (nextBtn) nextBtn.disabled = message.activeVariant >= message.variations.length - 1;
        if (counter) counter.textContent = `${message.activeVariant + 1}/${message.variations.length}`;
    }
}
