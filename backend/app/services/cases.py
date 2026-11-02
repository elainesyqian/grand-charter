"""Case state changes. Each function is one transaction and includes its audit events."""

from sqlalchemy import update
from sqlalchemy.orm import Session

from app import policy
from app.db import utcnow
from app.enums import CASE_TRANSITIONS, AuditAction, CaseStatus, EntityType
from app.errors import Conflict, InvalidRequest, NotFound
from app.models import Case, CaseUpdate, Firm, Lead, Note, User
from app.services import audit


def _ensure_open(case: Case) -> None:
    if case.status == CaseStatus.closed:
        raise Conflict("Case is closed")


def add_update(
    db: Session, staff: User, case_id: int, to_status: CaseStatus | None, message: str | None
) -> CaseUpdate:
    case = policy.get_case_for(db, staff, case_id)
    _ensure_open(case)

    from_status = case.status
    status_changes = to_status is not None and to_status != from_status
    if not status_changes and not message:
        raise InvalidRequest("Nothing to update: status is unchanged and no message given")
    if status_changes and to_status not in CASE_TRANSITIONS[from_status]:
        raise InvalidRequest(f"Cannot move a case from {from_status} to {to_status}")

    if status_changes:
        result = db.execute(
            update(Case)
            .where(Case.id == case.id, Case.status == from_status, Case.firm_id == staff.firm_id)
            .values(status=to_status, updated_at=utcnow())
            .execution_options(synchronize_session=False)
        )
        if result.rowcount != 1:
            db.rollback()
            raise Conflict("Case was changed by someone else; reload and try again")
        db.refresh(case)
        audit.record(
            db,
            staff,
            EntityType.case,
            case.id,
            AuditAction.case_status_changed,
            before={"status": from_status},
            after={"status": to_status},
        )
    else:
        case.updated_at = utcnow()

    entry = CaseUpdate(
        case_id=case.id,
        author_id=staff.id,
        from_status=from_status if status_changes else None,
        to_status=to_status if status_changes else None,
        message=message or None,
    )
    db.add(entry)
    db.commit()
    return entry


def add_note(db: Session, staff: User, case_id: int, body: str) -> Note:
    # Notes are allowed on closed cases (e.g. a closing memo); they are internal records.
    case = policy.get_case_for(db, staff, case_id)
    note = Note(case_id=case.id, author_firm_id=staff.firm_id, author_user_id=staff.id, body=body)
    db.add(note)
    db.commit()
    return note


def admin_reassign(db: Session, admin: User, case_id: int, firm_id: int, reason: str | None) -> Case:
    """Move a case (and its lead) to another firm.

    Notes keep their author_firm_id, so the new firm can't see the old firm's notes.
    Documents and progress updates hang off the lead/case, so they move with it.
    """
    case = policy.get_case_for(db, admin, case_id)
    if db.get(Firm, firm_id) is None:
        raise NotFound("Firm not found")
    _ensure_open(case)
    if case.firm_id == firm_id:
        raise Conflict("Case is already with this firm")

    old_firm_id = case.firm_id
    result = db.execute(
        update(Case)
        .where(Case.id == case.id, Case.firm_id == old_firm_id, Case.status != CaseStatus.closed)
        .values(firm_id=firm_id, updated_at=utcnow())
        .execution_options(synchronize_session=False)
    )
    if result.rowcount != 1:
        db.rollback()
        raise Conflict("Case was changed by someone else; reload and try again")
    db.execute(
        update(Lead)
        .where(Lead.id == case.lead_id)
        .values(firm_id=firm_id, updated_at=utcnow())
        .execution_options(synchronize_session=False)
    )
    audit.record(
        db,
        admin,
        EntityType.case,
        case.id,
        AuditAction.case_reassigned,
        before={"firm_id": old_firm_id},
        after={"firm_id": firm_id},
        reason=reason,
    )
    db.commit()
    db.refresh(case)
    return case
