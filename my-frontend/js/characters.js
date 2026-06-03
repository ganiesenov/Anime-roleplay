// =============================================================
// characters.js — character list rendering, token estimates,
// and bulk-delete UI.
// Calls into globals that remain in script.js (createAvatarWithEffect,
// getImageUrl, startChat, openCharacterEditor, toggleArchiveState,
// adjustCardImageFit, ...) — resolved at call time. No load-time deps.
// =============================================================

// --- landing: browse filter + categories + tag chip bar + pagination ---
let browseFilter = 'all';   // 'all' | 'favorites' — driven by the browse tabs
let activeTag = '';         // currently selected tag chip (lowercased), '' = none
let activeCategory = '';    // curated category key, '' = all
let currentPage = 1;        // 1-based page in the character grid
const PAGE_SIZE = 24;
let _lastFilterSig = null;   // resets pagination whenever the filter changes
let sortMode = 'recent';     // 'recent' | 'popular' | 'messages' | 'new' | 'name'

// 1234 -> "1.2k" for compact card stats
const _fmtCount = n => n >= 1000 ? (n / 1000).toFixed(n >= 10000 ? 0 : 1).replace(/\.0$/, '') + 'k' : String(n);

// Real usage stats per character (ids embed creation/activity timestamps:
// 'char-<ms>-…' and 'chat-<ms>'), reused for both sorting and card overlays.
function _charStats(char) {
    const chatObj = char.chats || {};
    const ids = Object.keys(chatObj);
    let msgs = 0, lastTs = 0;
    ids.forEach(id => {
        const c = chatObj[id];
        if (Array.isArray(c.history)) msgs += c.history.length;
        const m = /chat-(\d+)/.exec(id);
        if (m) lastTs = Math.max(lastTs, +m[1]);
    });
    const cm = /char-(\d+)/.exec(char.id || '');
    const createdTs = cm ? +cm[1] : 0;
    return { chats: ids.length, msgs, lastTs: lastTs || createdTs, createdTs };
}

function _sortChars(arr) {
    const byName = (a, b) => a.name.localeCompare(b.name, 'de', { sensitivity: 'base' });
    if (sortMode === 'name') return arr.sort(byName);
    return arr.sort((a, b) => {
        const sa = _charStats(a), sb = _charStats(b);
        let d = 0;
        if (sortMode === 'popular') d = (sb.chats - sa.chats) || (sb.msgs - sa.msgs);
        else if (sortMode === 'messages') d = sb.msgs - sa.msgs;
        else if (sortMode === 'recent') d = sb.lastTs - sa.lastTs;
        else if (sortMode === 'new') d = sb.createdTs - sa.createdTs;
        return d || byName(a, b);
    });
}

// Wire the sort dropdown once at load
const _sortSelect = document.getElementById('sort-select');
if (_sortSelect) _sortSelect.addEventListener('change', () => {
    sortMode = _sortSelect.value || 'recent';
    const nameVal = (document.getElementById('search-input') || {}).value || '';
    renderCharacterList(nameVal.trim());
});

// Unified line-icon set (single visual language across the app). Each entry is
// a full inline SVG string (stroke=currentColor, sized by CSS per context).
const _ICO = p => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
const ICONS = {
    all:     _ICO('<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>'),
    anime:   _ICO('<rect x="2" y="7" width="20" height="15" rx="2"/><polyline points="17 2 12 7 7 2"/>'),
    hero:    _ICO('<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>'),
    kpop:    _ICO('<path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/>'),
    music:   _ICO('<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>'),
    movie:   _ICO('<rect x="2" y="2" width="20" height="20" rx="2.2"/><line x1="7" y1="2" x2="7" y2="22"/><line x1="17" y1="2" x2="17" y2="22"/><line x1="2" y1="12" x2="22" y2="12"/><line x1="2" y1="7" x2="7" y2="7"/><line x1="2" y1="17" x2="7" y2="17"/><line x1="17" y1="17" x2="22" y2="17"/><line x1="17" y1="7" x2="22" y2="7"/>'),
    game:    _ICO('<rect x="2" y="6" width="20" height="12" rx="6"/><line x1="6" y1="12" x2="10" y2="12"/><line x1="8" y1="10" x2="8" y2="14"/><line x1="15" y1="13" x2="15.01" y2="13"/><line x1="18" y1="11" x2="18.01" y2="11"/>'),
    oc:      _ICO('<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>'),
    star:    _ICO('<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>'),
    clock:   _ICO('<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>'),
    sparkle: _ICO('<path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/>'),
    users:   _ICO('<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>'),
    chat:    _ICO('<path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>'),
    mail:    _ICO('<rect x="2" y="4" width="20" height="16" rx="2"/><polyline points="22 6 12 13 2 6"/>'),
};

