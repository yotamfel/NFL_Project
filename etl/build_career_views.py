"""
Build one career-totals view per stat category, collapsing each player's
`*_seasons` rows into a single row keyed by `player_id`.

Every numeric column is aggregated by one of three rules, chosen from its
name:
  - MAX, for a column named (or ending in) "lng" - a single-play record
    ("longest completion", "longest punt"), not a running total.
  - skipped, for a column whose name signals a season-level rate, percentage,
    or average (matches /pct|per_|rate|qbr|avg/ - e.g. cmp_pct, y_per_a, qbr,
    koavg). Summing - or averaging - these across seasons of different length
    produces a meaningless number. A career rate, if needed, should be
    recomputed from the summed counting stats at query time, e.g.
    `career cmp_pct = 100.0 * sum(cmp) / nullif(sum(att), 0)`.
  - summed, for everything else - the actual counting stats: yards,
    touchdowns, tackles, games, attempts, and so on.

Every view also reports `seasons_played`, `first_season`, and `last_season`.
combine has no "career" of its own - it's a single pre-draft measurement
event - so no view is built for it.
"""
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from sqlalchemy import text

from db import get_engine

CATEGORIES = ["passing", "offense", "defense", "kicking", "punting", "returns"]

_RATE_RE = re.compile(r"(pct|per_|rate|qbr|avg)")
_LONGEST_RE = re.compile(r"(^|_)lng$")
_NON_STAT = {"season", "rk", "age", "player_id", "player_name", "team", "pos", "awards", "qbrec"}


def _view_sql(category: str, columns) -> str:
    sums, maxes = [], []
    for name, dtype in columns:
        if name in _NON_STAT or dtype not in ("bigint", "double precision"):
            continue
        if _LONGEST_RE.search(name):
            maxes.append(f"max({name}) as {name}")
        elif _RATE_RE.search(name):
            continue
        else:
            sums.append(f"sum({name}) as {name}")

    select_cols = ",\n    ".join(
        ["count(distinct season) as seasons_played",
         "min(season) as first_season",
         "max(season) as last_season"] + sums + maxes
    )
    return f"""
create or replace view {category}_career as
select player_id,
    {select_cols}
from {category}_seasons
where player_id is not null
group by player_id;
"""


def build_career_views():
    engine = get_engine()
    with engine.begin() as conn:
        for category in CATEGORIES:
            cols = conn.execute(text(
                "select column_name, data_type from information_schema.columns "
                "where table_schema = 'public' and table_name = :t "
                "order by ordinal_position"
            ), {"t": f"{category}_seasons"}).fetchall()
            conn.exec_driver_sql(_view_sql(category, cols))
            n = conn.exec_driver_sql(f"select count(*) from {category}_career").scalar()
            print(f"{category}_career: {n} players")


if __name__ == "__main__":
    build_career_views()
