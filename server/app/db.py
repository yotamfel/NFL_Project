"""SQLAlchemy engine for the web server, built from config.DATABASE_URL."""
from sqlalchemy import create_engine, event, text

from app.config import DATABASE_URL

engine = create_engine(DATABASE_URL)


@event.listens_for(engine, "connect")
def _set_search_path(dbapi_conn, _):
    """Ensure public schema is always in the search path.

    Required when connecting through Neon's PgBouncer pooler, which resets
    connection state between requests and ignores ALTER ROLE defaults.
    """
    cursor = dbapi_conn.cursor()
    cursor.execute("SET search_path TO public")
    cursor.close()
