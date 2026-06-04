/* characters.js — home page rendering: list/grid/shelves, categories, tags,
 * pagination, favorites, archive, bulk delete, copy/delete character. */
(function () {
    'use strict';
    function $(id) { return document.getElementById(id); }

    function nonArchived() {
        return Object.values(window.characters).filter((c) => !c.isArchived);
    }
    function archivedChars() {
        return Object.values(window.characters).filter((c) => c.isArchived);
    }

    function categoryMatches(cat, char) {
        if (!cat.key) return true;
        const hay = ((char.name || '') + ' ' + (char.tags || '')).toLowerCase();
        return cat.keywords.some((kw) => hay.indexOf(kw) !== -1);
    }

    function nameSort(a, b) {
        return String(a.name || '').localeCompare(String(b.name || ''), 'de', { sensitivity: 'base' });
    }

    function sortChars(list, mode) {
        const arr = list.slice();
        switch (mode) {
            case 'name':
                arr.sort(nameSort); break;
            case 'recent':
                arr.sort((a, b) => window.cardLastActivity(b) - window.cardLastActivity(a) || nameSort(a, b)); break;
            case 'new':
                arr.sort((a, b) => window.cardCreatedTs(b) - window.cardCreatedTs(a) || nameSort(a, b)); break;
            case 'popular':
                arr.sort((a, b) => (window.cardChatCount(b) - window.cardChatCount(a)) ||
                    (window.cardMessageCount(b) - window.cardMessageCount(a)) || nameSort(a, b)); break;
            case 'messages':
                arr.sort((a, b) => window.cardMessageCount(b) - window.cardMessageCount(a) || nameSort(a, b)); break;
            default:
                arr.sort((a, b) => window.cardLastActivity(b) - window.cardLastActivity(a) || nameSort(a, b));
        }
        return arr;
    }

    function filterSig() {
        return [getSearch(), window.activeTag, window.browseFilter, window.activeCategory,
            window.sortMode, window._forceGrid].join('|');
    }

    function getSearch() {
        const el = $('search-input');
        return el ? el.value.trim().toLowerCase() : '';
    }

    function matchesFilters(char) {
        const q = getSearch();
        if (q) {
            const hay = ((char.name || '') + ' ' + (char.tags || '')).toLowerCase();
            if (hay.indexOf(q) === -1) return false;
        }
        if (window.activeTag) {
            const hay = (char.tags || '').toLowerCase();
            if (hay.indexOf(window.activeTag) === -1) return false;
        }
        if (window.browseFilter === 'favorites' && !char.isFavorite) return false;
        if (window.activeCategory) {
            const cat = window.CATEGORIES.find((c) => c.key === window.activeCategory);
            if (cat && !categoryMatches(cat, char)) return false;
        }
        return true;
    }

    function isHomeMode() {
        return window.browseFilter === 'all' && !getSearch() && !window.activeTag &&
            !window.activeCategory && !window._forceGrid;
    }

    function renderCharacterList(searchTerm) {
        // searchTerm arg kept for contract; live value read from input.
        const sig = filterSig();
        if (sig !== window._lastFilterSig) { window.currentPage = 1; window._lastFilterSig = sig; }

        renderCategoryBar();
        renderTagBar();
        renderFavoritesBar();

        const shelves = $('shelves-container');
        const grid = $('character-list');
        const archiveSection = $('archive-section');
        const countBadge = $('char-count-badge');

        const live = nonArchived();

        if (isHomeMode()) {
            if (shelves) shelves.style.display = '';
            if (grid) grid.innerHTML = '';
            if (archiveSection) archiveSection.classList.add('hidden');
            $('pagination-bar') && ($('pagination-bar').innerHTML = '');
            renderShelves(live);
            if (countBadge) countBadge.textContent = live.length + ' character' + (live.length === 1 ? '' : 's');
            requestAnimationFrame(fitAllCardNames);
            return;
        }

        // Results grid mode.
        if (shelves) { shelves.style.display = 'none'; shelves.innerHTML = ''; }
        if (grid) grid.innerHTML = '';

        const matched = sortChars(live.filter(matchesFilters), window.sortMode);
        if (countBadge) countBadge.textContent = matched.length + ' character' + (matched.length === 1 ? '' : 's');

        const totalPages = Math.max(1, Math.ceil(matched.length / window.PAGE_SIZE));
        if (window.currentPage > totalPages) window.currentPage = totalPages;
        const start = (window.currentPage - 1) * window.PAGE_SIZE;
        const pageItems = matched.slice(start, start + window.PAGE_SIZE);

        if (!matched.length) {
            const empty = document.createElement('div');
            empty.className = 'grid-empty';
            if (!Object.keys(window.characters).length) {
                empty.innerHTML = '<p>Nothing here yet.</p><button id="grid-empty-create">+ Create a Character</button>';
            } else {
                empty.innerHTML = '<p>Nothing matched your filters.</p><button id="grid-empty-reset">Reset filters</button>';
            }
            grid && grid.appendChild(empty);
            const c = $('grid-empty-create'); if (c) c.addEventListener('click', () => window.openEditorForNew && window.openEditorForNew());
            const r = $('grid-empty-reset'); if (r) r.addEventListener('click', resetFilters);
        } else {
            pageItems.forEach((char) => grid && grid.appendChild(window.buildCharacterCard(char)));
        }

        renderPagination(totalPages);

        // Archive: render all archived that match into archive list.
        renderArchive();
        requestAnimationFrame(fitAllCardNames);
    }

    function resetFilters() {
        window.browseFilter = 'all';
        window.activeTag = null;
        window.activeCategory = null;
        window._forceGrid = false;
        const s = $('search-input'); if (s) s.value = '';
        document.querySelectorAll('.browse-tab').forEach((t) =>
            t.classList.toggle('active', t.dataset.filter === 'all'));
        renderCharacterList();
    }

    function renderArchive() {
        const archiveSection = $('archive-section');
        const list = $('archived-character-list');
        if (!list) return;
        list.innerHTML = '';
        const arch = archivedChars().filter(matchesFiltersArchived).sort(nameSort);
        arch.forEach((c) => list.appendChild(window.buildCharacterCard(c)));
        if (archiveSection) archiveSection.classList.toggle('hidden', arch.length === 0);
    }
    function matchesFiltersArchived(char) {
        const q = getSearch();
        if (q) {
            const hay = ((char.name || '') + ' ' + (char.tags || '')).toLowerCase();
            if (hay.indexOf(q) === -1) return false;
        }
        return true;
    }

    function fitAllCardNames() {
        document.querySelectorAll('.card-name').forEach((el) => window.adjustFontSizeToFit(el));
    }

    // ── Shelves ─────────────────────────────────────────────────────────────
    function renderShelves(all) {
        const container = $('shelves-container');
        if (!container) return;
        container.innerHTML = '';
        const live = sortChars(all, 'name');
        if (!live.length) {
            const card = document.createElement('div');
            card.className = 'shelf-empty grid-empty';
            card.innerHTML = '<p>No characters yet.</p><button id="shelf-empty-create">+ Create your first Character</button>';
            container.appendChild(card);
            const b = $('shelf-empty-create');
            if (b) b.addEventListener('click', () => window.openEditorForNew && window.openEditorForNew());
            return;
        }

        const favs = live.filter((c) => c.isFavorite);
        if (favs.length) addShelf(container, 'Favorites', favs, () => window.setBrowseFilter('favorites'));

        const recent = live.filter((c) => window.cardChatCount(c) > 0)
            .sort((a, b) => window.cardLastActivity(b) - window.cardLastActivity(a));
        if (recent.length) addShelf(container, 'Recently used', recent, null);

        window.CATEGORIES.forEach((cat) => {
            if (!cat.key) return;
            const matches = live.filter((c) => categoryMatches(cat, c));
            if (matches.length) addShelf(container, cat.label, matches, () => {
                window.activeCategory = cat.key;
                renderCharacterList();
            });
        });

        const added = live.slice().sort((a, b) => window.cardCreatedTs(b) - window.cardCreatedTs(a));
        addShelf(container, 'Recently added', added, null);

        addShelf(container, 'Everyone', live, () => { window._forceGrid = true; renderCharacterList(); });
    }

    function addShelf(container, title, chars, seeAllFn) {
        const capped = chars.slice(0, 20);
        const shelf = document.createElement('div');
        shelf.className = 'shelf';
        const head = document.createElement('div');
        head.className = 'shelf-head';
        const h = document.createElement('span');
        h.className = 'shelf-title';
        h.textContent = title + ' (' + chars.length + ')';
        head.appendChild(h);
        if (seeAllFn) {
            const sa = document.createElement('button');
            sa.className = 'shelf-seeall';
            sa.textContent = 'See all ▸';
            sa.addEventListener('click', seeAllFn);
            head.appendChild(sa);
        }
        shelf.appendChild(head);
        const track = document.createElement('div');
        track.className = 'shelf-track';
        capped.forEach((c) => track.appendChild(window.buildCharacterCard(c)));
        shelf.appendChild(track);
        container.appendChild(shelf);
    }

    // ── Category bar ────────────────────────────────────────────────────────
    function renderCategoryBar() {
        const bar = $('category-bar');
        if (!bar) return;
        bar.innerHTML = '';
        window.CATEGORIES.forEach((cat) => {
            const chip = document.createElement('button');
            chip.className = 'category-chip' + (window.activeCategory === cat.key ? ' active' : '');
            chip.textContent = cat.label;
            chip.addEventListener('click', () => {
                window.activeCategory = (window.activeCategory === cat.key) ? null : cat.key;
                renderCharacterList();
            });
            bar.appendChild(chip);
        });
    }

    // ── Tag bar ─────────────────────────────────────────────────────────────
    function renderTagBar() {
        const bar = $('tag-bar');
        if (!bar) return;
        bar.innerHTML = '';
        const counts = {};
        Object.values(window.characters).forEach((c) => {
            window.cardTagList(c).forEach((t) => {
                const k = t.toLowerCase();
                counts[k] = (counts[k] || 0) + 1;
            });
        });
        const tags = Object.keys(counts).sort((a, b) => counts[b] - counts[a]);
        if (!tags.length) {
            bar.innerHTML = '<span class="tag-empty">Tag your characters to populate this strip.</span>';
            return;
        }
        tags.forEach((t) => {
            const chip = document.createElement('button');
            chip.className = 'tag-chip' + (window.activeTag === t ? ' active' : '');
            chip.textContent = '#' + t + ' ' + counts[t];
            chip.addEventListener('click', () => {
                window.activeTag = (window.activeTag === t) ? null : t;
                renderCharacterList();
            });
            bar.appendChild(chip);
        });
    }

    // ── Favorites bar ───────────────────────────────────────────────────────
    function renderFavoritesBar() {
        const bar = $('favorites-bar');
        if (!bar) return;
        bar.innerHTML = '';
        const favs = nonArchived().filter((c) => c.isFavorite).sort(nameSort);
        if (!favs.length) {
            bar.innerHTML = '<span class="favorites-placeholder">No Favorites selected</span>';
            return;
        }
        favs.forEach((c, i) => {
            const item = document.createElement('button');
            item.className = 'favorite-item';
            item.dataset.charId = c.id;
            item.style.zIndex = (favs.length - i);
            const imgSrc = c.type === 'world' ? c.background : c.avatar;
            if (imgSrc) {
                const img = document.createElement('img');
                img.src = window.getImageUrl(imgSrc);
                img.alt = c.name;
                item.appendChild(img);
            } else {
                const ph = document.createElement('span');
                ph.className = 'placeholder-icon';
                ph.textContent = c.type === 'world' ? '🌍' : '👤';
                item.appendChild(ph);
            }
            const label = document.createElement('span');
            label.className = 'favorite-item-name';
            label.textContent = c.name;
            item.appendChild(label);
            item.addEventListener('click', () => window.showChatList(c.id));
            bar.appendChild(item);
        });
    }

    // ── Pagination ──────────────────────────────────────────────────────────
    function renderPagination(totalPages) {
        const bar = $('pagination-bar');
        if (!bar) return;
        bar.innerHTML = '';
        if (totalPages <= 1) return;
        const cur = window.currentPage;
        const mk = (label, page, disabled, active) => {
            const b = document.createElement('button');
            b.className = 'page-btn' + (active ? ' active' : '');
            b.textContent = label;
            if (disabled) b.disabled = true;
            else b.addEventListener('click', () => {
                window.currentPage = page;
                renderCharacterList();
                const grid = $('character-list');
                if (grid) grid.scrollIntoView({ behavior: 'smooth', block: 'start' });
            });
            return b;
        };
        bar.appendChild(mk('‹', cur - 1, cur <= 1, false));
        const pages = new Set([1, totalPages, cur, cur - 1, cur + 1]);
        const sorted = [...pages].filter((p) => p >= 1 && p <= totalPages).sort((a, b) => a - b);
        let prev = 0;
        sorted.forEach((p) => {
            if (p - prev > 1) {
                const dots = document.createElement('span');
                dots.className = 'page-ellipsis';
                dots.textContent = '…';
                bar.appendChild(dots);
            }
            bar.appendChild(mk(String(p), p, false, p === cur));
            prev = p;
        });
        bar.appendChild(mk('›', cur + 1, cur >= totalPages, false));
    }

    function setBrowseFilter(filter) {
        window.browseFilter = filter;
        if (filter === 'all') {
            window.activeCategory = null;
            window.activeTag = null;
            window._forceGrid = false;
        }
        document.querySelectorAll('.browse-tab').forEach((t) =>
            t.classList.toggle('active', t.dataset.filter === filter));
        renderCharacterList();
    }

    // ── Favorite / archive toggles ──────────────────────────────────────────
    function toggleFavorite(charId) {
        const char = window.characters[charId];
        if (!char || char.isArchived) return;
        char.isFavorite = !char.isFavorite;
        window.saveSingleCharacterToDB(char);
        renderFavoritesBar();
        // Update star on any visible card.
        document.querySelectorAll('.character-card[data-char-id="' + charId + '"] .favorite-btn')
            .forEach((b) => b.classList.toggle('is-favorite', char.isFavorite));
    }

    function toggleArchiveState(charId) {
        const char = window.characters[charId];
        if (!char) return;
        char.isArchived = !char.isArchived;
        if (char.isArchived) char.isFavorite = false;
        window.saveSingleCharacterToDB(char);
        renderCharacterList();
    }

    function toggleArchiveCollapse() {
        const content = $('archive-content');
        const btn = $('archive-toggle-btn');
        if (!content) return;
        const collapsed = content.classList.toggle('collapsed');
        if (btn) btn.textContent = collapsed ? 'Show Characters' : 'Hide all';
        if (!collapsed) requestAnimationFrame(fitAllCardNames);
    }

    // ── Copy / delete character ─────────────────────────────────────────────
    async function handleCopyCharacter() {
        const char = window.characters[window.currentCharacterId];
        if (!char) return;
        const clone = JSON.parse(JSON.stringify(char));
        clone.id = 'char-' + Date.now();
        clone.name = (char.name || '') + ' (Copy)';
        clone.chats = {};
        clone.isFavorite = false;
        window.characters[clone.id] = clone;
        await window.saveSingleCharacterToDB(clone);
        if (window.syncCharacterToServer) window.syncCharacterToServer(clone); // backup to server
        renderCharacterList();
        await window.showCustomAlert('Character copied as "' + clone.name + '".');
        window.showMainScreen();
    }

    async function handleDeleteCurrentCharacter() {
        const char = window.characters[window.currentCharacterId];
        if (!char) return;
        const ok = await window.showCustomConfirm('Delete "' + char.name + '" and all its chats? This cannot be undone.', true);
        if (!ok) return;
        const id = char.id;
        delete window.characters[id];
        // Scrub from participants of others.
        Object.values(window.characters).forEach((c) => {
            Object.values(c.chats || {}).forEach((chat) => {
                if (Array.isArray(chat.participants))
                    chat.participants = chat.participants.filter((p) => p !== id);
            });
        });
        await window.deleteSingleCharacterFromDB(id);
        if (window.deleteCharacterFromServer) window.deleteCharacterFromServer(id); // remove server backup
        window.currentCharacterId = null;
        window.currentChatId = null;
        renderCharacterList();
        window.showMainScreen();
    }

    // ── Bulk delete ─────────────────────────────────────────────────────────
    function openBulkCharacterDeleteModal() {
        const selected = new Set();
        const overlay = document.createElement('div');
        overlay.className = 'custom-alert-overlay bulk-delete-overlay';
        const modal = document.createElement('div');
        modal.className = 'custom-alert-modal bulk-delete-modal';
        modal.innerHTML = '<h2>Delete multiple characters</h2>' +
            '<input type="search" class="modal-search-input bulk-search" placeholder="🔎 Search...">' +
            '<label class="bulk-select-all"><input type="checkbox" class="bulk-all-cb"> Select all</label>' +
            '<div class="bulk-list"></div>' +
            '<div class="custom-dialog-buttons">' +
            '<button class="secondary-btn bulk-cancel">Cancel</button>' +
            '<button class="danger-btn bulk-confirm">Delete selected</button></div>';
        overlay.appendChild(modal);
        document.body.appendChild(overlay);

        const listEl = modal.querySelector('.bulk-list');
        const searchEl = modal.querySelector('.bulk-search');
        const allCb = modal.querySelector('.bulk-all-cb');
        const chars = Object.values(window.characters).sort(nameSort);

        function render() {
            const q = searchEl.value.trim().toLowerCase();
            listEl.innerHTML = '';
            const visible = chars.filter((c) => (c.name || '').toLowerCase().indexOf(q) !== -1);
            visible.forEach((c) => {
                const row = document.createElement('label');
                row.className = 'bulk-row';
                const cb = document.createElement('input');
                cb.type = 'checkbox';
                cb.checked = selected.has(c.id);
                cb.addEventListener('change', () => {
                    if (cb.checked) selected.add(c.id); else selected.delete(c.id);
                    syncAll(visible);
                });
                const av = document.createElement('span');
                av.className = 'bulk-avatar';
                const imgSrc = c.type === 'world' ? c.background : c.avatar;
                av.innerHTML = imgSrc ? '<img src="' + window.getImageUrl(imgSrc) + '">' : '👤';
                const nm = document.createElement('span');
                nm.textContent = c.name;
                row.appendChild(cb); row.appendChild(av); row.appendChild(nm);
                listEl.appendChild(row);
            });
            syncAll(visible);
        }
        function syncAll(visible) {
            const sel = visible.filter((c) => selected.has(c.id)).length;
            allCb.indeterminate = sel > 0 && sel < visible.length;
            allCb.checked = visible.length > 0 && sel === visible.length;
        }
        searchEl.addEventListener('input', render);
        allCb.addEventListener('change', () => {
            const q = searchEl.value.trim().toLowerCase();
            const visible = chars.filter((c) => (c.name || '').toLowerCase().indexOf(q) !== -1);
            visible.forEach((c) => { if (allCb.checked) selected.add(c.id); else selected.delete(c.id); });
            render();
        });
        modal.querySelector('.bulk-cancel').addEventListener('click', () => overlay.remove());
        modal.querySelector('.bulk-confirm').addEventListener('click', async () => {
            if (!selected.size) { await window.showCustomAlert('No characters selected.'); return; }
            const ok = await window.showCustomConfirm('Delete ' + selected.size + ' selected character(s)? This cannot be undone.', true);
            if (!ok) return;
            const ids = [...selected];
            ids.forEach((id) => {
                delete window.characters[id];
                if (window.currentCharacterId === id) { window.currentCharacterId = null; window.currentChatId = null; }
            });
            Object.values(window.characters).forEach((c) => {
                Object.values(c.chats || {}).forEach((chat) => {
                    if (Array.isArray(chat.participants))
                        chat.participants = chat.participants.filter((p) => ids.indexOf(p) === -1);
                });
            });
            await window.deleteManyCharactersFromDB(ids);
            if (window.deleteCharacterFromServer) ids.forEach((id) => window.deleteCharacterFromServer(id)); // remove server backups
            renderCharacterList();
            overlay.remove();
            window.showToast('Deleted ' + ids.length + ' character(s).');
        });
        render();
    }

    window.renderCharacterList = renderCharacterList;
    window.renderShelves = renderShelves;
    window.renderCategoryBar = renderCategoryBar;
    window.renderTagBar = renderTagBar;
    window.renderFavoritesBar = renderFavoritesBar;
    window.renderPagination = renderPagination;
    window.setBrowseFilter = setBrowseFilter;
    window.toggleFavorite = toggleFavorite;
    window.toggleArchiveState = toggleArchiveState;
    window.toggleArchiveCollapse = toggleArchiveCollapse;
    window.handleCopyCharacter = handleCopyCharacter;
    window.handleDeleteCurrentCharacter = handleDeleteCurrentCharacter;
    window.openBulkCharacterDeleteModal = openBulkCharacterDeleteModal;
    window.resetFilters = resetFilters;
})();
