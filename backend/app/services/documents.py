"""Document upload."""

from typing import BinaryIO

from sqlalchemy.orm import Session

from app import storage
from app.config import settings
from app.enums import CaseStatus, Role
from app.errors import Conflict
from app.models import Document, Lead, User


def upload(db: Session, user: User, lead: Lead, filename: str, stream: BinaryIO) -> Document:
    """Store a PDF on `lead`. The caller must have loaded `lead` through policy."""
    if lead.case is not None and lead.case.status == CaseStatus.closed:
        raise Conflict("Case is closed")

    key, size = storage.save_pdf(stream, settings.max_upload_bytes)
    try:
        doc = Document(
            lead_id=lead.id,
            uploaded_by=user.id,
            uploader_role=user.role,
            uploader_firm_id=user.firm_id if user.role == Role.staff else None,
            filename=_display_name(filename),
            storage_key=key,
            size_bytes=size,
        )
        db.add(doc)
        db.commit()
    except BaseException:
        db.rollback()
        storage.delete(key)  # don't leave an orphaned file behind
        raise
    return doc


def _display_name(filename: str | None) -> str:
    # Keep only the last path segment and printable characters; this is display-only.
    name = (filename or "").replace("\\", "/").rsplit("/", 1)[-1]
    name = "".join(ch for ch in name if ch.isprintable()).strip()[:200]
    if not name:
        name = "document"
    if not name.lower().endswith(".pdf"):
        name += ".pdf"
    return name
