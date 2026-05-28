"""Visual smoke test: render hub + AAC + onboarding stages, save screenshots."""
import asyncio
from playwright.async_api import async_playwright


URL = "http://localhost:8080"
IPHONE = {"width": 390, "height": 844}
UA = (
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) "
    "AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1"
)


async def capture(page, out_path: str) -> None:
    await asyncio.sleep(1)
    await page.screenshot(path=out_path, full_page=True)


async def main() -> None:
    async with async_playwright() as p:
        b = await p.chromium.launch(headless=True, args=["--no-sandbox"])
        ctx = await b.new_context(
            viewport=IPHONE, user_agent=UA, has_touch=True, is_mobile=True
        )
        await ctx.add_init_script(
            "window.__errs__=[]; "
            "window.addEventListener('error', e => window.__errs__.push("
            "{msg:e.message, src:(e.filename||'')+':'+(e.lineno||'')}));"
        )

        for path, fname in [("/", "hub"), ("/aac", "aac"), ("/onboarding", "onboarding")]:
            page = await ctx.new_page()
            logs: list = []
            page.on("console", lambda m: logs.append(f"[{m.type}] {m.text[:80]}"))
            page.on("pageerror", lambda e: logs.append(f"ERR: {e}"))
            await page.goto(URL + path, wait_until="networkidle")
            await capture(page, f"/tmp/spectrum_{fname}.png")
            errs = await page.evaluate("() => window.__errs__")
            print(f"\n=== {path} ===")
            print(f"  title: {await page.title()}")
            print(f"  errors: {errs}")
            print(f"  console (first 4): {logs[:4]}")
            await page.close()

        # Onboarding: интро → начать → q1 → ответ → q2 → ... → result
        page = await ctx.new_page()
        await page.goto(f"{URL}/onboarding", wait_until="networkidle")
        await asyncio.sleep(0.5)
        await page.click("#btn-start")
        await asyncio.sleep(0.5)
        await capture(page, "/tmp/spectrum_onboarding_q1.png")
        # Ответить на все 15 — random middle option (1 = "Иногда")
        for i in range(15):
            options = await page.query_selector_all(".ob-q-option")
            # Pick "Часто" (2) for hyper-group questions to make profile readable
            await options[2].click()
            await asyncio.sleep(0.15)
        await asyncio.sleep(0.5)
        await capture(page, "/tmp/spectrum_onboarding_result.png")
        print("\n=== /onboarding result ===")
        print(f"  title: {await page.title()}")
        await page.close()

        # AAC tabs check
        page = await ctx.new_page()
        await page.goto(f"{URL}/aac", wait_until="networkidle")
        await asyncio.sleep(1)
        n_tabs = await page.evaluate("() => document.querySelectorAll('.aac-tab').length")
        n_cards = await page.evaluate("() => document.querySelectorAll('.aac-card').length")
        print(f"\n=== /aac state ===")
        print(f"  tabs: {n_tabs}")
        print(f"  cards visible: {n_cards}")
        # Switch to feelings category
        await page.evaluate("""() => {
          const tabs = document.querySelectorAll('.aac-tab');
          for (const t of tabs) {
            if (t.textContent.includes('Чувства')) { t.click(); break; }
          }
        }""")
        await asyncio.sleep(0.3)
        await capture(page, "/tmp/spectrum_aac_feelings.png")
        await page.close()

        await b.close()


if __name__ == "__main__":
    asyncio.run(main())
