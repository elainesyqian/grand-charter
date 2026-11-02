"""Firm-staff schemas."""

from datetime import datetime

from pydantic import BaseModel, Field, field_validator, model_validator

from app.enums import CaseStatus, Category, LeadStatus, Region
from app.models import Case
from app.schemas.common import Schema, UserRef


class InboxLeadOut(Schema):
    id: int
    name: str
    category: Category
    region: Region
    status: LeadStatus
    created_at: datetime


class FirmLeadDetail(InboxLeadOut):
    email: str
    description: str
    case_id: int | None


class DeclineIn(BaseModel):
    reason: str = Field(min_length=1, max_length=2000)

    @field_validator("reason")
    @classmethod
    def _strip(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("must not be blank")
        return v


class FirmCaseSummary(Schema):
    id: int
    lead_id: int
    plaintiff_name: str
    category: Category
    region: Region
    status: CaseStatus
    created_at: datetime
    updated_at: datetime


class FirmCaseDetail(FirmCaseSummary):
    plaintiff_email: str
    description: str


class CaseUpdateIn(BaseModel):
    to_status: CaseStatus | None = None
    message: str | None = Field(default=None, max_length=5000)

    @model_validator(mode="after")
    def _one_required(self):
        if self.message is not None:
            self.message = self.message.strip() or None
        if self.to_status is None and self.message is None:
            raise ValueError("Provide a status change, a message, or both")
        return self


class NoteIn(BaseModel):
    body: str = Field(min_length=1, max_length=10000)

    @field_validator("body")
    @classmethod
    def _strip(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("must not be blank")
        return v


class NoteOut(Schema):
    id: int
    author: UserRef
    body: str
    created_at: datetime


def case_summary(case: Case) -> dict:
    lead = case.lead
    return {
        "id": case.id,
        "lead_id": lead.id,
        "plaintiff_name": lead.name,
        "category": lead.category,
        "region": lead.region,
        "status": case.status,
        "created_at": case.created_at,
        "updated_at": case.updated_at,
    }


def case_detail(case: Case) -> FirmCaseDetail:
    return FirmCaseDetail(
        **case_summary(case), plaintiff_email=case.lead.email, description=case.lead.description
    )


def lead_detail(lead) -> FirmLeadDetail:
    return FirmLeadDetail(
        id=lead.id,
        name=lead.name,
        category=lead.category,
        region=lead.region,
        status=lead.status,
        created_at=lead.created_at,
        email=lead.email,
        description=lead.description,
        case_id=lead.case.id if lead.case else None,
    )
