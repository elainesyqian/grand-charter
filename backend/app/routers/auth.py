"""/api/auth and /api/meta."""

import bcrypt
from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.config import settings
from app.db import get_db
from app.deps import SESSION_USER_KEY, get_current_user
from app.enums import CaseStatus, Category, LeadStatus, Region, Role
from app.models import User
from app.schemas.auth import DemoUserOut, LoginIn, MeOut, MetaOut

router = APIRouter(prefix="/auth", tags=["auth"])
meta_router = APIRouter(prefix="/meta", tags=["meta"])

# Compared against when the email is unknown, so both failure paths take the same time.
_DUMMY_HASH = bcrypt.hashpw(b"not-a-real-password", bcrypt.gensalt())


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


@router.post("/login", response_model=MeOut)
def login(body: LoginIn, request: Request, db: Session = Depends(get_db)) -> User:
    user = db.scalar(select(User).where(User.email == body.email.strip().lower()))
    stored = user.password_hash.encode() if user else _DUMMY_HASH
    ok = bcrypt.checkpw(body.password.encode(), stored)
    if user is None or not ok:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid email or password")
    request.session.clear()
    request.session[SESSION_USER_KEY] = user.id
    return user


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(request: Request) -> Response:
    request.session.clear()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/me", response_model=MeOut)
def me(user: User = Depends(get_current_user)) -> User:
    return user


@router.get("/demo-users", response_model=list[DemoUserOut])
def demo_users(db: Session = Depends(get_db)) -> list[User]:
    if not settings.demo_mode:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Not found")
    role_order = {Role.plaintiff: 0, Role.staff: 1, Role.admin: 2}
    users = db.scalars(select(User).where(User.email.like("%@demo")).options(selectinload(User.firm)))
    return sorted(users, key=lambda u: (role_order[u.role], u.firm_id or 0, u.email))


@meta_router.get("", response_model=MetaOut)
def meta() -> MetaOut:
    return MetaOut(
        regions=list(Region),
        categories=list(Category),
        lead_statuses=list(LeadStatus),
        case_statuses=list(CaseStatus),
    )
