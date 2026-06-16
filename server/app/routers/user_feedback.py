"""User feedback & admin feedback management endpoints."""
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import text
from typing import Optional

from app.auth import get_current_user
from app.db import engine

router = APIRouter(tags=["user-feedback"])

VALID_CATEGORIES = {"bug", "feature", "data", "general"}


class FeedbackBody(BaseModel):
    category: str
    message:  str


class AdminFeedbackPatch(BaseModel):
    admin_reply: Optional[str] = None
    resolved:    Optional[bool] = None


# ── User endpoints ─────────────────────────────────────────────────────────────
@router.post("/feedback", status_code=201)
def submit_feedback(body: FeedbackBody, current_user: dict = Depends(get_current_user)):
    if body.category not in VALID_CATEGORIES:
        raise HTTPException(status_code=400, detail=f"category must be one of {VALID_CATEGORIES}")
    message = body.message.strip()
    if len(message) < 10:
        raise HTTPException(status_code=400, detail="Message must be at least 10 characters")
    if len(message) > 2000:
        raise HTTPException(status_code=400, detail="Message must be at most 2000 characters")
    uid = int(current_user["sub"])
    with engine.begin() as conn:
        row = conn.execute(text(
            "INSERT INTO feedback (user_id, username, category, message) VALUES (:uid, :uname, :cat, :msg) RETURNING id"
        ), {"uid": uid, "uname": current_user["username"], "cat": body.category, "msg": message}).fetchone()
    return {"id": row.id}


# ── Admin endpoints ────────────────────────────────────────────────────────────
def _require_admin(current_user: dict = Depends(get_current_user)):
    if not current_user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Admin only")
    return current_user


@router.get("/admin/feedback")
def admin_list_feedback(admin: dict = Depends(_require_admin)):
    with engine.connect() as conn:
        rows = conn.execute(text(
            "SELECT id, username, category, message, resolved, admin_reply, created_at, replied_at FROM feedback ORDER BY created_at DESC"
        )).fetchall()
    return [dict(r._mapping) for r in rows]


@router.patch("/admin/feedback/{feedback_id}")
def admin_patch_feedback(feedback_id: int, body: AdminFeedbackPatch, admin: dict = Depends(_require_admin)):
    with engine.begin() as conn:
        fb = conn.execute(text(
            "SELECT id, user_id, admin_reply FROM feedback WHERE id = :id"
        ), {"id": feedback_id}).fetchone()
        if not fb:
            raise HTTPException(status_code=404, detail="Feedback not found")

        sets = []
        params: dict = {"id": feedback_id}

        if body.resolved is not None:
            sets.append("resolved = :resolved")
            params["resolved"] = body.resolved

        if body.admin_reply is not None:
            sets.append("admin_reply = :reply")
            params["reply"] = body.admin_reply
            first_reply = fb.admin_reply is None
            if first_reply:
                sets.append("replied_at = now()")
                if fb.user_id:
                    conn.execute(text(
                        "INSERT INTO notifications (user_id, message, feedback_id) VALUES (:uid, :msg, :fid)"
                    ), {"uid": fb.user_id, "msg": body.admin_reply, "fid": feedback_id})

        if sets:
            conn.execute(text(f"UPDATE feedback SET {', '.join(sets)} WHERE id = :id"), params)
    return {"ok": True}


@router.get("/admin/users")
def admin_list_users(admin: dict = Depends(_require_admin)):
    with engine.connect() as conn:
        rows = conn.execute(text(
            "SELECT id, username, email, is_admin, created_at FROM users ORDER BY created_at DESC"
        )).fetchall()
    return [dict(r._mapping) for r in rows]


@router.delete("/admin/users/{user_id}", status_code=204)
def admin_delete_user(user_id: int, admin: dict = Depends(_require_admin)):
    if user_id == int(admin["sub"]):
        raise HTTPException(status_code=400, detail="Cannot delete your own account")
    with engine.begin() as conn:
        result = conn.execute(text("DELETE FROM users WHERE id = :uid"), {"uid": user_id})
        if result.rowcount == 0:
            raise HTTPException(status_code=404, detail="User not found")


@router.get("/admin/visits")
def admin_visits(admin: dict = Depends(_require_admin)):
    with engine.connect() as conn:
        rows = conn.execute(text("""
            SELECT DATE(visited_at) AS day, COUNT(*) AS visits
            FROM user_visits
            GROUP BY day
            ORDER BY day DESC
            LIMIT 90
        """)).fetchall()
    return [dict(r._mapping) for r in rows]


@router.get("/admin/stats")
def admin_stats(admin: dict = Depends(_require_admin)):
    with engine.connect() as conn:
        total_users   = conn.execute(text("SELECT COUNT(*) FROM users")).scalar() or 0
        total_visits  = conn.execute(text("SELECT COUNT(*) FROM user_visits")).scalar() or 0
        visits_today  = conn.execute(text("SELECT COUNT(*) FROM user_visits WHERE visited_at >= CURRENT_DATE")).scalar() or 0
        visits_7d     = conn.execute(text("SELECT COUNT(*) FROM user_visits WHERE visited_at > now() - INTERVAL '7 days'")).scalar() or 0
        visits_30d    = conn.execute(text("SELECT COUNT(*) FROM user_visits WHERE visited_at > now() - INTERVAL '30 days'")).scalar() or 0
        total_fb      = conn.execute(text("SELECT COUNT(*) FROM feedback")).scalar() or 0
        unresolved_fb = conn.execute(text("SELECT COUNT(*) FROM feedback WHERE resolved = FALSE")).scalar() or 0
    return {
        "total_users":         total_users,
        "total_visits":        total_visits,
        "visits_today":        visits_today,
        "visits_7d":           visits_7d,
        "visits_30d":          visits_30d,
        "total_feedback":      total_fb,
        "unresolved_feedback": unresolved_fb,
    }