// Curated thematics. Each matches by keyword against name + tags (substring,
// lowercased), so they work even when characters aren't perfectly tagged.
const CATEGORIES = [
    { key: '',        label: 'All',         icon: ICONS.all },
    { key: 'anime',   label: 'Anime',       icon: ICONS.anime, kw: ['anime', 'manga', 'isekai', 'waifu', 'otaku'] },
    { key: 'hero',    label: 'Superheroes', icon: ICONS.hero,  kw: ['marvel', 'dc', 'superhero', 'avenger', 'spider', 'batman', 'hero'] },
    { key: 'kpop',    label: 'K-pop',       icon: ICONS.kpop,  kw: ['kpop', 'k-pop', 'idol', 'bts', 'blackpink'] },
    { key: 'music',   label: 'Music',       icon: ICONS.music, kw: ['music', 'singer', 'band', 'rapper', 'musician'] },
    { key: 'movie',   label: 'Movies',      icon: ICONS.movie, kw: ['actor', 'actress', 'movie', 'film', 'celebrity', 'hollywood'] },
    { key: 'game',    label: 'Games',       icon: ICONS.game,  kw: ['game', 'gaming', 'rpg', 'genshin', 'fictional'] },
    { key: 'oc',      label: 'OC',          icon: ICONS.oc,    kw: ['oc', 'original'] },
];

function _categoryMatch(char, catKey) {
    if (!catKey) return true;
    const cat = CATEGORIES.find(c => c.key === catKey);
    if (!cat || !cat.kw) return true;
    const hay = (char.name + ' ' + (char.tags || '')).toLowerCase();
    return cat.kw.some(k => hay.includes(k));
}

// Curated category strip (always visible, fixed set).
function renderCategoryBar() {
    const bar = document.getElementById('category-bar');
    if (!bar) return;
    bar.innerHTML = '';
    CATEGORIES.forEach(cat => {
        const chip = document.createElement('button');
        chip.type = 'button';
        chip.className = 'category-chip' + (activeCategory === cat.key ? ' active' : '');
        chip.innerHTML = `<span class="cat-ic">${cat.icon}</span>${cat.label}`;
        chip.addEventListener('click', () => {
            activeCategory = (activeCategory === cat.key) ? '' : cat.key;
            const nameVal = (document.getElementById('search-input') || {}).value || '';
            renderCharacterList(nameVal.trim());
            renderCategoryBar();
        });
        bar.appendChild(chip);
    });
}

