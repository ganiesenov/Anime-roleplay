# Roleplay Bot

Локальный character-roleplay чатбот. FastAPI бэкенд + Ollama (локальная модель) + веб-фронт.
Бэкенд держит всю логику (персонажи, lorebook, память, сборку промпта) и сам ходит в Ollama —
браузер общается только с бэкендом, никакой CORS-возни с Ollama.

Весь стек поднимается одним сервером: `backend/main.py` раздаёт модульный фронт из `my-frontend/`
и отдаёт API. Всё открывается на `http://localhost:8000`.

## Ключевые фичи

**Качество отыгрыша (бэкенд, `openai_compat.py`):**
- **Roleplay-якорь** — в начало промпта вставляется жёсткая инструкция «ты — этот персонаж,
  не ИИ, реплики в `"кавычках"`, действия в `*звёздочках*`». Без неё локальные модели
  сваливаются в режим ассистента.
- **Depth-injection (@D)** — то же напоминание роли дублируется коротко за 4 сообщения до конца
  промпта. В длинных диалогах стартовый якорь «тонет» под историей и маленькие модели теряют
  роль/формат; напоминание у самой точки генерации держит их в характере почти бесплатно.
  В коротких чатах (<6 ходов) не вставляется.
- **Mood** — фронт дописывает приоритетную mood-директиву в конец user-хода (так её слушают
  даже мелкие модели).

**Выбор модели:** UI-настройки реально переключают модель Ollama (`req.model` → `llm._resolve_model`);
discovery скачанных моделей через `/api/ollama/models` и `/api/health`, плюс список OpenRouter.

**Фронт:** редизайн в стиле JanitorAI (emerald dark-glass, лендинг, navbar, категории), главная
в виде Netflix-полок (Favorites / недавние / по категориям), модалка App Settings с провайдерами,
мигающий streaming-курсор, контраст текста выправлен под WCAG AA.

## Архитектура

```
Браузер (my-frontend/index.html)
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

**Быстрый старт (одной командой):**

```bash
./dev.sh            # git pull + сборка frontend-next + запуск сервера
# подкоманды:
./dev.sh run        # просто поднять сервер (без pull/сборки)
./dev.sh restart    # перезапустить сервер на :8000
./dev.sh build      # только пересобрать frontend-next
```

После запуска открывай:
- **http://localhost:8000/next/** — новый фронт (React, актуальный)
- http://localhost:8000/ — старый фронт (legacy, пока жив до полного паритета)

Логи сервера: `/tmp/aria-server.log`. Бэкенд раздаёт **собранный** `frontend-next/dist`,
поэтому после правок в `frontend-next/src` нужен `./dev.sh build` (или `npm run build`).

**Ручной запуск (первый раз / детали):**

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
| GET | /api/ollama/models | список скачанных моделей Ollama |
| POST | /v1/chat/completions | OpenAI-совместимый путь (его использует фронт) |
| GET | /v1/models | OpenAI-совместимый список моделей |

## Что дальше (фазы)

- **Фаза 0:** генерация + карточки + базовый lorebook ✅
- **Фаза 1:** user-персоны, regenerate/edit/continue сообщений, стриминг в UI ✅
- **Качество отыгрыша:** roleplay-якорь + depth-injection + mood, выбор модели в UI ✅
- **Фаза 2 (сейчас):** многотурновая память + авто-суммаризация длинных диалогов
- **Фаза 3:** RAG/FAISS на example-диалогах для стабильного стиля
- **Опционально:** динамический lorebook (scan depth), expression-спрайты, генерация картинок
