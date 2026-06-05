# Aria — roleplay chat app (agent guide)

Local-first character roleplay chat. FastAPI backend proxies an OpenAI-compatible
API to a local **Ollama** server and serves the frontend(s). All chat data lives
**client-side** in the browser's IndexedDB; the backend keeps disk backups.

## Architecture

- **Backend** (`backend/`, FastAPI, run with `uv`):
  - `POST /v1/chat/completions` — OpenAI-compatible, streams from Ollama. `openai_compat.py` injects the roleplay anchor, a depth reminder, RAG snippets (`rag.py`, nomic-embed-text), and a rolling "story so far" summary (`summarize.py`).
  - `/api/*` — health, characters (`character.py` → `data/characters/<id>.json`), chats (`history.py` → `data/chats/<cid>/<chat>.json`), image proxy (`media_proxy.py`, `GET /api/img?url=`).
  - Serves **two** frontends as static files (mount order matters — `/next` before the catch-all `/`):
    - `/`      → `my-frontend/`            (legacy, see below)
    - `/next/` → `frontend-next/dist/`     (new, see below)
- **Data**: browser IndexedDB **`AriaBD`** (v3), stores `characters` / `personas` / `settings`. The 130 starter characters are seeded from `my-frontend/starter_pack_data.js` (~38 MB, avatars are base64 — **no external URLs**). `data/` is git-ignored (personal).
- **Model**: Ollama at `:11434`. The `/v1` path resolves model id `''`/`local`/`local-qwen` → the `OLLAMA_MODEL` env default; any other id → that exact Ollama tag.

## Two frontends — we are mid-migration (strangler-fig)

The frontend is being rebuilt from **legacy vanilla JS** into a **modern React app**,
screen by screen, WITHOUT breaking the legacy app. The legacy app stays live at `/`
until the new app reaches feature parity, then `/` flips to the new one.

- **Legacy** `my-frontend/` — vanilla JS, no build, loaded as `<script>` tags (modules in `js/`). Fully featured. Style overrides go in `emerald-theme.css` (loaded after `style.css`); **do not edit the `style.css` monolith** — override with `!important` in `emerald-theme.css`.
- **New** `frontend-next/` — **Vite 6 + React 18 + Tailwind v4** (CSS-first, theme tokens in `src/index.css` `@theme{}`, no tailwind.config). Plain JSX (no TS). `base: '/next/'`. Served from `frontend-next/dist` — **the backend serves the BUILT output, so you must `npm run build` after changing `frontend-next/src`.**
  - Same origin as legacy → reads/writes the **same `AriaBD`** (`src/lib/db.js`) and hits the same `/api` + `/v1`. No data migration needed.

### New-frontend port status

DONE (in `frontend-next/`):
- Landing/home: hero, category filter, search, favorites, character grid (reads AriaBD).
- Chat: streaming via `/v1` (sends `character_id`/`chat_id` so backend RAG/summary/depth fire), rAF-coalesced render, dangling-markup balancing, think-blocks, variations + regenerate + swipe, stop, persists to AriaBD. Prompt builder in `src/lib/chat.js` (`buildMessagesArray`) covers the **single-character dialog** path only.
- Character editor (create/edit, avatar upload→base64 or URL, lore/greeting/advanced) + backend sync.
- Chat tools: persona switcher/create, mood selector, memories editor + "summarize now".
- Settings (`src/lib/settings.js`, localStorage): model picker (from `/api/health`), temperature, reply length, show-think, auto-summarize toggle + threshold.
- Chat session list (switch / rename / delete) — header "Chats" panel listing all of a character's chats, newest first, with active highlight and "＋ New". Deleting the active chat falls back to the newest remaining chat (or a fresh one).
- Per-message edit / delete — inline edit (writes to the active variant for AI, `main` for user) and delete-this-and-following with an "Undo delete" action; mirrors the legacy AriaBD record mutations.

NOT YET PORTED (the remaining migration work — port from `my-frontend/js/` to `frontend-next/`):
- World / story / multi-character (group) chat prompt paths (legacy `buildSystemPrompt` has them).
- Lorebook keyword-scan + token budget (legacy `js/lorebook.js`).
- Reply suggestions, TTS, ambient effects/music.
- Per-message continue (extend the last AI turn in place).
- Import / export (legacy `js/io.js`: JSON backup + SillyTavern V2 PNG/JSON cards).
- Final step once at parity: flip `/` to the new app (change the StaticFiles mount in `backend/main.py`).

When porting a feature, read the legacy implementation in `my-frontend/js/` first to match prompt shape, data model, and AriaBD record structure exactly, so both UIs stay interoperable.

## Running locally

`./dev.sh` — pull + build `frontend-next` + ensure the server runs (see the script for subcommands `pull`/`build`/`run`/`restart`). Then open **http://localhost:8000/next/** (new) or `/` (legacy). Requires a local Ollama with a chat model and `nomic-embed-text` pulled. Env: `.env` (see `.env.example`).

Manual: `uv run uvicorn backend.main:app --host 127.0.0.1 --port 8000 --reload`, and `cd frontend-next && npm install && npm run build`.

## Conventions

- **Commits**: short one-line messages, imperative; **no `Co-Authored-By` / self-attribution**.
- **Language**: chat with the user may be Russian, but all app UI text and code/identifiers/comments must be **English**.
- Keep the legacy app working until parity; never delete `my-frontend/`.
- Backend `/v1` requests must keep sending `character_id` + `chat_id` (RAG/summary/history rely on them).
- `data/` and `frontend-next/{node_modules,dist}` are git-ignored — never commit personal data; rebuild `dist` locally.
- After editing `frontend-next/src`, run `npm run build` (the backend serves `dist`, not source).