// Pagination controls under the grid.
function renderPagination(totalPages) {
    const bar = document.getElementById('pagination-bar');
    if (!bar) return;
    bar.innerHTML = '';
    if (totalPages <= 1) return;
    const mk = (label, page, opts = {}) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'page-btn' + (opts.active ? ' active' : '') + (opts.nav ? ' nav' : '');
        b.innerHTML = label;
        if (opts.disabled) { b.disabled = true; }
        else b.addEventListener('click', () => {
            currentPage = page;
            const nameVal = (document.getElementById('search-input') || {}).value || '';
            renderCharacterList(nameVal.trim());
            document.getElementById('character-list')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
        return b;
    };
    bar.appendChild(mk('‹', currentPage - 1, { nav: true, disabled: currentPage === 1 }));
    // windowed page numbers
    const pages = new Set([1, totalPages, currentPage, currentPage - 1, currentPage + 1]);
    const sorted = [...pages].filter(p => p >= 1 && p <= totalPages).sort((a, b) => a - b);
    let prev = 0;
    sorted.forEach(p => {
        if (p - prev > 1) {
            const dots = document.createElement('span');
            dots.className = 'page-dots';
            dots.textContent = '…';
            bar.appendChild(dots);
        }
        bar.appendChild(mk(String(p), p, { active: p === currentPage }));
        prev = p;
    });
    bar.appendChild(mk('›', currentPage + 1, { nav: true, disabled: currentPage === totalPages }));
}

// Build the horizontal tag-chip strip from the tags actually present on
// characters (tags are stored as a comma-separated string per character).
// Clicking a chip drives the existing tag-search filter.
function renderTagBar() {
    const bar = document.getElementById('tag-bar');
    if (!bar) return;
    const counts = {};
    Object.values(characters).forEach(c => {
        (c.tags || '').split(',').forEach(raw => {
            const tag = raw.trim();
            if (tag) counts[tag] = (counts[tag] || 0) + 1;
        });
    });
    const tags = Object.keys(counts).sort((a, b) => counts[b] - counts[a]);
    bar.innerHTML = '';
    if (!tags.length) {
        bar.innerHTML = '<span class="tag-bar-empty">Tag your characters and a genre strip will appear here.</span>';
        return;
    }
    tags.forEach(tag => {
        const chip = document.createElement('button');
        chip.type = 'button';
        chip.className = 'tag-chip' + (activeTag === tag.toLowerCase() ? ' active' : '');
        chip.innerHTML = `#${tag}<span class="tag-chip-count">${counts[tag]}</span>`;
        chip.addEventListener('click', () => {
            activeTag = (activeTag === tag.toLowerCase()) ? '' : tag.toLowerCase();
            renderCharacterList(_currentSearch());
        });
        bar.appendChild(chip);
    });
}

let _forceGrid = false;   // "See all → Everyone" forces the flat grid over shelves

function _currentSearch() {
    return (document.getElementById('search-input') || {}).value?.trim() || '';
}

// Home / Favorites tabs. "Home" returns to the shelves (clears category/tag/grid).
function setBrowseFilter(filter) {
    document.querySelectorAll('.browse-tab').forEach(t =>
        t.classList.toggle('active', t.dataset.filter === filter));
    browseFilter = filter;
    if (filter === 'all') {
        activeCategory = '';
        activeTag = '';
        _forceGrid = false;
    }
    renderCharacterList(_currentSearch());
}
document.querySelectorAll('.browse-tab').forEach(tab => {
    tab.addEventListener('click', () => setBrowseFilter(tab.dataset.filter || 'all'));
});

// ─── Home shelves (Netflix-style horizontal rows by theme) ───
function _buildShelf(sh) {
    const wrap = document.createElement('section');
    wrap.className = 'shelf';
    const head = document.createElement('div');
    head.className = 'shelf-head';
    head.innerHTML = `<span class="shelf-title">${sh.title}</span><span class="shelf-count">${sh.chars.length}</span>`;
    if (sh.seeAll) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'shelf-seeall';
        btn.textContent = 'See all ▸';
        btn.addEventListener('click', sh.seeAll);
        head.appendChild(btn);
    }
    const track = document.createElement('div');
    track.className = 'shelf-track';
    sh.chars.forEach(c => track.appendChild(buildCharacterCard(c)));
    wrap.appendChild(head);
    wrap.appendChild(track);
    return wrap;
}

function renderShelves(all) {
    const root = document.getElementById('shelves-container');
    if (!root) return;
    root.innerHTML = '';
    if (!all.length) {
        root.innerHTML = `<div class="grid-empty"><div class="grid-empty-icon">✨</div><div class="grid-empty-title">Nothing here yet</div><div class="grid-empty-text">Create your first character — the “Create” button up top.</div></div>`;
        return;
    }
    const CAP = 20;
    const shelves = [];

    const favs = all.filter(c => c.isFavorite);
    if (favs.length) shelves.push({
        title: `${ICONS.star} Favorites`, chars: favs.slice(0, CAP),
        seeAll: () => setBrowseFilter('favorites'),
    });

    const used = all.filter(c => _charStats(c).chats > 0)
        .sort((a, b) => _charStats(b).lastTs - _charStats(a).lastTs);
    if (used.length) shelves.push({ title: `${ICONS.clock} Recently used`, chars: used.slice(0, CAP) });

    CATEGORIES.filter(cat => cat.key).forEach(cat => {
        const list = all.filter(c => _categoryMatch(c, cat.key));
        if (list.length) shelves.push({
            title: `${cat.icon} ${cat.label}`, chars: list.slice(0, CAP),
            seeAll: () => { activeCategory = cat.key; renderCategoryBar(); renderCharacterList(_currentSearch()); },
        });
    });

    const fresh = [...all].sort((a, b) => _charStats(b).createdTs - _charStats(a).createdTs);
    shelves.push({ title: `${ICONS.sparkle} Recently added`, chars: fresh.slice(0, CAP) });

    shelves.push({
        title: `${ICONS.users} Everyone`, chars: all.slice(0, CAP),
        seeAll: () => { _forceGrid = true; renderCharacterList(_currentSearch()); },
    });

    shelves.forEach(sh => root.appendChild(_buildShelf(sh)));
}

