"""
Add primary keys, foreign keys, unique natural-key constraints, and indexes
across the schema, now that every table is clean and `players`/`draft` are
linked.

Every `*_seasons` table gets:
  - a surrogate `id bigserial primary key` (player_id can be null - a player
    with no PFR profile still has a real season row - so it can't anchor a
    primary key on its own)
  - a `unique (player_id, season, team)` constraint recording the real natural
    key. Postgres treats each null as distinct for uniqueness purposes, so
    this enforces "one row per player per team per season" for linked players
    without rejecting the many same-season rows belonging to unlinked ones.
  - a foreign key tying player_id back to players
  - an index on season (the natural key's leading column is player_id, so a
    "all 2020 leaders" style query needs its own index)

combine_seasons follows the same shape but keys on (player_id, season) - it
has no `team` column (the combine isn't a team event).

draft already carries its player_id + FK (added in link_draft.py); it gets a
surrogate PK, a unique constraint on its own natural key (draft_year, round,
pick), and an index on player_id for the join to players.
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from db import get_engine

TEAM_KEYED = ["passing_seasons", "offense_seasons", "defense_seasons",
              "kicking_seasons", "punting_seasons", "returns_seasons"]

STATEMENTS = []

for t in TEAM_KEYED:
    STATEMENTS += [
        f"alter table {t} add column if not exists id bigserial primary key",
        f"alter table {t} add constraint uq_{t}_player_season_team unique (player_id, season, team)",
        f"alter table {t} add constraint fk_{t}_player foreign key (player_id) references players(player_id)",
        f"create index ix_{t}_season on {t} (season)",
    ]

STATEMENTS += [
    "alter table combine_seasons add column if not exists id bigserial primary key",
    "alter table combine_seasons add constraint uq_combine_seasons_player_season unique (player_id, season)",
    "alter table combine_seasons add constraint fk_combine_seasons_player foreign key (player_id) references players(player_id)",
    "create index ix_combine_seasons_season on combine_seasons (season)",

    "alter table draft add column if not exists id bigserial primary key",
    "alter table draft add constraint uq_draft_year_round_pick unique (draft_year, round, pick)",
    "create index ix_draft_player on draft (player_id)",
]


def add_constraints():
    engine = get_engine()
    with engine.begin() as conn:
        for stmt in STATEMENTS:
            conn.exec_driver_sql(stmt)
            print(f"ok: {stmt}")


if __name__ == "__main__":
    add_constraints()
