create table if not exists public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  email text not null,
  full_name text,
  role text not null default 'founder' check (role in ('founder', 'investor')),
  company_name text,
  sector text,
  stage text,
  created_at timestamptz default now()
);

create table if not exists public.credits (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  balance integer not null default 0 check (balance >= 0),
  updated_at timestamptz default now(),
  unique(user_id)
);

create table if not exists public.credit_transactions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  amount integer not null,
  type text not null check (type in ('grant', 'purchase', 'deduct')),
  reason text,
  reference_id text,
  created_at timestamptz default now()
);

create table if not exists public.conversations (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  title text,
  status text not null default 'active' check (status in ('active', 'archived')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.messages (
  id uuid default gen_random_uuid() primary key,
  conversation_id uuid references public.conversations(id) on delete cascade not null,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  credits_used integer not null default 0,
  created_at timestamptz default now()
);

create table if not exists public.assets (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  conversation_id uuid references public.conversations(id),
  type text not null check (type in ('pitch_deck', 'financial_model', 'investor_memo')),
  status text not null default 'pending' check (status in ('pending', 'generating', 'ready', 'failed')),
  file_url text,
  data jsonb,
  credits_used integer not null default 0,
  created_at timestamptz default now()
);

create table if not exists public.readiness_scores (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null unique,
  score integer not null default 0 check (score between 0 and 100),
  label text not null default 'Early Stage' check (
    label in ('Most Promising', 'High Potential', 'Needs Mentorship', 'Early Stage')
  ),
  breakdown jsonb,
  generated_at timestamptz default now()
);

create table if not exists public.payment_orders (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  razorpay_order_id text unique not null,
  razorpay_payment_id text,
  credits integer not null,
  amount_paise integer not null,
  status text not null default 'created' check (status in ('created', 'paid', 'failed')),
  created_at timestamptz default now(),
  paid_at timestamptz
);

alter table public.profiles enable row level security;
alter table public.credits enable row level security;
alter table public.credit_transactions enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.assets enable row level security;
alter table public.readiness_scores enable row level security;
alter table public.payment_orders enable row level security;

create index if not exists idx_credits_user_id on public.credits(user_id);
create index if not exists idx_credit_transactions_user_id_created_at on public.credit_transactions(user_id, created_at desc);
create index if not exists idx_conversations_user_id_updated_at on public.conversations(user_id, updated_at desc);
create index if not exists idx_messages_conversation_id_created_at on public.messages(conversation_id, created_at asc);
create index if not exists idx_assets_user_id_created_at on public.assets(user_id, created_at desc);
create index if not exists idx_readiness_scores_score on public.readiness_scores(score desc);
create index if not exists idx_payment_orders_user_id_created_at on public.payment_orders(user_id, created_at desc);

create or replace function public.deduct_credits(
  p_user_id uuid,
  p_amount integer,
  p_reason text,
  p_ref_id text default null
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  new_balance integer;
begin
  if p_amount <= 0 then
    raise exception 'Credit deduction amount must be positive';
  end if;

  update public.credits
  set balance = balance - p_amount,
      updated_at = now()
  where user_id = p_user_id
    and balance >= p_amount
  returning balance into new_balance;

  if not found then
    raise exception 'Insufficient credits';
  end if;

  insert into public.credit_transactions (user_id, amount, type, reason, reference_id)
  values (p_user_id, -p_amount, 'deduct', p_reason, p_ref_id);

  return new_balance;
end;
$$;

create or replace function public.add_credits(
  p_user_id uuid,
  p_amount integer,
  p_type text,
  p_reason text,
  p_ref_id text default null
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  new_balance integer;
begin
  if p_amount <= 0 then
    raise exception 'Credit addition amount must be positive';
  end if;

  if p_type not in ('grant', 'purchase') then
    raise exception 'Invalid credit transaction type';
  end if;

  insert into public.credits (user_id, balance)
  values (p_user_id, p_amount)
  on conflict (user_id)
  do update set balance = public.credits.balance + p_amount,
                updated_at = now()
  returning balance into new_balance;

  insert into public.credit_transactions (user_id, amount, type, reason, reference_id)
  values (p_user_id, p_amount, p_type, p_reason, p_ref_id);

  return new_balance;
end;
$$;

revoke all on function public.deduct_credits(uuid, integer, text, text) from public, anon, authenticated;
revoke all on function public.add_credits(uuid, integer, text, text, text) from public, anon, authenticated;
grant execute on function public.deduct_credits(uuid, integer, text, text) to service_role;
grant execute on function public.add_credits(uuid, integer, text, text, text) to service_role;

grant usage on schema public to anon, authenticated, service_role;
grant select, insert, update on public.profiles to authenticated;
grant select on public.credits to authenticated;
grant select on public.credit_transactions to authenticated;
grant select, insert, update, delete on public.conversations to authenticated;
grant select, insert on public.messages to authenticated;
grant select on public.assets to authenticated;
grant select on public.readiness_scores to authenticated;
grant select on public.payment_orders to authenticated;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'profiles' and policyname = 'Users can read own profile'
  ) then
    create policy "Users can read own profile"
      on public.profiles for select
      using (auth.uid() = id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'profiles' and policyname = 'Users can update own profile'
  ) then
    create policy "Users can update own profile"
      on public.profiles for update
      using (auth.uid() = id)
      with check (auth.uid() = id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'profiles' and policyname = 'Users can insert own profile'
  ) then
    create policy "Users can insert own profile"
      on public.profiles for insert
      with check (auth.uid() = id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'profiles' and policyname = 'Investors can read all profiles'
  ) then
    create policy "Investors can read all profiles"
      on public.profiles for select
      using (
        exists (
          select 1 from public.profiles p
          where p.id = auth.uid()
            and p.role = 'investor'
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'credits' and policyname = 'Users can read own credits'
  ) then
    create policy "Users can read own credits"
      on public.credits for select
      using (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'credit_transactions' and policyname = 'Users can read own transactions'
  ) then
    create policy "Users can read own transactions"
      on public.credit_transactions for select
      using (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'conversations' and policyname = 'Users can CRUD own conversations'
  ) then
    create policy "Users can CRUD own conversations"
      on public.conversations for all
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'conversations' and policyname = 'Investors can read all conversations'
  ) then
    create policy "Investors can read all conversations"
      on public.conversations for select
      using (
        exists (
          select 1 from public.profiles p
          where p.id = auth.uid()
            and p.role = 'investor'
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'messages' and policyname = 'Users can read own messages'
  ) then
    create policy "Users can read own messages"
      on public.messages for select
      using (
        exists (
          select 1 from public.conversations c
          where c.id = messages.conversation_id
            and c.user_id = auth.uid()
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'messages' and policyname = 'Users can insert own messages'
  ) then
    create policy "Users can insert own messages"
      on public.messages for insert
      with check (
        exists (
          select 1 from public.conversations c
          where c.id = messages.conversation_id
            and c.user_id = auth.uid()
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'messages' and policyname = 'Investors can read all messages'
  ) then
    create policy "Investors can read all messages"
      on public.messages for select
      using (
        exists (
          select 1 from public.profiles p
          where p.id = auth.uid()
            and p.role = 'investor'
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'assets' and policyname = 'Users can read own assets'
  ) then
    create policy "Users can read own assets"
      on public.assets for select
      using (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'assets' and policyname = 'Investors can read all assets'
  ) then
    create policy "Investors can read all assets"
      on public.assets for select
      using (
        exists (
          select 1 from public.profiles p
          where p.id = auth.uid()
            and p.role = 'investor'
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'readiness_scores' and policyname = 'Users can read own score'
  ) then
    create policy "Users can read own score"
      on public.readiness_scores for select
      using (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'readiness_scores' and policyname = 'Investors can read all scores'
  ) then
    create policy "Investors can read all scores"
      on public.readiness_scores for select
      using (
        exists (
          select 1 from public.profiles p
          where p.id = auth.uid()
            and p.role = 'investor'
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'payment_orders' and policyname = 'Users can read own orders'
  ) then
    create policy "Users can read own orders"
      on public.payment_orders for select
      using (auth.uid() = user_id);
  end if;
end;
$$;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'assets',
  'assets',
  false,
  52428800,
  array[
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ]
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'Users can read own generated assets'
  ) then
    create policy "Users can read own generated assets"
      on storage.objects for select
      using (
        bucket_id = 'assets'
        and (storage.foldername(name))[1] = auth.uid()::text
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'Investors can read generated assets'
  ) then
    create policy "Investors can read generated assets"
      on storage.objects for select
      using (
        bucket_id = 'assets'
        and exists (
          select 1 from public.profiles p
          where p.id = auth.uid()
            and p.role = 'investor'
        )
      );
  end if;
end;
$$;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
    and not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'credits'
    )
  then
    alter publication supabase_realtime add table public.credits;
  end if;
end;
$$;
