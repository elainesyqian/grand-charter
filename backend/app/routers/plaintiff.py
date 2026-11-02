"""/api/plaintiff  -- require_role(plaintiff); every query scoped by policy to plaintiff_id = me.

POST /leads                      LeadCreate -> PlaintiffLeadDetail (201)
                                 services.leads.submit: create + route + audit in one transaction.
GET  /leads                      Page[PlaintiffLeadSummary]; newest first.
GET  /leads/{lead_id}            PlaintiffLeadDetail; 404 if not mine.
POST /leads/{lead_id}/documents  multipart file -> DocumentOut (201); 404 if not mine;
                                 409 if the case is closed.
"""
