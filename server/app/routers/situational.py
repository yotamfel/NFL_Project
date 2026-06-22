"""Situational Stats - EPA, splits, play-action, formations, heatmaps."""
from fastapi import APIRouter, Depends, Query
from sqlalchemy import text
from typing import Optional

from app.auth import require_admin
from app.db import engine

router = APIRouter(prefix="/situational", tags=["situational"])

# Position -> min plays for meaningful sample
MIN_PLAYS = {"QB": 200, "RB": 80, "WR": 50, "TE": 30, "DEFAULT": 50}


def _min_plays(pos: str) -> int:
    return MIN_PLAYS.get(pos, MIN_PLAYS["DEFAULT"])


def _latest_season():
    with engine.connect() as c:
        return c.execute(text("SELECT MAX(season) FROM pbp")).scalar() or 2025


def _get_gsis_id(conn, player_id: str) -> Optional[str]:
    """Convert PFR player_id to nflverse GSIS ID for PBP queries."""
    row = conn.execute(
        text("SELECT gsis_id FROM players WHERE player_id = :pid"),
        {"pid": player_id},
    ).fetchone()
    return row.gsis_id if row and row.gsis_id else None


def _ctx_filters(season_type="REG", opponent=None, week_from=None, week_to=None, location=None, prefix="p"):
    """Build common context filter SQL fragments. Use prefix for JOINed queries."""
    pre = f"{prefix}." if prefix else ""
    parts = []
    if season_type and season_type != "ALL":
        parts.append(f"{pre}season_type = '{season_type}'")
    if opponent:
        opp_list = [t.strip().upper() for t in opponent.split(",")]
        if len(opp_list) == 1:
            parts.append(f"{pre}defteam = '{opp_list[0]}'")
        else:
            parts.append(f"{pre}defteam IN ({','.join(repr(t) for t in opp_list)})")
    if week_from:
        parts.append(f"{pre}week >= {int(week_from)}")
    if week_to:
        parts.append(f"{pre}week <= {int(week_to)}")
    if location == "home":
        parts.append(f"{pre}posteam = {pre}home_team")
    elif location == "away":
        parts.append(f"{pre}posteam = {pre}away_team")
    return (" AND " + " AND ".join(parts)) if parts else ""


@router.get("/available-seasons")
def available_seasons(user: dict = Depends(require_admin)):
    with engine.connect() as c:
        rows = c.execute(text("SELECT DISTINCT season FROM pbp ORDER BY season DESC")).fetchall()
    return [r[0] for r in rows]


@router.get("/browse-players")
def browse_players(
    pos: Optional[str] = None,
    team: Optional[str] = None,
    seasons: Optional[str] = None,
    user: dict = Depends(require_admin),
):
    if seasons:
        yrs = [int(s) for s in seasons.split(",")]
    else:
        with engine.connect() as c:
            yrs = [r[0] for r in c.execute(text("SELECT DISTINCT season FROM pbp ORDER BY season DESC")).fetchall()]

    pos_cols = {
        "QB": ("passer_player_id", "passer_player_name", "pass_attempt = 1"),
        "RB": ("rusher_player_id", "rusher_player_name", "rush_attempt = 1"),
        "WR": ("receiver_player_id", "receiver_player_name", "pass_attempt = 1 AND receiver_player_id IS NOT NULL"),
        "TE": ("receiver_player_id", "receiver_player_name", "pass_attempt = 1 AND receiver_player_id IS NOT NULL"),
    }

    if pos and pos in pos_cols:
        id_col, name_col, where = pos_cols[pos]
        positions = [(pos, id_col, name_col, where)]
    else:
        positions = [(p, *v) for p, v in pos_cols.items()]

    teams_list = [t.strip().upper() for t in team.split(",")] if team else []
    team_filter = "AND posteam = ANY(:teams)" if teams_list else ""

    results = []
    seen = set()
    with engine.connect() as c:
        for p, id_col, name_col, where in positions:
            params = {"seasons": yrs}
            if teams_list:
                params["teams"] = teams_list
            rows = c.execute(text(f"""
                SELECT {id_col} as gsis_id, {name_col} as name, posteam as team,
                       COUNT(*) as plays
                FROM pbp
                WHERE {where} AND {id_col} IS NOT NULL AND season = ANY(:seasons)
                      AND epa IS NOT NULL {team_filter}
                GROUP BY {id_col}, {name_col}, posteam
                HAVING COUNT(*) >= 20
                ORDER BY plays DESC
                LIMIT 40
            """), params).fetchall()
            for r in rows:
                if r.gsis_id not in seen:
                    seen.add(r.gsis_id)
                    pl = c.execute(text("SELECT player_id, player_name FROM players WHERE gsis_id = :gsis"),
                                   {"gsis": r.gsis_id}).fetchone()
                    results.append({
                        "player_id": pl.player_id if pl else r.gsis_id,
                        "player_name": pl.player_name if pl else r.name,
                        "pos": p,
                        "team": r.team,
                        "plays": r.plays,
                    })
    results.sort(key=lambda x: -x["plays"])
    return results[:40]


def _ftn_seasons():
    try:
        with engine.connect() as c:
            rows = c.execute(text("SELECT DISTINCT season FROM ftn_charting ORDER BY season DESC")).fetchall()
        return [r[0] for r in rows]
    except Exception:
        return []


def _participation_seasons():
    try:
        with engine.connect() as c:
            rows = c.execute(text(
                "SELECT DISTINCT LEFT(nflverse_game_id, 4)::int as season FROM participation ORDER BY season DESC"
            )).fetchall()
        return [r[0] for r in rows]
    except Exception:
        return []


# ── EPA Rankings ──────────────────────────────────────────────────────────────

