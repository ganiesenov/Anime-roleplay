/* storage.js — IndexedDB (AriaBD v3) + legacy migration + load/save helpers. */
(function () {
    'use strict';

    function openRawDB(name, version, upgrade) {
        return new Promise((resolve, reject) => {
            const req = version ? indexedDB.open(name, version) : indexedDB.open(name);
            if (upgrade) req.onupgradeneeded = (e) => upgrade(req.result, e);
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
            req.onblocked = () => { /* wait */ };
        });
    }

    function ensureStores(database) {
        if (!database.objectStoreNames.contains('characters'))
            database.createObjectStore('characters', { keyPath: 'id' });
        if (!database.objectStoreNames.contains('personas'))
            database.createObjectStore('personas', { keyPath: 'id' });
        if (!database.objectStoreNames.contains('settings'))
            database.createObjectStore('settings', { keyPath: 'key' });
    }

    function getAll(database, store) {
        return new Promise((resolve, reject) => {
            if (!database.objectStoreNames.contains(store)) { resolve([]); return; }
            const tx = database.transaction(store, 'readonly');
            const req = tx.objectStore(store).getAll();
            req.onsuccess = () => resolve(req.result || []);
            req.onerror = () => reject(req.error);
        });
    }

    function putAll(database, store, records) {
        return new Promise((resolve, reject) => {
            if (!records || !records.length) { resolve(); return; }
            const tx = database.transaction(store, 'readwrite');
            const os = tx.objectStore(store);
            records.forEach((r) => { try { os.put(r); } catch (e) { /* skip */ } });
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    }

    // Does a database currently exist? (best-effort across browsers)
    function dbExists(name) {
        return new Promise((resolve) => {
            if (indexedDB.databases) {
                indexedDB.databases().then((list) => {
                    resolve(!!(list || []).find((d) => d.name === name));
                }).catch(() => resolve(true)); // assume yes; openRawDB will no-op if empty
                return;
            }
            resolve(true);
        });
    }

    async function migrateFromLegacy(database) {
        // Only migrate when AriaBD is still empty.
        const existing = await getAll(database, 'characters');
        if (existing && existing.length) return false;
        const existingPersonas = await getAll(database, 'personas');
        const existingSettings = await getAll(database, 'settings');
        if (existing.length || existingPersonas.length || existingSettings.length) return false;

        const has = await dbExists(window.LEGACY_DB_NAME);
        if (!has) return false;

        let legacy;
        try {
            legacy = await openRawDB(window.LEGACY_DB_NAME);
        } catch (e) { return false; }

        try {
            const chars = await getAll(legacy, 'characters');
            const pers = await getAll(legacy, 'personas');
            const sets = await getAll(legacy, 'settings');
            if (!chars.length && !pers.length && !sets.length) { legacy.close(); return false; }
            await putAll(database, 'characters', chars);
            await putAll(database, 'personas', pers);
            await putAll(database, 'settings', sets);
            legacy.close();
            return true;
        } catch (e) {
            try { legacy.close(); } catch (_) { /* ignore */ }
            return false;
        }
    }

    async function openDB() {
        const database = await openRawDB(window.DB_NAME, window.DB_VERSION, (d) => ensureStores(d));
        window.db = database;
        try { await migrateFromLegacy(database); } catch (e) { console.warn('Legacy migration skipped:', e); }
        return database;
    }

    async function loadCharactersFromDB() {
        const rows = await getAll(window.db, 'characters');
        window.characters = {};
        rows.forEach((c) => { if (c && c.id) window.characters[c.id] = normalizeCharacter(c); });
        return window.characters;
    }

    function normalizeCharacter(c) {
        c.tags = typeof c.tags === 'string' ? c.tags : (Array.isArray(c.tags) ? c.tags.join(', ') : '');
        c.type = c.type || 'character';
        c.scenarios = Array.isArray(c.scenarios) ? c.scenarios : [];
        c.characterIds = Array.isArray(c.characterIds) ? c.characterIds : [];
        c.chats = c.chats && typeof c.chats === 'object' ? c.chats : {};
        c.isFavorite = !!c.isFavorite;
        c.isArchived = !!c.isArchived;
        ['name', 'chatName', 'avatar', 'background', 'description', 'lore', 'instructions',
            'reminder', 'narratorReminder', 'musicUrl'].forEach((k) => {
                if (c[k] == null) c[k] = '';
            });
        return c;
    }

    async function loadPersonasFromDB() {
        const rows = await getAll(window.db, 'personas');
        window.personas = {};
        rows.forEach((p) => { if (p && p.id) window.personas[p.id] = p; });
        return window.personas;
    }

    function getSettingRow(key) {
        return new Promise((resolve) => {
            const tx = window.db.transaction('settings', 'readonly');
            const req = tx.objectStore('settings').get(key);
            req.onsuccess = () => resolve(req.result || null);
            req.onerror = () => resolve(null);
        });
    }

    async function loadAllSettingsRows() {
        const rows = await getAll(window.db, 'settings');
        const map = {};
        rows.forEach((r) => { if (r && r.key != null) map[r.key] = r.value; });
        return map;
    }

    async function loadAppSettingsFromDB() {
        const row = await getSettingRow('appSettings');
        if (row && row.value) {
            window.appSettings = row.value;
        }
        if (!window.appSettings) window.appSettings = {};
        if (!Array.isArray(window.appSettings.availableModels)) window.appSettings.availableModels = [];
        if (window.appSettings.apiKey == null) window.appSettings.apiKey = '';
        ensureLocalBackendModel();
        return window.appSettings;
    }

    function ensureLocalBackendModel() {
        const models = window.appSettings.availableModels;
        const hasLocal = models.some((m) =>
            m && (m.id === 'local-qwen' || (m.targetApiUrl && m.targetApiUrl.indexOf('127.0.0.1:8000') !== -1)));
        if (!models.length) {
            window.appSettings.availableModels = window.DEFAULT_AVAILABLE_MODELS.map((m) => Object.assign({}, m));
        } else if (!hasLocal) {
            models.unshift(Object.assign({}, window.DEFAULT_AVAILABLE_MODELS[0]));
        }
    }

    function saveSingleCharacterToDB(char) {
        return new Promise((resolve, reject) => {
            if (!char || !char.id) { resolve(); return; }
            const tx = window.db.transaction('characters', 'readwrite');
            tx.objectStore('characters').put(char);
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    }

    function saveCharactersToDB() {
        const all = Object.values(window.characters);
        return putAll(window.db, 'characters', all);
    }

    function deleteSingleCharacterFromDB(id) {
        return new Promise((resolve, reject) => {
            const tx = window.db.transaction('characters', 'readwrite');
            tx.objectStore('characters').delete(id);
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    }

    function deleteManyCharactersFromDB(ids) {
        return new Promise((resolve, reject) => {
            const tx = window.db.transaction('characters', 'readwrite');
            const os = tx.objectStore('characters');
            ids.forEach((id) => os.delete(id));
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    }

    // ── Card sync to backend (definition only; chats sync via /api/chats) ─────
    function cardBackendOrigin() {
        if (location.protocol === 'http:' || location.protocol === 'https:') return location.origin;
        try { return new URL(window.DEFAULT_API_URL).origin; } catch (e) { return 'http://127.0.0.1:8000'; }
    }

    // Drop the heavy per-chat blob — chats are backed up separately by the server.
    function cardForServer(char) {
        const copy = Object.assign({}, char);
        delete copy.chats;
        return copy;
    }

    // Fire-and-forget: persist a card definition so it survives cache-clear / new
    // device. Silently no-ops when the backend is unreachable (e.g. static host).
    function syncCharacterToServer(char) {
        if (!char || !char.id) return Promise.resolve();
        return fetch(cardBackendOrigin() + '/api/characters', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(cardForServer(char))
        }).catch(() => { /* offline / static host: ignore */ });
    }

    function deleteCharacterFromServer(id) {
        if (!id) return Promise.resolve();
        return fetch(cardBackendOrigin() + '/api/characters/' + encodeURIComponent(id), { method: 'DELETE' })
            .catch(() => { /* ignore */ });
    }

    // Pull server-stored cards and seed any missing locally (never clobbers local
    // edits). Chats are restored separately afterwards. Returns count added.
    async function restoreCharactersFromServer(opts) {
        opts = opts || {};
        let list;
        try {
            const r = await fetch(cardBackendOrigin() + '/api/characters');
            if (!r.ok) throw new Error('HTTP ' + r.status);
            list = await r.json();
        } catch (e) { return 0; }
        if (!Array.isArray(list)) return 0;
        let added = 0;
        for (const item of list) {
            if (!item || !item.id || window.characters[item.id]) continue; // present → don't overwrite
            let full;
            try {
                const r = await fetch(cardBackendOrigin() + '/api/characters/' + encodeURIComponent(item.id));
                if (!r.ok) continue;
                full = await r.json();
            } catch (e) { continue; }
            if (!full || !full.id) continue;
            window.characters[full.id] = normalizeCharacter(full);
            await saveSingleCharacterToDB(window.characters[full.id]);
            added++;
        }
        if (added) {
            if (window.renderCharacterList) window.renderCharacterList();
            if (!opts.silent && window.showToast)
                window.showToast(added + ' character' + (added === 1 ? '' : 's') + ' restored from server');
        }
        return added;
    }

    // One-time backfill: push the whole local library to the server (existing
    // cards created before auto-sync existed). Sequential, with status updates.
    async function backupAllCharactersToServer() {
        const status = document.getElementById('restore-status');
        const set = (t) => { if (status) status.textContent = t; };
        const all = Object.values(window.characters || {});
        if (!all.length) { set('No characters to back up.'); return; }
        try {
            const r = await fetch(cardBackendOrigin() + '/api/characters');
            if (!r.ok) throw new Error('HTTP ' + r.status);
        } catch (e) { set('Could not reach backup server.'); return; }
        let ok = 0, fail = 0;
        for (let i = 0; i < all.length; i++) {
            set('Backing up ' + (i + 1) + '/' + all.length + '…');
            try {
                const resp = await fetch(cardBackendOrigin() + '/api/characters', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(cardForServer(all[i]))
                });
                if (resp.ok) ok++; else fail++;
            } catch (e) { fail++; }
        }
        const msg = ok + ' card' + (ok === 1 ? '' : 's') + ' backed up' + (fail ? ', ' + fail + ' failed' : '');
        set(msg);
        if (window.showToast) window.showToast(msg);
    }

    function savePersonasToDB() {
        const all = Object.values(window.personas);
        return new Promise((resolve, reject) => {
            const tx = window.db.transaction('personas', 'readwrite');
            const os = tx.objectStore('personas');
            // Clear & rewrite to handle deletions.
            const clearReq = os.clear();
            clearReq.onsuccess = () => { all.forEach((p) => os.put(p)); };
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    }

    function saveSettingToDB(key, value) {
        return new Promise((resolve, reject) => {
            const tx = window.db.transaction('settings', 'readwrite');
            tx.objectStore('settings').put({ key: key, value: value });
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    }

    function saveAppSettingsToDB() {
        return saveSettingToDB('appSettings', window.appSettings);
    }

    window.openDB = openDB;
    window.loadCharactersFromDB = loadCharactersFromDB;
    window.loadPersonasFromDB = loadPersonasFromDB;
    window.loadAppSettingsFromDB = loadAppSettingsFromDB;
    window.loadAllSettingsRows = loadAllSettingsRows;
    window.getSettingRow = getSettingRow;
    window.saveSingleCharacterToDB = saveSingleCharacterToDB;
    window.saveCharactersToDB = saveCharactersToDB;
    window.deleteSingleCharacterFromDB = deleteSingleCharacterFromDB;
    window.deleteManyCharactersFromDB = deleteManyCharactersFromDB;
    window.syncCharacterToServer = syncCharacterToServer;
    window.deleteCharacterFromServer = deleteCharacterFromServer;
    window.restoreCharactersFromServer = restoreCharactersFromServer;
    window.backupAllCharactersToServer = backupAllCharactersToServer;
    window.savePersonasToDB = savePersonasToDB;
    window.saveSettingToDB = saveSettingToDB;
    window.saveAppSettingsToDB = saveAppSettingsToDB;
    window.normalizeCharacter = normalizeCharacter;
    window.ensureLocalBackendModel = ensureLocalBackendModel;
})();
