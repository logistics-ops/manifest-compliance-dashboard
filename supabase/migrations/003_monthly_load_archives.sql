-- ManifestOS Monthly Load Archive Export
-- Safe additive migration. Does not drop existing load or document data.

alter table public.loads
  add column if not exists archived_at timestamptz,
  add column if not exists archived_by uuid references public.users(id) on delete set null,
  add column if not exists files_deleted_at timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'loads_organization_archived_by_fkey'
  ) then
    alter table public.loads
      add constraint loads_organization_archived_by_fkey
      foreign key (organization_id, archived_by)
      references public.users(organization_id, id);
  end if;
end $$;

create index if not exists loads_archived_at_idx on public.loads(archived_at);
create index if not exists loads_files_deleted_at_idx on public.loads(files_deleted_at);

drop policy if exists "Admins can delete archived load document files" on storage.objects;
create policy "Admins can delete archived load document files"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'carrier-documents'
  and (storage.foldername(name))[1] = 'organizations'
  and (storage.foldername(name))[2] ~* '^[0-9a-f-]{36}$'
  and public.can_access_organization(((storage.foldername(name))[2])::uuid)
  and (storage.foldername(name))[3] = 'loads'
  and (storage.foldername(name))[4] ~* '^[0-9a-f-]{36}$'
  and (storage.foldername(name))[5] in ('rate-confirmation', 'pod')
  and exists (
    select 1
    from public.loads
    where loads.organization_id = ((storage.foldername(name))[2])::uuid
      and loads.id = ((storage.foldername(name))[4])::uuid
      and loads.archived_at is not null
      and loads.files_deleted_at is null
      and (
        public.is_platform_super_admin()
        or (
          public.can_manage_compliance()
          and public.can_access_organization(loads.organization_id)
        )
      )
  )
);
