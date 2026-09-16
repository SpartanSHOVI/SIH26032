"""
api_probe_v2.py
---------------
Drives the Agmarknet SPA with Playwright, properly interacting with the
CUSTOM searchable dropdowns (not native <select>), captures ALL XHR/fetch
network calls, and saves them to logs/api_requests.json.

This reveals the internal REST APIs so we can potentially call them directly
without needing the browser or captcha.

Run:
    python3 api_probe_v2.py
"""

import asyncio
import json
from pathlib import Path
from datetime import datetime

from playwright.async_api import async_playwright

URL = "https://agmarknet.gov.in/viewmarketprofileinputpublic"
LOG_DIR = Path(__file__).parent / "logs"
LOG_DIR.mkdir(exist_ok=True)
OUT = LOG_DIR / "api_requests_v2.json"

captured: list[dict] = []


async def select_option_in_searchable_dropdown(page, label_text: str, search_value: str):
    """
    Interact with the Material-UI / React-Select style searchable dropdown:
    1. Find the dropdown by its label
    2. Click the input/combobox inside it
    3. Type the search value
    4. Click the first matching option
    """
    print(f"  → Selecting '{search_value}' in '{label_text}' dropdown...")

    # Strategy 1: find by label text → click associated input
    try:
        # Look for a div/label containing the label_text
        label_els = await page.query_selector_all(f"label, legend, span")
        for el in label_els:
            txt = (await el.inner_text()).strip()
            if label_text.lower() in txt.lower():
                # Find the nearest input/combobox sibling or child
                parent = await el.evaluate_handle("el => el.closest('.MuiFormControl-root, .form-group, div')")
                parent_el = parent.as_element()
                if parent_el:
                    inp = await parent_el.query_selector("input, [role='combobox']")
                    if inp:
                        await inp.click()
                        await page.wait_for_timeout(500)
                        await inp.fill(search_value)
                        await page.wait_for_timeout(1500)  # wait for dropdown options to load

                        # Click first visible option
                        options = await page.query_selector_all(
                            "[role='option'], [role='listbox'] li, .MuiMenuItem-root, "
                            ".MuiAutocomplete-option, ul.MuiList-root li"
                        )
                        for opt in options:
                            opt_text = (await opt.inner_text()).strip()
                            if search_value.lower() in opt_text.lower():
                                await opt.click()
                                print(f"    ✓ Clicked option: {opt_text!r}")
                                await page.wait_for_timeout(1500)
                                return True
                        # Fallback: click first option
                        if options:
                            txt2 = (await options[0].inner_text()).strip()
                            await options[0].click()
                            print(f"    ✓ Clicked first option: {txt2!r}")
                            await page.wait_for_timeout(1500)
                            return True
    except Exception as e:
        print(f"    ⚠ Strategy 1 failed: {e}")

    # Strategy 2: find all comboboxes in order and use positional index
    return False


