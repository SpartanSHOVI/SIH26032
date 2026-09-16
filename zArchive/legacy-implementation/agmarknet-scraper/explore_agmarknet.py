"""
explore_agmarknet.py
--------------------
Opens the AGMarknet profile input page with a visible browser and prints:
  • All <select> element IDs/names and their option counts
  • All <button> / <a> elements that look like submit triggers
  • A snapshot of the page HTML (first 4000 chars)

Run BEFORE the main scraper to validate selector logic.

Usage:
    python3 explore_agmarknet.py
"""

import asyncio
from playwright.async_api import async_playwright

URL = "https://agmarknet.gov.in/viewmarketprofileinputpublic"


async def explore():
    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=False)
        page = await browser.new_page()
        print(f"\n→ Navigating to {URL} ...")
        await page.goto(URL, wait_until="networkidle", timeout=30000)
        await page.wait_for_timeout(2000)

        print("\n" + "=" * 60)
        print("DETECTED <select> ELEMENTS")
        print("=" * 60)
        selects = await page.query_selector_all("select")
        for s in selects:
            sid = await s.get_attribute("id") or "(no id)"
            sname = await s.get_attribute("name") or "(no name)"
            options = await s.query_selector_all("option")
            print(f"  id={sid!r}  name={sname!r}  options={len(options)}")
            # Print first 5 option values
            for opt in options[:5]:
                val = await opt.get_attribute("value") or ""
                txt = (await opt.inner_text()).strip()
                print(f"    value={val!r}  text={txt!r}")

        print("\n" + "=" * 60)
        print("DETECTED SUBMIT BUTTONS / LINKS")
        print("=" * 60)
        btns = await page.query_selector_all(
            "button, input[type='submit'], input[type='button'], a.btn"
        )
        for b in btns:
            bid = await b.get_attribute("id") or "(no id)"
            btype = await b.get_attribute("type") or "link"
            txt = (await b.inner_text()).strip()
            print(f"  id={bid!r}  type={btype!r}  text={txt!r}")

        print("\n" + "=" * 60)
        print("PAGE HTML SNAPSHOT (first 4000 chars)")
        print("=" * 60)
        html = await page.content()
        print(html[:4000])

        # ── Try selecting the first state and see what loads ────────────────
        print("\n" + "=" * 60)
        print("TESTING STATE SELECTION (selecting option index 1)")
        print("=" * 60)
        if selects:
            first_select = selects[0]
            options = await first_select.query_selector_all("option")
            if len(options) > 1:
                val = await options[1].get_attribute("value")
                sid = await first_select.get_attribute("id")
                print(f"Selecting state value={val!r} in #{sid}")
                await page.select_option(f"#{sid}", value=val)
                await page.wait_for_timeout(2000)

                # Check district dropdown
                selects_after = await page.query_selector_all("select")
                for s in selects_after:
                    sname = await s.get_attribute("name") or await s.get_attribute("id") or "?"
                    opts = await s.query_selector_all("option")
                    print(f"  After state select → {sname!r}: {len(opts)} options")

        print("\nDone. Close the browser window to exit.")
        await page.wait_for_timeout(15000)
        await browser.close()


if __name__ == "__main__":
    asyncio.run(explore())
