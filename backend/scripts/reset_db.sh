#!/usr/bin/env bash
# Drop and re-seed the SQLite database.
#
# Usage:
#   ./scripts/reset_db.sh          # local virtualenv
#   docker-compose run --rm backend ./scripts/reset_db.sh   # in container
set -euo pipefail

cd "$(dirname "$0")/.."

if [[ -f data/hzev.db ]]; then
  rm -f data/hzev.db
fi

python -m db.seed --force
echo "✓ database reset and re-seeded."