async def probe():
    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=False, slow_mo=200)
        page = await browser.new_page()

        # ── Capture ALL network requests ────────────────────────────────────
        async def on_request(req):
            if req.resource_type in ("xhr", "fetch"):
                entry = {
                    "timestamp": datetime.now().isoformat(),
                    "method": req.method,
                    "url": req.url,
                    "post_data": req.post_data,
                    "response": None,
                }
                captured.append(entry)
                print(f"  [NET] {req.method} {req.url}")

        async def on_response(resp):
            for entry in reversed(captured):
                if entry["url"] == resp.url and entry["response"] is None:
                    try:
                        ct = resp.headers.get("content-type", "")
                        if "json" in ct or "text" in ct:
                            body = await resp.text()
                            entry["response"] = {
                                "status": resp.status,
                                "content_type": ct,
                                "body_preview": body[:3000],
                                "body_length": len(body),
                            }
                        else:
                            entry["response"] = {
                                "status": resp.status,
                                "content_type": ct,
                            }
                    except Exception as e:
                        entry["response"] = {"error": str(e)}
                    break

        page.on("request", on_request)
        page.on("response", on_response)

        # ── Navigate ────────────────────────────────────────────────────────
        print(f"\n→ Loading {URL}")
        await page.goto(URL, wait_until="networkidle", timeout=30000)
        await page.wait_for_timeout(2000)

        print("\n" + "=" * 60)
        print("PAGE DOM ANALYSIS")
        print("=" * 60)

        # Print all inputs and their roles
        inputs = await page.query_selector_all("input")
        print(f"Found {len(inputs)} input elements:")
        for i, inp in enumerate(inputs):
            iid = await inp.get_attribute("id") or ""
            iname = await inp.get_attribute("name") or ""
            itype = await inp.get_attribute("type") or "text"
            iplac = await inp.get_attribute("placeholder") or ""
            irole = await inp.get_attribute("role") or ""
            print(f"  [{i}] id={iid!r} name={iname!r} type={itype!r} placeholder={iplac!r} role={irole!r}")

        # Print all buttons
        btns = await page.query_selector_all("button")
        print(f"\nFound {len(btns)} buttons:")
        for b in btns:
            bid = await b.get_attribute("id") or ""
            txt = (await b.inner_text()).strip()
            print(f"  id={bid!r} text={txt!r}")

        # ── Try selecting Maharashtra ────────────────────────────────────────
        print("\n" + "=" * 60)
        print("TRYING TO SELECT STATE: Maharashtra")
        print("=" * 60)

        # Click the first input (State dropdown)
        if inputs:
            await inputs[0].click()
            await page.wait_for_timeout(500)
            await inputs[0].fill("Maharashtra")
            await page.wait_for_timeout(2000)  # AJAX for options

            # Capture what appeared
            opts = await page.query_selector_all(
                "[role='option'], [role='listbox'] li, li[data-option-index], "
                ".MuiAutocomplete-option"
            )
            print(f"Options appeared: {len(opts)}")
            for o in opts[:5]:
                print(f"  → {(await o.inner_text()).strip()!r}")

            if opts:
                await opts[0].click()
                await page.wait_for_timeout(2000)
                print("✓ State selected")

                # ── Try District ─────────────────────────────────────────────
                inputs2 = await page.query_selector_all("input")
                if len(inputs2) > 1:
                    print("\nTrying district: Nashik")
                    await inputs2[1].click()
                    await page.wait_for_timeout(500)
                    await inputs2[1].fill("Nashik")
                    await page.wait_for_timeout(2000)

                    dist_opts = await page.query_selector_all(
                        "[role='option'], [role='listbox'] li, li[data-option-index], "
                        ".MuiAutocomplete-option"
                    )
                    print(f"District options: {len(dist_opts)}")
                    if dist_opts:
                        await dist_opts[0].click()
                        await page.wait_for_timeout(2000)
                        print("✓ District selected")

                        # ── Try Market ─────────────────────────────────────────
                        inputs3 = await page.query_selector_all("input")
                        if len(inputs3) > 2:
                            print("\nTrying market: Chandwad")
                            await inputs3[2].click()
                            await page.wait_for_timeout(500)
                            await inputs3[2].fill("Chandwad")
                            await page.wait_for_timeout(2000)

                            mkt_opts = await page.query_selector_all(
                                "[role='option'], [role='listbox'] li, li[data-option-index], "
                                ".MuiAutocomplete-option"
                            )
                            print(f"Market options: {len(mkt_opts)}")
                            for o in mkt_opts[:3]:
                                print(f"  → {(await o.inner_text()).strip()!r}")

                            if mkt_opts:
                                await mkt_opts[0].click()
                                await page.wait_for_timeout(1500)
                                print("✓ Market selected")

        # ── Screenshot CAPTCHA ──────────────────────────────────────────────
        print("\n" + "=" * 60)
        print("CAPTCHA ANALYSIS")
        print("=" * 60)
        captcha_el = await page.query_selector(
            "img[alt*='captcha' i], canvas, img[src*='captcha' i], "
            "[class*='captcha' i] img, [id*='captcha' i]"
        )
        if captcha_el:
            await captcha_el.screenshot(path=str(LOG_DIR / "captcha_sample.png"))
            src = await captcha_el.get_attribute("src") or ""
            cid = await captcha_el.get_attribute("id") or ""
            print(f"Captcha element: id={cid!r} src={src[:100]!r}")
            print(f"Captcha screenshot saved → logs/captcha_sample.png")
        else:
            print("No captcha element found (may be canvas-rendered)")
            # Try canvas
            canvas = await page.query_selector("canvas")
            if canvas:
                await canvas.screenshot(path=str(LOG_DIR / "captcha_canvas.png"))
                print("Canvas screenshot → logs/captcha_canvas.png")

        # Full page screenshot
        await page.screenshot(path=str(LOG_DIR / "page_after_selection.png"), full_page=True)
        print("Full page screenshot → logs/page_after_selection.png")

        # ── Save API data ───────────────────────────────────────────────────
        with open(OUT, "w", encoding="utf-8") as f:
            json.dump(captured, f, ensure_ascii=False, indent=2)
        print(f"\n✓ Captured {len(captured)} API calls → {OUT}")
        print("(inspect api_requests_v2.json to find mandi profile endpoints)")
        print("\nBrowser stays open for 15s – inspect page manually...")
        await page.wait_for_timeout(15000)
        await browser.close()


if __name__ == "__main__":
    asyncio.run(probe())
