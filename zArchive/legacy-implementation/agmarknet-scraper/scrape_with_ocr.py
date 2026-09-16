"""
scrape_with_ocr.py
==================
AGMarknet full profile scraper that:
  1. Uses Playwright to drive the custom searchable dropdowns
  2. Uses EasyOCR to read the image captcha automatically
  3. Retries with a fresh captcha if OCR result is rejected
  4. Streams results to CSV/JSON with resume support

Usage:
    python3 scrape_with_ocr.py [--limit N] [--workers N] [--resume] [--no-headless]

Notes:
    - Workers should be kept LOW (1-2) because each worker needs its own
      browser context and captcha solve. Running too many in parallel may
      trigger rate limiting.
    - EasyOCR model downloads ~100 MB on first run.
"""

import argparse
import asyncio
import csv
import json
import logging
import sys
import time
from dataclasses import dataclass, asdict
from datetime import datetime
from io import BytesIO
from pathlib import Path
from typing import Optional

import pandas as pd
import easyocr
from PIL import Image, ImageEnhance, ImageFilter
from playwright.async_api import (
    async_playwright,
    Page,
    BrowserContext,
    TimeoutError as PWTimeout,
)
from tqdm.asyncio import tqdm as atqdm

# ──────────────────────────────────────────────────────────────────────────────
# Paths & Config
# ──────────────────────────────────────────────────────────────────────────────

BASE_DIR = Path(__file__).parent
DATA_DIR = BASE_DIR / "data"
LOG_DIR  = BASE_DIR / "logs"
DATA_DIR.mkdir(exist_ok=True)
LOG_DIR.mkdir(exist_ok=True)

REFERENCE_CSV = BASE_DIR.parent.parent / "SIH-KisanConnect-Enhanced" / "agmarknet_mandis.csv"
OUTPUT_CSV    = DATA_DIR / "agmarknet_profiles_ocr.csv"
OUTPUT_JSON   = DATA_DIR / "agmarknet_profiles_ocr.json"

BASE_URL    = "https://agmarknet.gov.in"
PROFILE_URL = f"{BASE_URL}/viewmarketprofileinputpublic"

# Max OCR retries per mandi (each retry gets a fresh captcha)
MAX_CAPTCHA_RETRIES = 4

# ──────────────────────────────────────────────────────────────────────────────
# Logging
# ──────────────────────────────────────────────────────────────────────────────

log_file = LOG_DIR / f"ocr_scrape_{datetime.now().strftime('%Y%m%d_%H%M%S')}.log"
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
# Data Model
# ──────────────────────────────────────────────────────────────────────────────

@dataclass
class MandiProfile:
    state: str = ""
    state_id: str = ""
    district: str = ""
    district_id: str = ""
    market_id: str = ""
    mandi_name: str = ""

    # Scraped profile fields
    market_name_official: str = ""
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
    extra_data: str = ""   # JSON of any remaining fields

    scraped_at: str = ""
    status: str = "pending"
    error: str = ""
    captcha_attempts: int = 0

    def to_dict(self):
        return asdict(self)


# ──────────────────────────────────────────────────────────────────────────────
# OCR Engine (singleton, loaded once)
# ──────────────────────────────────────────────────────────────────────────────

_ocr_reader: Optional[easyocr.Reader] = None

def get_ocr() -> easyocr.Reader:
    global _ocr_reader
    if _ocr_reader is None:
        logger.info("Loading EasyOCR model (first run: ~30s download)...")
        _ocr_reader = easyocr.Reader(["en"], gpu=False, verbose=False)
        logger.info("EasyOCR ready")
    return _ocr_reader


