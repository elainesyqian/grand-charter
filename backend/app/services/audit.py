"""Audit log writer.

record(db, actor, entity_type, entity_id, action, before, after, reason=None)
- Adds an AuditEvent to the CURRENT session; never commits on its own, so the event is
  committed or rolled back together with the change it describes.
- actor=None means "system" (e.g. automatic routing).
- before/after hold only the changed fields, e.g. {"firm_id": 1, "status": "assigned"}.
"""
