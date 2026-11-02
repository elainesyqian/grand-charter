#!/usr/bin/env bash
# Build verification: seed a throwaway database, boot the real server, and hit it over HTTP.
# Usage (from backend/, with the venv active or PYTHON set): scripts/smoke_test.sh
set -euo pipefail

PYTHON="${PYTHON:-python}"
PORT="${SMOKE_PORT:-8799}"
BASE="http://127.0.0.1:${PORT}"

WORK="$(mktemp -d)"
export DATABASE_URL="sqlite:///${WORK}/smoke.db"
export STORAGE_DIR="${WORK}/storage"
export SECRET_KEY="smoke-test"
COOKIES="${WORK}/cookies.txt"

SERVER_PID=""
cleanup() {
  if [[ -n "$SERVER_PID" ]]; then kill "$SERVER_PID" 2>/dev/null || true; fi
  rm -rf "$WORK"
}
trap cleanup EXIT

fail() {
  echo "SMOKE FAIL: $*" >&2
  if [[ -f "${WORK}/server.log" ]]; then echo "--- server log ---" >&2; cat "${WORK}/server.log" >&2; fi
  exit 1
}

echo "==> Seeding demo data"
"$PYTHON" -m app.seed --reset >/dev/null

echo "==> Starting server on :${PORT}"
"$PYTHON" -m uvicorn app.main:app --host 127.0.0.1 --port "$PORT" >"${WORK}/server.log" 2>&1 &
SERVER_PID=$!

for _ in $(seq 1 50); do
  curl -fsS "${BASE}/api/health" >/dev/null 2>&1 && break
  kill -0 "$SERVER_PID" 2>/dev/null || fail "server exited during startup"
  sleep 0.2
done
curl -fsS "${BASE}/api/health" >/dev/null || fail "server never became healthy"

# expect <status> <method> <path> [curl args...]
expect() {
  local want="$1" method="$2" path="$3"
  shift 3
  local got
  got="$(curl -sS -o "${WORK}/body.json" -w '%{http_code}' -X "$method" -b "$COOKIES" -c "$COOKIES" "$@" "${BASE}${path}")"
  [[ "$got" == "$want" ]] || fail "$method $path -> $got (expected $want): $(cat "${WORK}/body.json")"
  echo "    ok  $method $path -> $got"
}

login() {
  rm -f "$COOKIES"
  expect 200 POST /api/auth/login -H 'content-type: application/json' \
    -d "{\"email\":\"$1\",\"password\":\"demo123\"}"
}

echo "==> Checking endpoints"
expect 200 GET /openapi.json
expect 200 GET /api/meta
expect 401 GET /api/auth/me

login plaintiff1@demo
expect 200 GET /api/plaintiff/leads
expect 201 POST /api/plaintiff/leads -H 'content-type: application/json' \
  -d '{"name":"Smoke Test","email":"smoke@example.com","region":"west","category":"employment","description":"CI smoke test"}'
expect 403 GET /api/admin/leads

login attorney.a@demo
expect 200 GET /api/firm/leads
expect 200 GET /api/firm/cases

login admin@demo
expect 200 GET "/api/admin/leads?status=unassigned&status=declined"
expect 200 GET /api/admin/audit
"$PYTHON" -c "import json,sys; d=json.load(open(sys.argv[1])); assert d['total'] > 0, d" "${WORK}/body.json" \
  || fail "audit log is empty after seeding"

echo "==> Smoke test passed"
