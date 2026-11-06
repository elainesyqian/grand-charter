# Architecture

[← Back to README](../README.md)

## Overview

One application in one repo: a React single-page app talking to a Python API.

```
grand-charter/
├── .github/workflows/ci.yml   PR checks (see README → CI)
├── frontend/   React + TypeScript (Vite), Mantine UI, React Router, TanStack Query
│   └── src/
│       ├── api/         typed fetch client + one module per role (mirrors the backend routers)
│       ├── auth/        current user (from /auth/me), role route guard
│       ├── components/  layout, tables, filters, timelines, notes, documents, assign dialog
│       ├── pages/       login + plaintiff/, firm/, admin/ (each page lazy-loaded)
│       ├── lib/         query client, formatting, URL-synced filters
│       ├── theme/       Mantine theme (navy + army green, serif headings) and global CSS
│       └── test/        Vitest + Testing Library
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

## Authentication

Account creation is out of scope. The app seeds demo users with hardcoded passwords. There are several so that access isolation can be demonstrated:

| User | Role | Firm |
|---|---|---|
| `admin@demo` | admin | – |
| `plaintiff1@demo`, `plaintiff2@demo` | plaintiff | – |
| `attorney.a@demo`, `paralegal.a@demo` | staff | Firm A |
| `attorney.b@demo` | staff | Firm B |
| `attorney.c@demo` | staff | Firm C |

Every demo user's password is `demo123`. The login page is a plain email and password form; the email field suggests matching demo accounts as you type. Sessions use a signed, httpOnly cookie (`SameSite=Lax`, 8-hour lifetime) that holds only the user id. Every API request loads the user from the database using that id, never from anything else the client sends. Passwords are bcrypt-hashed, and an unknown email takes the same time to reject as a wrong password.

Firms are Alder & Finch LLP (A), Brightwater Legal (B) and Cedar Law Group (C). The seed data puts at least one lead or case into every state, including a case that was reassigned from A to B with notes from both firms, a declined lead, an unmatched lead, and a closed case.

## Data model

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

## Status flow

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

## Access rules (`policy.py`)

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

## Audit log

Every assignment change and important status change writes an `AuditEvent` **in the same transaction** as the change itself, so the log and the data cannot drift apart. Each event records the actor, the action, before/after values, an optional reason, and a timestamp.

Actions: `lead.created`, `lead.routed`, `lead.unmatched`, `lead.assigned`, `lead.accepted`, `lead.declined`, `case.created`, `case.status_changed`, `case.reassigned`.

Admins see the history on each lead or case page and in a global, filterable audit view.

## File storage

- PDFs are stored on local disk under `backend/storage/` with random names. Metadata lives in `Document`.
- Uploads are checked for the `%PDF` file signature (not just the extension) and a size limit.
- Files are **never served as static files**. Every download goes through `GET /api/documents/{id}`, which checks access first.
- `storage.py` exposes `save_pdf()`, `open_file()` and `delete()`, so it can be swapped for S3 or another object store without touching callers.
- Size is checked twice: the `Content-Length` header is checked before the upload is parsed, and the actual byte count is checked while copying. Files are written to a `.part` file and renamed only when complete, so a failed upload never leaves a half-written PDF.
- Downloads are served `inline` (the browser's PDF viewer) with `X-Content-Type-Options: nosniff` and `Cache-Control: private, no-store`.

## Frontend design

- **Look:** light mode only. No product name: the logo is just a scales-of-justice mark. Source Serif 4 for headings, Inter for everything else. Text is near-black and warm grays on an off-white page. Navy is the primary accent (buttons, links, in-progress states); army green marks positive states (accepted, open, success toasts). Fonts are self-hosted through `@fontsource`, so there are no external requests.
- **Client-visible vs private is shown visually, not just in text.** On the firm's case page, the update composer carries a green "Visible to client" badge. Private notes sit in a separate warm-yellow panel with a lock icon and "Only <firm> staff can see these".
- **Every hard-to-undo action asks first:** accept, decline (reason required, with quick-pick reasons), assign, reassign, and closing a case. The reassign dialog explains exactly who loses access and what moves. The assign dialog warns if the chosen firm declined the lead before.
- **Data handling:** TanStack Query caches per role-scoped key and refetches after every change.
  - A 409 ("changed by someone else") shows a toast and refreshes the page's data.
  - A 401 sends you to the login page.
  - A 404 shows "couldn't find that". That's also what a firm sees after a case moves away from it.
- **Filters and page numbers live in the URL,** so refresh, back and shared links keep your view. Search is debounced.
- **Pages are lazy-loaded per route,** so a client never downloads admin screens. A thin progress bar shows while a page's code loads.
- **Responsive:** on phones the nav moves into a burger menu, two-column pages stack, and wide tables scroll sideways.
- **Accessibility:** table rows are keyboard-focusable (Enter opens them), every icon-only control has a label, and relative times show the exact timestamp on hover.
