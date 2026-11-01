"""Firm-staff schemas.

- InboxLeadOut  { id, name, category, region, status, created_at }
- FirmLeadDetail { ...lead fields, description, email, documents }
- DeclineIn { reason (required, non-empty) }
- FirmCaseSummary { id, lead_id, plaintiff_name, category, region, status, updated_at }
- FirmCaseDetail  { ...summary, description, updates, documents, notes (own firm only) }
- CaseUpdateIn { to_status?, message? }  -- at least one required
- NoteIn { body (1..10000 chars) }; NoteOut { id, author: UserRef, body, created_at }
"""
