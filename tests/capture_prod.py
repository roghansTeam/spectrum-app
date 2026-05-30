"""Capture full production screenshots for README / docs.

Запуск:
    .venv/bin/python tests/capture_prod.py

Перезапишет файлы в docs/screenshots/. После этого `git add docs/screenshots`
+ commit с описанием что обновлено.
"""
import asyncio
import pathlib
from playwright.async_api import async_playwright

URL = "https://spectrum-app.fly.dev"
OUT_DIR = pathlib.Path(__file__).parent.parent / "docs" / "screenshots"
OUT_DIR.mkdir(parents=True, exist_ok=True)

UA = (
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) "
    "AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Telegram-iOS"
)


async def snap(ctx, path, out_name, *, post_action=None):
    page = await ctx.new_page()
    await page.goto(f"{URL}{path}", wait_until="networkidle")
    await asyncio.sleep(0.6)
    if post_action is not None:
        await page.evaluate(post_action)
        await asyncio.sleep(0.6)
    await page.screenshot(path=str(OUT_DIR / out_name), full_page=False)
    await page.close()
    print(f"  → {out_name}")


async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(headless=True, args=["--no-sandbox"])

        ctx = await b.new_context(
            viewport={"width": 390, "height": 844},
            user_agent=UA, has_touch=True, is_mobile=True,
            permissions=["microphone"], color_scheme="light",
        )
        print("# Light mode")
        await snap(ctx, "/", "01_hub.png")
        await snap(ctx, "/aac", "02_aac_main.png")
        await snap(ctx, "/aac", "03_aac_record_mode.png",
                   post_action="() => document.getElementById('mode-toggle').click()")
        await snap(ctx, "/day", "04_day_hub.png")
        await snap(ctx, "/day", "05_day_routines.png",
                   post_action="() => document.querySelector('[data-action=open-routines]').click()")
        await snap(ctx, "/emotions", "06_emotions_levels.png")
        await snap(ctx, "/mood", "07_mood_hub.png")
        await snap(ctx, "/stories", "08_stories_form.png")
        await snap(ctx, "/parent", "09_parent_hub.png")
        await snap(ctx, "/parent", "10_parent_tip.png",
                   post_action="() => document.querySelector('[data-action=open-tip]').click()")
        await snap(ctx, "/onboarding", "11_onboarding.png")
        await ctx.close()

        ctx2 = await b.new_context(
            viewport={"width": 390, "height": 844},
            user_agent=UA, has_touch=True, is_mobile=True, color_scheme="dark",
        )
        print("# Dark mode")
        await snap(ctx2, "/", "12_hub_dark.png")
        await snap(ctx2, "/aac", "13_aac_dark.png")
        await ctx2.close()

        await b.close()


if __name__ == "__main__":
    asyncio.run(main())
