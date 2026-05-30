"""End-to-end playwright tests for spectrum-app.

Run against a locally-started bot.py. CI workflow starts the server,
then invokes pytest tests/.
"""
import asyncio
import os

import pytest
from playwright.async_api import async_playwright


URL = os.environ.get("E2E_BASE_URL", "http://localhost:8080")
IPHONE_VP = {"width": 390, "height": 844}
UA = (
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) "
    "AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1"
)


@pytest.fixture(scope="module")
def event_loop():
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


async def _new_ctx(browser, *, permissions=None):
    return await browser.new_context(
        viewport=IPHONE_VP, user_agent=UA, has_touch=True, is_mobile=True,
        permissions=permissions or [],
    )


@pytest.mark.asyncio
async def test_all_pages_render_without_errors():
    async with async_playwright() as p:
        b = await p.chromium.launch(headless=True, args=["--no-sandbox"])
        ctx = await _new_ctx(b)
        errors_by_page = {}
        for path in ["/", "/aac", "/day", "/emotions", "/mood",
                     "/stories", "/parent", "/onboarding"]:
            page = await ctx.new_page()
            errs = []
            page.on("pageerror", lambda e, errs=errs: errs.append(str(e)))
            resp = await page.goto(URL + path, wait_until="networkidle")
            assert resp.status == 200, f"{path}: HTTP {resp.status}"
            await asyncio.sleep(0.5)
            errors_by_page[path] = errs
            await page.close()
        await b.close()
    for path, errs in errors_by_page.items():
        assert not errs, f"{path}: {errs}"


@pytest.mark.asyncio
async def test_aac_loads_vocabulary_and_renders_cards():
    async with async_playwright() as p:
        b = await p.chromium.launch(headless=True, args=["--no-sandbox"])
        ctx = await _new_ctx(b, permissions=["microphone"])
        page = await ctx.new_page()
        await page.goto(URL + "/aac", wait_until="networkidle")
        await asyncio.sleep(0.6)
        n_tabs = await page.evaluate("() => document.querySelectorAll('.aac-tab').length")
        n_cards = await page.evaluate("() => document.querySelectorAll('.aac-card').length")
        assert n_tabs == 6
        assert n_cards == 10  # first category 'Главное'
        await b.close()


@pytest.mark.asyncio
async def test_aac_search_filters_across_categories():
    async with async_playwright() as p:
        b = await p.chromium.launch(headless=True, args=["--no-sandbox"])
        ctx = await _new_ctx(b)
        page = await ctx.new_page()
        await page.goto(URL + "/aac", wait_until="networkidle")
        await asyncio.sleep(0.5)
        await page.fill("#search-input", "мам")
        await asyncio.sleep(0.3)
        labels = await page.evaluate(
            "() => Array.from(document.querySelectorAll('.aac-card-label')).map(e => e.textContent)"
        )
        assert labels == ["мама"]
        await page.fill("#search-input", "xyznotfound")
        await asyncio.sleep(0.3)
        empty = await page.evaluate("() => !!document.querySelector('.aac-grid-empty')")
        assert empty
        await b.close()


@pytest.mark.asyncio
async def test_aac_phase2_toggles_drag_mode():
    async with async_playwright() as p:
        b = await p.chromium.launch(headless=True, args=["--no-sandbox"])
        ctx = await _new_ctx(b)
        page = await ctx.new_page()
        await page.goto(URL + "/aac", wait_until="networkidle")
        await asyncio.sleep(0.5)
        await page.click("#phase2-toggle")
        await asyncio.sleep(0.3)
        in_phase2 = await page.evaluate(
            "() => document.querySelector('.aac').classList.contains('aac-phase2')"
        )
        strip_hidden = await page.evaluate(
            "() => getComputedStyle(document.getElementById('strip')).display === 'none'"
        )
        title = await page.evaluate("() => document.getElementById('aac-title').textContent")
        assert in_phase2
        assert strip_hidden
        assert title == "Жест"
        await b.close()


