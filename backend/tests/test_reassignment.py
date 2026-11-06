"""Case reassignment: access moves, documents follow, notes stay with their authoring firm."""

import json

from tests.conftest import firm_id, lead_by_description, login, pdf_file


def reassign(db, case_id, to_prefix, reason="Move"):
    return login("admin@demo").post(
        f"/api/admin/cases/{case_id}/reassign", json={"firm_id": firm_id(db, to_prefix), "reason": reason}
    )


def test_reassign_moves_access_documents_but_not_notes(db):
    lead = lead_by_description(db, "wet floor")  # Firm A case with a plaintiff document
    case_id = lead.case.id
    a = login("attorney.a@demo")
    a.post(f"/api/firm/cases/{case_id}/notes", json={"body": "A-only strategy note"})
    a.post(f"/api/firm/cases/{case_id}/documents", files=pdf_file("a-upload.pdf"))

    assert reassign(db, case_id, "Chetham", "Conflict check failed").status_code == 200

    # Old firm: everything gone, including the documents.
    assert a.get(f"/api/firm/cases/{case_id}").status_code == 404
    assert a.get(f"/api/firm/leads/{lead.id}").status_code == 404
    docs_admin = login("admin@demo").get(f"/api/admin/cases/{case_id}/documents").json()["items"]
    for doc in docs_admin:
        assert a.get(f"/api/documents/{doc['id']}").status_code == 404

    # New firm: case, updates, ALL documents (plaintiff's and Firm A's), none of A's notes.
    c = login("attorney.c@demo")
    assert c.get(f"/api/firm/cases/{case_id}").status_code == 200
    docs = c.get(f"/api/firm/cases/{case_id}/documents").json()["items"]
    assert {d["filename"] for d in docs} == {"photos-of-scene.pdf", "a-upload.pdf"}
    assert c.get(f"/api/documents/{docs[0]['id']}").status_code == 200
    assert c.get(f"/api/firm/cases/{case_id}/updates").json()["total"] >= 1
    assert c.get(f"/api/firm/cases/{case_id}/notes").json()["total"] == 0
    assert c.get(f"/api/firm/cases/{case_id}").status_code == 200

    # Admin sees notes from both firms, labelled; plaintiff sees none.
    c.post(f"/api/firm/cases/{case_id}/notes", json={"body": "C note"})
    notes = login("admin@demo").get(f"/api/admin/cases/{case_id}/notes").json()["items"]
    by_body = {n["body"]: n for n in notes}
    assert by_body["A-only strategy note"]["author_firm"]["name"].startswith("Alley")
    assert by_body["A-only strategy note"]["from_previous_firm"] is True
    assert by_body["C note"]["from_previous_firm"] is False
    plaintiff_view = json.dumps(login("plaintiff2@demo").get(f"/api/plaintiff/leads/{lead.id}").json())
    assert "A-only strategy note" not in plaintiff_view


def test_reassignment_is_audited(db):
    case_id = lead_by_description(db, "wet floor").case.id
    reassign(db, case_id, "Chetham", "Conflict check failed")
    history = login("admin@demo").get(f"/api/admin/cases/{case_id}/history").json()["items"]
    event = next(e for e in history if e["action"] == "case.reassigned")
    assert event["actor"]["name"] == "Mr. Goose"
    assert event["before"] == {"firm_id": firm_id(db, "Alley")}
    assert event["after"] == {"firm_id": firm_id(db, "Chetham")}
    assert event["reason"] == "Conflict check failed"
    assert event["created_at"].endswith("+00:00") or event["created_at"].endswith("Z")
    # The combined history also includes the lead's events.
    assert {"lead.created", "lead.routed", "lead.accepted", "case.created"} <= {e["action"] for e in history}


def test_seeded_case_shows_note_ownership_after_reassignment(db):
    case_id = lead_by_description(db, "Rear-ended").case.id  # seeded: A -> B
    b_notes = login("attorney.b@demo").get(f"/api/firm/cases/{case_id}/notes").json()["items"]
    assert [n["body"] for n in b_notes] == ["Picked up from Alley & Deering. Reviewing file."]
    assert login("attorney.a@demo").get(f"/api/firm/cases/{case_id}/notes").status_code == 404


def test_case_round_trip_returns_firms_own_notes(db):
    case_id = lead_by_description(db, "Rear-ended").case.id  # A -> B already
    assert reassign(db, case_id, "Alley").status_code == 200
    a_notes = login("attorney.a@demo").get(f"/api/firm/cases/{case_id}/notes").json()["items"]
    bodies = {n["body"] for n in a_notes}
    assert "Liability looks clear. Insurer is known to lowball; push early." in bodies
    assert "Picked up from Alley & Deering. Reviewing file." not in bodies  # B's note


def test_reassign_rules(db):
    admin = login("admin@demo")
    open_case = lead_by_description(db, "wet floor").case.id
    closed_case = lead_by_description(db, "Unpaid overtime").case.id
    assert reassign(db, open_case, "Alley").status_code == 409  # same firm
    assert reassign(db, closed_case, "Chetham").status_code == 409  # closed is read-only
    assert admin.post(f"/api/admin/cases/{open_case}/reassign", json={"firm_id": 9999}).status_code == 404


def test_lead_and_case_firm_stay_in_sync(db):
    lead = lead_by_description(db, "wet floor")
    reassign(db, lead.case.id, "Chetham")
    db.expire_all()
    assert lead.firm_id == lead.case.firm_id == firm_id(db, "Chetham")
