create extension if not exists pgcrypto;
create extension if not exists vector;

create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  email text unique,
  display_name text,
  external_auth_id text unique,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  name text not null,
  description text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.project_settings (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null unique references public.projects(id) on delete cascade,
  embedding_model text not null default 'text-embedding-3-small',
  retrieval_strategy text not null default 'hybrid',
  chunks_per_search integer not null default 8 check (chunks_per_search > 0),
  final_context_size integer not null default 12 check (final_context_size > 0),
  similarity_threshold double precision not null default 0.2 check (similarity_threshold >= 0 and similarity_threshold <= 1),
  query_variation_count integer not null default 3 check (query_variation_count >= 0),
  vector_weight double precision not null default 0.7 check (vector_weight >= 0 and vector_weight <= 1),
  keyword_weight double precision not null default 0.3 check (keyword_weight >= 0 and keyword_weight <= 1),
  system_prompt text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint project_settings_weight_sum_chk check (
    abs((vector_weight + keyword_weight) - 1.0) < 0.000001
  )
);

create table if not exists public.project_documents (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  filename text not null,
  mime_type text,
  storage_bucket text,
  storage_path text,
  source_type text not null check (source_type in ('file', 'url')),
  source_url text,
  processing_status text not null default 'pending' check (
    processing_status in (
      'pending',
      'queued',
      'processing',
      'partitioning',
      'chunking',
      'summarising',
      'vectorization',
      'completed',
      'failed'
    )
  ),
  processing_details jsonb not null default '{}'::jsonb,
  page_count integer,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.document_chunks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  document_id uuid not null references public.project_documents(id) on delete cascade,
  chunk_index integer not null check (chunk_index >= 0),
  retrieval_text text not null,
  original_content jsonb not null default '{}'::jsonb,
  modality_flags jsonb not null default '[]'::jsonb,
  embedding vector(1536),
  page_number integer,
  token_count integer,
  metadata jsonb not null default '{}'::jsonb,
  retrieval_tsv tsvector generated always as (
    to_tsvector('english', coalesce(retrieval_text, ''))
  ) stored,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (document_id, chunk_index)
);

create table if not exists public.chats (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  title text not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  chat_id uuid not null references public.chats(id) on delete cascade,
  role text not null check (role in ('system', 'user', 'assistant')),
  content text not null,
  citations jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_projects_user_id on public.projects(user_id);
create index if not exists idx_project_documents_project_id on public.project_documents(project_id);
create index if not exists idx_project_documents_processing_status on public.project_documents(processing_status);
create index if not exists idx_document_chunks_project_id on public.document_chunks(project_id);
create index if not exists idx_document_chunks_document_id on public.document_chunks(document_id);
create index if not exists idx_document_chunks_page_number on public.document_chunks(page_number);
create index if not exists idx_document_chunks_retrieval_tsv on public.document_chunks using gin (retrieval_tsv);
create index if not exists idx_document_chunks_embedding on public.document_chunks using hnsw (embedding vector_cosine_ops);
create index if not exists idx_chats_project_id on public.chats(project_id);
create index if not exists idx_messages_chat_id on public.messages(chat_id);
create index if not exists idx_messages_role on public.messages(role);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists trg_users_set_updated_at on public.users;
create trigger trg_users_set_updated_at
before update on public.users
for each row
execute function public.set_updated_at();

drop trigger if exists trg_projects_set_updated_at on public.projects;
create trigger trg_projects_set_updated_at
before update on public.projects
for each row
execute function public.set_updated_at();

drop trigger if exists trg_project_settings_set_updated_at on public.project_settings;
create trigger trg_project_settings_set_updated_at
before update on public.project_settings
for each row
execute function public.set_updated_at();

drop trigger if exists trg_project_documents_set_updated_at on public.project_documents;
create trigger trg_project_documents_set_updated_at
before update on public.project_documents
for each row
execute function public.set_updated_at();

drop trigger if exists trg_document_chunks_set_updated_at on public.document_chunks;
create trigger trg_document_chunks_set_updated_at
before update on public.document_chunks
for each row
execute function public.set_updated_at();

drop trigger if exists trg_chats_set_updated_at on public.chats;
create trigger trg_chats_set_updated_at
before update on public.chats
for each row
execute function public.set_updated_at();

create or replace function public.create_default_project_settings()
returns trigger
language plpgsql
as $$
begin
  insert into public.project_settings (project_id)
  values (new.id)
  on conflict (project_id) do nothing;
  return new;
end;
$$;

drop trigger if exists trg_projects_create_default_settings on public.projects;
create trigger trg_projects_create_default_settings
after insert on public.projects
for each row
execute function public.create_default_project_settings();

create or replace function public.search_document_chunks_vector(
  query_embedding vector(1536),
  match_count integer default 8,
  filter_project_id uuid default null
)
returns table (
  chunk_id uuid,
  project_id uuid,
  document_id uuid,
  chunk_index integer,
  retrieval_text text,
  page_number integer,
  similarity double precision
)
language sql
stable
as $$
  select
    dc.id as chunk_id,
    dc.project_id,
    dc.document_id,
    dc.chunk_index,
    dc.retrieval_text,
    dc.page_number,
    1 - (dc.embedding <=> query_embedding) as similarity
  from public.document_chunks dc
  where dc.embedding is not null
    and (filter_project_id is null or dc.project_id = filter_project_id)
  order by dc.embedding <=> query_embedding
  limit greatest(match_count, 1);
$$;

create or replace function public.search_document_chunks_keyword(
  query_text text,
  match_count integer default 8,
  filter_project_id uuid default null
)
returns table (
  chunk_id uuid,
  project_id uuid,
  document_id uuid,
  chunk_index integer,
  retrieval_text text,
  page_number integer,
  keyword_rank real
)
language sql
stable
as $$
  with query as (
    select websearch_to_tsquery('english', query_text) as ts_query
  )
  select
    dc.id as chunk_id,
    dc.project_id,
    dc.document_id,
    dc.chunk_index,
    dc.retrieval_text,
    dc.page_number,
    ts_rank_cd(dc.retrieval_tsv, query.ts_query) as keyword_rank
  from public.document_chunks dc
  cross join query
  where query.ts_query @@ dc.retrieval_tsv
    and (filter_project_id is null or dc.project_id = filter_project_id)
  order by keyword_rank desc, dc.created_at asc
  limit greatest(match_count, 1);
$$;
