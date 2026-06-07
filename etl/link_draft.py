"""
Link the `draft` table to the `players` master table via `player_id`.

The draft table carries no PFR id of its own, so the link is rebuilt in three
passes of decreasing certainty - each one only attempts to match picks the
previous pass left unresolved (see PROJECT_LOG.md for the full investigation):

  1. Combine cross-reference - `combine_seasons.drafted_tm_per_rnd_per_yr`
     encodes "team / round / pick / year" in a 100%-parseable format, and
     (round, pick, draft_year) is a mathematically guaranteed unique key.
     Zero ambiguity. Resolves ~81% of picks.

  2. Name + position + year-gap ranking - for picks with no combine record,
     match on normalized player name (suffixes like Jr./II/HOF stripped) and
     rank candidates by how close `players.first_season` sits to `draft_year`,
     breaking ties by position-family agreement. Restricted to a <=2-year gap,
     since a rookie's first tracked season should sit right at their draft year.

  3. Unique name + confirmed NFL career - a final pass for picks the year-gap
     filter wrongly excluded. Offensive linemen (and other positions with no
     personal box-score stats) can show a `first_season` years removed from
     their actual rookie year, because `players.first_season` only reflects
     the first season they happened to record a *skill* stat. Restricting to
     `draft.g > 0` (PFR's own career-games count, printed on the draft page
     itself) filters out coincidental same-name players from other eras -
     every false candidate here had `g IS NULL` (the drafted player never
     played) and/or a `first_season` that predates the draft itself.

A foreign key is added at the end once every linkable row is populated.
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from db import get_engine

_SUFFIX_RE = r"\s+(Jr\.?|Sr\.?|II|III|IV|HOF)$"

STAGE_1_COMBINE_MATCH = f"""
alter table draft add column if not exists player_id text;

with parsed as (
    select player_id,
        (regexp_match(drafted_tm_per_rnd_per_yr,
            '^(.+) / (\\d+)(?:st|nd|rd|th) / (\\d+)(?:st|nd|rd|th) pick / (\\d{{4}})$'))[2]::int as rnd,
        (regexp_match(drafted_tm_per_rnd_per_yr,
            '^(.+) / (\\d+)(?:st|nd|rd|th) / (\\d+)(?:st|nd|rd|th) pick / (\\d{{4}})$'))[3]::int as pck,
        (regexp_match(drafted_tm_per_rnd_per_yr,
            '^(.+) / (\\d+)(?:st|nd|rd|th) / (\\d+)(?:st|nd|rd|th) pick / (\\d{{4}})$'))[4]::int as yr
    from combine_seasons
    where drafted_tm_per_rnd_per_yr is not null
      and player_id not in ('-9999', '_9999')
)
update draft d set player_id = p.player_id
from parsed p
where d.round = p.rnd and d.pick = p.pck and d.draft_year = p.yr;
"""

STAGE_2_NAME_POS_YEAR_RANK = f"""
with norm_draft as (
    select draft_year, round, pick, pos,
           lower(regexp_replace(player_name, '{_SUFFIX_RE}', '', 'g')) as norm_name
    from draft where player_id is null
), norm_players as (
    select player_id,
           lower(regexp_replace(player_name, '{_SUFFIX_RE}', '', 'g')) as norm_name,
           pos, first_season
    from players
), ranked as (
    select nd.draft_year, nd.round, nd.pick, np.player_id,
           row_number() over (
               partition by nd.draft_year, nd.round, nd.pick
               order by abs(np.first_season - nd.draft_year), (np.pos = nd.pos) desc
           ) as rn
    from norm_draft nd
    join norm_players np on np.norm_name = nd.norm_name
    where abs(np.first_season - nd.draft_year) <= 2
)
update draft d set player_id = r.player_id
from ranked r
where r.rn = 1
  and d.draft_year = r.draft_year and d.round = r.round and d.pick = r.pick
  and d.player_id is null;
"""

STAGE_3_UNIQUE_NAME_PLAYED = f"""
with norm_draft as (
    select draft_year, round, pick,
           lower(regexp_replace(player_name, '{_SUFFIX_RE}', '', 'g')) as norm_name
    from draft where player_id is null and g > 0
), norm_players as (
    select player_id,
           lower(regexp_replace(player_name, '{_SUFFIX_RE}', '', 'g')) as norm_name
    from players
), unique_matches as (
    select nd.draft_year, nd.round, nd.pick, np.player_id,
           count(*) over (partition by nd.draft_year, nd.round, nd.pick) as n_cand
    from norm_draft nd
    join norm_players np on np.norm_name = nd.norm_name
)
update draft d set player_id = u.player_id
from unique_matches u
where u.n_cand = 1
  and d.draft_year = u.draft_year and d.round = u.round and d.pick = u.pick
  and d.player_id is null;
"""

ADD_FK = """
alter table draft
    add constraint fk_draft_player foreign key (player_id) references players(player_id);
"""


def link_draft():
    engine = get_engine()
    with engine.begin() as conn:
        for label, stage_sql in [
            ("stage 1 (combine cross-reference)", STAGE_1_COMBINE_MATCH),
            ("stage 2 (name + position + year-gap rank)", STAGE_2_NAME_POS_YEAR_RANK),
            ("stage 3 (unique name + confirmed career)", STAGE_3_UNIQUE_NAME_PLAYED),
        ]:
            conn.exec_driver_sql(stage_sql)
            linked = conn.exec_driver_sql("select count(player_id) from draft").scalar()
            print(f"after {label}: {linked} linked")

        conn.exec_driver_sql(ADD_FK)
        total, linked = conn.exec_driver_sql(
            "select count(*), count(player_id) from draft").fetchone()
    print(f"final: {linked}/{total} draft picks linked ({linked / total:.1%})")


if __name__ == "__main__":
    link_draft()
