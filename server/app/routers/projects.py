"""Research Projects — admin-only folders for organising saved items."""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import text

from app.auth import require_admin
from app.db import engine

router = APIRouter(prefix="/projects", tags=["projects"])


class ProjectBody(BaseModel):
    name: str


class MoveBody(BaseModel):
    project_id: int | None = None


@router.get("")
def list_projects(user: dict = Depends(require_admin)):
    uid = int(user["sub"])
    with engine.connect() as conn:
        rows = conn.execute(text("""
            SELECT p.id, p.name, p.created_at, COUNT(si.id) as item_count
            FROM projects p
            LEFT JOIN saved_items si ON si.project_id = p.id
            WHERE p.user_id = :uid
            GROUP BY p.id, p.name, p.created_at
            ORDER BY p.created_at DESC
        """), {"uid": uid}).fetchall()
    return [dict(r._mapping) for r in rows]


@router.post("", status_code=201)
def create_project(body: ProjectBody, user: dict = Depends(require_admin)):
    uid = int(user["sub"])
    name = body.name.strip()
    if not name or len(name) > 100:
        raise HTTPException(status_code=422, detail="Name must be 1-100 characters")
    with engine.begin() as conn:
        row = conn.execute(text(
            "INSERT INTO projects (user_id, name) VALUES (:uid, :name) RETURNING id, created_at"
        ), {"uid": uid, "name": name}).fetchone()
    return {"id": row.id, "name": name, "created_at": row.created_at, "item_count": 0}


@router.patch("/{project_id}")
def rename_project(project_id: int, body: ProjectBody, user: dict = Depends(require_admin)):
    uid = int(user["sub"])
    name = body.name.strip()
    if not name or len(name) > 100:
        raise HTTPException(status_code=422, detail="Name must be 1-100 characters")
    with engine.begin() as conn:
        result = conn.execute(text(
            "UPDATE projects SET name = :name WHERE id = :id AND user_id = :uid"
        ), {"name": name, "id": project_id, "uid": uid})
        if result.rowcount == 0:
            raise HTTPException(status_code=404, detail="Project not found")
    return {"ok": True}


@router.delete("/{project_id}")
def delete_project(project_id: int, user: dict = Depends(require_admin)):
    uid = int(user["sub"])
    with engine.begin() as conn:
        result = conn.execute(text(
            "DELETE FROM projects WHERE id = :id AND user_id = :uid"
        ), {"id": project_id, "uid": uid})
        if result.rowcount == 0:
            raise HTTPException(status_code=404, detail="Project not found")
    return {"ok": True}


@router.get("/{project_id}/items")
def project_items(project_id: int, user: dict = Depends(require_admin)):
    uid = int(user["sub"])
    with engine.connect() as conn:
        proj = conn.execute(text(
            "SELECT id FROM projects WHERE id = :id AND user_id = :uid"
        ), {"id": project_id, "uid": uid}).fetchone()
        if not proj:
            raise HTTPException(status_code=404, detail="Project not found")
        rows = conn.execute(text(
            "SELECT id, type, label, data, note, created_at FROM saved_items WHERE project_id = :pid AND user_id = :uid ORDER BY created_at DESC"
        ), {"pid": project_id, "uid": uid}).fetchall()
    return [dict(r._mapping) for r in rows]
