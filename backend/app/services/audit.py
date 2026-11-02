"""Audit log writer.

Events are added to the caller's session and never committed here, so each event is
committed or rolled back together with the change it describes.
"""

from typing import Any

from sqlalchemy.orm import Session

from app.enums import AuditAction, EntityType
from app.models import AuditEvent, User


def record(
    db: Session,
    actor: User | None,
    entity_type: EntityType,
    entity_id: int,
    action: AuditAction,
    before: dict[str, Any] | None = None,
    after: dict[str, Any] | None = None,
    reason: str | None = None,
) -> AuditEvent:
    """actor=None means the system (e.g. automatic routing)."""
    event = AuditEvent(
        actor_id=actor.id if actor else None,
        entity_type=entity_type,
        entity_id=entity_id,
        action=action,
        before=before,
        after=after,
        reason=reason,
    )
    db.add(event)
    return event
