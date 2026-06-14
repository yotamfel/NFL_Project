"""GET /api/admin/ai — AI features usage dashboard."""
from fastapi import APIRouter

from app.db import engine
from sqlalchemy import text

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/ai")
def ai_dashboard():
    with engine.connect() as conn:
        # Summary per feature (last 30 days)
        feature_stats = conn.execute(text("""
            SELECT feature,
                   COUNT(*)                                             AS total,
                   COUNT(*) FILTER (WHERE success)                     AS success_count,
                   COUNT(*) FILTER (WHERE NOT success)                 AS error_count,
                   ROUND(AVG(response_ms) FILTER (WHERE success))      AS avg_ms,
                   SUM(tokens_used)                                     AS total_tokens,
                   COUNT(*) FILTER (WHERE thumbs =  1)                 AS thumbs_up,
                   COUNT(*) FILTER (WHERE thumbs = -1)                 AS thumbs_down
            FROM ai_query_log
            WHERE created_at > now() - INTERVAL '30 days'
            GROUP BY feature
            ORDER BY total DESC
        """)).fetchall()

        # Daily query volume (last 14 days)
        daily = conn.execute(text("""
            SELECT created_at::date AS day, COUNT(*) AS queries
            FROM ai_query_log
            WHERE created_at > now() - INTERVAL '14 days'
            GROUP BY day
            ORDER BY day
        """)).fetchall()

        # Recent log entries
        recent = conn.execute(text("""
            SELECT id, created_at, feature, model_used, tokens_used, response_ms,
                   success, error_msg, thumbs,
                   LEFT(input_text, 120) AS input_preview
            FROM ai_query_log
            ORDER BY created_at DESC
            LIMIT 30
        """)).fetchall()

        # Anomaly alert counts
        anomaly_stats = conn.execute(text("""
            SELECT season, COUNT(*) AS total,
                   COUNT(*) FILTER (WHERE alert_type = 'career_high')     AS career_highs,
                   COUNT(*) FILTER (WHERE alert_type = 'yoy_surge')       AS yoy_surge,
                   COUNT(*) FILTER (WHERE alert_type = 'efficiency_peak') AS efficiency_peak,
                   COUNT(*) FILTER (WHERE alert_type = 'versatile')       AS versatile,
                   COUNT(*) FILTER (WHERE alert_type = 'above_avg')       AS above_avg,
                   COUNT(*) FILTER (WHERE alert_type = 'below_avg')       AS below_avg
            FROM anomaly_alerts
            GROUP BY season
            ORDER BY season DESC
            LIMIT 5
        """)).fetchall()

    return {
        "feature_stats": [dict(r._mapping) for r in feature_stats],
        "daily_volume":  [dict(r._mapping) for r in daily],
        "recent_logs":   [dict(r._mapping) for r in recent],
        "anomaly_stats": [dict(r._mapping) for r in anomaly_stats],
    }
