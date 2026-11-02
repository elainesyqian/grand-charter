"""Fixed vocabularies, shared by models, schemas and /api/meta.

- Role: plaintiff | staff | admin
- Region: seeded list (e.g. US states or a handful of regions)
- Category: seeded list (personal_injury, employment, family, immigration, ...)
- LeadStatus: unassigned | assigned | declined | accepted
- CaseStatus: open | in_progress | on_hold | closed
- AuditAction: lead.created, lead.routed, lead.unmatched, lead.assigned, lead.accepted,
  lead.declined, case.created, case.status_changed, case.reassigned
- Allowed transition tables for LeadStatus and CaseStatus (closed is terminal).
"""
