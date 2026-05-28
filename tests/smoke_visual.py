"""Visual smoke test: render hub + AAC in iPhone viewport, save screenshots."""
import asyncio
from playwright.async_api import async_playwright


URL = "http://localhost:8080"
IPHONE = {"width": 390, "height": 844}
UA = (
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) "
    "AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1"
)


async def capture(url: str, out_path: str, viewport: dict, ua: str) -> dict:
    async with async_playwright() as p:
        b = await p.chromium.launch(headless=True, args=["--no-sandbox"])
        ctx = await b.new_context(
            viewport=viewport, user_agent=ua, has_touch=True, is_mobile=True
        )
        await ctx.add_init_script(
            "window.__errs__=[]; "
            "window.addEventListener('error', e => window.__errs__.push("
            "{msg:e.message, src:(e.filename||'')+':'+(e.lineno||'')}));"
        )
        page = await ctx.new_page()
        logs: list = []
        page.on("console", lambda m: logs.append(f"[{m.type}] {m.text}"))
        page.on("pageerror", lambda e: logs.append(f"ERR: {e}"))
        await page.goto(url, wait_until="networkidle")
        await asyncio.sleep(1)
        await page.screenshot(path=out_path, full_page=True)
        errs = await page.evaluate("() => window.__errs__")
        title = await page.title()
        await b.close()
        return {"title": title, "errors": errs, "console": logs}


async def main() -> None:
    print("=== HUB ===")
    res = await capture(f"{URL}/", "/tmp/spectrum_hub.png", IPHONE, UA)
    print(f"  title: {res['title']}")
    print(f"  errors: {res['errors']}")
    print(f"  console: {res['console'][:5]}")
    print(f"  screenshot: /tmp/spectrum_hub.png")

    print("\n=== AAC ===")
    res = await capture(f"{URL}/aac", "/tmp/spectrum_aac.png", IPHONE, UA)
    print(f"  title: {res['title']}")
    print(f"  errors: {res['errors']}")
    print(f"  console: {res['console'][:5]}")
    print(f"  screenshot: /tmp/spectrum_aac.png")


if __name__ == "__main__":
    asyncio.run(main())
