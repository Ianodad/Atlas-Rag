# API

FastAPI service for project management, ingestion orchestration, retrieval, and chat.

## Planned modules

- `src/app.py` application factory
- `src/main.py` ASGI entrypoint
- `src/config.py` environment and settings loading
- `src/dependencies.py` fake auth and shared dependencies
- `src/routes` HTTP routers
- `src/schemas` request and response models
- `src/services` external integrations
- `src/db` database access
- `src/rag` ingestion and retrieval code

## Server environment

The FastAPI server expects these variables to be present in `.env`:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

Optional:

- `API_PORT`
- `APP_ENV`
- `DEV_USER_ID`
- `DEV_USER_EMAIL`
- `DEV_USER_DISPLAY_NAME`
- `REDIS_HOST`
- `REDIS_PORT`
- `SUPABASE_DB_URL`
- `SUPABASE_SERVER_KEY_SOURCE`

## Supabase access mode

The API uses the Supabase Python client with `SUPABASE_URL` plus a server-side key.

Default:

- `SUPABASE_SERVER_KEY_SOURCE=service_role`

This means the API connects through Supabase's HTTP APIs instead of requiring direct Postgres access for normal application work.

Use `SUPABASE_DB_URL` only when you need raw database tooling such as migrations or direct SQL access.

## Local run command

Use a non-default API port to avoid clashes with other local services:

```bash
uvicorn apps.api.src.main:app --reload --port 8011
```

## Current fake-auth behavior

Phase 4 intentionally avoids real authentication.

- The API reads `x-dev-user-id` when provided.
- If the header is missing, it falls back to the seeded demo user.
- The demo user is auto-created on first request if needed.

Current routes:

- `GET /health`
- `GET/POST/GET/DELETE /projects`
- `GET/PUT /projects/{projectId}/settings`
- `GET /projects/{projectId}/files`
- `GET /projects/{projectId}/files/{fileId}`
- `GET/POST /projects/{projectId}/chats`
- `GET/DELETE /chats/{chatId}`
- `POST /chats/{chatId}/messages`