def solve_captcha_from_bytes(img_bytes: bytes) -> str:
    """
    Run EasyOCR on captcha image bytes.
    Pre-process image to improve OCR accuracy:
      - Convert to grayscale
      - Upscale 3x
      - Increase contrast
      - Sharpen
    """
    reader = get_ocr()
    img = Image.open(BytesIO(img_bytes)).convert("L")      # grayscale
    img = img.resize((img.width * 3, img.height * 3), Image.LANCZOS)  # upscale
    img = ImageEnhance.Contrast(img).enhance(2.5)          # contrast
    img = img.filter(ImageFilter.SHARPEN)                  # sharpen

    buf = BytesIO()
    img.save(buf, format="PNG")
    results = reader.readtext(buf.getvalue(), detail=0, allowlist="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789")
    text = "".join(results).strip().replace(" ", "")
    return text


# ──────────────────────────────────────────────────────────────────────────────
# Dropdown Interaction
# ──────────────────────────────────────────────────────────────────────────────

async def fill_searchable_dropdown(page: Page, input_index: int, search_text: str, timeout_ms: int = 5000) -> bool:
    """
    Interact with a Material-UI Autocomplete / React-Select style dropdown:
    1. Click the Nth input element
    2. Clear and type the search_text
    3. Wait for options to appear
    4. Click the best matching option
    """
    inputs = await page.query_selector_all("input:not([type='hidden']):not([type='submit'])")
    if input_index >= len(inputs):
        logger.error(f"Input index {input_index} out of range (found {len(inputs)} inputs)")
        return False

    inp = inputs[input_index]
    await inp.triple_click()   # select all existing text
    await inp.fill("")
    await inp.click()
    await page.wait_for_timeout(400)
    await inp.type(search_text, delay=60)  # human-like typing
    await page.wait_for_timeout(timeout_ms)

    # Try various option selectors used by different React dropdown libraries
    option_selectors = [
        "li[role='option']",
        "[role='option']",
        "li[data-option-index]",
        ".MuiAutocomplete-option",
        ".MuiMenuItem-root",
        "[class*='option']",
        "ul[role='listbox'] li",
    ]

    for sel in option_selectors:
        opts = await page.query_selector_all(sel)
        if opts:
            # Find best match
            for opt in opts:
                opt_text = (await opt.inner_text()).strip()
                if search_text.lower() in opt_text.lower():
                    await opt.click()
                    await page.wait_for_timeout(800)
                    logger.debug(f"Selected: {opt_text!r}")
                    return True
            # Fallback: click first
            first_text = (await opts[0].inner_text()).strip()
            await opts[0].click()
            await page.wait_for_timeout(800)
            logger.debug(f"Selected first option: {first_text!r}")
            return True

    logger.warning(f"No options found for '{search_text}' in input[{input_index}]")
    return False


# ──────────────────────────────────────────────────────────────────────────────
# Profile Page Parser
# ──────────────────────────────────────────────────────────────────────────────

FIELD_MAP = {
    "market_name_official":  ["market name", "name of market", "mandi name"],
    "address":               ["address", "market address"],
    "pincode":               ["pin", "pincode", "pin code", "postal"],
    "phone":                 ["phone", "telephone", "contact no", "contact number"],
    "email":                 ["email", "e-mail", "mail"],
    "website":               ["website", "web site", "url"],
    "market_type":           ["market type", "type of market", "category"],
    "regulated":             ["regulated", "regulation act"],
    "established_year":      ["established", "year of establishment", "year established"],
    "area_hectares":         ["area", "market area", "total area"],
    "storage_capacity_mt":   ["storage capacity", "godown capacity", "storage"],
    "cold_storage":          ["cold storage"],
    "num_shops":             ["number of shops", "no. of shops", "no of shops", "shops"],
    "num_traders":           ["traders", "number of traders", "no of traders"],
    "num_commission_agents": ["commission agents", "arthias", "commission agent"],
    "num_weighing_machines": ["weighing machines", "weighing"],
    "commodities_traded":    ["commodities", "commodity traded", "crops"],
    "arrival_days":          ["arrival days", "market days", "days"],
    "working_hours":         ["working hours", "timing", "hours"],
    "bank_present":          ["bank", "banking"],
    "atm_present":           ["atm"],
    "canteen_present":       ["canteen", "restaurant"],
    "internet_present":      ["internet", "wifi", "broadband"],
    "toilet_facilities":     ["toilet", "sanitation"],
    "drinking_water":        ["drinking water", "water supply"],
    "electricity":           ["electricity", "power supply"],
    "road_connectivity":     ["road", "connectivity", "approach road"],
    "nearest_railway":       ["railway", "nearest railway", "railway station"],
    "nearest_airport":       ["airport", "nearest airport"],
    "latitude":              ["latitude", "lat"],
    "longitude":             ["longitude", "lng", "lon", "long"],
}


