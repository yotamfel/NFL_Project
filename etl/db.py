"""
Database connection helper.

Credentials are never stored here or in any tracked file - libpq picks them
up automatically from the user's pgpass file (the default Windows location,
%APPDATA%\\postgresql\\pgpass.conf), keyed on host:port:db:user.
"""
from sqlalchemy import create_engine

CONNECTION = dict(host="localhost", port=5432, dbname="NFL_project", user="postgres")


def get_engine():
    url = (f"postgresql+psycopg2://{CONNECTION['user']}@{CONNECTION['host']}:"
           f"{CONNECTION['port']}/{CONNECTION['dbname']}")
    return create_engine(url)
