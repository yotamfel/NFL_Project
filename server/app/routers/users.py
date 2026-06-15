"""User preference endpoints."""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import text
from typing import Optional

from app.auth import get_current_user
from app.db import engine

router = APIRouter(prefix="/users", tags=["users"])


class PrefsBody(BaseModel):
    theme:               Optional[str]  = None
    guide_lang:          Optional[str]  = None
    onboarding_complete: Optional[bool] = None


@router.patch("/preferences")
def update_preferences(body: PrefsBody, current_user: dict = Depends(get_current_user)):
    uid = int(current_user["sub"])
    if body.theme is not None and body.theme not in ("dark", "light"):
        raise HTTPException(status_code=422, detail="theme must be 'dark' or 'light'")
    if body.guide_lang is not None and body.guide_lang not in ("en", "he"):
        raise HTTPException(status_code=422, detail="guide_lang must be 'en' or 'he'")
    sets = []
    params: dict = {"uid": uid}
    if body.theme is not None:
        sets.append("theme = :theme")
        params["theme"] = body.theme
    if body.guide_lang is not None:
        sets.append("guide_lang = :guide_lang")
        params["guide_lang"] = body.guide_lang
    if body.onboarding_complete is not None:
        sets.append("onboarding_complete = :onboarding_complete")
        params["onboarding_complete"] = body.onboarding_complete
    if not sets:
        return {"ok": True}
    with engine.begin() as conn:
        row = conn.execute(text(
            f"UPDATE users SET {', '.join(sets)} WHERE id = :uid RETURNING id, username, email, guide_lang, theme, is_admin, onboarding_complete"
        ), params).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="User not found")
    return dict(row._mapping)
