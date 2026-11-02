"""/api/admin: cross-firm search, assignment, and history. No scoping."""

from datetime import datetime

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.orm import Session, contains_eager, selectinload

from app import policy
from app.db import get_db
from app.deps import PageParams, page_params, require_role
from app.enums import AuditAction, CaseStatus, Category, EntityType, LeadStatus, Region, Role
from app.models import AuditEvent, Case, Firm, Lead, Note, User
from app.querying import documents_stmt, history_stmt, page_body, paginate, text_search, updates_stmt
from app.schemas import admin as s
from app.schemas.common import AuditEventOut, CaseUpdateOut, DocumentOut, FirmRef, Page, UserRef
from app.services import cases, leads

router = APIRouter(prefix="/admin", tags=["admin"])
Admin = Depends(require_role(Role.admin))


# --- Leads ---


@router.get("/leads", response_model=Page[s.AdminLeadOut])
def search_leads(
    q: str | None = Query(None, max_length=200),
    status_: list[LeadStatus] | None = Query(None, alias="status"),
    firm_id: int | None = None,
    category: Category | None = None,
    region: Region | None = None,
    created_from: datetime | None = None,
    created_to: datetime | None = None,
    user: User = Admin,
    params: PageParams = Depends(page_params),
    db: Session = Depends(get_db),
):
    stmt = select(Lead).options(selectinload(Lead.firm))
    if status_:
        stmt = stmt.where(Lead.status.in_(status_))
    if firm_id is not None:
        stmt = stmt.where(Lead.firm_id == firm_id)
    if category:
        stmt = stmt.where(Lead.category == category)
    if region:
        stmt = stmt.where(Lead.region == region)
    if created_from:
        stmt = stmt.where(Lead.created_at >= created_from)
    if created_to:
        stmt = stmt.where(Lead.created_at < created_to)
    if (match := text_search(q, [Lead.name, Lead.email, Lead.description], Lead.id)) is not None:
        stmt = stmt.where(match)
    items, total = paginate(db, stmt.order_by(Lead.created_at.desc(), Lead.id.desc()), params)
    return page_body(items, total, params)


@router.get("/leads/{lead_id}", response_model=s.AdminLeadDetail)
def get_lead(lead_id: int, user: User = Admin, db: Session = Depends(get_db)):
    return s.lead_detail(policy.get_lead_for(db, user, lead_id))


@router.get("/leads/{lead_id}/documents", response_model=Page[DocumentOut])
def list_lead_documents(
    lead_id: int,
    user: User = Admin,
    params: PageParams = Depends(page_params),
    db: Session = Depends(get_db),
):
    lead = policy.get_lead_for(db, user, lead_id)
    items, total = paginate(db, documents_stmt(lead.id), params)
    return page_body(items, total, params)


@router.get("/leads/{lead_id}/history", response_model=Page[AuditEventOut])
def lead_history(
    lead_id: int,
    user: User = Admin,
    params: PageParams = Depends(page_params),
    db: Session = Depends(get_db),
):
    lead = policy.get_lead_for(db, user, lead_id)
    items, total = paginate(db, history_stmt(lead.id, lead.case.id if lead.case else None), params)
    return page_body(items, total, params)


@router.post("/leads/{lead_id}/assign", response_model=s.AdminLeadDetail)
def assign_lead(lead_id: int, body: s.AssignIn, user: User = Admin, db: Session = Depends(get_db)):
    return s.lead_detail(leads.admin_assign(db, user, lead_id, body.firm_id, body.reason))


# --- Cases ---


@router.get("/cases", response_model=Page[s.AdminCaseOut])
def search_cases(
    q: str | None = Query(None, max_length=200),
    status_: list[CaseStatus] | None = Query(None, alias="status"),
    firm_id: int | None = None,
    category: Category | None = None,
    region: Region | None = None,
    user: User = Admin,
    params: PageParams = Depends(page_params),
    db: Session = Depends(get_db),
):
    stmt = select(Case).join(Case.lead).options(contains_eager(Case.lead), selectinload(Case.firm))
    if status_:
        stmt = stmt.where(Case.status.in_(status_))
    if firm_id is not None:
        stmt = stmt.where(Case.firm_id == firm_id)
    if category:
        stmt = stmt.where(Lead.category == category)
    if region:
        stmt = stmt.where(Lead.region == region)
    if (match := text_search(q, [Lead.name, Lead.email, Lead.description], Case.id)) is not None:
        stmt = stmt.where(match)
    items, total = paginate(db, stmt.order_by(Case.updated_at.desc(), Case.id.desc()), params)
    return page_body([s.case_out(c) for c in items], total, params)


