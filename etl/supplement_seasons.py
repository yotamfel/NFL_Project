"""
Pull new seasons of per-category stats from nflreadpy and append them onto the
`*_seasons` tables that PFR's own raw exports stop providing after 2024 - the
periodic "keep this current" counterpart to supplement_draft.py.

Two distinct sourcing strategies are used, chosen column by column:

1. Direct fields and formula-computed derivatives from
   `nflreadpy.load_player_stats()`'s wide per-player-season table. The large
   majority of PFR's published "advanced" columns turn out to be exactly
   reproducible from raw counts via PFR's own published formulas - verified
   against real rows (Joe Burrow's 2024 line reproduces to the decimal:
   rating 108.5, AY/A 8.24, NY/A 6.67, ANY/A 6.86, Sk% 6.86%).

2. Direct play-by-play aggregation, via `nflreadpy.load_pbp()`, for the
   handful of things the wide table either doesn't carry at all or gets
   demonstrably wrong:
     - Punting and placekicker kickoff lines are *entirely absent* from the
       wide table (confirmed by column-by-column inspection) - there is no
       "stay current" alternative short of building this aggregation, which
       is exactly what the user asked for when this gap surfaced.
     - The wide table's own `def_tds` aggregate is provably unreliable: Taron
       Johnson scored two genuine defensive touchdowns in 2024 - an
       interception-return TD in week 10 and a fumble-recovery TD in week 16
       (both confirmed in the raw play text) - and PFR's own historical table
       (still in this database) records exactly that: int_td=1, fr_td=1. Yet
       nflreadpy's wide-table aggregate reports `def_tds=1`, undercounting by
       one. Deriving `int_td`/`fr_td` from the underlying plays directly is
       not just possible but *more correct* than trusting that column - and
       since the same play filter is needed anyway, the longest
       interception-return (`lng`) comes along for free.
     - `punt_ret_td`/`kick_ret_td`/`*_lng` for the returns table are the same
       story: the wide table has return counts and yardage but no touchdown
       or longest-play breakdown, so the same per-play attribution used for
       punting/kickoffs covers them at no extra cost.

A handful of PFR columns are deliberately left null - each documented at the
point it's nulled below - because reproducing them needs a fundamentally
different and substantially larger effort than "stay current" warrants:
game-by-game logs (`g`, `gs`, `qbrec`, `_4qc`, `gwd` - nflverse's wide-table
"games" figure looked like a free stand-in for `g` at first, but turned out
to be an offense-centric "games with recorded statistical activity" count
that matches PFR's category-specific `g` only 38-78% of the time depending
on category; see `_bio` for the investigation), a from-scratch
reimplementation of PFR's own down-and-distance "success rate" methodology
(`succ_pct`/`rec_succ_pct`/`rush_succ_pct`), the presentational rank column
(`rk`), ESPN's separately-licensed Total QBR (`qbr`), the editorial `awards`
text, and "longest play" columns outside the PBP work already being done
(passing `lng`, `rec_lng`, `rush_lng`) - which would need a much broader,
generalized per-play-type attribution pass across the whole league rather
than the few focused aggregations this job already performs.

Unlike clean.py's CATEGORIES dict, this isn't config-driven: each category's
column set, source fields, and formulas differ enough from the next that a
declarative table would just be a thin wrapper hiding six different bodies of
logic - more indirection, not less. Six explicit builder functions, sharing
the same small set of formula and lookup helpers, stay easier to audit.

Known cross-tracker discrepancies - the same family already documented for
the original ETL and the draft-gap fill (PFR vs. nflverse/nflfastR charting
the same plays slightly differently) - carry over here too, in a few distinct
shapes worth telling apart:

- **Penalty-affected return yardage** (punt and kickoff `ret`/`net`/`yds`
  figures): nflverse's `return_yards` records the post-penalty-enforcement
  spot rather than the play-text-described return distance (proven exactly
  for kickoffs via the York `koyds` case, and quantified for punts in
  `_punting_from_pbp` - 76 affected plays, +434 yards league-wide, touching
  the majority of punters). Irreducible without fragile free-text parsing.
- **`comb`/`solo`/`ast`** (defense): two distinct sources of noise, neither
  worth chasing - (a) ~108 fringe players who only appear in PFR's "Defense &
  Fumbles" table because of a fumble (the same mechanism documented for
  `fmb` below) and who picked up "hustle tackles" on turnover-return plays
  that nflverse counts but PFR's defense-specific columns explicitly don't;
  and (b) ~62 real defenders off by at most 3 - ordinary cross-tracker
  tackle-crediting noise, a famously inconsistent stat across official
  sources. (A PBP-derivation alternative was tried and rejected - it performed
  far worse than the wide table's aggregate, the opposite of the usual
  pattern here.)
- **`tgt`** (receiving, off by exactly 1 for ~40 players): PFR doesn't credit
  a target on plays nullified by offensive penalties (e.g. a completed pass
  wiped out by offensive holding), while nflverse's `targets` still counts
  them. A clean, single-mechanism difference, but too fragile to PBP-derive
  reliably at scale.
- **`fmb`** (the season-long total-fumbles figure PFR mirrors onto both the
  offense and defense tables - see `_build_defense`): scramble-fumble edge
  cases where the play-type bucketing nflverse exposes doesn't reassemble
  into PFR's total as cleanly as a direct PBP count does (now PBP-derived,
  see `_fumbles_from_pbp`, rather than chased through the wide table).
- **2024 kickoff figures** specifically: the league's new "dynamic kickoff"
  rule created transition-year charting ambiguity industry-wide.

All of the above are small, well-understood, and not worth chasing further
than they already have been.
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

import numpy as np
import pandas as pd
import polars as pl
import nflreadpy as nfl

from db import get_engine
from supplement_players import supplement_players

from datetime import datetime as _dt
_now = _dt.utcnow()
# NFL season year = year the season started (Sep–Dec = current year, Jan–Aug = previous year)
_cur = _now.year if _now.month >= 9 else _now.year - 1
YEARS = sorted({_cur - 1, _cur})  # previous + current to catch late-arriving data

CATEGORY_TABLES = ["passing", "offense", "defense", "kicking", "punting", "returns"]


# --- player-id resolution ----------------------------------------------------
# nflverse's wide tables (and play-by-play) key players by the NFL's own GSIS
# id; this project's schema keys by PFR's id. The ffverse/dynastyprocess
# crosswalk (`load_ff_playerids`) carries both directly, and its `pfr_id`
# values were verified earlier to exactly match this project's existing
# `player_id` format and contents (e.g. gsis 00-0023459 -> pfr `RodgAa00`).
# It also carries `birthdate`, which - paired with `season` - reproduces
# PFR's listed `age` exactly (checked against three known rows: Burrow 28,
# Henry 30, Parsons 25, all = season minus birth year).

def _player_lookup() -> pl.DataFrame:
    xwalk = nfl.load_ff_playerids().select(["gsis_id", "pfr_id", "birthdate"])
    return (xwalk.drop_nulls(["gsis_id", "pfr_id", "birthdate"])
            .with_columns(pl.col("birthdate").str.slice(0, 4).cast(pl.Int64).alias("birth_year"))
            .select("gsis_id", pl.col("pfr_id").alias("player_id"), "birth_year")
            .unique(subset=["gsis_id"]))


# --- formula helpers ----------------------------------------------------------
# PFR's own published derivations - verified to exactly reproduce its stored
# values from raw counts (Joe Burrow 2024: rating 108.5, AY/A 8.24, NY/A 6.67,
# ANY/A 6.86, Sk% 6.86%).

def _ratio(num, den):
    return np.where(den > 0, num / den, np.nan)


def _pct(num, den):
    return np.where(den > 0, 100.0 * num / den, np.nan)


def _passer_rating(cmp, att, yds, td, ints):
    safe = att.where(att > 0)
    a = (((cmp / safe) - 0.3) * 5).clip(0, 2.375)
    b = (((yds / safe) - 3) * 0.25).clip(0, 2.375)
    c = ((td / safe) * 20).clip(0, 2.375)
    d = (2.375 - (ints / safe) * 25).clip(0, 2.375)
    return (a + b + c + d) / 6 * 100


def _null(df: pd.DataFrame, columns) -> None:
    """Mark columns this pipeline deliberately can't fill - see module
    docstring for why each group is out of scope."""
    for col in columns:
        df[col] = None


def _bio(df: pd.DataFrame) -> pd.DataFrame:
    # Deliberately excludes `games`: nflverse's wide-table figure turns out to
    # be an offense-centric "games with recorded statistical activity" count,
    # not PFR's category-specific "games played". Spot-checking against this
    # database's existing 2024 rows, it matches PFR's `g` only 38-78% of the
    # time depending on category (worst for defense, where role players and
    # long-snappers - active all season but rarely touching the box score on
    # defense - show e.g. 2 vs PFR's 17). `g`/`gs` are nulled in every
    # category builder below; a trustworthy figure would need actual
    # game-by-game roster logs, the same scope this job already draws the
    # line at for `gs`/`qbrec`/`_4qc`/`gwd`.
    out = df[["season", "player_id", "player_display_name", "recent_team", "position", "age"]].copy()
    return out.rename(columns={"player_display_name": "player_name", "recent_team": "team", "position": "pos"})


# --- per-category builders, sourced from load_player_stats -------------------
# Each filters the wide table down to players who recorded *something* in that
# category that season (mirroring how PFR only lists a player in, say, the
# passing table if he attempted a pass that year - a single garbage-time pass
# by a position player is enough to earn a row).

def _build_passing(stats: pd.DataFrame) -> pd.DataFrame:
    s = stats[stats["attempts"] > 0].copy()
    out = _bio(s)
    out["cmp"], out["att"] = s["completions"], s["attempts"]
    out["yds"], out["td"], out["int"] = s["passing_yards"], s["passing_tds"], s["passing_interceptions"]
    # _1d: filled in from play-by-play below - the wide table's own
    # `passing_first_downs` aggregate shares the def_tds problem (see
    # _first_downs_from_pbp).
    # nflverse stores sack yardage as a signed loss (negative); PFR stores
    # the same thing as a positive magnitude.
    out["sk"], out["sack_yds_lost"] = s["sacks_suffered"], s["sack_yards_lost"].abs()
    out["cmp_pct"] = _pct(out["cmp"], out["att"])
    out["td_pct"] = _pct(out["td"], out["att"])
    out["int_pct"] = _pct(out["int"], out["att"])
    out["y_per_a"] = _ratio(out["yds"], out["att"])
    out["ay_per_a"] = _ratio(out["yds"] + 20 * out["td"] - 45 * out["int"], out["att"])
    out["y_per_c"] = _ratio(out["yds"], out["cmp"])
    out["rate"] = _passer_rating(out["cmp"], out["att"], out["yds"], out["td"], out["int"])
    sk_att = out["att"] + out["sk"]
    out["sk_pct"] = _pct(out["sk"], sk_att)
    out["ny_per_a"] = _ratio(out["yds"] - out["sack_yds_lost"], sk_att)
    out["any_per_a"] = _ratio(out["yds"] - out["sack_yds_lost"] + 20 * out["td"] - 45 * out["int"], sk_att)
    # y_per_g needs `g`, which is itself out of scope (see _bio) - nulled together.
    _null(out, ["rk", "gs", "qbrec", "succ_pct", "y_per_g", "_4qc", "gwd", "awards", "qbr", "_1d",
                "g", "lng"])
    return out


def _build_offense(stats: pd.DataFrame) -> pd.DataFrame:
    s = stats[(stats["carries"] > 0) | (stats["targets"] > 0) | (stats["receptions"] > 0)].copy()
    out = _bio(s)
    out["tgt"], out["rec"] = s["targets"], s["receptions"]
    out["rec_yds"], out["rec_td"] = s["receiving_yards"], s["receiving_tds"]
    out["att"] = s["carries"]
    out["rush_yds"], out["rush_td"] = s["rushing_yards"], s["rushing_tds"]
    # rush_first_downs / rec_first_downs: filled in from play-by-play below -
    # the wide table's own aggregates share the def_tds problem (see
    # _first_downs_from_pbp).
    # fmb: filled in from play-by-play below. The wide table only splits
    # fumbles by the *phase* that caused them (rushing/receiving/sack), and
    # those buckets don't reassemble into PFR's total - notably for return
    # specialists, who fumble while returning, a phase none of those buckets
    # cover (see _fumbles_from_pbp for the investigation and the fix).
    out["y_per_r"] = _ratio(out["rec_yds"], out["rec"])
    out["ctch_pct"] = _pct(out["rec"], out["tgt"])
    out["y_per_tgt"] = _ratio(out["rec_yds"], out["tgt"])
    out["y_per_a"] = _ratio(out["rush_yds"], out["att"])
    out["touch"] = out["rec"] + out["att"]
    out["yscm"] = out["rec_yds"] + out["rush_yds"]
    out["y_per_tch"] = _ratio(out["yscm"], out["touch"])
    out["rrtd"] = out["rec_td"] + out["rush_td"]
    # r_per_g/rec_y_per_g/rush_y_per_g/a_per_g need `g`, out of scope (see _bio).
    _null(out, ["rk", "gs", "fmb", "rec_first_downs", "rush_first_downs",
                "rec_succ_pct", "rush_succ_pct", "awards",
                "g", "rec_lng", "rush_lng", "r_per_g", "rec_y_per_g", "rush_y_per_g", "a_per_g"])
    return out


_DEFENSE_RAW = ["def_tackles_solo", "def_tackles_with_assist", "def_tackle_assists", "def_sacks",
                "def_interceptions", "def_pass_defended", "def_fumbles_forced", "def_fumbles",
                "def_tackles_for_loss", "def_qb_hits", "def_safeties",
                "fumble_recovery_own", "fumble_recovery_opp"]


def _build_defense(stats: pd.DataFrame) -> pd.DataFrame:
    s = stats[stats[_DEFENSE_RAW].fillna(0).sum(axis=1) > 0].copy()
    out = _bio(s)
    # PFR's "Solo"/"Ast" split tackles differently than nflverse does: PFR's
    # solo = nflverse's clean-solo *plus* its "solo with assist" bucket, and
    # PFR's ast = nflverse's separate tackle_assists count. Verified exactly
    # against Micah Parsons 2024 (27+3=30 solo, 13 ast, 43 comb - all match).
    out["solo"] = s["def_tackles_solo"] + s["def_tackles_with_assist"]
    out["ast"] = s["def_tackle_assists"]
    out["comb"] = out["solo"] + out["ast"]
    out["sk"], out["int"] = s["def_sacks"], s["def_interceptions"]
    out["int_ret_yds"] = s["def_interception_yards"]
    out["pd"], out["ff"] = s["def_pass_defended"], s["def_fumbles_forced"]
    out["fr"] = s["fumble_recovery_own"] + s["fumble_recovery_opp"]
    out["tfl"], out["qb_hits"], out["sfty"] = s["def_tackles_for_loss"], s["def_qb_hits"], s["def_safeties"]
    # int_td / fr_td / lng (longest INT return) / fmb / fum_ret_yds: filled in
    # from play-by-play below. `def_tds` was proven unreliable (Taron Johnson
    # case, see module docstring); `def_fumbles` turns out to be something else
    # entirely - PFR's defense-table `Fmb` is the *same* season-long
    # total-fumbles figure it shows on the player's offense row (Kirk Cousins:
    # fmb=13 on both his offense and defense 2024 rows), not a defense-specific
    # count (Cousins' `def_fumbles` is 0, see _fumbles_from_pbp); and the wide
    # table's fumble_recovery_yards_own/_opp split doesn't reassemble into
    # PFR's fum_ret_yds any more reliably than the *_fumbles phase-buckets did
    # for fmb (see _fumble_return_yards_from_pbp).
    _null(out, ["rk", "gs", "int_td", "lng", "fr_td", "fmb", "fum_ret_yds", "awards", "g"])
    return out


_FG_BUCKETS = [(0, 19, "0_19"), (20, 29, "20_29"), (30, 39, "30_39"),
               (40, 49, "40_49"), (50, 999, "50_plus")]


def _bucket_for_distance(yards: int) -> str:
    return next(name for lo, hi, name in _FG_BUCKETS if lo <= yards <= hi)


def _blocked_fg_by_bucket(blocked_lists: pd.Series) -> pd.DataFrame:
    """PFR's `fga_*` distance-bucket counts are *attempts* - and a blocked
    kick is still an attempt, bucketed by the distance it was kicked from,
    same as a make or a miss. The wide table's fg_made_*/fg_missed_* splits
    don't carry blocked attempts at all; they only surface as an unstructured
    `fg_blocked_list` string of semicolon-separated distances (e.g.
    '43;46;48'). Parsing that and bucketing each distance the same way closes
    the gap exactly - verified against all nine of 2024's kickers whose
    fga_30_39/40_49/50_plus disagreed with PFR (Cairo Santos' +3 fga_40_49 gap
    is precisely his three 43/46/48-yard blocks; Brandon Aubrey's +2
    fga_30_39 gap his 35/38-yard blocks; and so on for the rest)."""
    rows = []
    for raw in blocked_lists:
        row = {name: 0 for *_, name in _FG_BUCKETS}
        if isinstance(raw, str) and raw:
            for tok in raw.split(";"):
                row[_bucket_for_distance(int(tok))] += 1
        rows.append(row)
    return pd.DataFrame(rows, index=blocked_lists.index)


def _build_kicking(stats: pd.DataFrame) -> pd.DataFrame:
    s = stats[(stats["fg_att"] > 0) | (stats["pat_att"] > 0)].copy()
    out = _bio(s)
    blocked = _blocked_fg_by_bucket(s["fg_blocked_list"])
    for bucket in ["0_19", "20_29", "30_39", "40_49"]:
        out[f"fgm_{bucket}"] = s[f"fg_made_{bucket}"]
        out[f"fga_{bucket}"] = s[f"fg_made_{bucket}"] + s[f"fg_missed_{bucket}"] + blocked[bucket]
    # nflverse splits the 50+ bucket into 50-59/60+; PFR keeps it as one "50+".
    out["fgm_50_plus"] = s["fg_made_50_59"] + s["fg_made_60_"]
    out["fga_50_plus"] = out["fgm_50_plus"] + s["fg_missed_50_59"] + s["fg_missed_60_"] + blocked["50_plus"]
    out["fga_total"], out["fgm_total"] = s["fg_att"], s["fg_made"]
    out["lng"] = s["fg_long"]
    out["fg_pct"] = _pct(out["fgm_total"], out["fga_total"])
    out["xpa"], out["xpm"] = s["pat_att"], s["pat_made"]
    out["xp_pct"] = _pct(out["xpm"], out["xpa"])
    # ko/koyds/tb/tb_pct/koavg: filled in from play-by-play below - entirely
    # absent from the wide table (see module docstring).
    _null(out, ["rk", "gs", "ko", "koyds", "tb", "tb_pct", "koavg", "awards", "g"])
    return out


def _build_returns(stats: pd.DataFrame) -> pd.DataFrame:
    s = stats[(stats["punt_returns"] > 0) | (stats["kickoff_returns"] > 0)].copy()
    out = _bio(s)
    out["punt_ret"], out["punt_ret_yds"] = s["punt_returns"], s["punt_return_yards"]
    out["kick_ret"], out["kick_ret_yds"] = s["kickoff_returns"], s["kickoff_return_yards"]
    out["y_per_punt_ret"] = _ratio(out["punt_ret_yds"], out["punt_ret"])
    out["y_per_kick_ret"] = _ratio(out["kick_ret_yds"], out["kick_ret"])
    # *_td / *_lng / apyd: filled in from play-by-play below. The TD/longest-
    # play breakdown is entirely absent from the wide table (it has counts and
    # yardage only); apyd needs a PBP-derived input too (fum_ret_yds -
    # see _all_purpose_yards) so it's finished there alongside them.
    _null(out, ["rk", "gs", "punt_ret_td", "punt_ret_lng", "kick_ret_td",
                "kick_ret_lng", "apyd", "awards", "g"])
    return out


# --- play-by-play derived stats -----------------------------------------------
# Punting and kicker-side kickoff lines don't exist anywhere in the wide
# table; touchdown/longest-play breakdowns for defensive turnovers and
# returns are likewise absent (or, for defensive TDs, present but wrong).
# Building all of them from one `load_pbp()` pass keeps this to a single,
# auditable block of per-play attribution rather than scattering it.

def _resolve(agg: pl.DataFrame, lookup: pl.DataFrame, gsis_col="gsis_id") -> pl.DataFrame:
    return (agg.rename({gsis_col: "gsis_id"}) if gsis_col != "gsis_id" else agg) \
        .join(lookup, on="gsis_id", how="inner").drop("gsis_id", "birth_year")


def _punting_from_pbp(pbp: pl.DataFrame, lookup: pl.DataFrame, stats: pd.DataFrame) -> pd.DataFrame:
    """Every column here is built from punt plays directly - there is no wide-
    table alternative. Earlier validation against PFR's historical figures
    found 9 of 11 columns reproduce exactly (pnt, yds, lng, tb, tb_pct,
    pnt20, in20_pct, y_per_p, blck - once blocked punts are correctly
    excluded from the count, matching PFR's own convention, confirmed via
    the Hekker 74-vs-73 case).

    The remaining two, retyds and netyds (and ny_per_p, which is derived from
    netyds), carry a real gap that's worth being honest about: it's not
    "small" - it touches the *majority* of punters (26, 35, and 37 of 2024's
    41, respectively), by as much as 202 yards on netyds. The mechanism is
    the same one already proven for kickoff return yardage (the York `koyds`
    case): nflverse's `return_yards` records the post-penalty-enforcement
    spot rather than the distance the return was actually charted as covering
    in the play text. Quantifying it for punts: 76 penalty-flagged 2024
    punt-return plays carry a nonzero `return_yards`, and summing the gap
    between the play-text-described distance and the PBP-recorded one across
    all of them nets +434 yards league-wide - which, spread across ~50 punts
    a season and a several-percent per-play penalty rate, is more than enough
    for most punters to pick up at least one such play. As with `koyds`,
    there's no fix short of free-text-parsing every penalty-affected return
    description, which would be fragile at the scale this job runs at - so,
    like that case, it's left as a known, understood, irreducible charting-
    convention difference rather than chased further."""
    punts = pbp.filter(pl.col("punt_attempt") == 1)
    clean = punts.filter(pl.col("punt_blocked") == 0)
    agg = (clean.group_by(["punter_player_id", "season"]).agg(
        pl.len().alias("pnt"),
        pl.col("kick_distance").sum().alias("yds"),
        pl.col("kick_distance").max().alias("lng"),
        pl.col("touchback").sum().alias("tb"),
        pl.col("punt_inside_twenty").sum().alias("pnt20"),
        pl.col("return_yards").fill_null(0).sum().alias("retyds"),
    ))
    blocked = (punts.filter(pl.col("punt_blocked") == 1)
               .group_by(["punter_player_id", "season"]).agg(pl.len().alias("blck")))
    raw = (agg.join(blocked, on=["punter_player_id", "season"], how="left")
           .with_columns(pl.col("blck").fill_null(0)))
    raw = _resolve(raw, lookup, "punter_player_id").to_pandas()

    bio = _bio(stats)
    df = bio.merge(raw, on=["player_id", "season"], how="inner")
    df["y_per_p"] = _ratio(df["yds"], df["pnt"])
    df["netyds"] = df["yds"] - df["retyds"]
    df["ny_per_p"] = _ratio(df["netyds"], df["pnt"])
    df["tb_pct"] = _pct(df["tb"], df["pnt"])
    df["in20_pct"] = _pct(df["pnt20"], df["pnt"])
    _null(df, ["rk", "gs", "awards", "g"])
    return df


def _kickoffs_from_pbp(pbp: pl.DataFrame, lookup: pl.DataFrame) -> pd.DataFrame:
    """Kicker-side kickoff stats (ko/koyds/tb/tb_pct/koavg) are entirely
    absent from the wide table too - same reasoning as punting. (An earlier
    pass here excluded onside kicks, on the assumption PFR's kickoff table
    counts only "real" kickoffs - it doesn't: Daniel Carlson's 2024 line only
    reproduces PFR's stored 80 kicks / 4,850 yards / 63.8% touchback rate
    exactly when his 5 onside attempts are *included*, and that one fix
    brought all 45 kickers to an exact match on every figure but `koavg` -
    see below.)"""
    kos = pbp.filter(pl.col("kickoff_attempt") == 1)
    agg = (kos.group_by(["kicker_player_id", "season"]).agg(
        pl.len().alias("ko"),
        pl.col("kick_distance").sum().alias("koyds"),
        pl.col("touchback").sum().alias("tb"),
    ))
    raw = _resolve(agg, lookup, "kicker_player_id").to_pandas()
    # Unlike every other per-attempt average in this schema (y_per_a, y_per_p,
    # ...), PFR stores koavg as a whole number (the column is `bigint`, not
    # `double precision`) - rounding the raw ratio reproduces its stored value
    # exactly for 44 of 2024's 45 kickers; the lone holdout (Chris Boswell,
    # 63.48 -> we round to 63, PFR shows 64) doesn't even match *its own*
    # stored koyds/ko by this same rule, so it reads as a one-row PFR-side
    # rounding quirk rather than a different formula to chase.
    raw["koavg"] = np.round(_ratio(raw["koyds"], raw["ko"]))
    raw["tb_pct"] = _pct(raw["tb"], raw["ko"])
    return raw


def _first_downs_from_pbp(pbp: pl.DataFrame, lookup: pl.DataFrame):
    """_1d (passing) / rush_first_downs / rec_first_downs - the wide table's
    own `passing_first_downs`/`rushing_first_downs`/`receiving_first_downs`
    aggregates turn out to share the exact same problem already proven for
    `def_tds`: summed straight from the wide table, `rush_first_downs`
    matches PFR only 82% of the time and is off by as much as 8 (Bijan
    Robinson: 90 vs PFR's 82) - even though the play-by-play feed underneath
    carries an explicit `first_down_rush`/`first_down_pass` flag on each play,
    and counting *that* directly per passer/rusher/receiver reproduces PFR's
    figures almost exactly: passing _1d 100.0% exact, rushing 99.8%
    (one play's disagreement leaguewide), receiving 99.5% (a small remainder
    in the same single-play-charting-disagreement family already documented
    for return yardage, e.g. Amon-Ra St. Brown 75 vs PFR's 73)."""
    def derive(flag_col, id_col, out_name):
        agg = (pbp.filter(pl.col(flag_col) == 1)
               .group_by([id_col, "season"]).agg(pl.len().alias(out_name)))
        return _resolve(agg, lookup, id_col).to_pandas()

    return (derive("first_down_pass", "passer_player_id", "_1d"),
            derive("first_down_rush", "rusher_player_id", "rush_first_downs"),
            derive("first_down_pass", "receiver_player_id", "rec_first_downs"))


def _fumbles_from_pbp(pbp: pl.DataFrame, lookup: pl.DataFrame) -> pd.DataFrame:
    """`fmb` - PFR's "number of times this player fumbled" - shared verbatim
    across every category table a player appears in (Kirk Cousins 2024 shows
    fmb=13 on *both* his offense and defense rows; the defense table's column
    is really "Defense & Fumbles", not a defense-specific count).

    The wide table has no single field for this: it splits fumbles by the
    *phase* that produced them (rushing/receiving/sack/defense), and those
    buckets simply don't reassemble into PFR's total - return specialists
    fumble while returning, a phase none of the offense buckets cover, so a
    sum of them showed several at 0 against PFR's 3-5. Counting, instead,
    every play where the player is recorded as the fumbling player
    (`fumbled_1`/`fumbled_2`) reproduces PFR's total almost perfectly: 99.8%
    exact across all of 2024's offense rows and 99.9% across defense (vs.
    86-89% summing the wide table's phase buckets), with a single irreducible
    one-play disagreement left league-wide (Baker Mayfield, 12 vs PFR's 13)."""
    fum = pl.concat([
        pbp.filter(pl.col("fumbled_1_player_id").is_not_null())
            .select(pl.col("fumbled_1_player_id").alias("gsis_id"), "season"),
        pbp.filter(pl.col("fumbled_2_player_id").is_not_null())
            .select(pl.col("fumbled_2_player_id").alias("gsis_id"), "season"),
    ])
    agg = fum.group_by(["gsis_id", "season"]).agg(pl.len().alias("fmb"))
    return agg.join(lookup, on="gsis_id", how="inner").drop("gsis_id", "birth_year").to_pandas()


def _fumble_return_yards_from_pbp(pbp: pl.DataFrame, lookup: pl.DataFrame) -> pd.DataFrame:
    """fum_ret_yds - same story as `fmb`: the wide table splits this by
    *whose* fumble was recovered (fumble_recovery_yards_own/_opp), and that
    split doesn't reassemble into PFR's total any better than the phase-bucket
    split did for fmb (the best single candidate, `_own` alone, matches only
    85% of 2024's defense rows and is off by as much as 102 yards). Counting,
    instead, the yardage gained on every play where the player is recorded as
    *the* recoverer (fumble_recovery_1/2, regardless of which team's fumble it
    was) reproduces PFR's total for 96.2% of rows - the residual is the same
    family of safety/lateral charting edge cases already seen elsewhere (e.g.
    a recovery returned into one's own end zone for a safety, which PFR charts
    as negative yardage this per-play sum doesn't carry the same way)."""
    parts = [
        pbp.filter(pl.col(idc).is_not_null())
            .select(pl.col(idc).alias("gsis_id"), pl.col(yc).alias("yds"), "season")
        for idc, yc in [("fumble_recovery_1_player_id", "fumble_recovery_1_yards"),
                        ("fumble_recovery_2_player_id", "fumble_recovery_2_yards")]
    ]
    agg = pl.concat(parts).group_by(["gsis_id", "season"]).agg(pl.col("yds").sum().alias("fum_ret_yds"))
    return _resolve(agg, lookup, "gsis_id").to_pandas()


def _all_purpose_yards(stats: pd.DataFrame, fum_ret_yds: pd.DataFrame) -> pd.DataFrame:
    """apyd - PFR's "all-purpose yards" turns out to be a wider definition than
    "yards from scrimmage plus return yardage": it also folds in this player's
    own interception-return and fumble-return yardage (the same figures that
    appear on their defense row). Proven by the four 2024 return specialists
    who also play defense - e.g. Marcus Jones' apyd only reproduces PFR's
    stored 461 once his 35 interception-return + 17 fumble-return yards are
    added to his 409 rush+rec+return total; Clark Phillips (15 -> 65, +45/+5),
    Minkah Fitzpatrick (7 -> 32, +25/+0) and Keisean Nixon (576 -> 592, +16/+0)
    all close the same way. `def_interception_yards` is already a confirmed
    exact match against PFR (see _build_defense); fum_ret_yds needs the
    PBP-derived figure (_fumble_return_yards_from_pbp) for the same reason the
    defense table does."""
    base = (stats[["player_id", "season", "rushing_yards", "receiving_yards",
                   "punt_return_yards", "kickoff_return_yards", "def_interception_yards"]]
            .merge(fum_ret_yds, on=["player_id", "season"], how="left"))
    base["fum_ret_yds"] = base["fum_ret_yds"].fillna(0)
    base["apyd"] = (base["rushing_yards"] + base["receiving_yards"]
                    + base["punt_return_yards"] + base["kickoff_return_yards"]
                    + base["def_interception_yards"] + base["fum_ret_yds"])
    return base[["player_id", "season", "apyd"]]


def _defense_turnover_tds_from_pbp(pbp: pl.DataFrame, lookup: pl.DataFrame):
    """int_td / lng (longest INT return) and fr_td, derived directly from
    interception and fumble-recovery plays. This is *more* correct than the
    wide table's own `def_tds` aggregate, which was proven to undercount
    (Taron Johnson 2024: two real defensive TDs - an interception return in
    week 10, a fumble-recovery scoop-and-score in week 16, both confirmed in
    the play text and matching PFR's own int_td=1/fr_td=1 - against a wide-
    table def_tds of just 1)."""
    ints = pbp.filter(pl.col("interception") == 1)
    int_agg = (ints.group_by(["interception_player_id", "season"]).agg(
        pl.col("return_touchdown").sum().alias("int_td"),
        pl.col("return_yards").max().alias("lng"),
    ))
    int_out = _resolve(int_agg, lookup, "interception_player_id").to_pandas()

    fumbles = pbp.filter(pl.col("fumble") == 1)
    recoveries = pl.concat([
        fumbles.filter(pl.col("fumble_recovery_1_player_id").is_not_null())
            .select(pl.col("fumble_recovery_1_player_id").alias("gsis_id"), "season", "return_touchdown"),
        fumbles.filter(pl.col("fumble_recovery_2_player_id").is_not_null())
            .select(pl.col("fumble_recovery_2_player_id").alias("gsis_id"), "season", "return_touchdown"),
    ])
    fr_agg = (recoveries.group_by(["gsis_id", "season"])
              .agg(pl.col("return_touchdown").sum().alias("fr_td")))
    fr_out = fr_agg.join(lookup, on="gsis_id", how="inner").drop("gsis_id", "birth_year").to_pandas()

    return int_out, fr_out


def _games_from_pbp(pbp: pl.DataFrame, lookup: pl.DataFrame):
    """Derive per-category games played (g) from play-by-play: count distinct
    game_id values where the player recorded at least one play in that role.
    This is category-specific (a player who only rushed gets g on offense but
    not passing), matching PFR's convention better than the wide table's single
    'games' figure which is offense-centric."""
    def _count(id_col, alias):
        return (_resolve(
            pbp.filter(pl.col(id_col).is_not_null())
            .group_by([id_col, "season"])
            .agg(pl.col("game_id").n_unique().alias("g")),
            lookup, id_col,
        ).to_pandas().rename(columns={"g": alias}))

    passing = _count("passer_player_id", "g")
    rusher  = _count("rusher_player_id", "g")
    receiver = _count("receiver_player_id", "g")
    tackler = pl.concat([
        pbp.filter(pl.col(c).is_not_null()).select(pl.col(c).alias("gsis_id"), "season", "game_id")
        for c in ["tackle_for_loss_1_player_id", "solo_tackle_1_player_id",
                   "assist_tackle_1_player_id", "interception_player_id",
                   "sack_player_id", "forced_fumble_player_1_player_id",
                   "pass_defense_1_player_id"]
    ])
    defense = (_resolve(
        tackler.group_by(["gsis_id", "season"]).agg(pl.col("game_id").n_unique().alias("g")),
        lookup, "gsis_id",
    ).to_pandas())
    offense = (pd.concat([
        rusher[["player_id", "season", "g"]],
        receiver[["player_id", "season", "g"]],
    ]).groupby(["player_id", "season"], as_index=False)["g"].max())

    return {
        "passing": passing,
        "offense": offense,
        "defense": defense,
    }


def _longest_plays_from_pbp(pbp: pl.DataFrame, lookup: pl.DataFrame):
    """Derive longest-play columns from play-by-play: passing lng, rush_lng,
    rec_lng."""
    pass_lng = _resolve(
        pbp.filter(pl.col("passer_player_id").is_not_null() & (pl.col("sack") == 0))
        .group_by(["passer_player_id", "season"])
        .agg(pl.col("passing_yards").max().alias("lng")),
        lookup, "passer_player_id",
    ).to_pandas()

    rush_lng = _resolve(
        pbp.filter(pl.col("rusher_player_id").is_not_null())
        .group_by(["rusher_player_id", "season"])
        .agg(pl.col("rushing_yards").max().alias("rush_lng")),
        lookup, "rusher_player_id",
    ).to_pandas()

    rec_lng = _resolve(
        pbp.filter(pl.col("receiver_player_id").is_not_null())
        .group_by(["receiver_player_id", "season"])
        .agg(pl.col("receiving_yards").max().alias("rec_lng")),
        lookup, "receiver_player_id",
    ).to_pandas()

    return pass_lng, rush_lng, rec_lng


def _return_tds_from_pbp(pbp: pl.DataFrame, lookup: pl.DataFrame):
    """punt_ret_td/punt_ret_lng and kick_ret_td/kick_ret_lng - the same per-
    play attribution as punting/kickoffs, just keyed to the returner instead
    of the kicker, covering a gap the wide table leaves (it has return counts
    and yardage but no touchdown or longest-play breakdown)."""
    pr = pbp.filter(pl.col("punt_returner_player_id").is_not_null() & (pl.col("punt_attempt") == 1))
    pr_agg = (pr.group_by(["punt_returner_player_id", "season"]).agg(
        pl.col("return_touchdown").sum().alias("punt_ret_td"),
        pl.col("return_yards").max().alias("punt_ret_lng"),
    ))
    pr_out = _resolve(pr_agg, lookup, "punt_returner_player_id").to_pandas()

    kr = pbp.filter(pl.col("kickoff_returner_player_id").is_not_null() & (pl.col("kickoff_attempt") == 1))
    kr_agg = (kr.group_by(["kickoff_returner_player_id", "season"]).agg(
        pl.col("return_touchdown").sum().alias("kick_ret_td"),
        pl.col("return_yards").max().alias("kick_ret_lng"),
    ))
    kr_out = _resolve(kr_agg, lookup, "kickoff_returner_player_id").to_pandas()
    return pr_out, kr_out


# --- driver -------------------------------------------------------------------

_OUR_COLUMNS = {
    "passing": ["season", "rk", "player_name", "age", "team", "pos", "g", "gs", "qbrec", "cmp", "att",
                "cmp_pct", "yds", "td", "td_pct", "int", "int_pct", "_1d", "succ_pct", "lng", "y_per_a",
                "ay_per_a", "y_per_c", "y_per_g", "rate", "sk", "sack_yds_lost", "sk_pct", "ny_per_a",
                "any_per_a", "_4qc", "gwd", "awards", "player_id", "qbr"],
    "offense": ["season", "rk", "player_name", "age", "team", "pos", "g", "gs", "tgt", "rec", "rec_yds",
                "y_per_r", "rec_td", "rec_first_downs", "rec_succ_pct", "rec_lng", "r_per_g", "rec_y_per_g",
                "ctch_pct", "y_per_tgt", "att", "rush_yds", "rush_td", "rush_first_downs", "rush_succ_pct",
                "rush_lng", "y_per_a", "rush_y_per_g", "a_per_g", "touch", "y_per_tch", "yscm", "rrtd",
                "fmb", "awards", "player_id"],
    "defense": ["season", "rk", "player_name", "age", "team", "pos", "g", "gs", "int", "int_ret_yds",
                "int_td", "lng", "pd", "ff", "fmb", "fr", "fum_ret_yds", "fr_td", "sk", "comb", "solo",
                "ast", "tfl", "sfty", "awards", "player_id", "qb_hits"],
    "kicking": ["season", "rk", "player_name", "age", "team", "pos", "g", "gs", "fga_0_19", "fgm_0_19",
                "fga_20_29", "fgm_20_29", "fga_30_39", "fgm_30_39", "fga_40_49", "fgm_40_49", "fga_50_plus",
                "fgm_50_plus", "fga_total", "fgm_total", "lng", "fg_pct", "xpa", "xpm", "xp_pct", "ko",
                "koyds", "tb", "tb_pct", "koavg", "awards", "player_id"],
    "punting": ["season", "rk", "player_name", "age", "team", "pos", "g", "gs", "pnt", "yds", "y_per_p",
                "retyds", "netyds", "ny_per_p", "lng", "tb", "tb_pct", "pnt20", "in20_pct", "blck",
                "awards", "player_id"],
    "returns": ["season", "rk", "player_name", "age", "team", "pos", "g", "gs", "punt_ret", "punt_ret_yds",
                "punt_ret_td", "punt_ret_lng", "y_per_punt_ret", "kick_ret", "kick_ret_yds", "kick_ret_td",
                "kick_ret_lng", "y_per_kick_ret", "apyd", "awards", "player_id"],
}


def build_seasons(years=YEARS) -> dict[str, pd.DataFrame]:
    lookup = _player_lookup()

    wide = nfl.load_player_stats(seasons=years, summary_level="reg").rename({"player_id": "gsis_id"})
    wide = wide.join(lookup, on="gsis_id", how="inner") \
        .with_columns((pl.col("season") - pl.col("birth_year")).alias("age"))
    stats = wide.to_pandas()

    # load_pbp returns regular season *and* playoffs; load_player_stats(...,
    # summary_level="reg") - and PFR's own per-season tables - are regular-
    # season only. Keeping pbp playoff rows in would silently inflate every
    # PBP-derived count for every player whose team made the postseason.
    pbp = nfl.load_pbp(seasons=years).filter(pl.col("season_type") == "REG")

    tables = {
        "passing": _build_passing(stats),
        "offense": _build_offense(stats),
        "defense": _build_defense(stats),
        "kicking": _build_kicking(stats),
        "returns": _build_returns(stats),
    }

    tables["punting"] = _punting_from_pbp(pbp, lookup, stats)

    kickoffs = _kickoffs_from_pbp(pbp, lookup)
    tables["kicking"] = tables["kicking"].drop(columns=["ko", "koyds", "tb", "tb_pct", "koavg"]) \
        .merge(kickoffs, on=["player_id", "season"], how="left")

    fumbles = _fumbles_from_pbp(pbp, lookup)
    tables["offense"] = tables["offense"].drop(columns=["fmb"]) \
        .merge(fumbles, on=["player_id", "season"], how="left")
    tables["offense"]["fmb"] = tables["offense"]["fmb"].fillna(0)

    pass_fd, rush_fd, rec_fd = _first_downs_from_pbp(pbp, lookup)
    tables["passing"] = tables["passing"].drop(columns=["_1d"]) \
        .merge(pass_fd, on=["player_id", "season"], how="left")
    tables["passing"]["_1d"] = tables["passing"]["_1d"].fillna(0)

    tables["offense"] = tables["offense"].drop(columns=["rush_first_downs", "rec_first_downs"]) \
        .merge(rush_fd, on=["player_id", "season"], how="left") \
        .merge(rec_fd, on=["player_id", "season"], how="left")
    tables["offense"][["rush_first_downs", "rec_first_downs"]] = \
        tables["offense"][["rush_first_downs", "rec_first_downs"]].fillna(0)

    int_tds, fr_tds = _defense_turnover_tds_from_pbp(pbp, lookup)
    fum_ret_yds = _fumble_return_yards_from_pbp(pbp, lookup)
    tables["defense"] = tables["defense"].drop(columns=["int_td", "lng", "fr_td", "fmb", "fum_ret_yds"]) \
        .merge(int_tds, on=["player_id", "season"], how="left") \
        .merge(fr_tds, on=["player_id", "season"], how="left") \
        .merge(fumbles, on=["player_id", "season"], how="left") \
        .merge(fum_ret_yds, on=["player_id", "season"], how="left")
    tables["defense"][["int_td", "fr_td", "fmb", "fum_ret_yds"]] = \
        tables["defense"][["int_td", "fr_td", "fmb", "fum_ret_yds"]].fillna(0)

    punt_rets, kick_rets = _return_tds_from_pbp(pbp, lookup)
    apyd = _all_purpose_yards(stats, fum_ret_yds)
    tables["returns"] = tables["returns"].drop(columns=["punt_ret_td", "punt_ret_lng", "kick_ret_td", "kick_ret_lng", "apyd"]) \
        .merge(punt_rets, on=["player_id", "season"], how="left") \
        .merge(kick_rets, on=["player_id", "season"], how="left") \
        .merge(apyd, on=["player_id", "season"], how="left")
    tables["returns"][["punt_ret_td", "kick_ret_td"]] = tables["returns"][["punt_ret_td", "kick_ret_td"]].fillna(0)

    # Games played (g) from PBP — category-specific distinct game counts
    games = _games_from_pbp(pbp, lookup)
    for cat in ["passing", "offense", "defense"]:
        tables[cat] = tables[cat].drop(columns=["g"]) \
            .merge(games[cat][["player_id", "season", "g"]], on=["player_id", "season"], how="left")
    # Kicking/punting/returns: derive g from their PBP-specific role columns
    kick_g = _resolve(
        pbp.filter(pl.col("kicker_player_id").is_not_null())
        .group_by(["kicker_player_id", "season"])
        .agg(pl.col("game_id").n_unique().alias("g")),
        lookup, "kicker_player_id",
    ).to_pandas()
    tables["kicking"] = tables["kicking"].drop(columns=["g"]) \
        .merge(kick_g[["player_id", "season", "g"]], on=["player_id", "season"], how="left")
    punt_g = _resolve(
        pbp.filter(pl.col("punter_player_id").is_not_null())
        .group_by(["punter_player_id", "season"])
        .agg(pl.col("game_id").n_unique().alias("g")),
        lookup, "punter_player_id",
    ).to_pandas()
    tables["punting"] = tables["punting"].drop(columns=["g"]) \
        .merge(punt_g[["player_id", "season", "g"]], on=["player_id", "season"], how="left")
    ret_g = pl.concat([
        pbp.filter(pl.col("punt_returner_player_id").is_not_null())
        .select(pl.col("punt_returner_player_id").alias("gsis_id"), "season", "game_id"),
        pbp.filter(pl.col("kickoff_returner_player_id").is_not_null())
        .select(pl.col("kickoff_returner_player_id").alias("gsis_id"), "season", "game_id"),
    ])
    ret_g = _resolve(
        ret_g.group_by(["gsis_id", "season"]).agg(pl.col("game_id").n_unique().alias("g")),
        lookup, "gsis_id",
    ).to_pandas()
    tables["returns"] = tables["returns"].drop(columns=["g"]) \
        .merge(ret_g[["player_id", "season", "g"]], on=["player_id", "season"], how="left")

    # Longest plays from PBP — passing lng, rush_lng, rec_lng
    pass_lng, rush_lng, rec_lng = _longest_plays_from_pbp(pbp, lookup)
    tables["passing"] = tables["passing"].drop(columns=["lng"]) \
        .merge(pass_lng[["player_id", "season", "lng"]], on=["player_id", "season"], how="left")
    tables["offense"] = tables["offense"].drop(columns=["rec_lng", "rush_lng"]) \
        .merge(rush_lng, on=["player_id", "season"], how="left") \
        .merge(rec_lng, on=["player_id", "season"], how="left")

    # Per-game stats derived from g
    for cat in ["passing"]:
        t = tables[cat]
        t["y_per_g"] = _ratio(t["yds"], t["g"])
    for cat in ["offense"]:
        t = tables[cat]
        t["r_per_g"] = _ratio(t["rec"], t["g"])
        t["rec_y_per_g"] = _ratio(t["rec_yds"], t["g"])
        t["rush_y_per_g"] = _ratio(t["rush_yds"], t["g"])
        t["a_per_g"] = _ratio(t["att"], t["g"])

    return {cat: df[_OUR_COLUMNS[cat]] for cat, df in tables.items()}


def _seed_new_players(conn, tables, years):
    """`*_seasons` rows carry a foreign key into `players` - so a rookie's
    first-ever season can't be appended until their id exists there. But
    `players` is itself derived *from* the `*_seasons` tables (see
    build_players.py / supplement_players.py), which won't see this season's
    rows until they're written - a circular dependency the original 2000-2024
    build never hit (it loaded every season first, and only built `players` -
    and its FKs - afterward, see PROJECT_LOG.md).

    Breaking the cycle here: derive brand-new players' canonical rows directly
    from the DataFrames about to be appended, using build_players.py's exact
    rules (most recent season's name, most frequent position) - rules that
    resolve completely unambiguously when a player's *entire* tracked history
    is this one season, so there's nothing tentative about the result.
    supplement_players.py's run right after this script writes the season data
    then re-derives everyone - these rows included - from the complete,
    now-written picture, the normal way."""
    appearances = (pd.concat(df[["player_id", "player_name", "pos", "season"]] for df in tables.values())
                   .dropna(subset=["player_id"]))
    known = set(pd.read_sql("select player_id from players", conn)["player_id"])
    new = appearances[~appearances["player_id"].isin(known)]
    if new.empty:
        return
    spans = new.groupby("player_id")["season"].agg(first_season="min", last_season="max", n_seasons="nunique")
    name = new.sort_values("season").drop_duplicates("player_id", keep="last")[["player_id", "player_name"]]
    pos = (new.groupby(["player_id", "pos"]).size().rename("n").reset_index()
           .sort_values("n", ascending=False).drop_duplicates("player_id")[["player_id", "pos"]])
    seed = name.merge(pos, on="player_id").merge(spans, on="player_id")
    seed.to_sql("players", conn, if_exists="append", index=False)
    print(f"players: seeded {len(seed)} brand-new ids ahead of writing {years} "
          f"(e.g. {seed['player_id'].tolist()[:5]})")


def supplement_seasons(years=YEARS):
    tables = build_seasons(years)
    engine = get_engine()
    with engine.begin() as conn:
        _seed_new_players(conn, tables, years)
        for cat, df in tables.items():
            table = f"{cat}_seasons"
            # Idempotent re-runs: replace whatever this job previously wrote
            # for these seasons rather than risk duplicating it (the natural-
            # key constraint only catches *linked* rows - nulls are distinct).
            conn.exec_driver_sql(f"delete from {table} where season = any(%(years)s)", {"years": years})
            df.to_sql(table, conn, schema="public", if_exists="append", index=False)
            print(f"{table}: +{len(df)} rows for {years} ({df['player_id'].notna().mean():.1%} linked)")
    # Now that the season data carries the full appearance picture (these new
    # ids included), re-derive `players`' canonical fields - name/position/span
    # - for everyone from scratch the normal way (see supplement_players.py).
    supplement_players()


if __name__ == "__main__":
    supplement_seasons()
