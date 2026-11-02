"""/api/firm: every query is scoped by policy to firm_id = my firm."""

from datetime import datetime

from fastapi import APIRouter, Depends, File, Query, Response, UploadFile, status
from sqlalchemy import select
from sqlalchemy.orm import Session, contains_eager, selectinload

from app import policy
from app.db import get_db
from app.deps import PageParams, page_params, require_role, upload_size_guard
from app.enums import CaseStatus, Category, LeadStatus, Region, Role
from app.models import Case, Lead, Note, User
from app.querying import documents_stmt, page_body, paginate, text_search, updates_stmt
from app.schemas import firm as s
from app.schemas.common import CaseUpdateOut, DocumentOut, Page
from app.services import cases, documents, leads

router = APIRouter(prefix="/firm", tags=["firm"])
Staff = Depends(require_role(Role.staff))


# --- Inbox (leads) ---


@router.get("/leads", response_model=Page[s.InboxLeadOut])
def inbox(
    status_: list[LeadStatus] = Query([LeadStatus.assigned], alias="status"),
    category: Category | None = None,
    region: Region | None = None,
    q: str | None = Query(None, max_length=200),
    created_from: datetime | None = None,
    created_to: datetime | None = None,
    user: User = Staff,
    params: PageParams = Depends(page_params),
    db: Session = Depends(get_db),
):
    stmt = select(Lead).where(Lead.status.in_(status_))
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
    stmt = policy.scope_leads(stmt.order_by(Lead.created_at.desc(), Lead.id.desc()), user)
    items, total = paginate(db, stmt, params)
    return page_body(items, total, params)


@router.get("/leads/{lead_id}", response_model=s.FirmLeadDetail)
def get_lead(lead_id: int, user: User = Staff, db: Session = Depends(get_db)):
    return s.lead_detail(policy.get_lead_for(db, user, lead_id))


@router.get("/leads/{lead_id}/documents", response_model=Page[DocumentOut])
def list_lead_documents(
    lead_id: int,
    user: User = Staff,
    params: PageParams = Depends(page_params),
    db: Session = Depends(get_db),
):
    lead = policy.get_lead_for(db, user, lead_id)
    items, total = paginate(db, documents_stmt(lead.id), params)
    return page_body(items, total, params)


@router.post("/leads/{lead_id}/accept", response_model=s.FirmCaseDetail, status_code=status.HTTP_201_CREATED)
def accept_lead(lead_id: int, user: User = Staff, db: Session = Depends(get_db)):
    return s.case_detail(leads.accept(db, user, lead_id))


@router.post("/leads/{lead_id}/decline", status_code=status.HTTP_204_NO_CONTENT)
def decline_lead(lead_id: int, body: s.DeclineIn, user: User = Staff, db: Session = Depends(get_db)):
    leads.decline(db, user, lead_id, body.reason)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# --- Cases ---


@router.get("/cases", response_model=Page[s.FirmCaseSummary])
def list_cases(
    status_: list[CaseStatus] | None = Query(None, alias="status"),
    category: Category | None = None,
    region: Region | None = None,
    q: str | None = Query(None, max_length=200),
    user: User = Staff,
    params: PageParams = Depends(page_params),
    db: Session = Depends(get_db),
):
    stmt = select(Case).join(Case.lead).options(contains_eager(Case.lead))
    if status_:
        stmt = stmt.where(Case.status.in_(status_))
    if category:
        stmt = stmt.where(Lead.category == category)
    if region:
        stmt = stmt.where(Lead.region == region)
    if (match := text_search(q, [Lead.name, Lead.email, Lead.description], Case.id)) is not None:
        stmt = stmt.where(match)
    stmt = policy.scope_cases(stmt.order_by(Case.updated_at.desc(), Case.id.desc()), user)
    items, total = paginate(db, stmt, params)
    return page_body([s.case_summary(c) for c in items], total, params)


@router.get("/cases/{case_id}", response_model=s.FirmCaseDetail)
def get_case(case_id: int, user: User = Staff, db: Session = Depends(get_db)):
    return s.case_detail(policy.get_case_for(db, user, case_id))


@router.get("/cases/{case_id}/updates", response_model=Page[CaseUpdateOut])
def list_updates(
    case_id: int,
    user: User = Staff,
    params: PageParams = Depends(page_params),
    db: Session = Depends(get_db),
):
    case = policy.get_case_for(db, user, case_id)
    items, total = paginate(db, updates_stmt(case.id), params)
    return page_body(items, total, params)


@router.post("/cases/{case_id}/updates", response_model=CaseUpdateOut, status_code=status.HTTP_201_CREATED)
def add_update(case_id: int, body: s.CaseUpdateIn, user: User = Staff, db: Session = Depends(get_db)):
    return cases.add_update(db, user, case_id, body.to_status, body.message)


@router.get("/cases/{case_id}/notes", response_model=Page[s.NoteOut])
def list_notes(
    case_id: int,
    user: User = Staff,
    params: PageParams = Depends(page_params),
    db: Session = Depends(get_db),
):
    case = policy.get_case_for(db, user, case_id)
    stmt = (
        select(Note)
        .where(Note.case_id == case.id)
        .options(selectinload(Note.author))
        .order_by(Note.created_at.desc(), Note.id.desc())
    )
    items, total = paginate(db, policy.scope_notes(stmt, user), params)
    return page_body(items, total, params)


@router.post("/cases/{case_id}/notes", response_model=s.NoteOut, status_code=status.HTTP_201_CREATED)
def add_note(case_id: int, body: s.NoteIn, user: User = Staff, db: Session = Depends(get_db)):
    return cases.add_note(db, user, case_id, body.body)


@router.get("/cases/{case_id}/documents", response_model=Page[DocumentOut])
def list_case_documents(
    case_id: int,
    user: User = Staff,
    params: PageParams = Depends(page_params),
    db: Session = Depends(get_db),
):
    case = policy.get_case_for(db, user, case_id)
    items, total = paginate(db, documents_stmt(case.lead_id), params)
    return page_body(items, total, params)


@router.post(
    "/cases/{case_id}/documents",
    response_model=DocumentOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(upload_size_guard)],
)
def upload_case_document(
    case_id: int, file: UploadFile = File(...), user: User = Staff, db: Session = Depends(get_db)
):
    case = policy.get_case_for(db, user, case_id)
    return documents.upload(db, user, case.lead, file.filename or "", file.file)
