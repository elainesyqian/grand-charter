"""File storage interface. Local disk now; an S3 implementation would keep the same functions.

User-supplied filenames are display-only and never touch the filesystem path.
"""

import os
import uuid
from pathlib import Path
from typing import BinaryIO

from app.config import settings
from app.errors import InvalidRequest, PayloadTooLarge

PDF_MAGIC = b"%PDF-"
CHUNK = 64 * 1024


def _path(storage_key: str) -> Path:
    # Keys are generated here (uuid hex), but validate anyway before building a path.
    if not storage_key.isalnum():
        raise ValueError("bad storage key")
    return Path(settings.storage_dir) / f"{storage_key}.pdf"


def save_pdf(stream: BinaryIO, max_bytes: int) -> tuple[str, int]:
    """Copy a PDF stream to storage. Returns (storage_key, size_bytes)."""
    head = stream.read(len(PDF_MAGIC))
    if not head:
        raise InvalidRequest("File is empty")
    if head != PDF_MAGIC:
        raise InvalidRequest("File is not a PDF")

    Path(settings.storage_dir).mkdir(parents=True, exist_ok=True)
    key = uuid.uuid4().hex
    final = _path(key)
    tmp = final.with_suffix(".part")
    size = len(head)
    try:
        with open(tmp, "wb") as out:
            out.write(head)
            while chunk := stream.read(CHUNK):
                size += len(chunk)
                if size > max_bytes:
                    raise PayloadTooLarge(f"File exceeds {max_bytes // (1024 * 1024)} MB limit")
                out.write(chunk)
        os.replace(tmp, final)
    except BaseException:
        tmp.unlink(missing_ok=True)
        raise
    return key, size


def open_file(storage_key: str) -> Path:
    path = _path(storage_key)
    if not path.is_file():
        raise FileNotFoundError(storage_key)
    return path


def delete(storage_key: str) -> None:
    _path(storage_key).unlink(missing_ok=True)
