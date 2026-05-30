"""
Bug report endpoint: parents can flag what's broken without leaving the page.
Writes JSON lines to <DATA>/bug_reports.jsonl — no personal data, just
free-text + URL + UA + timestamp.
"""
from __future__ import annotations

import datetime
import json
import os
import pathlib

from aiohttp import web


DATA = pathlib.Path(os.environ.get("DATA_PATH", pathlib.Path(__file__).resolve().parent.parent / "data"))
DATA.mkdir(parents=True, exist_ok=True)
BUG_FILE = DATA / "bug_reports.jsonl"

MAX_TEXT_LEN = 1000


async def handler(request: web.Request) -> web.Response:
    try:
        payload = await request.json()
    except Exception:
        return web.json_response({"ok": False, "error": "bad_json"}, status=400)

    text = (payload.get("text") or "").strip()
    if not text:
        return web.json_response(
            {"ok": False, "error": "empty_text"}, status=400
        )
    if len(text) > MAX_TEXT_LEN:
        return web.json_response(
            {"ok": False, "error": "too_long", "max": MAX_TEXT_LEN}, status=400
        )

    entry = {
        "ts": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "text": text,
        "page_url": (payload.get("page_url") or "")[:200],
        "module": (payload.get("module") or "")[:50],
        "user_agent": (payload.get("user_agent") or "")[:200],
        "ip": request.remote,
        # Optional client-side trail of recent actions if provided
        "trail": payload.get("trail") if isinstance(payload.get("trail"), list) else None,
    }
    try:
        with BUG_FILE.open("a") as f:
            f.write(json.dumps(entry, ensure_ascii=False) + "\n")
    except Exception as e:
        return web.json_response(
            {"ok": False, "error": "write_failed", "detail": str(e)}, status=500
        )

    return web.json_response({"ok": True})
