# AGMarknet Procurement Centre Scraper

Scrapes full market profile data for **4,123 mandis** across all states/districts from  
[https://agmarknet.gov.in/viewmarketprofileinputpublic](https://agmarknet.gov.in/viewmarketprofileinputpublic)

---

## 📁 Folder Structure

```
agmarknet-scraper/
├── scrape_agmarknet.py    # Main Playwright-based browser scraper
├── fast_scrape.py         # Fast aiohttp API scraper (use after api_probe)
├── api_probe.py           # Discovers internal REST API endpoints
├── explore_agmarknet.py   # DOM explorer (run FIRST to verify selectors)
├── requirements.txt
├── data/
│   ├── agmarknet_profiles.csv       # Browser scraper output
│   ├── agmarknet_profiles_fast.csv  # Fast scraper output
│   └── agmarknet_profiles.json
└── logs/
    ├── scrape_YYYYMMDD_HHMMSS.log
    └── api_requests.json            # API probe output
```

---

## 🚀 Recommended Workflow

### Step 1 – Install dependencies
```bash
pip3 install -r requirements.txt
python3 -m playwright install chromium
```

### Step 2 – Explore the DOM (FIRST TIME ONLY)
Run the explorer to validate selector logic against the live page:
```bash
python3 explore_agmarknet.py
```
This opens a **visible browser** and prints all `<select>` IDs, option counts,  
and submit button details. Check output and update `scrape_agmarknet.py` if needed.

### Step 3 – Probe the API (RECOMMENDED)
```bash
python3 api_probe.py
```
Intercepts all XHR/fetch calls and saves them to `logs/api_requests.json`.  
If you find REST endpoints returning JSON, update `fast_scrape.py` and use that  
(10× faster than browser automation).

### Step 4 – Run the fast scraper (if API found)
```bash
python3 fast_scrape.py --workers 10 --resume
```

### Step 4b – Run the Playwright scraper (fallback)
```bash
# Test with 5 mandis first
python3 scrape_agmarknet.py --limit 5 --no-headless

# Full run (4123 mandis, ~3 parallel tabs)
python3 scrape_agmarknet.py --workers 3 --resume
```

---

## 📊 Output Columns

| Column | Description |
|---|---|
| `state` / `state_id` | State name and AGMarknet state ID |
| `district` / `district_id` | District name and ID |
| `market_id` | Unique AGMarknet market ID |
| `mandi_name` | Market/Mandi name |
| `address` | Full address |
| `pincode` | PIN code |
| `phone` | Contact number |
| `email` | Email address |
| `market_type` | APMC / Regulated / Private etc |
| `regulated` | Yes/No |
| `established_year` | Year of establishment |
| `area_hectares` | Market area in hectares |
| `storage_capacity_mt` | Godown capacity in metric tons |
| `cold_storage` | Cold storage availability |
| `num_shops` | Number of shops |
| `num_traders` | Number of registered traders |
| `num_commission_agents` | Number of arthias/commission agents |
| `commodities_traded` | Crop/commodity list |
| `latitude` / `longitude` | GPS coordinates |
| `bank_present` | Bank facility |
| `atm_present` | ATM facility |
| `road_connectivity` | Road type |
| `nearest_railway` | Nearest railway station |
| `nearest_airport` | Nearest airport |
| `scrape_status` | `success` / `failed` |
| `scraped_at` | ISO 8601 timestamp |

---

## ⚙️ CLI Options

### scrape_agmarknet.py
| Flag | Default | Description |
|---|---|---|
| `--limit N` | all | Scrape only first N mandis |
| `--headless` | True | Run browser headlessly |
| `--no-headless` | – | Show browser window |
| `--workers N` | 3 | Parallel browser tabs |
| `--resume` | False | Skip already-scraped mandis |

### fast_scrape.py
| Flag | Default | Description |
|---|---|---|
| `--limit N` | all | Limit mandis |
| `--workers N` | 10 | Concurrent HTTP requests |
| `--resume` | False | Skip already-scraped mandis |

---

## 📌 Reference Dataset

The reference CSV at `../../../SIH-KisanConnect-Enhanced/agmarknet_mandis.csv`  
contains the mandi IDs used to drive the scraping.

**Columns**: `State, State_ID, District, District_ID, Market_ID, Mandi_Name`  
**Rows**: 4,123 markets across 36 states/UTs

---

## 🔗 Integration with AnnSetu

Once scraped, the data can be:
1. Loaded into the Spring Boot backend as seed data for procurement centre classification
2. Used by the admin dashboard's data engineering panel
3. Fed into the procurement centre onboarding / login provisioning workflow
