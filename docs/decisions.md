# Scale, decisions & edge cases

[← Back to README](../README.md)

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

## SQLite now, Postgres later

SQLite needs zero setup, and WAL mode lets reads continue during writes. Its real limits are **one writer at a time** and **one machine**, so it can't sit behind several API servers. All database access goes through SQLAlchemy, and the connection comes from `DATABASE_URL`, so moving to Postgres is a config change, not a rewrite. In the same way, `storage.py` lets local disk be swapped for S3.

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
- **The admin queue needed to show who declined each lead and why,** without loading every lead's detail. Admin lead search results now include `latest_decline`, loaded with the list query so it doesn't add a query per row.
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
