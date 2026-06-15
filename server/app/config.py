"""
Server configuration — reads connection details from the environment.

Unlike etl/db.py (which relies on a local pgpass file because the ETL only
ever runs on this machine), the web server is meant to be deployed to a host
like Render that has no access to that file. So the single source of truth
here is the DATABASE_URL environment variable — read from a local .env file
during development (via python-dotenv) and from the platform's own env-var
mechanism in production.

The local default below mirrors etl/db.py's CONNECTION so the server works
out of the box on this machine without requiring a .env file; libpq still
falls back to pgpass for the password exactly as it does for the ETL scripts.
"""
import os

from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.environ.get(
    "DATABASE_URL",
    "postgresql+psycopg2://postgres@localhost:5432/NFL_project",
)

# Used by the natural-language search (module 4 / stage 6) to translate
# free-text questions into SQL via Claude. No local fallback — without it,
# that one feature degrades to an honest "not configured" response rather
# than the rest of the server failing to start.
ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY")

JWT_SECRET    = os.environ.get("JWT_SECRET", "change-me-in-production")
ADMIN_USERNAME = os.environ.get("ADMIN_USERNAME", "")
