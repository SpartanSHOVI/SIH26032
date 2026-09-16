"""
AGMarknet Procurement Centre Profile Scraper
============================================
Scrapes full market-profile details for every mandi listed in agmarknet_mandis.csv
from https://agmarknet.gov.in/viewmarketprofileinputpublic

Strategy
--------
The Agmarknet 2.0 frontend is a React SPA; its dropdowns load options via
internal API calls. We intercept those calls with Playwright, then replay
the request chain (State → District → Market) and finally load the profile
page for each mandi.

Output
------
  data/agmarknet_profiles.csv   – one row per mandi with all scraped fields
  data/agmarknet_profiles.json  – same data in JSON format
  logs/scrape.log               – detailed run log

Usage
-----
  python3 scrape_agmarknet.py [--limit N] [--headless] [--workers N]

Arguments
---------
  --limit N      Only scrape the first N mandis (useful for testing)
  --headless     Run browser in headless mode (default: True)
  --workers N    Number of parallel browser workers (default: 3)
  --resume       Skip mandis already present in output CSV
"""

import argparse
import asyncio
import csv
import json
import logging
import os
import sys
import time
from dataclasses import dataclass, field, asdict
from datetime import datetime
from pathlib import Path
from typing import Optional

import pandas as pd
from playwright.async_api import (
    async_playwright,
    Page,
    BrowserContext,
    TimeoutError as PWTimeout,
)
from tqdm.asyncio import tqdm as atqdm

# ──────────────────────────────────────────────────────────────────────────────
# Paths
# ──────────────────────────────────────────────────────────────────────────────

BASE_DIR = Path(__file__).parent
DATA_DIR = BASE_DIR / "data"
LOG_DIR = BASE_DIR / "logs"
DATA_DIR.mkdir(exist_ok=True)
LOG_DIR.mkdir(exist_ok=True)

REFERENCE_CSV = (
    Path(__file__).parent.parent.parent
    / "SIH-KisanConnect-Enhanced"
    / "agmarknet_mandis.csv"
)
OUTPUT_CSV = DATA_DIR / "agmarknet_profiles.csv"
OUTPUT_JSON = DATA_DIR / "agmarknet_profiles.json"

BASE_URL = "https://agmarknet.gov.in"
PROFILE_INPUT_URL = f"{BASE_URL}/viewmarketprofileinputpublic"
PROFILE_OUTPUT_URL = f"{BASE_URL}/viewmarketprofileoutputpublic"

# ──────────────────────────────────────────────────────────────────────────────
# Logging
# ──────────────────────────────────────────────────────────────────────────────

log_file = LOG_DIR / f"scrape_{datetime.now().strftime('%Y%m%d_%H%M%S')}.log"
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.FileHandler(log_file),
        logging.StreamHandler(sys.stdout),
    ],
)
logger = logging.getLogger(__name__)

# ──────────────────────────────────────────────────────────────────────────────
# Data model
# ──────────────────────────────────────────────────────────────────────────────

@dataclass
class MandiProfile:
    # from reference CSV
    state: str = ""
    state_id: str = ""
    district: str = ""
    district_id: str = ""
    market_id: str = ""
    mandi_name: str = ""

    # scraped from profile page
    address: str = ""
    pincode: str = ""
    phone: str = ""
    email: str = ""
    website: str = ""
    market_type: str = ""
    regulated: str = ""
    established_year: str = ""
    area_hectares: str = ""
    storage_capacity_mt: str = ""
    cold_storage: str = ""
    num_shops: str = ""
    num_traders: str = ""
    num_commission_agents: str = ""
    num_weighing_machines: str = ""
    commodities_traded: str = ""
    arrival_days: str = ""
    working_hours: str = ""
    bank_present: str = ""
    atm_present: str = ""
    canteen_present: str = ""
    internet_present: str = ""
    toilet_facilities: str = ""
    drinking_water: str = ""
    electricity: str = ""
    road_connectivity: str = ""
    nearest_railway: str = ""
    nearest_airport: str = ""
    latitude: str = ""
    longitude: str = ""

    # meta
    scraped_at: str = ""
    scrape_status: str = "pending"   # pending | success | failed
    error_message: str = ""

    def to_dict(self) -> dict:
        return asdict(self)


# ──────────────────────────────────────────────────────────────────────────────
# Helper – extract text safely
# ──────────────────────────────────────────────────────────────────────────────

async def safe_text(page: Page, selector: str, default: str = "") -> str:
    try:
        el = await page.query_selector(selector)
        if el:
            return (await el.inner_text()).strip()
    except Exception:
        pass
    return default


