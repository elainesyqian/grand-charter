# grand-charter

Take-home: a lead-management system that connects people seeking legal help (plaintiffs) with law firms, and lets admins oversee intake and assignment.

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
- Every demo user's password is `demo123` (see [Authentication](#authentication)).
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

> Setup instructions will be added once the frontend exists.

### CI

[`.github/workflows/ci.yml`](.github/workflows/ci.yml) runs on every pull request, on every push to `main`, and on demand. The four jobs run in parallel. A new push to a PR cancels that PR's run still in progress.

| Job | What it checks |
|---|---|
| Backend · lint & format | `ruff check` (pycodestyle, pyflakes, import order, bugbear, pyupgrade, simplify) and `ruff format --check`. Config is in `backend/pyproject.toml`. |
| Backend · tests | The full `pytest` suite. |
| Backend · build & smoke test | Installs **runtime dependencies only**, seeds a throwaway database, boots the real server with uvicorn, and makes HTTP calls as each role (`scripts/smoke_test.sh`). This catches startup failures, missing runtime dependencies and broken seed data that unit tests can miss. |
| Frontend · lint, typecheck, test, build | `npm ci`, then `lint`, `format:check`, `typecheck` and `test` (each only if the script exists in `package.json`), then `npm run build`. Skips with a notice until `frontend/package.json` exists. |

Dependencies are pinned (`requirements.txt` for runtime, `requirements-dev.txt` adds pytest, httpx and ruff), and pip/npm downloads are cached between runs.

---

## Architecture

### Overview

One application in one repo: a React single-page app talking to a Python API.

```
grand-charter/
├── .github/workflows/ci.yml   PR checks (see CI)
├── frontend/   React + TypeScript (Vite), React Router, TanStack Query
└── backend/    FastAPI, SQLAlchemy, Pydantic, SQLite
    ├── app/
    │   ├── main.py          app + router wiring, error → HTTP status mapping
    │   ├── config.py        settings from env (.env.example)
    │   ├── db.py            engine/session; DATABASE_URL env var; UTC datetime type
    │   ├── enums.py         roles, regions, categories, statuses, allowed transitions
    │   ├── errors.py        domain errors (NotFound, Conflict, ...) raised by services
    │   ├── deps.py          current user, role guards, pagination params, upload guard
    │   ├── models.py        SQLAlchemy tables
    │   ├── querying.py      pagination, LIKE-safe search, shared sub-list queries
    │   ├── schemas/         Pydantic request/response models, per role
    │   ├── routers/         auth (+ /meta), plaintiff, firm, admin, documents
    │   ├── services/        routing, lead/case state changes, documents, audit
    │   ├── policy.py        every access rule, in one place
    │   ├── storage.py       file storage interface (local disk now)
    │   └── seed.py          demo users, firms, routing rules, sample data, bulk mode
    ├── scripts/             check.sh (all CI checks locally), smoke_test.sh
    ├── tests/               focused on access rules and state changes
    ├── pyproject.toml       ruff + pytest config
    ├── requirements.txt     runtime dependencies
    └── requirements-dev.txt + tests, linter, formatter
```

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

**Why one app and not several services:** the scope is one domain with one shared data model. The three user experiences (plaintiff, firm, admin) are routes in one frontend and routers in one backend. Splitting into services would add network calls, passing auth between services, and keeping data consistent across them, all without benefit at this size. The code is organised as a *modular monolith*: clean module boundaries make it possible to split out a service later if there is ever a real reason to.

**Frontend routes are for convenience, not security.** The backend enforces every access rule on every request.

### Authentication

Account creation is out of scope. The app seeds demo users with hardcoded passwords. There are several so that access isolation can be demonstrated:

| User | Role | Firm |
|---|---|---|
| `admin@demo` | admin | – |
| `plaintiff1@demo`, `plaintiff2@demo` | plaintiff | – |
| `attorney.a@demo`, `paralegal.a@demo` | staff | Firm A |
| `attorney.b@demo` | staff | Firm B |
| `attorney.c@demo` | staff | Firm C |

Every demo user's password is `demo123`. The login page lists them for one-click sign-in. Sessions use a signed, httpOnly cookie (`SameSite=Lax`, 8-hour lifetime) that holds only the user id. Every API request loads the user from the database using that id, never from anything else the client sends. Passwords are bcrypt-hashed, and an unknown email takes the same time to reject as a wrong password.

