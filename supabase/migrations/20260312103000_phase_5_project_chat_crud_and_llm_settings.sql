alter table public.project_settings
add column if not exists llm_provider text not null default 'openai'
  check (llm_provider in ('openai', 'google_gemini'));

alter table public.project_settings
add column if not exists llm_model text not null default 'gpt-4.1-mini';

update public.project_settings
set
  llm_provider = coalesce(llm_provider, 'openai'),
  llm_model = coalesce(llm_model, 'gpt-4.1-mini');
