-- Phase 2.2: tenant-scoped inspection report management.

create table if not exists public.inspection_reports (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  carrier_id uuid not null references public.carriers(id) on delete cascade,
  driver_id uuid references public.drivers(id) on delete set null,
  equipment_id uuid references public.equipment(id) on delete set null,
  inspection_date date not null,
  inspection_type text not null,
  location text,
  violations text,
  out_of_service boolean not null default false,
  notes text,
  status text not null default 'open',
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id)
);

create table if not exists public.inspection_documents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  inspection_id uuid not null references public.inspection_reports(id) on delete cascade,
  carrier_id uuid not null references public.carriers(id) on delete cascade,
  document_name text not null,
  storage_path text not null,
  file_name text not null,
  file_size bigint,
  mime_type text,
  uploaded_by uuid references public.users(id) on delete set null,
  uploaded_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table public.inspection_reports
drop constraint if exists inspection_reports_organization_carrier_fkey;

alter table public.inspection_reports
add constraint inspection_reports_organization_carrier_fkey
foreign key (organization_id, carrier_id)
references public.carriers(organization_id, id)
on delete cascade;

alter table public.inspection_reports
drop constraint if exists inspection_reports_organization_driver_fkey;

alter table public.inspection_reports
add constraint inspection_reports_organization_driver_fkey
foreign key (organization_id, driver_id)
references public.drivers(organization_id, id)
on delete set null;

alter table public.inspection_reports
drop constraint if exists inspection_reports_organization_equipment_fkey;

alter table public.inspection_reports
add constraint inspection_reports_organization_equipment_fkey
foreign key (organization_id, equipment_id)
references public.equipment(organization_id, id)
on delete set null;

alter table public.inspection_documents
drop constraint if exists inspection_documents_organization_inspection_fkey;

alter table public.inspection_documents
add constraint inspection_documents_organization_inspection_fkey
foreign key (organization_id, inspection_id)
references public.inspection_reports(organization_id, id)
on delete cascade;

alter table public.inspection_documents
drop constraint if exists inspection_documents_organization_carrier_fkey;

alter table public.inspection_documents
add constraint inspection_documents_organization_carrier_fkey
foreign key (organization_id, carrier_id)
references public.carriers(organization_id, id)
on delete cascade;

create index if not exists inspection_reports_organization_id_idx on public.inspection_reports(organization_id);
create index if not exists inspection_reports_carrier_id_idx on public.inspection_reports(carrier_id);
create index if not exists inspection_reports_inspection_date_idx on public.inspection_reports(inspection_date desc);
create index if not exists inspection_reports_out_of_service_idx on public.inspection_reports(out_of_service);
create index if not exists inspection_reports_status_idx on public.inspection_reports(status);
create index if not exists inspection_documents_organization_id_idx on public.inspection_documents(organization_id);
create index if not exists inspection_documents_inspection_id_idx on public.inspection_documents(inspection_id);
create index if not exists inspection_documents_carrier_id_idx on public.inspection_documents(carrier_id);

drop trigger if exists set_inspection_reports_updated_at on public.inspection_reports;
create trigger set_inspection_reports_updated_at before update on public.inspection_reports
for each row execute function public.set_updated_at();

alter table public.inspection_reports enable row level security;
alter table public.inspection_documents enable row level security;

drop policy if exists "Staff can read inspection audit logs" on public.audit_logs;
create policy "Staff can read inspection audit logs"
on public.audit_logs for select
to authenticated
using (
  public.current_user_role() = 'staff'::public.app_role
  and organization_id is not null
  and public.can_access_organization(organization_id)
  and action in (
    'inspection.created',
    'inspection.updated',
    'inspection.document_uploaded',
    'inspection.task_linked',
    'inspection.alert_created'
  )
);

drop policy if exists "Authorized users can read inspection reports" on public.inspection_reports;
create policy "Authorized users can read inspection reports"
on public.inspection_reports for select
to authenticated
using (
  public.is_platform_super_admin()
  or (
    public.can_manage_compliance()
    and public.can_access_organization(organization_id)
  )
  or (
    public.current_user_role() = 'carrier'::public.app_role
    and public.current_user_carrier_id() = carrier_id
    and public.can_access_organization(organization_id)
  )
);

