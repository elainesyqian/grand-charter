"""Auth and reference-data schemas."""

from pydantic import BaseModel

from app.enums import CaseStatus, Category, LeadStatus, Region, Role
from app.schemas.common import FirmRef, Schema


class LoginIn(BaseModel):
    email: str
    password: str


class MeOut(Schema):
    id: int
    name: str
    email: str
    role: Role
    title: str | None
    firm: FirmRef | None


class DemoUserOut(Schema):
    email: str
    name: str
    role: Role
    title: str | None
    firm: FirmRef | None


class MetaOut(BaseModel):
    regions: list[Region]
    categories: list[Category]
    lead_statuses: list[LeadStatus]
    case_statuses: list[CaseStatus]
