"""
Keyword-triggered lorebook.

Это ядро решения проблемы «путаница фактов»: вместо того чтобы
вываливать ВСЕ факты в промпт, мы подгружаем только те записи,
чьи ключевые слова встретились в недавнем контексте разговора.

Запись lorebook:
{
  "keys": ["настя", "жена"],   # триггеры (регистронезависимо)
  "content": "Настя — жена Артема.",
  "always": false               # always=true → инжектится всегда
}
"""
import re


def select_entries(lorebook: list[dict], context_text: str, max_entries: int = 8) -> list[str]:
    """
    Возвращает content тех записей, чьи ключи встретились в context_text,
    плюс все записи с always=True.

    context_text — склейка последних сообщений (юзер + персонаж) + текущий ввод.
    """
    if not lorebook:
        return []

    haystack = context_text.lower()
    selected: list[str] = []
    seen: set[str] = set()

    # сначала always-записи
    for entry in lorebook:
        content = entry.get("content", "").strip()
        if entry.get("always") and content and content not in seen:
            selected.append(content)
            seen.add(content)

    # затем keyword-триггеры
    for entry in lorebook:
        if entry.get("always"):
            continue
        content = entry.get("content", "").strip()
        if not content or content in seen:
            continue
        keys = entry.get("keys", [])
        for key in keys:
            key = str(key).strip().lower()
            if not key:
                continue
            # \b плохо работает с кириллицей в некоторых случаях,
            # поэтому простое вхождение подстроки + границы по не-буквам
            if _contains_word(haystack, key):
                selected.append(content)
                seen.add(content)
                break

    return selected[:max_entries]


def _contains_word(haystack: str, key: str) -> bool:
    """
    Срабатывает, если key встречается как начало слова в haystack.
    Это важно для флективных языков (русский): ключ «брат» должен
    матчить «брата», «брату», «братом». Левая граница — не-буква,
    справа окончание словоформы допускается.
    """
    pattern = r"(?<![^\W\d_])" + re.escape(key) + r"[\w]*"
    # пояснение: (?<![^\W\d_]) = слева нет буквы (т.е. начало слова),
    # [\w]* = допускаем любое окончание словоформы
    return re.search(pattern, haystack, flags=re.IGNORECASE | re.UNICODE) is not None


def render(entries: list[str]) -> str:
    """Форматирует выбранные факты для вставки в system prompt."""
    if not entries:
        return ""
    lines = "\n".join(f"- {e}" for e in entries)
    return f"Релевантные факты (учитывай их, не путай принадлежность):\n{lines}"
