"""
Database connection helper.

Reads DATABASE_URL from the environment first (set by GitHub Actions secrets
or server/.env loaded by run_*.py wrappers). Falls back to local PostgreSQL
for development.
"""
import os
from sqlalchemy import create_engine


def get_engine():
    url = os.environ.get("DATABASE_URL")
    if url:
        return create_engine(url)
    # Local dev fallback
    return create_engine(
        "postgresql+psycopg2://postgres@localhost:5432/NFL_project"
    )
