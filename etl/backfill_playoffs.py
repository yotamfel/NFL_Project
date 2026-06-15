"""
Scrape and load NFL playoff stats (1970-2025) into *_playoff_seasons tables.

PFR embeds postseason stats on the same page as regular season, in a secondary
table with a `_post` suffix (e.g., `passing_post` on /years/{year}/passing.htm).

Run with DATABASE_URL pointing at Neon:
    $env:DATABASE_URL = "<neon-url>"
    .\\venv\\Scripts\\python.exe etl\\backfill_playoffs.py

Categories: passing, offense, defense, kicking, punting, returns
Coverage:   depends on what PFR has — typically 1966+ for most categories.
Safe to re-run: each year is deleted then re-inserted.
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
from sqlalchemy import text

sys.path.insert(0, str(Path(__file__).parent))
from db import get_engine

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

BASE_URL   = "https://www.pro-football-reference.com"
CHROME_BIN = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
CF_WAIT    = 12   # seconds per page for CF to resolve
DELAY      = 3.5  # polite delay between requests

YEARS = list(range(1970, 2026))

# Same URL / grouped config as scrape_pfr_historical.py, but table_id is the
# *_post variant on the same page.
CATEGORY_CFG = {
    "passing": dict(
        url_tpl    = "/years/{year}/passing.htm",
        table_id   = "passing_post",
        grouped    = False,
        id_col_raw = "Player-additional",
        overrides  = {"Yds.1": "sack_yds_lost"},
    ),
    "offense": dict(
        url_tpl    = "/years/{year}/scrimmage.htm",
        table_id   = "rushing_post",
        grouped    = True,
        id_col_raw = "Player-additional",
        overrides  = {
            ("Receiving", "Yds"):   "rec_yds",   ("Rushing", "Yds"):   "rush_yds",
            ("Receiving", "TD"):    "rec_td",     ("Rushing", "TD"):    "rush_td",
            ("Receiving", "1D"):    "rec_first_downs", ("Rushing", "1D"): "rush_first_downs",
            ("Receiving", "Lng"):   "rec_lng",    ("Rushing", "Lng"):   "rush_lng",
            ("Receiving", "Y/G"):   "rec_y_per_g",("Rushing", "Y/G"):  "rush_y_per_g",
        },
    ),
    "defense": dict(
        url_tpl    = "/years/{year}/defense.htm",
        table_id   = "defense_post",
        grouped    = True,
        id_col_raw = "Player-additional",
        overrides  = {
            ("Def Interceptions", "Yds"): "int_ret_yds",
            ("Fumbles", "Yds"):           "fum_ret_yds",
            "IntTD": "int_td", "FRTD": "fr_td", "QBHits": "qb_hits",
        },
    ),
    "kicking": dict(
        url_tpl    = "/years/{year}/kicking.htm",
        table_id   = "kicking_post",
        grouped    = True,
        id_col_raw = "Player-additional",
        overrides  = {
            ("0-19",  "FGA"): "fga_0_19",  ("0-19",  "FGM"): "fgm_0_19",
            ("20-29", "FGA"): "fga_20_29", ("20-29", "FGM"): "fgm_20_29",
            ("30-39", "FGA"): "fga_30_39", ("30-39", "FGM"): "fgm_30_39",
            ("40-49", "FGA"): "fga_40_49", ("40-49", "FGM"): "fgm_40_49",
            ("50+",   "FGA"): "fga_50_plus",("50+",  "FGM"): "fgm_50_plus",
            ("Scoring","FGA"):"fga_total", ("Scoring","FGM"):"fgm_total",
        },
    ),
    "punting": dict(
        url_tpl    = "/years/{year}/punting.htm",
        table_id   = "punting_post",
        grouped    = True,
        id_col_raw = "Player-additional",
        overrides  = {},
    ),
    "returns": dict(
        url_tpl    = "/years/{year}/returns.htm",
        table_id   = "returns_post",
        grouped    = True,
        id_col_raw = "Player-additional",
        overrides  = {
            ("Punt Returns", "Ret"):   "punt_ret",      ("Kick Returns", "Ret"): "kick_ret",
            ("Punt Returns", "Yds"):   "punt_ret_yds",  ("Kick Returns", "Yds"):"kick_ret_yds",
            ("Punt Returns", "Lng"):   "punt_ret_lng",  ("Kick Returns", "Lng"):"kick_ret_lng",
            ("Punt Returns", "Y/Ret"):"y_per_punt_ret",("Kick Returns","Y/Ret"):"y_per_kick_ret",
            "PRTD": "punt_ret_td", "KRTD": "kick_ret_td",
        },
    ),
}

_BASE_RENAME = {
    "Player": "player_name", "Age": "age", "Team": "team",
    "Pos": "pos", "Tm": "team", "G": "g", "GS": "gs",
    "Rk": "rk", "Awards": "awards",
}
_SPECIAL = {"%": "_pct", "/": "_per_", "+": "_plus", "-": "_", " ": "_"}
_TEXT_COLS = {"season", "player_name", "team", "pos", "awards", "qbrec", "player_id"}
_JUNK_NAMES = {"League Average", "Player", "Avg/Throw", "Avg Team"}
_ID_SENTINELS = {"-9999", "_9999"}

# ---------------------------------------------------------------------------
# Selenium
# ---------------------------------------------------------------------------

_driver = _tmp_dir = None

def _get_driver():
    global _driver, _tmp_dir
    if _driver is None:
        _tmp_dir = tempfile.mkdtemp(prefix="pfr_playoffs_")
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
# Table extraction (same pattern as scrape_pfr_historical.py)
# ---------------------------------------------------------------------------

def _find_table(html, table_id):
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


def _extract_table(table, grouped):
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

    col_row = []
    for i, th in enumerate(name_cells):
        if i == player_idx:
            col_row.append("Player")
            col_row.append("Player-additional")
        else:
            col_row.append(th.get_text(strip=True))

    group_row = None
    if grouped and len(thead_trs) >= 2:
        group_row = []
        for th in thead_trs[0].find_all(["th", "td"]):
            colspan = int(th.get("colspan", 1))
            label   = th.get_text(strip=True)
            group_row.extend([label] * colspan)
        if player_idx is not None and player_idx < len(group_row):
            group_row.insert(player_idx + 1, "")

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
# Column cleaning (mirrors clean.py logic)
# ---------------------------------------------------------------------------

def _clean_col(name):
    name = str(name).strip()
    for ch, repl in _SPECIAL.items():
        name = name.replace(ch, repl)
    name = re.sub(r"[^0-9a-zA-Z_]", "", name)
    name = re.sub(r"_+", "_", name).strip("_").lower()
    if name and name[0].isdigit():
        name = f"_{name}"
    return name


def _build_df(group_row, col_row, data_rows, cfg, season):
    """Convert scraped table → cleaned DataFrame ready for DB insertion."""
    # Pad / truncate rows to match col_row length
    n = len(col_row)
    padded = [r[:n] + [""] * max(0, n - len(r)) for r in data_rows]

    df = pd.DataFrame(padded, columns=col_row)
    group_row = group_row or [None] * n
    overrides = cfg["overrides"]
    id_col    = cfg["id_col_raw"]

    # Rename columns
    new_names = []
    for group, name in zip(group_row, col_row):
        if name == id_col or name == "Player-additional":
            new_names.append("player_id")
        elif (group, name) in overrides:
            new_names.append(overrides[(group, name)])
        elif name in overrides:
            new_names.append(overrides[name])
        elif name in _BASE_RENAME:
            new_names.append(_BASE_RENAME[name])
        else:
            new_names.append(_clean_col(name))
    df.columns = new_names

    # Drop duplicate column names (keep first occurrence)
    df = df.loc[:, ~df.columns.duplicated()]

    # Insert season
    df.insert(0, "season", season)

    # Strip junk rows
    if "player_name" in df.columns:
        df = df[df["player_name"].notna() & ~df["player_name"].isin(_JUNK_NAMES)].copy()
    else:
        return None

    # Clean up player_id
    if "player_id" in df.columns:
        df["player_id"] = df["player_id"].replace("", None)
        df["player_id"] = df["player_id"].where(~df["player_id"].isin(_ID_SENTINELS))

    # Infer numeric types
    for col in df.columns:
        if col in _TEXT_COLS:
            continue
        if pd.api.types.is_numeric_dtype(df[col]):
            continue
        numeric = pd.to_numeric(df[col], errors="coerce")
        if numeric.isna().sum() != df[col].isna().sum():
            continue
        is_whole = numeric.dropna().mod(1).eq(0).all()
        df[col] = numeric.astype("Int64") if is_whole else numeric.astype("float64")

    return df.reset_index(drop=True)

# ---------------------------------------------------------------------------
# Scrape one category for all years
# ---------------------------------------------------------------------------

def scrape_category(category, cfg, engine):
    drv = _get_driver()
    table_name = f"{category}_playoff_seasons"
    all_frames = []
    errors = []
    last_url = None

    for year in YEARS:
        url_path = cfg["url_tpl"].format(year=year)
        url      = BASE_URL + url_path

        # Only navigate if different from the last page (each URL serves one year)
        if url != last_url:
            drv.get(url)
            time.sleep(CF_WAIT)
            last_url = url

        table = _find_table(drv.page_source, cfg["table_id"])
        if table is None:
            # No playoff data for this year/category — normal for early years
            continue

        group_row, col_row, data_rows = _extract_table(table, cfg["grouped"])
        if not col_row or not data_rows:
            continue

        df = _build_df(group_row, col_row, data_rows, cfg, year)
        if df is None or df.empty:
            continue

        all_frames.append(df)
        print(f"    {year}: {len(df)} rows")
        time.sleep(DELAY)

    if not all_frames:
        print(f"  {category}: no data found")
        return

    full = pd.concat(all_frames, ignore_index=True)
    print(f"  {category}: {len(full)} total rows  ({full['season'].min()}-{full['season'].max()})")

    # Write to DB
    with engine.begin() as conn:
        conn.execute(text(f'DROP TABLE IF EXISTS public."{table_name}" CASCADE'))
    full.to_sql(table_name, engine, schema="public", if_exists="replace",
                index=False, chunksize=5000)
    print(f"  => loaded {table_name}")


# ---------------------------------------------------------------------------
# Career views
# ---------------------------------------------------------------------------

_CAREER_EXCLUDES = {
    "season", "player_name", "team", "pos", "age", "gs", "rk",
    "awards", "qbrec", "player_id",
    # rate stats that should not be summed
    "rate", "qbr", "y_per_a", "ay_per_a", "ny_per_a", "any_per_a",
    "y_per_c", "y_per_r", "y_per_tgt", "ctch_pct", "y_per_p", "ny_per_p",
    "y_per_punt_ret", "y_per_kick_ret", "fg_pct", "xp_pct", "koavg",
    "in20_pct", "tb_pct", "rec_succ_pct", "rush_succ_pct", "sk_pct",
}


def build_career_views(engine):
    with engine.connect() as conn:
        tables = {
            r[0] for r in conn.execute(text("""
                SELECT table_name FROM information_schema.tables
                WHERE table_schema = 'public'
                  AND table_name LIKE '%_playoff_seasons'
            """)).fetchall()
        }

    for table_name in tables:
        category = table_name.replace("_playoff_seasons", "")
        view_name = f"{category}_playoff_career"

        with engine.connect() as conn:
            cols = [r[0] for r in conn.execute(text(f"""
                SELECT column_name FROM information_schema.columns
                WHERE table_schema = 'public' AND table_name = :t
                ORDER BY ordinal_position
            """), {"t": table_name}).fetchall()]

        sum_cols = [c for c in cols if c not in _CAREER_EXCLUDES and c != "player_id"]
        if not sum_cols:
            continue

        sum_exprs = ", ".join(f'SUM("{c}") AS "{c}"' for c in sum_cols)
        view_sql = f"""
            CREATE OR REPLACE VIEW public."{view_name}" AS
            SELECT player_id, {sum_exprs}
            FROM public."{table_name}"
            GROUP BY player_id
        """
        with engine.begin() as conn:
            conn.execute(text(f'DROP VIEW IF EXISTS public."{view_name}" CASCADE'))
            conn.execute(text(view_sql))
        print(f"  created view {view_name}")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    engine = get_engine()

    drv = _get_driver()
    print("Warming up Cloudflare...")
    drv.get(BASE_URL)
    time.sleep(18)
    print("CF ready\n")

    try:
        for category, cfg in CATEGORY_CFG.items():
            print(f"=== {category} ===")
            scrape_category(category, cfg, engine)
            print()
    finally:
        _close_driver()

    print("=== Building career views ===")
    build_career_views(engine)
    print("\nDone.")


if __name__ == "__main__":
    main()
