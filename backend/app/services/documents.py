"""Document upload.

upload(db, user, lead, file)
- Caller has already loaded `lead` through policy (so access is checked).
- Rejects uploads when the lead's case is closed (409).
- storage.save() first, then insert Document (uploader_role, uploader_firm_id for staff);
  if the DB insert fails, storage.delete() the file so no orphan is left.
"""
