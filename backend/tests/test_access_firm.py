"""Firm isolation."""

from tests.conftest import lead_by_description, login


def test_inbox_only_lists_my_firms_leads(db):
    items = login("attorney.a@demo").get("/api/firm/leads").json()["items"]
    ids = {lead["id"] for lead in items}
    assert lead_by_description(db, "Let go two weeks").id in ids
    assert lead_by_description(db, "security deposit").id not in ids  # Firm C's
    assert all(lead["status"] == "assigned" for lead in items)


def test_inbox_filters(db):
    client = login("attorney.a@demo")
    assert client.get("/api/firm/leads", params={"category": "family"}).json()["total"] == 0
    assert client.get("/api/firm/leads", params={"q": "safety"}).json()["total"] == 1
    assert client.get("/api/firm/leads", params={"q": "%"}).json()["total"] == 0  # wildcard escaped
    accepted = client.get("/api/firm/leads", params={"status": "accepted"}).json()
    assert {lead["status"] for lead in accepted["items"]} == {"accepted"}


def test_firm_cannot_reach_other_firms_records(db):
    client = login("attorney.b@demo")
    a_lead = lead_by_description(db, "Let go two weeks")
    a_case_lead = lead_by_description(db, "wet floor")
    assert client.get(f"/api/firm/leads/{a_lead.id}").status_code == 404
    assert client.post(f"/api/firm/leads/{a_lead.id}/accept").status_code == 404
    case_id = a_case_lead.case.id
    for path in ("", "/updates", "/notes", "/documents"):
        assert client.get(f"/api/firm/cases/{case_id}{path}").status_code == 404
    assert client.post(f"/api/firm/cases/{case_id}/notes", json={"body": "hi"}).status_code == 404
    assert case_id not in {c["id"] for c in client.get("/api/firm/cases").json()["items"]}


def test_staff_blocked_from_admin_and_plaintiff_routes():
    client = login("paralegal.a@demo")
    assert client.get("/api/admin/leads").status_code == 403
    assert client.get("/api/plaintiff/leads").status_code == 403


def test_attorney_and_paralegal_share_firm_access(db):
    case_id = lead_by_description(db, "wet floor").case.id
    for email in ("attorney.a@demo", "paralegal.a@demo"):
        assert login(email).get(f"/api/firm/cases/{case_id}").status_code == 200
