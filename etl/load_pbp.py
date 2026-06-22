"""
Load play-by-play, FTN charting, and participation data into the DB.
Only loads columns needed for Situational Stats features.

Usage:
    python etl/load_pbp.py              # load all available seasons
    python etl/load_pbp.py 2024 2025    # load specific seasons
"""
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

import os
from dotenv import load_dotenv

_SERVER_ENV = Path(__file__).parent.parent / "server" / ".env"
if _SERVER_ENV.exists():
    load_dotenv(_SERVER_ENV, override=True)

database_url = os.environ.get("DATABASE_URL")
if database_url:
    from sqlalchemy import create_engine as _ce
    import db as _etl_db
    _etl_db.get_engine = lambda: _ce(database_url)
    print("Using DATABASE_URL from .env")

import nflreadpy as nfl
import polars as pl
from sqlalchemy import text
from db import get_engine

# Columns to keep from PBP (~60 most useful)
PBP_COLUMNS = [
    # Game info
    "game_id", "season", "season_type", "week", "game_date",
    "home_team", "away_team", "posteam", "defteam",
    # Play info
    "play_id", "play_type", "down", "ydstogo", "yardline_100",
    "yards_gained", "shotgun", "no_huddle", "qb_dropback",
    "qb_scramble", "qb_kneel", "qb_spike",
    "first_down_rush", "first_down_pass", "first_down_penalty",
    "third_down_converted", "third_down_failed",
    "fourth_down_converted", "fourth_down_failed",
    "goal_to_go", "success",
    # Scoring
    "touchdown", "pass_touchdown", "rush_touchdown", "return_touchdown",
    "field_goal_attempt", "field_goal_result",
    "extra_point_attempt", "extra_point_result",
    "safety",
    # Passing
    "pass_attempt", "complete_pass", "incomplete_pass", "interception", "sack",
    "passing_yards", "air_yards", "yards_after_catch",
    "pass_length", "pass_location",
    # Rushing
    "rush_attempt", "rushing_yards", "run_location", "run_gap",
    # Receiving
    "receiving_yards",
    # Player IDs
    "passer_player_id", "passer_player_name",
    "receiver_player_id", "receiver_player_name",
    "rusher_player_id", "rusher_player_name",
    "kicker_player_id", "punter_player_id",
    "interception_player_id",
    "sack_player_id",
    "fumbled_1_player_id",
    "fumble_recovery_1_player_id",
    # Fumbles
    "fumble", "fumble_forced", "fumble_lost",
    # Kicking
    "kick_distance", "kickoff_attempt", "punt_attempt", "punt_blocked", "touchback",
    # EPA / WPA
    "epa", "wpa", "wp",
    # Scores
    "posteam_score", "defteam_score",
    "posteam_score_post", "defteam_score_post",
    "score_differential",
    # Game context
    "qtr", "quarter_seconds_remaining", "half_seconds_remaining",
    "game_seconds_remaining", "game_half",
    # Weather
    "temp", "wind", "roof", "surface",
    # Game metadata
    "div_game", "spread_line", "total_line",
    # Drive
    "fixed_drive",
]


