# grand-charter

Take-home: a lead-management system that connects people seeking legal help (plaintiffs) with law firms, and lets admins oversee intake and assignment. React + TypeScript (Vite, Mantine) frontend, FastAPI + SQLAlchemy backend, SQLite.

- **Lead**: a plaintiff's inquiry (name, email, region, category, description).
- **Case**: the work record created when a firm accepts a lead.
- **Staff**: attorneys and paralegals at a firm. They have the same permissions.
- **Admin**: oversees leads and cases across all firms.

## Running it

### Backend

Requires Python 3.11+ (developed on 3.12).

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python -m app.seed            # creates grand_charter.db and demo data
uvicorn app.main:app --reload --port 8000
```

- Interactive API docs: http://localhost:8000/docs
- Every demo user's password is `demo123` (see [Authentication](docs/architecture.md#authentication)).
- `python -m app.seed --reset` wipes the database and stored files, then re-seeds.
- `python -m app.seed --reset --bulk 100000` also adds 100k synthetic leads across 100 firms, for checking the scale targets.
- Settings come from environment variables or `backend/.env`; see `backend/.env.example`.

**Development tools** (tests, linter, formatter):

```bash
pip install -r requirements-dev.txt
scripts/check.sh          # everything CI runs: lint, format check, tests, smoke test
scripts/check.sh --fix    # auto-fix lint issues and reformat first
```

### Frontend

Requires Node 22.12+ (developed on Node 24). Start the backend first, then in a second terminal:

```bash
cd frontend
npm install
npm run dev               # http://localhost:5173
```

Open http://localhost:5173 and sign in with any demo account (password `demo123`). Start typing in the email field to get suggestions; the arrow keys and Enter pick one. The dev server proxies `/api` to the backend on port 8000 (set `API_URL` to point elsewhere), so the session cookie works without CORS.

| Command | What it does |
|---|---|
| `npm run dev` | Dev server with hot reload |
| `npm run build` | Typecheck, then production build into `dist/` |
| `npm test` | Vitest + Testing Library |
| `npm run lint` / `npm run format` | ESLint (zero warnings allowed) / Prettier |

> **Pro tip:** to stay signed in as several people at once, open each one at its own URL in Chrome, such as http://localhost:5173, http://firm.localhost:5173 and http://admin.localhost:5173. It's the same app, but Chrome keeps a separate session cookie for each hostname, so signing in on one doesn't sign you out of the others. Any `*.localhost` name works with no setup.

**Example workflow** (about 3 minutes):
1. Sign in as `plaintiff1@demo` (Liam Lester, client). Submit a new *Employment* request in the *West*, then upload a PDF.
2. **Sign out**, then sign in as `attorney.a@demo` (Ana Deering, Alley & Deering). The request is in the inbox. Accept it, post an update, and add a private note.
3. Sign in as `admin@demo`. Open the case and **Reassign case** to Hayes & Teale LLP. Look at the *History* and *Private notes* tabs.
4. Sign in as `attorney.b@demo` (Becky Teale, Hayes & Teale). The case and documents are there, but not Alley & Deering's note. Ana Deering now gets "couldn't find that".
5. Back as Liam: progress and documents are visible; private notes never are.

## Documentation

| Doc | What's in it |
|---|---|
| [Architecture](docs/architecture.md) | Repo layout, request flow, auth, data model, status flow, access rules, audit log, file storage, frontend design |
| [API & frontend routes](docs/api.md) | Every endpoint by role, conventions (pagination, errors), and the frontend's pages |
| [Scale, decisions & edge cases](docs/decisions.md) | Measured performance at 100k leads, SQLite → Postgres path, assumptions, issues found while building, edge-case behaviour |

## Highlights

- **One app, modular monolith.** A React SPA and one FastAPI service with role-scoped routers; no microservices to keep consistent. [Why](docs/architecture.md#overview)
- **Access is derived, not stored.** A firm can see a lead or case only while its `firm_id` is theirs, so reassignment revokes access with no extra code. Filters run in SQL, and "not yours" returns 404. [Access rules](docs/architecture.md#access-rules-policypy)
- **Private notes can't leak.** Client-visible updates and firm-private notes are separate tables, and plaintiff schemas have no notes field at all. Notes stay with the firm that wrote them after a reassignment. [Data model](docs/architecture.md#data-model)
- **Safe under concurrency.** Accept, decline, assign and reassign are compare-and-set updates that return 409 on a race, with `UNIQUE(case.lead_id)` as a backstop. [Edge cases](docs/decisions.md#edge-cases)
- **Audit log written in the same transaction** as every assignment and status change, so the log and the data can't drift. [Audit log](docs/architecture.md#audit-log)
- **Documents are never served statically.** Every download goes through an access check; uploads are signature- and size-checked. [File storage](docs/architecture.md#file-storage)
- **Measured at 100k leads:** firm inbox ~6 ms, admin queue ~24 ms, search under 300 ms. [Scale](docs/decisions.md#scale)

```
Browser (React SPA)
   │  /api/*  (Vite dev proxy → same origin, so no CORS; session cookie)
   ▼
FastAPI routers ──► policy.py (who can see/do what)
   │
   ▼
services/ (routing, accept/decline, reassign, audit)  ── one DB transaction per action
   │                         │
   ▼                         ▼
SQLite (SQLAlchemy)     storage/ (PDFs on local disk)
```

## CI

[`.github/workflows/ci.yml`](.github/workflows/ci.yml) runs on every pull request, on every push to `main`, and on demand. The four jobs run in parallel. A new push to a PR cancels that PR's run still in progress.

| Job | What it checks |
|---|---|
| Backend · lint & format | `ruff check` (pycodestyle, pyflakes, import order, bugbear, pyupgrade, simplify) and `ruff format --check`. Config is in `backend/pyproject.toml`. |
| Backend · tests | The full `pytest` suite. |
| Backend · build & smoke test | Installs **runtime dependencies only**, seeds a throwaway database, boots the real server with uvicorn, and makes HTTP calls as each role (`scripts/smoke_test.sh`). This catches startup failures, missing runtime dependencies and broken seed data that unit tests can miss. |
| Frontend · lint, typecheck, test, build | `npm ci`, then `lint` (ESLint, zero warnings), `format:check` (Prettier), `typecheck` (`tsc`), `test` (Vitest), then `npm run build`. |

Dependencies are pinned (`requirements.txt` for runtime, `requirements-dev.txt` adds pytest, httpx and ruff), and pip/npm downloads are cached between runs.

<sub><a href="docs/easter-eggs.md">did u catch the easter eggs?</a></sub>
