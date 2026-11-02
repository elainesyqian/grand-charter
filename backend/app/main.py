"""FastAPI app entry point. Run: uvicorn app.main:app --reload (from backend/)."""

from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from starlette.middleware.sessions import SessionMiddleware

from app.config import settings
from app.db import create_tables
from app.errors import DomainError
from app.routers import admin, auth, documents, firm, plaintiff


@asynccontextmanager
async def lifespan(_app: FastAPI):
    create_tables()
    yield


app = FastAPI(title="grand-charter", lifespan=lifespan)
app.add_middleware(
    SessionMiddleware,
    secret_key=settings.secret_key,
    session_cookie="gc_session",
    max_age=8 * 60 * 60,
    same_site="lax",
    https_only=False,  # local demo over http; set True behind HTTPS
)


@app.exception_handler(DomainError)
def domain_error(_request: Request, exc: DomainError) -> JSONResponse:
    return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail})


for r in (auth.router, auth.meta_router, plaintiff.router, firm.router, admin.router, documents.router):
    app.include_router(r, prefix="/api")


@app.get("/api/health", tags=["meta"])
def health() -> dict[str, str]:
    return {"status": "ok"}
