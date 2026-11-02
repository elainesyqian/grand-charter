"""Every access rule, in one place. Routers never hand-roll access checks.

Firm access is derived from the CURRENT firm_id only, so reassignment and decline revoke it
implicitly. Scopes are added to the SQL WHERE clause, so rows a user can't see never leave
the database. Single-record lookups raise NotFound (not Forbidden) so existence isn't leaked.
"""

from sqlalchemy import Select, false, select
from sqlalchemy.orm import Session

from app.enums import Role
from app.errors import NotFound
from app.models import Case, Document, Lead, Note, User


def scope_leads(stmt: Select, user: User) -> Select:
    """Restrict a statement that selects from Lead."""
    if user.role == Role.admin:
        return stmt
    if user.role == Role.plaintiff:
        return stmt.where(Lead.plaintiff_id == user.id)
    if user.role == Role.staff:
        return stmt.where(Lead.firm_id == user.firm_id)
    return stmt.where(false())


def scope_cases(stmt: Select, user: User) -> Select:
    """Restrict a statement that selects from Case (joined to Lead)."""
    if user.role == Role.admin:
        return stmt
    if user.role == Role.plaintiff:
        return stmt.where(Lead.plaintiff_id == user.id)
    if user.role == Role.staff:
        return stmt.where(Case.firm_id == user.firm_id)
    return stmt.where(false())


def scope_notes(stmt: Select, user: User) -> Select:
    """Restrict a Note statement. Assumes the case itself was already checked for access."""
    if user.role == Role.admin:
        return stmt
    if user.role == Role.staff:
        return stmt.where(Note.author_firm_id == user.firm_id)
    return stmt.where(false())


def get_lead_for(db: Session, user: User, lead_id: int) -> Lead:
    lead = db.scalar(scope_leads(select(Lead).where(Lead.id == lead_id), user))
    if lead is None:
        raise NotFound("Lead not found")
    return lead


def get_case_for(db: Session, user: User, case_id: int) -> Case:
    stmt = select(Case).join(Case.lead).where(Case.id == case_id)
    case = db.scalar(scope_cases(stmt, user))
    if case is None:
        raise NotFound("Case not found")
    return case


def get_document_for(db: Session, user: User, document_id: int) -> Document:
    # A document is visible exactly when its lead is.
    stmt = select(Document).join(Lead, Lead.id == Document.lead_id).where(Document.id == document_id)
    doc = db.scalar(scope_leads(stmt, user))
    if doc is None:
        raise NotFound("Document not found")
    return doc
