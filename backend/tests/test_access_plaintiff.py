"""Plaintiff isolation."""

import json

from tests.conftest import lead_by_description, login, pdf_file


def test_plaintiff_lists_only_own_leads(db):
    mine = login("plaintiff1@demo").get("/api/plaintiff/leads").json()
    own_ids = {lead["id"] for lead in mine["items"]}
    assert mine["total"] == 3
    assert lead_by_description(db, "custody").id not in own_ids


def test_plaintiff_cannot_reach_other_plaintiffs_records(db):
    client = login("plaintiff1@demo")
    other = lead_by_description(db, "wet floor")  # plaintiff2's, with a case and a document
    for path in ("", "/updates", "/documents"):
        assert client.get(f"/api/plaintiff/leads/{other.id}{path}").status_code == 404
    assert client.post(f"/api/plaintiff/leads/{other.id}/documents", files=pdf_file()).status_code == 404

    doc_id = (
        login("plaintiff2@demo").get(f"/api/plaintiff/leads/{other.id}/documents").json()["items"][0]["id"]
    )
    assert client.get(f"/api/documents/{doc_id}").status_code == 404


def test_plaintiff_responses_never_include_notes_or_internal_data(db):
    lead = lead_by_description(db, "Rear-ended")  # has notes from two firms and a decline-free history
    client = login("plaintiff1@demo")
    payloads = [
        client.get("/api/plaintiff/leads").json(),
        client.get(f"/api/plaintiff/leads/{lead.id}").json(),
        client.get(f"/api/plaintiff/leads/{lead.id}/updates").json(),
        client.get(f"/api/plaintiff/leads/{lead.id}/documents").json(),
    ]
    text = json.dumps(payloads)
    for secret in ("Liability looks clear", "Records request sent", "Picked up from Alley"):
        assert secret not in text
    for internal in ('"status": "assigned"', "declines", "audit", "author_firm"):
        assert internal not in text

    # But plaintiff does see the progress timeline.
    updates = payloads[2]["items"]
    assert any(u["message"] == "Hayes & Teale LLP has taken over your case." for u in updates)


def test_plaintiff_blocked_from_firm_and_admin_routes():
    client = login("plaintiff1@demo")
    assert client.get("/api/firm/leads").status_code == 403
    assert client.get("/api/admin/leads").status_code == 403
    assert client.get("/api/admin/audit").status_code == 403


def test_unauthenticated_requests_rejected():
    from fastapi.testclient import TestClient

    from app.main import app

    anon = TestClient(app)
    assert anon.get("/api/plaintiff/leads").status_code == 401
    assert anon.get("/api/documents/1").status_code == 401
    assert anon.get("/api/meta").status_code == 200  # public reference data
