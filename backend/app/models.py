"""SQLAlchemy tables. All timestamps UTC.

Firm         id, name
User         id, email (unique), name, role, firm_id? (required iff role=staff), password_hash
RoutingRule  id, category, region, firm_id           UNIQUE(category, region)
Lead         id, plaintiff_id, name, email, region, category, description, status,
             firm_id?, created_at, updated_at
             idx (firm_id, status, created_at), (plaintiff_id), (status, created_at)
LeadDecline  id, lead_id, firm_id, user_id, reason, created_at      idx (lead_id)
Case         id, lead_id (UNIQUE), firm_id, status, created_at, updated_at
             idx (firm_id, status)
CaseUpdate   id, case_id, author_id, from_status?, to_status?, message?, created_at
             idx (case_id, created_at)    -- plaintiff-visible timeline
Note         id, case_id, author_firm_id, author_user_id, body, created_at
             idx (case_id, author_firm_id, created_at)    -- firm-private
Document     id, lead_id, uploaded_by, uploader_role, uploader_firm_id?, filename,
             storage_key (uuid), size_bytes, created_at    idx (lead_id, created_at)
AuditEvent   id, actor_id? (NULL = system), entity_type, entity_id, action,
             before (JSON), after (JSON), reason?, created_at
             idx (entity_type, entity_id, created_at)    -- append-only

Invariant: when a Case exists, lead.firm_id == case.firm_id (services update both together).
"""
