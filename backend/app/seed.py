"""Seed demo data. Run: python -m app.seed [--reset] [--bulk N]

- Firms: Firm A, Firm B (+ more for bulk).
- Users (hardcoded demo passwords): admin@demo, plaintiff1@demo, plaintiff2@demo,
  attorney.a@demo, paralegal.a@demo, attorney.b@demo.
- RoutingRules covering most (category, region) pairs, leaving some UNMAPPED so the
  unassigned flow can be demoed.
- Sample leads in each state: unassigned, assigned, declined, accepted (with case, updates,
  notes from two firms after a reassignment, documents), so every screen has data.
- --bulk N: generate N leads across 100 firms to check the scale targets.
Idempotent unless --reset is passed.
"""
