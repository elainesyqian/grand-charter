"""Test fixtures: fresh in-memory DB and temp storage per test, seeded demo world."""

import io
import os
import tempfile

# Must be set before any app module reads settings.
os.environ["DATABASE_URL"] = "sqlite://"
os.environ["STORAGE_DIR"] = tempfile.mkdtemp(prefix="gc-test-storage-")

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select

from app.config import settings
from app.db import Base, SessionLocal, engine
from app.main import app
from app.models import Firm, Lead, User
from app.seed import DEMO_PASSWORD, seed_demo, tiny_pdf


@pytest.fixture(autouse=True)
def fresh_db(tmp_path, monkeypatch):
    monkeypatch.setattr(settings, "storage_dir", tmp_path / "storage")
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    with SessionLocal() as db:
        seed_demo(db)
    yield


@pytest.fixture
def db():
    with SessionLocal() as session:
        yield session


def login(email: str) -> TestClient:
    client = TestClient(app)
    res = client.post("/api/auth/login", json={"email": email, "password": DEMO_PASSWORD})
    assert res.status_code == 200, res.text
    return client


@pytest.fixture
def as_user():
    return login


def firm_id(db, name_prefix: str) -> int:
    return db.scalar(select(Firm.id).where(Firm.name.like(f"{name_prefix}%")))


def user(db, email: str) -> User:
    return db.scalar(select(User).where(User.email == email))


def lead_by_description(db, fragment: str) -> Lead:
    return db.scalar(select(Lead).where(Lead.description.like(f"%{fragment}%")))


def pdf_file(name: str = "doc.pdf", content: bytes | None = None):
    return {"file": (name, io.BytesIO(content if content is not None else tiny_pdf("x")), "application/pdf")}
