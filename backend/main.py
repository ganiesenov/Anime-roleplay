"""
FastAPI бэкенд roleplay-чатбота.

Эндпоинты:
  GET  /api/health              — статус Ollama + модели
  GET  /api/characters          — список карточек
  GET  /api/characters/{id}     — одна карточка
  POST /api/characters          — создать/сохранить карточку
  DELETE /api/characters/{id}   — удалить
  POST /api/chat                — сгенерировать ответ (полный)
  POST /api/chat/stream         — сгенерировать ответ (стрим, SSE)

Фронт (модульный) раздаётся статикой из ../my-frontend
"""
import os
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.responses import StreamingResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from . import llm, character, prompt_builder, openai_compat, history, youtube_audio, media_proxy

app = FastAPI(title="Roleplay Bot")

# CORS — на случай если фронт открыт с другого порта при разработке
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# OpenAI-совместимый слой (/v1/chat/completions) для внешних фронтов
app.include_router(openai_compat.router)

# YouTube → audio proxy (/api/yt-audio) — играет звук из YouTube в <audio>,
# минуя нерабочий iframe-embed
app.include_router(youtube_audio.router)

# Image proxy (/api/img?url=) — тянет внешние аватары/фоны сервером, обходя
# ISP-блокировки/CORS внешнего хоста (см. media_proxy.py)
app.include_router(media_proxy.router)


# ---------- модели запросов ----------
class Turn(BaseModel):
    role: str
    content: str


class UserPersona(BaseModel):
    name: str = "User"
    description: str = ""


class ChatRequest(BaseModel):
    character_id: str
    message: str
    history: list[Turn] = []
    user_persona: UserPersona | None = None
    options: dict | None = None  # temperature, num_predict и т.д.


# ---------- health ----------
@app.get("/api/health")
async def health():
    return await llm.health_check()


# ---------- Ollama: list of downloaded models (for the settings picker) ----------
@app.get("/api/ollama/models")
async def ollama_models():
    return await llm.list_ollama_models()


# ---------- characters ----------
@app.get("/api/characters")
async def get_characters():
    return character.list_characters()


@app.get("/api/characters/{char_id}")
async def get_character(char_id: str):
    card = character.get_character(char_id)
    if not card:
        raise HTTPException(404, "Character not found")
    return card


@app.post("/api/characters")
async def post_character(card: dict):
    return character.save_character(card)


@app.delete("/api/characters/{char_id}")
async def remove_character(char_id: str):
    ok = character.delete_character(char_id)
    if not ok:
        raise HTTPException(404, "Character not found")
    return {"deleted": char_id}


# ---------- chat ----------
def _build(req: ChatRequest):
    card = character.get_character(req.character_id)
    if not card:
        raise HTTPException(404, "Character not found")
    history = [t.model_dump() for t in req.history]
    persona = req.user_persona.model_dump() if req.user_persona else None
    return prompt_builder.build_messages(card, history, req.message, persona)


@app.post("/api/chat")
async def chat(req: ChatRequest):
    messages = _build(req)
    reply = await llm.generate(messages, req.options)
    return {"reply": reply}


@app.post("/api/chat/stream")
async def chat_stream(req: ChatRequest):
    messages = _build(req)

    async def event_gen():
        async for chunk in llm.generate_stream(messages, req.options):
            # SSE-формат: data: <text>\n\n
            yield f"data: {chunk}\n\n"
        yield "data: [DONE]\n\n"

    return StreamingResponse(event_gen(), media_type="text/event-stream")


# ---------- история диалогов (сохранённая на бэкенде) ----------
@app.get("/api/chats")
async def get_chats(character_id: str | None = None):
    return history.list_chats(character_id)


@app.get("/api/chats/{character_id}/{chat_id}")
async def get_chat_history(character_id: str, chat_id: str):
    h = history.load_history(character_id, chat_id)
    if not h:
        raise HTTPException(404, "Chat history not found")
    return h


# ---------- статика (фронт) ----------
# Раздаём весь модульный фронт из ../frontend прямо по корню.
# html=True → "/" отдаёт index.html, а ассеты (js/, style.css, gallery/, *.html)
# доступны по их относительным путям. Монтируется ПОСЛЕДНИМ, поэтому /api/* и
# /v1/* (объявленные выше) перехватываются раньше этого catch-all.
FRONTEND_DIR = Path(__file__).parent.parent / "my-frontend"
if FRONTEND_DIR.exists():
    app.mount("/", StaticFiles(directory=str(FRONTEND_DIR), html=True), name="frontend")
