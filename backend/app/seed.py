"""Seed demo data. Run from backend/:

    python -m app.seed            # demo users, firms, routing rules, sample leads/cases
    python -m app.seed --reset    # wipe the database and stored files first
    python -m app.seed --bulk 100000   # add N synthetic leads across 100 firms (scale check)

Sample data goes through the real services, so audit history looks like real usage.
"""

import argparse
import io
import random
import shutil
import time
from datetime import timedelta
from pathlib import Path

from sqlalchemy import func, insert, select
from sqlalchemy.orm import Session

from app.config import settings
from app.db import Base, SessionLocal, create_tables, engine, utcnow
from app.enums import CaseStatus, Category, LeadStatus, Region, Role
from app.models import Case, Firm, Lead, RoutingRule, User
from app.routers.auth import hash_password
from app.services import cases, documents, leads

DEMO_PASSWORD = "demo123"

FIRMS = {"A": "Alley & Deering LLP", "B": "Hayes & Teale LLP", "C": "Chetham & Tyne LLP"}

# (email, name, role, title, firm key)
USERS = [
    ("admin@demo", "Mr. Goose", Role.admin, None, None),
    ("plaintiff1@demo", "Liam Lester", Role.plaintiff, None, None),
    ("plaintiff2@demo", "Finn Phillip", Role.plaintiff, None, None),
    ("attorney.a@demo", "Ana Deering", Role.staff, "Attorney", "A"),
    ("paralegal.a@demo", "Pat Park", Role.staff, "Paralegal", "A"),
    ("attorney.b@demo", "Becky Teale", Role.staff, "Attorney", "B"),
    ("attorney.c@demo", "Conrad Chetham", Role.staff, "Attorney", "C"),
]

# Firm A: injury + employment (not southwest). Firm B: family + immigration everywhere, and
# injury + employment in the southwest. Firm C: real estate in three regions.
# Left unmapped on purpose: all criminal_defense, real_estate in southeast/southwest.
ROUTING: list[tuple[Category, Region, str]] = (
    [
        (c, r, "A")
        for c in (Category.personal_injury, Category.employment)
        for r in Region
        if r != Region.southwest
    ]
    + [(c, Region.southwest, "B") for c in (Category.personal_injury, Category.employment)]
    + [(c, r, "B") for c in (Category.family, Category.immigration) for r in Region]
    + [(Category.real_estate, r, "C") for r in (Region.northeast, Region.midwest, Region.west)]
)


def tiny_pdf(text: str) -> bytes:
    """A minimal valid one-page PDF showing `text`."""
    content = f"BT /F1 18 Tf 72 720 Td ({text}) Tj ET".encode()
    objs = [
        b"<< /Type /Catalog /Pages 2 0 R >>",
        b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R "
        b"/Resources << /Font << /F1 5 0 R >> >> >>",
        b"<< /Length %d >>\nstream\n%s\nendstream" % (len(content), content),
        b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    ]
    out = io.BytesIO()
    out.write(b"%PDF-1.4\n")
    offsets = []
    for i, obj in enumerate(objs, start=1):
        offsets.append(out.tell())
        out.write(b"%d 0 obj\n%s\nendobj\n" % (i, obj))
    xref = out.tell()
    out.write(b"xref\n0 %d\n0000000000 65535 f \n" % (len(objs) + 1))
    for off in offsets:
        out.write(b"%010d 00000 n \n" % off)
    out.write(b"trailer\n<< /Size %d /Root 1 0 R >>\nstartxref\n%d\n%%%%EOF\n" % (len(objs) + 1, xref))
    return out.getvalue()


def reset() -> None:
    Base.metadata.drop_all(engine)
    storage = Path(settings.storage_dir)
    if storage.exists():
        for p in storage.iterdir():
            if p.name != ".gitkeep":
                p.unlink() if p.is_file() else shutil.rmtree(p)


