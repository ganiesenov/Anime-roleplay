"""
Local RAG memory — retrieve the most relevant OLD messages and re-inject them.

Why: depth-injection + lorebook keep the model in-character, but on long chats
the model still forgets facts buried 50 turns back (they fall out of the context
window). This embeds the conversation's older messages with a local Ollama
embedding model, finds the ones semantically closest to what the user just said,
and surfaces them as a short "relevant past context" block near the top.

Design: runs ENTIRELY on the backend, operating on the `messages` the frontend
already sends to /v1/chat/completions — so there are zero frontend changes. If no
embedding model is installed it degrades silently (returns []), so the app keeps
working without it.

Embedding model: nomic-embed-text by default (`ollama pull nomic-embed-text`),
override with RAG_EMBED_MODEL. Disable entirely with RAG_ENABLED=0.
"""
import hashlib
import math
import os

import httpx

OLLAMA_URL = os.getenv("OLLAMA_URL", "http://localhost:11434")
EMBED_MODEL = os.getenv("RAG_EMBED_MODEL", "nomic-embed-text")
ENABLED = os.getenv("RAG_ENABLED", "1") not in ("0", "false", "False")

# Tuning (ST-style starting points).
RECENT_SKIP = int(os.getenv("RAG_RECENT_SKIP", "8"))   # last N turns are already in-context
TOP_K = int(os.getenv("RAG_TOP_K", "3"))               # how many old snippets to surface
MIN_POOL = int(os.getenv("RAG_MIN_POOL", "6"))         # need at least this many old msgs to bother
SIM_THRESHOLD = float(os.getenv("RAG_SIM_THRESHOLD", "0.5"))  # cosine floor (nomic runs high)
MAX_SNIPPET_CHARS = 600                                 # trim each surfaced snippet

# Process-lifetime cache: text-hash → embedding vector. Avoids re-embedding the
# same message every turn. Fine to lose on restart.
_cache: dict[str, list[float]] = {}

# Flips to False after a failed embed so we stop hammering a missing model.
_available = True


def _key(text: str) -> str:
    return hashlib.sha1(text.encode("utf-8", "ignore")).hexdigest()


async def _embed_one(client: httpx.AsyncClient, text: str) -> list[float] | None:
    k = _key(text)
    if k in _cache:
        return _cache[k]
    resp = await client.post(
        f"{OLLAMA_URL}/api/embeddings",
        json={"model": EMBED_MODEL, "prompt": text},
    )
    resp.raise_for_status()
    vec = resp.json().get("embedding")
    if not vec:
        return None
    _cache[k] = vec
    return vec


def _cosine(a: list[float], b: list[float]) -> float:
    if not a or not b or len(a) != len(b):
        return 0.0
    dot = sum(x * y for x, y in zip(a, b))
    na = math.sqrt(sum(x * x for x in a))
    nb = math.sqrt(sum(y * y for y in b))
    if na == 0 or nb == 0:
        return 0.0
    return dot / (na * nb)


def _pool_and_query(messages: list[dict]) -> tuple[list[str], str]:
    """Split into (older-pool, query). Query = last user message; pool = dialog
    messages older than the last RECENT_SKIP (those are already in context)."""
    dialog = [m for m in messages if m.get("role") in ("user", "assistant")]
    query = ""
    for m in reversed(dialog):
        if m.get("role") == "user":
            query = (m.get("content") or "").strip()
            break
    pool_msgs = dialog[:-RECENT_SKIP] if len(dialog) > RECENT_SKIP else []
    pool = [(m.get("content") or "").strip() for m in pool_msgs]
    # drop empties / very short noise
    pool = [p for p in pool if len(p) >= 12]
    return pool, query


async def relevant_snippets(messages: list[dict]) -> list[str]:
    """Returns up to TOP_K old-message snippets most relevant to the latest user
    turn. Returns [] (silently) if disabled, no model, or nothing relevant."""
    global _available
    if not ENABLED or not _available:
        return []
    pool, query = _pool_and_query(messages)
    if not query or len(pool) < MIN_POOL:
        return []
    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            qvec = await _embed_one(client, query)
            if not qvec:
                return []
            scored: list[tuple[float, str]] = []
            for text in pool:
                vec = await _embed_one(client, text)
                if not vec:
                    continue
                sim = _cosine(qvec, vec)
                if sim >= SIM_THRESHOLD:
                    scored.append((sim, text))
    except Exception as e:
        # Most likely the embed model isn't pulled — disable for this process.
        _available = False
        print(f"[rag] disabled (embed failed: {e})")
        return []

    scored.sort(key=lambda t: t[0], reverse=True)
    out = []
    for _sim, text in scored[:TOP_K]:
        out.append(text[:MAX_SNIPPET_CHARS])
    return out


def render(snippets: list[str]) -> str:
    """Format retrieved snippets as a system block."""
    if not snippets:
        return ""
    lines = "\n".join(f"- {s}" for s in snippets)
    return (
        "[Relevant context recalled from earlier in this conversation "
        "(may be far back — treat as established facts, do not repeat verbatim):\n"
        f"{lines}\n]"
    )
