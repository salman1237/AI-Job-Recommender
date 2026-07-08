"""FastAPI dependency that extracts the current user from the JWT bearer token."""
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_session
from app.models import User
from app.security import decode_access_token
from app.config import settings
from fastapi import Header

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")


async def get_current_user(
    token: str = Depends(oauth2_scheme),
    session: AsyncSession = Depends(get_session),
) -> User:
    credentials_exc = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = decode_access_token(token)
        user_id = int(payload["sub"])
    except (JWTError, KeyError, ValueError):
        raise credentials_exc

    user = await session.get(User, user_id)
    if user is None:
        raise credentials_exc
    return user


async def require_admin(user: User = Depends(get_current_user)) -> User:
    if user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return user

oauth2_scheme_optional = OAuth2PasswordBearer(tokenUrl="/auth/login", auto_error=False)

async def require_admin_or_cron(
    token: str | None = Depends(oauth2_scheme_optional),
    admin_key: str | None = Header(None, alias="admin-key"),
    session: AsyncSession = Depends(get_session),
) -> User | None:
    # 1. Check API Key for cron jobs
    if admin_key and admin_key == settings.admin_api_key:
        return None
        
    # 2. Otherwise require standard admin JWT
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Unauthorized",
            headers={"WWW-Authenticate": "Bearer"},
        )
        
    try:
        payload = decode_access_token(token)
        user_id = int(payload["sub"])
    except (JWTError, KeyError, ValueError):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Could not validate credentials")

    user = await session.get(User, user_id)
    if not user or user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
        
    return user
