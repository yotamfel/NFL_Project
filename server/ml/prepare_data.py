"""
Builds the training set for the draft-value model: each row is one prospect's
combine measurables joined to their draft slot and career outcome.

`career_av` (PFR's Approximate Value) is used as the target rather than
deriving a value metric from the box-score categories — it already lives on
`draft`, it's position-agnostic (a lineman and a WR can be compared on the
same scale), and it's exactly the "career value" the spec asks to predict.

Only seasoned classes are included — the same DEFAULT_MIN_SEASONING_YEARS
filter app/data/draft.py uses for steals/busts, and for the same reason
(server/docs/exploration_findings.md): a class needs years to pass before
its career_av numbers reflect anything but "hasn't played enough yet".
"""
import pandas as pd
from sqlalchemy import text

from app.data.draft import DEFAULT_MIN_SEASONING_YEARS, _latest_draft_year
from app.db import engine

# Deliberately untouched for missing values — see ml/train_model.py for why.
FEATURE_COLUMNS = [
    "ht_in", "wt", "_40yd", "vertical", "bench", "broad_jump", "_3cone", "shuttle",
    "age", "round", "pick", "pos",
]
TARGET_COLUMN = "career_av"


def _height_to_inches(ht):
    """'6_2' -> 74. PFR's native combine format (DB_SCHEMA.md §5) — not the
    hyphen-corruption pattern; don't confuse the two when touching this column.
    A null ht arrives from pandas as NaN (a float), not None — pd.isna catches both."""
    if pd.isna(ht):
        return None
    feet, inches = ht.split("_")
    return int(feet) * 12 + int(inches)


def load_dataset(min_seasoning_years: int = DEFAULT_MIN_SEASONING_YEARS) -> pd.DataFrame:
    with engine.connect() as conn:
        cutoff = _latest_draft_year(conn) - min_seasoning_years
        sql = text("""
            SELECT c.ht, c.wt, c._40yd, c.vertical, c.bench, c.broad_jump,
                   c._3cone, c.shuttle, c.player_id, c.player_name,
                   d.draft_year, d.age, d.round, d.pick, d.pos, d.career_av
            FROM combine_seasons c
            JOIN draft d ON d.player_id = c.player_id AND d.draft_year = c.season
            WHERE d.draft_year <= :cutoff AND d.career_av IS NOT NULL
        """)
        df = pd.read_sql(sql, conn, params={"cutoff": cutoff})

    df["ht_in"] = df["ht"].apply(_height_to_inches)
    df["pos"] = df["pos"].astype("category")
    return df
