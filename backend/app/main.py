"""FastAPI app entry point.

Outline:
- Create the app; add SessionMiddleware (signed httpOnly cookie, SameSite=Lax).
- Include routers under /api: auth, meta, plaintiff, firm, admin, documents.
- On startup: create tables (Base.metadata.create_all; no Alembic for this take-home).
- Map domain errors from services (NotFound, Conflict, InvalidTransition) to 404/409/400.
"""
