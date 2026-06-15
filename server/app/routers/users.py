"""User preference endpoints."""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import text
from typing import Optional

from app.auth import get_current_user
from app.db import engine

router = APIRouter(prefix="/users", tags=["users"])


class PrefsBody(BaseModel):
    theme:      Optional[str] = None
    guide_lang: Optional[str] = None


@router.patch("/preferences")
def update_preferences(body: PrefsBody, current_user: dict = Depends(get_current_user)):
    uid = int(current_user["sub"])
    sets = []
    params: dict = {"uid": uid}
    if body.theme is not None:
        sets.append("theme = :theme")
        params["theme"] = body.theme
    if body.guide_lang is not None:
        sets.append("guide_lang = :guide_lang")
        params["guide_lang"] = body.guide_lang
    if not sets:
        return {"ok": True}
    with engine.begin() as conn:
        row = conn.execute(text(
            f"UPDATE users SET {', '.join(sets)} WHERE id = :uid RETURNING id, username, email, guide_lang, theme, is_admin"
        ), params).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="User not found")
    return dict(row._mapping)
