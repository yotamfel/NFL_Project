"""Notification endpoints for users."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import text

from app.auth import get_current_user
from app.db import engine

router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.get("")
def list_notifications(current_user: dict = Depends(get_current_user)):
    uid = int(current_user["sub"])
    with engine.connect() as conn:
        rows = conn.execute(text(
            "SELECT id, message, feedback_id, is_read, created_at FROM notifications WHERE user_id = :uid ORDER BY created_at DESC"
        ), {"uid": uid}).fetchall()
    return [dict(r._mapping) for r in rows]


@router.patch("/{notif_id}/read")
def mark_read(notif_id: int, current_user: dict = Depends(get_current_user)):
    uid = int(current_user["sub"])
    with engine.begin() as conn:
        result = conn.execute(text(
            "UPDATE notifications SET is_read = TRUE WHERE id = :id AND user_id = :uid"
        ), {"id": notif_id, "uid": uid})
        if result.rowcount == 0:
            raise HTTPException(status_code=404, detail="Notification not found")
    return {"ok": True}
