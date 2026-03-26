# AtlasRAG

A production-grade **multimodal RAG** (Retrieval-Augmented Generation) application built as a monorepo. Supports document ingestion (PDF, DOCX, PPTX, Markdown, HTML, URLs), multimodal image extraction, vector + keyword hybrid search, LLM-powered answer generation with streaming, and a full-featured web interface with real-time citations.

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Next.js 16 Frontend                         │
│                  (React 19 · Tailwind · SSE client)                │
│                                                                     │
│   ┌──────────┐  ┌──────────────┐  ┌────────────┐  ┌────────────┐  │
│   │ Projects  │  │  Chat + SSE  │  │ Knowledge  │  │  Document  │  │
│   │   Grid    │  │  Interface   │  │  Sidebar   │  │   Modal    │  │
│   └──────────┘  └──────────────┘  └────────────┘  └────────────┘  │
└────────────────────────────┬────────────────────────────────────────┘
                             │ /api/* proxy
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│                       FastAPI Backend (:8011)                       │
│                                                                     │
│   ┌──────────┐  ┌──────────┐  ┌───────────┐  ┌─────────────────┐  │
│   │ Projects  │  │  Chats   │  │   Files   │  │    Retrieval    │  │
│   │  CRUD     │  │  CRUD    │  │  Upload   │  │  + RAG Service  │  │
│   └──────────┘  └──────────┘  └─────┬─────┘  └────────┬────────┘  │
└──────────────────────────────────────┼─────────────────┼────────────┘
                                       │                 │
                    ┌──────────────────┘                 │
                    ▼                                     ▼
┌──────────────────────────┐        ┌─────────────────────────────────┐
│    Celery Worker Queue   │        │         External LLMs           │
│        (via Redis)       │        │                                 │
│                          │        │  ┌───────────┐  ┌───────────┐  │
│  ┌────────────────────┐  │        │  │  OpenAI   │  │  OpenAI   │  │
│  │  Document Pipeline  │  │        │  │ Embeddings│  │ Chat/GPT  │  │
│  │                    │  │        │  │(3-small)  │  │(Streaming)│  │
│  │  Partition → Chunk │  │        │  └───────────┘  └───────────┘  │
│  │  → Summarize       │  │        └─────────────────────────────────┘
│  │  → Embed → Store   │  │
│  └────────────────────┘  │
└────────────┬─────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     Supabase (Managed)                              │
│                                                                     │
│   ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐     │
│   │  PostgreSQL   │  │   Storage    │  │   pgvector           │     │
│   │  (7 tables)   │  │  (file blobs)│  │  (1536-dim vectors)  │     │
│   └──────────────┘  └──────────────┘  └──────────────────────┘     │
│                                                                     │
│   ┌──────────────┐  ┌──────────────┐                               │
│   │  PostgREST   │  │  Auth / RLS  │                               │
│   └──────────────┘  └──────────────┘                               │
└─────────────────────────────────────────────────────────────────────┘

           ┌───────────────┐
           │     Redis     │
           │  (local Docker│
           │   broker)     │
           └───────────────┘
```

## Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | Next.js 16, React 19, TypeScript, Tailwind CSS v3 |
| **Backend API** | FastAPI (Python 3.12), Pydantic, uvicorn |
| **Worker** | Celery, Redis (broker) |
| **Database** | Supabase PostgreSQL + pgvector (1536-dim embeddings) |
| **Storage** | Supabase Storage (presigned URL uploads) |
| **Document Parsing** | Unstructured API (hosted) — PDF, DOCX, PPTX, MD, TXT, HTML |
| **Embeddings** | OpenAI `text-embedding-3-small` (1536 dimensions) |
| **LLM** | OpenAI GPT-4o (answer generation + chunk summarization) |
| **Monorepo** | pnpm workspaces + Turborepo |
| **Infrastructure** | Docker Compose (Redis), Supabase (managed cloud) |

## Implemented Features

### Monorepo & Infrastructure
- **pnpm + Turborepo** monorepo with `apps/` (web, api, worker) and `packages/` (config, types, ui, prompts)
- **Local Redis** via Docker Compose for Celery task broker
- **Supabase** for managed PostgreSQL, pgvector, file storage, and PostgREST API
- One-command dev startup: `pnpm dev:all`

### Database Schema
- **7 tables**: `projects`, `project_settings`, `project_documents`, `document_chunks`, `chats`, `chat_messages`, `message_feedback`
- SQL migrations managed via Supabase CLI
- `pgvector` extension with `vector(1536)` column and HNSW index for fast similarity search
- GIN indexes for keyword search (`to_tsvector`)

### API (FastAPI)
- Full **CRUD** for projects, chats, and messages
- **File upload**: 3-step presigned URL flow (get URL → client PUT → confirm)
- **URL ingestion**: submit a URL for HTML extraction and processing
- **Document reprocessing**: individual and bulk reprocess endpoints
- **Retrieval service** with 4 strategies:
  - **Vector search** — cosine similarity on pgvector embeddings
  - **Keyword search** — PostgreSQL full-text search with `ts_rank`
  - **Hybrid search** — vector + keyword combined via Reciprocal Rank Fusion (RRF)
  - **Multi-query** — LLM generates sub-queries, results merged with RRF
- **Answer generation** with SSE streaming (`text/event-stream`)
  - Events: `status`, `token`, `error`, `done`
  - Guardrail check → retrieve context → stream LLM response
- **Citations** returned with each answer: document name, page number, chunk index, text snippet
- Fake auth middleware for development (configurable user context)
- CORS, health checks, structured logging

### Document Processing Pipeline (Celery Worker)
- **Partitioning**: Unstructured API extracts elements (text, titles, tables, images) from uploaded files/URLs
  - Multimodal image extraction (`extract_image_block_types: Image, Table`)
  - Supports PDF, DOCX, PPTX, Markdown, plain text, HTML
- **Chunking**: Section-aware chunking with configurable soft/hard token limits
  - Preserves document structure (headings, sections)
  - Maintains image associations through the pipeline
  - Per-element metadata: page numbers, section titles, element types
- **Summarization**: LLM-powered retrieval-focused summaries for complex chunks
  - Tables and images get specialized summarization prompts
  - Heuristic fallback for simple text-only chunks
  - Token-efficient image handling (counts instead of raw base64)
- **Embeddings**: OpenAI `text-embedding-3-small` batch embedding
  - Batched API calls with retry logic
  - Stored as `vector(1536)` in `document_chunks`
- **Pipeline status tracking**: `queued → processing → partitioning → chunking → summarising → embedding → completed/failed`
  - Detailed `processing_details` JSONB with phase timestamps, diagnostics, and error info
  - Automatic retry (2 retries with exponential backoff)
- MIME type validation and file size limits

### Frontend (Next.js + React)
- **Project workspace**: create/switch projects, project settings panel
- **Knowledge base sidebar**: document list with upload status indicators, file upload (drag-and-drop), URL ingestion, settings tab (chunking params, retrieval strategy, model selection)
- **Chat interface**: message bubbles with Markdown rendering, SSE streaming with live token display
- **Citation display**:
  - Citations grouped by source document with pill-style badges
  - Hover tooltips showing text snippet previews
  - Click-to-expand citation modal with full details and chunk images
- **Document modal**: processing pipeline stepper, document metadata, extracted image gallery with lightbox viewer
- **Image lightbox**: full-screen viewer with keyboard navigation for extracted document images
- **Reprocessing**: trigger document reprocessing from the UI when images are missing
- 5-second polling for active document processing status
- Responsive layout with viewport-locked sidebars
- Custom `neon-*` dark theme color palette

### Processing Visibility
- Real-time document processing status in the knowledge sidebar
- Document modal shows pipeline phase stepper (partition → chunk → summarize → embed)
- Processing diagnostics: element counts, chunk previews, timing data
- Error display with retry status

### Chat UX
- Real-time SSE streaming with token-by-token display
- Streaming status indicator
- Message feedback (thumbs up/down) stored in `message_feedback` table
- Chat history with conversation management (create, delete, switch)

### Hardening & Reliability
- Structured logging throughout API and worker
- Celery task retries with exponential backoff (30s × attempt)
- Soft/hard time limits on worker tasks (9/10 min)
- OpenAI client timeouts (30s) to prevent indefinite hangs
- MIME type validation on upload
- File size limits
- Diagnostic data size management (strip base64 from processing_details)

## Project Layout

```
apps/
  web/           Next.js 16 frontend (port 3101)
  api/           FastAPI backend (port 8011)
  worker/        Celery document processing worker
packages/
  config/        shared config/constants
  types/         shared TypeScript types
  ui/            shared frontend components
  prompts/       prompt templates and retrieval rules
infra/
  compose/       Docker Compose for local Redis
supabase/
  migrations/    SQL migration files
```

## Default Ports

| Service | Port |
|---|---|
| Web client | `3101` |
| FastAPI API | `8011` |
| Redis | `6379` |

## Prerequisites

1. **Docker** — Desktop or Engine with Compose plugin
2. **Node.js 22 LTS** (or compatible)
3. **pnpm** — package manager
4. **Python 3.12** + **uv** — for API and worker
5. **Supabase project** — cloud-hosted
6. **OpenAI API key** — for embeddings and LLM
7. **Unstructured API key** — for document parsing

Copy `.env.example` to `.env` and fill in all values.

## Quick Start

```bash
# 1. Install JS dependencies
pnpm install

# 2. Install Python dependencies
cd apps/api && uv sync && cd ../worker && uv sync && cd ../..

# 3. Start everything (Redis + API + Worker + Web)
pnpm dev:all
```

Or start services individually:

```bash
pnpm infra:up                         # Redis
pnpm --filter @atlas-rag/web dev      # Next.js on :3101
uvicorn apps.api.src.main:app --reload --port 8011  # API
pnpm dev:worker                        # Celery worker
```

## Environment Variables

| Variable | Purpose |
|---|---|
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_ANON_KEY` | Supabase anonymous key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (server-side only) |
| `OPENAI_API_KEY` | OpenAI API key for embeddings + LLM |
| `UNSTRUCTURED_API_KEY` | Unstructured hosted API key |
| `UNSTRUCTURED_API_URL` | Unstructured API endpoint |
| `REDIS_HOST` / `REDIS_PORT` | Redis connection (default `localhost:6379`) |
| `NEXT_PUBLIC_SUPABASE_URL` | Client-side Supabase URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Client-side Supabase anon key |

## Troubleshooting

- **Redis port conflict**: Change `REDIS_PORT` in `.env` and restart
- **Supabase connection fails**: Verify URL, anon key, and service role key in `.env`
- **Vector search unavailable**: Enable the `vector` extension in Supabase dashboard
- **Document parsing fails**: Check `UNSTRUCTURED_API_KEY` is set; check worker is running (`pnpm dev:worker`)
- **Worker not picking up tasks**: Restart the worker process — Celery doesn't auto-reload on code changes
- **Images not extracted**: Ensure documents are processed after the `extract_image_block_types` fix; reprocess from document modal if needed
- **Slow document listing**: Large `processing_details` JSONB can cause timeouts on free-tier Supabase; reprocess affected documents
