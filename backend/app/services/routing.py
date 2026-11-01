"""Lead routing.

route(db, lead) -> Firm | None: look up RoutingRule by (lead.category, lead.region).
UNIQUE(category, region) guarantees at most one match. Runs once, at submission.
"""