async def find_value_after_label(page: Page, label: str) -> str:
    """
    Look for a <td> or <span> that contains `label`, then return the text of
    the adjacent sibling / next column. Works for the typical key-value table
    layout on Agmarknet profile pages.
    """
    try:
        # Try XPath: find a cell containing the label text, get sibling
        cells = await page.query_selector_all("td, th, span, label, dt")
        for cell in cells:
            text = (await cell.inner_text()).strip()
            if label.lower() in text.lower():
                # Try next sibling (same row)
                try:
                    sibling = await cell.evaluate_handle(
                        "el => el.nextElementSibling"
                    )
                    sibling_el = sibling.as_element()
                    if sibling_el:
                        val = (await sibling_el.inner_text()).strip()
                        if val and val.lower() != label.lower():
                            return val
                except Exception:
                    pass
                # Try parent → next sibling
                try:
                    parent_sibling = await cell.evaluate_handle(
                        "el => el.parentElement?.nextElementSibling"
                    )
                    ps_el = parent_sibling.as_element()
                    if ps_el:
                        val = (await ps_el.inner_text()).strip()
                        if val:
                            return val
                except Exception:
                    pass
    except Exception:
        pass
    return ""


# ──────────────────────────────────────────────────────────────────────────────
# Core scraping logic for one mandi
# ──────────────────────────────────────────────────────────────────────────────

async def scrape_mandi(
    context: BrowserContext,
    mandi: MandiProfile,
    semaphore: asyncio.Semaphore,
    retry: int = 2,
) -> MandiProfile:
    """
    Opens a browser page, navigates through the Agmarknet dropdowns for the
    given state → district → market, and scrapes the profile page.
    Retries up to `retry` times on transient failures.
    """
    async with semaphore:
        for attempt in range(retry + 1):
            page: Optional[Page] = None
            try:
                page = await context.new_page()
                await page.set_extra_http_headers({
                    "User-Agent": (
                        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                        "AppleWebKit/537.36 (KHTML, like Gecko) "
                        "Chrome/124.0.0.0 Safari/537.36"
                    )
                })

                # ── Step 1: Navigate to profile input page ──────────────────
                await page.goto(PROFILE_INPUT_URL, wait_until="networkidle", timeout=30000)
                await page.wait_for_timeout(1500)

                # ── Step 2: Select State ────────────────────────────────────
                state_sel = await _find_dropdown(page, ["state", "ddl_state", "State"])
                if state_sel is None:
                    raise RuntimeError("State dropdown not found")

                await page.select_option(state_sel, value=str(mandi.state_id))
                await page.wait_for_timeout(1500)   # wait for district AJAX

                # ── Step 3: Select District ─────────────────────────────────
                dist_sel = await _find_dropdown(page, ["district", "ddl_district", "District"])
                if dist_sel is None:
                    raise RuntimeError("District dropdown not found")

                await page.select_option(dist_sel, value=str(mandi.district_id))
                await page.wait_for_timeout(1500)   # wait for market AJAX

                # ── Step 4: Select Market ───────────────────────────────────
                mkt_sel = await _find_dropdown(page, ["market", "ddl_market", "Market"])
                if mkt_sel is None:
                    raise RuntimeError("Market dropdown not found")

                await page.select_option(mkt_sel, value=str(mandi.market_id))
                await page.wait_for_timeout(800)

                # ── Step 5: Submit ──────────────────────────────────────────
                submit_btn = await _find_submit(page)
                if submit_btn:
                    await submit_btn.click()
                else:
                    # Some versions use a link with JS navigation
                    await page.evaluate(
                        "document.querySelector('form').submit()"
                    )

                await page.wait_for_load_state("networkidle", timeout=20000)
                await page.wait_for_timeout(1000)

                # ── Step 6: Parse profile table ─────────────────────────────
                mandi = await _parse_profile_page(page, mandi)
                mandi.scrape_status = "success"
                mandi.scraped_at = datetime.now().isoformat()
                logger.info(f"✓ {mandi.state} / {mandi.district} / {mandi.mandi_name}")
                return mandi

            except PWTimeout:
                logger.warning(
                    f"Timeout ({attempt+1}/{retry+1}) – {mandi.mandi_name}"
                )
                if attempt == retry:
                    mandi.scrape_status = "failed"
                    mandi.error_message = "Timeout"
            except Exception as exc:
                logger.warning(
                    f"Error ({attempt+1}/{retry+1}) – {mandi.mandi_name}: {exc}"
                )
                if attempt == retry:
                    mandi.scrape_status = "failed"
                    mandi.error_message = str(exc)
            finally:
                if page:
                    await page.close()

            await asyncio.sleep(2 ** attempt)   # exponential back-off

    return mandi


