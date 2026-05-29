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
            viewport=IPHONE, user_agent=UA, has_touch=True, is_mobile=True
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

        # Emotions: start Level 1 and play through
        page = await ctx.new_page()
        page.on("pageerror", lambda e: print(f"  [em-game] ERR: {e}"))
        await page.goto(f"{URL}/emotions", wait_until="networkidle")
        await asyncio.sleep(0.4)
        # Click Level 1
        await page.evaluate("() => document.querySelectorAll('.em-level')[0].click()")
        await asyncio.sleep(0.5)
        await capture(page, "/tmp/spectrum_emotions_game.png")
        # Answer first correctly using runtime knowledge — click whichever option label
        # matches the face emoji. Use a JS probe.
        for i in range(8):
            picked = await page.evaluate("""() => {
              const q = document.getElementById('game-question');
              const face = q.querySelector('.em-q-face')?.textContent;
              const text = q.querySelector('.em-q-text')?.textContent;
              const opts = Array.from(document.querySelectorAll('.em-option'));
              if (face) {
                const map = {'😊':'радость','😢':'грусть','😠':'злость','😨':'страх','😲':'удивление','🤢':'отвращение','😴':'усталость','😌':'спокойствие','😳':'смущение','😎':'гордость','😖':'боль','🥰':'любовь'};
                const want = map[face];
                for (const o of opts) {
                  if (o.textContent.includes(want)) { o.click(); return 'face->'+want; }
                }
              } else if (text) {
                const map = {'радость':'😊','грусть':'😢','злость':'😠','страх':'😨','удивление':'😲','отвращение':'🤢','усталость':'😴','спокойствие':'😌','смущение':'😳','гордость':'😎','боль':'😖','любовь':'🥰'};
                const clean = text.replace(/[«»]/g,'').trim();
                const wantIcon = map[clean];
                for (const o of opts) {
                  if (o.textContent.includes(wantIcon)) { o.click(); return 'text->'+wantIcon; }
                }
              }
              if (opts[0]) { opts[0].click(); return 'fallback'; }
              return 'no-options';
            }""")
            await asyncio.sleep(1.0)
            # Если мы попали в финальный экран — выходим
            done_visible = await page.evaluate(
                "() => !document.querySelector('[data-screen=\"done\"]').hidden"
            )
            if done_visible:
                break
        await capture(page, "/tmp/spectrum_emotions_done.png")
        await page.close()

        await b.close()


if __name__ == "__main__":
    asyncio.run(main())
