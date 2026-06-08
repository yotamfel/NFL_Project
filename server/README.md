# server

FastAPI backend for the NFL data platform — serves the existing
`NFL_project` Postgres database (see `../DB_SCHEMA.md`) to the React client.

## Setup

```
python -m venv venv
./venv/Scripts/python.exe -m pip install -r requirements.txt
```

Connection details come from the `DATABASE_URL` environment variable (see
`.env.example`). Locally, no `.env` is needed — `app/config.py` falls back to
the same local connection the ETL scripts use, with libpq picking up the
password from pgpass.

## Sanity check

```
./venv/Scripts/python.exe test_connection.py
```
