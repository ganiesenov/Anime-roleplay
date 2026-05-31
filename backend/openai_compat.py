"""
OpenAI-совместимый слой /v1/chat/completions.

Зачем: фронт casual-character-chat шлёт запросы в формате OpenAI
(model, messages, temperature, stream...). Этот модуль принимает их
1-в-1, прогоняет через ТВОЮ логику (llm.py → Ollama), и отдаёт ответ
в OpenAI-совместимом формате — стриминговом (SSE) или обычном.

Точка входа одна. Вся твоя кастомная логика (lorebook, RAG, память)
вставляется в process_messages() ниже — фронт при этом не трогается.

Чтобы подключить: в настройках их приложения впиши
  http://localhost:8000/v1/chat/completions
как "Other provider URL", модель — любую строку (мы её игнорим и
используем OLLAMA_MODEL из .env). API-ключ оставь пустым (isLocal).
"""
import json
import time
import uuid

from fastapi import APIRouter
from fastapi.responses import StreamingResponse, JSONResponse
from pydantic import BaseModel

from . import llm, history

router = APIRouter()


class OpenAIMessage(BaseModel):
    role: str
    content: str


class OpenAIRequest(BaseModel):
    model: str | None = None
    messages: list[OpenAIMessage]
    temperature: float | None = None
    top_p: float | None = None
    stream: bool = False
    options: dict | None = None  # их фронт кладёт сюда num_ctx и т.п.
    # поля, добавленные в их фронт для сохранения истории на бэкенде:
    character_id: str | None = None
    chat_id: str | None = None


def process_messages(messages: list[dict]) -> list[dict]:
    """
    ХУК ДЛЯ ТВОЕЙ ЛОГИКИ.

    Сюда приходят messages, которые собрал фронт
    (system = описание персонажа + lorebook, потом история, потом ввод).

    Сейчас — просто пропускаем как есть. Когда захочешь полный контроль:
    - распарси system, чтобы достать имя персонажа / факты
    - подмешай свой lorebook из бэкенда (lorebook.py)
    - добавь RAG-примеры (faiss)
    - вставь summary длинного диалога (память, фаза 2)
    и верни изменённый список messages.
    """
    return messages


def _extract_options(req: OpenAIRequest) -> dict:
    """Переносит параметры из запроса фронта в опции Ollama."""
    opts = {}
    if req.temperature is not None:
        opts["temperature"] = req.temperature
    if req.top_p is not None:
        opts["top_p"] = req.top_p
    # их фронт кладёт num_ctx в options — пробрасываем в Ollama
    if req.options and "num_ctx" in req.options:
        opts["num_ctx"] = req.options["num_ctx"]
    return opts


@router.post("/v1/chat/completions")
async def chat_completions(req: OpenAIRequest):
    messages = [m.model_dump() for m in req.messages]
    messages = process_messages(messages)  # ← твоя логика тут
    options = _extract_options(req)

    model_name = req.model or "local"
    completion_id = f"chatcmpl-{uuid.uuid4().hex[:24]}"
    created = int(time.time())

    if req.stream:
        async def event_stream():
            full_reply = []  # копим полный ответ для сохранения истории
            # OpenAI SSE: каждый chunk — объект с delta.content
            async for piece in llm.generate_stream(messages, options):
                full_reply.append(piece)
                chunk = {
                    "id": completion_id,
                    "object": "chat.completion.chunk",
                    "created": created,
                    "model": model_name,
                    "choices": [{
                        "index": 0,
                        "delta": {"content": piece},
                        "finish_reason": None,
                    }],
                }
                yield f"data: {json.dumps(chunk, ensure_ascii=False)}\n\n"
            # финальный chunk
            done = {
                "id": completion_id,
                "object": "chat.completion.chunk",
                "created": created,
                "model": model_name,
                "choices": [{"index": 0, "delta": {}, "finish_reason": "stop"}],
            }
            yield f"data: {json.dumps(done, ensure_ascii=False)}\n\n"
            yield "data: [DONE]\n\n"

            # сохраняем историю на бэкенд (после полной генерации)
            if req.character_id:
                try:
                    history.save_history(
                        req.character_id, req.chat_id or "default",
                        messages, reply="".join(full_reply),
                    )
                except Exception as e:
                    print(f"[history] save failed: {e}")

        return StreamingResponse(event_stream(), media_type="text/event-stream")

    # не-стриминговый ответ
    text = await llm.generate(messages, options)
    # сохраняем историю на бэкенд
    if req.character_id:
        try:
            history.save_history(
                req.character_id, req.chat_id or "default", messages, reply=text,
            )
        except Exception as e:
            print(f"[history] save failed: {e}")
    resp = {
        "id": completion_id,
        "object": "chat.completion",
        "created": created,
        "model": model_name,
        "choices": [{
            "index": 0,
            "message": {"role": "assistant", "content": text},
            "finish_reason": "stop",
        }],
        "usage": {"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0},
    }
    return JSONResponse(resp)


@router.get("/v1/models")
async def list_models():
    """
    Их фронт может дёргать /v1/models, чтобы показать список.
    Отдаём одну запись — твою локальную модель.
    """
    health = await llm.health_check()
    model_id = health.get("model", "local")
    return {
        "object": "list",
        "data": [{
            "id": model_id,
            "object": "model",
            "created": int(time.time()),
            "owned_by": "local",
        }],
    }
