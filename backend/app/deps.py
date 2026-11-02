"""FastAPI dependencies: current user, role guards, pagination params."""

from collections.abc import Callable
from dataclasses import dataclass

from fastapi import Depends, HTTPException, Query, Request, status
from sqlalchemy.orm import Session

from app.config import settings
from app.db import get_db
from app.enums import Role
from app.models import User

SESSION_USER_KEY = "user_id"


def get_current_user(request: Request, db: Session = Depends(get_db)) -> User:
    user_id = request.session.get(SESSION_USER_KEY)
    user = db.get(User, user_id) if isinstance(user_id, int) else None
    if user is None:
        request.session.clear()
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Not signed in")
    return user


def require_role(*roles: Role) -> Callable[..., User]:
    def guard(user: User = Depends(get_current_user)) -> User:
        if user.role not in roles:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Not allowed for this role")
        return user

    return guard


def upload_size_guard(request: Request) -> None:
    """Reject obviously oversized uploads before the multipart body is parsed.

    The exact per-file limit is enforced again while copying into storage.
    """
    length = request.headers.get("content-length")
    if length and length.isdigit() and int(length) > settings.max_upload_bytes + 64 * 1024:
        raise HTTPException(
            status.HTTP_413_CONTENT_TOO_LARGE, f"File exceeds {settings.max_upload_mb} MB limit"
        )


@dataclass(frozen=True)
class PageParams:
    page: int
    page_size: int

    @property
    def offset(self) -> int:
        return (self.page - 1) * self.page_size


def page_params(
    page: int = Query(1, ge=1),
    page_size: int = Query(settings.page_size_default, ge=1, le=settings.page_size_max),
) -> PageParams:
    return PageParams(page=page, page_size=page_size)
