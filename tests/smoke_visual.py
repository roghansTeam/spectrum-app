"""Visual smoke test for spectrum-app screens."""
import asyncio
from playwright.async_api import async_playwright


URL = "http://localhost:8080"
IPHONE = {"width": 390, "height": 844}
UA = (
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) "
    "AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1"
)


async def capture(page, out_path: str) -> None:
    await asyncio.sleep(0.5)
    await page.screenshot(path=out_path, full_page=True)


async def main() -> None:
    async with async_playwright() as p:
        b = await p.chromium.launch(headless=True, args=["--no-sandbox"])
        ctx = await b.new_context(
            viewport=IPHONE, user_agent=UA, has_touch=True, is_mobile=True,
            permissions=["microphone"],
        )
        await ctx.add_init_script(
            "window.__errs__=[]; window.addEventListener('error', e => window.__errs__.push("
            "{msg:e.message, src:(e.filename||'')+':'+(e.lineno||'')}));"
        )

        for path, fname in [
            ("/", "hub"),
            ("/aac", "aac"),
            ("/onboarding", "onboarding"),
            ("/day", "day"),
            ("/emotions", "emotions"),
            ("/mood", "mood"),
            ("/stories", "stories"),
        ]:
            page = await ctx.new_page()
            page.on("pageerror", lambda e, fn=fname: print(f"  [{fn}] ERR: {e}"))
            await page.goto(URL + path, wait_until="networkidle")
            await capture(page, f"/tmp/spectrum_{fname}.png")
            errs = await page.evaluate("() => window.__errs__")
            print(f"=== {path} ===  errors: {errs}")
            await page.close()

        # Stories: заполнить форму и нажать generate (ожидаем error без ключа)
        page = await ctx.new_page()
        page.on("pageerror", lambda e: print(f"  [stories-form] ERR: {e}"))
        await page.goto(f"{URL}/stories", wait_until="networkidle")
        await asyncio.sleep(0.4)
        await page.fill("#f-name", "Маша")
        await page.fill("#f-age", "5 лет")
        await page.fill("#f-situation", "первый раз идёт к стоматологу")
        await capture(page, "/tmp/spectrum_stories_filled.png")
        await page.click("#generate-btn")
        await asyncio.sleep(0.4)
        await capture(page, "/tmp/spectrum_stories_loading.png")
        # Wait for error screen
        for _ in range(20):
            await asyncio.sleep(0.5)
            visible = await page.evaluate(
                "() => !document.querySelector('[data-screen=\"error\"]').hidden "
                "|| !document.querySelector('[data-screen=\"story\"]').hidden"
            )
            if visible:
                break
        await capture(page, "/tmp/spectrum_stories_result.png")
        await page.close()

        await b.close()


if __name__ == "__main__":
    asyncio.run(main())
