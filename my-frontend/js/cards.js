/* cards.js — character card builder + per-character stats/token helpers. */
(function () {
    'use strict';

    function chatCount(char) {
        return Object.keys(char.chats || {}).length;
    }
    function messageCount(char) {
        let n = 0;
        Object.values(char.chats || {}).forEach((c) => { n += (c.history ? c.history.length : 0); });
        return n;
    }
    function lastActivity(char) {
        let ts = window.tsFromId(char.id, 'char');
        Object.keys(char.chats || {}).forEach((cid) => {
            const t = window.tsFromId(cid, 'chat');
            if (t > ts) ts = t;
        });
        return ts;
    }
    function createdTs(char) { return window.tsFromId(char.id, 'char'); }

    function tagList(char) {
        return String(char.tags || '').split(',').map((t) => t.trim()).filter(Boolean);
    }

    function estimateCharacterTokens(char) {
        const text = [char.chatName, char.description, char.lore, char.instructions,
            char.reminder, char.narratorReminder].filter(Boolean).join(' ');
        return window.estimateTokens(text);
    }

    function buildCharacterCard(char) {
        const isWorld = char.type === 'world';
        const card = document.createElement('div');
        card.className = 'character-card' + (isWorld ? ' card--world' : '');
        card.dataset.charId = char.id;

        // Favorite button (omit for archived).
        if (!char.isArchived) {
            const fav = document.createElement('button');
            fav.className = 'favorite-btn' + (char.isFavorite ? ' is-favorite' : '');
            fav.title = char.isFavorite ? 'Remove from favorites' : 'Add to favorites';
            fav.textContent = '★';
            card.appendChild(fav);
        }

        // Archive button.
        const arch = document.createElement('button');
        arch.className = 'archive-btn';
        arch.title = char.isArchived ? 'Retrieve from archive' : 'Archive character';
        arch.textContent = char.isArchived ? '▲' : '▼';
        card.appendChild(arch);

        // Image container.
        const imgC = document.createElement('div');
        imgC.className = 'card-image-container effect-container img-loading';
        const imgSrc = isWorld ? char.background : char.avatar;
        if (imgSrc) {
            const img = document.createElement('img');
            const url = window.getImageUrl(imgSrc);
            img.src = url;
            img.alt = char.name || '';
            img.addEventListener('load', () => imgC.classList.remove('img-loading'));
            img.addEventListener('error', () => { img.classList.add('is-broken'); imgC.classList.remove('img-loading'); });
            imgC.style.backgroundImage = 'url("' + url + '")';
            imgC.appendChild(img);
        } else {
            imgC.classList.remove('img-loading');
            const ph = document.createElement('div');
            ph.className = 'placeholder-icon';
            ph.textContent = isWorld ? '🌍' : '👤';
            imgC.appendChild(ph);
        }
        if (isWorld) {
            const badge = document.createElement('span');
            badge.className = 'world-badge';
            badge.textContent = 'World';
            imgC.appendChild(badge);
            const memCount = (char.characterIds || []).length;
            if (memCount) {
                const cc = document.createElement('span');
                cc.className = 'world-char-count';
                cc.textContent = memCount + ' character' + (memCount === 1 ? '' : 's');
                imgC.appendChild(cc);
            }
        }
        card.appendChild(imgC);

        // Stats row.
        const stats = document.createElement('div');
        stats.className = 'card-stats';
        const s1 = document.createElement('span');
        s1.className = 'card-stat';
        s1.textContent = '💬 ' + window.compactNumber(chatCount(char));
        const s2 = document.createElement('span');
        s2.className = 'card-stat';
        s2.textContent = '✉️ ' + window.compactNumber(messageCount(char));
        stats.appendChild(s1);
        stats.appendChild(s2);
        card.appendChild(stats);

        // Name.
        const nameC = document.createElement('div');
        nameC.className = 'card-name-container';
        const nameEl = document.createElement('span');
        nameEl.className = 'card-name';
        nameEl.textContent = char.name || 'Unnamed';
        nameC.appendChild(nameEl);
        card.appendChild(nameC);

        return card;
    }

    function adjustCardImageFit() {
        window.smartObjectFitAll('.card-image-container img');
    }

    window.buildCharacterCard = buildCharacterCard;
    window.adjustCardImageFit = adjustCardImageFit;
    window.cardChatCount = chatCount;
    window.cardMessageCount = messageCount;
    window.cardLastActivity = lastActivity;
    window.cardCreatedTs = createdTs;
    window.cardTagList = tagList;
    window.estimateCharacterTokens = estimateCharacterTokens;
})();
