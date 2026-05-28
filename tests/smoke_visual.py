"""Visual smoke test: render all main screens, save screenshots."""
import asyncio
from playwright.async_api import async_playwright


URL = "http://localhost:8080"
IPHONE = {"width": 390, "height": 844}
UA = (
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) "
    "AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1"
)


async def capture(page, out_path: str) -> None:
    await asyncio.sleep(0.6)
    await page.screenshot(path=out_path, full_page=True)


async def main() -> None:
    async with async_playwright() as p:
        b = await p.chromium.launch(headless=True, args=["--no-sandbox"])
        ctx = await b.new_context(
            viewport=IPHONE, user_agent=UA, has_touch=True, is_mobile=True
        )
        await ctx.add_init_script(
            "window.__errs__=[]; window.addEventListener('error', e => window.__errs__.push("
            "{msg:e.message, src:(e.filename||'')+':'+(e.lineno||'')}));"
        )

        # Static screens
        for path, fname in [("/", "hub"), ("/aac", "aac"), ("/onboarding", "onboarding"), ("/day", "day")]:
            page = await ctx.new_page()
            page.on("pageerror", lambda e, fn=fname: print(f"  [{fn}] ERR: {e}"))
            await page.goto(URL + path, wait_until="networkidle")
            await capture(page, f"/tmp/spectrum_{fname}.png")
            errs = await page.evaluate("() => window.__errs__")
            print(f"=== {path} ===  errors: {errs}")
            await page.close()

        # Day → First-Then flow
        page = await ctx.new_page()
        page.on("pageerror", lambda e: print(f"  [day-ft] ERR: {e}"))
        await page.goto(f"{URL}/day", wait_until="networkidle")
        await asyncio.sleep(0.5)
        await page.evaluate(
            "() => document.querySelector('[data-action=open-firstthen]').click()"
        )
        await asyncio.sleep(0.4)
        await capture(page, "/tmp/spectrum_day_firstthen_empty.png")
        # Tap first slot → picker opens
        await page.evaluate("() => document.getElementById('ft-first').click()")
        await asyncio.sleep(0.4)
        await capture(page, "/tmp/spectrum_day_picker.png")
        # Pick first activity
        await page.evaluate("() => document.querySelectorAll('.picker-item')[0].click()")
        await asyncio.sleep(0.4)
        # Pick "Потом" → играть
        await page.evaluate("() => document.getElementById('ft-then').click()")
        await asyncio.sleep(0.3)
        await page.evaluate("""() => {
          const btns = document.querySelectorAll('.picker-item');
          for (const b of btns) {
            if (b.textContent.includes('Играть')) { b.click(); break; }
          }
        }""")
        await asyncio.sleep(0.4)
        await capture(page, "/tmp/spectrum_day_firstthen_filled.png")
        await page.close()

        # Day → Routine flow
        page = await ctx.new_page()
        page.on("pageerror", lambda e: print(f"  [day-rt] ERR: {e}"))
        await page.goto(f"{URL}/day", wait_until="networkidle")
        await asyncio.sleep(0.4)
        await page.evaluate(
            "() => document.querySelector('[data-action=open-routines]').click()"
        )
        await asyncio.sleep(0.4)
        await capture(page, "/tmp/spectrum_day_routines.png")
        # Click first routine (Утро)
        await page.evaluate("() => document.querySelectorAll('.rt-card')[0].click()")
        await asyncio.sleep(0.4)
        await capture(page, "/tmp/spectrum_day_routine_step1.png")
        # Complete 3 steps
        for _ in range(3):
            await page.evaluate("() => document.getElementById('rt-done').click()")
            await asyncio.sleep(0.2)
        await capture(page, "/tmp/spectrum_day_routine_mid.png")
        # Complete all remaining
        for _ in range(10):
            done = await page.evaluate("""() => {
              const btn = document.getElementById('rt-done');
              if (btn && btn.offsetParent !== null) { btn.click(); return false; }
              return true;
            }""")
            if done:
                break
            await asyncio.sleep(0.2)
        await asyncio.sleep(0.4)
        await capture(page, "/tmp/spectrum_day_routine_finished.png")
        await page.close()

        await b.close()


if __name__ == "__main__":
    asyncio.run(main())
