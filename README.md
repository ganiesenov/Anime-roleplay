# Roleplay Bot

Локальный character-roleplay чатбот. FastAPI бэкенд + Ollama (локальная модель) + веб-фронт.
Бэкенд держит всю логику (персонажи, lorebook, память, сборку промпта) и сам ходит в Ollama —
браузер общается только с бэкендом, никакой CORS-возни с Ollama.

## Архитектура

```
Браузер (frontend/index.html)
   │  fetch JSON → /api/*
   ▼
FastAPI (backend/)
   ├── llm.py            провайдер: Ollama | OpenRouter
   ├── character.py      карточки персонажей (V2-совместимый JSON)
   ├── lorebook.py       keyword-triggered инжект фактов
   ├── prompt_builder.py сборка промпта из слоёв
   └── main.py           эндпоинты + раздача фронта
   │
   ▼
Ollama (localhost:11434)
```

## Запуск

```bash
# 1. зависимости через uv
cd roleplay-bot
uv venv
source .venv/bin/activate
uv pip install -e .

# 2. конфиг
cp .env.example .env
# при желании поправь OLLAMA_MODEL под свою

# 3. убедись, что Ollama запущен и модель скачана
ollama list
# если нужной модели нет:
# ollama pull huihui_ai/qwen2.5-abliterate:32b-instruct

# 4. запуск бэкенда (раздаёт и фронт)
uvicorn backend.main:app --reload --port 8000
```

Открой http://localhost:8000 — увидишь UI. Слева демо-персонаж «Рэн».

## Проверка по слоям

- `GET http://localhost:8000/api/health` — виден ли Ollama и стоит ли модель
- выбери Рэн → напиши сообщение → должен прийти ответ в характере
- упомяни «брата» или «нож» → сработает lorebook (факт подгрузится в контекст)

## Эндпоинты

| Метод | Путь | Что |
|---|---|---|
| GET | /api/health | статус Ollama + модели |
| GET | /api/characters | список карточек |
| GET | /api/characters/{id} | одна карточка |
| POST | /api/characters | создать/сохранить |
| DELETE | /api/characters/{id} | удалить |
| POST | /api/chat | сгенерировать ответ |
| POST | /api/chat/stream | стрим (SSE) |

## Что дальше (фазы)

- **Фаза 0 (сейчас):** генерация + карточки + базовый lorebook ✅
- **Фаза 1:** редактор lorebook в UI, user-персоны, regenerate/edit сообщений
- **Фаза 2:** многотурновая память + авто-суммаризация длинных диалогов
- **Фаза 3:** RAG/FAISS на example-диалогах для стабильного стиля
- **Опционально:** стриминг в UI, импорт чужих карточек (PNG V2), группы персонажей