async def parse_profile(page: Page, profile: MandiProfile) -> MandiProfile:
    """Extract key-value data from the profile output page."""
    extra = {}

    # Strategy 1: table rows
    rows = await page.query_selector_all("tr")
    for row in rows:
        cells = await row.query_selector_all("td, th")
        if len(cells) < 2:
            continue
        key = (await cells[0].inner_text()).strip().lower()
        val = (await cells[1].inner_text()).strip()
        if not val:
            continue
        matched = False
        for attr, labels in FIELD_MAP.items():
            for label in labels:
                if label in key:
                    if not getattr(profile, attr):
                        setattr(profile, attr, val)
                    matched = True
                    break
            if matched:
                break
        if not matched and key:
            extra[key] = val

    # Strategy 2: definition lists
    dts = await page.query_selector_all("dt")
    for dt in dts:
        key = (await dt.inner_text()).strip().lower()
        dd_handle = await dt.evaluate_handle("el => el.nextElementSibling")
        dd = dd_handle.as_element()
        if not dd:
            continue
        val = (await dd.inner_text()).strip()
        for attr, labels in FIELD_MAP.items():
            for label in labels:
                if label in key:
                    if not getattr(profile, attr):
                        setattr(profile, attr, val)
                    break

    # Strategy 3: labeled spans/divs (MUI-style)
    labels = await page.query_selector_all("[class*='label' i], [class*='key' i]")
    for lbl in labels:
        key = (await lbl.inner_text()).strip().lower()
        val_handle = await lbl.evaluate_handle(
            "el => el.nextElementSibling || el.parentElement?.querySelector('[class*=\"value\"]')"
        )
        val_el = val_handle.as_element()
        if val_el:
            val = (await val_el.inner_text()).strip()
            for attr, labels_list in FIELD_MAP.items():
                for label in labels_list:
                    if label in key:
                        if not getattr(profile, attr):
                            setattr(profile, attr, val)
                        break

    if extra:
        profile.extra_data = json.dumps(extra, ensure_ascii=False)[:2000]

    return profile


# ──────────────────────────────────────────────────────────────────────────────
# Core: scrape one mandi
# ──────────────────────────────────────────────────────────────────────────────

