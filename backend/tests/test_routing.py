"""Routing at submission time."""

from sqlalchemy import select

from app.models import AuditEvent
from tests.conftest import firm_id, login


def submit(client, category, region):
    return client.post(
        "/api/plaintiff/leads",
        json={
            "name": "Jordan Rivera",
            "email": "jordan@example.com",
            "region": region,
            "category": category,
            "description": "Something happened.",
        },
    )


def history(db, lead_id):
    return list(
        db.scalars(
            select(AuditEvent.action)
            .where(AuditEvent.entity_type == "lead", AuditEvent.entity_id == lead_id)
            .order_by(AuditEvent.id)
        )
    )


def test_matched_lead_is_assigned_to_mapped_firm(db):
    res = submit(login("plaintiff1@demo"), "employment", "west")
    assert res.status_code == 201
    body = res.json()
    assert body["display_status"] == "under_review"
    assert body["firm"] is None  # plaintiff doesn't see the routed firm until acceptance

    admin = login("admin@demo").get(f"/api/admin/leads/{body['id']}").json()
    assert admin["status"] == "assigned"
    assert admin["firm"]["id"] == firm_id(db, "Alder")
    assert history(db, body["id"]) == ["lead.created", "lead.routed"]


def test_unmatched_lead_waits_for_admin(db):
    res = submit(login("plaintiff1@demo"), "criminal_defense", "midwest")
    lead_id = res.json()["id"]

    admin = login("admin@demo").get(f"/api/admin/leads/{lead_id}").json()
    assert admin["status"] == "unassigned"
    assert admin["firm"] is None
    assert history(db, lead_id) == ["lead.created", "lead.unmatched"]

    queue = login("admin@demo").get("/api/admin/leads", params={"status": ["unassigned", "declined"]})
    assert lead_id in [lead["id"] for lead in queue.json()["items"]]


def test_routed_lead_appears_in_firm_inbox():
    lead_id = submit(login("plaintiff1@demo"), "employment", "west").json()["id"]
    inbox = login("paralegal.a@demo").get("/api/firm/leads").json()
    assert lead_id in [lead["id"] for lead in inbox["items"]]
    other_inbox = login("attorney.b@demo").get("/api/firm/leads").json()
    assert lead_id not in [lead["id"] for lead in other_inbox["items"]]


def test_invalid_submission_rejected():
    client = login("plaintiff1@demo")
    assert submit(client, "not_a_category", "west").status_code == 422
    res = client.post(
        "/api/plaintiff/leads",
        json={"name": "  ", "email": "nope", "region": "west", "category": "family", "description": "x"},
    )
    assert res.status_code == 422


def test_only_plaintiffs_submit_leads():
    assert submit(login("attorney.a@demo"), "employment", "west").status_code == 403
