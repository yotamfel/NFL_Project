# NFL Project — Development Log

This document tracks the goals, decisions, and progress of this project. It's
written as a narrative log rather than a command-by-command history, so it can
double as a portfolio piece showing the reasoning behind each step.

## Overview

This project rebuilds a PostgreSQL database of NFL statistics (2000–2024) —
passing, offense, defense, kicking, punting, returns, the annual draft, and
the pre-draft combine — directly from Pro-Football-Reference's raw per-season
CSV exports. The rebuild replaced an existing database that had been silently
corrupted by round-tripping through Power BI (see the first log entry below).

Beyond "load the CSVs," the interesting engineering problems were: recovering
data that earlier tools had silently mangled, building a single canonical
player identity out of seven independent per-category tables that disagree
with each other in small ways, and linking a table (the annual draft) that
carries no stable identifier at all back to that canonical identity. The log
below follows those problems in the order they were discovered and solved.

## Tech Stack

- **Database**: PostgreSQL 17
- **ETL**: Python, pandas (3.0), SQLAlchemy 2.0 + psycopg2
- **Source data**: Pro-Football-Reference per-season CSV exports (2000–2024),
  which — unlike the corrupted database — still carry PFR's own stable player
  IDs in their raw form
- Credentials are kept out of the repo entirely via a local `.pgpass` file;
  `psql` and libpq read it automatically, so no password ever appears in code,
  shell history, or this log

## Log

### Setup — Database Connection
Connected to an existing PostgreSQL database (`NFL_project`) containing 14
tables of NFL statistics — passing, rushing/offense, defense, kicking, punting,
returns, draft, and combine data, both per-season and career totals.

To avoid storing credentials in the repo or shell history, authentication is
handled via a local `.pgpass` file (PostgreSQL's standard credential store),
which `psql` reads automatically. This keeps secrets out of version control
while still allowing password-based connections from the command line.

### Discovering the corruption, and deciding to rebuild from scratch
While exploring the existing database, several columns turned out to hold
values that made no sense for their type — small integer counts stored as
calendar dates, quarterback win-loss records stored as calendar dates, and
player surnames with hyphens replaced by underscores. The common thread was
clear once the pattern was visible: the database had previously been opened
and edited through Power BI, and Power BI's export round-trip had silently
reinterpreted and rewritten values it didn't recognize.

That ruled out patching the existing tables in place — there was no way to be
confident which other values had been silently altered without a value-by-value
audit. Fortunately, the original raw CSV exports from Pro-Football-Reference
were still available, complete with PFR's own official per-player IDs (which
the corrupted database had lost). The decision was to rebuild the entire
database from those original sources rather than trust anything already in
Postgres. A full `pg_dump` backup of the existing (corrupted) database was
taken first, as a safety net before any destructive operation.

### Designing the cleaning pipeline
The raw per-season CSVs share a handful of structural quirks across all seven
stat categories: a UTF-8 byte-order mark, two-row "grouped" headers (a
category label like "Receiving" spanning several sub-columns) whose
label-repetition convention is inconsistent from file to file, literal junk
rows ("League Average", a stray repeated header row) mixed into the data, and
— critically — a player-ID column whose *header* had been mangled to a literal
`-9999` / `#NAME?` by some prior export tool, even though the ID values
themselves were intact underneath.

Rather than write seven near-identical cleaning scripts, the pipeline
(`etl/clean.py`) is driven by a single `CATEGORIES` configuration dict: each
category declares its file naming pattern, header shape, the raw name of its
ID column (which differs across categories and even changes mid-range for
some, e.g. `Player-additional` becoming `Player_additional` partway through),
and any column-name collisions that need disambiguating once everything is
lower-cased to `snake_case`. One pipeline (`load_category`) then reads,
renames, concatenates twenty-five years of files, strips junk rows, infers
correct numeric types, and applies the corruption fixes below — for every
category.

The annual draft tables turned out to use a different (and less reliable)
header convention — only the first column of each stat group carries a label
— so they're handled by a separate, simpler pipeline (`etl/clean_draft.py`)
that names columns by position instead of by group-matching.

### Recovering data that earlier tools had silently mangled
Four distinct, deterministic corruption patterns were found and reversed
(implemented in `etl/corruption_fixes.py`, each with its own recovery
function and a comment explaining the mechanism):

1. **Small integer counts stored as dates.** A value like `4` had been
   displayed by Excel as "day 4 of its epoch" and exported back out as the
   literal string `04/01/1900`. The fix treats the displayed date as a real
   calendar date and recomputes its Excel serial-day number — which is exactly
   the original integer.
2. **Quarterback win-loss records stored as dates.** The same mechanism hit
   `QBrec` strings like `9-8-0`: Excel parsed them as month/day/year and wrote
   back `09/08/2000`. The three date components map directly back to
   wins-losses-ties.
3. **Compound surnames losing their hyphen.** Names like "Taylor-Britt" came
   back as "Taylor_Britt". A database-wide check confirmed that *every* single
   underscore appearing anywhere in a player name sits between a lowercase and
   an uppercase letter — the unmistakable signature of a hyphen lost to a
   blanket find-and-replace — so the fix is unambiguous and applied generically
   to every category's `player_name` column.
