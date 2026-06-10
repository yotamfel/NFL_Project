"""
One-off runner: load 1999 season data into whichever database the server uses.

Uses DATABASE_URL from server/.env if present (Neon / production),
falling back to the ETL's own local-postgres connection.
"""
import sys
from pathlib import Path

# Add etl/ to path so local imports (supplement_seasons, db, ...) resolve.
sys.path.insert(0, str(Path(__file__).parent))

import os
from dotenv import load_dotenv

# Load server/.env first so DATABASE_URL overrides the ETL default when Neon is configured.
_SERVER_ENV = Path(__file__).parent.parent / "server" / ".env"
if _SERVER_ENV.exists():
    load_dotenv(_SERVER_ENV, override=True)
    print(f"Loaded env from {_SERVER_ENV}")

# Monkey-patch etl/db.py's get_engine to use DATABASE_URL if available.
database_url = os.environ.get("DATABASE_URL")
if database_url:
    from sqlalchemy import create_engine as _ce
    import db as _etl_db
    _etl_db.get_engine = lambda: _ce(database_url)
    print(f"Using DATABASE_URL from .env")
else:
    print("No DATABASE_URL found — using local PostgreSQL (localhost:5432)")

from supplement_seasons import supplement_seasons

print("Starting 1999 season supplement...")
supplement_seasons(years=[1999])
print("Done.")
