"""Plaintiff-facing schemas. Deliberately have NO fields for notes, declines, or audit data.

- LeadCreate { name, email, region (enum), category (enum), description (1..5000 chars) }
- PlaintiffLeadSummary { id, category, region, created_at, display_status, case_status? }
- PlaintiffLeadDetail  { ...summary, description, firm?: FirmRef (only once a case exists),
                         updates: list[CaseUpdateOut], documents: list[DocumentOut] }

display_status hides internal routing: unassigned/assigned/declined -> "under_review";
accepted -> "accepted" (case_status carries progress).
"""
