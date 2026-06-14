"""
Load cleaned per-category season data into Postgres as `<category>_seasons`
tables, replacing the old, unstructured tables of the same name (a full
pg_dump backup was taken first - see db_backups/).

This stage intentionally does not add primary keys, foreign keys, or indexes:
that comes once the players master table exists (see PROJECT_LOG.md, stage 5).
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from sqlalchemy import text

from clean import CATEGORIES, load_category
from db import get_engine

if __name__ == "__main__":
    engine = get_engine()
    for category in CATEGORIES:
        df = load_category(category)
        table = f"{category}_seasons"
        # Drop with CASCADE so dependent views don't block the replace
        with engine.connect() as conn:
            conn.execute(text(f'DROP TABLE IF EXISTS public."{table}" CASCADE'))
            conn.commit()
        df.to_sql(table, engine, schema="public", if_exists="replace",
                  index=False, chunksize=5000)
        print(f"loaded {table}: {df.shape[0]} rows x {df.shape[1]} cols")
