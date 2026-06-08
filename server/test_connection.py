"""One-off check that the server can reach the existing NFL_project database."""
from sqlalchemy import text

from app.db import engine

with engine.connect() as conn:
    row = conn.execute(text("SELECT count(*) FROM players")).fetchone()
    print(f"Connected. players table has {row[0]} rows.")
