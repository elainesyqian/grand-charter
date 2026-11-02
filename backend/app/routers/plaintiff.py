"""/api/plaintiff: every query is scoped by policy to plaintiff_id = me."""

from fastapi import APIRouter, Depends, File, UploadFile, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app import policy
from app.db import get_db
from app.deps import PageParams, page_params, require_role, upload_size_guard
from app.enums import Role
from app.models import Case, Lead, User
from app.querying import documents_stmt, page_body, paginate, updates_stmt
from app.schemas import plaintiff as s
from app.schemas.common import CaseUpdateOut, DocumentOut, Page
from app.services import documents, leads

router = APIRouter(prefix="/plaintiff", tags=["plaintiff"])
Plaintiff = Depends(require_role(Role.plaintiff))


@router.post("/leads", response_model=s.PlaintiffLeadDetail, status_code=status.HTTP_201_CREATED)
def submit_lead(body: s.LeadCreate, user: User = Plaintiff, db: Session = Depends(get_db)):
    lead = leads.submit(db, user, leads.LeadInput(**body.model_dump()))
    return s.lead_detail(lead)


@router.get("/leads", response_model=Page[s.PlaintiffLeadSummary])
def list_leads(
    user: User = Plaintiff, params: PageParams = Depends(page_params), db: Session = Depends(get_db)
):
    stmt = policy.scope_leads(
        select(Lead).options(selectinload(Lead.case)).order_by(Lead.created_at.desc(), Lead.id.desc()),
        user,
    )
    items, total = paginate(db, stmt, params)
    return page_body([s.lead_summary(lead) for lead in items], total, params)


@router.get("/leads/{lead_id}", response_model=s.PlaintiffLeadDetail)
def get_lead(lead_id: int, user: User = Plaintiff, db: Session = Depends(get_db)):
    return s.lead_detail(policy.get_lead_for(db, user, lead_id))


@router.get("/leads/{lead_id}/updates", response_model=Page[CaseUpdateOut])
def list_updates(
    lead_id: int,
    user: User = Plaintiff,
    params: PageParams = Depends(page_params),
    db: Session = Depends(get_db),
):
    lead = policy.get_lead_for(db, user, lead_id)
    case: Case | None = lead.case
    if case is None:
        return page_body([], 0, params)
    items, total = paginate(db, updates_stmt(case.id), params)
    return page_body(items, total, params)


@router.get("/leads/{lead_id}/documents", response_model=Page[DocumentOut])
def list_documents(
    lead_id: int,
    user: User = Plaintiff,
    params: PageParams = Depends(page_params),
    db: Session = Depends(get_db),
):
    lead = policy.get_lead_for(db, user, lead_id)
    items, total = paginate(db, documents_stmt(lead.id), params)
    return page_body(items, total, params)


@router.post(
    "/leads/{lead_id}/documents",
    response_model=DocumentOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(upload_size_guard)],
)
def upload_document(
    lead_id: int, file: UploadFile = File(...), user: User = Plaintiff, db: Session = Depends(get_db)
):
    lead = policy.get_lead_for(db, user, lead_id)
    return documents.upload(db, user, lead, file.filename or "", file.file)
