-- Seraphova schema. Run once in the Supabase SQL editor.

create table if not exists public.seraphova_profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null unique,
  first_name text not null,
  birth_date date not null,
  birth_time time,
  birth_city text not null,
  birth_lat double precision not null,
  birth_lon double precision not null,
  birth_tz text not null,
  focus text not null,
  context text,
  context_updated_at timestamptz,
  -- Running summary of everything written for this member so far (see lib/memory.ts).
  memory text,
  memory_through date,
  memory_updated_at timestamptz,
  -- Anonymous browser id that links this profile to its funnel events.
  visitor_id text,
  -- Abandoned-cart reminders sent so far (see lib/cart.ts).
  cart_emails_sent smallint not null default 0,
  cart_last_email_at timestamptz,
  delivery_hour smallint not null default 7 check (delivery_hour between 0 and 23),
  timezone text not null,
  chart jsonb not null,
  status text not null default 'lead' check (status in ('lead', 'active', 'expired')),
  paid_at timestamptz,
  access_until timestamptz,
  next_send_at timestamptz,
  email_paused boolean not null default false,
  stripe_customer_id text,
  stripe_session_id text,
  created_at timestamptz not null default now()
);

create index if not exists seraphova_profiles_due_idx
  on public.seraphova_profiles (next_send_at)
  where status = 'active';

create table if not exists public.seraphova_readings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.seraphova_profiles (id) on delete cascade,
  reading_date date not null,
  headline text not null,
  theme text not null,
  opening text not null,
  sections jsonb not null,
  invitation text not null,
  sky jsonb not null,
  model text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, reading_date)
);

-- Every version of what the member said is on their mind, newest last.
create table if not exists public.seraphova_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.seraphova_profiles (id) on delete cascade,
  focus text not null,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists seraphova_notes_user_idx
  on public.seraphova_notes (user_id, created_at);

-- One row per visitor per funnel step, from opening the quiz to paying.
create table if not exists public.seraphova_funnel_events (
  id bigint generated always as identity primary key,
  visitor_id text not null,
  event text not null,
  profile_id uuid references public.seraphova_profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (visitor_id, event)
);

create index if not exists seraphova_funnel_events_event_idx
  on public.seraphova_funnel_events (event, created_at);

-- One row per completed payment (first purchase or renewal).
create table if not exists public.seraphova_payments (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references public.seraphova_profiles (id) on delete set null,
  stripe_session_id text not null unique,
  amount_cents integer not null,
  currency text not null default 'usd',
  -- How many abandoned-cart emails had been sent before this payment (0 = none).
  cart_emails_before smallint not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists seraphova_payments_created_idx
  on public.seraphova_payments (created_at);

-- For databases created before these columns existed.
alter table public.seraphova_profiles
  add column if not exists context_updated_at timestamptz,
  add column if not exists memory text,
  add column if not exists memory_through date,
  add column if not exists memory_updated_at timestamptz,
  add column if not exists visitor_id text,
  add column if not exists cart_emails_sent smallint not null default 0,
  add column if not exists cart_last_email_at timestamptz;

create index if not exists seraphova_profiles_leads_idx
  on public.seraphova_profiles (created_at)
  where status = 'lead';

-- Members can read their own rows. All writes go through the server (service role).
alter table public.seraphova_profiles enable row level security;
alter table public.seraphova_readings enable row level security;
alter table public.seraphova_notes enable row level security;
-- Funnel events and payments are only ever touched by the server.
alter table public.seraphova_funnel_events enable row level security;
alter table public.seraphova_payments enable row level security;

drop policy if exists "Members read their own profile" on public.seraphova_profiles;
create policy "Members read their own profile" on public.seraphova_profiles
  for select to authenticated using ((select auth.uid()) = id);

drop policy if exists "Members read their own readings" on public.seraphova_readings;
create policy "Members read their own readings" on public.seraphova_readings
  for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "Members read their own notes" on public.seraphova_notes;
create policy "Members read their own notes" on public.seraphova_notes
  for select to authenticated using ((select auth.uid()) = user_id);

grant select on public.seraphova_profiles, public.seraphova_readings, public.seraphova_notes to authenticated;
grant all on public.seraphova_profiles, public.seraphova_readings, public.seraphova_notes to service_role;
grant all on public.seraphova_funnel_events, public.seraphova_payments to service_role;