def seed_demo(db: Session) -> None:
    if db.scalar(select(User).where(User.email == "admin@demo")):
        print("Demo data already present (use --reset to start over).")
        return

    firms = {key: Firm(name=name) for key, name in FIRMS.items()}
    db.add_all(firms.values())
    db.flush()

    pw = hash_password(DEMO_PASSWORD)
    users: dict[str, User] = {}
    for email, name, role, title, firm_key in USERS:
        users[email] = User(
            email=email,
            name=name,
            role=role,
            title=title,
            password_hash=pw,
            firm_id=firms[firm_key].id if firm_key else None,
        )
    db.add_all(users.values())
    db.add_all(RoutingRule(category=c, region=r, firm_id=firms[k].id) for c, r, k in ROUTING)
    db.commit()

    admin = users["admin@demo"]
    p1, p2 = users["plaintiff1@demo"], users["plaintiff2@demo"]
    att_a, para_a = users["attorney.a@demo"], users["paralegal.a@demo"]
    att_b = users["attorney.b@demo"]

    def submit(p: User, category: Category, region: Region, description: str) -> Lead:
        return leads.submit(
            db,
            p,
            leads.LeadInput(
                name=p.name, email=p.email, region=region, category=category, description=description
            ),
        )

    def upload(user: User, lead: Lead, name: str) -> None:
        db.refresh(lead)
        documents.upload(db, user, lead, name, io.BytesIO(tiny_pdf(name.removesuffix(".pdf"))))

    # 1. Accepted by Firm A, worked on, then reassigned to Firm B (shows note ownership).
    l1 = submit(
        p1,
        Category.personal_injury,
        Region.northeast,
        "Rear-ended at a red light in March; ongoing back pain and missed work.",
    )
    upload(p1, l1, "police-report.pdf")
    c1 = leads.accept(db, att_a, l1.id)
    cases.add_update(db, att_a, c1.id, CaseStatus.in_progress, "We've requested your medical records.")
    cases.add_note(db, att_a, c1.id, "Liability looks clear. Insurer is known to lowball; push early.")
    cases.add_note(db, para_a, c1.id, "Records request sent to St. Mary's on the 12th.")
    upload(para_a, l1, "records-request.pdf")
    cases.admin_reassign(db, admin, c1.id, firms["B"].id, "Firm A has a conflict of interest.")
    cases.add_note(db, att_b, c1.id, "Picked up from Alley & Deering. Reviewing file.")
    cases.add_update(db, att_b, c1.id, None, "Hayes & Teale LLP has taken over your case.")

    # 2. Waiting in Firm A's inbox.
    submit(p1, Category.employment, Region.midwest, "Let go two weeks after reporting a safety issue to HR.")

    # 3. No routing rule: waits for an admin.
    submit(p1, Category.criminal_defense, Region.west, "Charged with a misdemeanor; court date next month.")

    # 4. Declined by Firm B: back in the admin queue.
    l4 = submit(p2, Category.family, Region.southeast, "Need help modifying a custody arrangement.")
    leads.decline(db, att_b, l4.id, "At capacity for family matters this quarter.")

    # 5. Accepted by Firm A, open.
    l5 = submit(
        p2, Category.personal_injury, Region.west, "Slipped on an unmarked wet floor at a grocery store."
    )
    upload(p2, l5, "photos-of-scene.pdf")
    c5 = leads.accept(db, para_a, l5.id)
    cases.add_update(db, para_a, c5.id, None, "Thanks, we've received your photos.")

    # 6. Waiting in Firm C's inbox.
    submit(p2, Category.real_estate, Region.northeast, "Landlord is withholding my security deposit.")

    # 7. A closed case (read-only).
    l7 = submit(p2, Category.employment, Region.northeast, "Unpaid overtime for six months.")
    c7 = leads.accept(db, att_a, l7.id)
    cases.add_update(db, att_a, c7.id, CaseStatus.closed, "Settled. Payment should arrive within 30 days.")

    print(f"Seeded {len(FIRMS)} firms, {len(USERS)} users, {len(ROUTING)} routing rules, 7 leads.")
    print(f"Demo password for every user: {DEMO_PASSWORD}")


