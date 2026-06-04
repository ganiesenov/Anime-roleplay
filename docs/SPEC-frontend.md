# Isekai — Frontend Behavioral Specification (clean-room)

This document describes the **behavior and external contracts** of the Isekai
roleplay-chat web frontend. It is written for an implementer who will build the
JavaScript layer **from scratch**, having never seen the previous source.

The implementer has **full freedom** over JS architecture, module layout,
function names, and internal logic. The implementer must honor only the
**external contracts** listed below, because they cross the boundary into
files/systems that are NOT being rebuilt.

---

## 1. What the app is

A single-page, vanilla-JavaScript web app (no framework, no bundler) served by a
local FastAPI backend. The browser talks only to that backend. The app lets a
user create AI roleplay characters and chat with them, with streaming replies, a
character/world editor, personas, group chats, per-character visual effects and
music, import/export of character cards, and a guided first-run tutorial.

The page (`index.html`) and the stylesheets (`style.css`, `emerald-theme.css`)
are **kept as-is** and define the DOM the JS must drive. The JS currently loads
as a series of plain `<script>` tags sharing one global scope; the implementer
MAY replace that with its own module structure as long as it updates the
`<script>` wiring in `index.html` accordingly.

---

## 2. EXTERNAL CONTRACTS (must match exactly)

### 2.1 DOM contract
The JS must read/drive the element ids already present in `index.html`
(≈180 ids). Authoritative source = `index.html`. Treat every `id="…"` there as a
fixed handle. Key clusters: app loader (`app-loader*`), three top-level screens
`#character-selection-screen` / `#chat-list-screen` / `#chat-screen` (shown/hidden
via the `is-inactive` class, NOT `hidden`), chat composer (`#message-input`,
`#chat-form`, `#dialog-btn`), editor modal (`#character-editor-modal`,
`#character-form`, fields `#char-*`), app settings modal (`#app-settings-modal`,
sections `#section-ai/-design/-features`), model lists (`#model-select`,
`#model-list-container`, `#ollama-models-list`, `#openrouter-*`), particle picker
(`#particle-canvas`, `#particle-*`), music (`#music-*`), mood (`#mood-*`), reply
options (`#reply-options-dropdown`, `#reply-opt-1/2`), personas (`#persona-*`),
groups (`#participant-*`, `#group-char-*`), quick-swap (`#quick-swap-*`),
scenarios (`#scenario-*`), memories (`#chat-memories-*`).

### 2.2 Backend API contract
- `GET /api/health` — backend up + Ollama model discovery (used by the Ollama
  provider UI). Returns model availability info.
- `GET /api/ollama/models` — exists but is intentionally not the primary
  discovery path; `/api/health` is preferred.
- `GET /api/v1/models` — OpenAI-compatible model list.
- `POST /api/v1/chat/completions` — OpenAI-compatible chat, **streaming (SSE)**.
  Request body: `{ model, messages:[{role,content}], temperature, top_p:0.95,
  stream:true, character_id, chat_id, options:{num_ctx} }`. The custom
  `character_id` / `chat_id` fields let the backend mirror the chat to
  `data/chats/<character_id>/<chat_id>.json` for the restore feature. SSE chunks
  carry `choices[0].delta.content` and optionally `choices[0].delta.reasoning`.
- `GET /api/chats` and `GET /api/chats/<character_id>/<chat_id>` — list and fetch
  server-side chat backups (restore feature; "never clobber fresher local").
- `GET /api/yt-audio?url=…` — backend yt-dlp proxy returning playable audio for a
  YouTube URL.
- Default endpoint when a model has no explicit provider URL:
  `http://127.0.0.1:8000/v1/chat/completions`. Non-local providers use
  `Authorization: Bearer <apiKey>`; OpenRouter additionally sends `HTTP-Referer`
  and `X-Title` headers.

### 2.3 Persistence contract
- **IndexedDB** database `CasualCharacterChatDB`, version 3, object stores:
  `characters` (keyPath `id`), `personas` (keyPath `id`), `settings`
  (keyPath `key`). Keeping this name/schema preserves users' existing data.
  *(If a rename is desired later, it needs a migration; default = keep.)*
- **localStorage** keys: `activeCharacterId`, `activeChatId`,
  `chatScrollPos:<characterId>:<chatId>`, `userMusicUrl:<characterId>`,
  `tutorialCompleted`.

### 2.4 Data model (must round-trip existing stored data)
- **Character**: `id ("char-<ms>")`, `name`, `chatName`, `avatar`, `background`,
  `description`, `lore` (freeform world-lore string — NOT structured entries),
  `instructions`, `reminder`, `narratorReminder`, `tags` (comma-separated
  **string**, not array), `musicUrl`, `scenarios` (`[{name,text}]`), `type`,
  `characterIds` (for world/group membership), `chats`, `isFavorite`,
  `isArchived`, `particleEffect`, `particleIntensityLevel`.
- **Chat** (nested inside a character record, NOT a separate store):
  `id ("chat-<ms>")`, `name`, `history` (message array), `participants`
  (`[charId,...]`, index 0 = host), `activePersonaId`, `memories` (string).
- **Message**: user → `{ id, sender:"user", main:string }`; AI →
  `{ id, sender:"ai", type, speakerId, activeVariant, variations:[{main, think?}],
  isStreaming }`. **Invariant: user text in `message.main`; AI text in
  `variations[activeVariant].main` (+ optional `.think`).**
- **Persona**: `{ id, name, avatar, description }`.
- **Settings**: design controls each persist as one `{key,value}` row; the App
  Settings modal persists a single `appSettings` row `{ apiKey, availableModels }`.

### 2.5 Starter pack contract
`starter_pack_data.js` is **kept as-is** and exposes a global with an array of
seed character objects (same Character shape as 2.4). On first run (empty DB) the
app seeds these. The implementer consumes this global; it does not rebuild it.

### 2.6 Live-apply settings contract (CSS custom properties on `:root`)
Settings apply live by setting CSS variables on `:root`:
`--chat-font-size`, `--message-spacing`, `--main-text-color`, `--dialogue-color`,
`--user-bubble-color` / `--ai-bubble-color` (composed `rgba()` from color +
opacity), `--message-blur`, `--ai-avatar-size`, `--ai-placeholder-icon-size`,
plus runtime boolean flags (sound / think / reply-options / TTS). The CSS already
consumes these variables, so the implementer must write the same variable names.

---

## 3. Behavioral specification

The detailed, area-by-area behavior follows in the sections below
(home & navigation, chat core, characters/cards/import-export, settings & editor,
and ai-gen/effects/media/personas/groups/dialogs). These describe WHAT each
feature does and WHEN — the implementer chooses HOW.


---

## 3.1 — App init, navigation & home

# Behavioral Specification — App Core, Navigation, Home Page, Tutorial

Scope: the application bootstrap, top-level event wiring, screen/view model and navigation,
the Netflix-style home page (shelves, categories, tags, search, sort, pagination), the navbar/landing
header, and the guided tutorial. This is a *clean-room behavioral* spec: it describes WHAT happens and
the cross-module interop CONTRACT (shared names, DOM ids, observable flows), not the original code.

The original ships as a set of plain `<script>` tags sharing one global scope (no modules/bundler).
`main.js` is loaded near-last; it owns DOM element lookup, all top-level event wiring, and the bootstrap.
Domain logic lives in sibling scripts (state, utils, ui-helpers, storage, dialogs, cards, characters,
personas, groups, chat, settings, editor, tutorial, io, effects, media, ai-gen). A reimplementation may
restructure internally but MUST preserve the shared names and DOM contract listed below, because the
scripts call each other by bare global name.

---

## 1. Script-load order & interop contract

The page loads, in order: a starter-pack data script (defining an optional global `STARTER_PACK_DATA`),
then the domain scripts, then the app-core script, then effects/media/ai-gen, then a tiny inline script
that fades out and removes the loader overlay. Any reimplementation that keeps the multi-script model
must keep the app-core wiring loaded AFTER the domain scripts (it references their functions at parse time)
but the bootstrap call may run after everything because the dependent files define the named functions
in global scope.

### 1.1 Shared globals the modules depend on (interop contract)

These names are referenced across files and form the contract. Group by role:

**Mutable state (declared in the state module, read/written everywhere):**
- `characters` — object map keyed by character id; each character has at least:
  `id`, `name`, `avatar`, `background`, `type` (`'character'` | `'world'`), `tags` (comma-separated string),
  `description`, `lore`, `isFavorite` (bool), `isArchived` (bool), `scenarios` (array of `{name,text}`),
  `characterIds` (for world cards), and `chats` (object map of chatId → chat).
  A chat has `name`, `history` (array of messages), `participants` (array of char ids), `activePersonaId`,
  `memories` (string), `mood` (string|null). A message has `id`, `sender` (`'user'`|`'ai'`|narrator),
  and either `main` (user) or `variations[]` with `activeVariant` index (ai), each variation having `main`.
- `personas` — object map keyed by persona id; persona has `name`, `avatar`, `description`.
- `currentCharacterId`, `currentChatId` — currently open character/chat (null when none).
- `activeGroupParticipantId` — which group member the next message is "spoken as".
- `pendingReplyOptions`, `replyOptionsLoading`, `replyOptionsEnabled`, `replyOptionsReqId` — reply-suggestion state.
- `currentStreamController` — `AbortController` for the in-flight AI stream (or null).
- `tempUploadedImages` — staging object for editor image uploads with keys
  `avatar`/`avatarOriginal`, `background`/`backgroundOriginal`, `personaAvatar`/`personaAvatarOriginal`.
- `worldCharSelectedIds` — `Set` of character ids chosen for a World card.
- `audioCtx` — lazily created `AudioContext`.
- Home-browse state: `sortMode`, `activeCategory`, `activeTag`, `browseFilter` (`'all'`|`'favorites'`),
  `currentPage`, `PAGE_SIZE`, `_lastFilterSig`, plus a force-grid flag.
- `defaultSettings` — default UI/AI settings map (keys enumerated in §6).
- `db` — open IndexedDB handle; `window._musicFeatureReady` gates music teardown.

**Functions other modules call (must exist by these names):**
- Navigation: `showMainScreen()`, `showCharacterSelection()`, `showChatList(charId)`,
  `startChat(charId, chatId)`, `restoreLastSession()`.
- Home rendering: `renderCharacterList(searchTerm='')`, `renderShelves(all)`, `renderCategoryBar()`,
  `renderTagBar()`, `renderPagination(totalPages)`, `setBrowseFilter(filter)`, `buildCharacterCard(char)`,
  `adjustCardImageFit()`.
- Storage: `openDB()`, `loadCharactersFromDB()`, `loadPersonasFromDB()`, `loadAppSettingsFromDB()`,
  `saveCharactersToDB()`, `savePersonasToDB()`, `saveSingleCharacterToDB(char)`,
  `deleteSingleCharacterFromDB(id)`, `saveSettingToDB(key,value)`.
- Settings: `applySetting(key,value)`, `loadAndApplySettings()`, `loadAndApplySettingsFromDB()`,
  `populateModelSelector()`, `saveAppSettings()`, `resetAppSettings()`, `createModelEntry()`,
  `enforceResponsiveSettingLimits()`, `restoreChatsFromServer({silent})`.
- Chat ops: `handleChatSubmit(mode)` (mode `'dialog'`|`'story'`), `handleRegenerate(id)`,
  `handleContinue(id)`, `createNewChat(scenarioText?, scenarioName?)`, `updateTokenCount()`,
  `updateSingleMessageView(id)`, `openChatMemoriesModal()`, `closeChatMemoriesModal()`, `saveChatMemories()`.
- Groups/personas: `openParticipantModal(filter?)`, `addParticipantToChat(id)`, `renderParticipantIcons()`,
  `showGroupCharDropdown()`, `hideGroupCharDropdown()`, `setActiveGroupParticipant(id)`,
  `clearActiveGroupParticipant()`, `openPersonaSelectionModal(filter?)`, `setActivePersonaForChat(id)`,
  `openPersonaListModal(filter?)`, `openPersonaEditor(id?)`, `handlePersonaFormSubmit(e)`,
  `handleDeletePersona(id)`, `setActivePersonaForChat`.
- Editor: `openEditorForNew()`, `openEditorForEdit()`, `handleCopyCharacter()`, `closeEditor()`,
  `handleFormSubmit(e)`, `updateEditorForType(type)`, `createScenarioInput(text)`,
  `handleAIGenerateScenario()`, `updateEditorTokenCount()`, `updatePersonaEditorTokenCount()`,
  `openBulkCharacterDeleteModal()`.
- Reply suggestions: `generateReplyOptionsInBackground()`, `showReplyOptionsDropdown()`,
  `hideReplyOptionsDropdown()`.
- IO: `handleExport()`, `handleFileImport(e)`, `showChoiceDialog(msg, options)`.
- Effects/media: `stopParticles()`, `stopMusic()`, `loadStarterPack()` (defined in app-core).
- Dialogs: `showCustomAlert(msg)`, `showCustomConfirm(msg, danger?)`, `showCustomPrompt(msg, default?)`,
  `showToast(text)`.
- Utils/UI: `imageFileToWebp(file, quality)`, `getImageUrl(src)`, `smartObjectFit(img)`,
  `smartObjectFitAll(selector)`, `autoResizeTextarea(e?)`, `adjustFontSizeToFit(el)`,
  `handleTextareaEnter(e)`, `freezeLayout()`/`unfreezeLayout()`.
- Tutorial: `tutorialInit()`, `tutorialOnScreenChange(screenName)` — called from navigation functions.
- `window.App` — a near-empty namespace object created defensively (`window.App = window.App || {}`).

A reimplementer who keeps the global-script architecture must preserve these names. If migrating to
modules, every cross-call above becomes an explicit import boundary.

---

## 2. Startup sequence (observable behavior)

On load, document body opacity is forced to 1 (visible). A full-screen loader overlay (`#app-loader`,
showing the brand "Isekai", a spinner, and "Loading…") is present in markup and is faded out then removed
by the trailing inline script once parsing finishes.

The bootstrap (call it the init routine) runs and performs, IN THIS ORDER:

1. Open the database (`openDB()`); await it.
2. In parallel (await all): load characters, load personas, load app settings from DB.
3. Populate the AI model `<select>` dropdowns from app settings.
4. Apply persisted UI settings (theme colors, font size, slider values, toggles) to the DOM.
5. If no characters exist at all, load the starter pack (see §2.1).
6. Enforce responsive setting limits (clamp font/avatar-size maxima on mobile viewports).
7. Render the home character list (`renderCharacterList()`), which builds the home view.
8. Restore the last session (`restoreLastSession()`) — see §3.3.
9. Initialize the tutorial (`tutorialInit()`).
10. Fire-and-forget, non-blocking, silent: pull server-side chat backups
    (`restoreChatsFromServer({silent:true})`), errors swallowed. Only surfaces if it actually restored data.

If any step in 1–7 throws, the catch shows an alert: "Could not load database. Please check browser
permissions or try clearing site data." and logs to console.

### 2.1 Starter pack
On first launch (zero characters), load starter data from the global `STARTER_PACK_DATA` if defined,
else fetch `starter_pack_data.json`. Merge its `characters` into `characters` and persist; if it carries
`appSettings`, write them to the settings store under key `appSettings`; merge its `personas` and persist.
Failures are caught and warned, not fatal.

---

## 3. Screen / view model

There are THREE primary full-screen "screens" plus a stars/parallax background and many modal overlays.
Screens are mutually exclusive sibling containers toggled by an `is-inactive` class AND a `pointer-events`
inline style. A screen is "active" when it does NOT have `is-inactive` and has `pointerEvents:'auto'`.

| Screen | Container id | Role |
|---|---|---|
| Landing / Home / Browse | `#character-selection-screen` | Navbar + hero + browse home with shelves/grid |
| Chat list ("dashboard") | `#chat-list-screen` | One character's saved chats + edit/copy/delete |
| Chat | `#chat-screen` | The conversation UI, tools, settings panel, composer |

Decorative `#stars-container` (3 layered star fields) sits behind everything; its `visible` class is toggled
per screen, and its `pointerEvents` is forced to `'none'`.

### 3.1 Initial visibility
At parse time, the chat-list and chat screens get `is-inactive`; the selection screen is interactive.
Pointer-events: selection=auto, chat-list=none, chat=none, stars=none.

