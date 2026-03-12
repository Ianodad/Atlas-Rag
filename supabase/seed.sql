insert into public.users (
  id,
  email,
  display_name,
  external_auth_id
)
values (
  '00000000-0000-0000-0000-000000000001',
  'demo@atlasrag.local',
  'Demo User',
  'dev-demo-user'
)
on conflict (id) do update
set
  email = excluded.email,
  display_name = excluded.display_name,
  external_auth_id = excluded.external_auth_id;

insert into public.projects (
  id,
  user_id,
  name,
  description
)
values (
  '10000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000001',
  'AtlasRAG Demo Project',
  'Seeded project for local development and API scaffolding.'
)
on conflict (id) do update
set
  user_id = excluded.user_id,
  name = excluded.name,
  description = excluded.description;

insert into public.project_settings (
  id,
  project_id,
  embedding_model,
  retrieval_strategy,
  chunks_per_search,
  final_context_size,
  similarity_threshold,
  query_variation_count,
  vector_weight,
  keyword_weight,
  system_prompt
)
values (
  '20000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000001',
  'text-embedding-3-small',
  'hybrid',
  8,
  12,
  0.2,
  3,
  0.7,
  0.3,
  'Answer with citations grounded in retrieved project documents.'
)
on conflict (project_id) do update
set
  embedding_model = excluded.embedding_model,
  retrieval_strategy = excluded.retrieval_strategy,
  chunks_per_search = excluded.chunks_per_search,
  final_context_size = excluded.final_context_size,
  similarity_threshold = excluded.similarity_threshold,
  query_variation_count = excluded.query_variation_count,
  vector_weight = excluded.vector_weight,
  keyword_weight = excluded.keyword_weight,
  system_prompt = excluded.system_prompt;

insert into public.project_documents (
  id,
  project_id,
  filename,
  mime_type,
  storage_bucket,
  storage_path,
  source_type,
  source_url,
  processing_status,
  processing_details,
  page_count,
  metadata
)
values (
  '30000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000001',
  'atlas-rag-overview.pdf',
  'application/pdf',
  'documents',
  'demo/atlas-rag-overview.pdf',
  'file',
  null,
  'completed',
  '{"steps":["partitioning","chunking","vectorization"],"last_step":"completed"}'::jsonb,
  2,
  '{"source":"seed"}'::jsonb
)
on conflict (id) do update
set
  project_id = excluded.project_id,
  filename = excluded.filename,
  mime_type = excluded.mime_type,
  storage_bucket = excluded.storage_bucket,
  storage_path = excluded.storage_path,
  source_type = excluded.source_type,
  source_url = excluded.source_url,
  processing_status = excluded.processing_status,
  processing_details = excluded.processing_details,
  page_count = excluded.page_count,
  metadata = excluded.metadata;

insert into public.document_chunks (
  id,
  project_id,
  document_id,
  chunk_index,
  retrieval_text,
  original_content,
  modality_flags,
  page_number,
  token_count,
  metadata
)
values
(
  '40000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000001',
  '30000000-0000-0000-0000-000000000001',
  0,
  'AtlasRAG combines project management, multimodal ingestion, retrieval, and chat into one product flow.',
  '{"type":"text","text":"AtlasRAG combines project management, multimodal ingestion, retrieval, and chat into one product flow."}'::jsonb,
  '["text"]'::jsonb,
  1,
  19,
  '{"section":"overview"}'::jsonb
),
(
  '40000000-0000-0000-0000-000000000002',
  '10000000-0000-0000-0000-000000000001',
  '30000000-0000-0000-0000-000000000001',
  1,
  'Retrieval uses optimized search text while preserving original content and citation metadata for grounded answers.',
  '{"type":"text","text":"Retrieval uses optimized search text while preserving original content and citation metadata for grounded answers."}'::jsonb,
  '["text"]'::jsonb,
  2,
  16,
  '{"section":"retrieval"}'::jsonb
)
on conflict (document_id, chunk_index) do update
set
  retrieval_text = excluded.retrieval_text,
  original_content = excluded.original_content,
  modality_flags = excluded.modality_flags,
  page_number = excluded.page_number,
  token_count = excluded.token_count,
  metadata = excluded.metadata;

insert into public.chats (
  id,
  project_id,
  title
)
values (
  '50000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000001',
  'Demo Chat'
)
on conflict (id) do update
set
  project_id = excluded.project_id,
  title = excluded.title;

insert into public.messages (
  id,
  chat_id,
  role,
  content,
  citations,
  metadata
)
values
(
  '60000000-0000-0000-0000-000000000001',
  '50000000-0000-0000-0000-000000000001',
  'user',
  'What is AtlasRAG?',
  '[]'::jsonb,
  '{}'::jsonb
),
(
  '60000000-0000-0000-0000-000000000002',
  '50000000-0000-0000-0000-000000000001',
  'assistant',
  'AtlasRAG is a multimodal RAG application that combines ingestion, retrieval, and chat workflows.',
  '[{"documentId":"30000000-0000-0000-0000-000000000001","chunkId":"40000000-0000-0000-0000-000000000001","pageNumber":1}]'::jsonb,
  '{"seeded":true}'::jsonb
)
on conflict (id) do update
set
  chat_id = excluded.chat_id,
  role = excluded.role,
  content = excluded.content,
  citations = excluded.citations,
  metadata = excluded.metadata;

-- Notebooks seed (Phase 3B)
insert into public.notebooks (id, project_id, title, description)
values (
  '70000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000001',
  'Retrieval Quality Tests',
  'Test queries to verify vector and hybrid search are returning the right chunks.'
)
on conflict (id) do update
set
  project_id  = excluded.project_id,
  title       = excluded.title,
  description = excluded.description;

insert into public.notebook_cells (
  id, notebook_id, cell_index, cell_type, input, output, status, executed_at
)
values
(
  '80000000-0000-0000-0000-000000000001',
  '70000000-0000-0000-0000-000000000001',
  0,
  'markdown',
  '{"text": "# Retrieval Quality Tests\nRun these cells to verify the retrieval pipeline is working correctly after any schema or config change."}'::jsonb,
  '{}'::jsonb,
  'idle',
  null
),
(
  '80000000-0000-0000-0000-000000000002',
  '70000000-0000-0000-0000-000000000001',
  1,
  'query',
  '{"query": "What is AtlasRAG?", "retrieval_strategy": "hybrid", "chunks_per_search": 4}'::jsonb,
  '{}'::jsonb,
  'idle',
  null
),
(
  '80000000-0000-0000-0000-000000000003',
  '70000000-0000-0000-0000-000000000001',
  2,
  'comparison',
  '{"query": "What is AtlasRAG?", "config_a": {"retrieval_strategy": "vector", "chunks_per_search": 4}, "config_b": {"retrieval_strategy": "keyword", "chunks_per_search": 4}}'::jsonb,
  '{}'::jsonb,
  'idle',
  null
)
on conflict (notebook_id, cell_index) do update
set
  cell_type   = excluded.cell_type,
  input       = excluded.input,
  output      = excluded.output,
  status      = excluded.status,
  executed_at = excluded.executed_at;
