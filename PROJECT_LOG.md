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

### Building the periodic-refresh pipeline: trusting nflverse enough to extend the database past 2024
The draft gap was a one-time backfill. The much bigger structural fact behind
it — PFR's raw exports simply stop at 2024, full stop — meant that keeping
the other seven categories current needed a recurring job, not a patch.
`etl/supplement_seasons.py` is that job: pull a season of `nflreadpy` data,
reshape it onto this project's PFR-derived schema, and append it.

The trouble is that "reshape it onto this project's schema" is not a column
rename. nflverse's wide per-player-season table uses different column
groupings, different inclusion rules, and — in a few places — measures
different things than PFR's published categories do, and PFR's own raw
exports (the only ground truth this project has ever trusted) don't exist for
any season nflverse would be filling in. Two sourcing strategies ended up
covering the schema, chosen column by column:

1. **Direct fields and formula-computed derivatives.** The large majority of
   PFR's published columns — including its "advanced" derived ones — turn out
   to be exactly reproducible from nflverse's raw counts via PFR's own
   published formulas. Joe Burrow's 2024 line reproduces to the decimal
   (passer rating 108.5, AY/A 8.24, ANY/A 6.86, Sk% 6.86%) once the formula is
   right.
2. **Direct play-by-play aggregation**, for the handful of things the wide
   table either doesn't carry at all or gets demonstrably wrong. Two findings
   stand out: punting and placekicker-kickoff lines are *entirely absent* from
   the wide table — there's no shortcut around aggregating raw plays for them —
   and the wide table's own `def_tds` column is provably unreliable: Taron
   Johnson scored two genuine defensive touchdowns in 2024 (an
   interception-return TD and a fumble-recovery TD, both confirmed in the raw
   play text, and both present in PFR's own historical row), yet nflverse's
   aggregate reports just one. Deriving touchdown/longest-play breakdowns
   directly from the underlying plays isn't merely a workaround here — it's
   *more correct* than the column PFR-equivalent data nflverse already
   publishes.

### Validating a pipeline with no future ground truth: build it against the past instead
A "keep this current" job is, by definition, going to be run on seasons this
project can never cross-check against PFR's raw exports — that's the entire
point of building it. So before trusting it on 2025, `etl/_validate_supplement_2024.py`
ran the pipeline against **2024** — a season this database already holds
PFR's own figures for — and diffed every column, on the theory that whatever
discrepancy families show up there are the same ones that would silently slip
into 2025 unnoticed. This turned a one-shot "does it run" check into a
genuine audit, and it earned its keep: three real formula bugs surfaced and
got fixed before they could compound forward season after season —

- **`apyd` (all-purpose yards)** was missing two components entirely. PFR's
  figure turns out to be wider than "yards from scrimmage plus return
  yardage" — it also folds in the player's *own* interception-return and
  fumble-return yardage. Proven exactly via four 2024 return specialists who
  also play defense: Marcus Jones' apyd only reproduces PFR's stored 461 once
  his 35 interception-return and 17 fumble-return yards are added to his 409
  rush+rec+return total, and three other players' gaps close the same way.
- **`fum_ret_yds`** turned out to be unreliable to compute from the wide
  table at all (the best candidate split matched only 85% of rows, off by as
  much as 102 yards) but is derivable from play-by-play to 96% exactness by
  crediting the yardage on every play where a player is recorded as *the*
  recoverer — regardless of whose fumble it was.
- **`fga_30_39`/`fga_40_49`/`fga_50_plus`** (field goals *attempted* by
  distance bucket) undercounted by exactly the number of *blocked* attempts
  in that range — PFR counts a blocked kick as an attempt at the distance it
  was kicked from, but the wide table only exposes blocked-kick distances as
  an unstructured `fg_blocked_list` string (`'43;46;48'`), not bucketed like
  makes and misses are. Parsing that string and bucketing it the same way
  closed all nine 2024 kickers' gaps exactly, to the kick.

Just as important as the fixes: a disciplined accounting of what's *not*
fixable, and why — so a future "this column looks off" doesn't turn into
re-litigating settled ground. Several discrepancy families were investigated
to a confident, documented conclusion and deliberately left alone: penalty-
affected punt/kickoff return yardage (nflverse charts the post-penalty spot,
PFR the play-described distance — quantified at 76 affected 2024 plays and a
+434-yard league-wide gap, too entangled with free-text play descriptions to
parse reliably at scale); `comb`/`solo`/`ast` tackle counts (a mix of PFR's
"Defense & Fumbles" page including fringe players who never otherwise show up
defensively, plus the ordinary cross-tracker tackle-crediting noise that's
famously inconsistent across official sources — and notably, an attempt to
PBP-derive these performed *far worse* than the wide table, the opposite of
the usual pattern here); `tgt` being off by exactly one for ~40 receivers (PFR
doesn't count a target on a play an offensive penalty nullifies; nflverse
does); and a structural quirk in `apyd` for traded players, whose PFR row
reflects only their last team's stint total while this pipeline — mirroring
nflverse's combined-season convention, the same one the rest of the schema
relies on — reports a season total (proven exactly for Diontae Johnson and
Cam Akers; architecturally irreducible without abandoning that convention
everywhere else).

### A circular dependency the original build never had to face
Running the finished pipeline against a real new season (2025) surfaced one
more problem — not a data-correctness one, a *structural* one. `*_seasons`
rows carry a foreign key into `players`, and `players` is itself *built from*
the `*_seasons` tables (`build_players.py`). The original 2000–2024 load
never had to think about the order this implies, because it loaded every
season first and only constructed `players` — and its foreign keys —
afterward. A recurring refresh job doesn't get to do that: the very first
2025 rookie's row was rejected by the foreign key, because their id couldn't
exist in `players` until their season existed in `*_seasons` — which couldn't
be written until their id existed in `players`.

The fix breaks the cycle at its least ambiguous point: a brand-new player's
canonical name, position, and season-span are *never* in question — by
definition, their entire tracked history is the very data about to be
written, so "most recent listed name" and "most frequent listed position"
(the same rules `build_players.py` uses across a whole career) resolve to a
single obvious answer with nothing to reconcile. `_seed_new_players` computes
exactly that, straight from the in-memory tables, and inserts those rows
*before* the season data — satisfying the foreign key — and
`etl/supplement_players.py` (an upsert-based incremental counterpart to
`build_players.py`'s full `drop … cascade; create table … as` rebuild, which
would tear down and require re-creating every foreign key in the schema just
to add a few names a year) runs immediately after to re-derive every player's
canonical fields — old and new alike — from the now-complete picture.

The first real run of the finished pipeline went cleanly end to end: 298
brand-new players seeded with exactly correct canonical values (spot-checked
against their actual 2025 listings), 2,404 rows appended across the six
categories at 100% PFR-id linkage, 1,850 returning players' spans correctly
extended into 2025, and zero structural inconsistencies — no orphaned foreign
keys, no malformed spans, every formula identity (`comb = solo + ast`,
`netyds = yds − retyds`, `fga_total = Σ fga_*`, …) holding exactly. True
value-level validation — the kind `_validate_supplement_2024.py` exists for —
isn't possible for 2025 by definition (there is no PFR export to diff
against, which is the entire reason this pipeline exists); structural and
internal-consistency validation is the most rigorous check available for a
season this database has never seen before, and it came back clean.

