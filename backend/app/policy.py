"""Every access rule, in one place. Routers never hand-roll access checks.

Query scopes (added to SQL WHERE, so hidden rows never leave the DB):
- leads_visible_to(user):  plaintiff -> plaintiff_id = me; staff -> firm_id = my firm; admin -> all
- cases_visible_to(user):  same rules via case.firm_id / lead.plaintiff_id
- notes_visible_to(user, case): staff -> author_firm_id = my firm (and case visible); admin -> all;
  plaintiff -> never

Single-record helpers (raise NotFound, not Forbidden, so existence isn't leaked):
- get_lead_for(user, lead_id), get_case_for(user, case_id), get_document_for(user, doc_id)

Firm access is derived from the CURRENT firm_id only; reassignment/decline revokes it implicitly.
"""
