# Aria — roleplay chat app (agent guide)

Local-first character roleplay chat. FastAPI backend proxies an OpenAI-compatible
API to a local **Ollama** server and serves the frontend(s). All chat data lives
**client-side** in the browser's IndexedDB; the backend keeps disk backups.

## Architecture

- **Backend** (`backend/`, FastAPI, run with `uv`):
  - `POST /v1/chat/completions` — OpenAI-compatible, streams from Ollama. `openai_compat.py` injects the roleplay anchor, a depth reminder, RAG snippets (`rag.py`, nomic-embed-text), and a rolling "story so far" summary (`summarize.py`).
  - `/api/*` — health, characters (`character.py` → `data/characters/<id>.json`), chats (`history.py` → `data/chats/<cid>/<chat>.json`), image proxy (`media_proxy.py`, `GET /api/img?url=`).
  - Serves **two** frontends as static files (mount order matters — specific paths before the catch-all `/`):
    - `/` and `/next/` → `frontend-next/dist/`  (new, primary; see below)
    - `/legacy/`       → `my-frontend/`         (legacy, kept; see below)
    - `/starter_pack_data.js` → explicit route serving `my-frontend/starter_pack_data.js` (new app self-seeds from it)
- **Data**: browser IndexedDB **`AriaBD`** (v3), stores `characters` / `personas` / `settings`. The 130 starter characters are seeded from `my-frontend/starter_pack_data.js` (~38 MB, avatars are base64 — **no external URLs**). `data/` is git-ignored (personal).
- **Model**: Ollama at `:11434`. The `/v1` path resolves model id `''`/`local`/`local-qwen` → the `OLLAMA_MODEL` env default; any other id → that exact Ollama tag.

## Two frontends — we are mid-migration (strangler-fig)

The frontend is being rebuilt from **legacy vanilla JS** into a **modern React app**,
screen by screen, WITHOUT breaking the legacy app. The legacy app stays live at `/`
until the new app reaches feature parity, then `/` flips to the new one.

- **Legacy** `my-frontend/` — vanilla JS, no build, loaded as `<script>` tags (modules in `js/`). Fully featured. Style overrides go in `emerald-theme.css` (loaded after `style.css`); **do not edit the `style.css` monolith** — override with `!important` in `emerald-theme.css`.
- **New** `frontend-next/` — **Vite 6 + React 18 + Tailwind v4** (CSS-first, theme tokens in `src/index.css` `@theme{}`, no tailwind.config). Plain JSX (no TS). `base: '/next/'`. Served from `frontend-next/dist` — **the backend serves the BUILT output, so you must `npm run build` after changing `frontend-next/src`.**
  - Same origin as legacy → reads/writes the **same `AriaBD`** (`src/lib/db.js`) and hits the same `/api` + `/v1`. No data migration needed.
  - `ChatView.jsx` is the chat container (state + flows); its view layer is split out into `ChatMessage.jsx` (the `MessageBubble` + photo), `icons.jsx` (glyphs + `CtrlBtn`/`Meter`), and `lib/media.js` (`avatarUrl`/`isVideoUrl`). Peripheral state is extracted into hooks (`hooks/useMusic`, `useTts`, `useSuggestions`, `useChatScroll`, `useLibrary`); the streaming engine stays in the container by design. The `force()`-rerender + in-place mutation → `useReducer`/immutable-state migration is the remaining (deliberately deferred, high-risk) refactor.

### New-frontend port status

DONE (in `frontend-next/`):
- Landing/home: hero, category filter, search, favorites, character grid (reads AriaBD).
- Chat: streaming via `/v1` (sends `character_id`/`chat_id` so backend RAG/summary/depth fire), rAF-coalesced render, dangling-markup balancing, think-blocks, variations + regenerate + swipe, stop, persists to AriaBD. Prompt builder in `src/lib/chat.js` (`buildMessagesArray`) covers the **single-character dialog** path only.
- Character editor (create/edit, avatar upload→base64 or URL, lore/greeting/advanced) + backend sync.
- Chat tools: persona switcher/create, mood selector, memories editor + "summarize now".
- Settings (`src/lib/settings.js`, localStorage): model picker (from `/api/health`), temperature, reply length, show-think, auto-summarize toggle + threshold.
- Chat session list (switch / rename / delete) — header "Chats" panel listing all of a character's chats, newest first, with active highlight and "＋ New". Deleting the active chat falls back to the newest remaining chat (or a fresh one).
- Per-message edit / delete / continue — inline edit (writes to the active variant for AI, `main` for user), delete-this-and-following with an "Undo delete" action, and continue (extends an AI turn in place: keeps its text as a seed and streams a continuation onto the same variant, prompting from history up to that turn). Mirrors the legacy AriaBD record mutations.