async def scrape_one(context: BrowserContext, mandi: MandiProfile, semaphore: asyncio.Semaphore) -> MandiProfile:
    async with semaphore:
        page = await context.new_page()
        try:
            for attempt in range(MAX_CAPTCHA_RETRIES):
                mandi.captcha_attempts = attempt + 1
                try:
                    # Navigate fresh each attempt (new captcha)
                    await page.goto(PROFILE_URL, wait_until="networkidle", timeout=30000)
                    await page.wait_for_timeout(1500)

                    # ── State ──────────────────────────────────────────────
                    ok = await fill_searchable_dropdown(page, 0, mandi.state, timeout_ms=3000)
                    if not ok:
                        raise RuntimeError(f"Could not select state: {mandi.state}")
                    await page.wait_for_timeout(1000)

                    # ── District ───────────────────────────────────────────
                    ok = await fill_searchable_dropdown(page, 1, mandi.district, timeout_ms=3000)
                    if not ok:
                        raise RuntimeError(f"Could not select district: {mandi.district}")
                    await page.wait_for_timeout(1000)

                    # ── Market ─────────────────────────────────────────────
                    # Search by mandi name (trim APMC suffix for better match)
                    search_term = mandi.mandi_name.replace(" APMC", "").replace("(", "").strip()
                    ok = await fill_searchable_dropdown(page, 2, search_term, timeout_ms=3000)
                    if not ok:
                        # Try full name
                        ok = await fill_searchable_dropdown(page, 2, mandi.mandi_name, timeout_ms=3000)
                    if not ok:
                        raise RuntimeError(f"Could not select market: {mandi.mandi_name}")
                    await page.wait_for_timeout(800)

                    # ── Captcha ────────────────────────────────────────────
                    captcha_text = await solve_captcha(page)
                    logger.debug(f"OCR captcha: {captcha_text!r} (attempt {attempt+1})")

                    if not captcha_text:
                        logger.warning(f"OCR failed to read captcha, retrying...")
                        continue

                    # Fill captcha input
                    captcha_input = await page.query_selector(
                        "input[placeholder*='captcha' i], input[id*='captcha' i], "
                        "input[name*='captcha' i], input[type='text']:last-of-type"
                    )
                    if not captcha_input:
                        raise RuntimeError("Captcha input field not found")

                    await captcha_input.click()
                    await captcha_input.fill(captcha_text)
                    await page.wait_for_timeout(300)

                    # ── Submit ─────────────────────────────────────────────
                    submit = await page.query_selector(
                        "button[type='submit']:not([disabled]), "
                        "input[type='submit']:not([disabled]), "
                        "button:has-text('Submit')"
                    )
                    if not submit:
                        # Wait for submit to become enabled
                        await page.wait_for_selector(
                            "button[type='submit']:not([disabled])", timeout=3000
                        )
                        submit = await page.query_selector("button[type='submit']")

                    if not submit:
                        raise RuntimeError("Submit button not found/enabled")

                    await submit.click()
                    await page.wait_for_load_state("networkidle", timeout=20000)
                    await page.wait_for_timeout(1000)

                    # ── Check for error (wrong captcha) ─────────────────────
                    page_text = await page.inner_text("body")
                    if any(kw in page_text.lower() for kw in
                           ["invalid captcha", "wrong captcha", "captcha mismatch",
                            "please enter valid"]):
                        logger.warning(f"Wrong captcha '{captcha_text}', retrying...")
                        continue

                    # ── Parse profile ──────────────────────────────────────
                    mandi = await parse_profile(page, mandi)
                    mandi.status = "success"
                    mandi.scraped_at = datetime.now().isoformat()
                    logger.info(f"✓ [{mandi.captcha_attempts} tries] {mandi.state}/{mandi.district}/{mandi.mandi_name}")
                    return mandi

                except PWTimeout:
                    logger.warning(f"Timeout attempt {attempt+1} – {mandi.mandi_name}")
                    if attempt == MAX_CAPTCHA_RETRIES - 1:
                        mandi.status = "failed"
                        mandi.error = "Timeout after retries"
                except Exception as e:
                    logger.warning(f"Error attempt {attempt+1} – {mandi.mandi_name}: {e}")
                    if attempt == MAX_CAPTCHA_RETRIES - 1:
                        mandi.status = "failed"
                        mandi.error = str(e)[:300]

                await asyncio.sleep(1.5 ** attempt)

        finally:
            await page.close()

        mandi.scraped_at = datetime.now().isoformat()
        return mandi


async def solve_captcha(page: Page) -> str:
    """
    Find the captcha image/canvas, screenshot it, and run OCR.
    Returns the solved text string.
    """
    # Try common captcha image selectors
    selectors = [
        "img[alt*='captcha' i]",
        "img[src*='captcha' i]",
        "img[id*='captcha' i]",
        "[class*='captcha' i] img",
        "[id*='captcha' i] img",
        "canvas",
    ]
    for sel in selectors:
        el = await page.query_selector(sel)
        if el:
            img_bytes = await el.screenshot()
            # Save sample for debugging
            sample_path = LOG_DIR / "captcha_last.png"
            with open(sample_path, "wb") as f:
                f.write(img_bytes)
            text = solve_captcha_from_bytes(img_bytes)
            return text

    # Fallback: screenshot full captcha area by looking for the captcha section
    captcha_section = await page.query_selector(
        "[class*='captcha' i], [id*='captcha' i], "
        "div:has(> img):has(+ input[type='text'])"
    )
    if captcha_section:
        img_bytes = await captcha_section.screenshot()
        return solve_captcha_from_bytes(img_bytes)

    return ""


