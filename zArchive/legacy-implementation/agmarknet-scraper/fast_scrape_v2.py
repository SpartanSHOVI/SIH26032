"""
fast_scrape_v2.py
=================
AGMarknet Market Profile scraper — API-only, no browser required.

Pipeline for each mandi:
  1. POST /v1/captcha/generator → get captcha_key + base64 PNG image
  2. Decode image → run EasyOCR → captcha_value string
  3. GET  /v1/market-profile?market_id=X&captcha_key=K&captcha_value=V
  4. Parse JSON response → write to CSV/JSON

Speed: ~2-4 mandis/second with workers=5 (limited by OCR on CPU)
       Use --skip-ocr to see raw API response structure first.

Usage:
    python3 fast_scrape_v2.py --limit 10 --workers 3     # test run
    python3 fast_scrape_v2.py --workers 5 --resume       # full run
    python3 fast_scrape_v2.py --limit 5 --skip-ocr       # peek raw API
"""

import argparse
import asyncio
import base64
import csv
import json
import logging
import sys
from dataclasses import dataclass, asdict, field
from datetime import datetime
from io import BytesIO
from pathlib import Path
from typing import Optional

import aiohttp
import easyocr
import pandas as pd
from PIL import Image, ImageEnhance, ImageFilter
from tqdm.asyncio import tqdm as atqdm

# ──────────────────────────────────────────────────────────────────────────────
# Config
# ──────────────────────────────────────────────────────────────────────────────

API_BASE        = "https://api.agmarknet.gov.in/v1"
CAPTCHA_GEN_URL = f"{API_BASE}/captcha/generator"
PROFILE_URL     = f"{API_BASE}/market-profile"
LOCATION_URL    = f"{API_BASE}/guest-location-filters"

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"
    ),
    "Referer":  "https://agmarknet.gov.in/viewmarketprofileinputpublic",
    "Origin":   "https://agmarknet.gov.in",
    "Accept":   "application/json, */*",
    "Content-Type": "application/json",
}

MAX_CAPTCHA_RETRIES = 5   # retry with fresh captcha if OCR is rejected

BASE_DIR      = Path(__file__).parent
DATA_DIR      = BASE_DIR / "data"
LOG_DIR       = BASE_DIR / "logs"
DATA_DIR.mkdir(exist_ok=True)
LOG_DIR.mkdir(exist_ok=True)

REFERENCE_CSV = BASE_DIR.parent.parent / "SIH-KisanConnect-Enhanced" / "agmarknet_mandis.csv"
OUTPUT_CSV    = DATA_DIR / "agmarknet_profiles_v2.csv"
OUTPUT_JSON   = DATA_DIR / "agmarknet_profiles_v2.json"

log_file = LOG_DIR / f"fast_v2_{datetime.now().strftime('%Y%m%d_%H%M%S')}.log"
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[logging.FileHandler(log_file), logging.StreamHandler(sys.stdout)],
)
logger = logging.getLogger(__name__)

# ──────────────────────────────────────────────────────────────────────────────
# OCR Engine (singleton)
# ──────────────────────────────────────────────────────────────────────────────

_ocr: Optional[easyocr.Reader] = None

def get_ocr() -> easyocr.Reader:
    global _ocr
    if _ocr is None:
        logger.info("Loading EasyOCR... (first run downloads ~100 MB model)")
        _ocr = easyocr.Reader(["en"], gpu=False, verbose=False)
        logger.info("EasyOCR ready ✓")
    return _ocr


def ocr_from_b64(b64_str: str) -> str:
    """Decode base64 PNG captcha, preprocess, run OCR, return text."""
    raw = base64.b64decode(b64_str)
    img = Image.open(BytesIO(raw)).convert("L")             # grayscale
    img = img.resize((img.width * 3, img.height * 3), Image.LANCZOS)
    img = ImageEnhance.Contrast(img).enhance(2.5)
    img = img.filter(ImageFilter.SHARPEN)
    img = img.filter(ImageFilter.MedianFilter(size=3))

    buf = BytesIO()
    img.save(buf, format="PNG")
    results = get_ocr().readtext(
        buf.getvalue(),
        detail=0,
        allowlist="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789",
    )
    return "".join(results).strip().replace(" ", "")


