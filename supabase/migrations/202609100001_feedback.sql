-- Anonymous feedback is written only by the app server; no browser table access.
create table if not exists public.feedback (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null unique,
  user_id uuid references auth.users(id) on delete set null,
  visited_modes text[] not null check (
    cardinality(visited_modes) = 4 and
    visited_modes @> array['review', 'diff', 'lexical', 'semantic']::text[]
  ),
  active_ms bigint not null check (active_ms > 600000),
  rating smallint not null check (rating between 1 and 5),
  preferred_mode text not null check (preferred_mode in ('review', 'diff', 'lexical', 'semantic')),
  comment text not null default '' check (char_length(comment) <= 2000),
  created_at timestamptz not null default now()
);

alter table public.feedback enable row level security;
revoke all on public.feedback from public, anon, authenticated;
grant insert on public.feedback to service_role;

comment on table public.feedback is 'Voluntary product feedback. Read/manage in Supabase Dashboard; client roles have no access.';
comment on column public.feedback.active_ms is 'Client-measured foreground and focused time; a UX trigger, not trusted proof of engagement.';
