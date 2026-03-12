# AtlasRAG

Monorepo scaffold for the AtlasRAG multimodal RAG application.

This repository is currently at:

- Phase 1 complete: monorepo scaffold
- Phase 2 in place: Supabase-backed infrastructure setup and local runbooks

## Default App Ports

To avoid common local conflicts, this repo uses:

- web client: `3101`
- FastAPI API: `8011`
- Redis: `6379`

## Layout

```text
apps/
  web/       Next.js frontend
  api/       FastAPI backend
  worker/    background worker
packages/
  config/    shared config/constants
  types/     shared TypeScript types
  ui/        shared frontend components
  prompts/   prompt templates and retrieval rules
infra/
  compose/   local infrastructure
  docker/    service Dockerfiles
scripts/
  dev/       helper scripts
  seed/      seed data scripts
  eval/      evaluation scripts
docs/
  architecture/  architecture notes
  api/           API references
  decisions/     ADRs and tradeoffs
examples/
  sample-docs/   local sample ingestion fixtures
supabase/
  migrations/    Supabase SQL migrations
```

## Phase 2: Local Infrastructure

Phase 2 now uses Supabase instead of self-hosting raw Postgres and MinIO locally.

That gives you:

- Supabase-managed Postgres
- Supabase `pgvector` support
- Supabase Storage
- Supabase dashboard and API keys
- local Redis for worker coordination

This is the simpler build path because the project no longer has to run and maintain a local database, local object storage, and separate admin tools during early development.

## Prerequisites

1. Install Docker Desktop or Docker Engine with the Compose plugin.
2. Install Node.js 22 LTS or another Next.js 16 compatible LTS release.
3. Install `pnpm`.
4. Install Python 3.12 and `uv`.
5. Create a Supabase project.
6. Copy `.env.example` to `.env` and fill in the Supabase values.

## Quick Start

1. Install workspace dependencies:

```bash
pnpm install
```

2. Start local Redis:

```bash
pnpm infra:up
```

3. Check local service status:

```bash
pnpm infra:status
```

4. Stop local Redis when finished:

```bash
pnpm infra:down
```

5. Follow logs:

```bash
pnpm infra:logs
pnpm infra:logs redis
```

6. Start the current local stack with one command:

```bash
pnpm dev:all
```

That command:

- starts local Redis
- starts the FastAPI API on `8011`
- starts the Next.js app on `3101`
- stops the API child process when you exit

If you start the app processes manually instead, use the repo defaults:

```bash
pnpm --filter @atlas-rag/web dev
uvicorn apps.api.src.main:app --reload --port 8011
```

## What Runs Where

| Component | Purpose | Where it runs |
|---|---|---|
| Supabase Postgres | primary relational DB + vector store | managed by Supabase |
| Supabase Storage | file uploads and object storage | managed by Supabase |
| Supabase dashboard/API | project admin, keys, SQL editor, APIs | managed by Supabase |
| Redis | worker broker / cache | local Docker on `localhost:6379` |

## Supabase Setup

1. Create a new Supabase project.
2. In the project dashboard, collect:
   - project URL
   - anon key
   - service role key
   - Postgres connection string
3. Put those values into `.env`.
4. Enable the `vector` extension in Supabase if it is not already enabled.
5. Create a storage bucket for documents when the upload flow starts.

Supabase’s platform already gives you Postgres, Storage, and vector support in one place, which is why this replaces the earlier local Postgres and MinIO setup.

## Required Environment Variables

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `REDIS_HOST`
- `REDIS_PORT`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

Keep `SUPABASE_SERVICE_ROLE_KEY` server-side only. Do not expose it in the web app.

For the FastAPI server, the default integration path is now the Supabase Python client over `SUPABASE_URL`, not direct Postgres. Keep `SUPABASE_DB_URL` only for migrations or raw SQL tooling.

## Redis

- Redis remains local because the worker/broker flow is independent of whether the database is managed by Supabase.
- This keeps background-job development fast without forcing you to self-host the whole backend platform.

## Schema Workflow

- Do not use Docker init SQL for database bootstrapping anymore.
- Store future SQL in [supabase/migrations/README.md](/home/adera/Documents/Rag Tut/atlas-rag/supabase/migrations/README.md) and replace that placeholder with real migrations in Phase 3.
- Use the Supabase SQL editor or Supabase migration tooling when the schema work starts.

## Recommended Local Workflow

1. Bring up Redis first with `pnpm infra:up`.
2. Confirm Redis is healthy with `pnpm infra:status`.
3. Verify your `.env` points at a real Supabase project.
4. Keep API and worker processes outside Docker until the internal service boundaries stabilize.
5. Treat Supabase as the source of truth for database and storage configuration.

## Verification Checklist

After setup, verify:

- the Supabase dashboard is reachable
- the Supabase API keys are present in `.env`
- Redis is running locally on `localhost:6379`

You can verify the local part with:

```bash
pnpm infra:status
pnpm infra:logs redis
```

Expected outcome:

- Redis is healthy
- Supabase project is reachable
- Supabase credentials are configured locally

## Troubleshooting

### Redis port already in use

Edit `.env` and change:

- `REDIS_PORT`

Then restart the stack.

### Supabase connection fails

Check:

- the exact project URL
- the anon key
- the service role key
- the database password embedded in `SUPABASE_DB_URL`

### Vector search is unavailable

Enable the `vector` extension in the Supabase dashboard before implementing retrieval features.

### Storage bucket is missing

Create the application bucket in Supabase Storage when the upload flow starts.

## Architecture Decisions

Architecture patterns and tradeoffs live in [DECISIONS.md](/home/adera/Documents/Rag Tut/atlas-rag/docs/decisions/DECISIONS.md).

When making changes, update that file if the change affects:

- infrastructure defaults
- service boundaries
- major dependency choices
- shared engineering patterns

## Current state

This repo now has:

- the step 1 monorepo scaffold
- the phase 2 Supabase-backed infrastructure setup
- local Redis scripts for start, stop, status, and logs
- an architecture decision log for future changes