4. **Mojibake in two draft-table names** (discovered later, while linking the
   draft table — see below): `"Julién Davenport"` had been stored as
   `"JuliÃ©n Davenport"`, the classic signature of UTF-8 bytes being decoded as
   Latin-1 and re-encoded. Reversing the round-trip (`encode('latin-1')` then
   `decode('utf-8')`) restores the original name exactly. This corruption was
   isolated to the draft CSVs — re-encoding as Latin-1 is a safe no-op for any
   string that doesn't already contain the `Ã` tell.

### Building a single canonical player identity
Each of the seven stat categories is its own independent table, and they don't
always agree with each other — a player's listed name can change over a career
(marriage, adding a family name — PFR shows id `AlleJo03` as both "Josh Allen"
and "Josh Hines-Allen"), and a position code can shift season to season for the
same role (a corner listed "LCB" one year, "RCB" the next). To give every other
table a single stable thing to join against, `etl/build_players.py` collapses
all per-season appearances across all seven categories into one `players`
table, one row per official PFR `player_id`, choosing:

- the **most recently listed name** as the canonical name (it reflects PFR's
  current listing, which is what a lookup should match), and
- the **most frequently listed position** as the canonical position — a single
  best-guess label, deliberately *not* an attempt to normalize PFR's
  fine-grained position taxonomy itself, which would lose real information
  (e.g. collapsing "RDE" and "LDE" loses which side of the line a player
  rushed from).

One quirk surfaced during validation: roughly eighty players carry IDs in an
older, entirely-lowercase format (`lastnamefirstname##`, e.g. `vinatada01` for
Adam Vinatieri) instead of the now-familiar `LastFirNN` CamelCase. A
cross-table check confirmed these are stable, unique, valid PFR IDs — simply
generated under an earlier ID convention PFR used before a format change — and
not a corruption. They're preserved as-is.

### Linking the draft table: a three-stage matching problem
The annual draft tables carry no PFR player ID at all — just a name, position,
school, and the team's draft slot. Linking 5,871 draft picks across 23 years
back to `players.player_id` (so that, for example, a draft slot can be joined
to the career it produced) needed a deliberately staged approach, each stage
handling only what the previous one couldn't, in order of decreasing certainty
(`etl/link_draft.py`):

1. **Combine cross-reference (≈ 81%, zero ambiguity).** The combine table
   carries a field encoding "team / round / pick / year" as free text, and the
   triple `(round, pick, draft_year)` is, by the structure of a draft, a
   mathematically guaranteed unique key. Parsing that field and joining on the
   triple resolves the large majority of picks with no room for a wrong match.
2. **Name + position + recency ranking (+ ≈ 11%).** For picks with no combine
   record, candidates were found by normalized name (stripping suffixes like
   "Jr.", "II", "HOF") and ranked by how close the candidate's first tracked
   season sits to the draft year, with position-family agreement as a
   tie-breaker, restricted to a two-year window. Spot-checking every multi-
   candidate collision this produced (e.g. three different "Kyle Williams"es,
   two "Derrick Johnson"s drafted nine rounds apart) confirmed the ranking
   picked the right player every time — including the trickiest case, "Michael
   Carter II", correctly distinguished from a same-year same-name running back
   "Michael Carter" once the "II" suffix was normalized away.
3. **Unique name + confirmed career (+ ≈ 0.5%).** A handful of picks were still
   unmatched despite clearly having played — Ted Karras, 143 games, among them.
   The reason: offensive linemen (and other positions with no personal
   box-score stats) only enter the `players` table's record in the rare season
   they happen to record a fluke "skill" stat — a recovered fumble, a trick-play
   catch — so their tracked "first season" can sit years away from their actual
   rookie year, which had wrongly excluded them from stage 2's recency window.
   Restricting this final pass to picks with a *unique* normalized-name match
   **and** a confirmed games-played count (`draft.g > 0`, PFR's own summary
   figure) safely recovered them — every false candidate this would otherwise
   have linked turned out to have `g IS NULL` (the drafted player never made a
   roster) and/or a tracked career that started *before* the draft year, an
   impossibility that flags a coincidental same-name player from a different
   era.

The result: **5,459 of 5,871 picks (93.0%) linked**, with a foreign key from
`draft.player_id` to `players.player_id`. Of the remainder, 335 never recorded
a single game (PFR's own count is null — they're genuinely unlinkable, having
left no trace in any tracked statistic), and 77 played but carry name
discrepancies (nicknames, listing differences) that a fuzzy match could only
resolve by guessing — better left unlinked than silently wrong.

### Finalizing the schema: consistency fixes, keys, and career views
With every table clean and linked, two smaller consistency issues surfaced
while preparing to add formal constraints:

