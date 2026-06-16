"""GET /api/anomalies — returns season anomaly alerts."""
from fastapi import APIRouter, Query

from app.db import engine
from sqlalchemy import text

router = APIRouter(prefix="/anomalies", tags=["anomalies"])


@router.get("/seasons")
def get_anomaly_seasons():
    """Returns the list of seasons that have anomaly alerts, newest first."""
    sql = text("SELECT DISTINCT season FROM anomaly_alerts ORDER BY season DESC")
    with engine.connect() as conn:
        rows = conn.execute(sql).fetchall()
    return [r[0] for r in rows]


@router.get("")
def get_anomalies(
    limit:      int         = Query(20, ge=1, le=500),
    season:     int | None  = Query(None),
    alert_type: str | None  = Query(None),
    sort:       str | None  = Query(None, description="latest = recent weeks first"),
):
    params: dict = {"limit": limit}
    filters = []
    if season:
        filters.append("season = :season")
        params["season"] = season
    if alert_type:
        filters.append("alert_type = :alert_type")
        params["alert_type"] = alert_type

    where = ("WHERE " + " AND ".join(filters)) if filters else ""
    order = "season DESC, week DESC NULLS LAST, severity DESC" if sort == "latest" else "severity DESC, detected_at DESC"
    sql = text(f"""
        SELECT id, detected_at, season, player_id, player_name, pos,
               COALESCE(
                   team,
                   (SELECT ps.team FROM passing_seasons ps
                    WHERE ps.player_id = a.player_id AND ps.season = a.season LIMIT 1),
                   (SELECT os.team FROM offense_seasons os
                    WHERE os.player_id = a.player_id AND os.season = a.season LIMIT 1),
                   (SELECT ds.team FROM defense_seasons ds
                    WHERE ds.player_id = a.player_id AND ds.season = a.season LIMIT 1),
                   (SELECT ws.team FROM weekly_stats ws
                    WHERE ws.player_id = a.player_id AND ws.season = a.season LIMIT 1)
               ) AS team,
               category, metric, value, career_avg, career_high,
               alert_type, description, severity,
               week, opponent
        FROM anomaly_alerts a
        {where}
        ORDER BY {order}
        LIMIT :limit
    """)
    with engine.connect() as conn:
        rows = conn.execute(sql, params).fetchall()
    return [dict(r._mapping) for r in rows]
