"""
Character cards. Формат совместим с SillyTavern V2 (subset),
чтобы можно было импортировать чужие карточки и экспортировать свои.

Карточка лежит как JSON в data/characters/<id>.json
"""
import os
import json
import uuid
from pathlib import Path

CHARACTERS_DIR = Path(os.getenv("CHARACTERS_DIR", "data/characters"))
CHARACTERS_DIR.mkdir(parents=True, exist_ok=True)


def _empty_card(name: str = "New Character") -> dict:
    return {
        "id": str(uuid.uuid4())[:8],
        "name": name,
        # description — кто персонаж: личность, манера речи, внешность
        "description": "",
        # personality — краткая выжимка характера (опционально)
        "personality": "",
        # scenario — обстановка/контекст сцены
        "scenario": "",
        # first_mes — приветственное сообщение персонажа
        "first_mes": "",
        # mes_example — примеры диалога (формат: <START>\n{{user}}: ...\n{{char}}: ...)
        "mes_example": "",
        # system_prompt — доп. системные инструкции для модели
        "system_prompt": "",
        # lorebook — список фактов с keyword-триггерами (фаза 2)
        "lorebook": [],  # [{"keys": ["...","..."], "content": "...", "always": false}]
        "tags": [],
    }


def list_characters() -> list[dict]:
    """Краткий список карточек для меню (id + name + tags)."""
    out = []
    for p in sorted(CHARACTERS_DIR.glob("*.json")):
        try:
            card = json.loads(p.read_text(encoding="utf-8"))
            out.append({
                "id": card["id"],
                "name": card.get("name", "Unnamed"),
                "tags": card.get("tags", []),
            })
        except Exception:
            continue
    return out


def get_character(char_id: str) -> dict | None:
    p = CHARACTERS_DIR / f"{char_id}.json"
    if not p.exists():
        return None
    return json.loads(p.read_text(encoding="utf-8"))


def save_character(card: dict) -> dict:
    if not card.get("id"):
        card["id"] = str(uuid.uuid4())[:8]
    # дозаполняем недостающие поля дефолтами
    base = _empty_card()
    base.update(card)
    p = CHARACTERS_DIR / f"{base['id']}.json"
    p.write_text(json.dumps(base, ensure_ascii=False, indent=2), encoding="utf-8")
    return base


def delete_character(char_id: str) -> bool:
    p = CHARACTERS_DIR / f"{char_id}.json"
    if p.exists():
        p.unlink()
        return True
    return False
