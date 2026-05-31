"""
Сборка финального промпта из слоёв.

Структура (по образцу твоего telegram-бота, адаптировано под roleplay):
  [system]
    + system_prompt персонажа
    + персона (description / personality / scenario)
    + lorebook (только релевантные факты)
    + инфо о юзере (user persona)
  [example dialogue]  — как fake user/assistant turns
  [real history]      — последние ходы диалога
  [current user message]
"""
import re
from . import lorebook as lb


def _parse_examples(mes_example: str, char_name: str, user_name: str) -> list[dict]:
    """
    Разбирает mes_example в chat-turns.
    Формат SillyTavern: блоки разделены <START>, строки вида
    {{user}}: ... / {{char}}: ...
    """
    if not mes_example.strip():
        return []

    text = mes_example.replace("{{char}}", char_name).replace("{{user}}", user_name)
    turns: list[dict] = []
    for block in re.split(r"<START>", text, flags=re.IGNORECASE):
        for line in block.strip().splitlines():
            line = line.strip()
            if not line:
                continue
            if line.lower().startswith(f"{user_name.lower()}:"):
                turns.append({"role": "user", "content": line.split(":", 1)[1].strip()})
            elif line.lower().startswith(f"{char_name.lower()}:"):
                turns.append({"role": "assistant", "content": line.split(":", 1)[1].strip()})
    return turns


def build_messages(
    card: dict,
    history: list[dict],
    user_message: str,
    user_persona: dict | None = None,
) -> list[dict]:
    """
    card — карточка персонажа
    history — [{"role": "user"|"assistant", "content": str}, ...] прошлые ходы
    user_message — текущий ввод юзера
    user_persona — {"name": str, "description": str} | None
    """
    char_name = card.get("name", "Character")
    user_name = (user_persona or {}).get("name", "User")

    # --- собираем system ---
    sys_parts: list[str] = []

    if card.get("system_prompt"):
        sys_parts.append(card["system_prompt"].strip())

    sys_parts.append(f"Ты — {char_name}. Отвечай и веди себя строго в характере.")

    if card.get("description"):
        sys_parts.append(card["description"].replace("{{char}}", char_name).replace("{{user}}", user_name).strip())
    if card.get("personality"):
        sys_parts.append(f"Характер: {card['personality'].strip()}")
    if card.get("scenario"):
        sys_parts.append(f"Сцена: {card['scenario'].replace('{{char}}', char_name).replace('{{user}}', user_name).strip()}")

    # --- lorebook: только релевантные факты ---
    # контекст для триггеров = последние ходы + текущее сообщение
    recent = " ".join(m["content"] for m in history[-6:]) + " " + user_message
    facts = lb.select_entries(card.get("lorebook", []), recent)
    rendered = lb.render(facts)
    if rendered:
        sys_parts.append(rendered)

    # --- инфо о юзере ---
    if user_persona and user_persona.get("description"):
        sys_parts.append(f"О собеседнике ({user_name}): {user_persona['description'].strip()}")

    system = "\n\n".join(sys_parts)
    messages: list[dict] = [{"role": "system", "content": system}]

    # --- example dialogue как fake turns ---
    examples = _parse_examples(card.get("mes_example", ""), char_name, user_name)
    messages.extend(examples[:6])

    # --- реальная история ---
    messages.extend(history)

    # --- текущее сообщение ---
    messages.append({"role": "user", "content": user_message})

    return messages
