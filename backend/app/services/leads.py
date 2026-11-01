"""Lead state changes. Each function = one transaction, includes its audit events.

Concurrency: state changes use a conditional UPDATE (compare-and-set on expected status and
firm_id); 0 rows updated -> Conflict (409). Covers double-accept, accept vs decline, and
accept vs admin reassign races.

submit(db, plaintiff, data)        create lead (lead.created); route -> assigned (lead.routed)
                                   or unassigned (lead.unmatched).
accept(db, staff, lead_id)         assigned & firm_id=mine -> accepted; create Case (open)
                                   (lead.accepted, case.created). UNIQUE(case.lead_id) backstop.
decline(db, staff, lead_id, reason) assigned & firm_id=mine -> declined; firm_id=NULL;
                                   insert LeadDecline (lead.declined).
admin_assign(db, admin, lead_id, firm_id, reason)
                                   from unassigned|declined|assigned(other firm) -> assigned to
                                   firm_id (lead.assigned with before/after firm). Rejects accepted.
"""