### Closing the last gap: the 2025 draft class and its combine
With the seven box-score categories current through 2025, two tables were
still sitting at 2024: `draft` and `combine_seasons`. Both trace back to the
same root cause already on record — PFR's raw exports for these two
categories simply stop getting produced, so each new year is a fresh gap of
the same shape the 2023-2024 backfill closed, not a one-time accident.
`supplement_draft.py` (originally written for that backfill) is parametrized
by `YEARS`, so closing the 2025 gap meant pointing it at `[2025]` and
re-running it: 257 picks loaded, 100% carrying a `pfr_player_id`, 182 already
present in `players` (seeded by that season's `supplement_players.py` run),
and 75 — concentrated in OL/OT/G/C (41 of 75) plus a handful of QBs and other
skill positions who simply didn't see the field as rookies — left with a null
`player_id`, the same no-personal-stat pattern documented throughout this
project (e.g. the #4 overall pick, LSU tackle Will Campbell, genuinely
appears in zero tables — confirmed by checking every box-score category
directly, not just `players`).

`combine_seasons` had no precedent script — nothing in the original pipeline
needed to *add* a season to it, only clean what was already there — so
`supplement_combine.py` is new. nflreadpy's `load_combine()` ships the same
PFR id and "team / round / pick / year" draft-slot fields the draft loader
uses, which made two reshaping decisions the only real work:

- **`ht`** arrives as `"6-2"`; every one of the 8,320 existing rows spells it
  `"6_2"` — confirmed to be PFR's own raw-export convention (zero hyphenated
  values exist anywhere in the column, so this isn't the underscore-corruption
  pattern from earlier in this log), and normalized to match.
