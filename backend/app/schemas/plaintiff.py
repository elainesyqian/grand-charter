"""Plaintiff-facing schemas.

These deliberately have no fields for notes, declines, audit data or internal routing
status, so a plaintiff response cannot leak them even by accident.
"""

import re
from datetime import datetime

from pydantic import BaseModel, Field, field_validator

from app.enums import CaseStatus, Category, LeadStatus, PlaintiffLeadStatus, Region
from app.models import Lead
from app.schemas.common import FirmRef, Schema

EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+$")


class LeadCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    email: str = Field(max_length=254)
    region: Region
    category: Category
    description: str = Field(min_length=1, max_length=5000)

    @field_validator("name", "description")
    @classmethod
    def _strip(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("must not be blank")
        return v

    @field_validator("email")
    @classmethod
    def _email(cls, v: str) -> str:
        v = v.strip()
        if not EMAIL_RE.match(v):
            raise ValueError("must be an email address")
        return v


class PlaintiffLeadSummary(Schema):
    id: int
    category: Category
    region: Region
    created_at: datetime
    display_status: PlaintiffLeadStatus
    case_id: int | None
    case_status: CaseStatus | None


class PlaintiffLeadDetail(PlaintiffLeadSummary):
    name: str
    email: str
    description: str
    firm: FirmRef | None  # only once a firm has accepted


def lead_summary(lead: Lead) -> PlaintiffLeadSummary:
    return PlaintiffLeadSummary(**_summary_fields(lead))


def lead_detail(lead: Lead) -> PlaintiffLeadDetail:
    case = lead.case
    return PlaintiffLeadDetail(
        **_summary_fields(lead),
        name=lead.name,
        email=lead.email,
        description=lead.description,
        firm=FirmRef.model_validate(case.firm) if case else None,
    )


def _summary_fields(lead: Lead) -> dict:
    case = lead.case
    return {
        "id": lead.id,
        "category": lead.category,
        "region": lead.region,
        "created_at": lead.created_at,
        "display_status": (
            PlaintiffLeadStatus.accepted
            if lead.status == LeadStatus.accepted
            else PlaintiffLeadStatus.under_review
        ),
        "case_id": case.id if case else None,
        "case_status": case.status if case else None,
    }
