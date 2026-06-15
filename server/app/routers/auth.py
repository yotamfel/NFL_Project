"""Auth endpoints: register, login, refresh, logout, me.
Also handles visit tracking (Phase 3) — called on every token refresh.
"""
from collections import defaultdict
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr
from sqlalchemy import text

from app.auth import (
    create_access_token,
    create_refresh_token,
    get_current_user,
    hash_password,
    verify_password,
)
from app.config import ADMIN_EMAIL, ADMIN_USERNAME
from app.db import engine

router = APIRouter(prefix="/auth", tags=["auth"])

# ── Rate limiting (in-memory, resets on server restart) ───────────────────────
_failed: dict[str, list[datetime]] = defaultdict(list)
MAX_FAILS   = 5
FAIL_WINDOW = timedelta(minutes=10)

REFRESH_WINDOW = timedelta(minutes=30)


def _check_rate_limit(username: str):
    now = datetime.now(timezone.utc)
    _failed[username] = [t for t in _failed[username] if now - t < FAIL_WINDOW]
    if len(_failed[username]) >= MAX_FAILS:
        raise HTTPException(status_code=429, detail="Too many failed attempts. Try again in 10 minutes.")


def _record_fail(username: str):
    _failed[username].append(datetime.now(timezone.utc))


def _clear_fails(username: str):
    _failed.pop(username, None)


# ── Visit tracking ─────────────────────────────────────────────────────────────
def record_visit(user_id: int, username: str):
    if username == ADMIN_USERNAME:
        return
    with engine.begin() as conn:
        last = conn.execute(text(
            "SELECT visited_at FROM user_visits WHERE user_id = :uid ORDER BY visited_at DESC LIMIT 1"
        ), {"uid": user_id}).fetchone()
        if last is None or datetime.now(timezone.utc) - last[0].replace(tzinfo=timezone.utc) > REFRESH_WINDOW:
            conn.execute(text(
                "INSERT INTO user_visits (user_id) VALUES (:uid)"
            ), {"uid": user_id})


# ── Schemas ────────────────────────────────────────────────────────────────────
class RegisterBody(BaseModel):
    username: str
    email: EmailStr
    password: str


class LoginBody(BaseModel):
    username: str
    password: str


class RefreshBody(BaseModel):
    refresh_token: str


class LogoutBody(BaseModel):
    refresh_token: str


# ── Helpers ────────────────────────────────────────────────────────────────────
def _store_refresh(conn, user_id: int, token: str):
    expires = datetime.now(timezone.utc) + timedelta(days=30)
    conn.execute(text(
        "INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES (:uid, :tok, :exp)"
    ), {"uid": user_id, "tok": token, "exp": expires})


def _user_row_to_dict(row) -> dict:
    return {
        "id":         row.id,
        "username":   row.username,
        "email":      row.email,
        "guide_lang": row.guide_lang,
        "theme":      row.theme,
        "is_admin":   row.is_admin,
    }


# ── Endpoints ──────────────────────────────────────────────────────────────────
@router.post("/register", status_code=201)
def register(body: RegisterBody):
    if len(body.password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")

    username = body.username.strip().lower()

    email_lc = body.email.lower()
    with engine.begin() as conn:
        existing = conn.execute(text(
            "SELECT id FROM users WHERE LOWER(username) = :u OR LOWER(email) = :e"
        ), {"u": username, "e": email_lc}).fetchone()
        if existing:
            raise HTTPException(status_code=409, detail="Username or email already taken")

        is_admin = (
            ADMIN_USERNAME and username == ADMIN_USERNAME.lower() and
            ADMIN_EMAIL    and email_lc == ADMIN_EMAIL.lower()
        )
        row = conn.execute(text(
            "INSERT INTO users (username, email, password_hash, is_admin) VALUES (:u, :e, :h, :a) RETURNING id"
        ), {"u": username, "e": email_lc, "h": hash_password(body.password), "a": is_admin}).fetchone()
        user_id = row.id

        refresh = create_refresh_token()
        _store_refresh(conn, user_id, refresh)

    return {
        "access_token":  create_access_token(user_id, username, is_admin=is_admin),
        "refresh_token": refresh,
        "user": {"id": user_id, "username": username, "email": email_lc,
                 "guide_lang": "en", "theme": "dark", "is_admin": is_admin},
    }


@router.post("/login")
def login(body: LoginBody):
    username = body.username.strip().lower()
    _check_rate_limit(username)

    with engine.begin() as conn:
        row = conn.execute(text(
            "SELECT id, username, email, password_hash, guide_lang, theme, is_admin FROM users WHERE LOWER(username) = :u"
        ), {"u": username}).fetchone()

        if not row or not verify_password(body.password, row.password_hash):
            _record_fail(username)
            raise HTTPException(status_code=401, detail="Invalid username or password")

        _clear_fails(username)

        # Grant admin by username alone at login (password already proves identity)
        should_be_admin = bool(ADMIN_USERNAME and username == ADMIN_USERNAME.lower())
        if should_be_admin and not row.is_admin:
            conn.execute(text("UPDATE users SET is_admin = TRUE WHERE id = :uid"), {"uid": row.id})
        is_admin = should_be_admin or bool(row.is_admin)

        refresh = create_refresh_token()
        _store_refresh(conn, row.id, refresh)

    user_dict = _user_row_to_dict(row)
    user_dict["is_admin"] = is_admin
    return {
        "access_token":  create_access_token(row.id, row.username, is_admin=is_admin),
        "refresh_token": refresh,
        "user": user_dict,
    }


@router.post("/refresh")
def refresh_token(body: RefreshBody):
    with engine.begin() as conn:
        tok_row = conn.execute(text(
            "SELECT user_id, expires_at FROM refresh_tokens WHERE token = :t"
        ), {"t": body.refresh_token}).fetchone()

        if not tok_row:
            raise HTTPException(status_code=401, detail="Invalid refresh token")
        if tok_row.expires_at.replace(tzinfo=timezone.utc) < datetime.now(timezone.utc):
            raise HTTPException(status_code=401, detail="Refresh token expired")

        user = conn.execute(text(
            "SELECT id, username, email, guide_lang, theme, is_admin FROM users WHERE id = :uid"
        ), {"uid": tok_row.user_id}).fetchone()

    record_visit(user.id, user.username)

    unread = _count_unread(user.id)
    return {
        "access_token": create_access_token(user.id, user.username, is_admin=bool(user.is_admin)),
        "user": {**_user_row_to_dict(user), "unread_notifications_count": unread},
    }


@router.post("/logout")
def logout(body: LogoutBody, current_user: dict = Depends(get_current_user)):
    with engine.begin() as conn:
        conn.execute(text("DELETE FROM refresh_tokens WHERE token = :t"), {"t": body.refresh_token})
    return {"ok": True}


@router.get("/me")
def me(current_user: dict = Depends(get_current_user)):
    with engine.connect() as conn:
        row = conn.execute(text(
            "SELECT id, username, email, guide_lang, theme, is_admin FROM users WHERE id = :uid"
        ), {"uid": int(current_user["sub"])}).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="User not found")
        unread = _count_unread(row.id)
    return {**_user_row_to_dict(row), "unread_notifications_count": unread}


def _count_unread(user_id: int) -> int:
    with engine.connect() as conn:
        return conn.execute(text(
            "SELECT COUNT(*) FROM notifications WHERE user_id = :uid AND is_read = FALSE"
        ), {"uid": user_id}).scalar() or 0