@pytest.mark.asyncio
async def test_day_custom_routine_full_flow():
    async with async_playwright() as p:
        b = await p.chromium.launch(headless=True, args=["--no-sandbox"])
        ctx = await _new_ctx(b)
        page = await ctx.new_page()
        await page.goto(URL + "/day", wait_until="networkidle")
        await asyncio.sleep(0.4)
        await page.click("[data-action=open-routines]")
        await asyncio.sleep(0.3)
        await page.click("#add-routine-btn")
        await asyncio.sleep(0.3)
        await page.fill("#rb-title", "E2E тест")
        # Add 2 steps
        for _ in range(2):
            await page.click("#rb-add-step")
            await asyncio.sleep(0.2)
            await page.evaluate("() => document.querySelectorAll('.picker-item')[0].click()")
            await asyncio.sleep(0.2)
        await page.click("#rb-save-btn")
        await asyncio.sleep(0.4)
        labels = await page.evaluate(
            "() => Array.from(document.querySelectorAll('.rt-card-label')).map(e => e.textContent)"
        )
        assert "E2E тест" in labels
        # Verify storage
        ls = await page.evaluate("() => localStorage.getItem('spectrum_custom_routines')")
        assert ls and "E2E тест" in ls
        await b.close()


@pytest.mark.asyncio
async def test_onboarding_completes_and_sets_profile():
    async with async_playwright() as p:
        b = await p.chromium.launch(headless=True, args=["--no-sandbox"])
        ctx = await _new_ctx(b)
        page = await ctx.new_page()
        await page.goto(URL + "/onboarding", wait_until="networkidle")
        await asyncio.sleep(0.4)
        await page.click("#btn-start")
        await asyncio.sleep(0.3)
        # Answer 15 questions
        for _ in range(15):
            opts = await page.query_selector_all(".ob-q-option")
            await opts[2].click()  # "Часто"
            await asyncio.sleep(0.1)
        await asyncio.sleep(0.4)
        profile = await page.evaluate("() => localStorage.getItem('spectrum_sensory_profile')")
        assert profile and '"dominant"' in profile
        await b.close()


@pytest.mark.asyncio
async def test_bug_report_endpoint_writes_entry():
    async with async_playwright() as p:
        b = await p.chromium.launch(headless=True, args=["--no-sandbox"])
        ctx = await _new_ctx(b)
        page = await ctx.new_page()
        # Pre-set tour seen so the tour overlay doesn't block the bug FAB.
        # Need to land on origin first (localStorage is origin-scoped),
        # then mark tour seen, then reload.
        await page.goto(URL + "/", wait_until="domcontentloaded")
        await page.evaluate("() => localStorage.setItem('spectrum_tour_seen', '1')")
        await page.goto(URL + "/", wait_until="networkidle")
        await asyncio.sleep(0.5)
        await page.click(".sp-bug-fab")
        await asyncio.sleep(0.3)
        await page.fill(".sp-bug-textarea", "e2e bug report from CI")
        await page.click(".sp-bug-send")
        await asyncio.sleep(0.7)
        modal_hidden = await page.evaluate("() => document.querySelector('.sp-bug-modal').hidden")
        toast = await page.evaluate(
            "() => !document.querySelector('.sp-bug-toast').hidden && "
            "document.querySelector('.sp-bug-toast').textContent"
        )
        assert modal_hidden
        assert "Спасибо" in toast
        await b.close()


@pytest.mark.asyncio
async def test_tour_appears_first_visit_then_dismisses():
    async with async_playwright() as p:
        b = await p.chromium.launch(headless=True, args=["--no-sandbox"])
        ctx = await _new_ctx(b)
        page = await ctx.new_page()
        await page.goto(URL + "/", wait_until="networkidle")
        await asyncio.sleep(0.9)
        visible = await page.evaluate("() => !!document.querySelector('.sp-tour-card')")
        assert visible
        # Click through all 5 steps
        for _ in range(5):
            await page.click(".sp-tour-next")
            await asyncio.sleep(0.2)
        gone = not await page.evaluate("() => !!document.querySelector('.sp-tour-card')")
        seen = await page.evaluate("() => localStorage.getItem('spectrum_tour_seen')")
        assert gone
        assert seen == "1"
        await b.close()
