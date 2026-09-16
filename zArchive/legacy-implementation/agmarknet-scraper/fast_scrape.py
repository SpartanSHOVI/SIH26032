"""
fast_scrape.py
--------------
Uses AGMarknet's internal REST API endpoints (discovered via api_probe.py)
to scrape data WITHOUT launching a browser. Much faster than browser automation.

After running api_probe.py and reviewing logs/api_requests.json, update
API_STATES_URL, API_DISTRICTS_URL, API_MARKETS_URL, API_PROFILE_URL below.

Default fallback URLs are best guesses based on common ASP.NET / Spring patterns.

Usage:
    python3 fast_scrape.py [--limit N] [--workers 10]
"""

import argparse
import asyncio
import csv
import json
import logging
import sys
from dataclasses import dataclass, asdict
from datetime import datetime
from pathlib import Path
from typing import Optional

import pandas as pd
import aiohttp
from tqdm.asyncio import tqdm as atqdm

# ──────────────────────────────────────────────────────────────────────────────
# Config – update these after running api_probe.py
# ──────────────────────────────────────────────────────────────────────────────

BASE_URL = "https://agmarknet.gov.in"

# Typical Agmarknet 2.0 API patterns (update from api_probe output)
API_STATES_URL      = f"{BASE_URL}/api/get-states"
API_DISTRICTS_URL   = f"{BASE_URL}/api/get-districts"     # ?stateId=X
API_MARKETS_URL     = f"{BASE_URL}/api/get-markets"       # ?districtId=X
API_PROFILE_URL     = f"{BASE_URL}/api/market-profile"    # ?marketId=X

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "en-IN,en;q=0.9",
    "Referer": f"{BASE_URL}/viewmarketprofileinputpublic",
}

# ──────────────────────────────────────────────────────────────────────────────
# Paths
# ──────────────────────────────────────────────────────────────────────────────

BASE_DIR = Path(__file__).parent
DATA_DIR = BASE_DIR / "data"
LOG_DIR  = BASE_DIR / "logs"
DATA_DIR.mkdir(exist_ok=True)
LOG_DIR.mkdir(exist_ok=True)

REFERENCE_CSV = (
    BASE_DIR.parent.parent / "SIH-KisanConnect-Enhanced" / "agmarknet_mandis.csv"
)
OUTPUT_CSV  = DATA_DIR / "agmarknet_profiles_fast.csv"
OUTPUT_JSON = DATA_DIR / "agmarknet_profiles_fast.json"

log_file = LOG_DIR / f"fast_scrape_{datetime.now().strftime('%Y%m%d_%H%M%S')}.log"
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
# Data model (flat, CSV-ready)
# ──────────────────────────────────────────────────────────────────────────────

@dataclass
class MandiRecord:
    state: str = ""
    state_id: str = ""
    district: str = ""
    district_id: str = ""
    market_id: str = ""
    mandi_name: str = ""

    # Profile fields (filled from API response)
    address: str = ""
    pincode: str = ""
    phone: str = ""
    email: str = ""
    market_type: str = ""
    regulated: str = ""
    established_year: str = ""
    area_hectares: str = ""
    storage_capacity_mt: str = ""
    cold_storage: str = ""
    num_shops: str = ""
    num_traders: str = ""
    commodities_traded: str = ""
    latitude: str = ""
    longitude: str = ""
    additional_data: str = ""   # JSON dump of any extra fields

    scraped_at: str = ""
    status: str = "pending"
    error: str = ""

    def to_dict(self):
        return asdict(self)


# ──────────────────────────────────────────────────────────────────────────────
# API fetching helpers
# ──────────────────────────────────────────────────────────────────────────────

async def fetch_json(
    session: aiohttp.ClientSession,
    url: str,
    params: dict = None,
    retries: int = 3,
) -> Optional[dict]:
    for attempt in range(retries):
        try:
            async with session.get(
                url, params=params, headers=HEADERS, timeout=aiohttp.ClientTimeout(total=15)
            ) as resp:
                if resp.status == 200:
                    return await resp.json(content_type=None)
                else:
                    logger.debug(f"HTTP {resp.status} for {url}")
        except Exception as e:
            logger.debug(f"Attempt {attempt+1} failed: {url} – {e}")
        await asyncio.sleep(1.5 ** attempt)
    return None


