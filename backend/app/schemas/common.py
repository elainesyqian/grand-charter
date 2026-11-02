"""Shared response shapes."""

from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict

from app.enums import AuditAction, CaseStatus, EntityType, Role


class Schema(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class Page[T](Schema):
    items: list[T]
    total: int
    page: int
    page_size: int


class FirmRef(Schema):
    id: int
    name: str


class UserRef(Schema):
    id: int
    name: str
    role: Role
    title: str | None = None


class DocumentOut(Schema):
    id: int
    filename: str
    size_bytes: int
    uploader_role: Role
    uploader_firm: FirmRef | None
    created_at: datetime


class CaseUpdateOut(Schema):
    id: int
    author: UserRef
    from_status: CaseStatus | None
    to_status: CaseStatus | None
    message: str | None
    created_at: datetime


class AuditEventOut(Schema):
    id: int
    actor: UserRef | None  # None = system
    entity_type: EntityType
    entity_id: int
    action: AuditAction
    before: dict[str, Any] | None
    after: dict[str, Any] | None
    reason: str | None
    created_at: datetime