- The combine page links *every* prospect's name to a profile page — even
  those without one — rendering the missing case as the literal placeholder
  string `-9999` or `_9999`. Every other category just leaves the cell blank
  (→ null) for the same situation. Normalizing both placeholders to null in
  `clean.py` means "no PFR profile" carries one consistent representation
  everywhere, rather than a magic string that only `combine_seasons` and the
  code that reads it need to know about.
- Three combine prospects happen to share their exact name *and* draft class
  with a more famous player, and PFR's own page mistakenly links their entry
  to that more famous player's profile (e.g. a 2007 wide-receiver prospect
  named "Buster Davis" is linked to id `DaviBu99` — who is in fact a linebacker
  who actually used that ID). This is a PFR-side data quirk, not a Power BI
  corruption, and each case is told apart cleanly by the listed position not
  matching the real owner's career position. The three specific
  `(id, season, position)` triples are documented and nulled out in `clean.py`
  — leaving the data wrong would have produced both a false duplicate row and
  a false combine-to-career link.

Both fixes were folded into the loading pipeline itself (not patched directly
in the database), and re-running the full pipeline end to end reproduced
*exactly* the same `players` table and the same 5,459 draft links — confirming
the fixes only removed noise, without changing any real result.

From there, `etl/add_constraints.py` added a surrogate primary key, a
`unique(player_id, season, team)` natural-key constraint (`(player_id, season)`
for combine, which has no team), a foreign key to `players`, and a season index
to every per-season table, plus a primary key, a `unique(draft_year, round,
pick)` constraint, and a player-id index to `draft`. (A surrogate key was
necessary because `player_id` can legitimately be null — a player with no PFR
profile still has a real season row — and a primary key can't contain nulls;
Postgres treats each null as distinct for uniqueness purposes, so the natural-
key constraint still does its job for every *linked* player without rejecting
the many unlinked players who share a season and team.)

Finally, `etl/build_career_views.py` builds one materialized-free view per
category collapsing each player's seasons into career totals. Rather than
blindly summing every numeric column, each column is classified by what its
name says it is: a "longest play" column (`lng`, `rec_lng`, …) is aggregated
with `max` (it's a record, not a running total); a column whose name signals a
season-level rate, percentage, or average (`cmp_pct`, `y_per_a`, `qbr`, `koavg`,
…) is *excluded* — summing or averaging a per-season rate across seasons of
different lengths produces a number that means nothing, and a career rate, if
ever needed, should be recomputed from the summed counting stats at query time
(`career_cmp_pct = 100.0 * sum(cmp) / sum(att)`); everything else — yards,
touchdowns, tackles, games, attempts — is summed. The views were validated two
ways: cross-checking a player's view total against a manual `sum()` over their
raw season rows (exact match), and checking a household name's numbers against
public record — Tom Brady's career view reports 89,208 passing yards, 649
touchdowns, and 7,752-of-12,047 completions over 22 seasons, matching his
well-known career figures exactly.

### Finding a path to keep the data current — and an unexpected gap
Pro-Football-Reference's raw exports stop at the 2024 season, with no
ongoing feed to pull from. Looking for a way to extend the database forward
led to **nflverse**, an open-source community project that republishes NFL
data (including PFR's own player IDs as a direct field) on an automated
weekly refresh cycle — exactly the kind of source a "keep this current" job
could run against. Its Python package, `nfl_data_py`, was archived in
September 2025 in favor of its successor, `nflreadpy`, which is what this
project adopted.

Before pointing it at "the future," it was worth checking whether it could
also patch any holes in the *existing* 2000–2024 range. Comparing season
coverage across all nine tables surfaced exactly one: every single
`*_seasons` and `combine_seasons` table runs the full 2000–2024, but `draft`
quietly stopped at **2022** — the original raw CSV exports for the draft
category never included the 2023 or 2024 classes (confirmed by checking the
source folder directly: the newest file present is `Draft 2022.csv`). This
had been sitting there, invisible, since the rebuild — nothing in the
pipeline would have flagged a *category* simply ending two years early.

`nflreadpy.load_draft_picks()` covers 1980–2026 and ships its own PFR
player-id field (`pfr_player_id`) — no id-crosswalk step needed, a pleasant
contrast to the three-stage effort the original 2000–2022 linking required.
`etl/supplement_draft.py` pulls the two missing classes, renames nflverse's
columns onto this project's schema (including untangling that nflverse's
`w_av`/`dr_av` are this project's `career_av`/`draft_team_av` — PFR's
"weighted career AV" and "AV with the drafting team" — while nflverse's own
similarly-named `car_av` field is something else and is empty), and appends
516 picks. 470 of them carry a `pfr_player_id` already present in `players`;
the remaining 46 — Cody Mauch (T, 36 games), Chandler Zavala (G, 34 games),
and others overwhelmingly at offensive-line and similar no-personal-stat
positions — show the *exact same pattern* documented during the original
draft-linking effort (a real, lengthy career that simply never produces a
tracked box-score stat), and are stored with a null `player_id`, consistent
with how every other such case in this dataset is represented. The result:
`draft` now spans 2000–2024 like every other table, at 6,387 picks total and
92.8% linked — in line with the original 93.0%, as expected from picks of
the same kind.
