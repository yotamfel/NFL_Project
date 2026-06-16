"""User feedback & admin feedback management endpoints."""
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


class ReplyBody(BaseModel):
    message: str


class AdminFeedbackPatch(BaseModel):
    resolved: Optional[bool] = None


# ── Helpers ────────────────────────────────────────────────────────────────────
def _require_admin(current_user: dict = Depends(get_current_user)):
    if not current_user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Admin only")
    return current_user


def _notify_admin(conn, message: str, feedback_id: int):
    admins = conn.execute(text("SELECT id FROM users WHERE is_admin = TRUE")).fetchall()
    for admin in admins:
        conn.execute(text(
            "INSERT INTO notifications (user_id, message, feedback_id) VALUES (:uid, :msg, :fid)"
        ), {"uid": admin.id, "msg": message, "fid": feedback_id})


def _notify_user(conn, user_id: int, message: str, feedback_id: int):
    if not user_id:
        return
    conn.execute(text(
        "INSERT INTO notifications (user_id, message, feedback_id) VALUES (:uid, :msg, :fid)"
    ), {"uid": user_id, "msg": message, "fid": feedback_id})


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
        conn.execute(text(
            "INSERT INTO feedback_messages (feedback_id, sender, message) VALUES (:fid, 'user', :msg)"
        ), {"fid": row.id, "msg": message})
        preview = message[:80] + ('…' if len(message) > 80 else '')
        _notify_admin(conn, f"New {body.category} feedback from {current_user['username']}: {preview}", row.id)
    return {"id": row.id}


@router.get("/feedback/{feedback_id}/messages")
def get_feedback_messages(feedback_id: int, current_user: dict = Depends(get_current_user)):
    uid = int(current_user["sub"])
    is_admin = bool(current_user.get("is_admin"))
    with engine.connect() as conn:
        fb = conn.execute(text(
            "SELECT user_id FROM feedback WHERE id = :id"
        ), {"id": feedback_id}).fetchone()
        if not fb:
            raise HTTPException(status_code=404, detail="Feedback not found")
        if not is_admin and fb.user_id != uid:
            raise HTTPException(status_code=403, detail="Forbidden")
        rows = conn.execute(text(
            "SELECT id, sender, message, created_at FROM feedback_messages WHERE feedback_id = :fid ORDER BY created_at ASC"
        ), {"fid": feedback_id}).fetchall()
    return [dict(r._mapping) for r in rows]


@router.post("/feedback/{feedback_id}/reply", status_code=201)
def user_reply_feedback(feedback_id: int, body: ReplyBody, current_user: dict = Depends(get_current_user)):
    message = body.message.strip()
    if len(message) < 1:
        raise HTTPException(status_code=400, detail="Message cannot be empty")
    if len(message) > 2000:
        raise HTTPException(status_code=400, detail="Message must be at most 2000 characters")
    uid = int(current_user["sub"])
    with engine.begin() as conn:
        fb = conn.execute(text(
            "SELECT id, user_id FROM feedback WHERE id = :id"
        ), {"id": feedback_id}).fetchone()
        if not fb:
            raise HTTPException(status_code=404, detail="Feedback not found")
        if fb.user_id != uid:
            raise HTTPException(status_code=403, detail="Forbidden")
        conn.execute(text(
            "INSERT INTO feedback_messages (feedback_id, sender, message) VALUES (:fid, 'user', :msg)"
        ), {"fid": feedback_id, "msg": message})
        preview = message[:80] + ('…' if len(message) > 80 else '')
        _notify_admin(conn, f"Reply from {current_user['username']}: {preview}", feedback_id)
    return {"ok": True}


# ── Admin endpoints ────────────────────────────────────────────────────────────
@router.get("/admin/feedback")
def admin_list_feedback(admin: dict = Depends(_require_admin)):
    with engine.connect() as conn:
        rows = conn.execute(text(
            "SELECT id, username, category, message, resolved, created_at FROM feedback ORDER BY created_at DESC"
        )).fetchall()
    return [dict(r._mapping) for r in rows]


@router.post("/admin/feedback/{feedback_id}/reply", status_code=201)
def admin_reply_feedback(feedback_id: int, body: ReplyBody, admin: dict = Depends(_require_admin)):
    message = body.message.strip()
    if not message:
        raise HTTPException(status_code=400, detail="Message cannot be empty")
    with engine.begin() as conn:
        fb = conn.execute(text(
            "SELECT id, user_id, username FROM feedback WHERE id = :id"
        ), {"id": feedback_id}).fetchone()
        if not fb:
            raise HTTPException(status_code=404, detail="Feedback not found")
        conn.execute(text(
            "INSERT INTO feedback_messages (feedback_id, sender, message) VALUES (:fid, 'admin', :msg)"
        ), {"fid": feedback_id, "msg": message})
        conn.execute(text(
            "UPDATE feedback SET replied_at = now() WHERE id = :id"
        ), {"id": feedback_id})
        preview = message[:80] + ('…' if len(message) > 80 else '')
        _notify_user(conn, fb.user_id, f"Admin replied: {preview}", feedback_id)
    return {"ok": True}


@router.patch("/admin/feedback/{feedback_id}")
def admin_patch_feedback(feedback_id: int, body: AdminFeedbackPatch, admin: dict = Depends(_require_admin)):
    if body.resolved is None:
        return {"ok": True}
    with engine.begin() as conn:
        result = conn.execute(text(
            "UPDATE feedback SET resolved = :resolved WHERE id = :id"
        ), {"resolved": body.resolved, "id": feedback_id})
        if result.rowcount == 0:
            raise HTTPException(status_code=404, detail="Feedback not found")
    return {"ok": True}


@router.delete("/admin/feedback/{feedback_id}", status_code=204)
def admin_delete_feedback(feedback_id: int, admin: dict = Depends(_require_admin)):
    with engine.begin() as conn:
        result = conn.execute(text("DELETE FROM feedback WHERE id = :id"), {"id": feedback_id})
        if result.rowcount == 0:
            raise HTTPException(status_code=404, detail="Feedback not found")


@router.get("/admin/users")
def admin_list_users(admin: dict = Depends(_require_admin)):
    with engine.connect() as conn:
        rows = conn.execute(text("""
            SELECT u.id, u.username, u.email, u.is_admin, u.created_at,
                   COUNT(v.id) AS visit_count
            FROM users u
            LEFT JOIN user_visits v ON v.user_id = u.id
            GROUP BY u.id, u.username, u.email, u.is_admin, u.created_at
            ORDER BY u.created_at DESC
        """)).fetchall()
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
