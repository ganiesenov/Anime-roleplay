"""
Rolling conversation summary — a "story so far" recap of the older turns.

Why: depth-injection keeps the model in-character and RAG re-surfaces specific
old facts, but neither gives the model the overall ARC of a long chat. On very
long conversations Ollama also silently truncates the oldest turns to fit
num_ctx — dropping them entirely. This module condenses the older turns into a
short recap and injects it as a *system* block near the top. Because Ollama
keeps system messages when it truncates, the recap survives even when the raw
old turns are dropped — so the gist is preserved for free.

Design (mirrors rag.py): runs ENTIRELY on the backend over the `messages` the
frontend already sends. It is ADDITIVE — nothing is removed from the prompt, the
recap is just extra context. Degrades silently (returns "") if disabled, the
chat is too short, or the LLM call fails.

Cost control: we summarize only COMPLETE, fixed-size blocks of old messages and
cache each block's summary by a content hash. A block's content never changes
once it's complete, so it's summarized exactly once — the extra LLM call fires
roughly once every SUMMARY_BLOCK_SIZE turns, not every turn. The newest
(partial) block and the recent window stay verbatim in the prompt.

Tuning via env: SUMMARY_ENABLED=0 to disable, SUMMARY_MODEL to use a faster
model for the recap (e.g. llama3.1:8b — recommended, so the big chat model isn't
tied up), SUMMARY_BLOCK_SIZE, SUMMARY_KEEP_RECENT.
"""
import hashlib
import os

from . import llm

ENABLED = os.getenv("SUMMARY_ENABLED", "1") not in ("0", "false", "False")
# Empty → use the main chat model. Set to a small fast model to avoid tying up
# the big model on the recap (the call is serialized through one Ollama).
SUMMARY_MODEL = os.getenv("SUMMARY_MODEL", "").strip()

BLOCK_SIZE = int(os.getenv("SUMMARY_BLOCK_SIZE", "20"))    # msgs per summarized block (~10 turns)
KEEP_RECENT = int(os.getenv("SUMMARY_KEEP_RECENT", "12"))  # newest msgs kept verbatim
MAX_BLOCK_SUMMARY_TOKENS = int(os.getenv("SUMMARY_MAX_TOKENS", "180"))

# Process-lifetime cache: block-content-hash → summary text. A complete block's
# content is immutable, so this is a permanent hit until restart.
_cache: dict[str, str] = {}

# Flips to False after a failed summarize so we stop hammering a missing model.
_available = True

_SUMMARY_SYSTEM = (
    "You compress part of a fictional roleplay transcript into a terse recap. "
    "Write 2-4 sentences in the third person capturing only what MATTERS for "
    "continuity: key events, decisions, revealed facts, relationship shifts, "
    "and unresolved threads. No quotes, no preamble, no commentary, no markdown "
    "— just the recap text."
)


def _key(texts: list[str]) -> str:
    h = hashlib.sha1()
    for t in texts:
        h.update(t.encode("utf-8", "ignore"))
        h.update(b"\x00")
    return h.hexdigest()


def _render_block(block: list[dict]) -> str:
    """Flatten a block of dialog messages into a readable transcript chunk."""
    lines = []
    for m in block:
        who = "User" if m.get("role") == "user" else "Character"
        content = (m.get("content") or "").strip()
        if content:
            lines.append(f"{who}: {content}")
    return "\n".join(lines)


async def _summarize_block(block: list[dict]) -> str:
    """Summarize one complete block, with a permanent per-block cache."""
    transcript = _render_block(block)
    k = _key([transcript])
    if k in _cache:
        return _cache[k]
    prompt = [
        {"role": "system", "content": _SUMMARY_SYSTEM},
        {"role": "user", "content": f"Transcript to recap:\n\n{transcript}"},
    ]
    text = await llm.generate(
        prompt,
        options={"temperature": 0.3, "num_predict": MAX_BLOCK_SUMMARY_TOKENS,
                 "repeat_penalty": 1.1},
        model=SUMMARY_MODEL or None,
    )
    text = (text or "").strip()
    if text:
        _cache[k] = text
    return text


async def rolling_summary(messages: list[dict]) -> str:
    """Recap of the older turns (everything before the recent verbatim window),
    summarized in complete blocks. Returns "" silently if disabled, too short,
    or the LLM call fails."""
    global _available
    if not ENABLED or not _available:
        return ""
    dialog = [m for m in messages if m.get("role") in ("user", "assistant")]
    old = dialog[:-KEEP_RECENT] if len(dialog) > KEEP_RECENT else []
    n_blocks = len(old) // BLOCK_SIZE  # only COMPLETE blocks → stable/cacheable
    if n_blocks == 0:
        return ""
    try:
        summaries = []
        for i in range(n_blocks):
            block = old[i * BLOCK_SIZE:(i + 1) * BLOCK_SIZE]
            s = await _summarize_block(block)
            if s:
                summaries.append(s)
    except Exception as e:
        _available = False
        print(f"[summary] disabled (summarize failed: {e})")
        return ""
    return " ".join(summaries).strip()


def render(summary: str) -> str:
    """Format the recap as a system block."""
    if not summary:
        return ""
    return (
        "[Story so far — recap of earlier parts of this conversation "
        "(established facts, do not repeat verbatim, continue from here):\n"
        f"{summary}\n]"
    )