async def _find_dropdown(page: Page, candidates: list[str]) -> Optional[str]:
    """Return a CSS selector for the first matching <select> element."""
    selects = await page.query_selector_all("select")
    for sel in selects:
        sel_id = (await sel.get_attribute("id") or "").lower()
        sel_name = (await sel.get_attribute("name") or "").lower()
        for cand in candidates:
            if cand.lower() in sel_id or cand.lower() in sel_name:
                # Build a unique CSS selector
                if sel_id:
                    return f"#{await sel.get_attribute('id')}"
                elif sel_name:
                    return f"select[name='{await sel.get_attribute('name')}']"
    # Fallback: return ordered positional
    if selects:
        for i, s in enumerate(selects):
            for c in candidates:
                nm = (await s.get_attribute("name") or "").lower()
                if c.lower() in nm:
                    return f"select:nth-of-type({i+1})"
    return None


async def _find_submit(page: Page):
    """Find a submit button or 'View Profile' anchor."""
    # Try button[type=submit]
    btn = await page.query_selector("button[type='submit'], input[type='submit']")
    if btn:
        return btn
    # Try any button with text containing 'view' or 'submit' or 'search'
    buttons = await page.query_selector_all("button, a.btn, input[type='button']")
    for b in buttons:
        text = (await b.inner_text()).strip().lower()
        if any(k in text for k in ["view", "submit", "search", "go", "profile"]):
            return b
    return None


async def _parse_profile_page(page: Page, mandi: MandiProfile) -> MandiProfile:
    """
    Parse the market profile output page. Agmarknet uses a key-value HTML table.
    We map known labels to fields and store everything else as-is.
    """
    field_map = {
        "address": ["address", "market address"],
        "pincode": ["pin", "pincode", "pin code"],
        "phone": ["phone", "telephone", "contact"],
        "email": ["email", "e-mail"],
        "website": ["website", "web"],
        "market_type": ["market type", "type of market"],
        "regulated": ["regulated", "regulation"],
        "established_year": ["established", "year of establishment"],
        "area_hectares": ["area", "market area"],
        "storage_capacity_mt": ["storage capacity", "godown"],
        "cold_storage": ["cold storage"],
        "num_shops": ["number of shops", "no. of shops", "shops"],
        "num_traders": ["traders", "number of traders"],
        "num_commission_agents": ["commission agents", "arthias"],
        "num_weighing_machines": ["weighing machines", "weighing"],
        "commodities_traded": ["commodities", "commodity"],
        "arrival_days": ["arrival", "days of arrival"],
        "working_hours": ["working hours", "timing"],
        "bank_present": ["bank"],
        "atm_present": ["atm"],
        "canteen_present": ["canteen"],
        "internet_present": ["internet"],
        "toilet_facilities": ["toilet", "sanitation"],
        "drinking_water": ["drinking water", "water"],
        "electricity": ["electricity", "power"],
        "road_connectivity": ["road", "connectivity"],
        "nearest_railway": ["railway", "nearest railway"],
        "nearest_airport": ["airport", "nearest airport"],
        "latitude": ["latitude"],
        "longitude": ["longitude"],
    }

    # Grab all rows in all tables
    rows = await page.query_selector_all("tr")
    for row in rows:
        cells = await row.query_selector_all("td, th")
        if len(cells) < 2:
            continue
        key_text = (await cells[0].inner_text()).strip().lower()
        val_text = (await cells[1].inner_text()).strip()

        for attr, labels in field_map.items():
            for label in labels:
                if label in key_text:
                    if not getattr(mandi, attr):   # don't overwrite existing
                        setattr(mandi, attr, val_text)
                    break

    # Also try definition lists (dl/dt/dd)
    dts = await page.query_selector_all("dt")
    for dt in dts:
        key_text = (await dt.inner_text()).strip().lower()
        dd = await dt.evaluate_handle("el => el.nextElementSibling")
        dd_el = dd.as_element()
        if not dd_el:
            continue
        val_text = (await dd_el.inner_text()).strip()
        for attr, labels in field_map.items():
            for label in labels:
                if label in key_text:
                    if not getattr(mandi, attr):
                        setattr(mandi, attr, val_text)
                    break

    return mandi


# ──────────────────────────────────────────────────────────────────────────────
# Output helpers
# ──────────────────────────────────────────────────────────────────────────────

def load_existing_results() -> set[str]:
    """Return set of market_ids already scraped successfully."""
    if not OUTPUT_CSV.exists():
        return set()
    df = pd.read_csv(OUTPUT_CSV)
    success = df[df["scrape_status"] == "success"]
    return set(success["market_id"].astype(str).tolist())


def save_results(profiles: list[MandiProfile]) -> None:
    rows = [p.to_dict() for p in profiles]
    df = pd.DataFrame(rows)
    df.to_csv(OUTPUT_CSV, index=False)
    with open(OUTPUT_JSON, "w", encoding="utf-8") as f:
        json.dump(rows, f, ensure_ascii=False, indent=2)
    logger.info(f"Saved {len(rows)} records → {OUTPUT_CSV}")