// Build a single character card element — used by BOTH the grid and the shelves.
function buildCharacterCard(character) {
    const charId = character.id;
    const charElement = document.createElement('div');
    const isWorldCard = character.type === 'world';
    charElement.classList.add('character-card');
    if (isWorldCard) charElement.classList.add('card--world');
    charElement.dataset.charId = charId;

    const isFavorite = character.isFavorite === true;
    const archiveButtonIcon = character.isArchived
        ? `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"/></svg>`
        : `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>`;
    const archiveButtonTitle = character.isArchived ? 'Retrieve from the archive' : 'Archive Character';

    const cardImageSource = isWorldCard ? character.background : character.avatar;
    const imageUrl = getImageUrl(cardImageSource);
    const placeholderContent = isWorldCard ? '<div class="world-card-placeholder">🌍</div>' : '<div class="placeholder-icon">👤</div>';
    const worldBadgeHtml = isWorldCard ? `<span class="world-badge">World</span>` : '';
    const worldCharCountHtml = isWorldCard && (character.characterIds || []).length > 0
        ? `<span class="world-char-count">${character.characterIds.length} character${character.characterIds.length !== 1 ? 's' : ''}</span>` : '';
    const starSvg = `<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>`;

    const st = _charStats(character);
    const statsHtml = `
    <div class="card-stats">
        <span class="card-stat" title="Saved chats">${ICONS.chat} ${_fmtCount(st.chats)}</span>
        <span class="card-stat" title="Total messages">${ICONS.mail} ${_fmtCount(st.msgs)}</span>
    </div>`;

    charElement.innerHTML = `
        ${!character.isArchived ? `<button class="favorite-btn ${isFavorite ? 'is-favorite' : ''}" title="Mark as Favorite">${starSvg}</button>` : ''}
        <button class="archive-btn" title="${archiveButtonTitle}">${archiveButtonIcon}</button>
        <div class="card-image-container effect-container ${cardImageSource ? 'img-loading' : ''}">
    ${worldBadgeHtml}
    <img src="${imageUrl}" alt="Avatar" class="${cardImageSource ? '' : 'hidden'}" onload="this.closest('.card-image-container')?.classList.remove('img-loading')" onerror="this.classList.add('is-broken'); this.closest('.card-image-container')?.classList.remove('img-loading')">
    ${cardImageSource ? '' : placeholderContent}
    ${statsHtml}
    ${worldCharCountHtml}
</div>
        <div class="card-name-container">
            <span>${character.name}</span>
        </div>`;

    if (cardImageSource) {
        charElement.querySelector('.card-image-container').style.backgroundImage = `url('${imageUrl}')`;
    }
    charElement.addEventListener('click', (event) => {
        if (!event.target.classList.contains('favorite-btn') && !event.target.classList.contains('archive-btn')) {
            showChatList(charId);
        }
    });
    return charElement;
}

