-- ============================================================================
--  HUMS website — MULTIPLE ADMINISTRATORS  +  PHOTO FILENAME FIX
--
--  Run this ONCE on your existing database:
--    Supabase Dashboard → SQL Editor → New query → paste this whole file → Run
--
--  Do this BEFORE uploading the new admin.html / admin.js to your website.
--
--  BEFORE YOU RUN — two quick checks:
--    1. Supabase → Authentication → Users. Everyone listed there is about to
--       become an administrator. Delete any login you do not recognise.
--    2. Edit v_super_email below (search for "EDIT THIS").
--
--  The whole script is one transaction: if anything fails, NOTHING is changed.
--  Re-running it later is safe — it will not re-add people you have removed.
-- ============================================================================
begin;

-- ─────────────────────────────────────────────────────────────────────────────
--  ADMINISTRATORS — who is allowed to edit the website
--  • "admin"        can edit all website content
--  • "super_admin"  can also add, remove and change the role of administrators
--  A person with a Supabase login but NO row in this table can sign in but
--  cannot change anything (and the dashboard signs them straight back out).
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.admins (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  full_name  text not null default '',
  role       text not null default 'admin' check (role in ('admin', 'super_admin')),
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null
);
alter table public.admins enable row level security;

-- Helper checks used by every security rule below. "security definer" lets them
-- look inside the admins table without the caller needing direct access to it.
create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;

create or replace function public.is_super_admin()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from public.admins where user_id = auth.uid() and role = 'super_admin');
$$;

drop policy if exists "Admins can read the admin list"  on public.admins;
drop policy if exists "Super admins can change roles"   on public.admins;
drop policy if exists "Super admins can remove admins"  on public.admins;
create policy "Admins can read the admin list"
  on public.admins for select
  using ((select public.is_admin()));
create policy "Super admins can change roles"
  on public.admins for update
  using ((select public.is_super_admin()))
  with check ((select public.is_super_admin()));
create policy "Super admins can remove admins"
  on public.admins for delete
  using ((select public.is_super_admin()));
-- (No INSERT policy on purpose: new admins are added only through add_admin_by_email below.)

revoke all on public.admins from anon;
grant select, update, delete on public.admins to authenticated;

-- Safety net: the site must never be left without a super administrator.
create or replace function public.protect_last_super_admin()
returns trigger
language plpgsql set search_path = public
as $$
begin
  if old.role = 'super_admin'
     and (tg_op = 'DELETE' or new.role <> 'super_admin')
     and not exists (select 1 from public.admins where role = 'super_admin' and user_id <> old.user_id)
  then
    raise exception 'There must always be at least one super administrator. Promote someone else first.';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;
drop trigger if exists admins_protect_last_super on public.admins;
create trigger admins_protect_last_super
  before update or delete on public.admins
  for each row execute function public.protect_last_super_admin();

-- Add an administrator by the email of an existing login (super administrators only).
create or replace function public.add_admin_by_email(
  p_email     text,
  p_full_name text default '',
  p_role      text default 'admin'
)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_uid uuid;
begin
  if not public.is_super_admin() then
    raise exception 'Only super administrators can add administrators.';
  end if;
  if p_role not in ('admin', 'super_admin') then
    raise exception 'Role must be "admin" or "super_admin".';
  end if;

  select id into v_uid from auth.users where lower(email) = lower(trim(p_email)) limit 1;
  if v_uid is null then
    raise exception 'No login exists for "%" yet. First create it in Supabase (Authentication → Users → Add user), then add it here.', trim(p_email);
  end if;
  if exists (select 1 from public.admins where user_id = v_uid) then
    raise exception '"%" is already an administrator.', trim(p_email);
  end if;

  insert into public.admins (user_id, full_name, role, created_by)
  values (v_uid, coalesce(trim(p_full_name), ''), p_role, auth.uid());
end;
$$;

-- List administrators with their login email and last sign-in (any administrator may call this).
create or replace function public.list_admins()
returns table (
  user_id         uuid,
  email           text,
  full_name       text,
  role            text,
  created_at      timestamptz,
  last_sign_in_at timestamptz
)
language sql stable security definer set search_path = public
as $$
  select a.user_id, u.email::text, a.full_name, a.role, a.created_at, u.last_sign_in_at
  from public.admins a
  join auth.users u on u.id = a.user_id
  where public.is_admin()
  order by (a.role = 'super_admin') desc, a.created_at;
$$;

revoke all on function public.add_admin_by_email(text, text, text) from public, anon;
revoke all on function public.list_admins()                         from public, anon;
grant execute on function public.add_admin_by_email(text, text, text) to authenticated;
grant execute on function public.list_admins()                         to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
--  FIRST-TIME SETUP: make today's logins administrators so nobody is locked out
-- ─────────────────────────────────────────────────────────────────────────────
do $setup$
declare
  v_super_email constant text := 'CHANGE-ME@example.com';   -- ◄◄◄ EDIT THIS: the main administrator's login email
  v_uid uuid;
begin
  if exists (select 1 from public.admins) then
    raise notice 'Administrators already set up — leaving them exactly as they are.';
    return;
  end if;

  select id into v_uid from auth.users where lower(email) = lower(trim(v_super_email));
  if v_uid is null then
    raise exception 'No login found for "%". Edit v_super_email near "EDIT THIS" to the exact email of an existing login (Supabase → Authentication → Users), then run again. Nothing was changed.', v_super_email;
  end if;

  insert into public.admins (user_id, full_name, role)
  select id, coalesce(raw_user_meta_data ->> 'full_name', ''), 'admin'
  from auth.users;

  update public.admins set role = 'super_admin' where user_id = v_uid;
end
$setup$;

-- ─────────────────────────────────────────────────────────────────────────────
--  SWITCH the content tables from "any logged-in user can edit" to "admins only"
--  (drops every existing write rule on these tables, whatever it was called)
-- ─────────────────────────────────────────────────────────────────────────────
do $policies$
declare
  t text;
  p record;
begin
  foreach t in array array['site_content','news','staff','academic_metrics','program_lists','galleries'] loop
    execute format('alter table public.%I enable row level security', t);

    for p in select policyname from pg_policies
             where schemaname = 'public' and tablename = t and cmd <> 'SELECT' loop
      execute format('drop policy %I on public.%I', p.policyname, t);
    end loop;

    execute format(
      'create policy %I on public.%I for all using ((select public.is_admin())) with check ((select public.is_admin()))',
      'Admins can write ' || t, t);
  end loop;
end
$policies$;

-- ─────────────────────────────────────────────────────────────────────────────
--  PHOTO FIX: filenames must match the real files exactly (web servers are
--  case-sensitive — Windows is not). seyoum.jpg and ebisa.jpg are lowercase.
-- ─────────────────────────────────────────────────────────────────────────────
update public.site_content set value     = 'seyoum.jpg' where key = 'director_photo' and lower(value) = 'seyoum.jpg';
update public.staff        set image_url = 'seyoum.jpg' where lower(image_url) = 'seyoum.jpg';
update public.staff        set image_url = 'ebisa.jpg'  where lower(image_url) = 'ebisa.jpg';

commit;
