"""Test fixtures.

- Fresh in-memory SQLite DB per test (StaticPool), app dependency override for get_db.
- Temp STORAGE_DIR per test.
- Factories: firms A/B, users per role, routing rules, leads in each status.
- login(client, email) helper returning an authenticated TestClient.
"""
