"""Accept / decline / admin assignment rules."""

from sqlalchemy import func, select

from app.models import Case
from tests.conftest import firm_id, lead_by_description, login


def test_accept_creates_exactly_one_case(db):
    lead = lead_by_description(db, "Let go two weeks")
    client = login("attorney.a@demo")
    res = client.post(f"/api/firm/leads/{lead.id}/accept")
    assert res.status_code == 201
    assert res.json()["status"] == "open"

    # A second accept (double click, or a colleague) conflicts instead of making another case.
    assert login("paralegal.a@demo").post(f"/api/firm/leads/{lead.id}/accept").status_code == 409
    assert db.scalar(select(func.count()).select_from(Case).where(Case.lead_id == lead.id)) == 1

    # Plaintiff now sees it as accepted, with the firm.
    view = login("plaintiff1@demo").get(f"/api/plaintiff/leads/{lead.id}").json()
    assert view["display_status"] == "accepted"
    assert view["case_status"] == "open"
    assert view["firm"]["name"].startswith("Alley")
    assert view["case_id"] == lead.id


def test_case_number_is_the_lead_number(db):
    """One number per matter: lead #N becomes case #N, and it survives reassignment."""
    for case in db.scalars(select(Case)):
        assert case.id == case.lead_id
    lead = lead_by_description(db, "Let go two weeks")
    case = login("attorney.a@demo").post(f"/api/firm/leads/{lead.id}/accept").json()
    assert case["id"] == lead.id
    res = login("admin@demo").post(
        f"/api/admin/cases/{case['id']}/reassign", json={"firm_id": firm_id(db, "Hayes & Teale")}
    )
    assert res.status_code == 200
    assert res.json()["id"] == lead.id


def test_decline_requires_reason_and_removes_access(db):
    lead = lead_by_description(db, "Let go two weeks")
    client = login("attorney.a@demo")
    assert client.post(f"/api/firm/leads/{lead.id}/decline", json={"reason": "  "}).status_code == 422
    assert client.post(f"/api/firm/leads/{lead.id}/decline", json={"reason": "Conflict"}).status_code == 204

    assert client.get(f"/api/firm/leads/{lead.id}").status_code == 404
    assert client.post(f"/api/firm/leads/{lead.id}/accept").status_code == 404

    admin = login("admin@demo").get(f"/api/admin/leads/{lead.id}").json()
    assert admin["status"] == "declined"
    assert admin["firm"] is None
    assert admin["declines"][0]["reason"] == "Conflict"
    assert admin["declines"][0]["firm"]["name"].startswith("Alley")

    # Plaintiff isn't told about the decline.
    view = login("plaintiff1@demo").get(f"/api/plaintiff/leads/{lead.id}").json()
    assert view["display_status"] == "under_review"
    assert "declines" not in view


def test_decline_after_accept_conflicts(db):
    lead = lead_by_description(db, "Let go two weeks")
    client = login("attorney.a@demo")
    client.post(f"/api/firm/leads/{lead.id}/accept")
    assert client.post(f"/api/firm/leads/{lead.id}/decline", json={"reason": "x"}).status_code == 409


def test_admin_assigns_unassigned_and_declined_leads(db):
    admin = login("admin@demo")
    firm_c = firm_id(db, "Chetham")
    unassigned = lead_by_description(db, "misdemeanor")
    declined = lead_by_description(db, "custody")

    for lead in (unassigned, declined):
        res = admin.post(f"/api/admin/leads/{lead.id}/assign", json={"firm_id": firm_c, "reason": "Fit"})
        assert res.status_code == 200, res.text
        assert res.json()["status"] == "assigned"
        assert res.json()["firm"]["id"] == firm_c

    inbox = login("attorney.c@demo").get("/api/firm/leads").json()
    assert {unassigned.id, declined.id} <= {lead["id"] for lead in inbox["items"]}


def test_admin_reassigns_pending_lead_and_old_firm_loses_access(db):
    lead = lead_by_description(db, "Let go two weeks")  # pending at Firm A
    res = login("admin@demo").post(
        f"/api/admin/leads/{lead.id}/assign", json={"firm_id": firm_id(db, "Chetham")}
    )
    assert res.status_code == 200
    assert login("attorney.a@demo").get(f"/api/firm/leads/{lead.id}").status_code == 404
    assert login("attorney.c@demo").get(f"/api/firm/leads/{lead.id}").status_code == 200


def test_admin_assign_rules(db):
    admin = login("admin@demo")
    accepted = lead_by_description(db, "wet floor")
    pending = lead_by_description(db, "Let go two weeks")
    firm_b = firm_id(db, "Hayes & Teale")

    # Accepted leads move via case reassignment, so lead/case firms stay in sync.
    assert admin.post(f"/api/admin/leads/{accepted.id}/assign", json={"firm_id": firm_b}).status_code == 409
    # Same firm is a no-op conflict.
    assert (
        admin.post(
            f"/api/admin/leads/{pending.id}/assign", json={"firm_id": firm_id(db, "Alley")}
        ).status_code
        == 409
    )
    # Unknown firm / lead.
    assert admin.post(f"/api/admin/leads/{pending.id}/assign", json={"firm_id": 9999}).status_code == 404
    assert admin.post("/api/admin/leads/9999/assign", json={"firm_id": firm_b}).status_code == 404


def test_admin_can_assign_back_to_firm_that_declined(db):
    lead = lead_by_description(db, "custody")  # declined by Firm B
    res = login("admin@demo").post(
        f"/api/admin/leads/{lead.id}/assign",
        json={"firm_id": firm_id(db, "Hayes & Teale"), "reason": "Capacity freed"},
    )
    assert res.status_code == 200
    assert len(res.json()["declines"]) == 1  # earlier decline stays visible


def test_admin_search_includes_latest_decline(db):
    items = login("admin@demo").get("/api/admin/leads", params={"status": "declined"}).json()["items"]
    declined = next(i for i in items if i["id"] == lead_by_description(db, "custody").id)
    assert declined["latest_decline"]["firm"]["name"].startswith("Hayes & Teale")
    assert declined["latest_decline"]["reason"].startswith("At capacity")
    pending = login("admin@demo").get("/api/admin/leads", params={"status": "assigned"}).json()["items"]
    assert all(i["latest_decline"] is None for i in pending)
