-- Signsprout schema v1
-- Offline-first: the client owns a ProgressDoc (JSON) and syncs it here.
-- Every table has row-level security; the pairing table is only reachable
-- through the `pair` edge function (service role).

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Profiles
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  role text not null default 'learner' check (role in ('learner', 'parent', 'educator')),
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
create policy "profiles: read own" on public.profiles for select using (auth.uid() = id);
create policy "profiles: upsert own" on public.profiles for insert with check (auth.uid() = id);
create policy "profiles: update own" on public.profiles for update using (auth.uid() = id);

-- Create a profile automatically for new users.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name) values (new.id, split_part(new.email, '@', 1))
  on conflict (id) do nothing;
  return new;
end;
$$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Progress (one JSON document per learner, merged client-side, CRDT-style)
-- ---------------------------------------------------------------------------
create table if not exists public.progress (
  user_id uuid primary key references auth.users (id) on delete cascade,
  doc jsonb not null,
  updated_at timestamptz not null default now()
);
alter table public.progress enable row level security;
create policy "progress: read own" on public.progress for select using (auth.uid() = user_id);
create policy "progress: insert own" on public.progress for insert with check (auth.uid() = user_id);
create policy "progress: update own" on public.progress for update using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Device pairing (headset shows a code; phone approves it while signed in)
-- ---------------------------------------------------------------------------
create table if not exists public.pairings (
  code text primary key,
  secret_hash text not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'consumed', 'expired')),
  user_id uuid references auth.users (id) on delete cascade,
  token_hash text,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '10 minutes'
);
alter table public.pairings enable row level security;
-- No policies: only the service role (edge function) may touch pairings.

-- ---------------------------------------------------------------------------
-- Coach plans (AI or rule-based), newest first
-- ---------------------------------------------------------------------------
create table if not exists public.coach_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  goal text not null,
  message text not null,
  sign_ids text[] not null default '{}',
  source text not null default 'rules' check (source in ('gemini', 'claude', 'rules')),
  created_at timestamptz not null default now()
);
alter table public.coach_plans enable row level security;
create policy "coach: read own" on public.coach_plans for select using (auth.uid() = user_id);
create index if not exists coach_plans_user_created on public.coach_plans (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Family sharing: read-only links for a partner, grandparent or tutor
-- ---------------------------------------------------------------------------
create table if not exists public.shares (
  token text primary key default encode(gen_random_bytes(12), 'hex'),
  user_id uuid not null references auth.users (id) on delete cascade,
  label text,
  created_at timestamptz not null default now(),
  revoked boolean not null default false
);
alter table public.shares enable row level security;
create policy "shares: manage own" on public.shares for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Housekeeping: expire old pairing codes.
create or replace function public.expire_pairings() returns void language sql as $$
  update public.pairings set status = 'expired' where status in ('pending', 'approved') and expires_at < now();
  delete from public.pairings where created_at < now() - interval '1 day';
$$;
