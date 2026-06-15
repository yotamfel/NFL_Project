"""
Backfill NFL draft picks for 1970-1999 into the `draft` table on Neon.

  1970-1979: scraped from Pro Football Reference via Selenium (CF bypass).
  1980-1999: loaded from nflreadpy (same approach as supplement_draft.py).

Run with the venv interpreter and DATABASE_URL pointing to Neon:
    $env:DATABASE_URL = "<neon-url>"
    .\\venv\\Scripts\\python.exe etl\\backfill_draft_pre2000.py

Safe to re-run: deletes any existing rows in 1970-1999 before re-inserting.
"""

import re
import shutil
import sys
import tempfile
import time
from pathlib import Path

import pandas as pd
from bs4 import BeautifulSoup, Comment
from selenium import webdriver
from selenium.webdriver.chrome.options import Options

sys.path.insert(0, str(Path(__file__).parent))
from db import get_engine

import nflreadpy as nfl

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

BASE_URL   = "https://www.pro-football-reference.com"
CHROME_BIN = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
DELAY      = 4.0      # seconds between PFR page navigations
CF_WAIT    = 12       # seconds after each page load for CF to resolve

# Our `draft` table columns (must match the Postgres table schema exactly)
OUR_COLUMNS = [
    "draft_year", "round", "pick", "team", "player_name", "pos", "age",
    "last_season", "all_pro_yrs", "pro_bowls", "years_started", "career_av",
    "draft_team_av", "g", "pass_cmp", "pass_att", "pass_yds", "pass_td",
    "pass_int", "rush_att", "rush_yds", "rush_td", "rec", "rec_yds", "rec_td",
    "solo_tkl", "def_int", "sk", "college", "player_id",
]

# data-stat attribute -> our column name for PFR draft table
PFR_STAT_MAP = {
    "draft_round":            "round",
    "draft_pick":             "pick",
    "team":                   "team",
    "pos":                    "pos",
    "age":                    "age",
    "year_max":               "last_season",
    "all_pros_first_team":    "all_pro_yrs",
    "pro_bowls":              "pro_bowls",
    "years_as_primary_starter": "years_started",
    "career_av":              "career_av",
    "draft_av":               "draft_team_av",
    "g":                      "g",
    "pass_cmp":               "pass_cmp",
    "pass_att":               "pass_att",
    "pass_yds":               "pass_yds",
    "pass_td":                "pass_td",
    "pass_int":               "pass_int",
    "rush_att":               "rush_att",
    "rush_yds":               "rush_yds",
    "rush_td":                "rush_td",
    "rec":                    "rec",
    "rec_yds":                "rec_yds",
    "rec_td":                 "rec_td",
    "def_int":                "def_int",
    "sacks":                  "sk",
    "college_id":             "college",
}

# nflreadpy column -> our column name
NFLREAD_RENAME = {
    "season":           "draft_year",
    "pfr_player_name":  "player_name",
    "position":         "pos",
    "to":               "last_season",
    "allpro":           "all_pro_yrs",
    "probowls":         "pro_bowls",
    "seasons_started":  "years_started",
    "w_av":             "career_av",
    "dr_av":            "draft_team_av",
    "games":            "g",
    "pass_completions": "pass_cmp",
    "pass_attempts":    "pass_att",
    "pass_yards":       "pass_yds",
    "pass_tds":         "pass_td",
    "pass_ints":        "pass_int",
    "rush_atts":        "rush_att",
    "rush_yards":       "rush_yds",
    "rush_tds":         "rush_td",
    "receptions":       "rec",
    "rec_yards":        "rec_yds",
    "rec_tds":          "rec_td",
    "def_solo_tackles": "solo_tkl",
    "def_ints":         "def_int",
    "def_sacks":        "sk",
    "pfr_player_id":    "player_id",
}

_HOF_STRIP = re.compile(r"HOF$")
_TEXT_COLS = {"team", "player_name", "pos", "college", "player_id"}


# ---------------------------------------------------------------------------
# Selenium driver (singleton)
# ---------------------------------------------------------------------------

_driver = _tmp_dir = None

def _get_driver():
    global _driver, _tmp_dir
    if _driver is None:
        _tmp_dir = tempfile.mkdtemp(prefix="pfr_draft_")
        opts = Options()
        opts.binary_location = CHROME_BIN
        opts.add_argument(f"--user-data-dir={_tmp_dir}")
        opts.add_argument("--no-sandbox")
        opts.add_argument("--disable-dev-shm-usage")
        opts.add_argument("--disable-blink-features=AutomationControlled")
        opts.add_argument("--no-first-run")
        opts.add_argument("--no-default-browser-check")
        opts.add_argument("--disable-default-apps")
        opts.add_experimental_option("excludeSwitches", ["enable-automation"])
        opts.add_experimental_option("useAutomationExtension", False)
        _driver = webdriver.Chrome(options=opts)
        time.sleep(2)
    return _driver

def _close_driver():
    global _driver, _tmp_dir
    if _driver:
        try: _driver.quit()
        except: pass
        _driver = None
    if _tmp_dir:
        shutil.rmtree(_tmp_dir, ignore_errors=True)
        _tmp_dir = None


# ---------------------------------------------------------------------------
# PFR scraping (1970-1979)
# ---------------------------------------------------------------------------

def _find_table(html: str, table_id: str):
    """Find a PFR table by ID, including tables inside HTML comments."""
    soup = BeautifulSoup(html, "html.parser")
    t = soup.find("table", id=table_id)
    if t:
        return t
    for comment in soup.find_all(string=lambda s: isinstance(s, Comment)):
        if f'id="{table_id}"' in comment:
            inner = BeautifulSoup(str(comment), "html.parser")
            t = inner.find("table", id=table_id)
            if t:
                return t
    return None


