"""Spectrum — TG mini-app для детей с РАС. Минимальный aiohttp сервер."""
from aiohttp import web
import datetime
import json
import os
import pathlib

ROOT = pathlib.Path(__file__).parent
STATIC = ROOT / "static"
DATA = pathlib.Path(os.environ.get("DATA_PATH", ROOT / "data"))
DATA.mkdir(parents=True, exist_ok=True)
EVENTS_FILE = DATA / "events.jsonl"


async def index(request: web.Request) -> web.FileResponse:
    return web.FileResponse(STATIC / "index.html")


async def aac(request: web.Request) -> web.FileResponse:
    return web.FileResponse(STATIC / "aac.html")


async def onboarding(request: web.Request) -> web.FileResponse:
    return web.FileResponse(STATIC / "onboarding.html")


async def day(request: web.Request) -> web.FileResponse:
    return web.FileResponse(STATIC / "day.html")


async def api_event(request: web.Request) -> web.Response:
    try:
        payload = await request.json()
    except Exception:
        return web.json_response({"ok": False, "err": "bad_json"}, status=400)
    payload["ts"] = datetime.datetime.now(datetime.timezone.utc).isoformat()
    payload["ip"] = request.remote
    with EVENTS_FILE.open("a") as f:
        f.write(json.dumps(payload, ensure_ascii=False) + "\n")
    return web.json_response({"ok": True})


def make_app() -> web.Application:
    app = web.Application()
    app.router.add_get("/", index)
    app.router.add_get("/aac", aac)
    app.router.add_get("/onboarding", onboarding)
    app.router.add_get("/day", day)
    app.router.add_post("/api/event", api_event)
    app.router.add_static("/static/", STATIC, show_index=False)
    return app


if __name__ == "__main__":
    web.run_app(make_app(), host="0.0.0.0", port=8080)