### 3.2 Navigation transitions (the contract for each function)

- **`showChatList(charId)`** — sets `currentCharacterId`, persists it to localStorage `activeCharacterId`,
  clears `activeChatId`. Activates `#chat-list-screen`, deactivates the other two (via `is-inactive` +
  pointer-events). Calls `tutorialOnScreenChange('chat-list')`. Renders the character's background image
  (or shows stars if none), the dashboard avatar/name (world cards use the background image and a 🌍
  placeholder; characters use avatar and 👤), and the list of saved chats sorted by id descending — each
  row has a name (click → `startChat`), a Rename button, a Delete button. Empty state: "No chats yet."
  Scrolls list to top when switching characters. Uses `freezeLayout`/`unfreezeLayout` around the swap.

- **`startChat(charId, chatId)`** — sets both `currentCharacterId`/`currentChatId`, persists both to
  localStorage. Clears active group participant, resets reply options. Activates `#chat-screen`,
  deactivates the others, calls `tutorialOnScreenChange('chat')`. Back-fills missing chat fields
  (`participants` defaulting to `[charId]`, `activePersonaId`→null, `memories`→''). Sets the chat header
  avatar/name, toggles the `#chat-world-badge`, shows the persona button. (Message rendering, particles,
  music, etc. are downstream concerns in the chat module.)

- **`showMainScreen()`** — back to landing/home. Deactivates chat-list and chat, activates selection,
  shows stars (transition suppressed then restored), nulls `currentCharacterId`, removes
  `activeCharacterId`/`activeChatId` from localStorage. (Bound to "Back to Main Menu".)

- **`showCharacterSelection()`** — "back" from chat to the chat list. Stops particles, stops music (if the
  music feature is ready), cancels speech synthesis, force-reflows the chat window, deactivates the chat
  screen, hides the chat settings panel, then re-opens the chat list for the last active character if it
  still exists, else lands on the selection screen. Clears `currentChatId` and `activeChatId`.
  (Bound to "Back to Chat List".)

### 3.3 Session restore
`restoreLastSession()` reads localStorage `activeCharacterId`/`activeChatId`. If both exist and resolve
to a real chat → `startChat`. Else if only the character resolves → `showChatList`. Else → show the
selection screen and reveal the stars (transition suppressed for one tick to avoid a flash).

Per-chat scroll position is persisted under key `chatScrollPos:<charId>:<chatId>` (fallback `chatScrollPos`)
as the chat window scrolls.

---

## 4. Home page (landing/browse) layout & behavior

The selection screen is the landing page. Top to bottom:

1. **Navbar `header.main-header`** (always visible on this screen) — left group: brand `.brand-logo`
   ("Isekai"), `#new-character-btn` (Create), `#manage-personas-btn` (Personas), `#app-settings-btn`
   (global AI/model Settings). Right group `.header-menu`: `#import-btn`, `#export-btn`,
   `#help-btn` (anchor to `help.html`, carries a notification dot `#help-notification-dot` and tooltip
   `#help-tooltip`), `#privacy-btn` (anchor to privacy page).
2. **Hero `#hero-section`** — static marketing headline + subtitle.
3. **Category bar** `#category-bar-container` → `#category-bar` — curated chips (§4.1).
4. **Tag bar** `#tag-bar-container` → `#tag-bar` — chips derived from characters' tags (§4.2).
5. **Browse bar** `#browse-bar` — Home/Favorites tabs (`.browse-tab[data-filter]`), a sort `<select>`
   `#sort-select` (Recent/Popular/Most messages/Newest/By name), and a live count badge `#char-count-badge`.
6. **Search** `#search-bar-container` → `#search-input` (placeholder "Search characters or tags…").
7. **Favorites bar** `#favorites-bar-container` → `#favorites-bar` (avatar pills of favorited chars).
8. **Shelves** `#shelves-container` — Netflix-style rows (home/browsing mode only).
9. **Grid** `#character-list` (filtered/searched results mode) + `#pagination-bar`.
10. **Bulk-actions bar** `#bulk-actions-bar` → `#bulk-delete-btn` (delete multiple characters).
11. **Archive** `#archive-section` (`hidden` unless archived chars exist) → header with
    `#archive-toggle-btn` and collapsible `#archive-content` → `#archived-character-list`.
12. `#copyright-notice`.

### 4.1 Categories (curated, fixed)
A fixed list of categories, each with a key, label, line-icon, and keyword set:
All (no key), Anime, Superheroes ("hero"), K-pop, Music, Movies, Games, OC. A character matches a category
when the lowercased haystack of `name + " " + tags` contains any of that category's keywords (the "All"
category matches everything). The category bar renders one chip per category; clicking a chip toggles
`activeCategory` (clicking the active one clears it), then re-renders the list and the bar (active chip
highlighted). Categories are derived from this static set — NOT from data — so they work even on untagged
characters.

### 4.2 Tags (data-derived)
The tag bar is built from the union of all tags actually present across characters (tags stored as a
comma-separated string per character). Tags are counted and sorted by descending frequency; each chip
shows `#tag` and a count. Clicking toggles `activeTag` (a lowercased single tag) and re-renders the grid.
Empty state: a hint that tagging characters will populate the strip.

### 4.3 Search
A single unified search box (`#search-input`) matches its trimmed, lowercased query against `name + tags`.
Typing re-renders the list. (A legacy `#tag-search-input` may be guarded for if present.) Any non-empty
search forces the results grid (not shelves).

### 4.4 Sort
`#sort-select` drives `sortMode`: `recent` (last-activity timestamp desc), `popular` (chat count desc then
message count), `messages` (total messages desc), `new` (created timestamp desc), `name` (locale name).
All non-name modes tie-break by name. Changing sort re-renders.

### 4.5 Home vs. results mode (the key branch)
`renderCharacterList()` decides between two layouts:
- **Home (shelves) mode** when: browse tab = "all" AND no search query AND no active tag AND no active
  category AND not force-grid. Shows `#shelves-container`, hides `#character-list`, hides the archive,
  clears pagination, and renders shelves over the non-archived characters; the count badge shows the live
  (non-archived) character count.
- **Results (grid) mode** otherwise. Hides shelves, shows the grid. Filters by query, active tag,
  favorites tab, and active category (ANDed), sorts, paginates the non-archived set with `PAGE_SIZE`,
  always renders archived matches in full into the archive list (revealing the archive section if any).
  Empty states distinguish "no characters at all" (prompt to Create) from "nothing matched" (prompt to
  reset filters).

### 4.6 Shelves (Netflix-style rows)
Built by `renderShelves(all)` over the non-archived, name-sorted characters; each shelf caps at 20 cards.
Shelf order, when non-empty:
1. **Favorites** (chars with `isFavorite`) — "See all" jumps to the Favorites tab.
2. **Recently used** — chars with ≥1 chat, sorted by last-activity desc.
3. **One shelf per keyed category** (Anime, Superheroes, …) containing that category's matches; each has a
   "See all" that sets `activeCategory` and switches to the filtered grid.
4. **Recently added** — sorted by created timestamp desc.
5. **Everyone** — all chars; "See all" forces the flat grid.
Each shelf = title + count + optional "See all ▸" button + a horizontal `.shelf-track` of cards.
If there are zero characters, the shelves area shows a single empty-state card prompting Create.

### 4.7 Character cards
`buildCharacterCard(character)` produces the card used by BOTH shelves and grid. A card carries
`data-char-id`, a favorite star button (omitted for archived cards), an archive toggle button (up/down
chevron + title reflecting state), an image container (world cards use background + 🌍 placeholder and a
"World" badge + character-count badge; normal cards use avatar + 👤), a stats row (chat count, message
count), and a name container with auto-shrink-to-fit text. Clicking the card body (not the star/archive
buttons) opens that character's chat list (`showChatList`).

### 4.8 Favorites & archive interactions
- The grid's click handler toggles favorite/archive on the star/archive buttons. Toggling favorite updates
  the character, persists it, toggles the star's `is-favorite` class, and inserts/removes an avatar pill in
  `#favorites-bar` keeping it alphabetically ordered and restacking z-indices; empty bar shows
  "No Favorites selected".
- `toggleArchiveState(charId)` flips `isArchived` (archiving also clears favorite), persists, then moves the
  card between `#character-list` and `#archived-character-list` (inserted alphabetically), swaps the archive
  icon/title, adds/removes the favorite button, removes the favorites pill when archived, and shows/hides
  the archive section based on whether any archived cards remain.
- `#archive-toggle-btn` expands/collapses `#archive-content` (`collapsed` class) with an opacity fade and
  re-fits card name fonts on expand; button label toggles "Show Characters" / "Hide all".

### 4.9 Pagination
`renderPagination(totalPages)` renders a `‹` prev, a windowed set of page numbers (always 1, last,
current±1, with `…` gaps), and a `›` next, into `#pagination-bar`. Clicking a page sets `currentPage`,
re-renders, and smooth-scrolls the grid into view. Hidden when ≤1 page. `currentPage` resets to 1 whenever
the filter signature (query|tag|browseFilter|category|sort|forceGrid) changes.

---

## 5. Global event wiring (by control)

All of the following listeners are registered at startup. Grouped by area; each lists the id → effect.

**Landing/home:** `#new-character-btn`→open editor for new; `#manage-personas-btn`→open persona list modal
(clears its search); `#app-settings-btn`→load app settings then open `#app-settings-modal`;
`#import-btn`→choice dialog (Backup .json vs Character Card .png/.json) then trigger the hidden
`#file-importer`; `#export-btn`→export; `#search-input` input→re-render list; `#sort-select`→set sort;
`.browse-tab` click→set browse filter; category/tag chips wired on render; `#bulk-delete-btn`→bulk delete
modal; `#archive-toggle-btn`→expand/collapse archive; grid + archived-list click handlers→favorite/archive
toggles + open chat list.

**Chat-list screen:** `#back-to-main-btn`→`showMainScreen`; `#delete-character-btn-dashboard`→confirm then
delete current character (+ all chats), re-render, return to main; `#edit-character-btn`→open editor for
edit; `#copy-character-btn`→duplicate character; `#start-new-chat-btn`→if the character has scenarios, open
`#scenario-selection-modal` listing them (+ "Start empty Chat"), else create a new empty chat directly;
chat session rows→start/rename/delete chat.

**Chat screen composer & header:** `#dialog-btn` (submit)→`handleChatSubmit('dialog')`;
`#story-btn`→`handleChatSubmit('story')`; `#stop-stream-btn`→abort the active stream controller and reset
buttons/loading; `#message-input` input→auto-resize, keydown→Enter-to-send handling, focus/click→show the
group-character dropdown + reply-options dropdown and (if enabled and last message isn't from the user)
kick off background reply-option generation, blur→hide group dropdown after a short delay;
`#group-char-dropdown` mousedown→pick the group participant to speak as; `#group-char-bubble-dismiss`→clear
it; `#participant-icon-list` click→confirm-remove a group participant; `#add-participant-btn`→open the
participant selection modal (with live search via `#participant-search-input`);
`#select-persona-btn`→toggle: if a persona is active, confirm-unselect it; else open the persona selection
modal (live search via `#persona-search-input`); `#back-to-selection-btn`→`showCharacterSelection`.

**Chat header tools (defined here or in feature modules):** `#quick-swap-btn`→open quick-swap modal listing
other non-world characters (search via `#quick-swap-search-input`); selecting one MOVES the current chat
(history/memories/settings) to that character and re-opens it. `#mood-btn`→toggle `#mood-picker`; picking a
`.mood-option` sets `chat.mood`, updates the button emoji/title, persists; outside-click closes the picker.
`#chat-memories-btn`→open memories modal; memories textarea Enter-saves / Esc-closes / auto-resizes;
double-click outside saves. `#scroll-top-fab`→scroll chat to top; the fab appears after scrolling >400px.

**Chat window message actions** (delegated on `#chat-window`): double-click a message's main part opens the
message editor; click handlers on a message's buttons → regenerate, edit (open editor), delete (confirm:
deletes this message AND all following, snapshots for undo, shows an inline "↩ Undo Delete", regenerates
reply options), continue, prev/next variant. Keyboard (when chat screen active and not typing in a field):
ArrowLeft/ArrowRight cycle the last AI message's variants; ArrowRight past the last variant triggers a
regenerate.

**Message editor modal:** save button / Enter / double-click-outside → save-and-close; cancel → close and
drop the editing id.

**Settings panel (`#settings-btn`/`#settings-panel`):** toggles open; outside-click closes; accordion
headers open one section at a time. Each control is wired through a generic "setting listener" that, on
input/change, applies the setting live AND persists it (see §6). `#reset-settings-btn`→confirm then clear
all setting keys from localStorage, re-apply defaults, re-enforce responsive limits.

**App-settings modal:** form submit→save settings; cancel→scroll to top + close; `#add-model-btn`→add a model
entry row; `#reset-app-settings-btn`→reset; drag-reordering of model rows auto-scrolls the modal near its
top/bottom edges. Three modals (`#app-settings-modal`, `#persona-editor-modal`, `#persona-list-modal`)
swallow wheel events on their backdrop to prevent background scroll; the character editor modal implements
custom smooth (eased) wheel scrolling on its content.

**Editor wiring:** image upload buttons (`#upload-avatar-btn`, `#upload-bg-btn`,
`#upload-persona-avatar-btn`) open the shared hidden `#image-uploader`; on file pick, the image is converted
to WebP, staged into `tempUploadedImages`, and the corresponding URL input is set to an object URL and fires
input. Monitored editor fields update a live token counter and auto-resize textareas. Card-type radios
(`#type-character`/`#type-world`) switch the editor between character and world layouts (world resets the
selected-ids set). `#add-scenario-btn`/`#ai-scenario-btn` add or AI-generate scenarios; deleting a scenario
confirms first. Avatar/background URL inputs live-preview into the editor avatar and the chat-list-screen
background. Persona form submit/cancel and persona-list edit/delete buttons are wired.

**Persona management:** `#manage-personas-btn`, `#persona-list-search-input`, `#close-persona-list-btn`,
`#create-new-persona-btn`, `#cancel-persona-edit-btn`, `#persona-form` submit, and the persona list
container's delegated edit/delete clicks.

**Global/document-level:** first body click lazily creates the `AudioContext`; pressing `f` (when not typing)
toggles fullscreen, and a `fullscreenchange` handler toggles a `fullscreen-active` body class and dispatches
a resize; a hover handler positions a fixed global tooltip (`#global-setting-tooltip`) for any
`.setting-info-icon[data-tooltip]`; the Help button clears its first-run notification dot/tooltip and sets
localStorage `hasSeenHelpNotification`. The help dot/tooltip are shown on first load only (until that flag
is set).

---

## 6. Settings contract (live-apply + persist)

Each chat-design/AI/feature control is bound so that changing it immediately applies the value to the DOM
and writes it to the DB. Checkboxes persist as `'true'`/`'false'` strings; others persist their `.value`.
The keys (and their controls) include: `fontSize` (`#font-size-slider`), `temperature`
(`#temperature-slider`), `mainTextColor`, `dialogueColor`, `userBubbleColor`, `userBubbleOpacity`,
`aiBubbleColor`, `aiBubbleOpacity`, `messageSpacing` (`#spacing-slider`), `soundEnabled` (`#sound-toggle`),
`thinkEnabled` (`#think-toggle`), `replyOptionsEnabled` (`#reply-options-toggle`), `blur` (`#blur-slider`),
`avatarSize` (`#avatar-size-slider`), `model` (`#model-select`), `suggestionModelId`
(`#suggestion-model-select`), `replyLength` (`#reply-length-select`). Reset clears all
`defaultSettings` keys from localStorage and re-applies defaults.

**Responsive limits:** constants — mobile breakpoint 768px, mobile font-size max 24, mobile avatar-size max
180; desktop maxima read from the sliders' own `max`. A `matchMedia(max-width:768px)` listener and a window
`resize` listener call the limit-enforcer, which clamps the font-size and avatar-size slider maxima on
mobile and restores them on desktop.

---

## 7. Guided tutorial (first-run tour)

A spotlight-and-tooltip overlay tour, persisted as seen via localStorage key `tutorialCompleted`.

