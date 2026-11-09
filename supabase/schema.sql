-- Voxora schema. Run in the Supabase SQL editor (or via `supabase db push`).

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  premium_until timestamptz,                         -- paid subscription end
  trial_ends_at timestamptz not null default (now() + interval '2 months'),  -- 2-month free trial for new customers
  referral_bonus_until timestamptz,                  -- extra free months from referrals
  referral_code text unique not null default substr(md5(random()::text || clock_timestamp()::text), 1, 8),
  referred_by uuid references public.profiles(id),
  trial_reminder_7d_sent boolean not null default false,
  trial_reminder_1d_sent boolean not null default false,
  trial_ended_notice_sent boolean not null default false,
  payment_provider text,
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
create policy "own profile read" on public.profiles for select using (auth.uid() = id);
-- No client-side update policy: only the service role (webhooks) changes entitlements.

create table if not exists public.documents (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  source text,
  text text not null,
  position int not null default 0,
  summary text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists documents_user_idx on public.documents(user_id, updated_at desc);
alter table public.documents enable row level security;
create policy "own docs select" on public.documents for select using (auth.uid() = user_id);
create policy "own docs insert" on public.documents for insert with check (auth.uid() = user_id);
create policy "own docs update" on public.documents for update using (auth.uid() = user_id);
create policy "own docs delete" on public.documents for delete using (auth.uid() = user_id);

create table if not exists public.cloned_voices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  provider text not null default 'elevenlabs',
  provider_voice_id text not null,
  created_at timestamptz not null default now()
);
alter table public.cloned_voices enable row level security;
create policy "own voices" on public.cloned_voices for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- New user: create profile, start the 2-month trial, and reward the referrer with 1 month.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare ref_id uuid;
begin
  select id into ref_id from public.profiles
    where referral_code = lower(coalesce(new.raw_user_meta_data->>'ref', ''));
  insert into public.profiles (id, email, referred_by) values (new.id, new.email, ref_id);
  if ref_id is not null and ref_id <> new.id then
    update public.profiles
      set referral_bonus_until = greatest(coalesce(referral_bonus_until, now()), now()) + interval '1 month',
          trial_reminder_7d_sent = false, trial_reminder_1d_sent = false
      where id = ref_id;
  end if;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- Storage buckets: private voice samples, public shared audio links (premium feature)
insert into storage.buckets (id, name, public) values ('voice-samples', 'voice-samples', false) on conflict do nothing;
insert into storage.buckets (id, name, public) values ('shared-audio', 'shared-audio', true) on conflict do nothing;

-- ============ Dashboard: payments + usage (added) ============
create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null,
  provider_ref text unique,                 -- payment id from the provider; makes webhook retries safe
  amount_cents int,
  currency text not null default 'ZAR',
  months int not null,
  created_at timestamptz not null default now()
);
create index if not exists payments_user_idx on public.payments(user_id, created_at desc);
alter table public.payments enable row level security;
create policy "own payments read" on public.payments for select using (auth.uid() = user_id);
-- no insert/update/delete policies: only the service role (webhooks) writes payments

create table if not exists public.usage_daily (
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null default current_date,
  listen_seconds int not null default 0,
  downloads int not null default 0,
  imports int not null default 0,
  primary key (user_id, day)
);
alter table public.usage_daily enable row level security;
create policy "own usage read" on public.usage_daily for select using (auth.uid() = user_id);
-- no write policies: counters only go up, through add_usage() below

create or replace function public.add_usage(kind text, n int) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  if n is null or n < 1 or n > 3600 then raise exception 'bad amount'; end if;
  insert into public.usage_daily (user_id, day) values (auth.uid(), current_date) on conflict do nothing;
  if kind = 'listen' then update public.usage_daily set listen_seconds = listen_seconds + n where user_id = auth.uid() and day = current_date;
  elsif kind = 'downloads' then update public.usage_daily set downloads = downloads + n where user_id = auth.uid() and day = current_date;
  elsif kind = 'imports' then update public.usage_daily set imports = imports + n where user_id = auth.uid() and day = current_date;
  else raise exception 'bad kind'; end if;
end $$;
revoke all on function public.add_usage(text, int) from public, anon;
grant execute on function public.add_usage(text, int) to authenticated;
