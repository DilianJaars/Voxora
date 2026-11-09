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
