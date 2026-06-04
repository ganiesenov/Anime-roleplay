# Aria Frontend — Build Notes

Clean-room JavaScript implementation built purely from `SPEC.md` + the DOM
contract in `index.html` + the CSS custom-property contract in the stylesheets.
Vanilla JS, no framework/bundler. Each file is an IIFE that attaches the
cross-module names listed in the spec to `window`, preserving the global-script
interop contract.

All files pass `node --check`. A load harness (stubbed DOM/window) confirms every
module's top-level IIFE — including `main.js`'s `wire()`/`init()` paths — executes
without runtime `ReferenceError`s.

## Modules & responsibilities (`js/`, in load order)

1. **state.js** — shared mutable globals (`characters`, `personas`, `appSettings`,
   session ids, browse state, `defaultSettings`, `runtimeFlags`), constants
   (`DB_NAME='AriaBD'` v3, `LEGACY_DB_NAME='CasualCharacterChatDB'`,
   `DEFAULT_API_URL`, `PAGE_SIZE=24`, categories, mood emoji, default model list).
2. **utils.js** — text formatting (`formatSubString`, `sanitizeModelText`,
   `splitThink`, `stripThinkTags`), token estimate, `compactNumber`, id/timestamp
   helpers, `imageFileToWebp` (WebP w/ JPEG fallback), textarea/auto-fit helpers,
   `parseHex`, HTML-entity decode.
3. **ui-helpers.js** — screen activeness (`is-inactive` + `pointer-events`), stars
   toggle, navigation (`showMainScreen/showCharacterSelection/showChatList/
   restoreLastSession`), chat-session-list render, and the live-apply
   `applySetting(key,value)` that drives the `:root` CSS custom properties.
4. **storage.js** — IndexedDB open for **AriaBD v3** (stores characters/personas/
   settings), the **one-time legacy migration** from `CasualCharacterChatDB` (only
   when AriaBD is empty), load/save helpers, `normalizeCharacter` round-trip,
   `ensureLocalBackendModel`.
5. **dialogs.js** — toast + alert/confirm(danger)/prompt/large-prompt/choice,
   built/removed dynamically with the shared overlay/modal/button classes.
6. **cards.js** — `buildCharacterCard` (shared by shelves + grid), per-char stats
   (chat/message counts, last-activity, created ts), token estimate.
7. **characters.js** — home rendering: `renderCharacterList` (home-shelves vs
   results-grid branch), shelves, category bar, tag bar, favorites bar,
   pagination, favorite/archive toggles, copy/delete, bulk-delete modal.
8. **personas.js** — persona CRUD, list modal, editor, in-chat selection
   (`chat.activePersonaId`), `{{user}}` source.
9. **groups.js** — participant icons, add-participant modal, active-speaker
   dropdown/bubble (`activeGroupParticipantId`).
10. **chat.js** — the chat core: open/create/switch, message rendering
    (user `.main` vs AI `variations[activeVariant]`), system-prompt assembly
    (labeled `--- SECTION ---` blocks, world/story/dialog branches, mood + memories
    + reply-length), reminder + mood directive on the user turn, SSE streaming with
    think-extraction/typewriter-style incremental render, 90-attempt retry +
    20s/70s timers + abort, regenerate (non-destructive swipe), continue, swipe,
    edit, delete+undo, memories, mood, token estimate, quick-swap, restore-from-server.
11. **settings.js** — design-panel load/apply/persist (one `{key,value}` row per
    setting; checkboxes as `'true'`/`'false'`), responsive limits, model selectors,
    App Settings modal (model entries, drag-reorder, save/reset), Ollama discovery
    via `/api/health`, OpenRouter datalist, restore wiring.
12. **editor.js** — character/world editor (fields, type toggle, world picker,
    scenarios, image upload→WebP staging in `tempUploadedImages`, save to memory +
    IndexedDB), editor + persona token counters, message-editor preview helpers.
13. **tutorial.js** — 8-step phase-tagged spotlight tour, `tutorialInit`,
    `tutorialShowStep`, `tutorialOnScreenChange`, persisted via `tutorialCompleted`.
14. **io.js** — export (`aria_export_<YYYY-MM-DD>.json`, shape
    `{version:3,characters,personas,appSettings}`), import routing, PNG **tEXt
    `chara\0`** V2-card extraction (JSON or base64), JSON card (`spec:chara_card_v*`),
    backup-merge (no-overwrite), external→internal flattening, notes sanitization.
15. **main.js** — DOM lookup, **all** top-level event wiring, branding application,
    starter-pack loader, and the **bootstrap** (openDB → parallel loads → populate
    models → apply settings → starter pack if empty → responsive limits → render
    home → restore session → tutorial → silent server restore).
