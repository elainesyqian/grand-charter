"""/api/firm  -- require_role(staff); every query scoped by policy to firm_id = my firm.

GET  /leads                       Page[InboxLeadOut]; filters: status (default assigned),
                                  category, region, q (name/email/description), date range.
GET  /leads/{lead_id}             FirmLeadDetail; 404 if not currently assigned to my firm.
POST /leads/{lead_id}/accept      -> FirmCaseDetail (201); 409 if no longer `assigned` to my firm.
POST /leads/{lead_id}/decline     DeclineIn -> 204; 409 if no longer `assigned` to my firm.
GET  /cases                       Page[FirmCaseSummary]; filters: status, q.
GET  /cases/{case_id}             FirmCaseDetail (notes = my firm's only).
POST /cases/{case_id}/updates     CaseUpdateIn -> CaseUpdateOut (201); 400 bad transition,
                                  409 if closed.
GET  /cases/{case_id}/notes       Page[NoteOut] (my firm's only).
POST /cases/{case_id}/notes       NoteIn -> NoteOut (201).
POST /cases/{case_id}/documents   multipart file -> DocumentOut (201); 409 if closed.
"""
