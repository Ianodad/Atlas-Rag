-- Phase 12b: allow the worker's embedding phase in project_documents.processing_status

alter table public.project_documents
drop constraint if exists project_documents_processing_status_check;

alter table public.project_documents
add constraint project_documents_processing_status_check
check (
  processing_status in (
    'pending',
    'queued',
    'processing',
    'partitioning',
    'chunking',
    'summarising',
    'embedding',
    'vectorization',
    'completed',
    'failed'
  )
);
