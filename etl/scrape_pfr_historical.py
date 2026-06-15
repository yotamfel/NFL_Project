"""
Scrape Pro Football Reference for historical season stats and save as CSV files
that are fully compatible with clean.py / load_seasons.py.

Uses Selenium 4 with your installed Chrome browser + a temporary profile,
which bypasses Cloudflare's JS challenge without any special tricks.

Usage:
    python etl/scrape_pfr_historical.py                          # 1970-1999, all categories
    python etl/scrape_pfr_historical.py --start 1990 --end 1999
    python etl/scrape_pfr_historical.py --categories passing defense
    python etl/scrape_pfr_historical.py --dry-run               # list what would be downloaded

After completion, extend the year range in clean.py and re-run load_seasons.py:
    def load_category(category: str, years=range(1970, 2025)) -> pd.DataFrame:
    python etl/load_seasons.py

Rate-limited to 3s between requests. Skips files that already exist (safe to re-run).
Combine data only available from 1987 onward.
"""

import argparse
import csv
import shutil
import sys
import tempfile
import time
from pathlib import Path

from bs4 import BeautifulSoup, Comment
from selenium import webdriver
from selenium.webdriver.chrome.options import Options

BASE_URL = "https://www.pro-football-reference.com"
DELAY    = 3.0  # seconds between page navigations

CHROME_BIN = r"C:\Program Files\Google\Chrome\Application\chrome.exe"

RAW_BASE = Path(r"C:\Users\yotam\OneDrive\שולחן העבודה\data_analyst\פרויקט\Pro Football Reference")

# PFR table IDs and URL patterns for each category.
# 'grouped': True  -- two-row header (group + column names), like offense/defense
# 'grouped': False -- single header row, like passing/combine
# 'table_id_fallbacks': tried in order if the primary table_id isn't found
CATEGORY_CFG = {
    "passing": {
        "url_tpl":  "/years/{year}/passing.htm",
        "table_id": "passing",
        "folder":   "Passing Tables",
        "file_tpl": "{year} passing.csv",
        "grouped":  False,
        "min_year": 1932,
    },
    "offense": {
        "url_tpl":  "/years/{year}/scrimmage.htm",
        "table_id": "rushing",          # primary table on scrimmage page
        "table_id_fallbacks": ["scrimmage"],
        "folder":   "Offense Tables",
        "file_tpl": "{year} offense.csv",
        "grouped":  True,
        "min_year": 1932,
    },
    "defense": {
        "url_tpl":  "/years/{year}/defense.htm",
        "table_id": "defense",
        "folder":   "Defense Tables",
        "file_tpl": "{year} defense.csv",
        "grouped":  True,
        "min_year": 1940,
    },
    "kicking": {
        "url_tpl":  "/years/{year}/kicking.htm",
        "table_id": "kicking",
        "folder":   "Kicking Tables",
        "file_tpl": "{year} kicking.csv",
        "grouped":  True,
        "min_year": 1938,
    },
    "punting": {
        "url_tpl":  "/years/{year}/punting.htm",
        "table_id": "punting",
        "folder":   "Punting Tables",
        "file_tpl": "{year} punting.csv",
        "grouped":  True,
        "min_year": 1938,
    },
    "returns": {
        "url_tpl":  "/years/{year}/returns.htm",
        "table_id": "returns",
        "folder":   "Returns Tables",
        "file_tpl": "{year} Returns.csv",
        "grouped":  True,
        "min_year": 1941,
    },
    "combine": {
        "url_tpl":  "/draft/{year}-combine.htm",
        "table_id": "combine_data",
        "table_id_fallbacks": ["stathead_table"],  # pre-2000 PFR uses this id
        "folder":   "Combine Tables",
        "file_tpl": "{year} combine.csv",
        "grouped":  False,
        "min_year": 1987,
    },
}

# ---------------------------------------------------------------------------
# Selenium driver (singleton, created once per run)
# ---------------------------------------------------------------------------

_driver = None
_tmp_profile = None


