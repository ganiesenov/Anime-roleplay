// =============================================================
// groups.js — group-chat participants: icon list, character
// dropdown/selection, active-speaker handling, add participant.
// Depends on globals resolved at call time (state, storage,
// updateTokenCount, startChat, DOM refs, createAvatarWithEffect).
// =============================================================

// --- FUNCTIONS FOR GROUP CHATS ---

function renderParticipantIcons() {
    participantIconList.innerHTML = '';
    const chat = characters[currentCharacterId]?.chats?.[currentChatId];
    if (!chat || !chat.participants || chat.participants.length <= 1) return;
    const guestIds = chat.participants.slice(1);

    guestIds.forEach(charId => {
        const participant = characters[charId];
        if (!participant) return;

        const wrapper = document.createElement('div');
        wrapper.className = 'participant-icon-wrapper';
        wrapper.dataset.charId = charId;

        if (participant.avatar) {
            const img = document.createElement('img');
            img.onerror = function() {
                const placeholder = document.createElement('div');
                placeholder.className = 'placeholder-icon';
                placeholder.innerHTML = '👤';
                this.replaceWith(placeholder);
            };
            img.src = participant.avatar;
            smartObjectFit(img);
            img.style.objectFit = 'cover';
            img.style.objectPosition = 'center';
            wrapper.appendChild(img);
        } else {
            const placeholder = document.createElement('div');
            placeholder.className = 'placeholder-icon';
            placeholder.innerHTML = '👤';
            wrapper.appendChild(placeholder);
        }

        participantIconList.appendChild(wrapper);
    });

    const hint = document.createElement('span');
    hint.className = 'participant-remove-hint';
    hint.innerHTML = '&times;';
    participantIconList.appendChild(hint);
}



// --- GROUP CHAT CHARACTER DROPDOWN ---

function showGroupCharDropdown() {
    const chat = characters[currentCharacterId]?.chats?.[currentChatId];
    if (!chat || !chat.participants || chat.participants.length <= 1) {
        hideGroupCharDropdown();
        return;
    }

    groupCharDropdown.innerHTML = '';
    const guestIds = chat.participants.filter(id => id !== currentCharacterId);
    if (guestIds.length === 0) {
        hideGroupCharDropdown();
        return;
    }

    guestIds.forEach(charId => {
        const character = characters[charId];
        if (!character) return;
        const displayName = (character.chatName || character.name || '').trim();
        if (!displayName) return;

        const item = document.createElement('div');
        item.className = 'group-char-dropdown-item';
        if (charId === activeGroupParticipantId) item.classList.add('is-selected');
        item.dataset.charId = charId;

        let avatarEl;
        if (character.avatar) {
            avatarEl = document.createElement('img');
            avatarEl.src = getImageUrl(character.avatar);
            avatarEl.className = 'group-char-dropdown-avatar';
            avatarEl.alt = displayName;
            avatarEl.onerror = function() {
                const ph = document.createElement('div');
                ph.className = 'group-char-dropdown-avatar-placeholder';
                ph.textContent = '👤';
                this.replaceWith(ph);
            };
        } else {
            avatarEl = document.createElement('div');
            avatarEl.className = 'group-char-dropdown-avatar-placeholder';
            avatarEl.textContent = '👤';
        }

        const nameEl = document.createElement('span');
        nameEl.className = 'group-char-dropdown-name';
        nameEl.textContent = displayName;

        item.appendChild(avatarEl);
        item.appendChild(nameEl);
        groupCharDropdown.appendChild(item);
    });

    if (groupCharDropdown.childElementCount > 0) {
        groupCharDropdown.classList.remove('hidden');
    } else {
        hideGroupCharDropdown();
    }
}

function hideGroupCharDropdown() {
    groupCharDropdown.classList.add('hidden');
}

function setActiveGroupParticipant(charId) {
    activeGroupParticipantId = charId;
    const character = characters[charId];
    const displayName = character ? (character.chatName || character.name || '').trim() : '';
    groupCharBubbleName.textContent = displayName;
    groupCharBubble.classList.remove('hidden');
    hideGroupCharDropdown();
    messageInput.focus();
}

function clearActiveGroupParticipant() {
    activeGroupParticipantId = null;
    groupCharBubble.classList.add('hidden');
    groupCharBubbleName.textContent = '';
}



function openParticipantModal(searchTerm = '') {
  participantSelectionList.innerHTML = '';
  const currentParticipants = characters[currentCharacterId]?.chats?.[currentChatId]?.participants || [];

  const sortedCharacters = Object.values(characters).sort((a, b) => {
    return a.name.localeCompare(b.name, 'de', { sensitivity: 'base' });
  });

  const lowerCaseSearchTerm = searchTerm.trim().toLowerCase();
  const filteredCharacters = sortedCharacters.filter(char =>
    char.type !== 'world' && char.name.toLowerCase().includes(lowerCaseSearchTerm)
  );

  filteredCharacters.forEach(char => {
    if (!currentParticipants.includes(char.id)) {
      const btn = document.createElement('button');
      btn.className = 'participant-option-btn';
      btn.dataset.charId = char.id;

      const imageUrl = getImageUrl(char.avatar);
const avatarHtml = `
    <img src="${imageUrl}" class="${char.avatar ? '' : 'hidden'}" onerror="this.style.display='none'; this.nextElementSibling.classList.remove('hidden');">
    <div class="placeholder-icon ${char.avatar ? 'hidden' : ''}">👤</div>
`;

      btn.innerHTML = `${avatarHtml} <span>${char.name}</span>`;

      participantSelectionList.appendChild(btn);
    }
  });
smartObjectFitAll('.participant-option-btn img');
  participantSelectionModal.classList.remove('hidden');
  document.querySelectorAll('#participant-selection-list img').forEach(img => {
  img.style.objectFit = 'cover';
  img.style.objectPosition = 'center';
});
}



async function addParticipantToChat(participantId) {
    const chat = characters[currentCharacterId]?.chats?.[currentChatId];
    if (!chat || chat.participants.includes(participantId)) return;

    chat.participants.push(participantId);
    await saveSingleCharacterToDB(characters[currentCharacterId]);
    updateTokenCount();
    renderParticipantIcons(); 
    participantSelectionModal.classList.add('hidden');
}
