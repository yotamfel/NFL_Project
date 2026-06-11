"""Runner: load injury data into production DB (Neon)."""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))

import os
from dotenv import load_dotenv

_SERVER_ENV = Path(__file__).parent.parent / "server" / ".env"
if _SERVER_ENV.exists():
    load_dotenv(_SERVER_ENV, override=True)
    print(f"Loaded env from {_SERVER_ENV}")

database_url = os.environ.get("DATABASE_URL")
if database_url:
    from sqlalchemy import create_engine as _ce
    import db as _etl_db
    _etl_db.get_engine = lambda: _ce(database_url)
    print("Using DATABASE_URL from .env (Neon)")
else:
    print("No DATABASE_URL — using local PostgreSQL")

from load_injuries import load_injuries

print("Loading injury data 2009–2025...")
load_injuries()