Firms are Alder & Finch LLP (A), Brightwater Legal (B) and Cedar Law Group (C). The seed data puts at least one lead or case into every state, including a case that was reassigned from A to B with notes from both firms, a declined lead, an unmatched lead, and a closed case.

### Data model

```
Firm          id, name
User          id, email, name, role (plaintiff|staff|admin), firm_id?, password_hash
RoutingRule   category, region → firm_id                      UNIQUE(category, region)
Lead          id, plaintiff_id, name, email, region, category, description,
              status, firm_id?, created_at, updated_at
LeadDecline   lead_id, firm_id, user_id, reason, created_at   (firms that declined)
Case          id, lead_id (UNIQUE), firm_id, status, created_at, updated_at
CaseUpdate    case_id, author_id, from_status?, to_status?, message?, created_at  (visible to plaintiff)
Note          case_id, author_firm_id, author_user_id, body, created_at  (firm-private)
Document      id, lead_id, uploaded_by, uploader_role, uploader_firm_id?, filename,
              storage_key, size, created_at
AuditEvent    id, actor_id, entity_type, entity_id, action, before (JSON), after (JSON),
              reason?, created_at                               (append-only)
```

Design notes:
- **Case is 1:1 with Lead**, enforced by `UNIQUE(case.lead_id)`. This also blocks two staff members accepting the same lead at the same moment.
- **Documents attach to the lead**, so a plaintiff can upload before a firm accepts, and the files carry over to the case and through any reassignment.
- **CaseUpdate and Note are separate tables.** Updates are the progress timeline the plaintiff sees. Notes are firm-private. Keeping them apart means a plaintiff response can never accidentally include a note.

### Status flow

```
Lead:  [submitted] ──routing──► assigned ──accept──► accepted  (Case created)
           │                       │
           └─no match─► unassigned └─decline─► declined
                           │                     │
                           └──── admin assigns ──┴──► assigned

Case:  open ⇄ in_progress ⇄ on_hold ──► closed
```

- **Routing** looks up `(category, region)` in `RoutingRule`. The unique constraint guarantees at most one firm. If there is no match, the lead becomes `unassigned`.
- **Decline** sets `firm_id = NULL` and `status = declined`, and records a `LeadDecline` row. The declining firm loses access right away, and the admin UI warns before assigning the lead back to a firm that declined it.
- The service layer checks every status change against an allowed-transitions table and rejects anything else.

### Access rules (`policy.py`)

**A firm's access is computed from the *current* assignment and is never stored separately.** Staff can access a lead or case only while its `firm_id` equals their own firm. So "the old firm loses access on reassignment" needs no extra code: changing `firm_id` revokes it.

| | Plaintiff | Staff (assigned firm) | Admin |
|---|---|---|---|
| Lead / case details | own only (`plaintiff_id = me`) | while `firm_id = my firm` | all |
| Case updates (progress) | own cases | ✓ | all |
| Documents | own leads | ✓ (including the plaintiff's and earlier firms' uploads) | all |
| Notes | **never** (left out of plaintiff responses) | only `author_firm_id = my firm`, and only while assigned | all, labelled by authoring firm |
| Audit history | – | – | all |

The access filter goes into the SQL `WHERE` clause (for example `WHERE firm_id = :my_firm`), so rows a user cannot see never leave the database. A forbidden detail request returns 404, so the response doesn't reveal whether the record exists.

**Reassignment:** the new firm sees the case, its progress updates and all documents. It does not see notes written by the previous firm. Those keep their `author_firm_id`, so only admins can still read them. The old firm loses all access.

### Audit log

Every assignment change and important status change writes an `AuditEvent` **in the same transaction** as the change itself, so the log and the data cannot drift apart. Each event records the actor, the action, before/after values, an optional reason, and a timestamp.

Actions: `lead.created`, `lead.routed`, `lead.unmatched`, `lead.assigned`, `lead.accepted`, `lead.declined`, `case.created`, `case.status_changed`, `case.reassigned`.

Admins see the history on each lead or case page and in a global, filterable audit view.

### File storage

