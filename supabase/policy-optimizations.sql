create index if not exists idx_assets_conversation_id on public.assets(conversation_id);

drop policy if exists "Users can read own profile" on public.profiles;
drop policy if exists "Users can update own profile" on public.profiles;
drop policy if exists "Users can insert own profile" on public.profiles;
drop policy if exists "Investors can read all profiles" on public.profiles;

create policy "Profiles readable by owner or investors"
  on public.profiles for select to authenticated
  using (
    (select auth.uid()) = id
    or exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid())
        and p.role = 'investor'
    )
  );

create policy "Users can update own profile"
  on public.profiles for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

create policy "Users can insert own profile"
  on public.profiles for insert to authenticated
  with check ((select auth.uid()) = id);

drop policy if exists "Users can read own credits" on public.credits;
create policy "Users can read own credits"
  on public.credits for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can read own transactions" on public.credit_transactions;
create policy "Users can read own transactions"
  on public.credit_transactions for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can CRUD own conversations" on public.conversations;
drop policy if exists "Investors can read all conversations" on public.conversations;

create policy "Conversations readable by owner or investors"
  on public.conversations for select to authenticated
  using (
    (select auth.uid()) = user_id
    or exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid())
        and p.role = 'investor'
    )
  );

create policy "Users can insert own conversations"
  on public.conversations for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can update own conversations"
  on public.conversations for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users can delete own conversations"
  on public.conversations for delete to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can read own messages" on public.messages;
drop policy if exists "Users can insert own messages" on public.messages;
drop policy if exists "Investors can read all messages" on public.messages;

create policy "Messages readable by owner or investors"
  on public.messages for select to authenticated
  using (
    exists (
      select 1 from public.conversations c
      where c.id = messages.conversation_id
        and c.user_id = (select auth.uid())
    )
    or exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid())
        and p.role = 'investor'
    )
  );

create policy "Users can insert own messages"
  on public.messages for insert to authenticated
  with check (
    exists (
      select 1 from public.conversations c
      where c.id = messages.conversation_id
        and c.user_id = (select auth.uid())
    )
  );

drop policy if exists "Users can read own assets" on public.assets;
drop policy if exists "Investors can read all assets" on public.assets;

create policy "Assets readable by owner or investors"
  on public.assets for select to authenticated
  using (
    (select auth.uid()) = user_id
    or exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid())
        and p.role = 'investor'
    )
  );

drop policy if exists "Users can read own score" on public.readiness_scores;
drop policy if exists "Investors can read all scores" on public.readiness_scores;

create policy "Scores readable by owner or investors"
  on public.readiness_scores for select to authenticated
  using (
    (select auth.uid()) = user_id
    or exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid())
        and p.role = 'investor'
    )
  );

drop policy if exists "Users can read own orders" on public.payment_orders;
create policy "Users can read own orders"
  on public.payment_orders for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can read own generated assets" on storage.objects;
drop policy if exists "Investors can read generated assets" on storage.objects;

create policy "Generated assets readable by owner or investors"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'assets'
    and (
      (storage.foldername(name))[1] = (select auth.uid())::text
      or exists (
        select 1 from public.profiles p
        where p.id = (select auth.uid())
          and p.role = 'investor'
      )
    )
  );
