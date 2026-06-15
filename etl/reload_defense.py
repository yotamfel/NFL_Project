import os, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))
from sqlalchemy import text
from db import get_engine
from clean import load_category

engine = get_engine()
df = load_category('defense')
table = 'defense_seasons'
with engine.connect() as conn:
    conn.execute(text(f'DROP TABLE IF EXISTS public."{table}" CASCADE'))
    conn.commit()
df.to_sql(table, engine, schema='public', if_exists='replace', index=False, chunksize=5000)
print(f'loaded {table}: {df.shape[0]} rows')
with engine.connect() as conn:
    r = conn.execute(text('SELECT MIN(season), MAX(season), COUNT(*) FROM defense_seasons')).fetchone()
    print(f'defense_seasons: {r[0]}-{r[1]}, {r[2]} rows')
