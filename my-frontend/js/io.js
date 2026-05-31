// =============================================================
// io.js — data import/export (backup JSON + external character
// cards). handleExport / handleFileImport. Depend on globals
// resolved at call time (cards.js helpers, storage, dialogs,
// renderCharacterList, DOM refs).
// =============================================================

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