**Data:** an ordered list of steps. Each step has a `phase` (which screen it belongs to:
`character-selection` | `chat-list` | `chat`), a `targetId` (DOM id to spotlight, or null for a centered
welcome), a `position` (`center`|`top`|`bottom`|`left`|`right`), an indicator label, a title, body text, and
a next-button label. The steps (in order):
1. (selection, centered welcome) — "Welcome to Casual Character Chat!", next "Let's Go".
2. (selection, `#app-settings-btn`, bottom) — enter your API key first.
3. (selection, `#new-character-btn`, bottom) — create your first character.
4. (selection, `#manage-personas-btn`, bottom) — optional personas.
5. (chat-list, `#start-new-chat-btn`, top) — start a new conversation.
6. (chat-list, `#edit-character-btn`, top) — edit your character.
7. (chat, `#chat-form`, top) — type your message (Character vs Narrator).
8. (chat, `#settings-container`, bottom) — chat control panel. (Final step → completes.)

**DOM:** `#tutorial-backdrop` (dim layer, swallows clicks), `#tutorial-spotlight` (the highlighted cutout),
`#tutorial-tooltip` (with `#tutorial-step-indicator`, `#tutorial-title`, `#tutorial-text`,
`#tutorial-skip-btn`, `#tutorial-next-btn`).

**Behavior / contract:**
- `tutorialInit()` runs at startup; if the `tutorialCompleted` flag is set it does nothing. Otherwise it
  marks the tour active and shows the first step whose phase matches the currently active screen (so if the
  session was restored mid-chat, the tour starts at the chat-phase step; default is step 0).
- The "active phase" is derived from which screen container lacks `is-inactive` (selection → chat-list →
  chat). This couples the tutorial to the screen-visibility contract in §3.
- `tutorialShowStep(i)` — past the end → complete. If the step's phase ≠ the active screen, it records a
  "pending phase" and hides the UI, waiting for navigation. Otherwise it fills the tooltip text, activates
  backdrop/spotlight/tooltip, positions the spotlight over the target (with ~7px padding; null target →
  centered "welcome" spotlight), and positions the tooltip relative to the target per `position`, clamped to
  the viewport with margins (auto-flips top/bottom if it would overflow). Reveal is deferred one frame for
  the CSS transition.
- `tutorialOnScreenChange(screenName)` — called by `showChatList`/`startChat` (and could be by any nav). If
  the tour is active and `screenName` equals the pending phase, after a short delay it shows the first step
  of that phase. This is how the tour advances across screens: a phase-N step that needs a different screen
  parks until the user navigates there.
- `#tutorial-next-btn` advances to the next step; `#tutorial-skip-btn` completes immediately. Completing sets
  the `tutorialCompleted` flag and tears down the overlay (fade then clear inline styles/classes).
- A debounced window `resize` handler re-positions the active spotlight/tooltip (skipped while a phase is
  pending or the tour is inactive).

---

## 8. DOM id / class reference (load-bearing)

Screens: `#character-selection-screen`, `#chat-list-screen`, `#chat-screen`, `#stars-container`;
class `is-inactive` toggles activeness, `hidden` toggles modal/element visibility, `visible` reveals stars.
Home: `#category-bar`, `#tag-bar`, `#browse-bar`/`.browse-tab[data-filter]`, `#sort-select`,
`#char-count-badge`, `#search-input`, `#favorites-bar`, `#favorites-bar-container`, `#shelves-container`,
`#character-list`, `#pagination-bar`, `#bulk-delete-btn`, `#archive-section`, `#archive-toggle-btn`,
`#archive-content`, `#archived-character-list`. Card classes: `.character-card[data-char-id]`,
`.favorite-btn.is-favorite`, `.archive-btn`, `.card-image-container`, `.card-name-container`, `.card-stats`,
`.shelf`/`.shelf-head`/`.shelf-track`/`.shelf-seeall`, `.category-chip`, `.tag-chip`, `.page-btn`,
`.favorite-item`, `.favorites-placeholder`, `.grid-empty`.
Navbar: `#new-character-btn`, `#manage-personas-btn`, `#app-settings-btn`, `#import-btn`, `#export-btn`,
`#help-btn`/`#help-notification-dot`/`#help-tooltip`, `#privacy-btn`, `#file-importer`, `#image-uploader`.
Chat: `#chat-window`, `#chat-form`, `#message-input`, `#dialog-btn`, `#story-btn`, `#stop-stream-btn`,
`#chat-avatar`(+placeholder), `#chat-character-name`, `#chat-world-badge`, `#participant-icon-list`,
`#group-char-dropdown`/`#group-char-bubble`(+name/dismiss), `#settings-btn`/`#settings-panel`/
`#settings-container`, `#scroll-top-fab`, `#token-tooltip`, tool buttons `#quick-swap-btn`/`#mood-btn`/
`#mood-picker`(+`.mood-option[data-mood]`)/`#chat-memories-btn`/`#add-participant-btn`/`#select-persona-btn`.
Modals: `#character-editor-modal`(+content), `#message-editor-modal`, `#chat-memories-modal`,
`#scenario-selection-modal`, `#participant-selection-modal`, `#persona-selection-modal`,
`#persona-list-modal`, `#persona-editor-modal`, `#quick-swap-modal`, `#app-settings-modal`(+content),
`#particle-picker-modal`. Tutorial: ids per §7. Misc: `#app-loader`(+`fade-out`), `#global-setting-tooltip`,
body classes `fullscreen-active`.
localStorage keys: `activeCharacterId`, `activeChatId`, `chatScrollPos:<char>:<chat>`, `tutorialCompleted`,
`hasSeenHelpNotification`, plus every setting key in §6.

---

## Summary (10 lines)

1. Single global scope across plain `<script>` tags; app-core does DOM lookup, all event wiring, and the bootstrap; sibling files provide named globals (state, nav, render, storage, settings, chat, editor, tutorial).
2. Startup order: openDB → parallel load(characters, personas, appSettings) → populate model selects → apply settings → starter-pack if empty → enforce responsive limits → render home → restore last session → init tutorial → silent server backup pull; DB failure shows a single alert.
3. Three mutually-exclusive screens (`#character-selection-screen`, `#chat-list-screen`, `#chat-screen`) toggled by the `is-inactive` class + `pointer-events`; a stars layer sits behind; navigation functions `showMainScreen`/`showChatList`/`startChat`/`showCharacterSelection` are the contract.
4. Session is restored from localStorage `activeCharacterId`/`activeChatId` into chat, chat-list, or landing.
5. Home page has a navbar, hero, curated category chips (static keyword sets), data-derived tag chips, Home/Favorites tabs, a sort select, a unified name+tags search, a favorites pill bar, Netflix-style shelves, a paginated results grid, and a collapsible archive.
6. `renderCharacterList` branches: home/shelves mode (all-tab, no query/tag/category/force-grid) vs filtered results grid; shelves are Favorites, Recently used, per-category, Recently added, Everyone (cap 20, with See-all jumps).
7. Cards (`buildCharacterCard`) are shared by shelves and grid, carry favorite/archive buttons + stats, and open the chat list on click; favorite/archive toggles mutate state, persist, and re-flow the bars/lists.
8. Extensive chat-screen wiring: composer (Character/Narrator/stop-stream), message-level regenerate/edit/delete-with-undo/continue/variant-cycling, mood picker, memories modal, quick-swap, group participants, persona select, and an accordion settings panel that live-applies and persists each setting.
9. Settings persist to DB as strings (checkboxes as `'true'`/`'false'`); responsive limits clamp font/avatar maxima at the 768px breakpoint; reset clears all setting keys and re-applies defaults.
10. The first-run tutorial is a spotlight/tooltip tour of 8 phase-tagged steps across the three screens, advanced via Next/screen-change hooks (`tutorialOnScreenChange`) and dismissed via Skip/Done, persisted under localStorage `tutorialCompleted`.


---

## 3.2 — Chat core

# Behavioral Specification — Chat Core

Scope: the chat experience of the "Isekai" character-roleplay SPA. Covers the
chat-list → chat navigation, message rendering, the three streaming flows
(send / regenerate / continue), swipe/edit/delete, chat memories, reply
suggestions, mood, and restore-from-server. The chat core lives in `chat.js`;
several wiring/helper pieces it depends on live in sibling files (noted where
relevant). A reimplementer must match the *contracts* below (DOM ids, endpoint
shapes, data model) exactly; the logic descriptions are behavioral.

---

## 1. Three screens and navigation

The app has three full-screen "screens", toggled by adding/removing the
`is-inactive` class and flipping `style.pointerEvents`:

- `#character-selection-screen` — the home/grid (other files own its content).
- `#chat-list-screen` — per-character list of saved chats.
- `#chat-screen` — the active conversation.

`#stars-container` is an animated starfield shown (class `visible`) whenever a
screen has no background image.

**Show chat list (for a character):**
- Sets `currentCharacterId`, persists `localStorage['activeCharacterId']`,
  clears `localStorage['activeChatId']`.
- Fills `#chat-list-avatar` (img) + `#chat-list-avatar-container` (bg-image) or
  falls back to `#chat-list-avatar-placeholder` (👤, or 🌍 when the card
  `type === 'world'`). World cards use the card's `background` as the avatar.
- Sets `#chat-list-character-name`.
- Renders the saved-chat list into `#chat-session-list`. Each chat becomes a
  `.chat-session-entry` containing `.chat-session-name[data-chat-id]` (click →
  open that chat) plus `.rename-chat-btn[data-chat-id]` and
  `.delete-chat-btn[data-chat-id]`. Chats are sorted by chatId descending
  (newest first, because ids embed a timestamp). Empty state: "No chats yet."
- Applies the character background image to the screen.

**Back to main menu** (`#back-to-main-btn`): shows the home screen, clears
`activeCharacterId`/`activeChatId`. **Back to chat list** (`#back-to-selection-btn`).

**Rename chat:** prompts for a new name (custom prompt dialog), updates
`chat.name`, persists, re-renders the list.

**Delete chat:** custom-confirm, then `delete character.chats[chatId]`, persist,
re-render. (Note: this only removes the chat locally; server backup is untouched.)

---

## 2. Data model

### Character object (owned elsewhere, but read heavily here)
Relevant fields: `id`, `name`, `chatName` (in-chat display name; preferred over
`name` for prompts), `type` (`'character'` | `'world'`), `avatar`, `background`,
`description`, `lore`, `instructions`, `reminder`, `narratorReminder`,
`musicUrl`, `particleEffect`, `particleIntensityLevel`, `characterIds` (world →
member character ids), and `chats` (a map keyed by chatId).

### Chat object (`character.chats[chatId]`)
```
{
  id:             "chat-<epochMillis>",
  name:           string,            // display name
  history:        Message[],
  memories:       string,            // high-priority per-chat notes (may be '')
  participants:   string[],          // character ids in the scene; defaults to [charId]
  activePersonaId: string | null,
  mood:           string | null      // e.g. "Happy", "Flirty"; '' / null = none
}
```
Lazily backfilled on open: missing `participants` → `[charId]`, missing
`activePersonaId` → `null`, missing `memories` → `''`, missing `history` → `[]`.

### Message object
Two shapes by sender:

User message:
```
{ id: "msg-...", sender: "user", main: string }
```

AI message:
```
{
  id:             "msg-...",
  sender:         "ai",
  type:           "dialog" | "story",  // story = narrator turn
  speakerId:      string,              // which participant spoke (defaults to main char)
  variations:     [{ main: string, think: string|null }, ...],  // swipe alternatives
  activeVariant:  number,              // index into variations
  isStreaming?:   boolean,             // true while a token stream is live
  streamingVariant?: number|null       // which variant index is streaming
}
```
Key invariant: **user text lives in `message.main`; AI text lives in
`variations[activeVariant].main`** (plus an optional `.think`). All code that
reads message text must branch on `sender`.

Message ids: `'msg-' + Date.now() + '-' + random` (or `'msg-' + Date.now()` for
first/seed messages).

### Storage
- IndexedDB database `CasualCharacterChatDB`, version 3, object store
  `characters` (keyPath `id`). Also stores `personas` and `settings`. Chats are
  **not** a separate store — they are nested inside their character record.
  Saving one character (`saveSingleCharacterToDB`) persists all of its chats.
- localStorage keys touched by the chat core:
  - `activeCharacterId`, `activeChatId` — restore last location on reload.
  - `chatScrollPos:<charId>:<chatId>` — per-chat scroll position (saved on
    scroll, restored on open).
  - `userMusicUrl:<charId>` — per-character music override.

---

## 3. Opening / creating / switching chats

**Open a chat:**
- Cancels any in-flight reply-suggestion request, hides the suggestions
  dropdown, clears any active group participant.
- Sets `currentCharacterId`/`currentChatId` and persists both to localStorage.
- Backfills missing chat fields (see model above).
- Switches to `#chat-screen`; populates header: `#chat-character-name`,
  `#chat-avatar` / `#chat-avatar-placeholder` (👤 or 🌍 for worlds),
  `#chat-world-badge` (shown only for world cards), background image on
  `#chat-screen`.
- Clears `#chat-window` and renders every message in `history` in order.
- Renders participant icons (`#participant-icon-list`), updates token estimate,
  mood button, particle button; starts the character's ambient particle effect
  and background music if configured.
- Scroll behavior: if a "scroll to bottom next open" flag is set (after new
  chat / new message) it scrolls to bottom; otherwise it restores the saved
  `chatScrollPos:...` value.

**New chat:** Creates a chat with id `'chat-' + Date.now()`, a default name
`New Chat - <localeDate>, <localeTime>` (or `<scenarioName> - <date>, <time>`).
If seeded with an initial message it becomes the first AI message with
`type` = `'story'` for world cards, else `'dialog'`. For world cards,
`participants` = main world id + its member character ids; otherwise just the
main char id. Then opens the new chat (forcing scroll-to-bottom).

The "+ Start new Chat" button (`#start-new-chat-btn`) opens a scenario-selection
flow (modal `#scenario-selection-modal`, owned elsewhere) that ultimately calls
new-chat with a chosen scenario's opening line, or "Start empty Chat".

---

## 4. Message rendering

`#chat-window` is the scroll container; each message is rendered as a
`.message[data-message-id]` inside a wrapper.

- **User message:** wrapper `.user-message`. If the active persona has an
  avatar, the wrapper becomes `.user-message-container` with a
  `.message-avatar` element (persona image, placeholder 👤 on error); otherwise
  the bubble itself is the wrapper.
