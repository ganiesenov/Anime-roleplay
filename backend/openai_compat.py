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

from . import llm, history, rag, summarize

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


# Ролевой якорь. Фронт casual-character-chat шлёт богатую карточку персонажа
# в system, но БЕЗ явной команды «ты — этот персонаж». Сильные облачные модели
# (GLM и т.п.) и так понимают, что это отыгрыш, а локальные (qwen и др.) без
# прямого указания сваливаются в режим ассистента ("As an AI I don't have
# emotions..."). Этот префикс — тот же якорь, что prompt_builder.build_messages
# добавляет на пути /api/chat. Без него /v1/chat/completions терял роль.
ROLEPLAY_ANCHOR = (
    "You are an actor fully embodying the character described below. "
    "This is a fictional roleplay. Stay in character at ALL times. "
    "Never say or imply that you are an AI, an assistant, a language model, "
    "or a program. Never break the fourth wall, never give disclaimers, and "
    "never refuse in-character. Speak and act ONLY as the character, in the "
    "first person, reacting naturally to the user.\n"
    # Формат для фронта: реплики в \"кавычках\" красятся в dialogueColor,
    # *звёздочки* рендерятся курсивом (действия/нарратив). Без этого ответ
    # выходит одним цветом — поэтому явно просим такой формат.
    "FORMAT every reply as roleplay prose: put everything the character says "
    "out loud inside \"double quotes\", and write all physical actions, "
    "gestures, expressions and narration wrapped in *asterisks*. Do not write "
    "plain unformatted paragraphs.\n\n"
)


# ── Depth-injection (@D) ───────────────────────────────────────────────────
# Короткое напоминание роли, вставляемое НЕ в начало промпта, а на фиксированной
# глубине от его КОНЦА. Зачем: стартовый ROLEPLAY_ANCHOR в длинном диалоге
# оказывается далеко от точки генерации, и маленькие локальные модели (qwen и
# др.) теряют роль/формат под весом истории. Reminder за DEPTH_INJECTION_DEPTH
# сообщений до низа держит модель в роли почти бесплатно (несколько токенов).
# Это backend-аналог mood-директивы, которую фронт дописывает в конец user-хода.
DEPTH_REMINDER = (
    "[Reminder: you are still the character described above. Stay fully in "
    "character, never break role or mention being an AI/assistant. Keep the "
    'format — spoken words in "double quotes", actions and narration in '
    "*asterisks*.]"
)
# На сколько сообщений выше низа вставлять напоминание (ST-дефолт ~4).
DEPTH_INJECTION_DEPTH = 4
# Не вставляем в коротких чатах — там стартовый якорь и так рядом с генерацией.
DEPTH_MIN_MESSAGES = 6


def inject_depth_reminder(
    messages: list[dict], depth: int = DEPTH_INJECTION_DEPTH
) -> list[dict]:
    """Вставляет DEPTH_REMINDER на `depth` сообщений выше конца списка.

    Считаем длину по реальным ходам диалога (без system). В коротких чатах
    (< DEPTH_MIN_MESSAGES ходов) ничего не делаем. Reminder никогда не встаёт
    перед стартовым system-якорем — минимум на позиции 1.
    """
    convo_len = sum(1 for m in messages if m.get("role") != "system")
    if convo_len < DEPTH_MIN_MESSAGES:
        return messages
    idx = len(messages) - depth
    floor = 1 if (messages and messages[0].get("role") == "system") else 0
    idx = max(idx, floor)
    reminder = {"role": "system", "content": DEPTH_REMINDER}
    return messages[:idx] + [reminder] + messages[idx:]


def process_messages(messages: list[dict]) -> list[dict]:
    """
    ХУК ДЛЯ ТВОЕЙ ЛОГИКИ.

    Сюда приходят messages, которые собрал фронт
    (system = описание персонажа + lorebook, потом история, потом ввод).

    Что делаем: добавляем ROLEPLAY_ANCHOR в начало системного сообщения,
    чтобы локальные модели держали роль (см. коммент к ROLEPLAY_ANCHOR).
    Если system-сообщения нет — вставляем якорь отдельным system в начало.

    Дальше при желании можно расширять:
    - подмешать свой lorebook из бэкенда (lorebook.py)
    - добавить RAG-примеры (faiss)
    - вставить summary длинного диалога (память, фаза 2)
    """
    if messages and messages[0].get("role") == "system":
        messages[0] = {
            **messages[0],
            "content": ROLEPLAY_ANCHOR + messages[0].get("content", ""),
        }
    else:
        messages = [{"role": "system", "content": ROLEPLAY_ANCHOR.strip()}, *messages]
    # @D: дублируем напоминание роли близко к концу промпта (см. inject_depth_reminder)
    messages = inject_depth_reminder(messages)
    return messages


async def inject_rag(messages: list[dict]) -> list[dict]:
    """RAG-память: достаёт релевантные старые сообщения (эмбеддинги Ollama) и
    вставляет их компактным system-блоком сразу после стартового якоря. Если
    embed-модель не стоит / ничего не нашлось — список не меняется (rag.py молча
    отдаёт []). См. backend/rag.py."""
    snippets = await rag.relevant_snippets(messages)
    block = rag.render(snippets)
    if not block:
        return messages
    rag_msg = {"role": "system", "content": block}
    # после стартового system-якоря (idx 0), если он есть
    idx = 1 if (messages and messages[0].get("role") == "system") else 0
    return messages[:idx] + [rag_msg] + messages[idx:]


async def inject_summary(messages: list[dict]) -> list[dict]:
    """Rolling-summary память: сжимает старые ходы диалога в короткий «story so
    far» и вставляет его system-блоком сразу после стартового якоря. Аддитивно
    (ничего не удаляет); system-блок переживает обрезку контекста Ollama, поэтому
    суть длинного чата сохраняется, даже когда сырые старые ходы выпадают. Если
    выключено / чат короткий / суммаризация упала — список не меняется (молча
    отдаёт ""). См. backend/summarize.py."""
    summary = await summarize.rolling_summary(messages)
    block = summarize.render(summary)
    if not block:
        return messages
    summ_msg = {"role": "system", "content": block}
    idx = 1 if (messages and messages[0].get("role") == "system") else 0
    return messages[:idx] + [summ_msg] + messages[idx:]


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
    messages = await inject_rag(messages)      # ← RAG: конкретные релевантные старые сообщения
    messages = await inject_summary(messages)  # ← rolling summary: «story so far» (встаёт над RAG)
    options = _extract_options(req)

    model_name = req.model or "local"
    completion_id = f"chatcmpl-{uuid.uuid4().hex[:24]}"
    created = int(time.time())

    if req.stream:
        async def event_stream():
            full_reply = []  # копим полный ответ для сохранения истории
            # OpenAI SSE: каждый chunk — объект с delta.content
            async for piece in llm.generate_stream(messages, options, model=req.model):
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
    text = await llm.generate(messages, options, model=req.model)
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
