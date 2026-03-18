#!/usr/bin/env sh
set -eu

PRESET_API_PORT="${API_PORT:-}"
PRESET_WEB_PORT="${WEB_PORT:-}"

. ./scripts/dev/load-env.sh
load_env_file ./.env

if [ -n "$PRESET_API_PORT" ]; then
  API_PORT="$PRESET_API_PORT"
fi

if [ -n "$PRESET_WEB_PORT" ]; then
  WEB_PORT="$PRESET_WEB_PORT"
fi

API_PORT="${API_PORT:-8011}"
WEB_PORT="${WEB_PORT:-3101}"

cleanup() {
  if [ "${api_pid:-}" ]; then
    kill "$api_pid" 2>/dev/null || true
  fi
  if [ "${worker_pid:-}" ]; then
    kill "$worker_pid" 2>/dev/null || true
  fi
}

trap cleanup INT TERM EXIT

sh scripts/dev/up.sh

(
  cd apps/api
  uv run uvicorn src.main:app --reload --port "$API_PORT"
) &
api_pid=$!

(
  cd apps/worker
  uv run python -m src.worker
) &
worker_pid=$!

pnpm --filter @atlas-rag/web exec next dev --port "$WEB_PORT"