# ──────────────────────────────────────────────────────────────────────────────
# Data Model
# ──────────────────────────────────────────────────────────────────────────────

@dataclass
class MandiRecord:
    # From reference CSV
    state: str = ""
    state_id: str = ""
    district: str = ""
    district_id: str = ""
    market_id: str = ""
    mandi_name: str = ""

    # Scraped from API — top-level fields
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
    working_hours: str = ""
    bank_present: str = ""
    atm_present: str = ""
    internet_present: str = ""
    toilet_facilities: str = ""
    electricity: str = ""
    road_connectivity: str = ""
    nearest_railway: str = ""
    nearest_airport: str = ""
    latitude: str = ""
    longitude: str = ""
    raw_json: str = ""        # full API response for future reference

    scraped_at: str = ""
    status: str = "pending"
    error: str = ""
    captcha_attempts: int = 0

    def to_dict(self):
        return asdict(self)


# Flexible field aliases to handle varying API key names
FIELD_ALIASES = {
    "market_name_official":  ["name of the apmc", "name of apmc", "market name", "market"],
    "address":               ["address of the apmc", "address", "market address"],
    "pincode":               ["pin code", "pincode", "postal code"],
    "phone":                 ["telephone(with std code)", "phone", "telephone", "contact no", "mobile"],
    "email":                 ["e-mail id of the apmc", "email", "e-mail"],
    "website":               ["website", "web site"],
    "market_type":           ["market revenue category", "market category", "type of market", "market type"],
    "regulated":             ["regulated/unregulated", "regulated", "regulation"],
    "established_year":      ["year of establishment", "established year"],
    "area_hectares":         ["total area of market yard (in hectares)", "area of market (hectares)", "market area"],
    "storage_capacity_mt":   ["storage capacity (metric tonnes)", "godown capacity", "storage capacity"],
    "cold_storage":          ["cold storage facility", "cold storage"],
    "num_shops":             ["number of shops", "no. of shops"],
    "num_traders":           ["number of traders", "no. of traders"],
    "num_commission_agents": ["number of commission agents", "no. of commission agents", "arthias"],
    "num_weighing_machines": ["number of weighing machines", "weighing machines"],
    "commodities_traded":    ["important commodities", "commodities traded", "commodity"],
    "working_hours":         ["working hours", "market timing"],
    "bank_present":          ["bank facility", "bank"],
    "atm_present":           ["atm facility", "atm"],
    "internet_present":      ["internet facility", "internet"],
    "toilet_facilities":     ["toilet facility", "sanitation"],
    "electricity":           ["electricity", "power supply"],
    "road_connectivity":     ["approach road", "road connectivity", "type of road"],
    "nearest_railway":       ["nearest railway station", "railway station"],
    "nearest_airport":       ["nearest airport", "airport"],
    "latitude":              ["market latitude", "latitude"],
    "longitude":             ["market longitude", "longitude"],
}


def parse_api_response(data: dict, rec: MandiRecord) -> MandiRecord:
    """
    Map AGMarknet API response to MandiRecord.

    The API returns a nested structure:
        data.marketProfile.state/market/district  → top-level names
        data.marketProfile.categories[] → each has sub_categories[] → data [{key, value}]

    We flatten all key-value pairs into a lookup dict, then map against FIELD_ALIASES.
    """
    rec.raw_json = json.dumps(data, ensure_ascii=False)[:5000]

    # ── Navigate to marketProfile ─────────────────────────────────────────────
    market_profile = data
    if "data" in data and isinstance(data["data"], dict):
        market_profile = data["data"].get("marketProfile", data["data"])
    elif "marketProfile" in data:
        market_profile = data["marketProfile"]

    # ── Build a flat key→value dict from all categories ───────────────────────
    flat: dict[str, str] = {}

    # Top-level simple fields
    for k, v in market_profile.items():
        if v is not None and not isinstance(v, (dict, list)):
            flat[k.lower()] = str(v).strip()

    # Walk categories → sub_categories → data[{key, value}]
    for cat in market_profile.get("categories", []):
        cat_name = cat.get("name", "")
        for subcat in cat.get("sub_categories", []):
            for kv in subcat.get("data", []):
                if not isinstance(kv, dict):
                    continue
                key = str(kv.get("key") or "").strip().lower()
                val = kv.get("value")
                if key and val is not None:
                    flat[key] = str(val).strip()
                    # Also store under category.key for disambiguation
                    flat[f"{cat_name}.{key}"] = str(val).strip()

    # ── Map flat dict to MandiRecord fields using FIELD_ALIASES (exact match only) ──
    for attr, aliases in FIELD_ALIASES.items():
        if getattr(rec, attr):
            continue   # don't overwrite already set fields
        for alias in aliases:
            alias_lower = alias.lower()
            if alias_lower in flat:
                setattr(rec, attr, flat[alias_lower])
                break

    # ── Store ALL flat keys in extra_data for reference ───────────────────────
    rec.extra_data = json.dumps(
        {k: v for k, v in flat.items() if "." not in k},
        ensure_ascii=False
    )[:3000]

    return rec


