"""Admin schemas."""

from datetime import datetime

from pydantic import BaseModel, Field

from app.enums import CaseStatus, Category, LeadStatus, Region
from app.models import Case, Lead
from app.schemas.common import FirmRef, Schema, UserRef
from app.schemas.firm import NoteOut


class AdminLeadOut(Schema):
    id: int
    name: str
    email: str
    category: Category
    region: Region
    status: LeadStatus
    firm: FirmRef | None
    created_at: datetime
    updated_at: datetime


class DeclineOut(Schema):
    id: int
    firm: FirmRef
    user: UserRef
    reason: str
    created_at: datetime


class AdminLeadDetail(AdminLeadOut):
    description: str
    plaintiff: UserRef
    case_id: int | None
    declines: list[DeclineOut]  # small, bounded by number of firms


class AssignIn(BaseModel):
    firm_id: int
    reason: str | None = Field(default=None, max_length=2000)


class AdminCaseOut(Schema):
    id: int
    lead_id: int
    plaintiff_name: str
    category: Category
    region: Region
    status: CaseStatus
    firm: FirmRef
    created_at: datetime
    updated_at: datetime


class AdminCaseDetail(AdminCaseOut):
    plaintiff_email: str
    description: str


class AdminNoteOut(NoteOut):
    author_firm: FirmRef
    # True when the authoring firm no longer holds the case (note retained, not visible to it).
    from_previous_firm: bool


class FirmOut(Schema):
    id: int
    name: str


def lead_detail(lead: Lead) -> AdminLeadDetail:
    return AdminLeadDetail(
        **AdminLeadOut.model_validate(lead).model_dump(),
        description=lead.description,
        plaintiff=UserRef.model_validate(lead.plaintiff),
        case_id=lead.case.id if lead.case else None,
        declines=[DeclineOut.model_validate(d) for d in lead.declines],
    )


def case_out(case: Case) -> AdminCaseOut:
    lead = case.lead
    return AdminCaseOut(
        id=case.id,
        lead_id=lead.id,
        plaintiff_name=lead.name,
        category=lead.category,
        region=lead.region,
        status=case.status,
        firm=FirmRef.model_validate(case.firm),
        created_at=case.created_at,
        updated_at=case.updated_at,
    )


def case_detail(case: Case) -> AdminCaseDetail:
    return AdminCaseDetail(
        **case_out(case).model_dump(),
        plaintiff_email=case.lead.email,
        description=case.lead.description,
    )
