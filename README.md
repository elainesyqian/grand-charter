# grand-charter

Take-home: a lead-management system that connects people seeking legal help (plaintiffs) with law firms, and lets admins oversee intake and assignment.

- **Lead**: a plaintiff's inquiry (name, email, region, category, description).
- **Case**: the work record created when a firm accepts a lead.
- **Staff**: attorneys and paralegals at a firm. They have the same permissions.
- **Admin**: oversees leads and cases across all firms.

> Setup instructions for the backend and frontend will be added once they exist.

---

## Architecture

### Overview

One application in one repo: a React single-page app talking to a Python API.

```
grand-charter/
├── frontend/   React + TypeScript (Vite), React Router, TanStack Query
└── backend/    FastAPI, SQLAlchemy, Pydantic, SQLite
    ├── app/
    │   ├── main.py          app + router wiring, error → HTTP status mapping
    │   ├── config.py        settings from env (.env.example)
    │   ├── db.py            engine/session; DATABASE_URL env var
    │   ├── enums.py         roles, regions, categories, statuses, allowed transitions
    │   ├── deps.py          current user, role guards, pagination params
    │   ├── models.py        SQLAlchemy tables
    │   ├── schemas/         Pydantic request/response models, per role
    │   ├── routers/         auth, plaintiff, firm, admin, documents
    │   ├── services/        routing, lead/case state changes, audit
    │   ├── policy.py        every access rule, in one place
    │   ├── storage.py       file storage interface (local disk now)
    │   └── seed.py          demo users, firms, routing rules, sample data
    └── tests/               focused on access rules and state changes
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

The login page lists them for one-click sign-in. Sessions use a signed, httpOnly cookie. Every API request resolves the current user from the server-side session, never from anything the client claims.

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
- `storage.py` exposes `save()` and `open()`, so it can be swapped for S3 or another object store without touching callers.

---

## API

All endpoints are under `/api`. Lists take `page` and `page_size` and return `{ items, total, page, page_size }`.

### Auth & reference data
| Method | Path | Purpose |
|---|---|---|
| POST | `/auth/login` | `{email, password}` → sets session cookie |
| POST | `/auth/logout` | clear session |
| GET | `/auth/me` | current user (role, firm) |
| GET | `/auth/demo-users` | seeded demo users for the login picker (no passwords) |
| GET | `/meta` | regions, categories, case statuses (for forms) |

### Plaintiff (`role = plaintiff`)
| Method | Path | Purpose |
|---|---|---|
| POST | `/plaintiff/leads` | submit a lead; routing runs in the same transaction |
| GET | `/plaintiff/leads` | my leads, each with its case status if there is a case |
| GET | `/plaintiff/leads/{id}` | lead + case status + progress updates + documents (no notes, no firm-internal data) |
| POST | `/plaintiff/leads/{id}/documents` | upload a PDF |

### Firm staff (`role = staff`, limited to the current firm)
| Method | Path | Purpose |
|---|---|---|
| GET | `/firm/leads` | inbox; filters: `status`, `category`, `region`, `q` |
| GET | `/firm/leads/{id}` | inspect a lead (including the plaintiff's documents) |
| POST | `/firm/leads/{id}/accept` | creates the case |
| POST | `/firm/leads/{id}/decline` | `{reason}` → lead goes back to admins |
| GET | `/firm/cases` | my firm's cases; filters: `status`, `q` |
| GET | `/firm/cases/{id}` | case, updates, documents, *my firm's* notes |
| POST | `/firm/cases/{id}/updates` | progress update, optionally with a status change |
| GET / POST | `/firm/cases/{id}/notes` | firm-private notes |
| POST | `/firm/cases/{id}/documents` | upload a PDF |

### Admin (`role = admin`)
| Method | Path | Purpose |
|---|---|---|
| GET | `/admin/leads` | search across firms; filters: `q`, `status`, `firm_id`, `category`, `region` |
| GET | `/admin/leads/{id}` | lead + declines + audit history |
| POST | `/admin/leads/{id}/assign` | `{firm_id, reason}`: resolve an unassigned or declined lead, or reassign |
| GET | `/admin/cases` | search across firms; filters: `q`, `status`, `firm_id` |
| GET | `/admin/cases/{id}` | case + updates + documents + **all** notes (by firm) + audit history |
| POST | `/admin/cases/{id}/reassign` | `{firm_id, reason}`: moves the case (and its lead) to the new firm |
| GET | `/admin/audit` | global history; filters: `entity_type`, `entity_id`, `actor_id`, date range |
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
  - leads: `(firm_id, status, created_at)`, `plaintiff_id`, `(status, created_at)`
  - routing rules: `UNIQUE(category, region)`
  - cases: `UNIQUE(lead_id)`, `(firm_id, status)`
  - notes, case updates: `case_id`
  - documents: `lead_id`
  - audit events: `(entity_type, entity_id)`
- **Pagination** on every list: inboxes, search, and a case's updates, notes, documents and history.
- **Access filters run in SQL**, never "load everything, then filter in Python."
- **No N+1 queries**: related data is loaded with joins or eager loading.
- **Search** uses `LIKE` with filters. A full scan of 100k rows takes tens of milliseconds in SQLite. SQLite's built-in full-text search (FTS5) is the next step if needed.

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
- **Closed cases are read-only.** No new updates or uploads, and they can't be reassigned.
- **Tables are created at startup** (`create_all`). Migrations (Alembic) would be the next step for a long-lived deployment.

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
| File named `.pdf` but isn't a PDF, empty, or too large | Rejected (`%PDF-` signature check, size limit enforced while streaming). |
| Malicious filename (`../../etc/passwd`) | The filename is display-only. Files are stored under a random UUID, and downloads send a sanitized `Content-Disposition`. |
| Database insert fails after a file is saved | The stored file is deleted, so no orphan is left. |
| Plaintiff or staff calls another role's routes | 403 (role guard on the router). A record that exists but isn't theirs → 404. |
| Search term contains `%` or `_` | Escaped before `LIKE`. A numeric query also matches by id. |
| Very large `page_size` | Capped at 100. Ordering is `created_at DESC, id DESC` so pages are stable. |
| Routing has no match for (category, region) | The lead is `unassigned`, appears in the admin queue, and the audit log records `lead.unmatched` (actor = system). |
| Progress update with neither a status nor a message | 422. Same-status "changes" are stored as message-only updates. |
