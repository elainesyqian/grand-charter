"""FastAPI dependencies.

- get_db: request-scoped session (re-exported from db).
- get_current_user: user id from session cookie -> User; 401 if missing/unknown.
- require_role(*roles): 403 if the user's role isn't allowed (used per router).
- pagination params: page >= 1, 1 <= page_size <= PAGE_SIZE_MAX.
"""