def _get_driver() -> webdriver.Chrome:
    global _driver, _tmp_profile
    if _driver is None:
        _tmp_profile = tempfile.mkdtemp(prefix="pfr_scrape_")
        opts = Options()
        opts.binary_location = CHROME_BIN
        opts.add_argument(f"--user-data-dir={_tmp_profile}")
        opts.add_argument("--no-sandbox")
        opts.add_argument("--disable-dev-shm-usage")
        opts.add_argument("--disable-blink-features=AutomationControlled")
        opts.add_argument("--no-first-run")
        opts.add_argument("--no-default-browser-check")
        opts.add_argument("--disable-default-apps")
        opts.add_experimental_option("excludeSwitches", ["enable-automation"])
        opts.add_experimental_option("useAutomationExtension", False)
        _driver = webdriver.Chrome(options=opts)
        time.sleep(2)  # let Chrome fully initialize before first navigation
    return _driver


def _close_driver():
    global _driver, _tmp_profile
    if _driver:
        try:
            _driver.quit()
        except Exception:
            pass
        _driver = None
    if _tmp_profile:
        shutil.rmtree(_tmp_profile, ignore_errors=True)
        _tmp_profile = None


# ---------------------------------------------------------------------------
# HTML fetching
# ---------------------------------------------------------------------------


CF_SOLVE_WAIT = 12  # seconds to wait for Cloudflare JS challenge to auto-resolve


def fetch_html(url: str) -> str:
    """
    Navigate to URL using the persistent Chrome session and return the page HTML.
    A fixed 10s wait gives Cloudflare's JS challenge time to auto-resolve.
    Subsequent requests to the same domain reuse the cf_clearance cookie so
    the challenge is only solved once per session.
    """
    driver = _get_driver()
    driver.get(url)
    time.sleep(CF_SOLVE_WAIT)
    return driver.page_source


# ---------------------------------------------------------------------------
# Table extraction
# ---------------------------------------------------------------------------

def find_table(html: str, table_id: str, fallbacks: list | None = None):
    """
    Locate a <table id="..."> in PFR HTML.
    PFR wraps many tables in HTML comments; this function unwraps them.
    """
    soup = BeautifulSoup(html, "html.parser")

    table = soup.find("table", id=table_id)
    if table:
        return table

    for comment in soup.find_all(string=lambda t: isinstance(t, Comment)):
        if f'id="{table_id}"' in comment or f"id='{table_id}'" in comment:
            inner = BeautifulSoup(str(comment), "html.parser")
            t = inner.find("table", id=table_id)
            if t:
                return t

    for fb_id in (fallbacks or []):
        result = find_table(html, fb_id)
        if result:
            return result

    return None


def extract_table(table, grouped: bool):
    """
    Parse a PFR <table> into CSV-ready rows.

    Returns (group_row, col_row, data_rows):
      group_row  — list[str] or None (first header row for grouped tables)
      col_row    — list[str] (column names; player ID col = 'Player-additional')
      data_rows  — list[list[str]]
    """
    thead = table.find("thead")
    tbody = table.find("tbody")
    if not thead or not tbody:
        return None, None, None

    thead_trs = thead.find_all("tr")
    name_tr   = thead_trs[-1]
    name_cells = name_tr.find_all(["th", "td"])

    player_idx = next(
        (i for i, th in enumerate(name_cells)
         if th.get("data-stat") in ("player", "name_display")),
        None,
    )

    # Build column-name row; split the single player cell into two columns
    col_row = []
    for i, th in enumerate(name_cells):
        if i == player_idx:
            col_row.append("Player")
            col_row.append("Player-additional")
        else:
            col_row.append(th.get_text(strip=True))

    # Build group row (only for grouped tables)
    group_row = None
    if grouped and len(thead_trs) >= 2:
        group_row = []
        for th in thead_trs[0].find_all(["th", "td"]):
            colspan = int(th.get("colspan", 1))
            label   = th.get_text(strip=True)
            group_row.extend([label] * colspan)
        if player_idx is not None and player_idx < len(group_row):
            group_row.insert(player_idx + 1, "")

    # Extract data rows
    data_rows = []
    for tr in tbody.find_all("tr"):
        cls = tr.get("class", [])
        if "thead" in cls or "over_header" in cls:
            continue

        cells = tr.find_all(["td", "th"])
        if not cells:
            continue

        row = []
        for td in cells:
            if td.get("data-stat") in ("player", "name_display"):
                row.append(td.get_text(strip=True))
                row.append(td.get("data-append-csv", ""))
            else:
                row.append(td.get_text(strip=True))

        if any(v.strip() for v in row):
            data_rows.append(row)

    return group_row, col_row, data_rows


# ---------------------------------------------------------------------------
# CSV saving
# ---------------------------------------------------------------------------

