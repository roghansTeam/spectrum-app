"""PWA smoke: verify SW registers, caches shell, and / works after going offline."""
import asyncio
from playwright.async_api import async_playwright


URL = "http://localhost:8080"


async def main() -> None:
    async with async_playwright() as p:
        b = await p.chromium.launch(headless=True, args=["--no-sandbox"])
        ctx = await b.new_context(
            viewport={"width": 390, "height": 844},
            service_workers="allow",
        )
        page = await ctx.new_page()
        errs = []
        page.on("pageerror", lambda e: errs.append(f"ERR: {e}"))
        page.on("requestfailed", lambda r: errs.append(f"REQ FAIL: {r.url} {r.failure}"))

        await page.goto(f"{URL}/", wait_until="networkidle")
        await asyncio.sleep(2)
        sw_state = await page.evaluate("""async () => {
          if (!navigator.serviceWorker) return 'no-sw-api';
          const reg = await navigator.serviceWorker.getRegistration();
          if (!reg) return 'no-registration';
          const sw = reg.active || reg.installing || reg.waiting;
          return sw ? sw.state : 'no-worker';
        }""")
        print(f"SW state after load: {sw_state}")

        manifest_ok = await page.evaluate("""async () => {
          const r = await fetch('/manifest.webmanifest');
          if (!r.ok) return 'fetch failed';
          const m = await r.json();
          return { name: m.name, icons: m.icons.length, start_url: m.start_url };
        }""")
        print(f"Manifest: {manifest_ok}")

        # Prime cache by visiting all shell pages
        for path in ["/aac", "/day", "/emotions", "/mood", "/stories", "/onboarding", "/"]:
            await page.goto(f"{URL}{path}", wait_until="networkidle")
            await asyncio.sleep(0.3)

        # Now check what's in cache
        cache_info = await page.evaluate("""async () => {
          const names = await caches.keys();
          const out = {};
          for (const n of names) {
            const c = await caches.open(n);
            const keys = await c.keys();
            out[n] = keys.length;
          }
          return out;
        }""")
        print(f"Caches: {cache_info}")

        # Test offline mode
        await ctx.set_offline(True)
        await page.goto(f"{URL}/aac", wait_until="domcontentloaded", timeout=5000)
        offline_works = await page.evaluate(
            "() => document.title.includes('Голос') && !!document.getElementById('grid')"
        )
        print(f"Offline /aac works: {offline_works}")
        await ctx.set_offline(False)

        print(f"Errors: {errs[:5] if errs else '(none)'}")
        await b.close()


if __name__ == "__main__":
    asyncio.run(main())
