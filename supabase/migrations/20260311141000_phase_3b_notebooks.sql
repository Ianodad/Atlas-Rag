-- Phase 3B: Notebook Tables for Agent Testing
--
-- A notebook is a developer-facing test session that belongs to a project.
-- Use notebooks to run retrieval queries, full agent pipelines, or side-by-side
-- comparisons of different retrieval strategies, and save the results for later review.
--
-- This is different from "chats":
--   chats       = user-facing conversation history
--   notebooks   = developer testing and evaluation tool
--
-- Depends on: Phase 3 schema (projects table, set_updated_at function)

-- notebooks: one named test session per project
create table if not exists public.notebooks (
  id          uuid        primary key default gen_random_uuid(),
  project_id  uuid        not null references public.projects(id) on delete cascade,
  title       text        not null,
  description text,
  created_at  timestamptz not null default timezone('utc', now()),
  updated_at  timestamptz not null default timezone('utc', now())
);

-- notebook_cells: one query or observation within a notebook
-- Cells are ordered by cell_index (0, 1, 2, ...).
--
-- cell_type controls what happens when you run the cell:
--   "query"      run retrieval only — returns chunks and scores, no LLM call
--   "agent_run"  run the full pipeline — retrieve + generate answer + return reasoning steps
--   "markdown"   free-text note, no execution, documentation block only
--   "comparison" run the same query with two different retrieval configs, show side-by-side
--
-- input examples:
--   query/agent_run: { "query": "What is X?", "retrieval_strategy": "hybrid", "chunks_per_search": 8 }
--   comparison:      { "query": "What is X?", "config_a": {...settings}, "config_b": {...settings} }
--   markdown:        { "text": "## My section\nNotes here." }
--
-- output examples:
--   query:      { "chunks": [{id, retrieval_text, score, page_number, ...}], "latency_ms": 142 }
--   agent_run:  { "answer": "...", "citations": [...], "agent_steps": [...], "latency_ms": 2310 }
--   comparison: { "result_a": {...}, "result_b": {...} }
--
-- status lifecycle:
--   idle    → cell has input but has never been run
--   running → currently executing (streaming or background)
--   done    → execution complete, output is populated
--   error   → execution failed, error_message explains why
create table if not exists public.notebook_cells (
  id            uuid        primary key default gen_random_uuid(),
  notebook_id   uuid        not null references public.notebooks(id) on delete cascade,
  cell_index    integer     not null check (cell_index >= 0),
  cell_type     text        not null check (cell_type in ('query', 'agent_run', 'markdown', 'comparison')),
  input         jsonb       not null default '{}'::jsonb,
  output        jsonb       not null default '{}'::jsonb,
  status        text        not null default 'idle' check (status in ('idle', 'running', 'done', 'error')),
  error_message text,
  executed_at   timestamptz,
  created_at    timestamptz not null default timezone('utc', now()),
  updated_at    timestamptz not null default timezone('utc', now()),
  unique (notebook_id, cell_index)
);

-- Indexes
create index if not exists idx_notebooks_project_id       on public.notebooks(project_id);
create index if not exists idx_notebook_cells_notebook_id on public.notebook_cells(notebook_id);
create index if not exists idx_notebook_cells_status      on public.notebook_cells(status);

-- Auto-update triggers using the set_updated_at function from Phase 3
drop trigger if exists trg_notebooks_set_updated_at on public.notebooks;
create trigger trg_notebooks_set_updated_at
before update on public.notebooks
for each row execute function public.set_updated_at();

drop trigger if exists trg_notebook_cells_set_updated_at on public.notebook_cells;
create trigger trg_notebook_cells_set_updated_at
before update on public.notebook_cells
for each row execute function public.set_updated_at();
