create table if not exists public.message_feedback (
  id          uuid primary key default gen_random_uuid(),
  message_id  uuid not null references public.messages(id) on delete cascade,
  rating      text not null check (rating in ('thumbs_up', 'thumbs_down')),
  comment     text,
  created_at  timestamptz not null default timezone('utc', now()),
  updated_at  timestamptz not null default timezone('utc', now()),
  unique (message_id)
);

create index if not exists idx_message_feedback_message_id on public.message_feedback(message_id);
create index if not exists idx_message_feedback_rating      on public.message_feedback(rating);

create trigger trg_message_feedback_set_updated_at
before update on public.message_feedback
for each row execute function public.set_updated_at();
