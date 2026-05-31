// =============================================================
// storage.js — IndexedDB persistence layer.
// Depends only on shared state (db, characters, personas) from state.js.
// Loaded after state.js / utils.js, before script.js.
// =============================================================

function openDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('CasualCharacterChatDB', 3);

        request.onupgradeneeded = (event) => {
            const dbInstance = event.target.result;
            if (!dbInstance.objectStoreNames.contains('characters')) {
                dbInstance.createObjectStore('characters', { keyPath: 'id' });
            }
            if (!dbInstance.objectStoreNames.contains('personas')) {
                dbInstance.createObjectStore('personas', { keyPath: 'id' });
            }
            if (!dbInstance.objectStoreNames.contains('settings')) {
                dbInstance.createObjectStore('settings', { keyPath: 'key' });
            }
        };

        request.onsuccess = (event) => {
            db = event.target.result;
            resolve(db);
        };

        request.onerror = (event) => {
            console.error("IndexedDB error:", event.target.errorCode);
            reject(event.target.errorCode);
        };
    });
}

async function saveCharactersToDB() {
    if (!db) return;
    const transaction = db.transaction(['characters'], 'readwrite');
    const store = transaction.objectStore('characters');

    store.clear();

    for (const character of Object.values(characters)) {
        store.put(character);
    }

    return new Promise((resolve, reject) => {
        transaction.oncomplete = () => resolve();
        transaction.onerror = (event) => reject(event.target.error);
    });
}

async function saveSingleCharacterToDB(character) {
    if (!db) return;
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['characters'], 'readwrite');
        const store = transaction.objectStore('characters');
        const request = store.put(character);

        transaction.oncomplete = () => {
            resolve();
        };
        transaction.onerror = (event) => {
            console.error("Error saving single character:", event.target.error);
            reject(event.target.error);
        };
    });
}

async function deleteSingleCharacterFromDB(charId) {
    if (!db) return;
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['characters'], 'readwrite');
        const store = transaction.objectStore('characters');
        store.delete(charId);

        transaction.oncomplete = () => {
            resolve();
        };
        transaction.onerror = (event) => {
            console.error("Error deleting single character:", event.target.error);
            reject(event.target.error);
        };
    });
}

async function deleteMultipleCharactersFromDB(arrayOfIds) {
    if (!db || !arrayOfIds || arrayOfIds.length === 0) return;
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['characters'], 'readwrite');
        const store = transaction.objectStore('characters');
        arrayOfIds.forEach(id => {
            store.delete(id);
        });

        transaction.oncomplete = () => {
            resolve();
        };
        transaction.onerror = (event) => {
            console.error("Error deleting multiple characters:", event.target.error);
            reject(event.target.error);
        };
    });
}

async function loadCharactersFromDB() {
    if (!db) return;
    const transaction = db.transaction(['characters'], 'readonly');
    const store = transaction.objectStore('characters');
    const allCharactersArray = await new Promise((resolve, reject) => {
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = (event) => reject(event.target.error);
    });

    characters = allCharactersArray.reduce((obj, char) => {
        obj[char.id] = char;
        return obj;
    }, {});
}

async function savePersonasToDB() {
    if (!db) return;
    const transaction = db.transaction(['personas'], 'readwrite');
    const store = transaction.objectStore('personas');

    store.clear();

    for (const persona of Object.values(personas)) {
        store.put(persona);
    }

    return new Promise((resolve, reject) => {
        transaction.oncomplete = () => resolve();
        transaction.onerror = (event) => reject(event.target.error);
    });
}

async function loadPersonasFromDB() {
    if (!db) return;
    const transaction = db.transaction(['personas'], 'readonly');
    const store = transaction.objectStore('personas');
    const allPersonasArray = await new Promise((resolve, reject) => {
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = (event) => reject(event.target.error);
    });

    personas = allPersonasArray.reduce((obj, persona) => {
        obj[persona.id] = persona;
        return obj;
    }, {});
}