- **AI message:** wrapper `.ai-message-container`, bubble `.ai-message`; adds
  `.story-message` when `type === 'story'`. For non-story turns a speaker
  `.message-avatar` (speaker character's avatar / 👤) is prepended. World/story
  turns get no avatar.
- **Think block:** an optional `<details class="think-block">` with
  `<summary class="think-block-summary">Show Thoughts</summary>` and
  `.think-block-content`. Rendered before the main content. Content is shown as
  literal `&lt;think&gt;<br>…<br>&lt;/think&gt;`. Hidden (`hidden` class) when
  there is no think text.
- **Main content:** `.main-content[data-edit-part="main"]`, HTML produced by a
  shared rich-text formatter (`formatSubString`, in utils.js — handles
  *italics*, "quoted dialogue", line breaks, etc.). While streaming with
  placeholder `'...'`, shows an animated typing indicator (`.typing-dots` with
  three `.typing-dot`) via a "bubble loading" helper.
- **Action group** `.message-action-group` (per message): `.delete-message-btn`,
  `.edit-message-btn`, and for AI messages, when the browser supports
  `speechSynthesis`, a `.tts-btn` (🔊) that toggles read-aloud.
- **AI controls** `.message-controls`: when `variations.length > 1`, a swipe
  group `.prev-variant-btn` ‹ / `.variant-counter` (`"i/N"`) / `.next-variant-btn` ›
  (prev disabled at index 0, next disabled at last). Always a `.regenerate-btn`
  and `.continue-btn`. During streaming the controls carry `.is-streaming` and
  the message carries `.msg-streaming`; regen/continue buttons are disabled.

`updateSingleMessageView(messageId)` re-renders one bubble's main/think/controls
from the model without rebuilding the whole list (used by swipe, edit, retry
status messages). It re-sanitizes text and updates the swipe counter/disabled
states.

### Output sanitization
All model text passes through a sanitizer that strips C0/C1 control chars
(keeping tab/newline/CR) and known LLM special tokens (`<|im_start|>`,
`<|im_end|>`, `<|begin_of_text|>`, `<|end_of_text|>`, `<|eot_id|>`,
`<|endoftext|>`, `<|start_header_id|>…<|end_header_id|>`). A separate helper
strips stray `<think>`/`</think>` tags.

### Typewriter
A small typewriter utility reveals text a few characters per animation frame
(`requestAnimationFrame`), used during streaming so tokens appear smoothly
rather than in raw network chunks. `flush()` jumps to the final text instantly.

---

## 5. Sending a message (the primary stream)

Triggered by the chat form `#chat-form`: `#dialog-btn` (💬 Character → `type`
`'dialog'`) and `#story-btn` (📖 Narrator → `type` `'story'`). Input is
`#message-input` (auto-resizing textarea). `#stop-stream-btn` aborts.

**Flow:**
1. Hide undo-FAB and reply-suggestions dropdown; read + clear the input.
2. If a group participant is selected (`#group-char-bubble`), the reply targets
   that participant (`targetCharId`); otherwise the main character.
3. If the user typed text: append a user message to history and render it, then
   build the API history from all prior turns. If the input was empty: this is a
   "let the AI go" turn — if history is empty, send a canned "Introduce
   yourself…and start the roleplay…" seed; otherwise re-prompt off the last turn
   (with a "continue the scene with new content, don't repeat" nudge when the
   last turn was the AI's).
4. Push a placeholder AI message (`variations[0].main === '...'`,
   `isStreaming: true`, `speakerId: targetCharId`), render it (typing dots),
   persist, disable send buttons, show `#loading-indicator` and the stop button.
5. Two safety timers update the bubble text if nothing arrives: at 20s →
   "Connecting to AI Model - Please wait or regenerate the message.", at 70s →
   "The AI provider may be experiencing issues …".
6. Build the system prompt (see §6), assemble the request, and stream (see §8).
7. On success: finalize the message variant (split think vs main), play a
   notification sound (if enabled), update the token estimate, optionally TTS the
   reply, then kick off background reply-suggestion generation.

Retry loop: up to **90 attempts**. HTTP 429 → wait 1s and retry (after 20s of
retries it surfaces a "rate-limited, please wait" message in the bubble). Empty
responses retry. "Failed to fetch" / "maximum capacity" errors retry; other
errors stop with a user-facing error message in the bubble.

Abort: if the user stops before any content arrived, the empty AI bubble is
removed from history and DOM. If content had arrived, it's kept as-is.

---

## 6. System prompt assembly (sent as the `system` message)

Built per request as a single string from labeled `--- SECTION ---` blocks, in
this order (sections omitted when empty):

1. `--- GLOBAL AI INSTRUCTIONS ---` (from the selected model's `instructions`).
2. `--- EXACT USER PERSONA ---` (active persona name + description).
3. World branch (when the main card is `type === 'world'`):
   `--- WORLD CONTEXT ---`, `--- WORLD LORE & HISTORY ---`,
   `--- WORLD RULES (CRITICAL …) ---`, then either a third-person-narrator
   meta-instruction + `--- CHARACTERS IN THIS WORLD ---`, or (when addressing one
   member directly) a "respond only as '<name>'" meta-instruction plus that
   character's instructions/description/lore.
   Story branch (non-world, narrator turn): narrator meta-instruction +
   `--- CHARACTERS IN SCENE ---` + `--- LORE / BACKGROUND KNOWLEDGE ---`.
   Dialog branch (non-world): optional `--- CHARACTERS IN SCENE ---` for groups,
   optional "respond only as '<name>'" when targeting a group member, then
   `--- CHARACTER AI INSTRUCTIONS ---`, `--- CHARACTER DESCRIPTION ---`,
   `--- LORE / BACKGROUND KNOWLEDGE ---`.
4. `--- CHARACTER CURRENT MOOD (IMPORTANT) ---` when `chat.mood` is set.
5. `--- CHAT MEMORIES (HIGH PRIORITY …) ---` when `chat.memories` is non-empty.
6. `--- REPLY LENGTH ---` directive driven by the global `replyLength` setting:
   short=3–4, medium=6–7, long=9–10, verylong=12–13 sentences (default omits).

Placeholders `{{char}}` and `{{user}}` are expanded everywhere via
`applyCharPlaceholder` / `applyUserPlaceholder` (using the in-chat character name
and the active persona name, defaulting to "User").

**Reminders & the mood directive on the user turn.** Separately from the system
prompt, the *last user message* content is augmented:
- A combined reminder (global model reminder + character reminder; narrator
  variants for story turns) is appended in brackets:
  `\n[<reminderContent>]`.
- The **mood directive** is appended after that when `chat.mood` is set — a
  strong, bracketed `[MOOD — TOP PRIORITY: right now <char> is feeling <mood>…]`
  instruction telling the model to make the emotion unmistakable in this reply.
  So the final user content is: `<message>\n[<reminder>]<moodDirective>`.

For multi-participant chats, each history turn is prefixed with the speaker name
(`"<Name>: <text>"`) so the model can tell who said what; single-char chats omit
the prefix.

---

## 7. Streaming request contract

**Endpoint:** `POST` to the target chat-completions URL.
- Default backend: `DEFAULT_API_URL = "http://127.0.0.1:8000/v1/chat/completions"`
  (the SPA is served by this backend). A per-model `targetApiUrl` overrides it
  (e.g. OpenRouter `https://openrouter.ai/api/v1/chat/completions`).
- Headers: always `Content-Type: application/json`. For non-local URLs also
  `Authorization: Bearer <apiKey>` (model-specific key, else global
  `appSettings.apiKey`). "Local" is detected by host = localhost / 127.0.0.1 /
  ::1 / RFC-1918 ranges, and such requests are sent without the auth header.

**Request body (JSON):**
```
{
  model:       <selected model id>,        // from #model-select
  messages:    [ {role,content}, ... ],     // see below
  temperature: <float>,                     // from #temperature-slider
  top_p:       0.95,
  stream:      true,
  character_id: currentCharacterId,         // custom field, preserved verbatim
  chat_id:      currentChatId,              // custom field
  options: { num_ctx: <model.numCtx || 131072>, top_p: 0.95 }
}
```
`messages` = `[{role:'system', content:<assembled system prompt>}, ...mapped
history ({role:'assistant'|'user'}), {role:'user', content:<augmented last user
content>}]`.

The custom `character_id` / `chat_id` fields let the backend mirror each chat to
disk (`data/chats/<character_id>/<chat_id>.json`) for the restore feature (§12).

**Response:** Server-Sent-Events stream of OpenAI-style chunks. Parsing reads
the response body reader, decodes incrementally, splits on `\n`, keeps the last
partial line buffered, and for each `data:` line:
- `data: [DONE]` ends the stream.
- Otherwise `JSON.parse` the payload and read `choices[0].delta`.
  - `delta.content` → appended to the running reply text.
  - `delta.reasoning` → appended to a separate reasoning buffer (rendered into
    the think block when "Show Think Blocks" is on).

**Think extraction during streaming:** the accumulated `content` is scanned for
`<think>` / `</think>`. Four cases are handled: headless reasoning (only
`</think>` present → everything before it is think, after it is main),
complete inline block, an open-but-unclosed `<think>` (think kept out of main
until closed), and no-think (all main). Main text streams into `.main-content`
via the typewriter; think text streams into `.think-block-content`. On the first
real chunk the placeholder `'...'` and typing dots are cleared.

**Auto-scroll:** the window auto-scrolls to bottom on each render *only while*
`chatWindow._autoScroll` is true; this flag is set false when the user scrolls
up (>50px from bottom) and re-enabled at the bottom, so the user can read back
without being yanked down.

---

## 8. Regenerate (swipe-create) and Continue

Both target an existing AI message by id and rebuild the same system prompt +
mood directive as §6 (using the message's `speakerId` and `type`). Same
endpoint/body/streaming contract as §7.

**Regenerate** (`.regenerate-btn` / `handleRegenerate`):
- Pushes a new blank variant (`{main:'...', think:null}`), makes it active, and
  streams into it. The prompt history is everything before this message; the
  prompt's "user turn" is the last preceding user message (so it re-answers the
  same user input).
- On success the new variant replaces the placeholder and the swipe controls
  appear/update. On abort-before-content the empty new variant is popped (the
  previous variant stays active). So regenerate is non-destructive: it adds an
  alternative you can swipe between.

**Continue** (`.continue-btn` / `handleContinue`):
- Streams *appended* text onto the current active variant. The user turn sent is
  the existing message text plus a bracketed "drive the scene forward, complete
  any cut-off sentence, don't repeat" instruction. The typewriter is seeded with
  the original text so new tokens visibly extend it (`"<original> <new>"`).
- On error the original text is preserved and an `[--- ERROR: … ---]` note is
  appended in the bubble.

Both reuse the 20s/70s status timers, the 90-attempt retry loop, notification
sound, token-count refresh, and trigger background reply-suggestions on
completion.

**Swipe navigation** (`.prev-variant-btn` / `.next-variant-btn`, wired in
main.js): decrement/increment `activeVariant` within bounds, persist, and
`updateSingleMessageView`. The counter shows `i/N`.

---

## 9. Edit a message

- Trigger: `.edit-message-btn` on a bubble, or double-clicking the
  `[data-edit-part="main"]` region. Opens `#message-editor-modal` with
  `#message-editor-textarea` prefilled (user → `main`; AI → active variant's
  `main`); the message id is stashed on the modal's dataset.
- Save (`#save-message-edit-btn`, Enter, or double-click the modal backdrop):
  writes the textarea back to `message.main` (user) or active variant `main`
  (AI), persists, re-opens the chat to re-render, and restores scroll position.
- Cancel (`#cancel-message-edit-btn` / Escape): closes without saving.

---

## 10. Delete a message (and undo)

- Trigger: `.delete-message-btn`. Custom-confirm warns it deletes **this message
  and all following**.
- On confirm: `history.splice(fromIndex)` removes that message and everything
  after it; the removed slice is saved to an undo snapshot
  `{charId, chatId, fromIndex, messages}`. Persists, refreshes token count,
  re-renders the chat (scroll preserved), shows an "undo delete" FAB, and
  refreshes reply-suggestions.
- Undo restores the snapshot back into history at the original index.

---

## 11. Chat memories & auto-summarize

- Button `#chat-memories-btn` (in the chat header) toggles an `active` class /
  title when the chat has non-empty memories.
- Modal `#chat-memories-modal` with `#chat-memories-textarea`. Save
  (`#save-memories-edit-btn`, Enter, or backdrop double-click) trims and stores
  `chat.memories`, persists, updates the button state + token estimate, and
  toasts "✓ Memories saved" / "✓ Memories cleared". Cancel
  (`#cancel-memories-edit-btn` / Escape) discards.
- Memories are injected into every request's system prompt as a high-priority
  block (§6).
- **Auto-summarize** (`#summarize-memories-btn`, wired in ai-gen.js): opens a
  model-picker dialog, then sends the **last 40 messages** (formatted
  `"<speaker>: <text>"`) to a one-shot completion asking for 5–10 bullet points
  of key events/facts, and **appends** the result to the memories textarea under
  a `--- Summary (<date>) ---` header (the user reviews/edits before saving).

---

## 12. Reply suggestions (suggested replies)

Optional feature gated by the "Reply Suggestions" toggle
(`#reply-options-toggle` → `replyOptionsEnabled`). Implementation lives in
ai-gen.js; the chat core only triggers it and clears it.

- **Trigger:** after any successful AI turn (send / regenerate / continue), and
  when the user focuses `#message-input` while the last turn was the AI's.
- **Pipeline** (`generateReplyOptionsInBackground`): takes the latest AI
  message's text, builds a system prompt instructing the model to output exactly
  2 short first-person user replies as a JSON array `["…","…"]`, and calls a
  one-shot streaming completion (`callAISimple`) using the dedicated
  *suggestions model* (`#suggestion-model-select` → `suggestionModelId`) if set,
  else the chat model. The response is stripped of think tags, then parsed as
  JSON (with a fallback that scans for the first valid `[...]` array).
- A monotonically increasing request id guards against races — stale results
  (superseded by a newer request or a chat switch) are discarded.
- **UI:** dropdown `#reply-options-dropdown` (label `.reply-options-label`,
  buttons `#reply-opt-1` / `#reply-opt-2`, class `.reply-option-btn`). States:
  loading (`.reply-option-loading`), populated, or error
  (`.reply-option-error`, "⚠ <message>"). Clicking a suggestion copies its text
  into the input, resizes it, hides the dropdown, and focuses the input
  (mousedown is used + `preventDefault` so the textarea keeps focus).

**One-shot completion contract** (`callAISimple`): same endpoint selection as
§7, body `{model, messages:[{system},{user}], temperature:0.7, top_p:0.95,
stream:true}` with extra headers `HTTP-Referer` and `X-Title: Casual Character
Chat`; collects all `delta.content` into one string and returns it trimmed.

---

## 13. Mood

- Header button `#mood-btn` opens `#mood-picker` (options: Happy, Sad, Angry,
  Excited, Nervous, Flirty, Tired, Curious, Scared, Bored, and "✕ No Mood").
  Each option has `data-mood`; empty value clears the mood.
- Selecting a mood stores `chat.mood`, persists, and updates the button's active
  state. The mood then influences generation in two ways every request: a
  `--- CHARACTER CURRENT MOOD ---` system-prompt block and the stronger bracketed
  `[MOOD — TOP PRIORITY …]` directive appended to the user turn (§6).

---

## 14. Token estimate

`#token-info-icon` (ℹ️) shows `#token-tooltip` with
`"Estimated Tokens in Context: ~<n>"`. Estimate ≈ (persona description + chat
memories + all message texts + participant descriptions + main-char lore) length
÷ 4, plus a flat ~2000 overhead. Recomputed on open, send completion, swipe,
edit, delete, memory save, and participant changes.

---

## 15. Restore chats from server backup

Lives in settings.js, surfaced in App Settings under "Backup & Restore"
(`#restore-chats-btn` → `restoreChatsFromServer`, also auto-run silently at
startup). The backend mirrors every streamed chat to disk keyed by the custom
`character_id`/`chat_id` fields from §7.

- `GET <backendOrigin>/api/chats` → array of
  `{character_id, chat_id, turns, updated_at}` summaries.
- For each entry whose `character_id` matches a character that still exists
  locally (others are counted as "orphans" and skipped): if a local chat with
  that id already has `history.length >= turns`, skip (never clobber a fresher
  local copy). Otherwise `GET
  <backendOrigin>/api/chats/<character_id>/<chat_id>` → `{messages:[{role,
  content}, ...]}`.
- Backend messages are converted to the frontend message model: `system`
  messages dropped; `assistant`→`'ai'` / else `'user'`; each becomes
  `{id:"msg-restored-<chatId>-<idx>", sender, type:'dialog',
  variations:[{main, think}], activeVariant:0}` where think/main are split out of
  any `<think>…</think>` content. Existing chats have their history replaced; new
  chats are created named `"Restored - <localeDateTime>"` with default
  participants `[character_id]`, empty memories, no persona/mood.
- Touched characters are persisted; the home list re-renders. A toast/status
  reports `<n> new`, `<n> updated`, and orphan skips. Silent startup mode only
  speaks up when something actually changed. Backend origin = the page's own
  origin when served over http(s), else the origin of `DEFAULT_API_URL`.

---

## 16. Key DOM ids/classes the chat core reads or writes

Screens/containers: `#character-selection-screen`, `#chat-list-screen`,
`#chat-screen`, `#chat-window`, `#stars-container`, `#particle-canvas`.
Chat-list: `#chat-session-list`, `.chat-session-entry`,
`.chat-session-name[data-chat-id]`, `.rename-chat-btn`, `.delete-chat-btn`,
`#chat-list-avatar`, `#chat-list-avatar-container`,
`#chat-list-avatar-placeholder`, `#chat-list-character-name`,
`#start-new-chat-btn`, `#back-to-main-btn`.
Chat header: `#chat-avatar`, `#chat-avatar-placeholder`, `#chat-character-name`,
`#chat-world-badge`, `#participant-icon-list`, `#token-info-icon`,
`#token-tooltip`, `#mood-btn`, `#mood-picker` (`.mood-option[data-mood]`),
`#chat-memories-btn`, `#add-participant-btn`, `#select-persona-btn`,
`#back-to-selection-btn`.
Composer: `#chat-form`, `#message-input`, `#dialog-btn`, `#story-btn`,
`#stop-stream-btn`, `#loading-indicator`, `#scroll-top-fab`,
`#group-char-dropdown`, `#group-char-bubble` / `#group-char-bubble-name` /
`#group-char-bubble-dismiss`.
Reply suggestions: `#reply-options-dropdown`, `.reply-options-label`,
`#reply-opt-1`, `#reply-opt-2`, `.reply-option-btn`
(`.reply-option-loading` / `.reply-option-error`).
Message bubble: `.message[data-message-id]`, `.user-message`,
`.user-message-container`, `.ai-message-container`, `.ai-message`,
`.story-message`, `.message-avatar` (`.placeholder-icon`, `.effect-container`),
`.main-content[data-edit-part="main"]`, `.typing-dots` / `.typing-dot`,
`.think-block` (`.think-block-summary`, `.think-block-content`),
`.message-action-group` (`.delete-message-btn`, `.edit-message-btn`, `.tts-btn`),
`.message-controls` (`.prev-variant-btn`, `.variant-counter`,
`.next-variant-btn`, `.regenerate-btn`, `.continue-btn`); streaming classes
`.is-streaming` / `.msg-streaming` / `.is-loading`.
Modals: `#message-editor-modal` (`#message-editor-textarea`,
`#save-message-edit-btn`, `#cancel-message-edit-btn`), `#chat-memories-modal`
(`#chat-memories-textarea`, `#summarize-memories-btn`, `#save-memories-edit-btn`,
`#cancel-memories-edit-btn`), `#scenario-selection-modal`.
Settings inputs read at send time: `#model-select`, `#temperature-slider`,
`#reply-length-select`, `#suggestion-model-select`, `#think-toggle`,
`#reply-options-toggle`.

---

## 17. Backend endpoints (observed contract)

- `POST /v1/chat/completions` (or per-model `targetApiUrl`) — OpenAI-style
  streaming chat completion; request body adds custom `character_id`,
  `chat_id`, and `options.num_ctx`. SSE response of `data:` chunks ending in
  `data: [DONE]`; each chunk `choices[0].delta` may carry `content` and/or
  `reasoning`.
- `GET /api/chats` — list of chat-backup summaries
  `{character_id, chat_id, turns, updated_at}`.
- `GET /api/chats/<character_id>/<chat_id>` — full chat
  `{messages:[{role, content}, ...]}`.
- `GET /api/health` — backend liveness (used elsewhere).


---

## 3.3 — Characters, cards, import/export

# Behavioral Spec — Characters, Cards, Import/Export

Scope: character list/grid landing page, card rendering, browse filters & shelves,
pagination, token estimates, bulk delete, and import/export (JSON backup + V2
character-card PNG/JSON). Behavioral contract only.

---

## 1. Data Models (persisted contract)

### 1.1 Character object

Stored in an in-memory map keyed by character `id`, persisted one-record-per-
character. The persisted contract for a character is a plain object with these
fields (all string fields default to empty string when absent):

| Field | Type | Meaning |
|---|---|---|
| `id` | string | Primary key. Native creates use `char-<epoch_ms>`. Imports use `char-<epoch_ms>-<9-char base36 random>`. The numeric segment after `char-` is parsed back out as the creation timestamp. |
| `name` | string | Display name (the "card name"). Used in grid, sorting, search. |
| `chatName` | string | In-chat speaker name (the `{{char}}` substitution). Separate from `name`. Editor falls back `chatName || name`. |
| `avatar` | string | Avatar image reference — a data/blob URL or stored image token resolved via `getImageUrl()`. Empty for `type==='world'` cards. |
| `background` | string | Background image reference (same resolution as avatar). Used as the card image for world cards and as the chat-screen background. |
| `description` | string | Main character description (identity, appearance, personality, abilities, speech, dialogue examples). |
| `lore` | string | Deeper background / world / relationships / lore text. |
| `instructions` | string | Per-character system/AI instructions. |
| `reminder` | string | Per-character "character reminder" prompt fragment. |
| `narratorReminder` | string | Per-character "narrator reminder" prompt fragment. |
| `tags` | string | **Comma-separated** tag string (NOT an array). Split on `,` and trimmed wherever tags are used. |
| `musicUrl` | string | Optional background-music URL. |
| `scenarios` | array of `{ name: string, text: string }` | Greetings/scenarios. First entry is effectively the primary greeting. Legacy form (array of plain strings) is auto-migrated on edit to `{name:'Scenario N', text}`. |
| `type` | string | `'character'` (default) or `'world'`. |
| `characterIds` | string[] | For `type==='world'` only: ids of member characters. Empty array otherwise. |
| `chats` | object | Map of chatId → chat object. Each chat has `history` (array of messages) and `participants` (array of character ids). Chat ids follow `chat-<epoch_ms>`; last activity = max ts across chat ids. |
| `isFavorite` | boolean | Favorite flag. Toggled from the card star. Forced `false` when archived. |
| `isArchived` | boolean | Archived flag. Archived cards render in a separate section, are not paginated, and hide the favorite button. |

Notes on the contract:
- There is no separate `personality` / `scenario` / `first_mes` / `creator_notes`
  / `lorebook` field on the internal model. Those external V2 concepts are
  **flattened on import**: personality+description+example messages → `description`;
  lorebook/character_book/creator_notes → `lore`; scenario+first greeting and
  alternate greetings → `scenarios` entries (see §8).
- Token estimate reads `chatName, description, lore, instructions, reminder,
  narratorReminder` (see §6).

### 1.2 Persona object

| Field | Type | Meaning |
|---|---|---|
| `id` | string | `persona-<epoch_ms>`. |
| `name` | string | Persona name/alias. |
| `avatar` | string | Image reference (resolved via `getImageUrl`). |
| `description` | string | Identity/appearance/role text. |

Personas are stored in their own map and object store. Editing merges
(`{...existing, ...newData}`), preserving `id`.

### 1.3 Model entry (relevant to export/import)

Each entry in `appSettings.availableModels`: `{ name, id, instructions,
reminder, narratorReminder }`.

---

## 2. Storage (IndexedDB)

- Database name `CasualCharacterChatDB`, version `3`.
- Object stores (created on upgrade if missing):
  - `characters`, keyPath `id`.
  - `personas`, keyPath `id`.
  - `settings`, keyPath `key` (e.g. record `{key:'appSettings', value:...}`).
- Single-character writes persist one record; bulk delete removes multiple by id.
- Personas are saved as a batch.

---

## 3. Landing layout & DOM contract

Key element ids/classes the rendering relies on:

- `#category-bar` — curated category chip strip (always rendered).
- `#tag-bar` — dynamic tag chip strip.
- `#sort-select` — sort dropdown; values `recent | popular | messages | new | name`.
- `#search-input` — single search box (matches name + tags).
- `#char-count-badge` — live "N character(s)" count.
- `#favorites-bar-container` / `#favorites-bar` — favorites strip.
- `#shelves-container` — themed horizontal shelves (home view).
- `#character-list` — paginated active-character grid.
- `#pagination-bar` — page controls.
- `#archived-character-list` (within an archive section) — archived cards, unpaginated.
- `.browse-tab[data-filter]` — Home/Favorites tabs (`data-filter` = `all` | `favorites`).
- Card: `.character-card[data-char-id]`, optional `.card--world`; inner
  `.favorite-btn` (`.is-favorite` when active), `.archive-btn`,
  `.card-image-container.effect-container` (`.img-loading` while loading,
  child `img` gets `.is-broken` on error), `.world-badge`, `.world-char-count`,
  `.card-stats` > `.card-stat`, `.card-name-container`.
- Editor fields referenced by token counter: `#chat-name`, `#char-description`,
  `#char-lore`, `#char-instructions`, `#char-reminder`, `#char-narrator-reminder`;
  persona: `#persona-name`, `#persona-description`.

---

## 4. Card rendering (grid & shelves use the same builder)

Each card shows:
- Image: avatar for normal cards, `background` for world cards. If no image, a
  placeholder (👤 for characters, 🌍 for worlds). Image is set both as `<img>`
  and as the container's CSS `background-image`. Loading state cleared on load;
  broken-image state on error.
- World cards: a "World" badge and, if it has members, "N character(s)" count.
- Favorite star button (top corner) — shown only when NOT archived; filled state
  when `isFavorite`.
- Archive button — chevron-down to archive, chevron-up ("retrieve") when archived.
- Stats overlay: saved-chat count (chat icon) and total-message count (mail icon),
  each compacted via `1234 → "1.2k"`, `>=10000` drops the decimal.
- Name in a name container; font auto-shrinks to fit after fonts load.

Card click behavior: clicking the card body opens that character's chat list
(`showChatList(id)`). Clicks on the favorite or archive buttons are excluded from
that handler. Favorite toggle flips `isFavorite`, persists, and updates the star.
Archiving sets `isArchived` (and forces `isFavorite=false`), moves the card to the
archive section, and removes its favorite button.

### Favorites strip
Above the grid: lists all favorited, non-archived characters (avatar + name),
each click opens its chat list. Container is always shown; if none, shows a
"No Favorites selected" placeholder.

---

## 5. Browse logic, filters, sort, shelves, pagination

### View selection
- **Home view (themed shelves)** is shown only when: browse tab = `all` AND no
  search query AND no active tag AND no active category AND not "force grid".
  Otherwise the **results grid** is shown.

### Browse tabs
- `all` (Home): clears active category, active tag, and force-grid, returns to shelves.
- `favorites`: restricts the grid to `isFavorite === true`.

### Category strip (curated, fixed set)
Categories: All, Anime, Superheroes, K-pop, Music, Movies, Games, OC. Each
(except All) carries a keyword list and matches a character when any keyword is a
substring of `name + " " + tags` (lowercased). Clicking a chip toggles it
(re-click clears). Each chip has an inline SVG icon.

### Tag strip (dynamic)
Built from tags actually present across characters (comma-split). Each chip shows
`#tag` + a per-tag count; sorted by count descending. Clicking toggles that tag as
the active tag filter (case-insensitive substring match against the character's
tag string). Empty state message when no tags exist.

### Search box
Single query matched (substring, lowercased) against `name + " " + tags`. Combined
with tag, category, and favorites filters via AND.

### Sort modes (applied to the results grid)
- `name`: locale-aware (`de`, case-insensitive) by name.
- `recent`: by last activity timestamp (max `chat-<ts>` across chats, falling back
  to creation ts), descending.
- `new`: by creation timestamp (from `char-<ts>` id), descending.
- `popular`: by chat count, then message count, descending.
- `messages`: by total message count, descending.
- All non-name sorts tie-break by name.

### Shelves (home)
Netflix-style horizontal rows, each capped at 20 cards:
Favorites (if any) → Recently used (chats>0, by last activity) → one shelf per
non-All category that has matches → Recently added (by creation) → Everyone.
"See all ▸" buttons: Favorites→favorites tab; a category shelf→activates that
category; Everyone→sets force-grid to show the flat grid. Empty state when no
live characters.

### Pagination
- Page size = **24**, applied only to active (non-archived) cards in the grid.
- Archived cards always render in full in their own section, regardless of page.
- Page resets to 1 whenever the filter signature changes
  (`query|activeTag|browseFilter|activeCategory|sortMode|forceGrid`).
- Controls: prev `‹` / next `›` (disabled at ends) plus windowed numeric buttons
  (always 1, last, current, current±1) with `…` ellipses for gaps. Bar hidden when
  only one page. Clicking a page scrolls the grid into view.
- Live count badge reflects the active (non-archived) match count.

### Empty states
- No characters at all → "Nothing here yet" prompt to create.
- Characters exist but none match → "Nothing found / reset filters" message.

---

## 6. Token estimate

Heuristic: `round(total_text.length / 4)` ≈ 4 chars/token.
- Character editor counter sums: `chatName + description + lore + instructions +
  reminder + narratorReminder`, displayed as `Estimated Tokens: ~N`.
- Persona editor counter sums: `name + description`, same display format.
- A reusable function computes the per-character estimate from those same six fields.

---

## 7. Bulk delete flow

- Opened via a dynamically-built modal (full-screen overlay, centered panel).
- Selection state is a Set of character ids, reset each open.
- List rows: avatar (or 👤 placeholder) + name + a checkbox, sorted by name
  (locale `de`). A search box filters rows by name substring (live).
- "Select all" checkbox: checks/unchecks all visible rows; shows indeterminate
  state when some-but-not-all are selected.
- "Delete selected": if none selected → alert. Otherwise a confirm dialog
  ("Delete N selected character(s)? This cannot be undone."). On confirm:
  - Removes each selected character from the map.
  - Removes those ids from every remaining chat's `participants` arrays.
  - Clears current character/chat if the active one was deleted.
  - Deletes the records from the DB, re-renders the list, closes the modal, and
    reports "Deleted N character(s)."
- "Cancel" closes the modal.

---

## 8. Import / Export

### 8.1 Export (JSON backup)
- Aborts with an alert if there are no characters, no personas, and no models.
- Produces `{ version: 3, characters, personas, appSettings }` where
  `appSettings = { availableModels: [{name,id,instructions,reminder,
  narratorReminder}] }`.
- Pretty-printed JSON, downloaded as a Blob named
  `casualcharacterchat_export_<YYYY-MM-DD>.json`.

### 8.2 Import — file type routing
Triggered from a file input. Accepts `.png` and `.json`; anything else → alert.
Input value is cleared after handling.

**PNG (`image/png`)**: read as ArrayBuffer; extract embedded character JSON from
the PNG `tEXt` chunk (see §8.4). If found, confirm, convert image to WebP (quality
0.80) for the avatar, map to internal character (§8.3), insert and persist, then
re-render and report success. Aborts if a character with the same generated id
already exists. If no embedded data → alert.

**JSON (`application/json`)**: parse, then branch:
- If `spec` starts with `chara_card_v` → treat as a single external character card;
  confirm, map (§8.3), guard against id collision, insert/persist/re-render.
- Else if `version === 3` and has `characters` → backup-merge mode (§8.5).
- Else → "Unknown or unsupported JSON format" alert.

### 8.3 External card → internal mapping
External payload may be wrapped (`externalCard.data`) or flat. Mapping:
- **description** = join of: card_description/tagline, a "CHARACTER DESCRIPTION"
  separator, `personality`, `description`, an "EXAMPLE MESSAGES" separator,
  `mes_example` — empties dropped, joined by blank lines.
- **lore** = collected lore pieces + sanitized creator notes:
  - `character_book` as string, or its `entries[]` (each formatted
    `[key(s)]\ncontent`, keys from `keys[]` or `key`, value from `content`/`value`),
  - `lorebook` string, `lore` string, `world_scenario` string,
  - pieces equal to the card description/tagline are dropped (de-dupe),
  - creator notes from `card_notes`/`creator_notes`/`creator_note`/`notes`,
    sanitized (§8.6), appended under a "CARD NOTES" separator.
- **scenarios**: a "Main Greeting" entry built from `scenario` + `first_mes`
  (blank-line joined), followed by one "Alternate Greeting N" per non-empty string
  in `alternate_greetings[]`.
- **tags**: `tags[]` joined into a comma-separated string (else empty).
- **instructions** = `system_prompt`; **reminder** = `post_history_instructions`;
  **narratorReminder** = empty.
- **name** = `name` or "Unnamed Import"; **avatar** = provided image blob/dataURL
  or `avatar` or empty; **background** = empty; **chats** = `{}`.
- **id** = `char-<epoch_ms>-<base36 random>`.

### 8.4 PNG tEXt extraction (V2 card standard)
- Validates the 8-byte PNG signature.
- Walks chunks (4-byte length, 4-byte type, data, skipping 12+length per chunk).
- For `tEXt` chunks whose UTF-8 data begins with the keyword `chara\0`, the
  payload after that prefix is the character JSON. Tries `JSON.parse` directly;
  on failure treats it as base64, decodes to UTF-8, then parses. Returns the first
  successful parse, else null.

### 8.5 Backup merge (version 3)
After confirm, merges by id without overwriting existing entries:
- Characters: add+persist new ids; skip existing (counts added/skipped).
- Personas: add new ids; skip existing.
- Models: add new model ids; for existing model ids, "hydrate" empty
  instructions/reminder/narratorReminder from the incoming entry if present;
  persist appSettings to the settings store and refresh the model UI.
- Saves personas, re-renders the list, refreshes the persona list modal if open,
  and shows a summary alert (added / skipped / models / prompts hydrated).

### 8.6 Creator-notes sanitization
- Extracts image URLs (http(s), image extensions) before stripping.
- Removes `<script>`/`<style>` blocks; converts `<br>`→newline, `</p>`→double
  newline, `</div>`/`</li>`→newline, `<li>`→"- ", strips heading tags; removes all
  remaining tags; decodes HTML entities via a textarea.
- Normalizes line endings/whitespace, collapses 3+ blank lines to 2, trims.
- If image URLs were found, appends a de-duplicated "Image links:" list.

---

## 9. Summary (10 lines)

1. Character model is a flat object: `id, name, chatName, avatar, background,
   description, lore, instructions, reminder, narratorReminder, tags(CSV string),
   musicUrl, scenarios[{name,text}], type, characterIds[], chats, isFavorite,
   isArchived`. Persona: `id, name, avatar, description`.
2. Persistence is IndexedDB `CasualCharacterChatDB` v3, stores `characters`,
   `personas` (keyPath `id`), `settings` (keyPath `key`).
3. Ids embed timestamps: `char-<ms>` / `chat-<ms>` drive creation and activity stats.
4. Landing shows themed shelves on Home, or a paginated grid (24/page, archived
   unpaged) when any search/tag/category/favorites/force-grid filter is active.
5. Cards show image+placeholder, favorite star, archive toggle, chat/message stats,
   world badge/member count; body click opens the chat list.
6. Filters: Home/Favorites tabs, dynamic tag chips, fixed keyword categories,
   name+tags search, and five sort modes (recent/popular/messages/new/name).
7. Token estimate ≈ chars/4 over the six character text fields (or name+description
   for personas), shown as "Estimated Tokens: ~N".
8. Bulk delete: modal with searchable checklist + select-all (indeterminate),
   confirm, removes characters, scrubs them from chat participants, persists.
9. Export = pretty JSON `{version:3,characters,personas,appSettings}` named
   `casualcharacterchat_export_<date>.json`; backup import merges without overwrite.
10. Imports V2 character cards from PNG `tEXt chara\0` chunks (JSON or base64) and
    from JSON (`spec: chara_card_v*`), flattening personality/lorebook/greetings
    into description/lore/scenarios.


---

## 3.4 — Settings & editor

# Behavioral Specification — Settings & Editor

Scope: the chat-design settings panel, the App Settings modal (models/providers),
model discovery, the character/world editor, and the message editor. This describes
*what* the system does and the contract it relies on, not the implementation.

---

## 1. Two distinct settings surfaces

There are **two independent** settings areas, persisted separately:

1. **Design / chat settings panel** — an inline accordion panel (`#settings-panel`,
   toggled by `#settings-btn`) with three collapsible sections: **Design**, **AI**,
   **Features**. These are *per-control, live-applied, auto-saved* preferences.
   Persisted as **one IndexedDB row per setting** in the `settings` object store,
   each record shaped `{ key, value }` where `key` is the setting name (e.g.
   `fontSize`). Values are stored as **strings** (sliders/selects) or stringified
   booleans (`"true"`/`"false"` for checkboxes).

2. **App Settings modal** (`#app-settings-modal`) — manages the **AI model list and
   providers** (Ollama, OpenRouter, OpenRouter API key, backup/restore). Persisted
   as a **single** IndexedDB row `{ key: 'appSettings', value: {...} }`. It has an
   explicit **Save** button (changes are not live; they take effect on save). The
   design panel and the model modal share the same `settings` store but use
   different keys and never overwrite each other.

### Persistence contract (both surfaces)
- Object store name: `settings`, primary key path: `key`.
- Design settings: read all rows on startup, build a `key → value` map, fall back to
  defaults for any missing key. Per-setting write on every change.
- App settings: single `get('appSettings')` row holding `{ apiKey, availableModels }`.

---

## 2. Design settings panel — every setting

Listed with id, control type, range/options, default, live effect. Each control is
wired so that on its `input`/`change` event it (a) calls a live-apply function and
(b) writes its own `{key,value}` row to IndexedDB. Defaults below are the *seeded
defaults* used when no stored value exists (note: a few HTML `value=` attributes
differ from the JS default object; the JS default object wins at load because it is
applied explicitly).

### Section: Design
| Setting | key | id | Type | Range/step | Default (JS) | Live effect |
|---|---|---|---|---|---|---|
| Character Avatar Size | `avatarSize` | `avatar-size-slider` | range | 30–1000, step 5 (desktop max 1000; mobile max 180) | `200` | Sets CSS var `--ai-avatar-size: <v>px` and `--ai-placeholder-icon-size: round(v*0.6)px`. Label `#avatar-size-value` shows `<v>px`. |
| Font Size | `fontSize` | `font-size-slider` | range | 14–36, step 1 (desktop max from HTML=36; mobile max 24) | `18` | Sets `--chat-font-size: <v>px`. Label `#font-size-value`. |
| Message Spacing | `messageSpacing` | `spacing-slider` | range | 5–100, step 1 | `50` | Sets `--message-spacing: <v>px`. Label `#spacing-value`. |
| Main Text Colour | `mainTextColor` | `main-text-color-picker` | color | hex | `#FFFFFF` | Sets `--main-text-color`. |
| Dialog Colour | `dialogueColor` | `dialogue-color-picker` | color | hex | `#ffd952` | Sets `--dialogue-color` (color of quoted/dialogue text). |
| User Bubble Colour | `userBubbleColor` | `user-bubble-color-picker` | color | hex | `#141414` | Combined with opacity → `--user-bubble-color: rgba(r,g,b,opacity)`. |
| User Bubble Opacity | `userBubbleOpacity` | `user-bubble-opacity-slider` | range | 0–1, step 0.05 | `0.7` | Recomputes `--user-bubble-color`. Label `#user-bubble-opacity-value` shows `round(v*100)%`. |
| AI Bubble Colour | `aiBubbleColor` | `ai-bubble-color-picker` | color | hex | `#141414` | Combined with opacity → `--ai-bubble-color: rgba(...)`. |
| AI Bubble Opacity | `aiBubbleOpacity` | `ai-bubble-opacity-slider` | range | 0–1, step 0.05 | `0.7` | Recomputes `--ai-bubble-color`. Label `#ai-bubble-opacity-value`. |
| Blur Filter | `blur` | `blur-slider` | range | 0–20, step 1 | `5` | Sets `--message-blur: <v>px` (backdrop blur behind bubbles). Label `#blur-value`. |

Color+opacity contract: each bubble color is derived by parsing the color picker's
hex into r/g/b and emitting `rgba(r, g, b, <opacity>)`. Changing either the color OR
the opacity recomputes the same CSS variable. A 6-digit hex parser is used; invalid
hex leaves the variable unchanged.

### Section: AI
| Setting | key | id | Type | Options/range | Default | Effect |
|---|---|---|---|---|---|---|
| AI Model | `model` | `model-select` | select | populated from `appSettings.availableModels` | first available model id (`local-qwen`) | Selects the active chat model id; persisted. |
| Temperature | `temperature` | `temperature-slider` | range | 0.1–1.0, step 0.05 | `0.70` | Updates `#temperature-value` (2 decimals). Affects generation creativity; no CSS effect. |
| Reply Length | `replyLength` | `reply-length-select` | select | `default`/`short`/`medium`/`long`/`verylong` | `default` | Sets runtime `replyLength`; affects prompt/length budget. |
| Reply Suggestions | `replyOptionsEnabled` | `reply-options-toggle` | checkbox | on/off | `true` | Enables generation of clickable reply suggestions. When turned **off**: clears any pending suggestions and hides the suggestions dropdown. |
| Suggestions Model | `suggestionModelId` | `suggestion-model-select` | select | `""` = "(same as chat model)" + each available model | `""` (null) | Dedicated model id for generating suggestions. Persisted under its own key; only applied if a stored value exists. |
| Show Think Blocks | `thinkEnabled` | `think-toggle` | checkbox | on/off | `true` | Controls whether `<think>`/reasoning blocks are displayed. |

### Section: Features
| Setting | key | id | Type | Options | Default | Effect |
|---|---|---|---|---|---|---|
| TTS Voice | `ttsVoiceURI` | `tts-voice-select` | select | `""` = default voice, plus voices populated from the browser speech-synthesis voice list | `""` | Sets the chosen voice URI for spoken AI replies. |
| Auto-read AI Responses (TTS) | `ttsEnabled` | `tts-toggle` | checkbox | on/off | `false` | Enables/disables text-to-speech of AI replies. |
| Notification Sound | `soundEnabled` | `sound-toggle` | checkbox | on/off | `true` | Enables a short sine-tone chime (659.26 Hz, ~0.5s, gain ramped) played via WebAudio when a reply arrives. Requires an AudioContext, which is lazily created on first user click. |

A **"Reset to Default Values"** button (`#reset-settings-btn`) restores these design
settings to defaults.

### Load/apply contract (design settings)
On startup: read all `settings` rows → map. For each key in the default-settings
object, take stored value or default, push it into the bound input element
(checkbox→`checked`, else `.value`), then call the live-apply routine. The
suggestion-model id is loaded/applied separately only if present.

### Responsive limits contract
- Breakpoint: viewport `max-width: 768px` ⇒ "mobile".
- Font slider max: desktop = HTML max (36); mobile = **24**.
- Avatar slider max: desktop = HTML max (1000); mobile = **180**.
- The sliders' `max` attribute is rewritten dynamically when the viewport crosses the
  breakpoint (listening to a matchMedia change), clamping the current value if it now
  exceeds the new max.

---

## 3. App Settings modal — models & providers

Modal `#app-settings-modal` / content `#app-settings-modal-content`. Header has title
"App Settings" and a **Reset to Default** button (`#reset-app-settings-btn`). Form
`#app-settings-form`. Closing resets any auto-grown textareas and scrolls to top.

### 3.1 Stored shape
`appSettings = { apiKey: <string>, availableModels: [ <modelEntry>, ... ] }`.
A `<modelEntry>` is:
```
{ name, id, targetApiUrl, apiKey, instructions, reminder, narratorReminder, numCtx }
```
- `name` — display name (shown in selectors).
- `id` — technical model id sent to the provider (e.g. `provider/model-name`).
- `targetApiUrl` — provider chat-completions endpoint; empty string ⇒ fall back to the
  local backend default (`http://127.0.0.1:8000/v1/chat/completions`).
- `apiKey` — per-model API key (optional; overrides/supplies the provider key).
- `instructions`, `reminder`, `narratorReminder` — per-model "Global Prompts" text.
- `numCtx` — integer context length (Ollama only) or `null`.

Only entries with **both** a non-empty `name` and `id` are saved; blanks are dropped.

### 3.2 Default / seeded model list
The built-in `availableModels` seed:
1. `{ id:"local-qwen", name:"Qwen (local backend)", targetApiUrl:"http://127.0.0.1:8000/v1/chat/completions" }`
2. `{ id:"z-ai/glm-4.5-air:free", name:"Z.AI: GLM 4.5 Air (free)" }`

On load, if no stored model points at the local backend (id `local-qwen` or a
`targetApiUrl` containing `127.0.0.1:8000`), a local-qwen entry is **prepended**
non-destructively so the local backend always appears first.

### 3.3 Model list editor (entries)
Container `#model-list-container`. Each entry is a `.model-entry` with:
- Drag handle `.model-drag-handle` — entries are **reorderable via drag-and-drop**
  (drag becomes enabled on handle mousedown; drop reorders before/after based on
  cursor vs. entry midpoint; visual cues via `drag-over-top`/`drag-over-bottom`/
  `dragging` classes; order is the saved order).
- Inputs: `.model-name-input` (text), `.model-id-input` (text),
  `.model-target-api-url-input` (url), `.model-api-key-input` (password),
  `.model-num-ctx-input` (number, min 512, step 512).
- A collapsible **"Global Prompts"** `<details>` with three auto-resizing textareas:
  `.model-instructions-input`, `.model-reminder-input`, `.model-narrator-reminder-input`.
- Delete button `.delete-model-btn` (confirm dialog, then removes the entry).
- `+ Add new Model` (`#add-model-btn`) appends a blank entry.

**Save** (`#save-app-settings-btn`): scrape all `.model-entry` rows into the model
array (dropping nameless/idless ones), read `#api-key-input`, write the single
`appSettings` row, update in-memory `appSettings`, repopulate the model selectors,
close the modal.

**Reset to Default** (`#reset-app-settings-btn`): confirm, then rebuild the entry list
from the seed `availableModels` (blank prompt fields) and immediately save.

### 3.4 Model selector population
`#model-select` (chat model) and `#suggestion-model-select` are rebuilt from
`appSettings.availableModels` (one `<option>` per model: value=`id`, text=`name`).
The suggestion select additionally has a leading `(same as chat model)` empty option.
Previous selection is preserved if still present, else falls back to the default model.

---

## 4. Provider model discovery

### 4.1 Local Ollama models (chips)
- UI: `#ollama-section` card, list `#ollama-models-list`, refresh button
  `#refresh-ollama-btn`.
- Trigger: fired automatically (fire-and-forget) when the App Settings model list
  loads, and on **Refresh** click.
- Endpoint: **`GET /api/health`** (relative to the serving origin — the frontend is
  served by the backend). Expected response:
  `{ available_models: string[], model: string, error?: string }`.
- Behavior:
  - While loading: shows a "Loading models from Ollama…" placeholder.
  - Each available model becomes a clickable **chip** (`.provider-chip`); the chip
    matching `data.model` is marked default (`is-default`, "default" badge).
  - Clicking a chip **adds a new model entry** with `{ name:<model>, id:<model>,
    targetApiUrl: <local backend default> }`, scrolls to it, and flashes it.
  - Empty list ⇒ guidance message (mentions `ollama pull qwen2.5`); if `error`
    present ⇒ "Ollama is unreachable" message including the error text.
  - Fetch failure ⇒ "Couldn't fetch the list (…)".
- Note: a richer `GET /api/ollama/models` endpoint exists on the backend, but the UI
  intentionally uses `/api/health` because it already carries the model list and the
  current default without needing a backend restart.

### 4.2 OpenRouter models (cloud datalist)
- UI: `#openrouter-section` card, key input `#api-key-input` (password, placeholder
  `sk-or-...`), a combobox `#openrouter-model-input` backed by datalist
  `#openrouter-models-datalist`, **Load list** button `#load-openrouter-btn`, and
  **+ Add** button `#add-openrouter-model-btn`.
- Load list: **`GET https://openrouter.ai/api/v1/models`** (direct to OpenRouter).
  Expected `{ data: [ { id, name }, ... ] }`. Each becomes a `<option>` in the
  datalist (value=`id`, label=`name`). Button text reflects state
  (`Loading…` → `Loaded: N` / `Load failed`, re-enabled after a delay).
- + Add: takes the typed/picked model id and the current key from `#api-key-input`,
  and **adds a model entry**:
  `{ name:id, id:id, targetApiUrl:"https://openrouter.ai/api/v1/chat/completions",
  apiKey:<key> }`, scrolls/flashes it, clears the input. Empty input ⇒ toast prompt.

### 4.3 Backup & Restore (server chat backups → IndexedDB)
- UI: `#backup-section`, button `#restore-chats-btn` (`☁ Restore from server`),
  status line `#restore-status`.
- The backend mirrors every chat to disk; this pulls those backups back into locally
  existing characters without clobbering newer local copies.
- Endpoints (relative to local backend origin):
  - `GET /api/chats` → array of `{ character_id, chat_id, turns, updated_at }`.
  - `GET /api/chats/<character_id>/<chat_id>` → `{ messages: [{role, content}, ...] }`.
- Behavior:
  - Skip entries whose `character_id` has no local character (counted as "orphans").
  - For each candidate, compare server `turns` vs. local history length; skip if local
    is as fresh or fresher.
  - Convert backend OpenAI-style messages into the local history item shape, dropping
    `system` messages. Each becomes
    `{ id, sender:('ai'|'user' from role), type:'dialog',
       variations:[{ main, think }], activeVariant:0 }`, where any
    `<think>…</think>` segment is extracted into `think` and the visible text is the
    reasoning-stripped main content.
  - Existing local chat ⇒ history replaced ("updated"); missing ⇒ a new chat is created
    ("Restored - <localized timestamp>", participants=[character], empty memories/mood).
  - Touched characters are persisted to IndexedDB and the character list re-renders.
  - A summary (`N new, M updated`, or "Everything is already up to date", plus an orphan
    note) is shown in the status line and as a toast.
  - **Silent mode** (auto-run at startup): suppresses status text and only toasts when
    something actually changed.

---

## 5. Character / World editor

Modal `#character-editor-modal` / content `#character-editor-modal-content`, form
`#character-form`. The same editor serves two **card types** selected via a radio
toggle (`#type-character` / `#type-world`, styled options `#type-option-character`,
`#type-option-world`). Switching type re-labels the UI ("Character Editor" vs
"World Editor", save-button labels, field labels/placeholders) and shows/hides
type-specific sections.

### 5.1 Character data model (editable fields)
| Field | id | Notes |
|---|---|---|
| `id` | (hidden `#editing-char-id`) | `char-<timestamp>` for new; existing id on edit. |
| `name` (Card Name) | `card-name` | required (auto-grow textarea). |
| `chatName` (In-Chat Name) | `chat-name` | required; defaults to name if absent. |
| `avatar` (Char Img URL) | `char-avatar` | URL or uploaded image; **always empty for world cards**. |
| `background` (Background Img URL) | `char-background` | URL or uploaded image; also previewed as chat-list-screen background. |
| `description` | `char-description` | label switches to "World Description" for worlds. |
| `lore` (Lorebook / World Lore) | `char-lore` | label "Lorebook" (char) / "World Lore" (world). |
| `tags` | `char-tags` | comma-separated. |
| `instructions` (AI Instructions) | `char-instructions` | container hidden for world cards. |
| `reminder` (Character Reminder / World Rules) | `char-reminder` | label switches. |
| `narratorReminder` | `char-narrator-reminder` | label "Narrator Reminder" / "World Narrator Reminder". |
| `musicUrl` | `char-music-url` | YouTube or audio URL, auto-plays on chat open. |
| `scenarios` | `#scenario-editor-list` | array of `{ name, text }`. |
| `type` | radio | `'character'` or `'world'`. |
| `characterIds` | world picker | array of member character ids (world only). |
| `chats` | — | preserved; `{}` for new cards. |

The "Lorebook"/"World Lore" is a single freeform text field (not structured
key/keyword entries) in this implementation; there is no separate per-entry
enable/keywords UI — lore is one textarea on the character. (World *membership* is the
structured list — see picker below.)

### 5.2 World character picker
For world cards, `#world-char-picker-section` is shown: a search box
(`#world-char-search`) and a checkbox list (`#world-char-picker-list`) of all
**non-world** characters (excluding the world being edited), sorted by name, filtered
live by the search term. Checking/unchecking maintains a selected-id set that becomes
`characterIds` on save. Empty state shows a "create some characters first" message.

### 5.3 Scenarios
List `#scenario-editor-list` of `.scenario-entry` rows, each with a title input
(`.scenario-name-input`) and an auto-growing description textarea, plus a delete
button. `+ Add Scenario` (`#add-scenario-btn`) appends an entry; `✨ AI Generate
Scenario` (`#ai-scenario-btn`) generates one. New-character editor seeds one
"Main Greeting" scenario. On save, only scenarios with non-empty text are kept;
empty names become "Unnamed Scenario". Legacy string-only scenarios are migrated to
`{name:"Scenario N", text}` on edit-open.

### 5.4 Avatar/background image upload (webp conversion + staging)
- Upload buttons `#upload-avatar-btn` / `#upload-bg-btn` open a hidden file input
  `#image-uploader` (accept `image/*`), tagging which target field is being uploaded.
- On file selection the image is converted to **WebP** (quality 0.80) via a canvas;
  if WebP isn't produced, it **falls back to JPEG** (quality 0.80). Both a data-URL
  (for persistence) and an object-URL (for instant preview) are produced; the original
  data-URL is also stashed.
- The converted data-URL is **staged** in an in-memory map (`tempUploadedImages` with
  `.avatar`/`.avatarOriginal`/`.background`/`.backgroundOriginal`) and the target URL
  input shows the object-URL preview. Staging is cleared when the editor opens/closes.
- On **save**, staged images take precedence over the URL field; if the URL field
  still holds a `blob:` URL it is replaced by the staged data-URL. World cards always
  store `avatar=''` (only background is kept).

### 5.5 Open flows
- **New** (`openEditorForNew`): reset form, type=character, clear staging, seed one
  "Main Greeting" scenario, blank editing-id, blank avatar preview, show modal,
  update token count.
- **Edit** (`openEditorForEdit`): load the current character's fields into the form,
  set type radio + world membership set, preview avatar (character) or background
  (world) in the editor avatar area and as the chat-list background, rebuild scenarios
  (migrating legacy), set editing-id, auto-resize textareas.
- **Copy** (`handleCopyCharacter`): deep-clone the current character, new
  `char-<timestamp>` id, name suffixed " (Copy)", empty `chats`, persist, re-render,
  alert, return to main screen.

### 5.6 Save flow (`handleFormSubmit`)
Prevent default; gather all fields; resolve final avatar/background from staged images;
collect non-empty scenarios; determine type and (for worlds) member ids; **close the
editor first**, then either mutate the existing character object in place or create a
new one (id `char-<timestamp>`, empty `chats`); register it in the in-memory
`characters` map and **persist that single character to IndexedDB**; re-render the
character list and, if a character is open, refresh its chat list. (Save writes to both
in-memory state and IndexedDB.)

### 5.7 Token counter
`#editor-token-counter` shows a live token estimate that updates as monitored fields
(`card-name`, descriptions, lore, instructions, reminders, scenarios) change.

---

## 6. Message editor

Modal `#message-editor-modal`, textarea `#message-editor-textarea`, save
(`#save-message-edit-btn`) / cancel (`#cancel-message-edit-btn`) buttons. The id of the
message being edited is stashed on the modal as a `data-editing-message-id` dataset
attribute.

**Save** (`saveAndCloseMessageEditor`):
- Locate the message by id in the current chat's history.
- If the message is an **AI** message, write the new text into the *active variant's*
  `main` field (`variations[activeVariant].main`); if a **user** message, write to the
  message's `main` field directly.
- Persist the whole character to IndexedDB, hide the modal, clear the editing-id
  dataset.
- Preserve the chat scroll position: capture `scrollTop`, re-render the chat
  (`startChat(currentCharacterId, currentChatId)`), then restore `scrollTop`, and
  update the token count.
- Convenience: pressing ENTER or double-clicking outside the editor also saves & closes.

---

## 7. Key DOM ids/classes referenced

Design panel: `#settings-panel`, `#settings-btn`, accordion sections
`#section-design`/`#section-ai`/`#section-features`; controls `#avatar-size-slider`,
`#font-size-slider`, `#spacing-slider`, `#main-text-color-picker`,
`#dialogue-color-picker`, `#user-bubble-color-picker`, `#user-bubble-opacity-slider`,
`#ai-bubble-color-picker`, `#ai-bubble-opacity-slider`, `#blur-slider`,
`#model-select`, `#temperature-slider`, `#reply-length-select`,
`#reply-options-toggle`, `#suggestion-model-select`, `#think-toggle`,
`#tts-voice-select`, `#tts-toggle`, `#sound-toggle`, `#reset-settings-btn`; value
labels `#…-value`.

CSS custom properties (the live-apply contract): `--chat-font-size`,
`--message-spacing`, `--main-text-color`, `--dialogue-color`, `--user-bubble-color`,
`--ai-bubble-color`, `--message-blur`, `--ai-avatar-size`,
`--ai-placeholder-icon-size` — all set on `document.documentElement` (`:root`).

App Settings modal: `#app-settings-modal`, `#app-settings-form`,
`#reset-app-settings-btn`, `#api-key-input`, `#model-list-container`, `#add-model-btn`,
`#save-app-settings-btn`, `#cancel-app-settings-btn`; provider widgets
`#ollama-models-list`, `#refresh-ollama-btn`, `#openrouter-model-input`,
`#openrouter-models-datalist`, `#load-openrouter-btn`, `#add-openrouter-model-btn`,
`#restore-chats-btn`, `#restore-status`; model-entry classes `.model-entry`,
`.model-name-input`, `.model-id-input`, `.model-target-api-url-input`,
`.model-api-key-input`, `.model-num-ctx-input`, `.model-instructions-input`,
`.model-reminder-input`, `.model-narrator-reminder-input`, `.model-drag-handle`,
`.delete-model-btn`, `.provider-chip`.

Editor: `#character-editor-modal`, `#character-form`, type radios
`#type-character`/`#type-world`, `#card-name`, `#chat-name`, `#char-avatar`,
`#char-background`, `#upload-avatar-btn`, `#upload-bg-btn`, `#image-uploader`,
`#world-char-picker-section`, `#world-char-search`, `#world-char-picker-list`,
`#char-description`, `#char-lore`, `#char-tags`, `#char-instructions`,
`#char-reminder`, `#char-narrator-reminder`, `#char-music-url`,
`#scenario-editor-list`, `#add-scenario-btn`, `#ai-scenario-btn`,
`#ai-generate-char-btn`, `#editing-char-id`, `#editor-token-counter`, save buttons
`#save-edit-btn-top`/`#save-edit-btn-bottom`. Message editor:
`#message-editor-modal`, `#message-editor-textarea`, `#save-message-edit-btn`.

---

## Summary (10 lines)
1. Two separate settings surfaces: a live, auto-saving design/chat panel and an
   explicit-save App Settings modal for models/providers.
2. Design settings persist one IndexedDB `{key,value}` row per setting (string values)
   in the `settings` store; App Settings persist one `appSettings` row.
3. Each design control live-applies via `:root` CSS custom properties (font, spacing,
   colors+opacity→rgba, blur, avatar size) plus runtime flags (sound/think/TTS/etc.).
4. Defaults include fontSize 18, temperature 0.70, bubbles #141414@0.7, blur 5,
   avatar 200; responsive caps lower font→24 and avatar→180 below 768px.
5. Model entries carry `{name,id,targetApiUrl,apiKey,instructions,reminder,
   narratorReminder,numCtx}`; empty URL falls back to the local backend; only
   name+id entries persist; entries are drag-reorderable and deletable.
6. A local-qwen backend entry is always surfaced first non-destructively.
7. Discovery: Ollama via `GET /api/health` (`available_models`,`model`) as chips;
   OpenRouter via `GET .../v1/models` as a datalist; both add model entries on click.
8. Backup/Restore pulls server chat backups (`/api/chats`, `/api/chats/<c>/<chat>`)
   into local characters without clobbering fresher local copies; silent at startup.
9. The character/world editor edits one card model (name, chatName, avatar/background,
   description, lore, tags, instructions, reminders, music, scenarios[], type,
   world member ids); images convert to WebP (JPEG fallback) and stage before save;
   save writes one character to memory + IndexedDB.
10. The message editor edits one history message's text (AI → active variant's main,
    user → message main), persists the character, and re-renders while preserving
    scroll position.


---

## 3.5 — AI generators, effects, media, personas, groups, dialogs

# Behavioral Specification — Miscellaneous Subsystems

Scope: AI generators, ambient effects, media (music + TTS), personas, group chat,
and the dialog/toast system. This describes observable behavior and contracts, not
implementation. All modules are loaded after the main bundle and rely on shared
global state (`characters`, `personas`, `currentCharacterId`, `currentChatId`,
`appSettings`, `defaultSettings`, storage helpers, DOM refs).

---

## 1. AI Generators (ai-gen)

### 1.1 Shared LLM call contract

A single helper performs all one-shot generation calls. Contract:

- **Endpoint**: configurable per model. Each model entry in
  `appSettings.availableModels` may carry its own `targetApiUrl` and `apiKey`;
  otherwise a global default URL (`DEFAULT_API_URL`) and `appSettings.apiKey` are
  used. The default is an OpenAI-compatible Chat Completions endpoint (path shape
  `/v1/chat/completions`). The provider-specific model id is looked up by stripping
  a trailing `:online` suffix to find its settings, but the full (suffixed) id is
  what gets sent as `model`.
- **Method/Headers**: `POST`, JSON body, `Authorization: Bearer <key>`, plus
  `HTTP-Referer: <page url>` and `X-Title: "Casual Character Chat"` (OpenRouter
  attribution headers).
- **Request body**: `{ model, messages:[{role:'system',content},{role:'user',content}],
  temperature:0.7, top_p:0.95, stream:true }`. An optional `AbortSignal` may be
  passed to allow cancellation.
- **Response**: SSE stream of `data:` lines; each parsed as JSON, content
  accumulated from `choices[0].delta.content`; terminates on `data: [DONE]`.
  Returns the concatenated, trimmed text. Non-2xx responses throw with the raw
  response body as message.
- **Error mapping**: a formatter classifies error message substrings into
  user-friendly text: network/"failed to fetch", 401/403 (key invalid),
  404/model-not-found, 429/rate-limit/quota, 5xx server error, else generic.

### 1.2 Model-picker dialog

A reusable promise-based modal renders title, info text, optional amber warning
box, a model `<select>` populated from `appSettings.availableModels` (option value
= model id, text = name||id, pre-selecting a default), and Cancel/Confirm buttons.
Resolves to the chosen model id or `null`. If no models are configured, shows a
disabled placeholder option and disables Confirm. DOM built dynamically with
classes `custom-alert-overlay`, `custom-alert-modal`, `custom-dialog-buttons`,
`action-btn`, `secondary-btn`.

### 1.3 Reply-suggestion dropdown

- Gated by a flag `replyOptionsEnabled`. Operates on `#reply-options-dropdown`
  containing two `.reply-option-btn` elements.
- `generateReplyOptionsInBackground` finds the last non-user message in the active
  chat, requires it to have >=5 chars, sets the dropdown into a loading state, and
  asks the LLM for **exactly 2** short first-person user replies. A request-id
  counter guards against stale async results (later requests supersede earlier).
- Prompt instructs: generate 2 short reply options spoken by the human user (first
  person, single sentence, scene-specific, two distinct directions, no narration).
  If a persona is active for the chat, its name + truncated description (200 chars)
  is injected as context. Output must be a JSON array of 2 strings. The user
  message includes the character display name and the last AI text (truncated 600).
- Parsing: strips think-tags, tries `JSON.parse`, then a bracket-scan fallback that
  attempts every `[...]` candidate. On success populates both buttons and unhides
  the dropdown; on failure shows a truncated error (max ~90 chars, prefixed `⚠`)
  in the first button.
- Clicking a `.reply-option-btn` (on mousedown, preventDefault) copies its text
  into the message input, triggers textarea auto-resize, hides the dropdown, and
  focuses the input.

### 1.4 Scenario generator

- Trigger: button `#ai-scenario-btn`. Reads character display name from
  `#chat-name` (fallback `#card-name`, fallback "the character") plus
  `#char-description` and `#char-lore`. Refuses (alert) if both description and
  lore are empty.
- A modal collects optional free-text "scenario hints" (textarea) and a model
  choice; resolves `{hints, modelId}` or null.
- Prompt: write a 10–15-sentence opening scenario paragraph addressing the user as
  "you" (second person), describing relationship/dynamic, current scene, the
  character's wants, weaving in three quoted lines of dialog, concise direct prose,
  world-specific, ending on an open invitation. Character name/description (≤900)/
  lore (≤700) and hints are embedded. Output is the paragraph only.
- Insertion: result becomes a new scenario entry via `createScenarioInput`, with an
  auto-title derived from the first 5 words + "…". The new entry in
  `#scenario-editor-list` is scrolled into view. Button shows a spinner
  (`.btn-spinner`) and is disabled while running.

### 1.5 Auto-summarize chat into memory

- Trigger: button `#summarize-memories-btn`. Requires non-empty chat history.
- Uses the model-picker dialog. Builds a transcript of the **last 40** messages
  (user lines prefixed "User:", others prefixed by the speaker character's chat
  name). LLM prompt asks for 5–10 bullet points, no markdown headers/intro/outro.
- Result is appended to the chat-memories textarea: if existing content present, a
  dated `--- Summary (date) ---` separator precedes it; textarea is auto-resized.

### 1.6 Character / World generator (the main field auto-generator)

- Trigger: button `#ai-generate-char-btn`. Mode toggled by `cardTypeWorldRadio`
  (world vs character). `editingCharField.value` truthiness => "editing" mode
  (shows an overwrite warning: all text fields will be OVERWRITTEN, images kept).
- Modal collects: optional concept text (textarea), model choice, and an optional
  **Reference URL**. Resolves `{desc, modelId, referenceUrl}`; aborts if no model.
- **Reference fetching** (when a URL is given, with an AbortController):
  - Fandom URLs (`*.fandom.com/wiki/<page>`) are fetched via the MediaWiki API
    (`action=parse&prop=wikitext&format=json&origin=*`) for CORS-safe wikitext;
    requires >=200 chars, truncated to 8000.
  - Other URLs are fetched through the Jina Reader proxy (`https://r.jina.ai/<url>`,
    Accept text/plain), truncated to 8000; <200 chars counts as failure.
  - On failure a flag is set; generation proceeds without reference and an alert
    notes the URL could not be read.
- **Prompts** request a single raw JSON object (no markdown fences):
  - **Character keys**: `cardName`, `chatName` (short first name), `description`
    (one plain string structured as 8 numbered headings: Identity/Role, Personality,
    Speech Style, Abilities, Appearance, Likes/Dislikes, Past, Dialog Examples;
    300–600 words), `tags` (10–20 comma-separated), `instructions` (AI behavior
    bullets).
  - **World keys**: `worldName`, `chatName` (narrator label), `description`
    (setting overview), `lore`, `worldRules` (critical rules, bullet lines),
    `tags` (10–20). 500–1000 words, in-universe only, no future-events.
  - User message varies: reference-material based, concept based, or "random".
- **Robust JSON parsing**: bare newlines/tabs inside JSON string literals are
  escaped; a brace-counting extractor finds the first balanced `{...}`; if none
  parses, a truncation-repair pass closes open strings/braces and retries. On total
  failure throws an error quoting the first 120 chars.
- **Field insertion** (each followed by textarea auto-resize where applicable):
  - World: `worldName`→`#card-name`, `chatName`→`#chat-name`,
    `description`→`charDescriptionInput`, `lore`→`charLoreInput`,
    `worldRules`→`#char-reminder`, `tags`→`#char-tags`.
  - Character: `cardName`→`#card-name`, `chatName`→`#chat-name`,
    `description`→`charDescriptionInput` (if description came back as an object,
    it is flattened to `key\nvalue` blocks), `tags`→`#char-tags`,
    `instructions`→`charInstructionsInput`.
  - Finally `updateEditorTokenCount()` is called. AbortError is swallowed silently.

### 1.7 SVG icon system

There is no central icon-factory module here. Icons are inline SVG strings embedded
directly in HTML strings/templates (e.g. persona edit/delete buttons, group-char
placeholders use the emoji `👤`; toolbar buttons in index.html embed inline
`<svg>`). Contract: icon helpers, where used, return inline SVG markup (stroke-based
24×24 line icons with `currentColor`) interpolated into element `innerHTML`.

---

## 2. Ambient Effects (effects)

- **Rendering surface**: a full-window `<canvas id="particle-canvas">` sized to
  `window.innerWidth/Height`, resized on window resize. All effects are 2D-canvas
  animations driven by `requestAnimationFrame`.
- **Effects catalog** (11): `none`, `snow`, `rain`, `sparks`, `fireflies`,
  `sakura`, `fog`, `steam`, `aurora`, `leaves`, `darkness`. Each has an emoji used
  for the toolbar button glyph.
- **Per-character setting**: the chosen effect is stored on the character object as
  `particleEffect`, and an intensity (1–100, default 50) as `particleIntensityLevel`,
  both persisted via `saveSingleCharacterToDB`. So the effect is per-character, not
  global, and restored when that character's chat opens.
- **Toggle UI**:
  - `#particle-btn` opens `#particle-picker-modal`. The button glyph/title/active
    class reflect the current character's effect (`updateParticleButton`).
  - The modal contains `.particle-option-btn` items (each `data-effect=<name>`);
    clicking one sets the character's effect, marks it active, shows/hides the
    intensity row (`#particle-intensity-row`, hidden when "none"), persists, starts
    the animation, and updates the button.
  - `#particle-intensity-slider` (+ `#particle-intensity-value` label) adjusts
    intensity live; an `intensityFactor = level/50` scales particle counts and
    opacities. Slider input persists to the character.
  - Closed via `#close-particle-picker-btn` or backdrop click.
- **Lifecycle**: `startParticles(effect, savedIntensity?)` stops any running
  animation, clears the canvas, seeds a particle array sized `BASE * intensityFactor`
  (BASE per effect, e.g. snow 120, rain 150, sparks 140, fireflies 55, sakura 35,
  fog 30, steam 55, aurora 5, leaves 40, darkness 18), and runs a per-effect draw
  loop that bails when `currentParticleEffect` changes. `stopParticles()` cancels
  the frame, clears the canvas, empties the array, sets effect to `none`.
- **Performance considerations**: particle counts scale with intensity and are
  capped to the target each frame (excess trimmed, deficit refilled); a single rAF
  loop per active effect; the loop self-terminates on effect change; canvas cleared
  each frame. Effects use gradients/`globalCompositeOperation='lighter'`/shadowBlur
  for glow (sparks, fireflies, aurora), and `darkness` overlays a dimming fill plus
  a radial vignette.

---

## 3. Media (media)

### 3.1 Background music / YouTube audio

- **UI**: `#music-btn` toggles `#music-panel`; outside-click closes it. Panel has
  `#music-url-input` (placeholder "YouTube or direct audio URL..."), a play/pause
  button `#music-play-btn`, and a stop button `#music-stop-btn`.
- **YouTube handling**: an id-extractor recognizes `youtu.be/…`, `watch?v=…`,
  `embed/…`, `v/…` (11-char id). YouTube URLs cannot play directly in-browser, so
  they are routed to the backend proxy endpoint:
  **`GET /api/yt-audio?url=<encoded original URL>`**, which (server-side, via
  yt-dlp) resolves a direct audio stream piped to an `<audio>` element. Direct
  audio URLs (mp3/ogg/etc.) are used as the `src` as-is.
- **Playback**: a dynamically created `<audio>` (looping) is appended to the body
  and played; play/pause toggles label between "▶ Play" and "⏸ Pause". Stop pauses,
  resets, clears src, and removes the element. On audio `error`, playback stops and
  a toast is shown (Russian message; YouTube vs direct variant).
- **Persistence**: the entered URL is saved to `localStorage` under
  `userMusicUrl:<characterId>` (removed when cleared) — i.e. music URL is
  per-character. A `window._musicFeatureReady` flag is set, and if a URL was
  pre-populated during chat start it auto-plays.

### 3.2 Text-to-speech (TTS)

- Uses the browser `SpeechSynthesis` API; no-ops if unavailable.
- **Voice selection**: `#tts-voice-select` is populated (and repopulated on
  `onvoiceschanged`) with a default option plus voices grouped into English (`en`),
  German (`de`), Japanese (`ja`) optgroups by `lang` prefix. Option value =
  `voiceURI`. The previously chosen voice (`ttsCurrentVoiceURI`) is reselected.
- **Speaking**: `speakText(text, messageId?)` cancels any current utterance, builds
  a `SpeechSynthesisUtterance`, applies the selected voice (by `voiceURI`), and
  speaks. If a `messageId` is given, the corresponding message's `.tts-btn` glyph
  toggles to ⏹ while speaking and back to 🔊 on end.
- **Toggle/persistence**: `#tts-toggle` checkbox bound to setting `ttsEnabled`;
  `#tts-voice-select` bound to setting `ttsVoiceURI` (both via `addSettingListener`
  on change). TTS speaking is invoked from chat code when enabled.

---

## 4. Personas (personas)

- **Data model** (persona object): `id` (`persona-<timestamp>`), `name`, `avatar`
  (image URL/ref resolved via `getImageUrl`), `description`. Stored in a global
  `personas` map and persisted via `savePersonasToDB` (IndexedDB personas store).
- **List modal** (`#persona-list-container`): lists personas filtered by name
  search, sorted alphabetically; each row shows avatar (or 👤 placeholder
  fallback), name, and Edit/Delete buttons (inline SVG icons). Empty states
  distinguish "none created" vs "none found".
- **Editor** (`#persona-editor-modal`, form `personaForm`): fields `#persona-name`,
  `#persona-avatar` (URL), `#persona-description`, plus an avatar preview with
  placeholder. Header switches between "Create new Persona" / "Edit Persona".
  Uploaded avatar held in `tempUploadedImages.personaAvatar` overrides the URL on
  submit. Submit upserts into `personas` (new id on create), persists, closes
  editor, reopens list. Token count + textarea auto-resize maintained.
- **Delete**: confirms via danger confirm dialog, deletes from map, persists,
  refreshes list.
- **Selection in chat** (`#persona-selection-modal` / `#persona-selection-list`):
  lists personas as `.participant-option-btn` buttons (avatar + name). Choosing one
  asks confirmation, then sets `chat.activePersonaId` on the active chat, persists
  the owning character, updates token count, closes the modal, and restarts the
  chat render. Active persona is per-chat and can be unselected anytime.
- **{{user}} resolution**: the active persona's `name` is what `{{user}}` resolves
  to in prompts (and the persona description is fed as user context, e.g. in reply
  suggestions). Resolution itself happens in prompt-building code elsewhere; this
  module only records `activePersonaId` on the chat.

---

## 5. Group Chat Participants (groups)

- **Data model**: a chat has a `participants` array of character ids. By convention
  index 0 is the host (the current character); indices 1+ are "guests". A chat with
  <=1 participant is a normal solo chat (no group UI).
- **Participant icons** (`#participant-icon-list`): renders an avatar wrapper
  (`.participant-icon-wrapper`, `data-char-id`) per guest, with 👤 placeholder
  fallback on image error, plus a trailing remove-hint (`×`).
- **Adding participants** (`#participant-selection-modal` /
  `participantSelectionList`): lists all non-world characters (sorted by name,
  German collation) excluding ones already in the chat, as `.participant-option-btn`
  with avatar+name. Selecting one pushes its id to `participants`, persists the host
  character, updates token count, re-renders icons, closes the modal.
- **Active-speaker / turn-taking**: a global `activeGroupParticipantId` selects
  which guest replies next. A dropdown (`#group-char-dropdown`,
  `.group-char-dropdown-item` per guest, marking the selected one) lets the user
  pick the next speaker; a bubble (`#group-char-bubble` with name element) shows the
  currently targeted participant. `setActiveGroupParticipant(id)` sets the id, shows
  the bubble with the character's chat name, hides the dropdown, focuses input.
  `clearActiveGroupParticipant()` clears it and hides the bubble. (The actual reply
  generation/turn dispatch lives in chat code; this module manages selection UI and
  state.) Display name resolves as `chatName || name`.

---

## 6. Dialogs & Toasts (dialogs)

Self-contained DOM-only module; every dialog dynamically builds an overlay
(`.custom-alert-overlay`) + modal (`.custom-alert-modal`) and appends to body.
Buttons live in `.custom-dialog-buttons` and use `action-btn` (primary),
`secondary-btn`, and `danger-btn` (for destructive confirms).

| Function | Signature | Returns | Behavior |
|---|---|---|---|
| `showToast` | `(message, {duration=1600})` | — | Transient bottom-center toast; fade in via rAF, auto-fade-out and remove after `duration`+200ms; no buttons, no overlay, pointer-events none. (Single positive style; "type"/color is fixed greenish accent — there is no explicit success/error variant arg.) |
| `showCustomAlert` | `(message)` | — | OK-only modal; OK focused; click removes overlay. |
| `showCustomConfirm` | `(message, danger=false)` | `Promise<boolean>` | Cancel/OK; OK gets `danger-btn` when `danger`; resolves true on OK, false on Cancel. |
| `showCustomPrompt` | `(message, defaultValue='')` | `Promise<string|null>` | Single-line text input; Enter confirms, Escape cancels; resolves input value or null. |
| `showCustomLargePrompt` | `(message, placeholder='')` | `Promise<string|null>` | Multi-line textarea (6 rows); Escape cancels (no Enter-submit); resolves text or null. |
| `showChoiceDialog` | `(message, options[])` | `Promise<optValue>` | N custom buttons; each option `{label, value, primary?, extraClass?}`; resolves the clicked option's `value`. |

Notes on contract:
- Toast type semantics are minimal here — the toast is non-blocking and styled with
  a single accent; callers pass only a message string (and optional duration). Any
  "success/error" distinction is conveyed by the message text, not a type arg.
- These dialogs do not themselves freeze body scroll; scroll-locking (if any) is
  handled by the overlay CSS / surrounding modal code, not in this module. Modals
  are removed from the DOM entirely on dismissal (no persistent hidden element).

---

## 7. Endpoints, DOM ids, and IndexedDB summary

**Backend endpoints**: `POST <chat-completions URL>` (per-model or default
OpenAI-compatible, streaming SSE) for all AI generation; `GET /api/yt-audio?url=…`
for YouTube→audio proxy. External (not backend): MediaWiki `…/api.php?action=parse`
for Fandom refs, `https://r.jina.ai/<url>` for other reference pages.

**Key DOM ids**: `#particle-canvas`, `#particle-btn`, `#particle-picker-modal`,
`#particle-intensity-slider/-value/-row`, `#close-particle-picker-btn`,
`#reply-options-dropdown` (`.reply-option-btn`), `#ai-scenario-btn`,
`#ai-generate-char-btn`, `#summarize-memories-btn`, `#scenario-editor-list`,
`#card-name`, `#chat-name`, `#char-description`, `#char-lore`, `#char-tags`,
`#char-reminder`, `#music-btn`, `#music-panel`, `#music-url-input`,
`#music-play-btn`, `#music-stop-btn`, `#tts-voice-select`, `#tts-toggle`,
`#persona-list-container`, `#persona-editor-modal`, `#persona-selection-modal`,
`#persona-selection-list`, `#persona-name/-avatar/-description`,
`#editing-persona-id`, `#participant-icon-list`, `#participant-selection-modal`,
`#group-char-dropdown`, `#group-char-bubble`.

**IndexedDB**: personas persisted via `savePersonasToDB` (personas store);
characters (including `particleEffect`, `particleIntensityLevel`, and per-chat
`participants` / `activePersonaId`) via `saveSingleCharacterToDB`. Music URL and
some settings use `localStorage` (`userMusicUrl:<charId>`), not IndexedDB.

---

## Summary (10 lines)

1. AI generators call an OpenAI-compatible streaming `/v1/chat/completions` endpoint with system+user messages, temp 0.7, top_p 0.95, SSE-parsed.
2. The character/world generator returns a JSON object (cardName/worldName, chatName, description, tags, instructions/lore/worldRules) inserted into editor fields by id.
3. It can read a Fandom (MediaWiki API) or arbitrary (Jina Reader) reference URL, and has brace-counting + truncation-repair JSON parsing.
4. Scenario, auto-summarize, and reply-suggestion generators reuse the same call helper with their own prompts; reply suggestions feed two `.reply-option-btn` buttons.
5. Effects are 11 per-character `requestAnimationFrame` canvas animations on `#particle-canvas`, scaled by a 1–100 intensity; stored on the character and persisted to IndexedDB.
6. Music plays direct audio URLs in an `<audio>` element; YouTube URLs route through backend `GET /api/yt-audio?url=…` (yt-dlp proxy); URL persisted per character in localStorage.
7. TTS uses `SpeechSynthesis` with voices grouped en/de/ja, toggled by `#tts-toggle`, speaking per-message with a ⏹/🔊 button toggle.
8. Personas (`id`,`name`,`avatar`,`description`) support CRUD + per-chat active selection (`chat.activePersonaId`); the persona name resolves `{{user}}`; persisted to the IndexedDB personas store.
9. Group chats keep a `participants` id array (index 0 host, rest guests) with icon list, add-participant modal, and an active-speaker dropdown/bubble (`activeGroupParticipantId`).
10. Dialogs module provides toast (non-blocking, auto-dismiss), alert, confirm (with danger variant), text/large prompt, and choice dialogs — all built/removed dynamically with shared overlay/modal/button classes.
