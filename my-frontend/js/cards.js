// =============================================================
// cards.js — character-card import helpers.
// extractDataFromPng: read embedded JSON from PNG tEXt chunks.
// sanitizeCardNotes: strip HTML / normalize creator notes.
// convertExternalCardToCCC: map external V2/PNG card -> internal character.
// Self-contained: only DOM + the helpers in this file. No app state.
// =============================================================

function extractDataFromPng(arrayBuffer) {
    const dataView = new DataView(arrayBuffer);
    const pngSignature = [137, 80, 78, 71, 13, 10, 26, 10];
    for (let i = 0; i < pngSignature.length; i++) {
        if (dataView.getUint8(i) !== pngSignature[i]) {
            console.error("Not a valid PNG file.");
            return null;
        }
    }

    let offset = 8;
    while (offset < dataView.byteLength) {
        const length = dataView.getUint32(offset);
        const type = String.fromCharCode(
            dataView.getUint8(offset + 4), 
            dataView.getUint8(offset + 5), 
            dataView.getUint8(offset + 6), 
            dataView.getUint8(offset + 7)
        );

        if (type === 'tEXt') {
            const textDecoder = new TextDecoder('utf-8');
            const chunkData = textDecoder.decode(new Uint8Array(arrayBuffer, offset + 8, length));
            
            if (chunkData.startsWith('chara\0')) {
                const payload = chunkData.substring(6);
try {
  return JSON.parse(payload);
} catch (_) {
  try {
    const binaryString = atob(payload);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
    const jsonString = new TextDecoder('utf-8').decode(bytes);
    return JSON.parse(jsonString);
  } catch (e) {
    console.error("Failed to decode or parse character data from PNG:", e);
    return null;
  }
}
            }
        }
        offset += 12 + length;
    }
    return null;
}



function sanitizeCardNotes(raw) {
  const str = String(raw || "");
  const imageUrlRegex = /https?:\/\/[^\s"'()<>]+?\.(?:png|jpe?g|gif|webp|svg)/gi;
  const imageUrls = Array.from(str.matchAll(imageUrlRegex)).map(m => m[0]);

  let cleaned = str
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "");

  cleaned = cleaned
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p\s*>/gi, "\n\n")
    .replace(/<\/div\s*>/gi, "\n")
    .replace(/<\/li\s*>/gi, "\n")
    .replace(/<li[^>]*>/gi, "- ")
    .replace(/<\/h[1-6]\s*>/gi, "\n")
    .replace(/<h[1-6][^>]*>/gi, "");

  cleaned = cleaned.replace(/<\/?[^>]+>/g, "");

  const ta = document.createElement("textarea");
  ta.innerHTML = cleaned;
  cleaned = ta.value;
  cleaned = cleaned.replace(/\r\n?/g, "\n"); 
  cleaned = cleaned
    .split("\n")
    .map(line => line.replace(/[ \t\f\v]+/g, " ").trimEnd()) 
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")   
    .trim();

  if (imageUrls.length) {
    const list = Array.from(new Set(imageUrls)).join("\n");
    cleaned = `${cleaned}${cleaned ? "\n\n" : ""}Image links:\n${list}`;
  }
  return cleaned;
}




function convertExternalCardToCCC(externalCard, imageBlob = null) {
  const data = externalCard.data || externalCard; 
  console.log('[IMPORT MAP]', {
    has_card_description: !!data.card_description,
    has_tagline: !!data.tagline,
    has_lore: !!data.lore,
    has_lorebook: !!data.lorebook,
    has_character_book: !!data.character_book,
    has_creator_notes: !!(data.creator_notes || data.card_notes || data.creator_note || data.notes)
  });
    const cardDescription = data.card_description || data.tagline || "";
    const allDescriptions = [
        cardDescription,
        "\n--- CHARACTER DESCRIPTION ---",
        data.personality || "",
        data.description || "",
        "\n--- EXAMPLE MESSAGES ---",
        data.mes_example || ""
    ].filter(s => s.trim() !== "").join("\n\n").trim();

    const cardNotes =
  data.card_notes ||
  data.creator_notes ||
  data.creator_note || 
  data.notes ||  
  "";
  const cleanCardNotes = sanitizeCardNotes(cardNotes);
const cardDescOrTagline = (data.card_description || data.tagline || "").trim();

const lorePieces = [];

if (typeof data.character_book === "string" && data.character_book.trim()) {
  lorePieces.push(data.character_book.trim());
}

if (data.character_book && Array.isArray(data.character_book.entries)) {
  data.character_book.entries.forEach((e) => {
    const keys = Array.isArray(e.keys) ? e.keys.join(", ") : (e.key || "");
    const val  = e.content || e.value || "";
    const entryText = [keys ? `[${keys}]` : "", val].filter(Boolean).join("\n").trim();
    if (entryText) lorePieces.push(entryText);
  });
}

if (typeof data.lorebook === "string" && data.lorebook.trim()) {
  lorePieces.push(data.lorebook.trim());
}
if (typeof data.lore === "string" && data.lore.trim()) {
  lorePieces.push(data.lore.trim());
}
if (typeof data.world_scenario === "string" && data.world_scenario.trim()) {
  lorePieces.push(data.world_scenario.trim());
}

const filteredLorePieces = lorePieces.filter(p => p.trim() && p.trim() !== cardDescOrTagline);

const allLore = [
  ...filteredLorePieces,
  cleanCardNotes ? `\n\n--- CARD NOTES ---\n${cleanCardNotes}` : ""
].filter(s => s.trim() !== "").join("\n\n").trim();


    const allScenarios = [];
    const mainScenarioText = [data.scenario || "", data.first_mes || ""].join("\n\n").trim();
    if (mainScenarioText) {
        allScenarios.push({ name: 'Main Greeting', text: mainScenarioText });
    }
    if (Array.isArray(data.alternate_greetings)) {
        data.alternate_greetings.forEach((greeting, index) => {
            if (typeof greeting === 'string' && greeting.trim() !== '') {
                allScenarios.push({
                    name: `Alternate Greeting ${index + 1}`,
                    text: greeting.trim()
                });
            }
        });
    }

    const newChar = {
        id: 'char-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9),
        name: data.name || 'Unnamed Import',
        avatar: imageBlob || data.avatar || "",
        background: '',
        description: allDescriptions,
        lore: allLore,
        tags: (Array.isArray(data.tags) ? data.tags.join(', ') : ''),
        instructions: data.system_prompt || '',
        reminder: data.post_history_instructions || '',
        narratorReminder: '',
        scenarios: allScenarios,
        chats: {}
    };
    return newChar;
}