def seed_bulk(db: Session, n: int, n_firms: int = 100, batch: int = 5000) -> None:
    """Insert n synthetic leads (and cases for accepted ones) with bulk INSERTs.

    Skips the audit log for speed; this data exists only to check query performance.
    """
    started = time.perf_counter()
    existing = db.scalar(select(func.count()).select_from(Firm).where(Firm.name.like("Bulk Firm %")))
    db.add_all(Firm(name=f"Bulk Firm {i:03d}") for i in range(existing + 1, n_firms + 1))
    plaintiff = db.scalar(select(User).where(User.email == "bulk.plaintiff@bulk"))
    if plaintiff is None:
        plaintiff = User(
            email="bulk.plaintiff@bulk",
            name="Bulk Plaintiff",
            role=Role.plaintiff,
            password_hash=hash_password(DEMO_PASSWORD),
        )
        db.add(plaintiff)
    db.commit()
    firm_ids = list(db.scalars(select(Firm.id).where(Firm.name.like("Bulk Firm %"))))

    rng = random.Random(42)
    first = ["Taylor", "Morgan", "Riley", "Jamie", "Quinn", "Drew", "Reese", "Rowan", "Skyler", "Emerson"]
    last = ["Nguyen", "Garcia", "Smith", "Patel", "Kim", "Okafor", "Silva", "Cohen", "Novak", "Ito"]
    now = utcnow()
    statuses = (
        [LeadStatus.assigned] * 4 + [LeadStatus.accepted] * 4 + [LeadStatus.unassigned, LeadStatus.declined]
    )

    done = 0
    while done < n:
        size = min(batch, n - done)
        rows = []
        for _ in range(size):
            st = rng.choice(statuses)
            created = now - timedelta(seconds=rng.randint(0, 100 * 86400))  # ~1,000/day over 100 days
            name = f"{rng.choice(first)} {rng.choice(last)}"
            rows.append(
                {
                    "plaintiff_id": plaintiff.id,
                    "name": name,
                    "email": f"{name.lower().replace(' ', '.')}{rng.randint(1, 9999)}@example.com",
                    "region": rng.choice(list(Region)),
                    "category": rng.choice(list(Category)),
                    "description": f"Synthetic lead for load testing ({rng.randint(1, 10**6)}).",
                    "status": st,
                    "firm_id": rng.choice(firm_ids)
                    if st in (LeadStatus.assigned, LeadStatus.accepted)
                    else None,
                    "created_at": created,
                    "updated_at": created,
                }
            )
        ids = db.scalars(insert(Lead).returning(Lead.id), rows).all()
        case_rows = [
            {
                "lead_id": lead_id,
                "firm_id": row["firm_id"],
                "status": rng.choice([CaseStatus.open, CaseStatus.in_progress, CaseStatus.on_hold]),
                "created_at": row["created_at"],
                "updated_at": row["created_at"],
            }
            for lead_id, row in zip(ids, rows, strict=False)
            if row["status"] == LeadStatus.accepted
        ]
        if case_rows:
            db.execute(insert(Case), case_rows)
        db.commit()
        done += size
        print(f"  {done}/{n} leads", end="\r")
    print(f"\nInserted {n} leads across {len(firm_ids)} bulk firms in {time.perf_counter() - started:.1f}s.")


def main() -> None:
    parser = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    parser.add_argument("--reset", action="store_true", help="drop all data and stored files first")
    parser.add_argument("--bulk", type=int, default=0, metavar="N", help="also insert N synthetic leads")
    args = parser.parse_args()

    if args.reset:
        reset()
    create_tables()
    with SessionLocal() as db:
        seed_demo(db)
        if args.bulk:
            seed_bulk(db, args.bulk)


if __name__ == "__main__":
    main()
