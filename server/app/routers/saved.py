"""Saved items endpoints — DB-backed replacement for localStorage."""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import text
from typing import Any

from app.auth import get_current_user
from app.db import engine

router = APIRouter(prefix="/saved", tags=["saved"])


class SavedItemBody(BaseModel):
    type:  str
    label: str
    data:  Any
    note:  str = ""


class NoteBody(BaseModel):
    note: str


class MigrateBody(BaseModel):
    items: list[dict]


@router.get("")
def list_saved(current_user: dict = Depends(get_current_user)):
    uid = int(current_user["sub"])
    with engine.connect() as conn:
        rows = conn.execute(text(
            "SELECT id, type, label, data, note, created_at FROM saved_items WHERE user_id = :uid ORDER BY created_at DESC"
        ), {"uid": uid}).fetchall()
    return [dict(r._mapping) for r in rows]


@router.post("", status_code=201)
def create_saved(body: SavedItemBody, current_user: dict = Depends(get_current_user)):
    uid = int(current_user["sub"])
    import json
    with engine.begin() as conn:
        row = conn.execute(text(
            "INSERT INTO saved_items (user_id, type, label, data, note) VALUES (:uid, :type, :label, :data::jsonb, :note) RETURNING id, created_at"
        ), {"uid": uid, "type": body.type, "label": body.label, "data": json.dumps(body.data), "note": body.note}).fetchone()
    return {"id": row.id, "created_at": row.created_at}


@router.patch("/{item_id}")
def update_note(item_id: int, body: NoteBody, current_user: dict = Depends(get_current_user)):
    uid = int(current_user["sub"])
    with engine.begin() as conn:
        result = conn.execute(text(
            "UPDATE saved_items SET note = :note WHERE id = :id AND user_id = :uid"
        ), {"note": body.note, "id": item_id, "uid": uid})
        if result.rowcount == 0:
            raise HTTPException(status_code=404, detail="Item not found")
    return {"ok": True}


@router.delete("/{item_id}")
def delete_saved(item_id: int, current_user: dict = Depends(get_current_user)):
    uid = int(current_user["sub"])
    with engine.begin() as conn:
        result = conn.execute(text(
            "DELETE FROM saved_items WHERE id = :id AND user_id = :uid"
        ), {"id": item_id, "uid": uid})
        if result.rowcount == 0:
            raise HTTPException(status_code=404, detail="Item not found")
    return {"ok": True}


@router.post("/migrate", status_code=201)
def migrate_saved(body: MigrateBody, current_user: dict = Depends(get_current_user)):
    uid = int(current_user["sub"])
    import json
    inserted = 0
    with engine.begin() as conn:
        for item in body.items:
            label = str(item.get("label", ""))
            itype = str(item.get("type", ""))
            if not label or not itype:
                continue
            existing = conn.execute(text(
                "SELECT id FROM saved_items WHERE user_id = :uid AND type = :t AND label = :l"
            ), {"uid": uid, "t": itype, "l": label}).fetchone()
            if existing:
                continue
            conn.execute(text(
                "INSERT INTO saved_items (user_id, type, label, data, note) VALUES (:uid, :type, :label, :data::jsonb, :note)"
            ), {"uid": uid, "type": itype, "label": label,
                "data": json.dumps(item.get("data", {})), "note": item.get("note", "")})
            inserted += 1
    return {"inserted": inserted}