# ──────────────────────────────────────────────────────────────────────────────
# Core scraping
# ──────────────────────────────────────────────────────────────────────────────

async def get_captcha(session: aiohttp.ClientSession) -> tuple[str, str]:
    """
    POST to captcha generator.
    Returns (captcha_key, captcha_value_from_ocr).
    """
    async with session.post(CAPTCHA_GEN_URL, json={}, headers=HEADERS) as resp:
        data = await resp.json(content_type=None)
        key = data["captcha_key"]
        b64 = data["captcha_image"]
        value = ocr_from_b64(b64)

        # Save latest captcha image for debugging
        raw = base64.b64decode(b64)
        with open(LOG_DIR / "last_captcha.png", "wb") as f:
            f.write(raw)

        return key, value


async def fetch_profile(
    session: aiohttp.ClientSession,
    market_id: str,
    skip_ocr: bool = False,
    state_id: str = "",
    district_id: str = "",
) -> Optional[dict]:
    """
    Fetch a market profile with captcha solving.
    Returns the JSON response dict or None on failure.
    """
    rate_limit_wait = 3.0   # base wait on rate limit; doubles each time

    for attempt in range(MAX_CAPTCHA_RETRIES):
        try:
            # Small delay between attempts to avoid hammering the API
            if attempt > 0:
                await asyncio.sleep(1.0)

            captcha_key, captcha_value = await get_captcha(session)

            if skip_ocr:
                logger.info(f"[skip-ocr] market_id={market_id} captcha_key={captcha_key}")
                return {"__skip_ocr": True, "captcha_key": captcha_key}

            if not captcha_value:
                logger.debug(f"OCR returned empty for market {market_id}, retrying")
                continue

            # Exact params matching the AGMarknet SPA JS bundle:
            # new URLSearchParams({market:e.marketId, state:e.stateId, district:e.districtId, _:timestamp})
            # then t.set("captcha", e.captcha), t.set("captcha_key", e.captcha_key)
            import time as _time
            params = {
                "market":      market_id,
                "state":       state_id,
                "district":    district_id,
                "_":           str(int(_time.time() * 1000)),
                "captcha":     captcha_value,
                "captcha_key": captcha_key,
            }
            logger.debug(f"market={market_id} state={state_id} district={district_id} ocr={captcha_value!r} attempt={attempt+1}")

            async with session.get(PROFILE_URL, params=params, headers=HEADERS) as resp:
                body = await resp.json(content_type=None)

                if resp.status == 200:
                    # Check for success in body
                    if isinstance(body, dict) and body.get("status") == "success":
                        return body
                    # Some mandis return 200 but no profile data
                    logger.debug(f"market {market_id} HTTP 200 but no success in body: {str(body)[:100]}")
                    return body

                if resp.status in (400, 401, 403):
                    err_msg = ""
                    if isinstance(body, dict):
                        err_msg = body.get("detail") or body.get("error") or body.get("message") or str(body)
                    else:
                        err_msg = str(body)

                    if "too many" in err_msg.lower() or "rate" in err_msg.lower():
                        # Rate limited — back off significantly
                        logger.warning(
                            f"market {market_id} rate limited (attempt {attempt+1}), "
                            f"waiting {rate_limit_wait:.0f}s..."
                        )
                        await asyncio.sleep(rate_limit_wait)
                        rate_limit_wait = min(rate_limit_wait * 2, 30)   # cap at 30s
                        continue

                    if "captcha" in err_msg.lower():
                        logger.debug(f"Captcha rejected: {err_msg} (attempt {attempt+1})")
                        await asyncio.sleep(0.5)
                        continue

                    logger.warning(f"market {market_id} HTTP {resp.status}: {err_msg[:100]}")
                    return None

                logger.warning(f"market {market_id} HTTP {resp.status}: {str(body)[:100]}")
                return None

        except Exception as e:
            logger.debug(f"attempt {attempt+1} error for market {market_id}: {e}")
            await asyncio.sleep(1)

    return None