16. **effects.js** — 11 per-character canvas particle effects on
    `#particle-canvas`, intensity scaling, picker UI, persisted on the character.
17. **media.js** — background music (direct URLs + YouTube via `/api/yt-audio`
    proxy), per-character `userMusicUrl:<id>` localStorage, TTS (SpeechSynthesis,
    en/de/ja voice groups, per-message ⏹/🔊 toggle).
18. **ai-gen.js** — one-shot `callAISimple` streaming helper, model-picker dialog,
    reply suggestions (2-option JSON parse w/ bracket-scan fallback + req-id race
    guard), scenario generator, auto-summarize (last 40 msgs), character/world
    generator (Fandom MediaWiki + Jina reference fetch, robust JSON parse w/
    brace-counting + truncation repair, field insertion by id).

## External-contract decisions (where §2 overrides the §3 detail text)

The §3.x detail sections still use the legacy names ("Isekai",
"Casual Character Chat", `CasualCharacterChatDB`, `casualcharacterchat_export_…`).
Per the task and §2 these are the **clean-room rename targets**, so I followed §2
everywhere it conflicts:

- **DB name** = `AriaBD` (v3), with a one-time copy-migration from the legacy
  `CasualCharacterChatDB` when AriaBD is empty (§2.3). The §3.2/§3.3 mentions of
  `CasualCharacterChatDB` as the live store were treated as legacy.
- **Export filename** = `aria_export_<YYYY-MM-DD>.json`; object shape unchanged.
- **Branding** = "Aria" for title, brand label, loader title, copyright, and the
  tutorial welcome step ("Welcome to Aria!").
- **OpenRouter / one-shot headers** = `X-Title: Aria` (the §3.2/§3.5 `X-Title:
  Casual Character Chat` strings were treated as legacy and renamed).

## Ambiguities / judgment calls

- **index.html branding without editing DOM.** The task allows editing index.html
  *only* for script wiring, but §2.7 requires "Aria" in the title/brand label.
  Resolved by setting `document.title`, `.brand-logo`, loader title and copyright
  **at runtime** in `main.js` `applyBranding()` (the JS legitimately drives the DOM),
  leaving the HTML markup/ids untouched. The script wiring already matched my module
  filenames, so **no edit to index.html was required at all.**
- **`formatSubString` rich-text rules** are unspecified in exact detail; I
  implemented quoted-dialogue → `.dialogue` span (the class the CSS `--dialogue-color`
  targets), `*italics*`/`_italics_` → `<em>`, and newline → `<br>`, all after HTML
  escaping. CSS confirms `.dialogue` consumes `--dialogue-color`.
- **System-prompt wording.** The exact sentence text of each `--- SECTION ---` block
  isn't fixed by the contract (only the section labels/order and which fields feed
  them are). I used faithful, concise phrasings; section **labels and ordering**
  match §6.
- **Streaming "typewriter".** Implemented as incremental re-render of accumulated
  text on each chunk (smooth enough, RAF-friendly) rather than a separate per-char
  scheduler, since only the observable behavior (smooth reveal, instant flush on
  finalize) is contractually required.
- **Reply-length sentence ranges** taken from §6 (short 3–4, medium 6–7, long 9–10,
  verylong 12–13); `default` omits the block.
- **Default design values.** Used the **JS** defaults from §3.4 (fontSize 18,
  spacing 50, dialogueColor #ffd952, bubbles #141414@0.7, blur 5, avatar 200) which
  the spec says win over the differing HTML `value=` attributes; they're applied
  explicitly at load.
- **`savePersonasToDB`** clears + rewrites the personas store so deletions persist
  (the spec calls personas a batch save).
- **Token-estimate overhead** = chars/4 + flat 2000 (§14).
- **Music error toast** kept the Russian message noted in §3.5 (observed contract).
- **PNG keyword parsing** splits on the NUL byte after the `chara` keyword (V2 std).
- **`buildMessagesArray`** drops one trailing user message from mapped history when
  an augmented last-user turn is appended, to avoid duplicating the just-pushed user
  message (send/regenerate share this path; continue appends onto the AI turn).

## What remains / not exercised

- No live backend or real browser was available in this environment, so behavior was
  validated by `node --check`, a stubbed-DOM load harness, and targeted unit tests of
  pure helpers (formatting, think-split, compact-number, hex parse). Visual/runtime
  behavior (streaming against a real SSE endpoint, IndexedDB migration against a real
  legacy DB, canvas effects, drag-reorder) is implemented to contract but not
  end-to-end tested here.
- `starter_pack_data.js` was intentionally **not read** (opaque per instructions);
  the loader consumes whatever global array/object it defines (`STARTER_PACK_DATA`),
  handling both a bare array and a `{characters,personas,appSettings}` wrapper.
