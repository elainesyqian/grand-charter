# API & frontend routes

[← Back to README](../README.md)

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
| GET | `/auth/demo-users` | seeded demo accounts for the login page's email suggestions (no passwords) |
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
| GET | `/admin/leads` | search across firms; filters: `q`, `status`, `firm_id`, `category`, `region`, `created_from`, `created_to`. The queue is `?status=unassigned&status=declined`. Each row includes `latest_decline` (firm, person, reason) |
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

## Frontend routes

| Route | Role | Screen |
|---|---|---|
| `/login` | – | email + password sign-in (email suggestions) |
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