- Reply suggestions — after each AI turn (opt-in via the "Suggest replies" setting) a one-shot LLM call returns 2 short first-person user replies, shown as chips above the composer; clicking one drops it into the input. Stale requests are cancelled by id; helper in `src/lib/chat.js` (`suggestReplies` / `parseReplyOptions`).
- Import / export (`src/lib/io.js`) — navbar Import/Export: JSON backup `{version:3, characters, personas, appSettings}` (filename `aria_export_<date>.json`, merge-by-id keeps existing), plus SillyTavern V2 character cards from PNG `tEXt chara` chunks (JSON or base64) and `chara_card_v*` JSON, mapped into the internal character model. Writes straight to AriaBD.
- TTS (`src/lib/tts.js`, SpeechSynthesis) — opt-in "Speak replies" setting + voice picker (grouped en/de/ja); per-AI-message 🔊/⏹ toggle and auto-speak after each reply. Think/HTML/markdown stripped before speaking; speech cancelled on chat switch / unmount.
- Background music (`src/lib/music.js`) — per-character music URL (direct audio or YouTube via the `/api/yt-audio` proxy) with a 🎵 panel in the chat tools bar (play/pause/stop); the URL persists under `userMusicUrl:<characterId>` in localStorage, matching the legacy app.
- Ambient particle effects (`src/lib/particles.js` + `components/ParticleField.jsx`) — per-character full-screen canvas effect (11 options: snow/rain/sparks/fireflies/sakura/fog/steam/aurora/leaves/darkness) with an ✨ Effects picker + intensity slider in the chat tools bar; persists to the character's `particleEffect` / `particleIntensityLevel`.
- Group / multi-character chat (`buildGroupMessages` in `src/lib/chat.js`) — a 👥 Cast panel adds any library character to the scene; the speaker is either pinned or "Auto (rotate)". The group system prompt lists the whole cast, replies only as the active speaker, and history is speaker-labelled; AI bubbles show the speaker's name/avatar. Participants persist in `chat.participants`, the pinned speaker in `chat.activeSpeakerId`. (No separate "world character" type — any chat can become a group.)

