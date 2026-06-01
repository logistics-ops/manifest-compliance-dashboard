-- Tighten and repair compliance checklist upload policies without disabling RLS.
-- This migration is safe to run on existing databases and does not drop data.

alter table public.carrier_documents enable row level security;
alter table public.carrier_document_versions enable row level security;

drop policy if exists "Authorized users can insert carrier documents" on public.carrier_documents;
create policy "Authorized users can insert carrier documents"
on public.carrier_documents for insert
to authenticated
with check (
  exists (
    select 1
    from public.carriers
    where carriers.id = carrier_documents.carrier_id
      and carriers.organization_id = carrier_documents.organization_id
      and (
        public.is_platform_super_admin()
        or (
          public.can_manage_compliance()
          and public.can_access_organization(carrier_documents.organization_id)
        )
        or (
          public.current_user_role() = 'carrier'::public.app_role
          and public.current_user_carrier_id() = carrier_documents.carrier_id
          and public.can_access_organization(carrier_documents.organization_id)
        )
      )
  )
);

drop policy if exists "Authorized users can update carrier documents" on public.carrier_documents;
create policy "Authorized users can update carrier documents"
on public.carrier_documents for update
to authenticated
using (
  exists (
    select 1
    from public.carriers
    where carriers.id = carrier_documents.carrier_id
      and carriers.organization_id = carrier_documents.organization_id
      and (
        public.is_platform_super_admin()
        or (
          public.can_manage_compliance()
          and public.can_access_organization(carrier_documents.organization_id)
        )
        or (
          public.current_user_role() = 'carrier'::public.app_role
          and public.current_user_carrier_id() = carrier_documents.carrier_id
          and public.can_access_organization(carrier_documents.organization_id)
        )
      )
  )
)
with check (
  exists (
    select 1
    from public.carriers
    where carriers.id = carrier_documents.carrier_id
      and carriers.organization_id = carrier_documents.organization_id
      and (
        public.is_platform_super_admin()
        or (
          public.can_manage_compliance()
          and public.can_access_organization(carrier_documents.organization_id)
        )
        or (
          public.current_user_role() = 'carrier'::public.app_role
          and public.current_user_carrier_id() = carrier_documents.carrier_id
          and public.can_access_organization(carrier_documents.organization_id)
        )
      )
  )
);

drop policy if exists "Authorized users can create carrier document versions" on public.carrier_document_versions;
create policy "Authorized users can create carrier document versions"
on public.carrier_document_versions for insert
to authenticated
with check (
  exists (
    select 1
    from public.carriers
    where carriers.id = carrier_document_versions.carrier_id
      and carriers.organization_id = carrier_document_versions.organization_id
      and (
        public.is_platform_super_admin()
        or (
          public.can_manage_compliance()
          and public.can_access_organization(carrier_document_versions.organization_id)
        )
        or (
          public.current_user_role() = 'carrier'::public.app_role
          and public.current_user_carrier_id() = carrier_document_versions.carrier_id
          and public.can_access_organization(carrier_document_versions.organization_id)
        )
      )
  )
  and exists (
    select 1
    from public.carrier_documents
    where carrier_documents.id = carrier_document_versions.carrier_document_id
      and carrier_documents.organization_id = carrier_document_versions.organization_id
      and carrier_documents.carrier_id = carrier_document_versions.carrier_id
  )
);

drop policy if exists "Staff can upload carrier document files" on storage.objects;
drop policy if exists "Authorized users can upload carrier document files" on storage.objects;
create policy "Authorized users can upload carrier document files"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'carrier-documents'
  and (storage.foldername(name))[1] = 'organizations'
  and (storage.foldername(name))[2] ~* '^[0-9a-f-]{36}$'
  and (storage.foldername(name))[3] = 'carriers'
  and (storage.foldername(name))[4] ~* '^[0-9a-f-]{36}$'
  and (storage.foldername(name))[5] is not null
  and (storage.foldername(name))[6] ~ '^v[0-9]+$'
  and exists (
    select 1
    from public.carriers
    where carriers.organization_id = ((storage.foldername(name))[2])::uuid
      and carriers.id = ((storage.foldername(name))[4])::uuid
      and (
        public.is_platform_super_admin()
        or (
          public.can_manage_compliance()
          and public.can_access_organization(carriers.organization_id)
        )
        or (
          public.current_user_role() = 'carrier'::public.app_role
          and public.current_user_carrier_id() = carriers.id
          and public.can_access_organization(carriers.organization_id)
        )
      )
  )
);

drop policy if exists "Staff can replace carrier document files" on storage.objects;
drop policy if exists "Authorized users can replace carrier document files" on storage.objects;
create policy "Authorized users can replace carrier document files"
on storage.objects for update
to authenticated
using (
  bucket_id = 'carrier-documents'
  and (storage.foldername(name))[1] = 'organizations'
  and (storage.foldername(name))[2] ~* '^[0-9a-f-]{36}$'
  and (storage.foldername(name))[3] = 'carriers'
  and (storage.foldername(name))[4] ~* '^[0-9a-f-]{36}$'
  and exists (
    select 1
    from public.carriers
    where carriers.organization_id = ((storage.foldername(name))[2])::uuid
      and carriers.id = ((storage.foldername(name))[4])::uuid
      and (
        public.is_platform_super_admin()
        or (
          public.can_manage_compliance()
          and public.can_access_organization(carriers.organization_id)
        )
        or (
          public.current_user_role() = 'carrier'::public.app_role
          and public.current_user_carrier_id() = carriers.id
          and public.can_access_organization(carriers.organization_id)
        )
      )
  )
)
with check (
  bucket_id = 'carrier-documents'
  and (storage.foldername(name))[1] = 'organizations'
  and (storage.foldername(name))[2] ~* '^[0-9a-f-]{36}$'
  and (storage.foldername(name))[3] = 'carriers'
  and (storage.foldername(name))[4] ~* '^[0-9a-f-]{36}$'
  and exists (
    select 1
    from public.carriers
    where carriers.organization_id = ((storage.foldername(name))[2])::uuid
      and carriers.id = ((storage.foldername(name))[4])::uuid
      and (
        public.is_platform_super_admin()
        or (
          public.can_manage_compliance()
          and public.can_access_organization(carriers.organization_id)
        )
        or (
          public.current_user_role() = 'carrier'::public.app_role
          and public.current_user_carrier_id() = carriers.id
          and public.can_access_organization(carriers.organization_id)
        )
      )
  )
);