- **`drafted_tm_per_rnd_per_yr`** isn't a single field in nflreadpy; it's
  rebuilt from `draft_team`/`draft_round`/`draft_ovr`/`draft_year` into the
  exact `"{team} / {round}{suffix} / {pick}{suffix} pick / {year}"` shape
  `link_draft.py`'s regex expects — verified by sampling existing rows across
  every ordinal-suffix case (1st/2nd/3rd/4th and the 11th-13th exception).
  `college` — a column that was always either null or the meaningless literal
  placeholder `"College Stats"` — is left null for new rows rather than
  inventing a value nflreadpy doesn't carry.

The run added 329 prospects (184 linked, the same no-personal-stat shape as
`draft`), bringing `combine_seasons` to 8,649 rows spanning 2000-2025 — and
with it, every table in the database now covers the same 2000-2025 range,
fully linked and with zero orphaned foreign keys.

## Phase Two: building a web platform on top of the data

With the database complete, documented (`DB_SCHEMA.md`), and current through
2025, the project moves into its second phase: an interactive web platform
that makes this data explorable without writing SQL — a player search and
profile page, head-to-head comparisons, draft-value analysis (with a
career-value prediction model), and a natural-language search backed by
Claude. The plan for this phase, including its ten stages, lives in
`מפרט_פרויקט_NFL.md`; this log will keep tracking the *why* behind each
stage's decisions, the same way it did for the data pipeline.

### Stage 1 — Setting up the web server's environment
The first decision was where this new code should live: rather than spin up
a separate repo, `server/` (FastAPI backend) and `client/` (React frontend,
still empty — built in stage 7) joined `etl/` as siblings in the existing
project, since it's the same database and the same overall effort.

The more interesting decision was *how the server should reach the
database*. `etl/db.py` authenticates via a local pgpass file — fine for
scripts that only ever run on this machine, but the server is meant to be
deployed to a host like Render that has no access to it. So `server/app/config.py`
reads connection details from a `DATABASE_URL` environment variable instead —
sourced from a local `.env` (gitignored, see `.env.example` for the format)
during development, and from the platform's own environment in production.
The local default mirrors `etl/db.py`'s connection exactly, so the server
runs out of the box on this machine without requiring any `.env` file at all
— libpq still falls back to pgpass for the password, same as the ETL.

The server got its own virtualenv and `requirements.txt` (FastAPI, uvicorn,
SQLAlchemy, psycopg2, python-dotenv, pydantic) — deliberately separate from
the ETL's environment, since the two halves of the project now have
genuinely different dependencies. `test_connection.py` confirmed the new
config can reach the live database (`players`: 11,627 rows, matching
`DB_SCHEMA.md` exactly).

### Stage 2 — Rehearsing each module's queries against real data
`DB_SCHEMA.md` already covers table shapes and known issues in depth, so
this stage skipped re-deriving that and instead rehearsed the *actual*
queries each module will need — written up in `server/docs/exploration_findings.md`,
which doubles as a draft spec for stage 3's data-layer functions.

Two things surfaced that weren't visible from the schema alone, both about
the planned ML model (stage 5): a naive "round-1 picks with low `career_av`"
query for finding busts returned almost entirely 2024-2025 rookies — their
low value reflects not having played long enough yet, not having failed, so
"bust" detection needs a minimum-seasoning-period filter on `draft_year`.
And only 52.5% of linked combine prospects have complete numbers across the
four key drills — notably *not* at random: Joe Burrow and Chase Young (the
top two picks of 2020) both skipped the 40-yard dash and vertical jump,
the way locked-in elite prospects often do. That makes "ran the drill at
all" a potential feature in its own right, not just something to impute
past. Filed both for stage 5 to design around deliberately rather than
trip over later.

