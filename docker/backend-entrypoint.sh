#!/usr/bin/env bash
set -euo pipefail

cd /app

# Optionally source env file if Docker env vars were not provided
ENV_FILE_PATH=${ENV_FILE:-/app/.env.production}
if [[ -z "${DATABASE_URL:-}" && -f "$ENV_FILE_PATH" ]]; then
  echo "Loading environment variables from ${ENV_FILE_PATH}"
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE_PATH"
  set +a
fi

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "DATABASE_URL environment variable must be set" >&2
  exit 1
fi

echo "Running Prisma generate..."
pnpm --filter @repo/database run generate

echo "Applying Prisma migrations..."
pnpm --filter @repo/database run deploy

echo "Starting backend..."
cd packages/backend
exec node dist/index.js
