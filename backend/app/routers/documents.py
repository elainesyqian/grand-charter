"""/api/documents: download for any signed-in role, after a policy check."""

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app import policy, storage
from app.db import get_db
from app.deps import get_current_user
from app.models import User

router = APIRouter(prefix="/documents", tags=["documents"])


@router.get("/{document_id}")
def download(document_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    doc = policy.get_document_for(db, user, document_id)
    try:
        path = storage.open_file(doc.storage_key)
    except FileNotFoundError:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "File is missing from storage")
    return FileResponse(
        path,
        media_type="application/pdf",
        filename=doc.filename,  # Starlette encodes this safely (RFC 5987)
        content_disposition_type="inline",
        headers={"X-Content-Type-Options": "nosniff", "Cache-Control": "private, no-store"},
    )