def flatten_profile(data: dict) -> dict:
    """
    Normalise the API response (which may differ) into a flat dict
    matching MandiRecord fields.
    """
    # Common key aliases across different Agmarknet API versions
    alias = {
        "address":             ["address", "marketAddress", "market_address", "Address"],
        "pincode":             ["pincode", "pin", "PinCode", "pinCode"],
        "phone":               ["phone", "telephone", "contactNo", "PhoneNo"],
        "email":               ["email", "Email", "emailId"],
        "market_type":         ["marketType", "market_type", "MarketType"],
        "regulated":           ["regulated", "isRegulated", "Regulated"],
        "established_year":    ["establishedYear", "yearOfEstablishment"],
        "area_hectares":       ["areaHectares", "marketArea", "area"],
        "storage_capacity_mt": ["storageCapacity", "godownCapacity"],
        "cold_storage":        ["coldStorage", "hasColdStorage"],
        "num_shops":           ["numShops", "numberOfShops", "shops"],
        "num_traders":         ["numTraders", "numberOfTraders"],
        "commodities_traded":  ["commodities", "commoditiesTraded"],
        "latitude":            ["latitude", "lat"],
        "longitude":           ["longitude", "lng", "lon"],
    }
    result = {}
    remaining = dict(data)

    for field, keys in alias.items():
        for k in keys:
            if k in data:
                result[field] = str(data[k])
                remaining.pop(k, None)
                break
        else:
            result[field] = ""

    # Store unrecognised keys as additional_data JSON
    result["additional_data"] = json.dumps(remaining, ensure_ascii=False) if remaining else ""
    return result


async def scrape_one(
    session: aiohttp.ClientSession,
    rec: MandiRecord,
    semaphore: asyncio.Semaphore,
) -> MandiRecord:
    async with semaphore:
        data = await fetch_json(
            session, API_PROFILE_URL, params={"marketId": rec.market_id}
        )
        if data:
            flat = flatten_profile(data)
            for k, v in flat.items():
                if hasattr(rec, k):
                    setattr(rec, k, v)
            rec.status = "success"
            rec.scraped_at = datetime.now().isoformat()
            logger.debug(f"✓ {rec.mandi_name} ({rec.market_id})")
        else:
            rec.status = "failed"
            rec.error = f"No data returned for marketId={rec.market_id}"
            rec.scraped_at = datetime.now().isoformat()
            logger.debug(f"✗ {rec.mandi_name} ({rec.market_id})")
        return rec


def stream_append(rec: MandiRecord):
    row = rec.to_dict()
    write_header = not OUTPUT_CSV.exists()
    with open(OUTPUT_CSV, "a", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=row.keys())
        if write_header:
            writer.writeheader()
        writer.writerow(row)


# ──────────────────────────────────────────────────────────────────────────────
# Main
# ──────────────────────────────────────────────────────────────────────────────

async def main(limit: Optional[int], workers: int, resume: bool):
    logger.info(f"Fast API scraper | workers={workers} | limit={limit} | resume={resume}")

    ref_df = pd.read_csv(REFERENCE_CSV)
    logger.info(f"Loaded {len(ref_df)} mandis from reference CSV")

    done: set[str] = set()
    if resume and OUTPUT_CSV.exists():
        df_done = pd.read_csv(OUTPUT_CSV)
        done = set(df_done[df_done["status"] == "success"]["market_id"].astype(str))
        logger.info(f"Resuming – {len(done)} already done")

    records: list[MandiRecord] = []
    for _, row in ref_df.iterrows():
        mid = str(int(row["Market_ID"]))
        if mid in done:
            continue
        records.append(MandiRecord(
            state=str(row["State"]),
            state_id=str(int(row["State_ID"])),
            district=str(row["District"]),
            district_id=str(int(row["District_ID"])),
            market_id=mid,
            mandi_name=str(row["Mandi_Name"]),
        ))

    if limit:
        records = records[:limit]

    logger.info(f"Scraping {len(records)} mandis")

    semaphore = asyncio.Semaphore(workers)
    results: list[MandiRecord] = []

    connector = aiohttp.TCPConnector(limit=workers * 2, ssl=False)
    async with aiohttp.ClientSession(connector=connector) as session:
        tasks = [scrape_one(session, r, semaphore) for r in records]
        success = fail = 0
        for coro in atqdm(
            asyncio.as_completed(tasks),
            total=len(tasks),
            desc="Fetching profiles",
            unit="mandi",
        ):
            rec = await coro
            results.append(rec)
            stream_append(rec)
            if rec.status == "success":
                success += 1
            else:
                fail += 1

    with open(OUTPUT_JSON, "w", encoding="utf-8") as f:
        json.dump([r.to_dict() for r in results], f, ensure_ascii=False, indent=2)

    logger.info(f"Done! success={success} fail={fail} → {OUTPUT_CSV}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--limit", type=int, default=None)
    parser.add_argument("--workers", type=int, default=10)
    parser.add_argument("--resume", action="store_true", default=False)
    args = parser.parse_args()
    asyncio.run(main(args.limit, args.workers, args.resume))
