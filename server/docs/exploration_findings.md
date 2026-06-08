# Stage 2 — exploration findings

`DB_SCHEMA.md` already covers table shapes, relationships, and known data
issues in depth, so this stage focused on something it doesn't: rehearsing
the *actual queries* each module will need, against real data, to surface
anything that only shows up once you query for a specific use case. Three
things did.

## 1. The query shapes that map directly to stage 3's data-layer functions

These all ran cleanly and returned exactly the shape each module needs —
they're effectively a draft spec for stage 3:

- **Player search**: `player_name ILIKE '%...%'` against `players` — fast,
  simple, works for partial/case-insensitive matches.
- **Player profile**: one identity row from `players`, then per-category
  `*_seasons` rows (season-by-season) *and* the matching `*_career` row
  (lifetime), plus `draft`/`combine_seasons` rows by `player_id` — five
  small queries per category, not one giant join. Verified end-to-end on
  Patrick Mahomes (`MahoPa00`): 9 seasons, career totals matching, 2017 KC
  draft slot (pick 10), combine measurables all present.
- **Comparison**: `player_id = ANY(:pids)` against `*_career` (or
  `*_seasons` filtered to one season) returns all compared players in a
  single round trip — no need to query per player.
- **Draft analysis with filters**: straightforward `WHERE team = ... AND
  draft_year = ...` against `draft`, ordered by `pick`.

## 2. Confirmed in practice: career-level rate stats must be recomputed, not selected

Tried `SELECT ... rate FROM passing_career` first — it failed with
`UndefinedColumn`, exactly as `DB_SCHEMA.md` §3 warns: rate columns are
deliberately excluded from `*_career` views because summing a per-season
rate across seasons of different lengths is meaningless. The fix is the one
the schema doc prescribes — recompute from summed counts:
`round(100.0 * cmp / NULLIF(att, 0), 1) AS career_cmp_pct`. Worth building
this as a shared helper in stage 3 rather than re-deriving it per query,
since every comparison or profile view that shows a career rate will need it.

## 3. Two new things stage 5 (the ML model) needs to plan around

These weren't visible from the schema alone — they only showed up when
querying with the actual "steals/busts" and "career-value prediction" use
cases in mind:

**a. "Bust" detection needs a minimum seasoning period, or it's just
flagging rookies.** A naive query for round-1 picks with low `career_av`
returned almost entirely 2024-2025 draftees (Abdul Carter, Tyleik Williams,
...) — players one or two seasons into their careers, not failures. Their
`career_av` is low because they haven't had time to accumulate it, not
because they've underperformed. Any "bust" definition needs to filter to
draft classes old enough to judge fairly — e.g. `draft_year <= [current
year] - 4` or so — otherwise the model (and the UI built on top of it) will
spend its first few years of data calling rookies busts.

**b. A meaningful share of combine prospects are missing drill measurements
— including some of the best players in the sample.** Of the 7,060 linked
combine prospects, only 3,709 (52.5%) have complete numbers across the four
key drills (`_40yd`, `wt`, `vertical`, `bench`). This isn't random noise:
Joe Burrow and Chase Young (the #1 and #2 picks of 2020, both productive
NFL players) both have null `_40yd` and `vertical` — elite, pre-draft-locked
prospects often skip drills they have nothing to gain from running. That
means "skipped the drill" may itself be a signal worth encoding as a
feature (e.g. a per-drill `ran_it` boolean) rather than something to impute
away — something to design deliberately in stage 5, not patch over later.

## What this changes for stage 3

Nothing structural — the query shapes above work as expected and will become
the data-layer's functions close to as-is. The one concrete addition: a
shared "recompute career rate from summed counts" helper, used wherever a
`*_career` view is the source for a rate stat.
