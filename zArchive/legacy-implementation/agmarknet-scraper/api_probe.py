"""
api_probe.py
------------
Intercepts all XHR/fetch network requests made by the AGMarknet SPA
to discover internal API endpoints used for State/District/Market dropdowns.

Run this ONCE to map the API – then we can use requests directly instead
of driving the browser for every mandi (much faster).

Usage:
    python3 api_probe.py
    
Output:
    logs/api_requests.json  – all captured API calls with payloads + responses
"""

import asyncio
import json
from pathlib import Path
from datetime import datetime

from playwright.async_api import async_playwright, Request, Response

URL = "https://agmarknet.gov.in/viewmarketprofileinputpublic"
LOG_DIR = Path(__file__).parent / "logs"
LOG_DIR.mkdir(exist_ok=True)
OUT = LOG_DIR / "api_requests.json"

captured: list[dict] = []


async def probe():
    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=False)
        page = await browser.new_page()

        # ── Intercept all XHR/fetch requests ───────────────────────────────
        async def on_request(req: Request):
            if req.resource_type in ("xhr", "fetch"):
                entry = {
                    "timestamp": datetime.now().isoformat(),
                    "method": req.method,
                    "url": req.url,
                    "headers": dict(req.headers),
                    "post_data": req.post_data,
                    "response": None,
                }
                captured.append(entry)
                print(f"  ← {req.method} {req.url}")

        async def on_response(resp: Response):
            url = resp.url
            for entry in reversed(captured):
                if entry["url"] == url and entry["response"] is None:
                    try:
                        body = await resp.text()
                        entry["response"] = {
                            "status": resp.status,
                            "headers": dict(resp.headers),
                            "body_preview": body[:2000],
                        }
                    except Exception as e:
                        entry["response"] = {"error": str(e)}
                    break

        page.on("request", on_request)
        page.on("response", on_response)

        print(f"\n→ Navigating to {URL}")
        await page.goto(URL, wait_until="networkidle", timeout=30000)
        await page.wait_for_timeout(2000)

        # Select first available state
        selects = await page.query_selector_all("select")
        if selects:
            s0 = selects[0]
            sid = await s0.get_attribute("id")
            opts = await s0.query_selector_all("option")
            if len(opts) > 1:
                val = await opts[1].get_attribute("value")
                print(f"\n→ Selecting state: value={val}")
                await page.select_option(f"#{sid}", value=val)
                await page.wait_for_timeout(2000)

            # Select first district
            selects2 = await page.query_selector_all("select")
            if len(selects2) > 1:
                s1 = selects2[1]
                sid1 = await s1.get_attribute("id")
                opts1 = await s1.query_selector_all("option")
                if len(opts1) > 1:
                    val1 = await opts1[1].get_attribute("value")
                    print(f"→ Selecting district: value={val1}")
                    await page.select_option(f"#{sid1}", value=val1)
                    await page.wait_for_timeout(2000)

            # Select first market
            selects3 = await page.query_selector_all("select")
            if len(selects3) > 2:
                s2 = selects3[2]
                sid2 = await s2.get_attribute("id")
                opts2 = await s2.query_selector_all("option")
                if len(opts2) > 1:
                    val2 = await opts2[1].get_attribute("value")
                    print(f"→ Selecting market: value={val2}")
                    await page.select_option(f"#{sid2}", value=val2)
                    await page.wait_for_timeout(1000)

            # Submit
            btn = await page.query_selector("button[type='submit'], input[type='submit']")
            if btn:
                print("→ Clicking submit")
                await btn.click()
                await page.wait_for_load_state("networkidle", timeout=20000)
                await page.wait_for_timeout(2000)

        # Save captured requests
        with open(OUT, "w", encoding="utf-8") as f:
            json.dump(captured, f, ensure_ascii=False, indent=2)

        print(f"\n✓ Captured {len(captured)} API calls → {OUT}")
        print("Close browser to exit...")
        await page.wait_for_timeout(10000)
        await browser.close()


if __name__ == "__main__":
    asyncio.run(probe())