NEW (beyond legacy parity — "make it feel real" mechanics):
- Living relationship state (`src/lib/relationship.js`, opt-in "Living relationship" setting) — a per-chat `chat.relationship` `{ affection, trust, tension, mood, beats[] }`. Injected as a system-prompt section (single + group) so the character behaves consistently without naming the numbers, and updated after each AI turn via a one-shot LLM call (`buildRelationshipUpdateMessages` / `parseRelationship`, gradual ±10 moves). The numbers now drive **behaviour**: affection crosses `REL_STAGES` thresholds (cold → wary → warming → close → devoted → inseparable) and `relationshipDirective()` turns the current stage + trust/tension bands into a high-priority "how you act right now" prompt layer (e.g. ≥80 affection → openly affectionate, takes initiative). A 💗 indicator (stage emoji + affection) shows in the chat header. Persists in AriaBD on the chat record.
- Autonomy / anti-sycophancy (opt-in "Autonomy" setting) — a short, high-priority `AUTONOMY_DIRECTIVE` in `src/lib/chat.js` injected right after the character instructions (single + group via `promptOpts.autonomy`) telling the character to keep its own will, opinions and boundaries and not mirror/flatter the user. Kept deliberately concise to limit prompt bloat.
- Living presence / time (`src/lib/presence.js`, opt-in "Living presence" setting) — each character has a deterministic daily sleep schedule (🟢 online / 🌙 asleep badge in the header). A TIME & PRESENCE prompt section gives the speaker awareness of the real time of day and the gap since the last message (single + group, via `promptOpts`). On reopening a chat after a ~3h idle gap the character **texts first** — a proactive AI turn (`sendProactive`, flagged `proactive` so it never stacks) that reacts to the absence. No native push (web), so it triggers on open.
- Off-screen life (`src/lib/offscreen.js`, opt-in "Off-screen life" setting) — when the proactive return turn fires, a one-shot LLM call first writes a short private diary note of what the character did while you were away (`buildOffscreenMessages` / `cleanOffscreen`). It's stored on `chat.diary[]`, stamped onto the proactive message (`msg.offscreen`, shown as a muted "📔 While you were away…" line), and woven into the greeting so "texts first" is grounded in real off-screen events.
- Inner-life viewer — the header 💗 pill opens a read-only panel showing the current relationship **stage** (what it unlocks + what the next stage needs), affection/trust/tension meters, current mood, the relationship "beats", and the off-screen diary entries. Handy for seeing/verifying how the living-state mechanics steer behaviour.
- Persona builder (`components/PersonaModal.jsx`) — "You as" in the chat tools bar is a popover (avatar + name, switch / edit / delete / create); a full modal edits your persona (name, avatar upload/URL, description). Replaces the old `window.prompt` flow. Persisted in AriaBD `personas` (`db.deletePersona` added).
- Per-message actions (Character.AI-inspired) — each message gains Copy, Pin and "New chat from here". **Pin** is an upgrade over a plain bookmark: pinned messages (`msg.pinned`, shown with a 📌 marker) are injected into the prompt as a `--- PINNED ---` section (`promptOpts.pinned`), so the model always keeps them in mind. **New chat from here** (`newChatFromHere`) forks a branch — a new chat seeded with a deep copy of the history up to that message, carrying over persona/participants/memories/relationship.
- Tabbed Settings — `SettingsModal.jsx` is split into a left rail of sections (Model / Roleplay / Photos & Voice / Appearance / Providers / Memory) so you jump straight to what you need instead of one long scroll.
- Writing-style presets (Settings → Model → Writing style: default/novelistic/concise/dialogue/dramatic) — a short `STYLE_DIRECTIVE` prompt layer in `src/lib/chat.js` via `promptOpts.style`.
- Per-character voice — `char.voiceURI` set in the character editor; TTS reads each message in its speaker's own voice (`voiceFor`), falling back to the global default voice.
- Per-message "🎞 animate this moment" — alongside "🖼 illustrate this moment", AI replies get a Film button that renders a short scene-aware clip of that exact beat. It reuses the selfie likeness pipeline (cached `char.appearance` + `tagsFromScene`) and routes the still through ComfyUI + Stable Video Diffusion via `buildVideoUrl` → `/api/img2vid` (animated WebP, plays in the same photo bubble). `generateVideo()` mirrors `generatePhoto()`; `animateMessage()` mirrors `illustrateMessage()`. The manual `/video <tags>` command now shares `generateVideo` so it gets the same likeness. A `loadingKind:'video'` flag on the variant (read by `getMessageLoadingKind`) drives the "animating clip…" copy and a video-specific error hint. The button shows only when video is configured (`videoReady`): local ComfyUI, or a hosted provider with token+model.
- Hosted video provider (no local GPU) — `/api/img2vid?provider=hosted` runs a Replicate-compatible **text-to-video** model (`_hosted_t2v` in `media_proxy.py`: submit with `Prefer: wait`, poll, download). Settings → Photos has a **Video provider** select (Local ComfyUI+SVD / Hosted) with token + model (`videoProvider`/`videoToken`/`videoModel`). `buildVideoUrl` branches on `videoProvider`; hosted returns MP4, so `PhotoMessage` renders a `<video>` when the src is `provider=hosted` (ComfyUI's WebP still uses `<img>`).
- 👗 Wardrobe & scene quick-chips — a `Shirt` button in the composer opens a popover of outfit / pose / location chips (`SCENE_CHIPS`). `quickScene(chip)` sends an in-character Director note, then auto-repaints a fresh photo of the new look (and, for `backdrop` chips, the chat background via `setSceneBackdrop`). Shown only when AI photos are on.
- ✨ Character wizard (Fantasy Builder) — `components/CharacterWizard.jsx`, a 4-step guided creator (Style → Looks → Personality → Finish) with chip pickers. Assembles a working character: Danbooru `appearance` (so photos fire immediately), personality `tags`, a templated description + a vibe-based greeting; optional "Flesh out with AI" (`generateCharacter`/`generateScenario`) and avatar render (`buildPhotoUrl`→`fetchAsDataUrl`). On finish it saves + opens the editor to refine. The nav "Create" and hero CTA launch the wizard (`setShowWizard`); the blank editor is still reachable from empty states.
- Share a single character — editor "🔗 Share code" copies an `ARIA1:<base64>` code to the clipboard (heavy data-URL media stripped to stay pasteable); "Import from code" in the navbar overflow menu decodes + saves under a fresh id. `lib/io.js` adds `exportCharacterCard` / `characterToCode` / `importCode`, all round-tripping through the v3 card format.
- ⚡ Energy economy (opt-in, `settings.energyEconomy`) — gamified balance in `lib/energy.js` (device-global localStorage): photos cost 8⚡, videos 20⚡ (`COST`), earned `+2`/reply and refilled passively (`REGEN_PER_HOUR`). `chargeEnergy(kind)` gates `generatePhoto`/`generateVideo`; an ⚡ meter pill shows in the chat header; low-energy actions show a nudge toast. Toggle in Settings → Roleplay.

MIGRATION COMPLETE:
- Feature parity reached and `/` has been flipped to the new app. The new React frontend is now served at the site root `/` (built with Vite `base: '/'`), and still at `/next/` for old bookmarks. The legacy app moved to `/legacy` (kept, not deleted). `backend/main.py` mounts dist at `/next` + `/` and `my-frontend` at `/legacy`, plus an explicit `/starter_pack_data.js` route so the new app can self-seed its starter pack regardless of mount layout.
- Later parity round (ported the last legacy gaps): AI-generate character/scenario (`src/lib/aigen.js`, ✨ in the editor), per-character background image (editor field + backdrop behind the chat), multiple named greetings/scenarios with a picker on `＋ New chat`, duplicate-character, narrator-reminder field, onboarding tutorial (`TutorialModal.jsx`, first-visit + `?` button), and per-remote-model `num_ctx`. Intentionally NOT ported: UI sound effects (user opt-out), legacy "world/narrator" card type (replaced by group chats), per-model global instruction/reminder overrides (the per-character Instructions/Reminder cover this).

(Note: a structured keyword-scan "lorebook" has no source in the current legacy — lore is a single freeform field, already supported in the editor and prompt — so there is nothing to port there.)

When porting a feature, read the legacy implementation in `my-frontend/js/` first to match prompt shape, data model, and AriaBD record structure exactly, so both UIs stay interoperable.

## Running locally

`./dev.sh` — pull + build `frontend-next` + ensure the server runs (see the script for subcommands `pull`/`build`/`run`/`restart`). Then open **http://localhost:8000/** (new app; also at `/next/`) or `/legacy` (legacy). Requires a local Ollama with a chat model and `nomic-embed-text` pulled. Env: `.env` (see `.env.example`).

Manual: `uv run uvicorn backend.main:app --host 127.0.0.1 --port 8000 --reload`, and `cd frontend-next && npm install && npm run build`.

## Conventions

- **Commits**: short one-line messages, imperative; **no `Co-Authored-By` / self-attribution**.
- **Language**: chat with the user may be Russian, but all app UI text and code/identifiers/comments must be **English**.
- Keep the legacy app working until parity; never delete `my-frontend/`.
- Backend `/v1` requests must keep sending `character_id` + `chat_id` (RAG/summary/history rely on them).
- `data/` and `frontend-next/{node_modules,dist}` are git-ignored — never commit personal data; rebuild `dist` locally.
- After editing `frontend-next/src`, run `npm run build` (the backend serves `dist`, not source).
