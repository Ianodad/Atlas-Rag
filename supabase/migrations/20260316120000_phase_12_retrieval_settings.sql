-- Phase 12: add reranking columns and agent_type to project_settings

alter table public.project_settings
add column if not exists reranking_enabled boolean not null default false;

alter table public.project_settings
add column if not exists reranking_model text;

-- Phase 13: agent_type determines which agent handles RAG queries
alter table public.project_settings
add column if not exists agent_type text not null default 'simple_agent'
  check (agent_type in ('simple_agent', 'supervisor_agent'));
