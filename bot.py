"""Spectrum — TG mini-app для детей с РАС. Минимальный aiohttp сервер."""
from aiohttp import web
import datetime
import json
import os
import pathlib
import sys

ROOT = pathlib.Path(__file__).parent
STATIC = ROOT / "static"
DATA = pathlib.Path(os.environ.get("DATA_PATH", ROOT / "data"))
DATA.mkdir(parents=True, exist_ok=True)
EVENTS_FILE = DATA / "events.jsonl"

sys.path.insert(0, str(ROOT))
from modules import stories as stories_module  # noqa: E402
from modules import bug_report as bug_report_module  # noqa: E402


async def index(request: web.Request) -> web.FileResponse:
    return web.FileResponse(STATIC / "index.html")


async def aac(request: web.Request) -> web.FileResponse:
    return web.FileResponse(STATIC / "aac.html")


async def onboarding(request: web.Request) -> web.FileResponse:
    return web.FileResponse(STATIC / "onboarding.html")


async def day(request: web.Request) -> web.FileResponse:
    return web.FileResponse(STATIC / "day.html")


async def emotions(request: web.Request) -> web.FileResponse:
    return web.FileResponse(STATIC / "emotions.html")


async def mood(request: web.Request) -> web.FileResponse:
    return web.FileResponse(STATIC / "mood.html")


async def stories(request: web.Request) -> web.FileResponse:
    return web.FileResponse(STATIC / "stories.html")


async def parent(request: web.Request) -> web.FileResponse:
    return web.FileResponse(STATIC / "parent.html")


async def sw(request: web.Request) -> web.FileResponse:
    return web.FileResponse(
        STATIC / "sw.js",
        headers={"Service-Worker-Allowed": "/", "Cache-Control": "no-cache"},
    )


async def manifest(request: web.Request) -> web.FileResponse:
    return web.FileResponse(STATIC / "manifest.webmanifest")


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
    app.router.add_get("/emotions", emotions)
    app.router.add_get("/mood", mood)
    app.router.add_get("/stories", stories)
    app.router.add_get("/parent", parent)
    app.router.add_get("/sw.js", sw)
    app.router.add_get("/manifest.webmanifest", manifest)
    app.router.add_post("/api/event", api_event)
    app.router.add_post("/api/stories/generate", stories_module.handler)
    app.router.add_post("/api/bug-report", bug_report_module.handler)
    app.router.add_static("/static/", STATIC, show_index=False)
    return app


if __name__ == "__main__":
    web.run_app(make_app(), host="0.0.0.0", port=8080)
