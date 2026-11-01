"""/api/admin  -- require_role(admin); no scoping.

GET  /leads                       Page[AdminLeadOut]; filters: q, status, firm_id, category,
                                  region, date range. q matching a numeric id also matches id.
GET  /leads/{lead_id}             AdminLeadDetail (declines + history).
POST /leads/{lead_id}/assign      AssignIn -> AdminLeadDetail. Allowed from unassigned, declined,
                                  assigned (to a different firm). 409 if accepted (use case
                                  reassign) or if target == current firm. 404 unknown firm.
GET  /cases                       Page[AdminCaseOut]; filters: q, status, firm_id.
GET  /cases/{case_id}             AdminCaseDetail (all notes, grouped/labelled by firm).
POST /cases/{case_id}/reassign    AssignIn -> AdminCaseDetail. 409 if closed or same firm.
GET  /audit                       Page[AuditEventOut]; filters: entity_type, entity_id,
                                  actor_id, action, date range.
GET  /firms                       list[FirmOut] for assignment dropdowns.
"""
