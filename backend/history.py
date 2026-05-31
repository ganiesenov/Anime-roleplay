"""
Сохранение истории диалогов на бэкенде (не в браузере).

Каждый запрос от фронта несёт character_id, chat_id и полный список
messages. Мы сохраняем их в data/chats/<character_id>/<chat_id>.json.

Поскольку фронт всегда шлёт ПОЛНУЮ историю, мы просто перезаписываем
файл целиком — это автоматически корректно работает при regenerate
и edit (последнее состояние всегда актуально).

Зачем на бэкенде, а не в браузере:
- не теряется при чистке кэша / смене origin
- доступно с любого устройства
- основа для RAG по прошлым диалогам и авто-суммаризации (память)
"""
import os
import json
import time
import re
from pathlib import Path

CHATS_DIR = Path(os.getenv("CHATS_DIR", "data/chats"))
CHATS_DIR.mkdir(parents=True, exist_ok=True)


def _safe(name: str) -> str:
    """Чистим id для безопасного имени файла/папки."""
    if not name:
        return "unknown"
    return re.sub(r"[^\w\-.]", "_", str(name))[:80]


def save_history(character_id: str, chat_id: str, messages: list[dict],
                 reply: str | None = None) -> Path:
    """
    Сохраняет диалог. messages — то, что прислал фронт (system + история + ввод).
    reply — ответ модели (если уже сгенерирован), добавляется в конец.
    """
    cid = _safe(character_id)
    chid = _safe(chat_id)
    folder = CHATS_DIR / cid
    folder.mkdir(parents=True, exist_ok=True)
    path = folder / f"{chid}.json"

    # отделяем system от диалога — system не часть истории общения
    dialog = [m for m in messages if m.get("role") != "system"]
    system = next((m["content"] for m in messages if m.get("role") == "system"), "")

    record = {
        "character_id": character_id,
        "chat_id": chat_id,
        "system": system,
        "messages": dialog,
        "updated_at": time.time(),
    }
    if reply is not None:
        record["messages"] = dialog + [{"role": "assistant", "content": reply}]

    path.write_text(json.dumps(record, ensure_ascii=False, indent=2), encoding="utf-8")
    return path


def load_history(character_id: str, chat_id: str) -> dict | None:
    path = CHATS_DIR / _safe(character_id) / f"{_safe(chat_id)}.json"
    if not path.exists():
        return None
    return json.loads(path.read_text(encoding="utf-8"))


def list_chats(character_id: str | None = None) -> list[dict]:
    """Список сохранённых чатов (для будущего UI / RAG)."""
    out = []
    folders = [CHATS_DIR / _safe(character_id)] if character_id else CHATS_DIR.iterdir()
    for folder in folders:
        if not folder.is_dir():
            continue
        for p in folder.glob("*.json"):
            try:
                data = json.loads(p.read_text(encoding="utf-8"))
                out.append({
                    "character_id": data.get("character_id"),
                    "chat_id": data.get("chat_id"),
                    "turns": len(data.get("messages", [])),
                    "updated_at": data.get("updated_at"),
                })
            except Exception:
                continue
    return sorted(out, key=lambda x: x.get("updated_at") or 0, reverse=True)
