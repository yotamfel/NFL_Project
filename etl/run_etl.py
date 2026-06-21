"""
Unified ETL runner: refreshes all NFL data from nflverse sources.

Runs the full pipeline in dependency order:
  1. supplement_seasons  — core season stats (all 6 categories) + player table
  2. load_weekly_stats   — per-game stats for anomaly detection / playoff aggregation
  3. build_career_views  — refresh career aggregation views
  4. build_fdv_v3        — rebuild FDV scores from updated data
  5. Secondary loaders   — injuries, NGS stats, snap counts, advanced receiving

Usage:
    python etl/run_etl.py              # run everything
    python etl/run_etl.py --skip-fdv   # skip FDV rebuild
    python etl/run_etl.py --only-seasons  # only step 1
"""
import sys
import time
import argparse
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
    print("Using DATABASE_URL from .env (Neon)")
else:
    print("No DATABASE_URL — using local PostgreSQL")


def _step(name, fn):
    print(f"\n{'='*60}")
    print(f"  {name}")
    print(f"{'='*60}")
    t0 = time.time()
    try:
        fn()
        print(f"  Done in {time.time()-t0:.1f}s")
        return True
    except Exception as e:
        print(f"  FAILED: {e}")
        return False


def main():
    parser = argparse.ArgumentParser(description="Run NFL ETL pipeline")
    parser.add_argument("--skip-seasons", action="store_true")
    parser.add_argument("--skip-weekly", action="store_true")
    parser.add_argument("--skip-careers", action="store_true")
    parser.add_argument("--skip-fdv", action="store_true")
    parser.add_argument("--skip-secondary", action="store_true")
    parser.add_argument("--only-seasons", action="store_true",
                        help="Only run supplement_seasons (step 1)")
    args = parser.parse_args()

    results = {}
    t_start = time.time()

    # Step 1: Core season stats
    if not args.skip_seasons:
        from supplement_seasons import supplement_seasons
        results["seasons"] = _step("Step 1: supplement_seasons", supplement_seasons)
    if args.only_seasons:
        return

    # Step 2: Weekly stats
    if not args.skip_weekly:
        from load_weekly_stats import load_weekly_stats
        results["weekly"] = _step("Step 2: load_weekly_stats", load_weekly_stats)

    # Step 3: Career views
    if not args.skip_careers:
        from build_career_views import build_career_views
        results["careers"] = _step("Step 3: build_career_views", build_career_views)

    # Step 4: FDV
    if not args.skip_fdv:
        from build_fdv_v3 import build_fdv_v3
        from db import get_engine as _ge
        def _run_fdv():
            engine = _ge()
            from sqlalchemy import text as _t
            import pandas as _pd
            players = _pd.read_sql("SELECT player_id, player_name, pos FROM players", engine)
            result = build_fdv_v3(engine)
            final = result.merge(players, on="player_id", how="left")
            with engine.begin() as conn:
                conn.execute(_t("UPDATE players SET fdv = NULL"))
                for _, r in final.iterrows():
                    conn.execute(_t("UPDATE players SET fdv=:f WHERE player_id=:p"),
                                 {"f": float(r["fdv"]), "p": r["player_id"]})
            print(f"  FDV written for {len(final)} players")
        results["fdv"] = _step("Step 4: build_fdv_v3", _run_fdv)

    # Step 5: Secondary loaders
    if not args.skip_secondary:
        from load_injuries import load_injuries
        results["injuries"] = _step("Step 5a: load_injuries", load_injuries)

        from load_ngs_stats import load_ngs_stats
        results["ngs"] = _step("Step 5b: load_ngs_stats", load_ngs_stats)

        from load_snap_counts import load_snap_counts
        results["snaps"] = _step("Step 5c: load_snap_counts", load_snap_counts)

        from load_adv_receiving import load_adv_receiving
        results["adv_rec"] = _step("Step 5d: load_adv_receiving", load_adv_receiving)

    # Summary
    print(f"\n{'='*60}")
    print(f"  ETL complete in {time.time()-t_start:.1f}s")
    for name, ok in results.items():
        print(f"    {name}: {'OK' if ok else 'FAILED'}")
    print(f"{'='*60}")

    if not all(results.values()):
        sys.exit(1)


if __name__ == "__main__":
    main()
