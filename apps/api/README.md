# API

FastAPI service for project management, ingestion orchestration, retrieval, and chat.

## Planned modules

- `src/main.py` application entrypoint
- `src/config.py` environment and settings loading
- `src/routes` HTTP routers
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
