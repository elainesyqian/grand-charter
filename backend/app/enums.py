"""Fixed vocabularies shared by models, schemas, services and /api/meta."""

from enum import StrEnum


class Role(StrEnum):
    plaintiff = "plaintiff"
    staff = "staff"
    admin = "admin"


class Region(StrEnum):
    northeast = "northeast"
    southeast = "southeast"
    midwest = "midwest"
    southwest = "southwest"
    west = "west"


class Category(StrEnum):
    personal_injury = "personal_injury"
    employment = "employment"
    family = "family"
    immigration = "immigration"
    real_estate = "real_estate"
    criminal_defense = "criminal_defense"


class LeadStatus(StrEnum):
    unassigned = "unassigned"
    assigned = "assigned"
    declined = "declined"
    accepted = "accepted"


class CaseStatus(StrEnum):
    open = "open"
    in_progress = "in_progress"
    on_hold = "on_hold"
    closed = "closed"


class EntityType(StrEnum):
    lead = "lead"
    case = "case"


class AuditAction(StrEnum):
    lead_created = "lead.created"
    lead_routed = "lead.routed"
    lead_unmatched = "lead.unmatched"
    lead_assigned = "lead.assigned"
    lead_accepted = "lead.accepted"
    lead_declined = "lead.declined"
    case_created = "case.created"
    case_status_changed = "case.status_changed"
    case_reassigned = "case.reassigned"


# What the plaintiff sees: internal routing states collapse into "under_review".
class PlaintiffLeadStatus(StrEnum):
    under_review = "under_review"
    accepted = "accepted"


# Any open state can move to any other; closed is terminal.
CASE_TRANSITIONS: dict[CaseStatus, frozenset[CaseStatus]] = {
    s: frozenset(CaseStatus) - {s} for s in CaseStatus if s is not CaseStatus.closed
} | {CaseStatus.closed: frozenset()}

# Lead states an admin may (re)assign from. `accepted` is excluded: once a case exists it
# moves through case reassignment so lead.firm_id and case.firm_id stay in sync.
LEAD_ASSIGNABLE_FROM = frozenset({LeadStatus.unassigned, LeadStatus.declined, LeadStatus.assigned})
