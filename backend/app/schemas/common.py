"""Shared response shapes.

- Page[T]: { items: list[T], total, page, page_size }
- FirmRef { id, name }, UserRef { id, name, role }
- DocumentOut { id, filename, size_bytes, uploader_role, uploader_firm?, created_at }
- CaseUpdateOut { id, author: UserRef, from_status?, to_status?, message?, created_at }
- AuditEventOut { id, actor?: UserRef, entity_type, entity_id, action, before, after, reason?, created_at }
"""