// --- character list ---
function renderCharacterList(searchTerm = '') {
    const favoritesBar = document.getElementById('favorites-bar');
    const favoritesContainer = document.getElementById('favorites-bar-container');
    
    characterList.innerHTML = '';
    archivedCharacterList.innerHTML = ''; 
    favoritesBar.innerHTML = '';

    const lowerCaseSearchTerm = searchTerm.toLowerCase();
    const allSortedCharacters = Object.values(characters).sort((a, b) => {
        return a.name.localeCompare(b.name, 'de', { sensitivity: 'base' });
    });

    const favoriteCharacters = allSortedCharacters.filter(char => char.isFavorite && !char.isArchived); 
    if (favoriteCharacters.length > 0) {
        favoritesContainer.classList.remove('hidden');
        favoriteCharacters.forEach((character, index) => {
            const favElement = document.createElement('div');
            favElement.className = 'favorite-item';
            favElement.dataset.charId = character.id;
            const imageUrl = getImageUrl(character.avatar); 
favElement.innerHTML = `
  <div class="avatar-container">
    <img src="${imageUrl}" alt="${character.name}" class="${character.avatar ? '' : 'hidden'}" onerror="this.classList.add('is-broken')">
    <div class="placeholder-icon ${character.avatar ? 'hidden' : ''}">👤</div>
</div>
  <span>${character.name}</span>
`;

if (character.avatar) {
  const avatarContainer = favElement.querySelector('.avatar-container');
  avatarContainer.style.zIndex = index + 1;
}
            favElement.addEventListener('click', () => showChatList(character.id));
            favoritesBar.appendChild(favElement);
        });
    } else {
    favoritesContainer.classList.remove('hidden');
    favoritesBar.innerHTML = `<span class="favorites-placeholder">No Favorites selected</span>`;
}

    // single unified search box matches against name + tags
    const query = document.getElementById('search-input').value.trim().toLowerCase();

// reset to page 1 whenever the active filter or sort changes (any caller)
const filterSig = `${query}|${activeTag}|${browseFilter}|${activeCategory}|${sortMode}|${_forceGrid}`;
if (filterSig !== _lastFilterSig) { currentPage = 1; _lastFilterSig = filterSig; }

const shelvesContainer = document.getElementById('shelves-container');
const countBadge = document.getElementById('char-count-badge');
renderCategoryBar();
renderTagBar();

// HOME = themed shelves; any active search/tag/category/favorites → results grid
const isBrowsing = browseFilter === 'all' && !query && !activeTag && !activeCategory && !_forceGrid;
if (isBrowsing) {
    if (shelvesContainer) shelvesContainer.classList.remove('hidden');
    characterList.classList.add('hidden');
    if (archiveSection) archiveSection.classList.add('hidden');
    renderPagination(1); // clears the bar
    const liveAll = allSortedCharacters.filter(c => !c.isArchived);
    if (countBadge) countBadge.textContent = `${liveAll.length} character${liveAll.length !== 1 ? 's' : ''}`;
    renderShelves(liveAll);
    document.fonts.ready.then(() => {
        document.querySelectorAll('.card-name-container').forEach(c => adjustFontSizeToFit(c));
    });
    adjustCardImageFit();
    return;
}
if (shelvesContainer) shelvesContainer.classList.add('hidden');
characterList.classList.remove('hidden');

const filteredCharacters = allSortedCharacters.filter(char => {
    const hay = (char.name + ' ' + (char.tags || '')).toLowerCase();
    const queryMatch = !query || hay.includes(query);
    const tagMatch = !activeTag || (char.tags || '').toLowerCase().includes(activeTag);
    const favMatch = browseFilter !== 'favorites' || char.isFavorite === true;
    const catMatch = _categoryMatch(char, activeCategory);
    return queryMatch && tagMatch && favMatch && catMatch;
});
_sortChars(filteredCharacters);

    let archivedCount = 0;

    // paginate the active grid; archived characters always render in full
    const activeChars = filteredCharacters.filter(c => !c.isArchived);
    const archivedChars = filteredCharacters.filter(c => c.isArchived);
    const totalPages = Math.max(1, Math.ceil(activeChars.length / PAGE_SIZE));
    if (currentPage > totalPages) currentPage = totalPages;
    const pageStart = (currentPage - 1) * PAGE_SIZE;
    const pagedActive = activeChars.slice(pageStart, pageStart + PAGE_SIZE);
    const charactersToRender = [...pagedActive, ...archivedChars];

    for (const character of charactersToRender) {
        const charElement = buildCharacterCard(character);
        if (character.isArchived) {
            archivedCharacterList.appendChild(charElement);
            archivedCount++;
        } else {
            characterList.appendChild(charElement);
        }
    }

    if (archivedCount > 0) {
        archiveSection.classList.remove('hidden');
    } else {
        archiveSection.classList.add('hidden');
    }

    // meaningful empty state when nothing matches the active filter
    if (activeChars.length === 0) {
        const noChars = Object.keys(characters).length === 0;
        characterList.innerHTML = noChars
            ? `<div class="grid-empty"><div class="grid-empty-icon">✨</div><div class="grid-empty-title">Nothing here yet</div><div class="grid-empty-text">Create your first character — the “Create” button up top.</div></div>`
            : `<div class="grid-empty"><div class="grid-empty-icon">🔍</div><div class="grid-empty-title">Nothing found</div><div class="grid-empty-text">Reset filters, tags or category to bring characters back.</div></div>`;
    }

document.fonts.ready.then(() => {
    document.querySelectorAll('.card-name-container').forEach(container => {
        adjustFontSizeToFit(container);
    });
});

    adjustCardImageFit();

    // live count + pagination (category/tag strips already rendered above)
    if (countBadge) countBadge.textContent = `${activeChars.length} character${activeChars.length !== 1 ? 's' : ''}`;
    renderPagination(totalPages);
}


