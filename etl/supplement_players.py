"""
Add newly-appearing players to the `players` master table, and refresh the
canonical fields (name/position/season-span) for existing ones whose record
just grew - the periodic-refresh counterpart to build_players.py.

build_players.py's `drop table ... cascade; create table players as ...` is
the right shape for a one-time rebuild, but wrong for a recurring job: it
would tear down - and require re-creating - every foreign key the seven
*_seasons tables and `draft` carry back to `players`, just to add a handful
of rookies each season. The fix keeps build_players.py's exact canonical-value
logic (importing its `_APPEARANCES_UNION` so the two stay in lockstep as
season-table categories come and go) and turns the final SELECT into an
upsert instead of a CREATE TABLE AS:
  - a player_id this season's data introduces for the first time inserts a
    brand-new row;
  - a returning player whose appearance history just grew gets
    `last_season`/`n_seasons` extended, and `current_name`/`primary_pos`
    recomputed - both are whole-history aggregates ("most recent season's
    name", "most frequently listed position") that a season's worth of new
    rows can genuinely change even for a player tracked for years (PFR does
    occasionally relist a name - see id AlleJo03 in build_players.py - or
    shift a listed position code), so they have to be rebuilt from the full
    history rather than patched in place.

Recomputing that whole canonical view from scratch every run, rather than
trying to patch it incrementally, is what makes the second half correct - and
it costs nothing material: the union behind it scans at most ~37k rows
(defense_seasons, its largest member), trivial to redo on every refresh.
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from sqlalchemy import text

from build_players import _APPEARANCES_UNION
from db import get_engine

UPSERT_SQL = f"""
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
insert into players (player_id, player_name, pos, first_season, last_season, n_seasons)
select s.player_id, n.current_name, p.primary_pos, s.first_season, s.last_season, s.n_seasons
from spans s
join canonical_name n using (player_id)
join canonical_pos p using (player_id)
on conflict (player_id) do update set
    player_name = excluded.player_name,
    pos = excluded.pos,
    first_season = excluded.first_season,
    last_season = excluded.last_season,
    n_seasons = excluded.n_seasons
where (players.player_name, players.pos, players.first_season, players.last_season, players.n_seasons)
      is distinct from
      (excluded.player_name, excluded.pos, excluded.first_season, excluded.last_season, excluded.n_seasons)
returning player_id, (xmax = 0) as inserted
"""


def supplement_players():
    engine = get_engine()
    with engine.begin() as conn:
        rows = conn.execute(text(UPSERT_SQL)).fetchall()
        total = conn.execute(text("select count(*) from players")).scalar()

    inserted = [r.player_id for r in rows if r.inserted]
    refreshed = [r.player_id for r in rows if not r.inserted]
    unchanged = total - len(inserted) - len(refreshed)
    print(f"players: {total} rows total ({len(inserted)} new, {len(refreshed)} refreshed, {unchanged} unchanged)")
    if inserted:
        print(f"  new: {inserted[:10]}{' ...' if len(inserted) > 10 else ''}")
    if refreshed:
        print(f"  refreshed (span/name/pos changed): {refreshed[:10]}{' ...' if len(refreshed) > 10 else ''}")

    # weekly_stats has game-by-game data loaded more frequently than *_seasons.
    # Extend last_season for any player whose weekly data shows a newer season
    # than what the seasons tables know about (e.g. current season in progress).
    with engine.begin() as conn:
        extended = conn.execute(text("""
            UPDATE players
            SET last_season = ws.max_season
            FROM (
                SELECT player_id, MAX(season) AS max_season
                FROM weekly_stats
                GROUP BY player_id
            ) ws
            WHERE ws.player_id = players.player_id
              AND ws.max_season > players.last_season
            RETURNING players.player_id
        """)).fetchall()
    if extended:
        print(f"  last_season extended from weekly_stats: {len(extended)} players")


if __name__ == "__main__":
    supplement_players()
