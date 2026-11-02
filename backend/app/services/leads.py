"""Lead state changes. Each function is one transaction and includes its audit events.

Concurrency: state changes are compare-and-set UPDATEs on the expected status and firm_id.
If another request changed the lead first, 0 rows match and we raise Conflict (409). This
covers double-accept, accept vs decline, and accept vs admin reassignment.
"""

from dataclasses import dataclass

from sqlalchemy import update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app import policy
from app.db import utcnow
from app.enums import (
    LEAD_ASSIGNABLE_FROM,
    AuditAction,
    CaseStatus,
    Category,
    EntityType,
    LeadStatus,
    Region,
)
from app.errors import Conflict, NotFound
from app.models import Case, Firm, Lead, LeadDecline, User
from app.services import audit, routing


@dataclass
class LeadInput:
    name: str
    email: str
    region: Region
    category: Category
    description: str


def _compare_and_set(
    db: Session, lead: Lead, expected_status: LeadStatus, expected_firm_id: int | None, **values
) -> None:
    firm_match = Lead.firm_id.is_(None) if expected_firm_id is None else Lead.firm_id == expected_firm_id
    result = db.execute(
        update(Lead)
        .where(Lead.id == lead.id, Lead.status == expected_status, firm_match)
        .values(**values, updated_at=utcnow())
        .execution_options(synchronize_session=False)
    )
    if result.rowcount != 1:
        db.rollback()
        raise Conflict("Lead was changed by someone else; reload and try again")
    db.refresh(lead)


def submit(db: Session, plaintiff: User, data: LeadInput) -> Lead:
    lead = Lead(
        plaintiff_id=plaintiff.id,
        name=data.name,
        email=data.email,
        region=data.region,
        category=data.category,
        description=data.description,
        status=LeadStatus.unassigned,
    )
    db.add(lead)
    db.flush()
    audit.record(
        db,
        plaintiff,
        EntityType.lead,
        lead.id,
        AuditAction.lead_created,
        after={"status": lead.status, "category": lead.category, "region": lead.region},
    )

    firm_id = routing.route(db, data.category, data.region)
    if firm_id is None:
        audit.record(db, None, EntityType.lead, lead.id, AuditAction.lead_unmatched)
    else:
        lead.status = LeadStatus.assigned
        lead.firm_id = firm_id
        audit.record(
            db,
            None,
            EntityType.lead,
            lead.id,
            AuditAction.lead_routed,
            before={"status": LeadStatus.unassigned, "firm_id": None},
            after={"status": LeadStatus.assigned, "firm_id": firm_id},
        )
    db.commit()
    return lead


def accept(db: Session, staff: User, lead_id: int) -> Case:
    lead = policy.get_lead_for(db, staff, lead_id)
    if lead.status != LeadStatus.assigned:
        raise Conflict(f"Lead is {lead.status}, not awaiting a decision")

    _compare_and_set(db, lead, LeadStatus.assigned, staff.firm_id, status=LeadStatus.accepted)
    case = Case(lead_id=lead.id, firm_id=staff.firm_id, status=CaseStatus.open)
    db.add(case)
    try:
        db.flush()
    except IntegrityError:  # UNIQUE(case.lead_id) backstop
        db.rollback()
        raise Conflict("Lead already has a case")
    audit.record(
        db,
        staff,
        EntityType.lead,
        lead.id,
        AuditAction.lead_accepted,
        before={"status": LeadStatus.assigned},
        after={"status": LeadStatus.accepted, "case_id": case.id},
    )
    audit.record(
        db,
        staff,
        EntityType.case,
        case.id,
        AuditAction.case_created,
        after={"status": case.status, "firm_id": case.firm_id, "lead_id": lead.id},
    )
    db.commit()
    return case


def decline(db: Session, staff: User, lead_id: int, reason: str) -> Lead:
    lead = policy.get_lead_for(db, staff, lead_id)
    if lead.status != LeadStatus.assigned:
        raise Conflict(f"Lead is {lead.status}, not awaiting a decision")

    _compare_and_set(db, lead, LeadStatus.assigned, staff.firm_id, status=LeadStatus.declined, firm_id=None)
    db.add(LeadDecline(lead_id=lead.id, firm_id=staff.firm_id, user_id=staff.id, reason=reason))
    audit.record(
        db,
        staff,
        EntityType.lead,
        lead.id,
        AuditAction.lead_declined,
        before={"status": LeadStatus.assigned, "firm_id": staff.firm_id},
        after={"status": LeadStatus.declined, "firm_id": None},
        reason=reason,
    )
    db.commit()
    return lead


def admin_assign(db: Session, admin: User, lead_id: int, firm_id: int, reason: str | None) -> Lead:
    lead = policy.get_lead_for(db, admin, lead_id)
    if db.get(Firm, firm_id) is None:
        raise NotFound("Firm not found")
    if lead.status not in LEAD_ASSIGNABLE_FROM:
        raise Conflict("Lead already has a case; reassign the case instead")
    if lead.status == LeadStatus.assigned and lead.firm_id == firm_id:
        raise Conflict("Lead is already assigned to this firm")

    before = {"status": lead.status, "firm_id": lead.firm_id}
    _compare_and_set(db, lead, lead.status, lead.firm_id, status=LeadStatus.assigned, firm_id=firm_id)
    audit.record(
        db,
        admin,
        EntityType.lead,
        lead.id,
        AuditAction.lead_assigned,
        before=before,
        after={"status": LeadStatus.assigned, "firm_id": firm_id},
        reason=reason,
    )
    db.commit()
    return lead
