"""Lead routing: (category, region) -> at most one firm via the seeded RoutingRule table."""

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.enums import Category, Region
from app.models import RoutingRule


def route(db: Session, category: Category, region: Region) -> int | None:
    """Return the firm id for this pair, or None if unmapped. UNIQUE(category, region)
    guarantees at most one match."""
    return db.scalar(
        select(RoutingRule.firm_id).where(RoutingRule.category == category, RoutingRule.region == region)
    )