def save_csv(path: Path, group_row, col_row, data_rows):
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", newline="", encoding="utf-8-sig") as f:
        w = csv.writer(f)
        if group_row:
            w.writerow(group_row)
        w.writerow(col_row)
        w.writerows(data_rows)


# ---------------------------------------------------------------------------
# Per-year driver
# ---------------------------------------------------------------------------

def scrape_year(category: str, year: int, cfg: dict, dry_run: bool) -> str:
    """
    Download one category/year.
    Returns: 'skip' | 'dry' | 'ok:<N rows>' | 'error:<reason>'
    """
    out_path = RAW_BASE / cfg["folder"] / cfg["file_tpl"].format(year=year)

    if out_path.exists():
        return "skip"
    if dry_run:
        return "dry"

    url = BASE_URL + cfg["url_tpl"].format(year=year)
    try:
        html = fetch_html(url)
    except Exception as exc:
        return f"error:{type(exc).__name__}: {exc}"

    fallbacks = cfg.get("table_id_fallbacks")
    table = find_table(html, cfg["table_id"], fallbacks)
    if table is None:
        return f"error:table '{cfg['table_id']}' not found"

    group_row, col_row, data_rows = extract_table(table, cfg["grouped"])
    if col_row is None or not data_rows:
        return "error:empty table"

    save_csv(out_path, group_row, col_row, data_rows)
    return f"ok:{len(data_rows)} rows"


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(description="Scrape PFR historical season stats")
    parser.add_argument("--start", type=int, default=1970,
                        help="First season year (default: 1970)")
    parser.add_argument("--end",   type=int, default=1999,
                        help="Last season year inclusive (default: 1999)")
    parser.add_argument("--categories", nargs="*", default=list(CATEGORY_CFG),
                        metavar="CAT",
                        help=f"Categories: {', '.join(CATEGORY_CFG)} (default: all)")
    parser.add_argument("--dry-run", action="store_true",
                        help="Print what would be downloaded without doing it")
    args = parser.parse_args()

    requested = [c for c in (args.categories or []) if c in CATEGORY_CFG]
    if not requested:
        print("No valid categories specified.", file=sys.stderr)
        sys.exit(1)

    # Build work list
    work = []
    for cat in requested:
        cfg = CATEGORY_CFG[cat]
        effective_start = max(args.start, cfg["min_year"])
        if effective_start > args.end:
            print(f"  {cat}: no data before {cfg['min_year']}, skipping")
            continue
        for year in range(effective_start, args.end + 1):
            work.append((cat, year, cfg))

    total    = len(work)
    eta_min  = total * DELAY / 60
    mode     = "[DRY RUN] " if args.dry_run else ""
    print(f"{mode}{total} files to download  (~{eta_min:.0f} min)")

    # Warmup: visit PFR homepage first so Cloudflare is solved before the
    # first real page. Without this, the first data page times out while CF
    # is still challenging the browser (subsequent pages are fine because
    # the cf_clearance cookie persists within the session).
    if not args.dry_run and work:
        print("  [warmup] solving Cloudflare...")
        _get_driver().get(BASE_URL)
        time.sleep(18)
        print("  [warmup] done")

    errors = []
    try:
        for i, (cat, year, cfg) in enumerate(work, 1):
            label  = f"[{i}/{total}] {cat} {year}"
            result = scrape_year(cat, year, cfg, args.dry_run)

            if result == "skip":
                print(f"  {label}  (already exists, skipped)")
            elif result == "dry":
                print(f"  {label}  --> would download")
            elif result.startswith("ok"):
                print(f"  {label}  OK {result[3:]}")
                time.sleep(DELAY)
            else:
                reason = result[len("error:"):]
                print(f"  {label}  FAIL {reason}")
                errors.append(f"{cat} {year}: {reason}")
                time.sleep(1)
    finally:
        _close_driver()

    print()
    if errors:
        print(f"Completed with {len(errors)} error(s):")
        for e in errors:
            print(f"  {e}")
    else:
        print("All done!")

    if not args.dry_run and not errors:
        print("""
Next steps:
  1. In etl/clean.py, change the default year range:
       def load_category(category: str, years=range(1970, 2025)) -> pd.DataFrame:
  2. Re-run the loader:
       python etl/load_seasons.py
""")


if __name__ == "__main__":
    main()
