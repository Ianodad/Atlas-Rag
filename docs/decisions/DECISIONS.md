# AtlasRAG Decisions

This file records architecture patterns, defaults, and tradeoffs for the repo.

Update this file when a change does one of these things:

- introduces a new platform dependency
- changes a major integration boundary
- replaces a default tool or workflow
- adds a pattern other contributors should follow
- changes a previous decision in a meaningful way

## Working Rules

1. Prefer append-only updates.
2. If a decision changes, mark the older one as superseded instead of deleting it.
3. Capture the reason, not just the outcome.
4. Link the affected files or directories when the decision is implementation-specific.

## Decision Template

Use this format for future updates:

```md
## DEC-00X: Short title
- Date: YYYY-MM-DD
- Status: accepted | superseded
- Context:
- Decision:
- Tradeoffs:
- Affected paths:
```

## DEC-001: Local infrastructure uses Docker Compose
- Date: 2026-03-10
- Status: accepted
- Context:
  The project still needs a lightweight local service boundary for worker development.
- Decision:
  Use `docker compose` only for the services that still need to run locally, starting with Redis.
- Tradeoffs:
  This keeps the local stack small, but it also means part of development now depends on a remote Supabase project being configured correctly.
- Affected paths:
  `infra/compose/`, `scripts/dev/`, `README.md`

## DEC-002: Postgres + pgvector is the default data plane
- Date: 2026-03-10
- Status: superseded
- Context:
  The first Phase 2 draft used a self-hosted Postgres container with `pgvector`.
- Decision:
  Superseded by DEC-005.
- Tradeoffs:
  The original choice was operationally clear, but it was heavier than necessary for the current build stage.
- Affected paths:
  `infra/compose/docker-compose.yml`, `infra/sql/`

## DEC-003: Use MinIO locally instead of cloud object storage
- Date: 2026-03-10
- Status: superseded
- Context:
  The first Phase 2 draft used MinIO as a local S3-compatible storage layer.
- Decision:
  Superseded by DEC-006.
- Tradeoffs:
  MinIO was workable, but it added another local service and another admin surface during early development.
- Affected paths:
  `infra/compose/docker-compose.yml`, `README.md`

## DEC-004: Keep Redis as a dedicated worker coordination dependency
- Date: 2026-03-10
- Status: accepted
- Context:
  The source architecture uses Celery-style background processing. Redis is the simplest local broker/cache to support that direction.
- Decision:
  Run Redis as a separate local service now, even before worker jobs are fully implemented.
- Tradeoffs:
  This adds another service to the local stack, but it avoids redesigning the worker setup later.
- Affected paths:
  `infra/compose/docker-compose.yml`, `apps/worker/`

## DEC-005: Use managed Supabase for database and vector support in Phase 2
- Date: 2026-03-10
- Status: accepted
- Context:
  The project needs Postgres, vector search, dashboard access, and a simpler setup path than maintaining a full local database stack.
- Decision:
  Use a managed Supabase project as the default Phase 2 backend for Postgres and `pgvector`.
- Tradeoffs:
  This reduces local setup and keeps the platform cohesive, but it introduces a dependency on external project credentials and a network-reachable Supabase environment.
- Affected paths:
  `.env.example`, `README.md`, `supabase/`

## DEC-006: Use Supabase Storage instead of local MinIO in Phase 2
- Date: 2026-03-10
- Status: accepted
- Context:
  The project already needs Supabase for the database path, and early development benefits from fewer infrastructure pieces.
- Decision:
  Use Supabase Storage for uploads instead of maintaining a separate local MinIO service.
- Tradeoffs:
  This simplifies the stack and aligns storage with the same platform as the database, but it reduces fully offline local development.
- Affected paths:
  `.env.example`, `README.md`, `infra/compose/docker-compose.yml`

## DEC-007: FastAPI loads server configuration from explicit environment settings
- Date: 2026-03-10
- Status: accepted
- Context:
  The API now needs server-only Supabase and Redis configuration, and ad hoc environment reads would become brittle as routes and services grow.
- Decision:
  Centralize FastAPI configuration in a settings module using `pydantic-settings`, with startup validation for required server variables.
- Tradeoffs:
  This adds one small dependency, but it creates a consistent and testable configuration boundary for the API.
- Affected paths:
  `apps/api/src/`, `apps/api/pyproject.toml`, `.env.example`

