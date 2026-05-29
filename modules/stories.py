"""
Social Stories AI generator по методологии Carol Gray 10.4 criteria.

Берёт: имя ребёнка, возраст, описание ситуации, опционально доп. контекст.
Возвращает: title + sentences с типами (D / P / A / Dir) в правильных
пропорциях.
"""
from __future__ import annotations

import json
import os
import re
from typing import Any

from aiohttp import web

try:
    import anthropic
except ImportError:
    anthropic = None  # type: ignore


SYSTEM_PROMPT = """Ты пишешь персонализированную социальную историю (social story) \
по методологии Carol Gray (criteria 10.4) для ребёнка с расстройством аутистического \
спектра.

Жёсткие правила:
1. От 1-го лица единственного числа («Я иду в школу...», «Когда я слышу...»).
2. 6-10 предложений. Каждое — короткое и конкретное.
3. Описательный нейтральный тон. Никаких «ты должен», «нельзя», «надо».
4. Конкретные детали (имена, места, времена), без метафор и переносных смыслов.
5. Позитивный, спокойный тон. Не страшилки.
6. Каждое предложение помечается типом:
   - D (Descriptive) — факты: что, кто, где, когда. Должно быть БОЛЬШИНСТВО.
   - P (Perspective) — что чувствуют я и другие, что они думают. ~20%.
   - A (Affirmative) — «обычно», «часто», «большинство людей...» — норма. ~15%.
   - Dir (Directive) — что мне делать. НЕ БОЛЬШЕ 25% (≤ 2 на 10 предложений).
7. Сначала контекст (D), потом чувства (P), потом норма (A), и только в конце 1-2 \
рекомендации (Dir).
8. Никакого юмора, иронии или сложных метафор. Простой буквальный язык.
9. Никаких неправильных утверждений «все люди делают X». Использовать «часто» / «обычно».

Формат ответа — РОВНО ЭТОТ JSON и больше ничего:

{
  "title": "Короткое название (4-7 слов)",
  "sentences": [
    {"text": "Полное предложение.", "type": "D"},
    {"text": "Следующее.", "type": "P"},
    ...
  ]
}

Не добавляй пояснений, markdown-блоков, ничего вне JSON."""


def _build_user_prompt(name: str, age: str, situation: str, extra: str | None) -> str:
    parts = [
        f"Имя ребёнка: {name}",
        f"Возраст: {age}",
        f"Ситуация: {situation}",
    ]
    if extra:
        parts.append(f"Дополнительный контекст: {extra}")
    parts.append(
        "Напиши социальную историю для этой ситуации. "
        "Имя ребёнка используй естественно, можно во 2-3 предложениях для персонификации. "
        "Помни про пропорции: D — основа, P — обязательно, Dir — ≤ 25%."
    )
    return "\n".join(parts)


def _extract_json(text: str) -> dict[str, Any] | None:
    text = text.strip()
    # strip ``` markdown fences
    text = re.sub(r"^```(?:json)?\s*", "", text)
    text = re.sub(r"\s*```$", "", text)
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass
    # try grab first { ... } object
    match = re.search(r"\{.*\}", text, re.DOTALL)
    if match:
        try:
            return json.loads(match.group(0))
        except json.JSONDecodeError:
            return None
    return None


def _validate(story: dict[str, Any]) -> tuple[bool, str]:
    if not isinstance(story.get("title"), str) or not story["title"].strip():
        return False, "missing title"
    sents = story.get("sentences")
    if not isinstance(sents, list) or not sents:
        return False, "missing sentences"
    if len(sents) < 4 or len(sents) > 12:
        return False, f"unexpected sentence count: {len(sents)}"
    allowed = {"D", "P", "A", "Dir"}
    for s in sents:
        if not isinstance(s, dict) or not s.get("text") or s.get("type") not in allowed:
            return False, f"bad sentence: {s!r}"
    # Carol Gray rule: directive ≤ 25%
    dir_count = sum(1 for s in sents if s["type"] == "Dir")
    if dir_count / len(sents) > 0.5:
        return False, "too many directive sentences"
    return True, ""


async def generate_story(
    *,
    name: str,
    age: str,
    situation: str,
    extra: str | None,
) -> dict[str, Any]:
    if anthropic is None:
        return {"ok": False, "error": "anthropic_sdk_missing"}
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        return {"ok": False, "error": "api_key_missing"}

    client = anthropic.AsyncAnthropic(api_key=api_key)
    user_prompt = _build_user_prompt(name, age, situation, extra)

    try:
        msg = await client.messages.create(
            model="claude-sonnet-4-5",
            max_tokens=1024,
            system=SYSTEM_PROMPT,
            messages=[{"role": "user", "content": user_prompt}],
        )
    except Exception as e:
        return {"ok": False, "error": f"anthropic_call_failed: {type(e).__name__}"}

    text_parts = []
    for block in msg.content:
        if getattr(block, "type", None) == "text":
            text_parts.append(block.text)
    raw_text = "\n".join(text_parts).strip()

    story = _extract_json(raw_text)
    if story is None:
        return {"ok": False, "error": "parse_failed", "raw": raw_text[:500]}

    ok, reason = _validate(story)
    if not ok:
        return {"ok": False, "error": "validation_failed", "reason": reason, "raw": story}

    return {
        "ok": True,
        "story": story,
        "tokens": {
            "input": getattr(msg.usage, "input_tokens", None),
            "output": getattr(msg.usage, "output_tokens", None),
        },
    }


async def handler(request: web.Request) -> web.Response:
    try:
        payload = await request.json()
    except Exception:
        return web.json_response({"ok": False, "error": "bad_json"}, status=400)
    name = (payload.get("name") or "").strip()
    age = (payload.get("age") or "").strip()
    situation = (payload.get("situation") or "").strip()
    extra = (payload.get("extra") or "").strip() or None
    if not name or not age or not situation:
        return web.json_response(
            {"ok": False, "error": "missing_fields", "required": ["name", "age", "situation"]},
            status=400,
        )
    if len(name) > 40 or len(age) > 20 or len(situation) > 500:
        return web.json_response({"ok": False, "error": "fields_too_long"}, status=400)

    result = await generate_story(name=name, age=age, situation=situation, extra=extra)
    status = 200 if result.get("ok") else 502
    return web.json_response(result, status=status)
