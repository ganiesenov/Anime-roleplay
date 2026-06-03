"""
LLM provider abstraction.

Сейчас работает локальный Ollama. Слой провайдера абстрактный:
чтобы переключиться на OpenRouter позже, добавляешь ветку в generate()
и меняешь PROVIDER в .env — остальной код не трогается.
"""
import os
import json
import httpx
from typing import AsyncGenerator

OLLAMA_URL = os.getenv("OLLAMA_URL", "http://localhost:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "huihui_ai/qwen2.5-abliterate:32b-instruct")
PROVIDER = os.getenv("LLM_PROVIDER", "ollama")  # ollama | openrouter

# Параметры генерации по умолчанию (твой проверенный тюнинг)
DEFAULT_OPTIONS = {
    "temperature": 0.75,
    "top_p": 0.9,
    "repeat_penalty": 1.3,
    "num_predict": 400,
}


def _resolve_model(requested: str | None) -> str:
    """Which Ollama model to actually run.

    The frontend may send a concrete downloaded-model tag (picked in the UI) —
    then we use it. The sentinels ''/'local'/'local-qwen' mean "local backend
    default" → fall back to OLLAMA_MODEL from .env.
    """
    r = (requested or "").strip()
    if r and r.lower() not in ("local", "local-qwen"):
        return r
    return OLLAMA_MODEL


async def generate(messages: list[dict], options: dict | None = None,
                   model: str | None = None) -> str:
    """
    messages — список {"role": "system"|"user"|"assistant", "content": str}
    Возвращает полный текст ответа (без стриминга).
    """
    opts = {**DEFAULT_OPTIONS, **(options or {})}

    if PROVIDER == "ollama":
        return await _ollama_generate(messages, opts, _resolve_model(model))
    elif PROVIDER == "openrouter":
        return await _openrouter_generate(messages, opts)
    else:
        raise ValueError(f"Unknown LLM_PROVIDER: {PROVIDER}")


async def generate_stream(messages: list[dict], options: dict | None = None,
                          model: str | None = None) -> AsyncGenerator[str, None]:
    """Стриминговая генерация — отдаёт токены по мере готовности."""
    opts = {**DEFAULT_OPTIONS, **(options or {})}
    if PROVIDER == "ollama":
        async for chunk in _ollama_stream(messages, opts, _resolve_model(model)):
            yield chunk
    else:
        # для не-стриминговых провайдеров — отдаём всё одним куском
        text = await generate(messages, options, model)
        yield text


async def _ollama_generate(messages: list[dict], opts: dict, model: str | None = None) -> str:
    async with httpx.AsyncClient(timeout=300.0) as client:
        resp = await client.post(
            f"{OLLAMA_URL}/api/chat",
            json={
                "model": model or OLLAMA_MODEL,
                "messages": messages,
                "stream": False,
                "options": opts,
            },
        )
        resp.raise_for_status()
        data = resp.json()
        return data["message"]["content"].strip()


async def _ollama_stream(messages: list[dict], opts: dict, model: str | None = None) -> AsyncGenerator[str, None]:
    async with httpx.AsyncClient(timeout=300.0) as client:
        async with client.stream(
            "POST",
            f"{OLLAMA_URL}/api/chat",
            json={
                "model": model or OLLAMA_MODEL,
                "messages": messages,
                "stream": True,
                "options": opts,
            },
        ) as resp:
            resp.raise_for_status()
            async for line in resp.aiter_lines():
                if not line.strip():
                    continue
                data = json.loads(line)
                if data.get("done"):
                    break
                chunk = data.get("message", {}).get("content", "")
                if chunk:
                    yield chunk


async def _openrouter_generate(messages: list[dict], opts: dict) -> str:
    """Заготовка под OpenRouter. Заполнишь, если решишь добавить облако."""
    api_key = os.getenv("OPENROUTER_API_KEY")
    model = os.getenv("OPENROUTER_MODEL", "mistralai/mistral-nemo")
    async with httpx.AsyncClient(timeout=300.0) as client:
        resp = await client.post(
            "https://openrouter.ai/api/v1/chat/completions",
            headers={"Authorization": f"Bearer {api_key}"},
            json={
                "model": model,
                "messages": messages,
                "temperature": opts.get("temperature", 0.75),
                "top_p": opts.get("top_p", 0.9),
                "max_tokens": opts.get("num_predict", 400),
            },
        )
        resp.raise_for_status()
        data = resp.json()
        return data["choices"][0]["message"]["content"].strip()


async def list_ollama_models() -> dict:
    """List of models actually downloaded in Ollama (for the settings picker)."""
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(f"{OLLAMA_URL}/api/tags")
            resp.raise_for_status()
            models = [
                {"name": m.get("name"), "size": m.get("size")}
                for m in resp.json().get("models", []) if m.get("name")
            ]
            return {"ok": True, "default": OLLAMA_MODEL, "models": models}
    except Exception as e:
        return {"ok": False, "error": str(e), "models": []}


async def health_check() -> dict:
    """Проверяет, доступен ли Ollama и стоит ли нужная модель."""
    if PROVIDER != "ollama":
        return {"provider": PROVIDER, "status": "unknown (non-ollama)"}
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(f"{OLLAMA_URL}/api/tags")
            resp.raise_for_status()
            tags = [m["name"] for m in resp.json().get("models", [])]
            model_present = any(OLLAMA_MODEL.split(":")[0] in t for t in tags)
            return {
                "provider": "ollama",
                "url": OLLAMA_URL,
                "model": OLLAMA_MODEL,
                "model_present": model_present,
                "available_models": tags,
            }
    except Exception as e:
        return {"provider": "ollama", "status": "unreachable", "error": str(e)}
