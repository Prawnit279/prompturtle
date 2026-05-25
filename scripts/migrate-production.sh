#!/usr/bin/env bash
# Run ONCE before first production deploy — never in CI automatically.
# Applies all pending Prisma migrations to the production database.
#
# Usage:
#   DATABASE_URL=<prod-pooler-url> DIRECT_URL=<prod-direct-url> ./scripts/migrate-production.sh
#
# Note: This project uses Supabase MCP for migration authoring, but Prisma migrate deploy
#       is still the correct tool for applying migrations to a Supabase production database.
#       Ensure the prisma/migrations/ directory is populated (run `npx prisma migrate dev`
#       locally first to generate migration files if they don't exist).

set -euo pipefail

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "ERROR: DATABASE_URL is required" >&2
  exit 1
fi

if [[ -z "${DIRECT_URL:-}" ]]; then
  echo "ERROR: DIRECT_URL is required" >&2
  exit 1
fi

echo "Running Prisma migrations against production database..."
echo "DATABASE_URL: ${DATABASE_URL:0:40}..."

cd "$(dirname "$0")/../apps/backend"

npx prisma migrate deploy
npx prisma generate

echo "Migrations complete."