// --- token estimates ---
function calculateCharacterTokens(character) {
    if (!character) return 0;

    let totalText = '';
    totalText += character.chatName || '';
    totalText += character.description || '';
    totalText += character.lore || '';
    totalText += character.instructions || '';
    totalText += character.reminder || '';
    totalText += character.narratorReminder || '';

    return Math.round(totalText.length / 4);
}

function updateEditorTokenCount() {
    if (!editorTokenCounter) return;

    const tempChar = {
        chatName: document.getElementById('chat-name').value,
        description: document.getElementById('char-description').value,
        lore: document.getElementById('char-lore').value,
        instructions: document.getElementById('char-instructions').value,
        reminder: document.getElementById('char-reminder').value,
        narratorReminder: document.getElementById('char-narrator-reminder').value
    };

    const estimatedTokens = calculateCharacterTokens(tempChar);
    editorTokenCounter.textContent = `Estimated Tokens: ~${estimatedTokens}`;
}



function updatePersonaEditorTokenCount() {
    if (!personaEditorTokenCounter) return;

    let totalText = '';
    totalText += document.getElementById('persona-name').value || '';
    totalText += document.getElementById('persona-description').value || '';

    const estimatedTokens = Math.round(totalText.length / 4);
    personaEditorTokenCounter.textContent = `Estimated Tokens: ~${estimatedTokens}`;
}


// --- bulk character delete ---
let bulkSelectedCharIds = new Set();



function openBulkCharacterDeleteModal() {
  let modal = document.getElementById('bulkCharDeleteModal');
  bulkSelectedCharIds = new Set();

  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'bulkCharDeleteModal';
    modal.style.position = 'fixed';
    modal.style.top = '0';
    modal.style.left = '0';
    modal.style.width = '100%';
    modal.style.height = '100%';
    modal.style.backgroundColor = 'rgba(0, 0, 0, 0.6)';
    modal.style.display = 'flex';
    modal.style.justifyContent = 'center';
    modal.style.alignItems = 'center';
    modal.style.zIndex = '2200';

    const panel = document.createElement('div');
    panel.className = 'modal-content';
    panel.style.maxWidth = '600px';
    panel.style.width = 'min(600px, 92vw)';
    panel.innerHTML = `
      <h2>Bulk delete characters</h2>
      <p>Choose the characters you want to delete:</p>

      <div class="modal-search-container" style="display:flex; align-items:center; gap:10px;">
        <input type="search" id="bulkCharSearch" class="modal-search-input" placeholder="🔎 Search Character…">
        <label style="display:flex; align-items:center; gap:6px; font-size:16px; color:#dcddde;">
          <input id="bulkCharSelectAll" type="checkbox" />
          <span>Select all</span>
        </label>
      </div>

      <div id="bulkCharList" style="display:flex; flex-direction:column; gap:10px; max-height:50vh; overflow-y:auto; padding-right:10px;"></div>

      <div class="form-buttons">
        <button type="button" id="bulkCharDeleteBtn">Delete selected</button>
        <button type="button" id="cancel-bulk-delete-btn">Cancel</button>
      </div>
    `;
    modal.appendChild(panel);
    document.body.appendChild(modal);

    panel.querySelector('#bulkCharDeleteBtn').addEventListener('click', performBulkCharacterDelete);
    panel.querySelector('#bulkCharSelectAll').addEventListener('change', (e) => toggleSelectAllCharacters(e.target.checked));
    panel.querySelector('#bulkCharSearch').addEventListener('input', renderBulkCharacterDeleteList);
    panel.querySelector('#cancel-bulk-delete-btn').addEventListener('click', () => modal.remove());
  }

  renderBulkCharacterDeleteList();
  modal.style.display = 'flex';
}