drop policy if exists "Staff can create inspection reports" on public.inspection_reports;
create policy "Staff can create inspection reports"
on public.inspection_reports for insert
to authenticated
with check (
  public.is_platform_super_admin()
  or (
    public.can_manage_compliance()
    and public.can_access_organization(organization_id)
  )
);

drop policy if exists "Staff can update inspection reports" on public.inspection_reports;
create policy "Staff can update inspection reports"
on public.inspection_reports for update
to authenticated
using (
  public.is_platform_super_admin()
  or (
    public.can_manage_compliance()
    and public.can_access_organization(organization_id)
  )
)
with check (
  public.is_platform_super_admin()
  or (
    public.can_manage_compliance()
    and public.can_access_organization(organization_id)
  )
);

drop policy if exists "Authorized users can read inspection documents" on public.inspection_documents;
create policy "Authorized users can read inspection documents"
on public.inspection_documents for select
to authenticated
using (
  public.is_platform_super_admin()
  or (
    public.can_manage_compliance()
    and public.can_access_organization(organization_id)
  )
  or (
    public.current_user_role() = 'carrier'::public.app_role
    and public.current_user_carrier_id() = carrier_id
    and public.can_access_organization(organization_id)
  )
);

drop policy if exists "Authorized users can create inspection documents" on public.inspection_documents;
create policy "Authorized users can create inspection documents"
on public.inspection_documents for insert
to authenticated
with check (
  public.is_platform_super_admin()
  or (
    public.can_manage_compliance()
    and public.can_access_organization(organization_id)
  )
  or (
    public.current_user_role() = 'carrier'::public.app_role
    and public.current_user_carrier_id() = carrier_id
    and public.can_access_organization(organization_id)
  )
);

drop policy if exists "Authorized users can upload inspection files" on storage.objects;
create policy "Authorized users can upload inspection files"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'carrier-documents'
  and (storage.foldername(name))[1] = 'organizations'
  and (storage.foldername(name))[2] ~* '^[0-9a-f-]{36}$'
  and (storage.foldername(name))[3] = 'inspections'
  and (storage.foldername(name))[4] ~* '^[0-9a-f-]{36}$'
  and (storage.foldername(name))[5] is not null
  and (storage.foldername(name))[6] ~ '^v[0-9]+$'
  and exists (
    select 1
    from public.inspection_reports
    where inspection_reports.organization_id = ((storage.foldername(name))[2])::uuid
      and inspection_reports.id = ((storage.foldername(name))[4])::uuid
      and (
        public.is_platform_super_admin()
        or (
          public.can_manage_compliance()
          and public.can_access_organization(inspection_reports.organization_id)
        )
        or (
          public.current_user_role() = 'carrier'::public.app_role
          and public.current_user_carrier_id() = inspection_reports.carrier_id
          and public.can_access_organization(inspection_reports.organization_id)
        )
      )
  )
);

drop policy if exists "Authorized users can read inspection files" on storage.objects;
create policy "Authorized users can read inspection files"
on storage.objects for select
to authenticated
using (
  bucket_id = 'carrier-documents'
  and (storage.foldername(name))[1] = 'organizations'
  and (storage.foldername(name))[2] ~* '^[0-9a-f-]{36}$'
  and (storage.foldername(name))[3] = 'inspections'
  and (storage.foldername(name))[4] ~* '^[0-9a-f-]{36}$'
  and exists (
    select 1
    from public.inspection_reports
    where inspection_reports.organization_id = ((storage.foldername(name))[2])::uuid
      and inspection_reports.id = ((storage.foldername(name))[4])::uuid
      and (
        public.is_platform_super_admin()
        or (
          public.can_manage_compliance()
          and public.can_access_organization(inspection_reports.organization_id)
        )
        or (
          public.current_user_role() = 'carrier'::public.app_role
          and public.current_user_carrier_id() = inspection_reports.carrier_id
          and public.can_access_organization(inspection_reports.organization_id)
        )
      )
  )
);
