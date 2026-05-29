"""Visual smoke test for all spectrum-app screens."""
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
        ]:
            page = await ctx.new_page()
            page.on("pageerror", lambda e, fn=fname: print(f"  [{fn}] ERR: {e}"))
            await page.goto(URL + path, wait_until="networkidle")
            await capture(page, f"/tmp/spectrum_{fname}.png")
            errs = await page.evaluate("() => window.__errs__")
            print(f"=== {path} ===  errors: {errs}")
            await page.close()

        # AAC record mode: переключение режима + открытие модалки
        page = await ctx.new_page()
        page.on("pageerror", lambda e: print(f"  [aac-rec] ERR: {e}"))
        await page.goto(f"{URL}/aac", wait_until="networkidle")
        await asyncio.sleep(0.5)
        voice_supported = await page.evaluate(
            "() => window.SP && window.SP.voice && window.SP.voice.isSupported()"
        )
        rec_supported = await page.evaluate(
            "() => window.SP && window.SP.recorder && window.SP.recorder.isSupported()"
        )
        print(f"  voice support: {voice_supported}, recorder: {rec_supported}")
        # Кликаем на mode toggle
        await page.evaluate("() => document.getElementById('mode-toggle').click()")
        await asyncio.sleep(0.3)
        await capture(page, "/tmp/spectrum_aac_record_mode.png")
        # Кликаем на первую карточку — должна открыться модалка
        await page.evaluate("() => document.querySelector('.aac-card').click()")
        await asyncio.sleep(0.4)
        await capture(page, "/tmp/spectrum_aac_record_modal.png")
        await page.close()

        await b.close()


if __name__ == "__main__":
    asyncio.run(main())