def append_result(profile: MandiProfile) -> None:
    """Append a single result row to the CSV (streaming mode)."""
    row = profile.to_dict()
    write_header = not OUTPUT_CSV.exists()
    with open(OUTPUT_CSV, "a", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=row.keys())
        if write_header:
            writer.writeheader()
        writer.writerow(row)


# ──────────────────────────────────────────────────────────────────────────────
# Main orchestrator
# ──────────────────────────────────────────────────────────────────────────────

async def main(
    limit: Optional[int],
    headless: bool,
    workers: int,
    resume: bool,
) -> None:
    logger.info("=" * 60)
    logger.info("AGMarknet Profile Scraper – Starting")
    logger.info(f"Reference CSV : {REFERENCE_CSV}")
    logger.info(f"Output CSV    : {OUTPUT_CSV}")
    logger.info(f"Workers       : {workers}  |  Headless: {headless}")
    logger.info("=" * 60)

    # ── Load reference data ─────────────────────────────────────────────────
    if not REFERENCE_CSV.exists():
        logger.error(f"Reference CSV not found: {REFERENCE_CSV}")
        sys.exit(1)

    ref_df = pd.read_csv(REFERENCE_CSV)
    logger.info(f"Loaded {len(ref_df)} mandis from reference CSV")

    # ── Build mandi list ────────────────────────────────────────────────────
    already_done: set[str] = set()
    if resume:
        already_done = load_existing_results()
        logger.info(f"Resuming: {len(already_done)} mandis already scraped")

    mandis: list[MandiProfile] = []
    for _, row in ref_df.iterrows():
        mid = str(int(row["Market_ID"]))
        if resume and mid in already_done:
            continue
        mandis.append(MandiProfile(
            state=str(row["State"]),
            state_id=str(int(row["State_ID"])),
            district=str(row["District"]),
            district_id=str(int(row["District_ID"])),
            market_id=mid,
            mandi_name=str(row["Mandi_Name"]),
        ))

    if limit:
        mandis = mandis[:limit]

    logger.info(f"Mandis to scrape: {len(mandis)}")

    # ── Launch browser ──────────────────────────────────────────────────────
    semaphore = asyncio.Semaphore(workers)
    results: list[MandiProfile] = []

    async with async_playwright() as pw:
        browser = await pw.chromium.launch(
            headless=headless,
            args=[
                "--no-sandbox",
                "--disable-dev-shm-usage",
                "--disable-blink-features=AutomationControlled",
            ],
        )
        context = await browser.new_context(
            viewport={"width": 1280, "height": 900},
            locale="en-IN",
            timezone_id="Asia/Kolkata",
        )

        # Create tasks
        tasks = [
            scrape_mandi(context, m, semaphore)
            for m in mandis
        ]

        # Run with progress bar, streaming results to CSV
        success_count = 0
        fail_count = 0
        for coro in atqdm(
            asyncio.as_completed(tasks),
            total=len(tasks),
            desc="Scraping mandis",
            unit="mandi",
        ):
            profile = await coro
            results.append(profile)
            append_result(profile)   # stream to disk immediately
            if profile.scrape_status == "success":
                success_count += 1
            else:
                fail_count += 1

        await browser.close()

    # ── Final save (JSON) ───────────────────────────────────────────────────
    with open(OUTPUT_JSON, "w", encoding="utf-8") as f:
        json.dump([r.to_dict() for r in results], f, ensure_ascii=False, indent=2)

    logger.info("=" * 60)
    logger.info(f"Done!  Success: {success_count}  |  Failed: {fail_count}")
    logger.info(f"Output CSV  : {OUTPUT_CSV}")
    logger.info(f"Output JSON : {OUTPUT_JSON}")
    logger.info(f"Log file    : {log_file}")
    logger.info("=" * 60)


# ──────────────────────────────────────────────────────────────────────────────
# Entry point
# ──────────────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Scrape AGMarknet procurement centre profiles"
    )
    parser.add_argument(
        "--limit", type=int, default=None,
        help="Limit number of mandis (for testing)"
    )
    parser.add_argument(
        "--headless", action="store_true", default=True,
        help="Run browser in headless mode (default: True)"
    )
    parser.add_argument(
        "--no-headless", dest="headless", action="store_false",
        help="Show browser window"
    )
    parser.add_argument(
        "--workers", type=int, default=3,
        help="Number of parallel browser tabs (default: 3)"
    )
    parser.add_argument(
        "--resume", action="store_true", default=False,
        help="Skip mandis already present in output CSV"
    )
    args = parser.parse_args()
    asyncio.run(main(
        limit=args.limit,
        headless=args.headless,
        workers=args.workers,
        resume=args.resume,
    ))
