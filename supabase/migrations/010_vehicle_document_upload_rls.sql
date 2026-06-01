-- Phase 1.7: allow tenant-scoped vehicle document uploads without disabling RLS.

alter table public.equipment_documents enable row level security;

drop policy if exists "Authorized users can insert equipment documents" on public.equipment_documents;
create policy "Authorized users can insert equipment documents"
on public.equipment_documents for insert
to authenticated
with check (
  exists (
    select 1
    from public.equipment
    where equipment.id = equipment_documents.equipment_id
      and equipment.organization_id = equipment_documents.organization_id
      and (
        public.is_platform_super_admin()
        or (
          public.can_manage_compliance()
          and public.can_access_organization(equipment_documents.organization_id)
        )
        or (
          public.current_user_role() = 'carrier'::public.app_role
          and public.current_user_carrier_id() = equipment.carrier_id
          and public.can_access_organization(equipment_documents.organization_id)
        )
      )
  )
);

drop policy if exists "Authorized users can update equipment documents" on public.equipment_documents;
create policy "Authorized users can update equipment documents"
on public.equipment_documents for update
to authenticated
using (
  exists (
    select 1
    from public.equipment
    where equipment.id = equipment_documents.equipment_id
      and equipment.organization_id = equipment_documents.organization_id
      and (
        public.is_platform_super_admin()
        or (
          public.can_manage_compliance()
          and public.can_access_organization(equipment_documents.organization_id)
        )
        or (
          public.current_user_role() = 'carrier'::public.app_role
          and public.current_user_carrier_id() = equipment.carrier_id
          and public.can_access_organization(equipment_documents.organization_id)
        )
      )
  )
)
with check (
  exists (
    select 1
    from public.equipment
    where equipment.id = equipment_documents.equipment_id
      and equipment.organization_id = equipment_documents.organization_id
      and (
        public.is_platform_super_admin()
        or (
          public.can_manage_compliance()
          and public.can_access_organization(equipment_documents.organization_id)
        )
        or (
          public.current_user_role() = 'carrier'::public.app_role
          and public.current_user_carrier_id() = equipment.carrier_id
          and public.can_access_organization(equipment_documents.organization_id)
        )
      )
  )
);

drop policy if exists "Authorized users can upload equipment document files" on storage.objects;
create policy "Authorized users can upload equipment document files"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'carrier-documents'
  and (storage.foldername(name))[1] = 'organizations'
  and (storage.foldername(name))[2] ~* '^[0-9a-f-]{36}$'
  and (storage.foldername(name))[3] = 'equipment'
  and (storage.foldername(name))[4] ~* '^[0-9a-f-]{36}$'
  and (storage.foldername(name))[5] is not null
  and (storage.foldername(name))[6] ~ '^v[0-9]+$'
  and exists (
    select 1
    from public.equipment
    where equipment.organization_id = ((storage.foldername(name))[2])::uuid
      and equipment.id = ((storage.foldername(name))[4])::uuid
      and (
        public.is_platform_super_admin()
        or (
          public.can_manage_compliance()
          and public.can_access_organization(equipment.organization_id)
        )
        or (
          public.current_user_role() = 'carrier'::public.app_role
          and public.current_user_carrier_id() = equipment.carrier_id
          and public.can_access_organization(equipment.organization_id)
        )
      )
  )
);

drop policy if exists "Authorized users can read equipment document files" on storage.objects;
create policy "Authorized users can read equipment document files"
on storage.objects for select
to authenticated
using (
  bucket_id = 'carrier-documents'
  and (storage.foldername(name))[1] = 'organizations'
  and (storage.foldername(name))[2] ~* '^[0-9a-f-]{36}$'
  and (storage.foldername(name))[3] = 'equipment'
  and (storage.foldername(name))[4] ~* '^[0-9a-f-]{36}$'
  and exists (
    select 1
    from public.equipment
    where equipment.organization_id = ((storage.foldername(name))[2])::uuid
      and equipment.id = ((storage.foldername(name))[4])::uuid
      and public.can_view_carrier(equipment.carrier_id)
  )
);

drop policy if exists "Authorized users can replace equipment document files" on storage.objects;
create policy "Authorized users can replace equipment document files"
on storage.objects for update
to authenticated
using (
  bucket_id = 'carrier-documents'
  and (storage.foldername(name))[1] = 'organizations'
  and (storage.foldername(name))[2] ~* '^[0-9a-f-]{36}$'
  and (storage.foldername(name))[3] = 'equipment'
  and (storage.foldername(name))[4] ~* '^[0-9a-f-]{36}$'
  and exists (
    select 1
    from public.equipment
    where equipment.organization_id = ((storage.foldername(name))[2])::uuid
      and equipment.id = ((storage.foldername(name))[4])::uuid
      and (
        public.is_platform_super_admin()
        or (
          public.can_manage_compliance()
          and public.can_access_organization(equipment.organization_id)
        )
        or (
          public.current_user_role() = 'carrier'::public.app_role
          and public.current_user_carrier_id() = equipment.carrier_id
          and public.can_access_organization(equipment.organization_id)
        )
      )
  )
)
with check (
  bucket_id = 'carrier-documents'
  and (storage.foldername(name))[1] = 'organizations'
  and (storage.foldername(name))[2] ~* '^[0-9a-f-]{36}$'
  and (storage.foldername(name))[3] = 'equipment'
  and (storage.foldername(name))[4] ~* '^[0-9a-f-]{36}$'
  and exists (
    select 1
    from public.equipment
    where equipment.organization_id = ((storage.foldername(name))[2])::uuid
      and equipment.id = ((storage.foldername(name))[4])::uuid
      and (
        public.is_platform_super_admin()
        or (
          public.can_manage_compliance()
          and public.can_access_organization(equipment.organization_id)
        )
        or (
          public.current_user_role() = 'carrier'::public.app_role
          and public.current_user_carrier_id() = equipment.carrier_id
          and public.can_access_organization(equipment.organization_id)
        )
      )
  )
);
