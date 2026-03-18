alter table public.document_chunks
add column if not exists element_type jsonb;
