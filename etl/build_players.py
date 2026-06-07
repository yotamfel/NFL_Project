"""
Build the unified `players` master table - one row per official PFR player_id,
the stable join key that ties every category (and, eventually, the draft
table) together.

Two things vary across a player's career and have to be collapsed to one
canonical value per id:
  - player_name: players occasionally change their listed name (marriage,
    adding a family name, etc. - e.g. id AlleJo03 appears as both
    "Josh Allen" and "Josh Hines-Allen"). The most recent season's name is
    treated as canonical, since that reflects PFR's current listing.
  - pos: position codes are fine-grained and can shift season to season
    (a corner might be listed "LCB" one year and "RCB" the next for the same
    role). The most frequently listed code across a player's career is taken
    as their canonical position - a single best-guess label, not a
    normalization of the position taxonomy itself.

Players with no PFR profile page (player_id is null - clean.py normalizes the
combine page's '-9999'/'_9999' placeholder strings to null on the way in) are
excluded by the union's `where player_id is not null` - they cannot be linked
to anything else anyway.
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from sqlalchemy import text

from db import get_engine

SEASON_TABLES = ["passing_seasons", "offense_seasons", "defense_seasons",
                 "kicking_seasons", "punting_seasons", "returns_seasons", "combine_seasons"]

_APPEARANCES_UNION = " union all ".join(
    f"select player_id, player_name, pos, season from {t} where player_id is not null"
    for t in SEASON_TABLES
)

BUILD_SQL = f"""
drop table if exists players cascade;

create table players as
with valid as (
    {_APPEARANCES_UNION}
), canonical_name as (
    select distinct on (player_id) player_id, player_name as current_name
    from valid
    order by player_id, season desc
), canonical_pos as (
    select distinct on (player_id) player_id, pos as primary_pos
    from valid
    group by player_id, pos
    order by player_id, count(*) desc
), spans as (
    select player_id,
           min(season) as first_season,
           max(season) as last_season,
           count(distinct season) as n_seasons
    from valid
    group by player_id
)
select s.player_id, n.current_name as player_name, p.primary_pos as pos,
       s.first_season, s.last_season, s.n_seasons
from spans s
join canonical_name n using (player_id)
join canonical_pos p using (player_id);

alter table players add primary key (player_id);
create index ix_players_name on players (player_name);
"""

if __name__ == "__main__":
    engine = get_engine()
    with engine.begin() as conn:
        conn.execute(text(BUILD_SQL))
        total = conn.execute(text("select count(*) from players")).scalar()
        sample = conn.execute(text(
            "select player_id, player_name, pos, first_season, last_season, n_seasons "
            "from players order by n_seasons desc limit 5")).fetchall()
    print(f"players: {total} rows")
    for row in sample:
        print("  ", row)