function renderBulkCharacterDeleteList() {
  const list = document.getElementById('bulkCharList');
  if (!list) return;

  const q = (document.getElementById('bulkCharSearch')?.value || '').toLowerCase().trim();
  const entries = Object.entries(characters || {});
  const filtered = q ? entries.filter(([id, c]) => (c?.name || '').toLowerCase().includes(q)) : entries;

  list.innerHTML = '';
  filtered
    .sort((a, b) => (a[1]?.name || '').localeCompare(b[1]?.name || '', 'de', { sensitivity: 'base' }))
    .forEach(([id, c]) => {
      const avatarSrc = c?.avatar ? (typeof getImageUrl === 'function' ? getImageUrl(c.avatar) : c.avatar) : null;
      const avatarHtml = `
    <img src="${avatarSrc}" alt="Avatar" class="${avatarSrc ? '' : 'hidden'}" onerror="this.style.display='none'; this.nextElementSibling.classList.remove('hidden');">
    <div class="placeholder-icon ${avatarSrc ? 'hidden' : ''}">👤</div>
`;

      const row = document.createElement('label');
      row.className = 'participant-option-btn';
      row.style.justifyContent = 'space-between';
      row.style.width = '100%';
      row.style.boxSizing = 'border-box';

      const left = document.createElement('div');
      left.style.display = 'flex';
      left.style.alignItems = 'center';
      left.style.gap = '15px';
      left.innerHTML = `${avatarHtml}<span>${escapeHtml(c?.name || '(unnamed)')}</span>`;

      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.className = 'bulkCharCheckbox';
      cb.value = id;

      cb.checked = bulkSelectedCharIds.has(id);

      cb.addEventListener('change', (e) => {
        if (e.target.checked) bulkSelectedCharIds.add(id);
        else bulkSelectedCharIds.delete(id);
        updateSelectAllState();
      });

      row.appendChild(left);
      row.appendChild(cb);
      list.appendChild(row);
    });

  updateSelectAllState();
  list.querySelectorAll('img').forEach(img => {
  img.style.objectFit = 'cover';
  img.style.objectPosition = 'center';
});
}



function toggleSelectAllCharacters(checked) {
  const boxes = document.querySelectorAll('#bulkCharList .bulkCharCheckbox');
  boxes.forEach(cb => {
    cb.checked = checked;
    if (checked) bulkSelectedCharIds.add(cb.value);
    else bulkSelectedCharIds.delete(cb.value);
  });
  updateSelectAllState();
}



function updateSelectAllState() {
  const selectAll = document.getElementById('bulkCharSelectAll');
  if (!selectAll) return;

  const boxes = document.querySelectorAll('#bulkCharList .bulkCharCheckbox');
  const total = boxes.length;
  const selected = Array.from(boxes).filter(cb => cb.checked).length;

  selectAll.indeterminate = selected > 0 && selected < total;
  selectAll.checked = total > 0 && selected === total;
}



async function performBulkCharacterDelete() {
  const ids = Array.from(bulkSelectedCharIds);
  if (ids.length === 0) {
    showCustomAlert('No characters selected.');
    return;
  }
  if (!await showCustomConfirm(`Delete ${ids.length} selected character(s)? This cannot be undone.`, true)) return;

  const toDelete = new Set(ids);

  ids.forEach(id => { delete characters[id]; });

  for (const ownerId in characters) {
    const chats = characters[ownerId]?.chats || {};
    for (const chatId in chats) {
      const chat = chats[chatId];
      if (Array.isArray(chat?.participants)) {
        chat.participants = chat.participants.filter(pid => !toDelete.has(pid));
      }
    }
  }

  if (typeof currentCharacterId !== 'undefined' && toDelete.has(currentCharacterId)) {
    try { currentCharacterId = null; } catch (_) {}
    try { currentChatId = null; } catch (_) {}
  }

  try {
    await deleteMultipleCharactersFromDB(ids);
    renderCharacterList();
  } catch (e) {
    showCustomAlert('Error while deleting: ' + (e?.message || e));
  }

  const modal = document.getElementById('bulkCharDeleteModal');
  if (modal) modal.remove();

  showCustomAlert(`Deleted ${ids.length} character(s).`);
}