def load_pbp_seasons(years):
    engine = get_engine()

    # Create tables
    with engine.begin() as conn:
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS pbp (
                id BIGSERIAL PRIMARY KEY,
                game_id TEXT,
                season INT,
                season_type TEXT,
                week INT,
                game_date TEXT,
                home_team TEXT,
                away_team TEXT,
                posteam TEXT,
                defteam TEXT,
                play_id FLOAT,
                play_type TEXT,
                down FLOAT,
                ydstogo FLOAT,
                yardline_100 FLOAT,
                yards_gained FLOAT,
                shotgun FLOAT,
                no_huddle FLOAT,
                qb_dropback FLOAT,
                qb_scramble FLOAT,
                qb_kneel FLOAT,
                qb_spike FLOAT,
                first_down_rush FLOAT,
                first_down_pass FLOAT,
                first_down_penalty FLOAT,
                third_down_converted FLOAT,
                third_down_failed FLOAT,
                fourth_down_converted FLOAT,
                fourth_down_failed FLOAT,
                goal_to_go INT,
                success FLOAT,
                touchdown FLOAT,
                pass_touchdown FLOAT,
                rush_touchdown FLOAT,
                return_touchdown FLOAT,
                field_goal_attempt FLOAT,
                field_goal_result TEXT,
                extra_point_attempt FLOAT,
                extra_point_result TEXT,
                safety FLOAT,
                pass_attempt FLOAT,
                complete_pass FLOAT,
                incomplete_pass FLOAT,
                interception FLOAT,
                sack FLOAT,
                passing_yards FLOAT,
                air_yards FLOAT,
                yards_after_catch FLOAT,
                pass_length TEXT,
                pass_location TEXT,
                rush_attempt FLOAT,
                rushing_yards FLOAT,
                run_location TEXT,
                run_gap TEXT,
                receiving_yards FLOAT,
                passer_player_id TEXT,
                passer_player_name TEXT,
                receiver_player_id TEXT,
                receiver_player_name TEXT,
                rusher_player_id TEXT,
                rusher_player_name TEXT,
                kicker_player_id TEXT,
                punter_player_id TEXT,
                interception_player_id TEXT,
                sack_player_id TEXT,
                fumbled_1_player_id TEXT,
                fumble_recovery_1_player_id TEXT,
                fumble FLOAT,
                fumble_forced FLOAT,
                fumble_lost FLOAT,
                kick_distance FLOAT,
                kickoff_attempt FLOAT,
                punt_attempt FLOAT,
                punt_blocked FLOAT,
                touchback FLOAT,
                epa FLOAT,
                wpa FLOAT,
                wp FLOAT,
                posteam_score FLOAT,
                defteam_score FLOAT,
                posteam_score_post FLOAT,
                defteam_score_post FLOAT,
                score_differential FLOAT,
                qtr FLOAT,
                quarter_seconds_remaining FLOAT,
                half_seconds_remaining FLOAT,
                game_seconds_remaining FLOAT,
                game_half TEXT,
                temp FLOAT,
                wind FLOAT,
                roof TEXT,
                surface TEXT,
                div_game INT,
                spread_line FLOAT,
                total_line FLOAT,
                fixed_drive FLOAT
            )
        """))
        conn.execute(text("CREATE INDEX IF NOT EXISTS idx_pbp_season ON pbp (season, season_type)"))
        conn.execute(text("CREATE INDEX IF NOT EXISTS idx_pbp_passer ON pbp (passer_player_id, season)"))
        conn.execute(text("CREATE INDEX IF NOT EXISTS idx_pbp_rusher ON pbp (rusher_player_id, season)"))
        conn.execute(text("CREATE INDEX IF NOT EXISTS idx_pbp_receiver ON pbp (receiver_player_id, season)"))
        conn.execute(text("CREATE INDEX IF NOT EXISTS idx_pbp_game ON pbp (game_id)"))

        # FTN and Participation tables are auto-created by pandas on first insert
        # with correct types from the data itself

    # Load PBP
    print(f"\nLoading PBP for {years}...")
    for yr in years:
        t0 = time.time()
        try:
            raw = nfl.load_pbp(yr)
        except Exception as e:
            print(f"  PBP {yr}: SKIP ({e})")
            continue
        # Keep only columns that exist
        keep = [c for c in PBP_COLUMNS if c in raw.columns]
        df = raw.select(keep).to_pandas()
        with engine.begin() as conn:
            conn.execute(text("DELETE FROM pbp WHERE season = :yr"), {"yr": yr})
            df.to_sql("pbp", conn, if_exists="append", index=False, method="multi", chunksize=5000)
        print(f"  PBP {yr}: {len(df):,} rows ({time.time()-t0:.1f}s)")

    # Load FTN Charting (2022+)
    ftn_years = [y for y in years if y >= 2022]
    if ftn_years:
        print(f"\nLoading FTN Charting for {ftn_years}...")
        for yr in ftn_years:
            t0 = time.time()
            try:
                raw = nfl.load_ftn_charting(yr)
                df = raw.to_pandas()
                eng = get_engine()
                with eng.begin() as conn:
                    try:
                        conn.execute(text("DELETE FROM ftn_charting WHERE season = :yr"), {"yr": yr})
                    except Exception:
                        conn.rollback()
                with eng.begin() as conn:
                    df.to_sql("ftn_charting", conn, if_exists="append", index=False, method="multi", chunksize=5000)
                print(f"  FTN {yr}: {len(df):,} rows ({time.time()-t0:.1f}s)")
            except Exception as e:
                print(f"  FTN {yr}: SKIP ({e})")

    # Load Participation (2016+)
    part_years = [y for y in years if y >= 2016]
    if part_years:
        print(f"\nLoading Participation for {part_years}...")
        for yr in part_years:
            t0 = time.time()
            try:
                raw = nfl.load_participation(yr)
                df = raw.to_pandas()
                # Fix object-typed boolean columns (was_pressure etc.)
                for col in df.columns:
                    if df[col].dtype == object:
                        sample = df[col].dropna().head(5).tolist()
                        if any(isinstance(v, bool) for v in sample):
                            df[col] = df[col].map({True: 1, False: 0, None: None})
                eng = get_engine()
                with eng.begin() as conn:
                    try:
                        conn.execute(text("DELETE FROM participation WHERE nflverse_game_id LIKE :pattern"), {"pattern": f"{yr}_%"})
                    except Exception:
                        conn.rollback()
                with eng.begin() as conn:
                    df.to_sql("participation", conn, if_exists="append", index=False, method="multi", chunksize=5000)
                print(f"  Participation {yr}: {len(df):,} rows ({time.time()-t0:.1f}s)")
            except Exception as e:
                print(f"  Participation {yr}: SKIP ({e})")

    print("\nDone.")


if __name__ == "__main__":
    if len(sys.argv) > 1:
        years = [int(y) for y in sys.argv[1:]]
    else:
        # Default: current + previous season (same as supplement_seasons)
        from datetime import datetime
        now = datetime.utcnow()
        cur = now.year if now.month >= 9 else now.year - 1
        years = sorted({cur - 1, cur})
    # PBP covers max 4 years (DB size constraint: ~45MB/year, 512MB limit)
    # Delete oldest seasons to keep only the 4 most recent
    MAX_PBP_YEARS = 4
    all_years = sorted(years)
    if len(all_years) > MAX_PBP_YEARS:
        all_years = all_years[-MAX_PBP_YEARS:]

    eng = get_engine()
    with eng.begin() as conn:
        existing = [r[0] for r in conn.execute(text("SELECT DISTINCT season FROM pbp ORDER BY season")).fetchall()]
        combined = sorted(set(existing + all_years))
        if len(combined) > MAX_PBP_YEARS:
            to_delete = combined[:len(combined) - MAX_PBP_YEARS]
            for old_yr in to_delete:
                conn.execute(text("DELETE FROM pbp WHERE season = :yr"), {"yr": old_yr})
                print(f"Deleted PBP {old_yr} (keeping only {MAX_PBP_YEARS} most recent)")
    # Also trim FTN and Participation to same range
    with eng.begin() as conn:
        try:
            conn.execute(text("DELETE FROM ftn_charting WHERE season < :min_yr"), {"min_yr": all_years[0]})
        except: pass
        try:
            conn.execute(text("DELETE FROM participation WHERE LEFT(nflverse_game_id, 4)::int < :min_yr"), {"min_yr": all_years[0]})
        except: pass

    load_pbp_seasons(all_years)