## DEC-008: Development app ports avoid the common defaults
- Date: 2026-03-11
- Status: accepted
- Context:
  Ports `3000` and `8000` frequently collide with other local projects and tools.
- Decision:
  Use `3101` as the default web port and `8011` as the default FastAPI port in local development documentation and scripts.
- Tradeoffs:
  This slightly diverges from ecosystem defaults, but it reduces local setup friction in multi-project environments.
- Affected paths:
  `apps/web/package.json`, `README.md`, `apps/api/README.md`, `.env.example`

## DEC-009: FastAPI uses the Supabase Python client as the default server integration
- Date: 2026-03-11
- Status: accepted
- Context:
  Direct Postgres connectivity is harder to validate across environments and is not required for most application-level CRUD and storage flows.
- Decision:
  Use the Supabase Python client with `SUPABASE_URL` and a server-side key as the default FastAPI integration path, while keeping `SUPABASE_DB_URL` optional for migrations and raw SQL tooling.
- Tradeoffs:
  This simplifies server setup and aligns the API with the hosted Supabase surface, but it trades some direct SQL flexibility for API-based access patterns in the core app path.
- Affected paths:
  `apps/api/src/`, `apps/api/README.md`, `.env.example`, `README.md`

## DEC-010: The Phase 3 schema keeps retrieval text separate from original content
- Date: 2026-03-11
- Status: accepted
- Context:
  Document chunks need to support both efficient search and grounded answer generation. A single overloaded content column makes those goals fight each other.
- Decision:
  Store `retrieval_text` for search, `original_content` as JSONB for source fidelity, and `modality_flags` for multimodal metadata in `document_chunks`.
- Tradeoffs:
  This adds some schema complexity and storage overhead, but it preserves better retrieval tuning and richer final-answer context.
- Affected paths:
  `supabase/migrations/`, `supabase/seed.sql`, `packages/types/src/index.ts`

## DEC-011: Retrieval support is built into the schema baseline
- Date: 2026-03-11
- Status: accepted
- Context:
  Phase 3 should produce a database that is ready for hybrid search, not just generic CRUD tables.
- Decision:
  Add the `vector` extension, generated `tsvector` search column, vector and keyword indexes, and baseline SQL functions for vector and keyword chunk search in the initial migration.
- Tradeoffs:
  This makes the first migration heavier, but it avoids a second schema rewrite when retrieval work starts.
- Affected paths:
  `supabase/migrations/20260311140000_phase_3_initial_schema.sql`

## DEC-012: Notebook execution history is stored separately from chats
- Date: 2026-03-12
- Status: accepted
- Context:
  Developer testing sessions for retrieval and agent experiments have a different lifecycle and purpose from user-facing chat history.
- Decision:
  Model notebooks and notebook cells as separate tables linked to projects, with cell input/output stored as JSONB and an execution status lifecycle independent of chats and messages.
- Tradeoffs:
  This adds more schema surface area, but it keeps evaluation workflows isolated from customer conversation data and makes agent-testing features easier to evolve.
- Affected paths:
  `supabase/migrations/20260311141000_phase_3b_notebooks.sql`, `supabase/seed.sql`, `packages/types/src/index.ts`

## DEC-013: Phase 4 uses fake auth with a dev user header before real authentication
- Date: 2026-03-12
- Status: accepted
- Context:
  The API needs ownership-aware CRUD routes before authentication is designed and integrated.
- Decision:
  Use `x-dev-user-id` with a seeded demo user fallback so project, settings, file, and chat routes can enforce per-user access without introducing real auth yet.
- Tradeoffs:
  This is not production-safe, but it keeps product development moving and makes later auth replacement a narrower change.
- Affected paths:
  `apps/api/src/`, `.env.example`, `apps/api/README.md`

## DEC-014: Project settings explicitly choose the answer model provider
- Date: 2026-03-12
- Status: accepted
- Context:
  The product needs a project-level switch between OpenAI and Google Gemini without forcing provider choice into application code defaults.
- Decision:
  Add `llm_provider` and `llm_model` to `project_settings`, defaulting to OpenAI but allowing `google_gemini` for later answer-generation work.
- Tradeoffs:
  This adds schema and API surface now, but it avoids a breaking settings redesign when model routing is implemented.
- Affected paths:
  `supabase/migrations/20260312103000_phase_5_project_chat_crud_and_llm_settings.sql`, `supabase/seed.sql`, `packages/types/src/index.ts`, `apps/api/src/`