- PDFs are stored on local disk under `backend/storage/` with random names. Metadata lives in `Document`.
- Uploads are checked for the `%PDF` file signature (not just the extension) and a size limit.
- Files are **never served as static files**. Every download goes through `GET /api/documents/{id}`, which checks access first.
- `storage.py` exposes `save_pdf()`, `open_file()` and `delete()`, so it can be swapped for S3 or another object store without touching callers.
- Size is checked twice: the `Content-Length` header is checked before the upload is parsed, and the actual byte count is checked while copying. Files are written to a `.part` file and renamed only when complete, so a failed upload never leaves a half-written PDF.
- Downloads are served `inline` (the browser's PDF viewer) with `X-Content-Type-Options: nosniff` and `Cache-Control: private, no-store`.

---

## API

All endpoints are under `/api`. The full, live schema is at `/docs` when the backend is running.

- Lists take `page` (from 1) and `page_size` (1–100, default 20) and return `{ items, total, page, page_size }`. A `page_size` over 100 gets a 422 error rather than being silently capped.
- **Detail endpoints return only the record itself.** Sub-lists (updates, notes, documents, history) each have their own paginated endpoint, because a case can have hundreds of each.
- Multi-value filters repeat the parameter: `?status=unassigned&status=declined`.
- Errors are `{ "detail": ... }`: 401 not signed in, 403 wrong role, 404 not found *or not yours*, 409 wrong state / changed concurrently, 413 file too large, 400/422 invalid input.
- Timestamps are ISO 8601 in UTC (`...Z`).

### Auth & reference data
| Method | Path | Purpose |
|---|---|---|
| POST | `/auth/login` | `{email, password}` → sets session cookie |
| POST | `/auth/logout` | clear session |
| GET | `/auth/me` | current user (role, firm) |
| GET | `/auth/demo-users` | seeded demo users for the login picker (no passwords) |
| GET | `/meta` | regions, categories, lead and case statuses (public; the submit form needs it) |
| GET | `/health` | liveness check |

### Plaintiff (`role = plaintiff`)
| Method | Path | Purpose |
|---|---|---|
| POST | `/plaintiff/leads` | submit a lead; routing runs in the same transaction |
| GET | `/plaintiff/leads` | my leads: `display_status` (`under_review` / `accepted`), `case_id`, `case_status` |
| GET | `/plaintiff/leads/{id}` | lead + case status + firm (once accepted). No notes or internal routing data |
| GET | `/plaintiff/leads/{id}/updates` | progress timeline (empty until a case exists) |
| GET / POST | `/plaintiff/leads/{id}/documents` | list / upload PDFs |

### Firm staff (`role = staff`, limited to the current firm)
| Method | Path | Purpose |
|---|---|---|
| GET | `/firm/leads` | inbox; filters: `status` (default `assigned`), `category`, `region`, `q`, `created_from`, `created_to` |
| GET | `/firm/leads/{id}` | inspect a lead (`case_id` set once accepted) |
| GET | `/firm/leads/{id}/documents` | the plaintiff's documents, before accepting |
| POST | `/firm/leads/{id}/accept` | creates the case → 201 with the case |
| POST | `/firm/leads/{id}/decline` | `{reason}` (required) → 204; lead goes back to admins |
| GET | `/firm/cases` | my firm's cases; filters: `status`, `category`, `region`, `q` |
| GET | `/firm/cases/{id}` | the case |
| GET / POST | `/firm/cases/{id}/updates` | progress timeline / `{to_status?, message?}` (at least one) |
| GET / POST | `/firm/cases/{id}/notes` | *my firm's* private notes / `{body}` |
| GET / POST | `/firm/cases/{id}/documents` | list / upload PDFs |

### Admin (`role = admin`)
| Method | Path | Purpose |
|---|---|---|
| GET | `/admin/leads` | search across firms; filters: `q`, `status`, `firm_id`, `category`, `region`, `created_from`, `created_to`. The queue is `?status=unassigned&status=declined` |
| GET | `/admin/leads/{id}` | lead + plaintiff + `declines` (which firm, who, why) + `case_id` |
| GET | `/admin/leads/{id}/documents` | documents |
| GET | `/admin/leads/{id}/history` | audit events for the lead **and** its case, as one timeline |
| POST | `/admin/leads/{id}/assign` | `{firm_id, reason?}`: resolve an unassigned or declined lead, or move a pending one |
| GET | `/admin/cases` | search across firms; filters: `q`, `status`, `firm_id`, `category`, `region` |
| GET | `/admin/cases/{id}` | the case |
| GET | `/admin/cases/{id}/updates` | progress timeline |
| GET | `/admin/cases/{id}/notes` | **all** notes, each with `author_firm` and `from_previous_firm`; optional `firm_id` filter |
| GET | `/admin/cases/{id}/documents` | documents |
| GET | `/admin/cases/{id}/history` | audit events for the case and its lead |
| POST | `/admin/cases/{id}/reassign` | `{firm_id, reason?}`: moves the case (and its lead) to the new firm |
| GET | `/admin/audit` | global history; filters: `entity_type`, `entity_id`, `actor_id`, `action`, `created_from`, `created_to` |
| GET | `/admin/firms` | firms list (for the assignment dropdowns) |

### Shared
| Method | Path | Purpose |
|---|---|---|
| GET | `/documents/{id}` | download a PDF; checks access for any role |

The routers are split **by role**, not by resource. Each role gets its own response shapes, so the plaintiff schemas simply have no field for notes. The access rules themselves stay central in `policy.py`.

---

## Frontend routes

| Route | Role | Screen |
|---|---|---|
| `/login` | – | demo-user picker |
| `/plaintiff` | plaintiff | my leads and cases |
| `/plaintiff/new` | plaintiff | submit a lead (name and email pre-filled) |
| `/plaintiff/leads/:id` | plaintiff | status, progress timeline, documents (upload/view) |
| `/firm/inbox` | staff | filterable lead inbox |
| `/firm/leads/:id` | staff | lead details, accept/decline |
| `/firm/cases` | staff | case list |
| `/firm/cases/:id` | staff | progress updates, notes, documents |
| `/admin` | admin | queue of unassigned and declined leads |
| `/admin/leads`, `/admin/leads/:id` | admin | search; details with assignment + history |
| `/admin/cases`, `/admin/cases/:id` | admin | search; details with reassignment, all notes, history |
| `/admin/audit` | admin | global audit log |

A route guard sends users to their role's home page. That's only for usability; the API enforces access.

---

## Scale

Target: at least 100 firms, 1,000 leads/day, 100,000 stored leads, and hundreds of related records per case.

That load is small for a relational database. 1,000 leads/day is about one write per 86 seconds, and 100k rows is a small table. What matters at this size is how queries are written:

- **Indexes** on the columns used for filtering:
  - leads: `(firm_id, status, created_at)`, `plaintiff_id`, `(status, created_at)`, `created_at`
  - routing rules: `UNIQUE(category, region)`
  - cases: `UNIQUE(lead_id)`, `(firm_id, status, updated_at)`
  - notes: `(case_id, author_firm_id, created_at)`; case updates: `(case_id, created_at)`
  - documents: `(lead_id, created_at)`
  - audit events: `(entity_type, entity_id, created_at)`, `created_at`, `actor_id`
- **Pagination** on every list: inboxes, search, and a case's updates, notes, documents and history.
- **Access filters run in SQL**, never "load everything, then filter in Python."
- **No N+1 queries**: related data is loaded with joins or eager loading.
- **Search** uses `LIKE` with filters. SQLite's built-in full-text search (FTS5) is the next step if needed.

**Measured** on a laptop with `seed --bulk 100000` (100k leads, ~40k cases, 100 firms; 37 MB database; bulk insert took about 18 s). Times are full HTTP round trips:

| Request | Time |
|---|---|
| Firm-scoped inbox (`firm_id` + `status`) | ~6 ms (uses `ix_leads_firm_status_created`, no sort step) |
| Admin queue (`status=unassigned&status=declined`) | ~24 ms |
| Admin lead list, unfiltered, page 1 | ~95 ms (mostly the `COUNT(*)` for `total`) |
| Free-text search (`q=garcia`), any page | ~150–170 ms (full scan) |
| Numeric search (`q=12345`, text match OR id) | ~300 ms |
| Audit log, case/lead history | ~6 ms |

Everything is well under the threshold users would notice. If search became a hot path, the next steps would be FTS5 (or Postgres `pg_trgm`), and dropping exact `total` counts on unfiltered lists.

### SQLite now, Postgres later

SQLite needs zero setup, and WAL mode lets reads continue during writes. Its real limits are **one writer at a time** and **one machine**, so it can't sit behind several API servers. All database access goes through SQLAlchemy, and the connection comes from `DATABASE_URL`, so moving to Postgres is a config change, not a rewrite. In the same way, `storage.py` lets local disk be swapped for S3.

---

## Assumptions & decisions

- **Attorneys and paralegals have the same permissions.** The spec gives them the same workflows.
- **Declining removes the firm's access.** The lead returns to the admin queue, and the decline is kept in `LeadDecline` and the audit log.
- **Documents transfer on reassignment, including ones uploaded by earlier firms.** They were shared with the plaintiff, so they aren't firm-private. Only notes are firm-private.
- **A firm loses access to its own notes after a case is reassigned away.** Admins can still read them. No archive UI is provided, per the spec.
- **Routing runs once, at submission.** Later changes to the routing rules don't re-route existing leads.
- **The routing table is seeded**, with no editor UI, per the spec.
- **Plaintiffs don't see internal routing.** `unassigned`, `assigned` and `declined` all show to the plaintiff as "under review". The firm name appears once a firm accepts.
- **Closed cases are read-only.** No new updates or uploads, and they can't be reassigned. Firm-private notes are still allowed (for example, a closing memo), because they're internal records rather than case progress.
- **Tables are created at startup** (`create_all`). Migrations (Alembic) would be the next step for a long-lived deployment.
- **Attorney vs paralegal** is stored as a display `title` on the user. Permissions come only from `role = staff`.
- **Admin reassignment reasons are optional**; decline reasons are required. A reason is useful for an admin, but a firm's decline with no reason gives the admin nothing to act on.
- **Bulk seed data skips the audit log.** It exists only for the scale check; the regular demo data goes through the real services, so its history looks like real usage.
- **Sessions are stateless signed cookies**, so a session can't be revoked on the server before it expires (8 hours). That's acceptable for a demo with hardcoded users. A server-side session table would fix it.

### Issues found while building

- **Postgres constraint-name collision.** Naming the enum `CHECK` constraints after the enum type would have given `case_updates.from_status` and `case_updates.to_status` the same constraint name. SQLite allows that; Postgres rejects it. The constraints are now unnamed, so each one gets a generated name.
- **SQLite drops timezones.** Timestamps came back without a timezone and would have been serialized without a `Z`. A small `UTCDateTime` column type now re-attaches UTC on load.
- **`passlib` is unmaintained and breaks with current `bcrypt`.** The code uses `bcrypt` directly.
- **Large sub-lists in detail responses.** The original design put every update, note, document and history entry inside the detail response. With hundreds per case that's unbounded, so each sub-list now has its own paginated endpoint.

## Edge cases

| Situation | Behaviour |
|---|---|
| Two staff members accept the same lead at once | State changes are compare-and-set (`UPDATE … WHERE status='assigned' AND firm_id=:mine`). The loser gets 409, and `UNIQUE(case.lead_id)` is the backstop. |
| A firm accepts while an admin reassigns the lead | Same compare-and-set: whichever lands second gets 409. |
| Firm accepts or declines a lead that was already declined or reassigned | 404, because the firm no longer has access. |
| Admin uses "assign" on an accepted lead | 409. Once a case exists, it moves through case reassignment, so `lead.firm_id` and `case.firm_id` always stay in sync. |
| Admin assigns to the firm that already holds it | 409 (no-op). |
| Admin assigns back to a firm that declined | Allowed. The UI shows that firm's earlier decline and its reason before confirming. |
| Case goes A → B → A | Firm A regains access, including its own earlier notes (it wrote them). Firm B's notes stay hidden from A. |
| Plaintiff submits with a different email than their account | The lead stores the contact details as entered. Ownership always comes from the session (`plaintiff_id`), never from email. |
| Plaintiff uploads before any firm accepts | Allowed. The document is attached to the lead and visible to whichever firm is assigned. |
| File named `.pdf` but isn't a PDF, or is empty | 400 (`%PDF-` signature check). |
| File too large | 413, either from the `Content-Length` pre-check or while copying. The partial file is removed. |
| Malicious filename (`../../etc/passwd`) | The filename is display-only and reduced to its last segment (`passwd.pdf`). Files are stored under a random UUID, and downloads send a properly encoded `Content-Disposition`. |
| Database insert fails after a file is saved | The stored file is deleted, so no orphan is left. |
| Plaintiff or staff calls another role's routes | 403 (role guard on the router). A record that exists but isn't theirs → 404. |
| Search term contains `%` or `_` | Escaped before `LIKE`. A numeric query also matches by id. |
| Very large `page_size` | 422 (limit 100). Ordering always ends with `id DESC`, so pages are stable even when timestamps tie. |
| Signed-in user is deleted, or cookie holds a stale id | 401, and the session is cleared. |
| Admin passes a nonexistent `firm_id` | 404 `Firm not found`. |
| Routing has no match for (category, region) | The lead is `unassigned`, appears in the admin queue, and the audit log records `lead.unmatched` (actor = system). |
| Progress update with neither a status nor a message | 422. A "change" to the current status plus a message is stored as a message-only update; the same status with no message is 400 (nothing to record). |