@router.get("/epa-rankings")
def epa_rankings(
    position: str = Query("QB"),
    season: Optional[int] = None,
    seasons: Optional[str] = None,
    season_type: str = Query("REG"),
    min_plays: Optional[int] = None,
    team: Optional[str] = None,
    user: dict = Depends(require_admin),
):
    if seasons:
        yrs = [int(s) for s in seasons.split(",")]
    else:
        yrs = [season or _latest_season()]

    teams_list = [t.strip().upper() for t in team.split(",")] if team else []

    auto_min = _min_plays(position)
    if season_type == "POST":
        auto_min = max(auto_min // 5, 10)
    if len(yrs) > 1:
        auto_min = int(auto_min * len(yrs) * 0.6)
    mp = min_plays or auto_min

    pos_map = {
        "QB": ("passer_player_id", "passer_player_name", "pass_attempt = 1"),
        "RB": ("rusher_player_id", "rusher_player_name", "rush_attempt = 1"),
        "WR": ("receiver_player_id", "receiver_player_name", "pass_attempt = 1 AND receiver_player_id IS NOT NULL"),
        "TE": ("receiver_player_id", "receiver_player_name", "pass_attempt = 1 AND receiver_player_id IS NOT NULL"),
    }
    if position not in pos_map:
        return []

    id_col, name_col, where = pos_map[position]
    st_filter = "" if season_type == "ALL" else f"AND season_type = '{season_type}'"
    team_filter = "AND posteam = ANY(:teams)" if teams_list else ""

    sql = text(f"""
        WITH player_epa AS (
            SELECT {id_col} as player_id, {name_col} as player_name, posteam as team,
                   COUNT(*) as plays,
                   ROUND(AVG(epa)::numeric, 3) as epa_per_play,
                   ROUND(SUM(epa)::numeric, 1) as total_epa,
                   ROUND(AVG(wpa)::numeric, 4) as wpa_per_play,
                   ROUND(SUM(wpa)::numeric, 3) as total_wpa,
                   ROUND(AVG(CASE WHEN success = 1 THEN 1.0 ELSE 0.0 END)::numeric * 100, 1) as success_rate
            FROM pbp
            WHERE season = ANY(:seasons) AND {where} AND {id_col} IS NOT NULL
                  AND epa IS NOT NULL {st_filter} {team_filter}
            GROUP BY {id_col}, {name_col}, posteam
            HAVING COUNT(*) >= :min_plays
        )
        SELECT pe.*,
               p.fdv, p.pos, p.player_id as pfr_id,
               d.round as draft_round, d.draft_year
        FROM player_epa pe
        LEFT JOIN players p ON p.gsis_id = pe.player_id
        LEFT JOIN draft d ON d.player_id = p.player_id
        ORDER BY epa_per_play DESC
        LIMIT 50
    """)

    params = {"seasons": yrs, "min_plays": mp}
    if teams_list:
        params["teams"] = teams_list
    with engine.connect() as c:
        rows = c.execute(sql, params).fetchall()
    return {"seasons": yrs, "position": position, "data": [dict(r._mapping) for r in rows]}


# ── Clutch Rankings (WPA in high-leverage) ────────────────────────────────────

@router.get("/clutch-rankings")
def clutch_rankings(
    position: str = Query("QB"),
    season: Optional[int] = None,
    seasons: Optional[str] = None,
    team: Optional[str] = None,
    user: dict = Depends(require_admin),
):
    if seasons:
        yrs = [int(s) for s in seasons.split(",")]
    else:
        yrs = [season or _latest_season()]

    pos_map = {
        "QB": ("passer_player_id", "passer_player_name", "pass_attempt = 1"),
        "RB": ("rusher_player_id", "rusher_player_name", "rush_attempt = 1"),
        "WR": ("receiver_player_id", "receiver_player_name", "pass_attempt = 1 AND receiver_player_id IS NOT NULL"),
    }
    if position not in pos_map:
        return []

    id_col, name_col, where = pos_map[position]
    teams_list = [t.strip().upper() for t in team.split(",")] if team else []
    team_filter = "AND posteam = ANY(:teams)" if teams_list else ""
    min_clutch = max(8 * len(yrs), 10)

    sql = text(f"""
        SELECT {id_col} as player_id, {name_col} as player_name, posteam as team,
               COUNT(*) as clutch_plays,
               ROUND(SUM(wpa)::numeric, 3) as clutch_wpa,
               ROUND(AVG(wpa)::numeric, 4) as clutch_wpa_per_play,
               ROUND(AVG(epa)::numeric, 3) as clutch_epa_per_play
        FROM pbp
        WHERE season = ANY(:seasons) AND {where} AND {id_col} IS NOT NULL
              AND wpa IS NOT NULL AND season_type = 'REG'
              AND game_seconds_remaining <= 300
              AND ABS(score_differential) <= 8
              {team_filter}
        GROUP BY {id_col}, {name_col}, posteam
        HAVING COUNT(*) >= :min_clutch
        ORDER BY clutch_wpa DESC
        LIMIT 30
    """)

    params = {"seasons": yrs, "min_clutch": min_clutch}
    if teams_list:
        params["teams"] = teams_list
    with engine.connect() as c:
        rows = c.execute(sql, params).fetchall()
    return {"seasons": yrs, "position": position, "data": [dict(r._mapping) for r in rows]}


# ── Situational Splits ────────────────────────────────────────────────────────

@router.get("/splits/{player_id}")
def situational_splits(
    player_id: str,
    season: Optional[int] = None,
    seasons: Optional[str] = None,
    opponent: Optional[str] = None,
    season_type: str = Query("REG"),
    week_from: Optional[int] = None,
    week_to: Optional[int] = None,
    location: Optional[str] = None,
    user: dict = Depends(require_admin),
):
    if seasons:
        yrs = [int(s) for s in seasons.split(",")]
    else:
        yrs = [season or _latest_season()]
    yr = yrs[0]

    ctx_filters = []
    if len(yrs) == 1:
        ctx_filters.append(f"season = {yrs[0]}")
    else:
        ctx_filters.append(f"season IN ({','.join(str(y) for y in yrs)})")
    if season_type != "ALL":
        ctx_filters.append(f"season_type = '{season_type}'")
    if opponent:
        opp_list = [t.strip().upper() for t in opponent.split(",")]
        if len(opp_list) == 1:
            ctx_filters.append(f"defteam = '{opp_list[0]}'")
        else:
            ctx_filters.append(f"defteam IN ({','.join(repr(t) for t in opp_list)})")
    if week_from:
        ctx_filters.append(f"week >= {int(week_from)}")
    if week_to:
        ctx_filters.append(f"week <= {int(week_to)}")
    if location == "home":
        ctx_filters.append("posteam = home_team")
    elif location == "away":
        ctx_filters.append("posteam = away_team")
    ctx_sql = (" AND " + " AND ".join(ctx_filters)) if ctx_filters else ""

    with engine.connect() as c:
        player = c.execute(text(
            "SELECT player_name, pos, gsis_id FROM players WHERE player_id = :pid"
        ), {"pid": player_id}).fetchone()
        if not player:
            return {"error": "Player not found"}

        gsis = player.gsis_id
        if not gsis:
            return {"error": "No play-by-play ID mapping for this player", "player": player.player_name}

        pos = player.pos or ""
        is_qb = pos in ("QB",)
        is_rb = pos in ("RB", "FB", "HB")
        is_wr_te = pos in ("WR", "TE", "FL", "SE")

        if is_qb:
            id_col = "passer_player_id"
            base_filter = "pass_attempt = 1"
        elif is_rb:
            id_col = "rusher_player_id"
            base_filter = "rush_attempt = 1"
        elif is_wr_te:
            id_col = "receiver_player_id"
            base_filter = "pass_attempt = 1 AND receiver_player_id IS NOT NULL"
        else:
            return {"player": player.player_name, "pos": pos, "splits": {}, "note": "Position not supported for splits"}

        def _split(label, extra_where="", source="pbp"):
            full_where = f"{base_filter} AND {id_col} = :pid AND epa IS NOT NULL AND {' AND '.join(ctx_filters)}"
            if extra_where:
                full_where += f" AND {extra_where}"

            row = c.execute(text(f"""
                SELECT COUNT(*) as plays,
                       ROUND(AVG(epa)::numeric, 3) as epa_per_play,
                       ROUND(SUM(epa)::numeric, 1) as total_epa,
                       ROUND(AVG(wpa)::numeric, 4) as wpa_per_play,
                       ROUND(AVG(CASE WHEN success = 1 THEN 1.0 ELSE 0.0 END)::numeric * 100, 1) as success_rate,
                       ROUND(AVG(yards_gained)::numeric, 1) as avg_yards
                FROM pbp
                WHERE {full_where}
            """), {"pid": gsis}).fetchone()

            d = dict(row._mapping) if row else {}
            d["label"] = label
            d["source"] = source
            return d

        splits = {}
        splits["overall"] = _split("Overall")
        splits["red_zone"] = _split("Red Zone", "yardline_100 <= 20")
        splits["third_down"] = _split("3rd Down", "down = 3")

        # Clutch
        splits["clutch"] = _split("Clutch (last 5 min, close game)",
            "game_seconds_remaining <= 300 AND ABS(score_differential) <= 8")

        # Quarter splits
        for q in [1, 2, 3, 4]:
            splits[f"q{q}"] = _split(f"Quarter {q}", f"qtr = {q}")

        # Home / Away
        splits["home"] = _split("Home", f"posteam = home_team")
        splits["away"] = _split("Away", f"posteam = away_team")

        # Divisional
        splits["divisional"] = _split("vs Division", "div_game = 1")

        # Weather
        splits["cold"] = _split("Cold (<40F)", "temp < 40 AND temp IS NOT NULL")
        splits["dome"] = _split("Dome", "roof = 'dome' OR roof = 'closed'")
        splits["outdoor"] = _split("Outdoor", "roof = 'outdoors' OR roof = 'open'")

        # Position-specific
        if is_qb:
            splits["deep"] = _split("Deep passes (20+ air yards)", "air_yards >= 20")
            splits["short"] = _split("Short passes (<10 air yards)", "air_yards < 10")
            splits["no_huddle"] = _split("No-Huddle", "no_huddle = 1")
            splits["shotgun"] = _split("Shotgun", "shotgun = 1")
            splits["under_center"] = _split("Under Center", "shotgun = 0")

        elif is_rb:
            splits["short_yardage"] = _split("Short Yardage (<=2 to go)", "ydstogo <= 2")
            splits["goal_line"] = _split("Goal Line (<=5 yards)", "yardline_100 <= 5")
            splits["run_left"] = _split("Run Left", "run_location = 'left'")
            splits["run_middle"] = _split("Run Middle", "run_location = 'middle'")
            splits["run_right"] = _split("Run Right", "run_location = 'right'")

        elif is_wr_te:
            splits["deep_targets"] = _split("Deep Targets (20+ air yards)", "air_yards >= 20")
            splits["short_targets"] = _split("Short Targets (<10 air yards)", "air_yards < 10")
            splits["left"] = _split("Targets Left", "pass_location = 'left'")
            splits["middle"] = _split("Targets Middle", "pass_location = 'middle'")
            splits["right"] = _split("Targets Right", "pass_location = 'right'")

        # Enrichments from existing DB
        enrichment = {}
        fdv_row = c.execute(text("SELECT fdv FROM players WHERE player_id = :pid"), {"pid": player_id}).fetchone()
        if fdv_row and fdv_row.fdv:
            enrichment["fdv"] = float(fdv_row.fdv)

        inj_row = c.execute(text("""
            SELECT COUNT(*) FILTER (WHERE report_status = 'Out') as games_out
            FROM injuries WHERE player_id = :pid AND season = :season
        """), {"pid": player_id, "season": yr}).fetchone()
        if inj_row:
            enrichment["games_missed"] = inj_row.games_out

        snap_row = c.execute(text("""
            SELECT ROUND(AVG(offense_pct)::numeric * 100, 1) as avg_snap_pct
            FROM snap_counts WHERE player_id = :pid AND season = :season AND game_type = 'REG'
        """), {"pid": player_id, "season": yr}).fetchone()
        if snap_row and snap_row.avg_snap_pct:
            enrichment["avg_snap_pct"] = float(snap_row.avg_snap_pct)

        draft_row = c.execute(text(
            "SELECT round, pick, draft_year FROM draft WHERE player_id = :pid"
        ), {"pid": player_id}).fetchone()
        if draft_row:
            enrichment["draft"] = {"round": draft_row.round, "pick": draft_row.pick, "year": draft_row.draft_year}

        # League percentiles for key splits
        percentiles = {}
        key_splits = {
            "overall": "",
            "red_zone": "AND yardline_100 <= 20",
            "third_down": "AND down = 3",
            "clutch": "AND game_seconds_remaining <= 300 AND ABS(score_differential) <= 8",
            "home": "AND posteam = home_team",
            "away": "AND posteam = away_team",
        }
        if is_qb:
            key_splits["deep"] = "AND air_yards >= 20"
            key_splits["short"] = "AND air_yards < 10"
        elif is_rb:
            key_splits["short_yardage"] = "AND ydstogo <= 2"
        min_p = 20

        season_filter = f"season = {yrs[0]}" if len(yrs) == 1 else f"season IN ({','.join(str(y) for y in yrs)})"
        for skey, extra in key_splits.items():
            league_rows = c.execute(text(f"""
                SELECT {id_col} as pid, ROUND(AVG(epa)::numeric, 3) as epa
                FROM pbp
                WHERE {base_filter} AND {id_col} IS NOT NULL
                      AND {season_filter} AND epa IS NOT NULL {extra}
                GROUP BY {id_col} HAVING COUNT(*) >= :minp
                ORDER BY epa
            """), {"minp": min_p}).fetchall()
            if league_rows:
                vals = [float(r.epa) for r in league_rows]
                player_epa = splits.get(skey, {}).get("epa_per_play")
                if player_epa is not None:
                    rank = sum(1 for v in vals if v <= float(player_epa))
                    percentiles[skey] = round(rank / len(vals) * 100)

    return {
        "player": player.player_name,
        "player_id": player_id,
        "pos": pos,
        "season": yr,
        "seasons": yrs,
        "splits": splits,
        "enrichment": enrichment,
        "percentiles": percentiles,
    }


# ── Play-Action Analysis (FTN, 2022+) ────────────────────────────────────────

@router.get("/play-action/{player_id}")
def play_action_analysis(
    player_id: str,
    season: Optional[int] = None,
    season_type: str = Query("REG"),
    opponent: Optional[str] = None,
    week_from: Optional[int] = None, week_to: Optional[int] = None,
    location: Optional[str] = None,
    user: dict = Depends(require_admin),
):
    yr = season or _latest_season()
    ctx_sql = _ctx_filters(season_type, opponent, week_from, week_to, location)
    ftn_years = _ftn_seasons()

    with engine.connect() as c:
        player = c.execute(text("SELECT player_name, gsis_id FROM players WHERE player_id = :pid"), {"pid": player_id}).fetchone()
        gsis = player.gsis_id if player else None

        if yr not in ftn_years:
            return {
                "player": player.player_name if player else player_id,
                "player_id": player_id,
                "season": yr,
                "coverage": f"FTN Charting data available for: {', '.join(str(y) for y in ftn_years) if ftn_years else 'none loaded'}",
                "data": {},
                "no_data": True,
                "available_seasons": ftn_years,
            }

        if not gsis:
            return {"player": player.player_name if player else player_id, "player_id": player_id, "season": yr, "data": {}, "error": "No PBP ID mapping"}

        rows = c.execute(text(f"""
            WITH pa AS (
                SELECT
                    f.is_play_action,
                    p.epa, p.complete_pass, p.passing_yards, p.air_yards,
                    p.yards_after_catch, p.success
                FROM pbp p
                JOIN ftn_charting f ON f.nflverse_game_id = p.game_id
                    AND f.nflverse_play_id = p.play_id
                WHERE p.passer_player_id = :pid AND p.season = :season
                      AND p.pass_attempt = 1 AND p.sack = 0
                      AND p.epa IS NOT NULL AND f.is_play_action IS NOT NULL{ctx_sql}
            )
            SELECT
                is_play_action,
                COUNT(*) as plays,
                ROUND(AVG(epa)::numeric, 3) as epa_per_play,
                ROUND(AVG(CASE WHEN complete_pass = 1 THEN 100.0 ELSE 0.0 END)::numeric, 1) as comp_pct,
                ROUND(AVG(passing_yards)::numeric, 1) as avg_yards,
                ROUND(AVG(air_yards)::numeric, 1) as avg_air_yards,
                ROUND(AVG(yards_after_catch)::numeric, 1) as avg_yac,
                ROUND(AVG(CASE WHEN success = 1 THEN 100.0 ELSE 0.0 END)::numeric, 1) as success_rate
            FROM pa
            GROUP BY is_play_action
        """), {"pid": gsis, "season": yr}).fetchall()

    data = {}
    for r in rows:
        key = "with_play_action" if r.is_play_action else "without_play_action"
        data[key] = dict(r._mapping)

    extras = {}
    with engine.connect() as c2:
        # League percentile for play-action EPA
        league = c2.execute(text(f"""
            SELECT p.passer_player_id as pid,
                   ROUND(AVG(CASE WHEN f.is_play_action THEN p.epa END)::numeric, 3) as pa_epa,
                   ROUND(AVG(CASE WHEN NOT f.is_play_action THEN p.epa END)::numeric, 3) as no_pa_epa
            FROM pbp p JOIN ftn_charting f ON f.nflverse_game_id = p.game_id AND f.nflverse_play_id = p.play_id
            WHERE p.season = :season AND p.pass_attempt = 1 AND p.sack = 0 AND p.epa IS NOT NULL
                  AND f.is_play_action IS NOT NULL AND p.season_type = 'REG'
            GROUP BY p.passer_player_id HAVING COUNT(*) >= 100
        """), {"season": yr}).fetchall()
        if league:
            pa_vals = sorted([float(r.pa_epa) for r in league if r.pa_epa is not None])
            player_pa = data.get("with_play_action", {}).get("epa_per_play")
            if player_pa is not None and pa_vals:
                extras["pa_percentile"] = round(sum(1 for v in pa_vals if v <= float(player_pa)) / len(pa_vals) * 100)

        # Receiver breakdown
        rec_rows = c2.execute(text(f"""
            SELECT p.receiver_player_name as receiver,
                   f.is_play_action as pa,
                   COUNT(*) as plays,
                   ROUND(AVG(p.epa)::numeric, 3) as epa
            FROM pbp p JOIN ftn_charting f ON f.nflverse_game_id = p.game_id AND f.nflverse_play_id = p.play_id
            WHERE p.passer_player_id = :pid AND p.season = :season AND p.pass_attempt = 1 AND p.sack = 0
                  AND p.epa IS NOT NULL AND f.is_play_action IS NOT NULL AND p.receiver_player_name IS NOT NULL{ctx_sql}
            GROUP BY p.receiver_player_name, f.is_play_action
            HAVING COUNT(*) >= 5
            ORDER BY plays DESC
        """), {"pid": gsis, "season": yr}).fetchall()

        receivers = {}
        for r in rec_rows:
            name = r.receiver
            if name not in receivers:
                receivers[name] = {}
            receivers[name]["pa" if r.pa else "no_pa"] = {"plays": r.plays, "epa": float(r.epa)}
        extras["receivers"] = [{"name": k, **v} for k, v in receivers.items() if "pa" in v and "no_pa" in v][:8]

        # Depth split
        depth_rows = c2.execute(text(f"""
            SELECT f.is_play_action as pa,
                   CASE WHEN p.air_yards >= 15 THEN 'deep' ELSE 'short' END as depth,
                   COUNT(*) as plays,
                   ROUND(AVG(p.epa)::numeric, 3) as epa,
                   ROUND(AVG(CASE WHEN p.complete_pass=1 THEN 100.0 ELSE 0 END)::numeric, 1) as comp_pct
            FROM pbp p JOIN ftn_charting f ON f.nflverse_game_id = p.game_id AND f.nflverse_play_id = p.play_id
            WHERE p.passer_player_id = :pid AND p.season = :season AND p.pass_attempt = 1 AND p.sack = 0
                  AND p.epa IS NOT NULL AND f.is_play_action IS NOT NULL AND p.air_yards IS NOT NULL{ctx_sql}
            GROUP BY f.is_play_action, depth
        """), {"pid": gsis, "season": yr}).fetchall()

        depth = {}
        for r in depth_rows:
            key = f"{'pa' if r.pa else 'no_pa'}_{r.depth}"
            depth[key] = {"plays": r.plays, "epa": float(r.epa), "comp_pct": float(r.comp_pct)}
        extras["depth"] = depth

    return {
        "player": player.player_name if player else player_id,
        "player_id": player_id,
        "season": yr,
        "data": data,
        **extras,
    }


# ── Formation Analysis ────────────────────────────────────────────────────────

@router.get("/formation/{team}")
def formation_analysis(
    team: str,
    season: Optional[int] = None,
    user: dict = Depends(require_admin),
):
    yr = season or _latest_season()
    part_years = _participation_seasons()

    if yr not in part_years:
        return {
            "team": team.upper(),
            "season": yr,
            "coverage": f"Participation data available for: {', '.join(str(y) for y in part_years) if part_years else 'none loaded'}",
            "data": [],
            "no_data": True,
            "available_seasons": part_years,
        }

    with engine.connect() as c:
        rows = c.execute(text("""
            SELECT
                pt.offense_personnel as personnel,
                COUNT(*) as plays,
                ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER(), 1) as usage_pct,
                ROUND(AVG(p.epa)::numeric, 3) as epa_per_play,
                ROUND(AVG(CASE WHEN p.success = 1 THEN 100.0 ELSE 0.0 END)::numeric, 1) as success_rate,
                ROUND(AVG(p.yards_gained)::numeric, 1) as avg_yards
            FROM participation pt
            JOIN pbp p ON p.game_id = pt.nflverse_game_id AND p.play_id = pt.play_id
            WHERE p.posteam = :team AND p.season = :season
                  AND p.epa IS NOT NULL AND pt.offense_personnel IS NOT NULL
                  AND p.play_type IN ('pass', 'run')
            GROUP BY pt.offense_personnel
            HAVING COUNT(*) >= 10
            ORDER BY plays DESC
            LIMIT 20
        """), {"team": team.upper(), "season": yr}).fetchall()

    return {
        "team": team.upper(),
        "season": yr,
        "coverage": f"Participation data: {', '.join(str(y) for y in part_years)}",
        "data": [dict(r._mapping) for r in rows],
    }


# ── Run Direction Heatmap ─────────────────────────────────────────────────────

@router.get("/run-heatmap/{player_id}")
def run_heatmap(
    player_id: str,
    season: Optional[int] = None,
    season_type: str = Query("REG"), opponent: Optional[str] = None,
    week_from: Optional[int] = None, week_to: Optional[int] = None, location: Optional[str] = None,
    user: dict = Depends(require_admin),
):
    yr = season or _latest_season()
    ctx_sql = _ctx_filters(season_type, opponent, week_from, week_to, location, prefix="")

    with engine.connect() as c:
        player = c.execute(text("SELECT player_name, gsis_id FROM players WHERE player_id = :pid"), {"pid": player_id}).fetchone()
        gsis = player.gsis_id if player else None
        if not gsis:
            return {"player": player.player_name if player else player_id, "player_id": player_id, "season": yr, "data": [], "error": "No PBP ID mapping"}

        rows = c.execute(text(f"""
            SELECT
                run_location, run_gap,
                COUNT(*) as plays,
                ROUND(AVG(epa)::numeric, 3) as epa_per_play,
                ROUND(AVG(rushing_yards)::numeric, 1) as avg_yards,
                ROUND(AVG(CASE WHEN success = 1 THEN 100.0 ELSE 0.0 END)::numeric, 1) as success_rate
            FROM pbp
            WHERE rusher_player_id = :pid AND season = :season
                  AND rush_attempt = 1 AND epa IS NOT NULL
                  AND run_location IS NOT NULL{ctx_sql}
            GROUP BY run_location, run_gap
            ORDER BY run_location, run_gap
        """), {"pid": gsis, "season": yr}).fetchall()

    return {
        "player": player.player_name if player else player_id,
        "player_id": player_id,
        "season": yr,
        "data": [dict(r._mapping) for r in rows],
    }


# ── Pass Location Heatmap ─────────────────────────────────────────────────────

@router.get("/pass-heatmap/{player_id}")
def pass_heatmap(
    player_id: str,
    season: Optional[int] = None,
    role: str = Query("passer"),
    season_type: str = Query("REG"), opponent: Optional[str] = None,
    week_from: Optional[int] = None, week_to: Optional[int] = None, location: Optional[str] = None,
    user: dict = Depends(require_admin),
):
    yr = season or _latest_season()
    ctx_sql = _ctx_filters(season_type, opponent, week_from, week_to, location, prefix="")
    id_col = "passer_player_id" if role == "passer" else "receiver_player_id"

    with engine.connect() as c:
        player = c.execute(text("SELECT player_name, gsis_id FROM players WHERE player_id = :pid"), {"pid": player_id}).fetchone()
        gsis = player.gsis_id if player else None
        if not gsis:
            return {"player": player.player_name if player else player_id, "player_id": player_id, "season": yr, "role": role, "data": [], "error": "No PBP ID mapping"}

        rows = c.execute(text(f"""
            SELECT
                pass_location, pass_length,
                COUNT(*) as plays,
                ROUND(AVG(epa)::numeric, 3) as epa_per_play,
                ROUND(AVG(CASE WHEN complete_pass = 1 THEN 100.0 ELSE 0.0 END)::numeric, 1) as comp_pct,
                ROUND(AVG(passing_yards)::numeric, 1) as avg_yards,
                ROUND(AVG(air_yards)::numeric, 1) as avg_air_yards
            FROM pbp
            WHERE {id_col} = :pid AND season = :season
                  AND pass_attempt = 1 AND sack = 0 AND epa IS NOT NULL
                  AND pass_location IS NOT NULL{ctx_sql}
            GROUP BY pass_location, pass_length
            ORDER BY pass_location, pass_length
        """), {"pid": gsis, "season": yr}).fetchall()

    return {
        "player": player.player_name if player else player_id,
        "player_id": player_id,
        "season": yr,
        "role": role,
        "data": [dict(r._mapping) for r in rows],
    }


# ── QB Under Pressure (Participation, 2016+) ─────────────────────────────────

@router.get("/pressure/{player_id}")
def pressure_analysis(
    player_id: str,
    season: Optional[int] = None,
    season_type: str = Query("REG"), opponent: Optional[str] = None,
    week_from: Optional[int] = None, week_to: Optional[int] = None, location: Optional[str] = None,
    user: dict = Depends(require_admin),
):
    yr = season or _latest_season()
    ctx_sql = _ctx_filters(season_type, opponent, week_from, week_to, location)
    part_years = _participation_seasons()

    with engine.connect() as c:
        player = c.execute(text("SELECT player_name, gsis_id FROM players WHERE player_id = :pid"), {"pid": player_id}).fetchone()
        gsis = player.gsis_id if player else None

        if yr not in part_years:
            return {
                "player": player.player_name if player else player_id,
                "player_id": player_id,
                "season": yr,
                "coverage": f"Participation data available for: {', '.join(str(y) for y in part_years) if part_years else 'none loaded'}",
                "data": {},
                "no_data": True,
                "available_seasons": part_years,
            }

        if not gsis:
            return {"player": player.player_name if player else player_id, "player_id": player_id, "season": yr, "data": {}, "error": "No PBP ID mapping"}

        rows = c.execute(text(f"""
            SELECT
                pt.was_pressure,
                COUNT(*) as plays,
                ROUND(AVG(p.epa)::numeric, 3) as epa_per_play,
                ROUND(AVG(CASE WHEN p.complete_pass = 1 THEN 100.0 ELSE 0.0 END)::numeric, 1) as comp_pct,
                ROUND(AVG(CASE WHEN p.sack = 1 THEN 100.0 ELSE 0.0 END)::numeric, 1) as sack_rate,
                ROUND(AVG(p.passing_yards)::numeric, 1) as avg_yards,
                ROUND(AVG(CASE WHEN p.interception = 1 THEN 100.0 ELSE 0.0 END)::numeric, 1) as int_rate
            FROM pbp p
            JOIN participation pt ON pt.nflverse_game_id = p.game_id AND pt.play_id = p.play_id
            WHERE p.passer_player_id = :pid AND p.season = :season
                  AND p.pass_attempt = 1 AND p.epa IS NOT NULL
                  AND pt.was_pressure IS NOT NULL{ctx_sql}
            GROUP BY pt.was_pressure
        """), {"pid": gsis, "season": yr}).fetchall()

    data = {}
    for r in rows:
        key = "under_pressure" if r.was_pressure else "clean_pocket"
        data[key] = dict(r._mapping)

    return {
        "player": player.player_name if player else player_id,
        "player_id": player_id,
        "season": yr,
        "data": data,
    }


# ── QB Decision Making (FTN, 2022+) ──────────────────────────────────────────

@router.get("/decisions/{player_id}")
def qb_decisions(
    player_id: str,
    season: Optional[int] = None,
    season_type: str = Query("REG"), opponent: Optional[str] = None,
    week_from: Optional[int] = None, week_to: Optional[int] = None, location: Optional[str] = None,
    user: dict = Depends(require_admin),
):
    yr = season or _latest_season()
    ctx_sql = _ctx_filters(season_type, opponent, week_from, week_to, location)
    ftn_years = _ftn_seasons()

    with engine.connect() as c:
        player = c.execute(text("SELECT player_name, gsis_id FROM players WHERE player_id = :pid"), {"pid": player_id}).fetchone()
        gsis = player.gsis_id if player else None

        if yr not in ftn_years:
            return {
                "player": player.player_name if player else player_id,
                "player_id": player_id,
                "season": yr,
                "coverage": f"FTN Charting data available for: {', '.join(str(y) for y in ftn_years) if ftn_years else 'none loaded'}",
                "decisions": {},
                "read_distribution": [],
                "no_data": True,
                "available_seasons": ftn_years,
            }

        if not gsis:
            return {"player": player.player_name if player else player_id, "player_id": player_id, "season": yr, "decisions": {}, "read_distribution": [], "error": "No PBP ID mapping"}

        row = c.execute(text(f"""
            SELECT
                COUNT(*) as total_passes,
                ROUND(AVG(CASE WHEN f.is_throw_away THEN 100.0 ELSE 0.0 END)::numeric, 1) as throwaway_pct,
                ROUND(AVG(CASE WHEN f.is_interception_worthy THEN 100.0 ELSE 0.0 END)::numeric, 1) as int_worthy_pct,
                ROUND(AVG(CASE WHEN f.is_catchable_ball THEN 100.0 ELSE 0.0 END)::numeric, 1) as catchable_pct,
                ROUND(AVG(CASE WHEN f.is_drop THEN 100.0 ELSE 0.0 END)::numeric, 1) as drop_pct,
                ROUND(AVG(CASE WHEN f.is_contested_ball THEN 100.0 ELSE 0.0 END)::numeric, 1) as contested_pct,
                ROUND(AVG(CASE WHEN f.is_qb_out_of_pocket THEN 100.0 ELSE 0.0 END)::numeric, 1) as out_of_pocket_pct,
                ROUND(AVG(CASE WHEN f.is_qb_fault_sack THEN 100.0 ELSE 0.0 END)::numeric, 1) as qb_fault_sack_pct,
                ROUND(AVG(p.epa)::numeric, 3) as epa_per_play
            FROM pbp p
            JOIN ftn_charting f ON f.nflverse_game_id = p.game_id AND f.nflverse_play_id = p.play_id
            WHERE p.passer_player_id = :pid AND p.season = :season
                  AND p.pass_attempt = 1 AND p.epa IS NOT NULL{ctx_sql}
        """), {"pid": gsis, "season": yr}).fetchone()

        reads = c.execute(text(f"""
            SELECT f.read_thrown, COUNT(*) as count
            FROM pbp p
            JOIN ftn_charting f ON f.nflverse_game_id = p.game_id AND f.nflverse_play_id = p.play_id
            WHERE p.passer_player_id = :pid AND p.season = :season
                  AND p.pass_attempt = 1 AND f.read_thrown IS NOT NULL{ctx_sql}
            GROUP BY f.read_thrown ORDER BY count DESC
        """), {"pid": gsis, "season": yr}).fetchall()

    return {
        "player": player.player_name if player else player_id,
        "player_id": player_id,
        "season": yr,
        "decisions": dict(row._mapping) if row else {},
        "read_distribution": [dict(r._mapping) for r in reads],
    }


# ── Custom Explorer ──────────────────────────────────────────────────────────

EXPLORER_FILTERS = {
    "down": {"col": "down", "type": "select", "options": [1, 2, 3, 4]},
    "quarter": {"col": "qtr", "type": "select", "options": [1, 2, 3, 4, 5]},
    "red_zone": {"col": "yardline_100 <= 20", "type": "bool"},
    "goal_to_go": {"col": "goal_to_go = 1", "type": "bool"},
    "shotgun": {"col": "shotgun = 1", "type": "bool"},
    "no_huddle": {"col": "no_huddle = 1", "type": "bool"},
    "play_type": {"col": "play_type", "type": "select", "options": ["pass", "run"]},
    "home": {"col": "posteam = home_team", "type": "bool"},
    "dome": {"col": "roof IN ('dome','closed')", "type": "bool"},
    "cold": {"col": "temp < 40 AND temp IS NOT NULL", "type": "bool"},
    "clutch": {"col": "game_seconds_remaining <= 300 AND ABS(score_differential) <= 8", "type": "bool"},
    "leading": {"col": "score_differential > 0", "type": "bool"},
    "trailing": {"col": "score_differential < 0", "type": "bool"},
    "third_down": {"col": "down = 3", "type": "bool"},
    "deep_pass": {"col": "air_yards >= 20", "type": "bool"},
    "short_pass": {"col": "air_yards < 10 AND air_yards IS NOT NULL", "type": "bool"},
}


@router.get("/explorer-filters")
def explorer_filters(user: dict = Depends(require_admin)):
    return EXPLORER_FILTERS


def _build_explorer_where(body: dict):
    """Shared filter builder for explorer and play-log endpoints."""
    season = body.get("season") or _latest_season()
    filters = body.get("filters", [])
    player_id = body.get("player_id")
    position = body.get("position")
    team = body.get("team")
    season_type = body.get("season_type", "REG")
    drill = body.get("drill")

    where_parts = ["season = :season", "epa IS NOT NULL", "play_type IN ('pass','run')"]
    params = {"season": season}

    if season_type != "ALL":
        where_parts.append(f"season_type = '{season_type}'")

    if player_id:
        with engine.connect() as c:
            gsis = _get_gsis_id(c, player_id)
        if gsis:
            where_parts.append("(passer_player_id = :gsis OR rusher_player_id = :gsis OR receiver_player_id = :gsis)")
            params["gsis"] = gsis

    if team:
        teams_list = [t.strip().upper() for t in team.split(",")]
        if len(teams_list) == 1:
            where_parts.append("posteam = :team")
            params["team"] = teams_list[0]
        else:
            where_parts.append("posteam = ANY(:teams)")
            params["teams"] = teams_list

    if position:
        pos_map = {
            "QB": "passer_player_id IS NOT NULL AND pass_attempt = 1",
            "RB": "rusher_player_id IS NOT NULL AND rush_attempt = 1",
            "WR": "receiver_player_id IS NOT NULL AND pass_attempt = 1",
        }
        if position in pos_map:
            where_parts.append(pos_map[position])

    for f in filters:
        if f in EXPLORER_FILTERS:
            spec = EXPLORER_FILTERS[f]
            if spec["type"] == "bool":
                where_parts.append(spec["col"])
            elif spec["type"] == "select" and f"_{f}_val" in body:
                where_parts.append(f"{spec['col']} = :fval_{f}")
                params[f"fval_{f}"] = body[f"_{f}_val"]

    if drill:
        drill_map = {
            "team": ("posteam = :drill_val", "str"),
            "down": ("down = :drill_val_i", "int"),
            "quarter": ("qtr = :drill_val_i", "int"),
            "play_type": ("play_type = :drill_val", "str"),
            "week": ("week = :drill_val_i", "int"),
            "field_zone": (
                "CASE WHEN yardline_100 <= 10 THEN 'Goal line (1-10)' "
                "WHEN yardline_100 <= 20 THEN 'Red zone (11-20)' "
                "WHEN yardline_100 <= 40 THEN 'Mid-field (21-40)' "
                "WHEN yardline_100 <= 60 THEN 'Own territory (41-60)' "
                "ELSE 'Deep own (61+)' END = :drill_val", "str"),
            "score_diff": (
                "CASE WHEN score_differential > 14 THEN 'Up big (14+)' "
                "WHEN score_differential > 0 THEN 'Leading (1-14)' "
                "WHEN score_differential = 0 THEN 'Tied' "
                "WHEN score_differential > -14 THEN 'Trailing (1-14)' "
                "ELSE 'Down big (14+)' END = :drill_val", "str"),
            "pass_depth": (
                "CASE WHEN air_yards IS NULL THEN 'Run' "
                "WHEN air_yards < 0 THEN 'Behind LOS' "
                "WHEN air_yards < 10 THEN 'Short (0-9)' "
                "WHEN air_yards < 20 THEN 'Medium (10-19)' "
                "ELSE 'Deep (20+)' END = :drill_val", "str"),
        }
        drill_field = drill.get("field")
        drill_value = drill.get("value")
        drill_values = drill.get("values")
        if drill_field in drill_map and (drill_value is not None or drill_values):
            sql_expr, val_type = drill_map[drill_field]
            if drill_values and len(drill_values) > 1:
                base_expr = sql_expr.rsplit("= :drill_val", 1)[0].rsplit("= :drill_val_i", 1)[0]
                if val_type == "int":
                    where_parts.append(f"{base_expr}= ANY(:drill_vals_i)")
                    params["drill_vals_i"] = [int(v) for v in drill_values]
                else:
                    where_parts.append(f"{base_expr}= ANY(:drill_vals)")
                    params["drill_vals"] = [str(v) for v in drill_values]
            else:
                v = drill_value or (drill_values[0] if drill_values else None)
                if v is not None:
                    where_parts.append(sql_expr)
                    if val_type == "int":
                        params["drill_val_i"] = int(v)
                    else:
                        params["drill_val"] = str(v)

    return " AND ".join(where_parts), params, season


@router.post("/explorer")
def custom_explorer(
    body: dict,
    user: dict = Depends(require_admin),
):
    where, params, season = _build_explorer_where(body)
    group_by = body.get("group_by", "team")

    group_sql = {
        "team": ("posteam", "posteam"),
        "down": ("down::int::text", "down"),
        "quarter": ("qtr::int::text", "quarter"),
        "play_type": ("play_type", "play_type"),
        "week": ("week::text", "week"),
        "field_zone": (
            "CASE WHEN yardline_100 <= 10 THEN 'Goal line (1-10)' "
            "WHEN yardline_100 <= 20 THEN 'Red zone (11-20)' "
            "WHEN yardline_100 <= 40 THEN 'Mid-field (21-40)' "
            "WHEN yardline_100 <= 60 THEN 'Own territory (41-60)' "
            "ELSE 'Deep own (61+)' END",
            "field_zone"
        ),
        "score_diff": (
            "CASE WHEN score_differential > 14 THEN 'Up big (14+)' "
            "WHEN score_differential > 0 THEN 'Leading (1-14)' "
            "WHEN score_differential = 0 THEN 'Tied' "
            "WHEN score_differential > -14 THEN 'Trailing (1-14)' "
            "ELSE 'Down big (14+)' END",
            "score_diff"
        ),
        "pass_depth": (
            "CASE WHEN air_yards IS NULL THEN 'Run' "
            "WHEN air_yards < 0 THEN 'Behind LOS' "
            "WHEN air_yards < 10 THEN 'Short (0-9)' "
            "WHEN air_yards < 20 THEN 'Medium (10-19)' "
            "ELSE 'Deep (20+)' END",
            "pass_depth"
        ),
    }

    g_expr, g_alias = group_sql.get(group_by, group_sql["team"])

    sql = text(f"""
        SELECT {g_expr} as {g_alias},
               COUNT(*) as plays,
               ROUND(AVG(epa)::numeric, 3) as epa_per_play,
               ROUND(SUM(epa)::numeric, 1) as total_epa,
               ROUND(AVG(CASE WHEN success = 1 THEN 100.0 ELSE 0.0 END)::numeric, 1) as success_rate,
               ROUND(AVG(yards_gained)::numeric, 1) as avg_yards,
               ROUND(AVG(CASE WHEN pass_attempt = 1 THEN 1.0 ELSE 0.0 END)::numeric * 100, 1) as pass_pct,
               ROUND(AVG(wpa)::numeric, 4) as wpa_per_play
        FROM pbp
        WHERE {where}
        GROUP BY {g_expr}
        HAVING COUNT(*) >= 10
        ORDER BY epa_per_play DESC
    """)

    with engine.connect() as c:
        rows = c.execute(sql, params).fetchall()

    totals_sql = text(f"""
        SELECT COUNT(*) as plays,
               ROUND(AVG(epa)::numeric, 3) as epa_per_play,
               ROUND(SUM(epa)::numeric, 1) as total_epa,
               ROUND(AVG(CASE WHEN success = 1 THEN 100.0 ELSE 0.0 END)::numeric, 1) as success_rate,
               ROUND(AVG(yards_gained)::numeric, 1) as avg_yards
        FROM pbp WHERE {where}
    """)
    with engine.connect() as c:
        totals = c.execute(totals_sql, params).fetchone()

    # EPA distribution per group (for mini sparklines)
    hist_sql = text(f"""
        SELECT {g_expr} as grp,
               ROUND(epa::numeric, 0) as epa_bucket,
               COUNT(*) as cnt
        FROM pbp WHERE {where}
        GROUP BY {g_expr}, ROUND(epa::numeric, 0)
        ORDER BY grp, epa_bucket
    """)
    with engine.connect() as c:
        hist_rows = c.execute(hist_sql, params).fetchall()
    hist = {}
    for r in hist_rows:
        g = str(r[0])
        if g not in hist:
            hist[g] = []
        hist[g].append({"epa": int(r[1]), "count": r[2]})

    return {
        "season": season,
        "group_by": group_by,
        "filters": body.get("filters", []),
        "totals": dict(totals._mapping) if totals else {},
        "data": [dict(r._mapping) for r in rows],
        "histograms": hist,
    }


@router.post("/explorer-plays")
def explorer_plays(
    body: dict,
    user: dict = Depends(require_admin),
):
    where, params, season = _build_explorer_where(body)
    offset = body.get("offset", 0)
    limit = min(body.get("limit", 50), 200)
    sort_col = body.get("sort", "epa")
    sort_dir = "DESC" if body.get("sort_dir", "desc") == "desc" else "ASC"

    result_filter = body.get("result_filter", [])
    if result_filter:
        rf_parts = []
        rf_map = {
            "td": "touchdown = 1",
            "int": "interception = 1",
            "sack": "sack = 1",
            "cmp": "complete_pass = 1 AND touchdown = 0 AND interception = 0",
            "rush_success": "rush_attempt = 1 AND success = 1 AND touchdown = 0",
            "inc": "pass_attempt = 1 AND complete_pass = 0 AND interception = 0 AND sack = 0",
        }
        for rf in result_filter:
            if rf in rf_map:
                rf_parts.append(f"({rf_map[rf]})")
        if rf_parts:
            where += f" AND ({' OR '.join(rf_parts)})"

    safe_cols = {"epa", "wpa", "yards_gained", "week", "play_id", "game_seconds_remaining"}
    if sort_col not in safe_cols:
        sort_col = "epa"

    sql = text(f"""
        SELECT game_id, play_id, week, qtr, down, ydstogo, yardline_100,
               play_type, yards_gained, epa, wpa, success,
               passer_player_name, rusher_player_name, receiver_player_name,
               posteam, defteam, score_differential,
               pass_attempt, rush_attempt, complete_pass, interception, sack, touchdown,
               game_seconds_remaining
        FROM pbp
        WHERE {where}
        ORDER BY {sort_col} {sort_dir}
        LIMIT :lim OFFSET :off
    """)
    count_sql = text(f"SELECT COUNT(*) FROM pbp WHERE {where}")

    params["lim"] = limit
    params["off"] = offset
    with engine.connect() as c:
        rows = c.execute(sql, params).fetchall()
        total = c.execute(count_sql, {k: v for k, v in params.items() if k not in ("lim", "off")}).scalar()

    return {
        "total": total,
        "offset": offset,
        "limit": limit,
        "plays": [dict(r._mapping) for r in rows],
    }


@router.get("/weekly-trend/{player_id}")
def weekly_trend(
    player_id: str,
    season: Optional[int] = None,
    season_type: str = Query("REG"), opponent: Optional[str] = None,
    week_from: Optional[int] = None, week_to: Optional[int] = None, location: Optional[str] = None,
    user: dict = Depends(require_admin),
):
    yr = season or _latest_season()
    ctx_sql = _ctx_filters(season_type, opponent, week_from, week_to, location, prefix="")
    with engine.connect() as c:
        player = c.execute(text("SELECT player_name, pos, gsis_id FROM players WHERE player_id = :pid"), {"pid": player_id}).fetchone()
        if not player or not player.gsis_id:
            return {"error": "Player not found or no PBP mapping"}

        gsis = player.gsis_id
        pos = player.pos or ""

        if pos in ("QB",):
            id_col, base = "passer_player_id", "pass_attempt = 1"
        elif pos in ("RB", "FB", "HB"):
            id_col, base = "rusher_player_id", "rush_attempt = 1"
        elif pos in ("WR", "TE"):
            id_col, base = "receiver_player_id", "pass_attempt = 1 AND receiver_player_id IS NOT NULL"
        else:
            return {"error": "Position not supported"}

        rows = c.execute(text(f"""
            SELECT week, posteam, defteam,
                   COUNT(*) as plays,
                   ROUND(AVG(epa)::numeric, 3) as epa_per_play,
                   ROUND(SUM(epa)::numeric, 1) as total_epa,
                   ROUND(AVG(CASE WHEN success = 1 THEN 100.0 ELSE 0.0 END)::numeric, 1) as success_rate,
                   ROUND(AVG(yards_gained)::numeric, 1) as avg_yards,
                   MAX(posteam_score_post) as team_score,
                   MAX(defteam_score_post) as opp_score
            FROM pbp
            WHERE {id_col} = :pid AND season = :season AND epa IS NOT NULL
                  AND {base}{ctx_sql}
            GROUP BY week, posteam, defteam ORDER BY week
        """), {"pid": gsis, "season": yr}).fetchall()

        data = []
        for r in rows:
            d = dict(r._mapping)
            ts, os_ = d.pop("team_score", None), d.pop("opp_score", None)
            d["result"] = "W" if ts and os_ and ts > os_ else "L" if ts and os_ and ts < os_ else "T" if ts is not None else None
            d["score"] = f"{int(ts)}-{int(os_)}" if ts is not None and os_ is not None else None
            d["opponent"] = d.pop("defteam", None)
            data.append(d)

    return {
        "player": player.player_name,
        "player_id": player_id,
        "season": yr,
        "data": data,
    }


# ── Dashboard ────────────────────────────────────────────────────────────────

@router.get("/dashboard")
def dashboard(
    season: Optional[int] = None,
    user: dict = Depends(require_admin),
):
    yr = season or _latest_season()
    results = {}
    with engine.connect() as c:
        # Top 5 EPA QBs
        results["top_qbs"] = [dict(r._mapping) for r in c.execute(text("""
            SELECT passer_player_id as gsis_id, passer_player_name as name, posteam as team,
                   COUNT(*) as plays, ROUND(AVG(epa)::numeric, 3) as epa
            FROM pbp WHERE season = :yr AND pass_attempt = 1 AND passer_player_id IS NOT NULL AND epa IS NOT NULL AND season_type = 'REG'
            GROUP BY passer_player_id, passer_player_name, posteam HAVING COUNT(*) >= 200
            ORDER BY epa DESC LIMIT 5
        """), {"yr": yr}).fetchall()]

        # Top 5 EPA RBs
        results["top_rbs"] = [dict(r._mapping) for r in c.execute(text("""
            SELECT rusher_player_id as gsis_id, rusher_player_name as name, posteam as team,
                   COUNT(*) as plays, ROUND(AVG(epa)::numeric, 3) as epa
            FROM pbp WHERE season = :yr AND rush_attempt = 1 AND rusher_player_id IS NOT NULL AND epa IS NOT NULL AND season_type = 'REG'
            GROUP BY rusher_player_id, rusher_player_name, posteam HAVING COUNT(*) >= 80
            ORDER BY epa DESC LIMIT 5
        """), {"yr": yr}).fetchall()]

        # Most clutch
        results["most_clutch"] = [dict(r._mapping) for r in c.execute(text("""
            SELECT passer_player_id as gsis_id, passer_player_name as name, posteam as team,
                   COUNT(*) as plays, ROUND(SUM(wpa)::numeric, 3) as clutch_wpa
            FROM pbp WHERE season = :yr AND pass_attempt = 1 AND passer_player_id IS NOT NULL AND wpa IS NOT NULL
                  AND season_type = 'REG' AND game_seconds_remaining <= 300 AND ABS(score_differential) <= 8
            GROUP BY passer_player_id, passer_player_name, posteam HAVING COUNT(*) >= 15
            ORDER BY clutch_wpa DESC LIMIT 3
        """), {"yr": yr}).fetchall()]

        # Best/worst teams by EPA
        results["team_epa"] = [dict(r._mapping) for r in c.execute(text("""
            SELECT posteam as team, COUNT(*) as plays,
                   ROUND(AVG(epa)::numeric, 3) as epa,
                   ROUND(AVG(CASE WHEN pass_attempt=1 THEN epa END)::numeric, 3) as pass_epa,
                   ROUND(AVG(CASE WHEN rush_attempt=1 THEN epa END)::numeric, 3) as rush_epa
            FROM pbp WHERE season = :yr AND play_type IN ('pass','run') AND epa IS NOT NULL AND season_type = 'REG'
            GROUP BY posteam ORDER BY epa DESC
        """), {"yr": yr}).fetchall()]

        # League averages
        results["league_avg"] = dict(c.execute(text("""
            SELECT ROUND(AVG(epa)::numeric, 3) as epa,
                   ROUND(AVG(CASE WHEN success=1 THEN 100.0 ELSE 0 END)::numeric, 1) as success_rate,
                   ROUND(AVG(yards_gained)::numeric, 1) as avg_yards,
                   COUNT(*) as total_plays
            FROM pbp WHERE season = :yr AND play_type IN ('pass','run') AND epa IS NOT NULL AND season_type = 'REG'
        """), {"yr": yr}).fetchone()._mapping)

    return {"season": yr, **results}


# ── Trending Players ─────────────────────────────────────────────────────────

@router.get("/trending")
def trending_players(
    season: Optional[int] = None,
    user: dict = Depends(require_admin),
):
    yr = season or _latest_season()
    with engine.connect() as c:
        # Compare first half (weeks 1-9) vs second half (weeks 10+) EPA
        rows = c.execute(text("""
            WITH halves AS (
                SELECT passer_player_id as gsis_id, passer_player_name as name, posteam as team,
                       ROUND(AVG(CASE WHEN week <= 9 THEN epa END)::numeric, 3) as epa_h1,
                       ROUND(AVG(CASE WHEN week >= 10 THEN epa END)::numeric, 3) as epa_h2,
                       COUNT(*) FILTER (WHERE week <= 9) as plays_h1,
                       COUNT(*) FILTER (WHERE week >= 10) as plays_h2
                FROM pbp WHERE season = :yr AND pass_attempt = 1 AND passer_player_id IS NOT NULL
                      AND epa IS NOT NULL AND season_type = 'REG'
                GROUP BY passer_player_id, passer_player_name, posteam
                HAVING COUNT(*) FILTER (WHERE week <= 9) >= 80 AND COUNT(*) FILTER (WHERE week >= 10) >= 80
            )
            SELECT *, ROUND((epa_h2 - epa_h1)::numeric, 3) as delta
            FROM halves WHERE epa_h1 IS NOT NULL AND epa_h2 IS NOT NULL
            ORDER BY delta DESC
        """), {"yr": yr}).fetchall()

        improved = [dict(r._mapping) for r in rows[:5]]
        declined = [dict(r._mapping) for r in rows[-5:][::-1]]

        # RB trending
        rb_rows = c.execute(text("""
            WITH halves AS (
                SELECT rusher_player_id as gsis_id, rusher_player_name as name, posteam as team,
                       ROUND(AVG(CASE WHEN week <= 9 THEN epa END)::numeric, 3) as epa_h1,
                       ROUND(AVG(CASE WHEN week >= 10 THEN epa END)::numeric, 3) as epa_h2,
                       COUNT(*) FILTER (WHERE week <= 9) as plays_h1,
                       COUNT(*) FILTER (WHERE week >= 10) as plays_h2
                FROM pbp WHERE season = :yr AND rush_attempt = 1 AND rusher_player_id IS NOT NULL
                      AND epa IS NOT NULL AND season_type = 'REG'
                GROUP BY rusher_player_id, rusher_player_name, posteam
                HAVING COUNT(*) FILTER (WHERE week <= 9) >= 40 AND COUNT(*) FILTER (WHERE week >= 10) >= 40
            )
            SELECT *, ROUND((epa_h2 - epa_h1)::numeric, 3) as delta
            FROM halves WHERE epa_h1 IS NOT NULL AND epa_h2 IS NOT NULL
            ORDER BY delta DESC
        """), {"yr": yr}).fetchall()

        rb_improved = [dict(r._mapping) for r in rb_rows[:5]]
        rb_declined = [dict(r._mapping) for r in rb_rows[-5:][::-1]]

    return {
        "season": yr,
        "qb_improved": improved,
        "qb_declined": declined,
        "rb_improved": rb_improved,
        "rb_declined": rb_declined,
    }


# ── Matchup Finder ───────────────────────────────────────────────────────────

@router.get("/matchup")
def matchup_finder(
    player_id: str = Query(...),
    defense_rank: str = Query("top10"),
    season: Optional[int] = None,
    user: dict = Depends(require_admin),
):
    yr = season or _latest_season()
    with engine.connect() as c:
        player = c.execute(text("SELECT player_name, pos, gsis_id FROM players WHERE player_id = :pid"), {"pid": player_id}).fetchone()
        if not player or not player.gsis_id:
            return {"error": "Player not found"}

        gsis = player.gsis_id
        pos = player.pos or ""

        if pos in ("QB",):
            id_col, base = "passer_player_id", "pass_attempt = 1"
        elif pos in ("RB", "FB"):
            id_col, base = "rusher_player_id", "rush_attempt = 1"
        else:
            id_col, base = "receiver_player_id", "pass_attempt = 1"

        # Rank defenses by EPA allowed
        def_ranks = c.execute(text(f"""
            SELECT defteam, ROUND(AVG(epa)::numeric, 3) as def_epa, COUNT(*) as plays
            FROM pbp WHERE season = :yr AND {base} AND epa IS NOT NULL AND season_type = 'REG'
            GROUP BY defteam ORDER BY def_epa
        """), {"yr": yr}).fetchall()

        n = len(def_ranks)
        cutoff = {"top5": 5, "top10": 10, "bottom5": n - 5, "bottom10": n - 10}.get(defense_rank, 10)
        if defense_rank.startswith("top"):
            target_teams = [r.defteam for r in def_ranks[:cutoff]]
            label = f"Top {cutoff} defenses"
        else:
            target_teams = [r.defteam for r in def_ranks[cutoff:]]
            label = f"Bottom {n - cutoff} defenses"

        # Player stats vs these defenses
        stats = c.execute(text(f"""
            SELECT COUNT(*) as plays,
                   ROUND(AVG(epa)::numeric, 3) as epa_per_play,
                   ROUND(AVG(CASE WHEN success=1 THEN 100.0 ELSE 0 END)::numeric, 1) as success_rate,
                   ROUND(AVG(yards_gained)::numeric, 1) as avg_yards
            FROM pbp WHERE {id_col} = :pid AND season = :yr AND {base} AND epa IS NOT NULL
                  AND season_type = 'REG' AND defteam = ANY(:teams)
        """), {"pid": gsis, "yr": yr, "teams": target_teams}).fetchone()

        overall = c.execute(text(f"""
            SELECT COUNT(*) as plays,
                   ROUND(AVG(epa)::numeric, 3) as epa_per_play,
                   ROUND(AVG(CASE WHEN success=1 THEN 100.0 ELSE 0 END)::numeric, 1) as success_rate,
                   ROUND(AVG(yards_gained)::numeric, 1) as avg_yards
            FROM pbp WHERE {id_col} = :pid AND season = :yr AND {base} AND epa IS NOT NULL AND season_type = 'REG'
        """), {"pid": gsis, "yr": yr}).fetchone()

        # Per-team breakdown
        per_team = [dict(r._mapping) for r in c.execute(text(f"""
            SELECT defteam as team, COUNT(*) as plays,
                   ROUND(AVG(epa)::numeric, 3) as epa_per_play,
                   ROUND(AVG(yards_gained)::numeric, 1) as avg_yards
            FROM pbp WHERE {id_col} = :pid AND season = :yr AND {base} AND epa IS NOT NULL
                  AND season_type = 'REG' AND defteam = ANY(:teams)
            GROUP BY defteam ORDER BY epa_per_play DESC
        """), {"pid": gsis, "yr": yr, "teams": target_teams}).fetchall()]

    return {
        "player": player.player_name,
        "player_id": player_id,
        "season": yr,
        "defense_label": label,
        "defense_teams": target_teams,
        "vs_defense": dict(stats._mapping) if stats else {},
        "overall": dict(overall._mapping) if overall else {},
        "per_team": per_team,
    }
