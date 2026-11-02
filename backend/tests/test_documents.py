"""PDF upload validation and download access."""

from pathlib import Path

from app.config import settings
from tests.conftest import lead_by_description, login, pdf_file


def test_plaintiff_uploads_before_acceptance_and_firm_sees_it(db):
    lead = lead_by_description(db, "Let go two weeks")  # pending at Firm A
    res = login("plaintiff1@demo").post(
        f"/api/plaintiff/leads/{lead.id}/documents", files=pdf_file("termination-letter.pdf")
    )
    assert res.status_code == 201
    doc = res.json()
    assert doc["uploader_role"] == "plaintiff"

    docs = login("attorney.a@demo").get(f"/api/firm/leads/{lead.id}/documents").json()["items"]
    assert [d["filename"] for d in docs] == ["termination-letter.pdf"]


def test_non_pdf_rejected_even_with_pdf_name(db):
    lead = lead_by_description(db, "Let go two weeks")
    client = login("plaintiff1@demo")
    res = client.post(
        f"/api/plaintiff/leads/{lead.id}/documents",
        files=pdf_file("evil.pdf", b"<html><script>alert(1)</script>"),
    )
    assert res.status_code == 400
    assert (
        client.post(f"/api/plaintiff/leads/{lead.id}/documents", files=pdf_file("empty.pdf", b"")).status_code
        == 400
    )


def test_oversized_upload_rejected(db, monkeypatch):
    monkeypatch.setattr(settings, "max_upload_mb", 1)
    lead = lead_by_description(db, "Let go two weeks")
    big = b"%PDF-1.4\n" + b"0" * (2 * 1024 * 1024)
    res = login("plaintiff1@demo").post(
        f"/api/plaintiff/leads/{lead.id}/documents", files=pdf_file("big.pdf", big)
    )
    assert res.status_code == 413
    assert not any(
        p.suffix in (".pdf", ".part")
        for p in Path(settings.storage_dir).glob("*")
        if p.stat().st_size > 1024 * 1024
    )


def test_closed_case_rejects_uploads(db):
    lead = lead_by_description(db, "Unpaid overtime")
    assert (
        login("plaintiff2@demo")
        .post(f"/api/plaintiff/leads/{lead.id}/documents", files=pdf_file())
        .status_code
        == 409
    )
    assert (
        login("attorney.a@demo")
        .post(f"/api/firm/cases/{lead.case.id}/documents", files=pdf_file())
        .status_code
        == 409
    )


def test_download_returns_pdf_with_safe_headers(db):
    lead = lead_by_description(db, "Let go two weeks")
    client = login("plaintiff1@demo")
    doc = client.post(f"/api/plaintiff/leads/{lead.id}/documents", files=pdf_file("../../etc/passwd")).json()
    assert doc["filename"] == "passwd.pdf"

    res = client.get(f"/api/documents/{doc['id']}")
    assert res.status_code == 200
    assert res.headers["content-type"] == "application/pdf"
    assert res.headers["x-content-type-options"] == "nosniff"
    assert res.content.startswith(b"%PDF-")

    assert login("admin@demo").get(f"/api/documents/{doc['id']}").status_code == 200
    assert login("attorney.b@demo").get(f"/api/documents/{doc['id']}").status_code == 404
