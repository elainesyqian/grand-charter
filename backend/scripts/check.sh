#!/usr/bin/env bash
# Run the same backend checks as CI. Usage (from backend/): scripts/check.sh [--fix]
set -euo pipefail
cd "$(dirname "$0")/.."

PYTHON="${PYTHON:-$( [[ -x .venv/bin/python ]] && echo .venv/bin/python || echo python )}"
export PYTHON

if [[ "${1:-}" == "--fix" ]]; then
  "$PYTHON" -m ruff check --fix .
  "$PYTHON" -m ruff format .
fi

echo "==> ruff check";        "$PYTHON" -m ruff check .
echo "==> ruff format --check"; "$PYTHON" -m ruff format --check .
echo "==> pytest";            "$PYTHON" -m pytest -q
echo "==> smoke test";        scripts/smoke_test.sh
echo "All backend checks passed."
