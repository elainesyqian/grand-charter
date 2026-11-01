"""Admin schemas.

- AdminLeadOut    { id, name, email, category, region, status, firm?: FirmRef, created_at }
- AdminLeadDetail { ...lead, description, documents, declines: list[{firm, user, reason, at}],
                    case_id?, history: list[AuditEventOut] }
- AssignIn { firm_id, reason? }
- AdminCaseOut    { id, lead_id, plaintiff_name, category, region, status, firm: FirmRef, updated_at }
- AdminCaseDetail { ...case, updates, documents,
                    notes: list[NoteOut + author_firm: FirmRef] (all firms),
                    history: list[AuditEventOut] }
- FirmOut { id, name }
"""
