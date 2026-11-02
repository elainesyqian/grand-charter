"""Pagination, search, and the sub-collection listings shared by the role routers."""

from typing import Any

from sqlalchemy import ColumnElement, Select, and_, func, or_, select
from sqlalchemy.orm import InstrumentedAttribute, Session, selectinload

from app.deps import PageParams
from app.enums import EntityType
from app.models import AuditEvent, CaseUpdate, Document


def paginate(db: Session, stmt: Select, params: PageParams) -> tuple[list[Any], int]:
    """Run `stmt` for one page and count the full result. `stmt` must already be ordered."""
    total = db.scalar(select(func.count()).select_from(stmt.order_by(None).subquery())) or 0
    items = list(db.scalars(stmt.limit(params.page_size).offset(params.offset)).unique())
    return items, total


def page_body(items: list[Any], total: int, params: PageParams) -> dict[str, Any]:
    return {"items": items, "total": total, "page": params.page, "page_size": params.page_size}


def _escape_like(term: str) -> str:
    return term.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


def text_search(
    q: str | None, columns: list[InstrumentedAttribute], id_column: InstrumentedAttribute
) -> ColumnElement[bool] | None:
    """Case-insensitive substring match over `columns`; a numeric term also matches the id."""
    if not q or not q.strip():
        return None
    term = q.strip()
    pattern = f"%{_escape_like(term)}%"
    clauses = [col.ilike(pattern, escape="\\") for col in columns]
    if term.isdigit():
        clauses.append(id_column == int(term))
    return or_(*clauses)


# Sub-collections. Callers must check access to the parent lead/case first.


def documents_stmt(lead_id: int) -> Select:
    return (
        select(Document)
        .where(Document.lead_id == lead_id)
        .options(selectinload(Document.uploader_firm))
        .order_by(Document.created_at.desc(), Document.id.desc())
    )


def updates_stmt(case_id: int) -> Select:
    return (
        select(CaseUpdate)
        .where(CaseUpdate.case_id == case_id)
        .options(selectinload(CaseUpdate.author))
        .order_by(CaseUpdate.created_at.desc(), CaseUpdate.id.desc())
    )


def history_stmt(lead_id: int, case_id: int | None) -> Select:
    """Audit events for a lead and, if one exists, its case: one combined timeline."""
    entity = and_(AuditEvent.entity_type == EntityType.lead, AuditEvent.entity_id == lead_id)
    if case_id is not None:
        entity = or_(entity, and_(AuditEvent.entity_type == EntityType.case, AuditEvent.entity_id == case_id))
    return (
        select(AuditEvent)
        .where(entity)
        .options(selectinload(AuditEvent.actor))
        .order_by(AuditEvent.created_at.desc(), AuditEvent.id.desc())
    )