@router.get("/cases/{case_id}", response_model=s.AdminCaseDetail)
def get_case(case_id: int, user: User = Admin, db: Session = Depends(get_db)):
    return s.case_detail(policy.get_case_for(db, user, case_id))


@router.get("/cases/{case_id}/updates", response_model=Page[CaseUpdateOut])
def list_updates(
    case_id: int,
    user: User = Admin,
    params: PageParams = Depends(page_params),
    db: Session = Depends(get_db),
):
    case = policy.get_case_for(db, user, case_id)
    items, total = paginate(db, updates_stmt(case.id), params)
    return page_body(items, total, params)


@router.get("/cases/{case_id}/notes", response_model=Page[s.AdminNoteOut])
def list_notes(
    case_id: int,
    firm_id: int | None = Query(None, description="Only notes authored by this firm"),
    user: User = Admin,
    params: PageParams = Depends(page_params),
    db: Session = Depends(get_db),
):
    case = policy.get_case_for(db, user, case_id)
    stmt = (
        select(Note)
        .where(Note.case_id == case.id)
        .options(selectinload(Note.author), selectinload(Note.author_firm))
        .order_by(Note.created_at.desc(), Note.id.desc())
    )
    if firm_id is not None:
        stmt = stmt.where(Note.author_firm_id == firm_id)
    items, total = paginate(db, policy.scope_notes(stmt, user), params)
    out = [
        s.AdminNoteOut(
            id=n.id,
            author=UserRef.model_validate(n.author),
            body=n.body,
            created_at=n.created_at,
            author_firm=FirmRef.model_validate(n.author_firm),
            from_previous_firm=n.author_firm_id != case.firm_id,
        )
        for n in items
    ]
    return page_body(out, total, params)


@router.get("/cases/{case_id}/documents", response_model=Page[DocumentOut])
def list_case_documents(
    case_id: int,
    user: User = Admin,
    params: PageParams = Depends(page_params),
    db: Session = Depends(get_db),
):
    case = policy.get_case_for(db, user, case_id)
    items, total = paginate(db, documents_stmt(case.lead_id), params)
    return page_body(items, total, params)


@router.get("/cases/{case_id}/history", response_model=Page[AuditEventOut])
def case_history(
    case_id: int,
    user: User = Admin,
    params: PageParams = Depends(page_params),
    db: Session = Depends(get_db),
):
    case = policy.get_case_for(db, user, case_id)
    items, total = paginate(db, history_stmt(case.lead_id, case.id), params)
    return page_body(items, total, params)


@router.post("/cases/{case_id}/reassign", response_model=s.AdminCaseDetail)
def reassign_case(case_id: int, body: s.AssignIn, user: User = Admin, db: Session = Depends(get_db)):
    return s.case_detail(cases.admin_reassign(db, user, case_id, body.firm_id, body.reason))


# --- Audit log and firms ---


@router.get("/audit", response_model=Page[AuditEventOut])
def audit_log(
    entity_type: EntityType | None = None,
    entity_id: int | None = None,
    actor_id: int | None = None,
    action: AuditAction | None = None,
    created_from: datetime | None = None,
    created_to: datetime | None = None,
    user: User = Admin,
    params: PageParams = Depends(page_params),
    db: Session = Depends(get_db),
):
    stmt = select(AuditEvent).options(selectinload(AuditEvent.actor))
    if entity_type:
        stmt = stmt.where(AuditEvent.entity_type == entity_type)
    if entity_id is not None:
        stmt = stmt.where(AuditEvent.entity_id == entity_id)
    if actor_id is not None:
        stmt = stmt.where(AuditEvent.actor_id == actor_id)
    if action:
        stmt = stmt.where(AuditEvent.action == action)
    if created_from:
        stmt = stmt.where(AuditEvent.created_at >= created_from)
    if created_to:
        stmt = stmt.where(AuditEvent.created_at < created_to)
    stmt = stmt.order_by(AuditEvent.created_at.desc(), AuditEvent.id.desc())
    items, total = paginate(db, stmt, params)
    return page_body(items, total, params)


@router.get("/firms", response_model=list[s.FirmOut])
def list_firms(user: User = Admin, db: Session = Depends(get_db)):
    return db.scalars(select(Firm).order_by(Firm.name)).all()