def _parse_draft_table(table) -> list[dict]:
    """Parse PFR `drafts` table using data-stat attributes. Returns list of row dicts."""
    tbody = table.find("tbody")
    if not tbody:
        return []
    rows = []
    for tr in tbody.find_all("tr"):
        cls = tr.get("class", [])
        if "thead" in cls or "over_header" in cls:
            continue
        cells = tr.find_all(["td", "th"])
        if not cells:
            continue
        row = {"solo_tkl": None}  # PFR draft pages lack solo tackles
        for td in cells:
            stat = td.get("data-stat", "")
            if stat == "player":
                raw = td.get_text(strip=True)
                row["player_name"] = _HOF_STRIP.sub("", raw).strip()
                row["player_id"]   = td.get("data-append-csv", "") or None
            elif stat in PFR_STAT_MAP:
                row[PFR_STAT_MAP[stat]] = td.get_text(strip=True) or None
        # Must have at least a player name and a round to be a real row
        if row.get("player_name") and row.get("round"):
            rows.append(row)
    return rows


def scrape_pfr_1970_1979() -> pd.DataFrame:
    drv = _get_driver()
    print("  [PFR warmup] solving Cloudflare on homepage...")
    drv.get(BASE_URL)
    time.sleep(18)
    print("  [PFR warmup] done")

    all_rows = []
    errors   = []

    for year in range(1970, 1980):
        url = f"{BASE_URL}/years/{year}/draft.htm"
        drv.get(url)
        time.sleep(CF_WAIT)

        table = _find_table(drv.page_source, "drafts")
        if table is None:
            print(f"  {year}: FAIL — 'drafts' table not found")
            errors.append(year)
            time.sleep(1)
            continue

        rows = _parse_draft_table(table)
        if not rows:
            print(f"  {year}: FAIL — empty table")
            errors.append(year)
            time.sleep(1)
            continue

        for r in rows:
            r["draft_year"] = year
        all_rows.extend(rows)
        print(f"  {year}: OK  {len(rows)} picks")
        time.sleep(DELAY)

    if errors:
        print(f"\n  PFR errors for years: {errors}")

    if not all_rows:
        return pd.DataFrame(columns=OUR_COLUMNS)

    df = pd.DataFrame(all_rows)
    # Coerce numeric columns
    for col in OUR_COLUMNS:
        if col in _TEXT_COLS or col == "draft_year":
            continue
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors="coerce")
    # Ensure all OUR_COLUMNS exist
    for col in OUR_COLUMNS:
        if col not in df.columns:
            df[col] = None
    return df[OUR_COLUMNS]


# ---------------------------------------------------------------------------
# nflreadpy (1980-1999)
# ---------------------------------------------------------------------------

def load_nflreadpy_1980_1999() -> pd.DataFrame:
    years = list(range(1980, 2000))
    print(f"  loading nflreadpy for {years[0]}-{years[-1]}...")
    picks = nfl.load_draft_picks(seasons=years).rename(NFLREAD_RENAME)
    df = picks.select(OUR_COLUMNS).to_pandas()
    print(f"  nflreadpy loaded {len(df)} picks")
    return df


# ---------------------------------------------------------------------------
# Player-ID linking
# ---------------------------------------------------------------------------

def link_player_ids(df: pd.DataFrame, conn) -> pd.DataFrame:
    """Null out player_ids that don't exist in the players table."""
    ids = df["player_id"].dropna().unique().tolist()
    if not ids:
        return df
    known_ids = {
        row[0] for row in conn.exec_driver_sql(
            "select player_id from players where player_id = any(%(ids)s)",
            {"ids": ids},
        ).fetchall()
    }
    unresolved = (~df["player_id"].isin(known_ids)) & df["player_id"].notna()
    linked = (~unresolved & df["player_id"].notna()).sum()
    print(f"  player_id: {len(df)} rows, {linked} linked to players table, "
          f"{unresolved.sum()} unlinked (no box-score appearances)")
    df = df.copy()
    df.loc[unresolved, "player_id"] = None
    return df


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    engine = get_engine()

    # --- Phase 1: 1970-1979 from PFR ---
    print("\n=== Phase 1: 1970-1979 (PFR scraping) ===")
    try:
        df_pfr = scrape_pfr_1970_1979()
    finally:
        _close_driver()
    print(f"  scraped {len(df_pfr)} total picks (1970-1979)")

    # --- Phase 2: 1980-1999 from nflreadpy ---
    print("\n=== Phase 2: 1980-1999 (nflreadpy) ===")
    df_nfl = load_nflreadpy_1980_1999()

    # --- Combine ---
    combined = pd.concat([df_pfr, df_nfl], ignore_index=True)
    print(f"\nCombined: {len(combined)} picks total")

    # --- Link player IDs and insert ---
    print("\n=== Inserting into Neon ===")
    with engine.begin() as conn:
        combined = link_player_ids(combined, conn)

        years_to_clear = list(range(1970, 2000))
        conn.exec_driver_sql(
            "delete from draft where draft_year = any(%(years)s)",
            {"years": years_to_clear},
        )
        combined.to_sql("draft", conn, schema="public", if_exists="append", index=False)

        total, linked = conn.exec_driver_sql(
            "select count(*), count(player_id) from draft"
        ).fetchone()

    print(f"\ndraft table now: {total} total picks, {linked} linked ({linked/total:.1%})")

    # Coverage summary
    with engine.connect() as conn:
        rows = conn.exec_driver_sql(
            "select draft_year, count(*) from draft group by draft_year order by draft_year"
        ).fetchall()
    first = rows[0]
    last  = rows[-1]
    print(f"Coverage: {first[0]}-{last[0]}  ({len(rows)} seasons)")


if __name__ == "__main__":
    main()
