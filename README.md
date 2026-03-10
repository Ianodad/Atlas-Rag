# AtlasRAG

Monorepo scaffold for the AtlasRAG multimodal RAG application.

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
  sql/       schema and SQL functions
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
```

## First steps

1. Install `pnpm` and Python `uv`.
2. From this directory, install frontend dependencies with `pnpm install`.
3. Create Python virtual environments for `apps/api` and `apps/worker`.
4. Start local infra with `docker compose -f infra/compose/docker-compose.yml up -d`.

## Current state

This is the step 1 scaffold plus the initial monorepo folder structure from the reverse-engineering plan. No dependencies have been installed yet.
