"""Case state changes. Each function = one transaction, includes its audit events.

add_update(db, staff, case_id, to_status?, message?)
        validates transition (closed is terminal; same status = no status change);
        writes CaseUpdate; if status changed -> case.status_changed audit.
add_note(db, staff, case_id, body)
        Note with author_firm_id = staff.firm_id. Not audited (content, not status).
admin_reassign(db, admin, case_id, firm_id, reason)
        rejects closed / same firm; sets case.firm_id AND lead.firm_id together;
        case.reassigned audit. Notes, documents and updates are untouched: notes keep
        author_firm_id (so the new firm can't see them); documents/updates follow the case.
"""
