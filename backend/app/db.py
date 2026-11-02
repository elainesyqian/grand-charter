"""Engine, session factory, declarative Base.

- Engine from settings.DATABASE_URL (SQLite by default, Postgres-compatible).
- For SQLite only, on each connection: PRAGMA foreign_keys=ON, PRAGMA journal_mode=WAL;
  connect_args check_same_thread=False.
- get_db() yields one session per request; services commit, errors roll back.
"""