async def scrape_one(
    session: aiohttp.ClientSession,
    rec: MandiRecord,
    semaphore: asyncio.Semaphore,
    skip_ocr: bool = False,
) -> MandiRecord:
    async with semaphore:
        data = await fetch_profile(session, rec.market_id, skip_ocr,
                                   state_id=rec.state_id, district_id=rec.district_id)
        if data:
            rec = parse_api_response(data, rec)
            rec.status = "success"
        else:
            rec.status = "failed"
            rec.error = "No data after retries"
        rec.scraped_at = datetime.now().isoformat()
        if rec.status == "success":
            logger.info(f"✓ {rec.state}/{rec.district}/{rec.mandi_name}")
        else:
            logger.debug(f"✗ {rec.mandi_name}")
        return rec


# ──────────────────────────────────────────────────────────────────────────────
# Output helpers
# ──────────────────────────────────────────────────────────────────────────────

def stream_csv(rec: MandiRecord):
    row = rec.to_dict()
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

async def main(limit: Optional[int], workers: int, resume: bool, skip_ocr: bool):
    logger.info("=" * 60)
    logger.info(f"AGMarknet Fast Scraper v2 | workers={workers} resume={resume}")
    logger.info("=" * 60)

    # Warm up OCR model before starting workers
    if not skip_ocr:
        get_ocr()

    ref_df = pd.read_csv(REFERENCE_CSV)
    logger.info(f"Reference: {len(ref_df)} mandis")

    done_ids: set[str] = set()
    if resume:
        done_ids = load_done_ids()
        logger.info(f"Resuming — {len(done_ids)} already done")

    records: list[MandiRecord] = []
    for _, row in ref_df.iterrows():
        mid = str(int(row["Market_ID"]))
        if mid in done_ids:
            continue
        records.append(MandiRecord(
            state=str(row["State"]).strip(),
            state_id=str(int(row["State_ID"])),
            district=str(row["District"]).strip(),
            district_id=str(int(row["District_ID"])),
            market_id=mid,
            mandi_name=str(row["Mandi_Name"]).strip(),
        ))

    if limit:
        records = records[:limit]

    logger.info(f"Scraping {len(records)} mandis")

    semaphore = asyncio.Semaphore(workers)
    results: list[MandiRecord] = []
    success = fail = 0

    connector = aiohttp.TCPConnector(limit=workers * 3, ssl=False)
    async with aiohttp.ClientSession(connector=connector) as session:
        tasks = [scrape_one(session, r, semaphore, skip_ocr) for r in records]

        for coro in atqdm(
            asyncio.as_completed(tasks),
            total=len(tasks),
            desc="Scraping profiles",
            unit="mandi",
        ):
            rec = await coro
            results.append(rec)
            stream_csv(rec)
            if rec.status == "success":
                success += 1
            else:
                fail += 1

    # JSON dump
    with open(OUTPUT_JSON, "w", encoding="utf-8") as f:
        json.dump([r.to_dict() for r in results], f, ensure_ascii=False, indent=2)

    logger.info("=" * 60)
    logger.info(f"Done!  Success={success}  Failed={fail}")
    logger.info(f"Output CSV  : {OUTPUT_CSV}")
    logger.info(f"Output JSON : {OUTPUT_JSON}")
    logger.info(f"Log         : {log_file}")
    logger.info("=" * 60)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="AGMarknet scraper v2 — API + OCR captcha")
    parser.add_argument("--limit",    type=int, default=None, help="Max mandis to scrape")
    parser.add_argument("--workers",  type=int, default=3,   help="Concurrent requests")
    parser.add_argument("--resume",   action="store_true",   help="Skip already done mandis")
    parser.add_argument("--skip-ocr", action="store_true",   help="Skip OCR, just show API structure")
    args = parser.parse_args()
    asyncio.run(main(args.limit, args.workers, args.resume, args.skip_ocr))