One existing finding got a live confirmation: querying `passing_career` for
`rate` failed with `UndefinedColumn`, exactly as documented — rate columns
are excluded from `*_career` views by design. The fix is the one the schema
doc prescribes (`100.0 * cmp / NULLIF(att, 0)`), and it's common enough
across modules that stage 3 should build it once as a shared helper rather
than re-deriving it per query.

(Also caught and fixed in passing: `DB_SCHEMA.md` had said "seven box-score
categories" in its prose while §3 always listed six — passing, offense,
defense, kicking, punting, returns. A live count against the schema
confirmed six; fixed everywhere "seven" appeared before it could mislead
the data layer's design.)

### Stage 3 — The data layer: models and query functions per module
Modeled only what has a genuinely stable shape: `Player` (clean, underscore-
free columns) got a real Pydantic model. Everything else — the six box-score
categories (each with different stat columns), draft picks and combine
prospects (both carrying PFR's digit-prefixed names like `_40yd`/`_1d`,
which collide with Pydantic's leading-underscore-means-private convention)
— travels as plain dicts wrapped in a thin `CategoryStats`/`PlayerProfile`
envelope. Forcing fourteen near-identical strict models onto data that
doesn't have a uniform shape would've meant fighting Pydantic aliases for
no real type-safety win.

`app/data/players.py`, `comparison.py`, and `draft.py` hold the query
functions for modules 1–3, plus `app/data/common.py`'s `career_rate()` —
the shared helper stage 2 called for, recomputing a rate from summed counts
(`career_rate(cmp, att)` → `career_cmp_pct`) instead of selecting one that
the `*_career` views correctly don't carry.

Testing against real data exercised every documented special case
end-to-end: Mahomes' profile correctly shows only the categories he
actually appears in (passing/offense/defense — not kicking or punting);
an offensive lineman's profile shows *zero* box-score categories but still
carries a draft record (the no-personal-stat pattern from `DB_SCHEMA.md`
§6.1, handled by surfacing an empty list rather than rows of nulls); an
undrafted player's `draft` field comes back `None` rather than an error;
and an unknown `player_id` returns `None` cleanly instead of raising.

`find_busts()` is where stage 2's seasoning-period fix proved itself: with
the cutoff applied (judging only draft classes ≤ 2021, four years before
the latest class in the data), the list came back as JaMarcus Russell, Zach
Wilson, Charles Rogers, Trey Lance, Justin Blackmon — names that match the
real-world "biggest draft busts" consensus almost exactly, rather than a
list of 2024-2025 rookies who simply haven't played enough games yet.

### Stage 4 — The API: one router per module, plus an honest placeholder
`app/main.py` wires up four routers (`players`, `comparison`, `draft`,
`search`), each a thin HTTP layer over stage 3's data functions — the
interesting decisions were less about routing than about what each endpoint
does at its edges.

Two were straightforward to delegate to FastAPI/Pydantic: query-parameter
type validation (an out-of-range `limit` or non-integer `draft_year` is
rejected automatically with a 422) and a search query below the minimum
length. The data-layer's own special cases turned into deliberate HTTP
choices: an unknown `player_id` is a 404 (not a 200 with an empty body, and
not a 500 — `get_player_profile` already distinguishes "not found" from
"found but sparse"), a comparison with fewer than two ids or an unknown
category is a 400 with a message naming the valid options, and the data
layer's `ValueError` for bad categories gets caught at the router boundary
rather than leaking a stack trace to the client.

The fourth router, `search` (module 4 — natural-language queries), is
deliberately a stub: it defines the contract now (`POST /search/natural`
with `{"question": ...}`) so the client can be built against a stable shape
in stage 7, but returns `501 Not Implemented` with a clear message rather
than faking a result — the actual Claude-backed translation is stage 6's
job, and pretending otherwise here would just create a more confusing
failure mode to debug later.

Every endpoint was exercised end-to-end with FastAPI's `TestClient`,
including its error paths — 404 on an unknown id, 400 on a malformed
comparison, 422 on invalid query params, 501 on the NL-search stub — and
the full Mahomes profile came back through the API exactly as the data
layer produced it (categories, career totals, draft slot, combine numbers
all intact).

### Stage 5 — A draft-value model: predicting career_av from the combine and the slot
The spec asks for a model that judges draft picks against their measurable
profile, so the first decision was the target. `draft.career_av` (PFR's
Approximate Value) won over deriving a custom value metric from the
box-score categories for three reasons at once: it already exists in the
table, it's position-agnostic — a tackle and a wide receiver land on the
same scale — and it *is* "career value" in the spec's own words, not an
approximation of it.

The architecture choice was shaped directly by a stage 2 finding, not
picked for convenience: ~48% of linked combine prospects are missing key
drill numbers, and *not* at random — locked-in elite prospects (Joe Burrow,
Chase Young, ...) skip drills deliberately, which makes "didn't run it" a
signal worth keeping rather than noise to paper over. `HistGradientBoosting
Regressor` natively handles missing numeric values *and* categorical
features (`pos`), so it can learn from the missingness pattern itself —
imputing those gaps first would have laundered that signal away before the
model ever saw it. `ml/prepare_data.py` builds the table feeding it
(`combine_seasons` joined to `draft` on player and year, restricted to
`career_av IS NOT NULL` and the same `DEFAULT_MIN_SEASONING_YEARS` cutoff
`app/data/draft.py` uses for steals/busts — for the same reason: a class
needs years to pass before its `career_av` reflects anything but "hasn't
played enough yet").

Evaluation uses a temporal split rather than a random one — train on
draft classes through 2017, test on 2018-2021 — because that's the actual
shape of the real task (judging a new class against everything that came
before it), and a random split would let the model quietly key on era-
specific context that a genuinely new class won't share. One small
debugging note: `pd.read_sql` returns SQL `NULL` height values as `NaN`
(a float), not `None`, so `_height_to_inches`'s null check had to be
`pd.isna(ht)` rather than `ht is None` — an easy trap when a column is
documented as nullable but the in-memory representation doesn't say `None`.

The numbers, with the honest framing baked into the script's own output:
on 4,358 seasoned prospects (2000-2021, 3,540 train / 818 test), the model
reaches an MAE of 11.6 `career_av` points against a naive baseline (always
guess the training-set mean) of 14.0, with R² = 0.02. That R² looks small
in isolation, but `career_av` spans roughly 0-200 across a career and even
professional scouting departments get this wrong constantly — beating the
naive baseline by a real margin means the combine-and-slot profile carries
*some* genuine signal, not that the model can call individual careers. That
was the goal: a defensible, honestly-evaluated pipeline, not a claim of
oracular accuracy.

The "surprise score" (actual `career_av` minus the model's prediction) is
where the model becomes interesting rather than just accurate-ish. The
biggest positive surprises are a murderer's row of value picks the
combine+slot profile didn't see coming: Tom Brady (6th round, pick 199 —
predicted 64.7, actual 184, a +119.3 surprise that towers over everyone
else), Russell Wilson, Dak Prescott, Travis Kelce, Lamar Jackson, and
Aaron Rodgers among them. The negative-surprise list turned up an
unplanned finding of its own: of the eight biggest model-flagged busts,
*all eight* are quarterbacks taken in the first two rounds — Josh Rosen,
Trey Lance, Dwayne Haskins, JaMarcus Russell, Sam Darnold, Trevor Lawrence,
Matt Leinart, Zach Wilson. That's not a coincidence the model "knows"
about — it falls out naturally from a combination of QBs commanding the
highest draft capital (so they have the most `career_av` to lose relative
to their predicted value) and the position being notoriously the hardest
to evaluate from measurables alone, which is exactly the kind of pattern a
"surprise score" is supposed to surface.

The trained model and its feature list are persisted to
`ml/draft_value_model.joblib` via `joblib.dump`, ready for a future
endpoint to serve predictions and surprise scores without retraining on
every request.

### Stage 6 — Natural-language search: translating questions into SQL, safely
This is the module the spec describes most concretely: the user types a
free-text question — Hebrew or English, e.g. "מי הרבעי גב עם הכי הרבה
טאצ'דאונים בין 2015 ל-2020" — and gets back results, powered by Claude
translating it into a query. `app/nl_search.py` carries the whole pipeline;
`app/routers/search.py` finally replaces stage 4's honest 501 stub with
the real thing.

The interesting engineering here isn't the translation itself — it's that
we're about to let an LLM write SQL that runs against a real database from
*untrusted free text*, which means trusting the model's good behavior isn't
a defensible design. Two independent layers, deliberately not just one:

1. **A pre-filter (`_validate_sql`)** rejects anything that isn't a single
   bare `SELECT`/`WITH` statement, or that contains a write/DDL keyword
   (`INSERT`, `DROP`, `UPDATE`, `;`-separated second statements, ...) —
   fast, with a clear error message, before the database is ever touched.
2. **The query itself runs inside a PostgreSQL `READ ONLY` transaction**
   (`engine.connect().execution_options(postgresql_readonly=True)`) — this
   is enforced by the database engine itself, so even a write hidden inside
   something the regex didn't anticipate (a function call, an obscure
   keyword) gets refused at the source, not by string-matching.

Neither alone would be trustworthy — a regex can be fooled by something
creative, and a read-only transaction alone would still let an unbounded or
multi-statement query through. Together they cover each other's blind
spots. A `LIMIT` is enforced too (appended automatically if the generated
query lacks one).

The system prompt is the other half of the design: rather than dumping the
full `DB_SCHEMA.md`, it's a condensed table/column reference *plus* the
handful of "rules that produce a wrong answer, not just an ugly one" —
don't sum `*_career` rate columns, prefer the live `*_career` join over
`draft`'s scrape-time snapshot, a null `player_id` isn't evidence of a
"bust", quote digit-prefixed columns. Claude is also told to answer with
*only* the SQL (a fenced-code-block stripper is a safety net for when it
ignores that), and — just as importantly — to respond with an explicit
`CANNOT_ANSWER: <reason>` when a question can't honestly be turned into a
query, rather than guessing at one. Every flavor of failure — declined,
unsafe, or one that fails at the database — funnels into one
`TranslationError`, which the router maps to a single honest `422`: from
the caller's seat, "couldn't translate it" and "translated it but it broke"
mean the same thing.

Testing surfaced a real gap worth recording: asked for "Tom Brady's career
completion percentage", Claude generated a query against `passing_career`
that selected `player_name` directly — but `*_career` views carry *only*
`player_id` plus aggregated stats (no name, position, or team; confirmed by
querying `information_schema.columns` live). The query failed at the
database with `column "player_name" does not exist`, which the pipeline
correctly surfaced as a translation failure rather than a crash. Adding one
explicit rule about this to the prompt fixed it outright — the corrected
query joined back to `players` for the name and correctly recomputed the
rate from summed counts (`100.0 * sum(cmp) / NULLIF(sum(att), 0)`),
returning **64.3%** — Brady's actual career figure.

A run through several more questions, in both languages, showed the
pipeline handling real nuance, not just pattern-matching:
- *"top 5 running backs by career rushing yards"* → correctly joined
  `players` to `offense_career`, filtered on `pos = 'RB'`, returned Frank
  Gore atop the list at 16,000 yards.
- *"מי הרבעי גב עם הכי הרבה טאצ'דאונים בין 2015 ל-2020"* (no "passing"
  specified) vs. the English *"most **passing** touchdowns..."* — Claude
  picked different tables for each (`offense_seasons`' total TDs vs.
  `passing_seasons`' passing TDs specifically), which is the *correct*
  reading of each phrasing, not an inconsistency.
- *"איזה שחקן נבחר הכי מאוחר בדראפט והפך לכוכב (steal)?"* → an honest
  `CANNOT_ANSWER`: "the definition of 'star'/'steal' isn't defined in the
  database... judging that requires an arbitrary threshold" — exactly the
  kind of question the model should decline rather than silently invent a
  cutoff for.
- *"What is the capital of France?"* and *"What's the weather in Miami?"*
  → both correctly declined as out-of-domain.
- The validator's unit checks confirmed `DROP TABLE`, a `;`-chained
  `DELETE`, and a bare `UPDATE` are all blocked before reaching the
  database — and a sanity question ("Russell Wilson's passing TDs
  2015-2020") came back as **195**, matching his known season-by-season
  totals (34+21+34+35+31+40) exactly.

`claude-haiku-4-5` was the deliberate model choice — not a budget
compromise, but a fit: this is a narrow, structured translation task (free
text → one SQL statement against a schema spelled out in full in the
system prompt), exactly the kind of job a fast, cheap model handles as
capably as a larger one.
