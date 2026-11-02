"""Case progress updates and their audit trail."""

from tests.conftest import lead_by_description, login


def case_id(db, fragment):
    return lead_by_description(db, fragment).case.id


def test_status_change_is_recorded_and_visible_to_plaintiff(db):
    cid = case_id(db, "wet floor")
    res = login("attorney.a@demo").post(
        f"/api/firm/cases/{cid}/updates", json={"to_status": "in_progress", "message": "Demand letter sent."}
    )
    assert res.status_code == 201
    assert res.json()["from_status"] == "open"
    assert res.json()["to_status"] == "in_progress"

    lead = lead_by_description(db, "wet floor")
    plaintiff = login("plaintiff2@demo")
    assert plaintiff.get(f"/api/plaintiff/leads/{lead.id}").json()["case_status"] == "in_progress"
    messages = [
        u["message"] for u in plaintiff.get(f"/api/plaintiff/leads/{lead.id}/updates").json()["items"]
    ]
    assert messages[0] == "Demand letter sent."

    history = login("admin@demo").get(f"/api/admin/cases/{cid}/history").json()["items"]
    changed = next(e for e in history if e["action"] == "case.status_changed")
    assert changed["before"] == {"status": "open"} and changed["after"] == {"status": "in_progress"}
    assert changed["actor"]["name"] == "Alex Alder"


def test_message_only_update_is_not_audited_as_status_change(db):
    cid = case_id(db, "wet floor")
    client = login("paralegal.a@demo")
    res = client.post(f"/api/firm/cases/{cid}/updates", json={"to_status": "open", "message": "FYI"})
    assert res.status_code == 201
    assert res.json()["to_status"] is None
    history = login("admin@demo").get(f"/api/admin/cases/{cid}/history").json()["items"]
    assert "case.status_changed" not in {e["action"] for e in history}


def test_empty_update_rejected(db):
    cid = case_id(db, "wet floor")
    client = login("attorney.a@demo")
    assert client.post(f"/api/firm/cases/{cid}/updates", json={}).status_code == 422
    assert client.post(f"/api/firm/cases/{cid}/updates", json={"message": "   "}).status_code == 422
    # Same status and no message: nothing to record.
    assert client.post(f"/api/firm/cases/{cid}/updates", json={"to_status": "open"}).status_code == 400


def test_closed_is_terminal(db):
    cid = case_id(db, "Unpaid overtime")
    client = login("attorney.a@demo")
    assert client.post(f"/api/firm/cases/{cid}/updates", json={"to_status": "open"}).status_code == 409
    assert client.post(f"/api/firm/cases/{cid}/updates", json={"message": "hi"}).status_code == 409
    # Internal notes are still allowed on a closed case.
    assert client.post(f"/api/firm/cases/{cid}/notes", json={"body": "Closing memo"}).status_code == 201


def test_bad_status_value_rejected(db):
    cid = case_id(db, "wet floor")
    res = login("attorney.a@demo").post(f"/api/firm/cases/{cid}/updates", json={"to_status": "won"})
    assert res.status_code == 422
