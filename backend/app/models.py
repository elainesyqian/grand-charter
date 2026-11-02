"""SQLAlchemy tables. All timestamps are UTC.

Invariant: when a Case exists, lead.firm_id == case.firm_id (services update both together).
"""

from datetime import datetime
from enum import Enum as PyEnum
from typing import Any

from sqlalchemy import JSON, CheckConstraint, Enum, ForeignKey, Index, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base, UTCDateTime, utcnow
from app.enums import AuditAction, CaseStatus, Category, EntityType, LeadStatus, Region, Role


def enum_col(enum_cls: type[PyEnum]) -> Enum:
    # Stored as the enum's string value with a CHECK constraint (portable to Postgres).
    return Enum(
        enum_cls,
        native_enum=False,
        create_constraint=True,
        length=32,
        values_callable=lambda e: [m.value for m in e],
    )


class Firm(Base):
    __tablename__ = "firms"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(200), unique=True)


class User(Base):
    __tablename__ = "users"
    __table_args__ = (
        CheckConstraint(
            "(role = 'staff' AND firm_id IS NOT NULL) OR (role != 'staff' AND firm_id IS NULL)",
            name="ck_users_staff_has_firm",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(254), unique=True)
    name: Mapped[str] = mapped_column(String(200))
    role: Mapped[Role] = mapped_column(enum_col(Role))
    # Attorney vs paralegal is a display title only; both have identical permissions.
    title: Mapped[str | None] = mapped_column(String(50))
    firm_id: Mapped[int | None] = mapped_column(ForeignKey("firms.id"), index=True)
    password_hash: Mapped[str] = mapped_column(String(200))

    firm: Mapped[Firm | None] = relationship()


class RoutingRule(Base):
    __tablename__ = "routing_rules"
    __table_args__ = (UniqueConstraint("category", "region", name="uq_routing_category_region"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    category: Mapped[Category] = mapped_column(enum_col(Category))
    region: Mapped[Region] = mapped_column(enum_col(Region))
    firm_id: Mapped[int] = mapped_column(ForeignKey("firms.id"), index=True)

    firm: Mapped[Firm] = relationship()


class Lead(Base):
    __tablename__ = "leads"
    __table_args__ = (
        Index("ix_leads_firm_status_created", "firm_id", "status", "created_at"),
        Index("ix_leads_status_created", "status", "created_at"),
        Index("ix_leads_created", "created_at"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    plaintiff_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    # Contact details as entered on the form; ownership comes from plaintiff_id only.
    name: Mapped[str] = mapped_column(String(200))
    email: Mapped[str] = mapped_column(String(254))
    region: Mapped[Region] = mapped_column(enum_col(Region))
    category: Mapped[Category] = mapped_column(enum_col(Category))
    description: Mapped[str] = mapped_column(Text)
    status: Mapped[LeadStatus] = mapped_column(enum_col(LeadStatus))
    firm_id: Mapped[int | None] = mapped_column(ForeignKey("firms.id"))
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow, onupdate=utcnow)

    plaintiff: Mapped[User] = relationship()
    firm: Mapped[Firm | None] = relationship()
    case: Mapped["Case | None"] = relationship(back_populates="lead", uselist=False)
    declines: Mapped[list["LeadDecline"]] = relationship(
        order_by="LeadDecline.created_at", back_populates="lead"
    )

    @property
    def latest_decline(self) -> "LeadDecline | None":
        return self.declines[-1] if self.declines else None


class LeadDecline(Base):
    __tablename__ = "lead_declines"

    id: Mapped[int] = mapped_column(primary_key=True)
    lead_id: Mapped[int] = mapped_column(ForeignKey("leads.id"), index=True)
    firm_id: Mapped[int] = mapped_column(ForeignKey("firms.id"))
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    reason: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)

    lead: Mapped[Lead] = relationship(back_populates="declines")
    firm: Mapped[Firm] = relationship()
    user: Mapped[User] = relationship()


class Case(Base):
    __tablename__ = "cases"
    __table_args__ = (Index("ix_cases_firm_status_updated", "firm_id", "status", "updated_at"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    lead_id: Mapped[int] = mapped_column(ForeignKey("leads.id"), unique=True)
    firm_id: Mapped[int] = mapped_column(ForeignKey("firms.id"))
    status: Mapped[CaseStatus] = mapped_column(enum_col(CaseStatus))
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow, onupdate=utcnow)

    lead: Mapped[Lead] = relationship(back_populates="case")
    firm: Mapped[Firm] = relationship()


class CaseUpdate(Base):
    """Progress timeline entry. Visible to the plaintiff."""

    __tablename__ = "case_updates"
    __table_args__ = (Index("ix_case_updates_case_created", "case_id", "created_at"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    case_id: Mapped[int] = mapped_column(ForeignKey("cases.id"))
    author_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    from_status: Mapped[CaseStatus | None] = mapped_column(enum_col(CaseStatus))
    to_status: Mapped[CaseStatus | None] = mapped_column(enum_col(CaseStatus))
    message: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)

    author: Mapped[User] = relationship()


class Note(Base):
    """Firm-private note. Owned by the authoring firm, not by the case's current firm."""

    __tablename__ = "notes"
    __table_args__ = (Index("ix_notes_case_firm_created", "case_id", "author_firm_id", "created_at"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    case_id: Mapped[int] = mapped_column(ForeignKey("cases.id"))
    author_firm_id: Mapped[int] = mapped_column(ForeignKey("firms.id"))
    author_user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    body: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)

    author: Mapped[User] = relationship()
    author_firm: Mapped[Firm] = relationship()


class Document(Base):
    """A PDF attached to a lead (and therefore to its case, through any reassignment)."""

    __tablename__ = "documents"
    __table_args__ = (Index("ix_documents_lead_created", "lead_id", "created_at"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    lead_id: Mapped[int] = mapped_column(ForeignKey("leads.id"))
    uploaded_by: Mapped[int] = mapped_column(ForeignKey("users.id"))
    uploader_role: Mapped[Role] = mapped_column(enum_col(Role))
    uploader_firm_id: Mapped[int | None] = mapped_column(ForeignKey("firms.id"))
    filename: Mapped[str] = mapped_column(String(255))
    storage_key: Mapped[str] = mapped_column(String(64), unique=True)
    size_bytes: Mapped[int]
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)

    uploader: Mapped[User] = relationship()
    uploader_firm: Mapped[Firm | None] = relationship()


class AuditEvent(Base):
    """Append-only history of assignment and status changes."""

    __tablename__ = "audit_events"
    __table_args__ = (
        Index("ix_audit_entity_created", "entity_type", "entity_id", "created_at"),
        Index("ix_audit_created", "created_at"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    actor_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), index=True)  # NULL = system
    entity_type: Mapped[EntityType] = mapped_column(enum_col(EntityType))
    entity_id: Mapped[int]
    action: Mapped[AuditAction] = mapped_column(enum_col(AuditAction))
    before: Mapped[dict[str, Any] | None] = mapped_column(JSON)
    after: Mapped[dict[str, Any] | None] = mapped_column(JSON)
    reason: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)

    actor: Mapped[User | None] = relationship()
