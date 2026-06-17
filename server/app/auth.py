"""Auth helpers: password hashing, JWT creation/decode, FastAPI dependency."""
import secrets
from datetime import datetime, timedelta, timezone

import bcrypt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt

from app.config import JWT_SECRET

ALGORITHM     = "HS256"
ACCESS_EXPIRE = timedelta(minutes=15)
REFRESH_DAYS  = 30

_bearer = HTTPBearer(auto_error=False)


def hash_password(plain: str) -> str:
    return bcrypt.hashpw(plain.encode(), bcrypt.gensalt()).decode()


def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode(), hashed.encode())


def create_access_token(user_id: int, username: str, is_admin: bool = False) -> str:
    expire = datetime.now(timezone.utc) + ACCESS_EXPIRE
    return jwt.encode(
        {"sub": str(user_id), "username": username, "is_admin": is_admin, "exp": expire},
        JWT_SECRET,
        algorithm=ALGORITHM,
    )


def create_refresh_token() -> str:
    return secrets.token_urlsafe(48)


def decode_access_token(token: str) -> dict:
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[ALGORITHM])
        return payload
    except JWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token")


def get_current_user(
    creds: HTTPAuthorizationCredentials | None = Depends(_bearer),
) -> dict:
    if not creds:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    return decode_access_token(creds.credentials)


def require_admin(
    current_user: dict = Depends(get_current_user),
) -> dict:
    if not current_user.get("is_admin"):
        raise HTTPException(status_code=403, detail="This feature is not yet available to your account.")
    return current_user