# ──────────────────────────────────────────────────────────────────────────────
# Output helpers
# ──────────────────────────────────────────────────────────────────────────────

def append_csv(profile: MandiProfile):
    row = profile.to_dict()
    write_header = not OUTPUT_CSV.exists()
    with open(OUTPUT_CSV, "a", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=row.keys())
        if write_header:
            writer.writeheader()
        writer.writerow(row)


def load_done_ids() -> set[str]:
    if not OUTPUT_CSV.exists():
        return set()
    df = pd.read_csv(OUTPUT_CSV)
    return set(df[df["status"] == "success"]["market_id"].astype(str))


# ──────────────────────────────────────────────────────────────────────────────
# Main
# ──────────────────────────────────────────────────────────────────────────────

async def main(limit: Optional[int], workers: int, headless: bool, resume: bool):
    logger.info("=" * 60)
    logger.info(f"AGMarknet OCR Scraper | workers={workers} headless={headless} resume={resume}")
    logger.info("=" * 60)

    # Warm up OCR model before browser starts
    get_ocr()

    ref_df = pd.read_csv(REFERENCE_CSV)
    logger.info(f"Reference CSV: {len(ref_df)} mandis")

    done_ids = set()
    if resume:
        done_ids = load_done_ids()
        logger.info(f"Resuming – {len(done_ids)} already done")

    mandis: list[MandiProfile] = []
    for _, row in ref_df.iterrows():
        mid = str(int(row["Market_ID"]))
        if mid in done_ids:
            continue
        mandis.append(MandiProfile(
            state=str(row["State"]).strip(),
            state_id=str(int(row["State_ID"])),
            district=str(row["District"]).strip(),
            district_id=str(int(row["District_ID"])),
            market_id=mid,
            mandi_name=str(row["Mandi_Name"]).strip(),
        ))

    if limit:
        mandis = mandis[:limit]

    logger.info(f"Mandis to scrape: {len(mandis)}")

    semaphore = asyncio.Semaphore(workers)
    results: list[MandiProfile] = []
    success = fail = 0

    async with async_playwright() as pw:
        browser = await pw.chromium.launch(
            headless=headless,
            args=["--no-sandbox", "--disable-dev-shm-usage"],
        )
        context = await browser.new_context(
            viewport={"width": 1440, "height": 900},
            locale="en-IN",
            timezone_id="Asia/Kolkata",
        )

        tasks = [scrape_one(context, m, semaphore) for m in mandis]

        for coro in atqdm(
            asyncio.as_completed(tasks),
            total=len(tasks),
            desc="Scraping",
            unit="mandi",
        ):
            p = await coro
            results.append(p)
            append_csv(p)
            if p.status == "success":
                success += 1
            else:
                fail += 1

        await browser.close()

    # Save JSON
    with open(OUTPUT_JSON, "w", encoding="utf-8") as f:
        json.dump([r.to_dict() for r in results], f, ensure_ascii=False, indent=2)

    logger.info("=" * 60)
    logger.info(f"Done!  Success={success}  Failed={fail}")
    logger.info(f"CSV  → {OUTPUT_CSV}")
    logger.info(f"JSON → {OUTPUT_JSON}")
    logger.info(f"Log  → {log_file}")
    logger.info("=" * 60)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="AGMarknet scraper with OCR captcha solving")
    parser.add_argument("--limit", type=int, default=None)
    parser.add_argument("--workers", type=int, default=2,
                        help="Parallel browser tabs (keep ≤3 to avoid rate limits)")
    parser.add_argument("--headless", action="store_true", default=True)
    parser.add_argument("--no-headless", dest="headless", action="store_false")
    parser.add_argument("--resume", action="store_true", default=False)
    args = parser.parse_args()
    asyncio.run(main(args.limit, args.workers, args.headless, args.resume))
