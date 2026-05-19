-- Users Management module support.
-- Safe to run on an existing ManifestOS Supabase database.

do $$
begin
  if exists (select 1 from pg_type where typname = 'notification_category') then
    alter type public.notification_category add value if not exists 'user_operation';
  end if;
end $$;

alter table public.users add column if not exists last_login_at timestamptz;

create index if not exists users_is_active_idx on public.users(is_active);
create index if not exists users_last_login_at_idx on public.users(last_login_at desc);

drop policy if exists "Users can read own profile" on public.users;
create policy "Users can read own profile"
on public.users for select
to authenticated
using (
  id = auth.uid()
  or public.is_platform_super_admin()
  or (
    public.can_manage_compliance()
    and public.can_access_organization(organization_id)
  )
);
