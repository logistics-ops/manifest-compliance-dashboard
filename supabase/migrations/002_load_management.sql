-- ManifestOS V1 Load Management
-- Safe additive migration for existing Supabase databases.

create extension if not exists pgcrypto;

do $$
begin
  if not exists (select 1 from pg_type where typnamespace = 'public'::regnamespace and typname = 'load_status') then
    create type public.load_status as enum (
      'booked',
      'in_transit',
      'delivered',
      'pod_uploaded',
      'pod_sent',
      'invoiced',
      'cancelled'
    );
  end if;

  if not exists (select 1 from pg_type where typnamespace = 'public'::regnamespace and typname = 'load_document_type') then
    create type public.load_document_type as enum ('rate_confirmation', 'pod');
  end if;
end $$;

create table if not exists public.loads (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  load_number text not null,
  carrier_id uuid not null references public.carriers(id) on delete cascade,
  driver_name text,
  broker_name text,
  broker_email text,
  origin_city text not null,
  origin_state text not null,
  destination_city text not null,
  destination_state text not null,
  pickup_date date,
  delivery_date date,
  rate_amount numeric(12, 2) not null default 0,
  status public.load_status not null default 'booked',
  notes text,
  created_by uuid references public.users(id) on delete set null,
  pod_sent_at timestamptz,
  pod_sent_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.loads
  add column if not exists organization_id uuid references public.organizations(id) on delete cascade,
  add column if not exists load_number text,
  add column if not exists carrier_id uuid references public.carriers(id) on delete cascade,
  add column if not exists driver_name text,
  add column if not exists broker_name text,
  add column if not exists broker_email text,
  add column if not exists origin_city text,
  add column if not exists origin_state text,
  add column if not exists destination_city text,
  add column if not exists destination_state text,
  add column if not exists pickup_date date,
  add column if not exists delivery_date date,
  add column if not exists rate_amount numeric(12, 2) not null default 0,
  add column if not exists status public.load_status not null default 'booked',
  add column if not exists notes text,
  add column if not exists created_by uuid references public.users(id) on delete set null,
  add column if not exists pod_sent_at timestamptz,
  add column if not exists pod_sent_by uuid references public.users(id) on delete set null,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

create table if not exists public.load_documents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  load_id uuid not null references public.loads(id) on delete cascade,
  carrier_id uuid not null references public.carriers(id) on delete cascade,
  document_type public.load_document_type not null,
  storage_path text not null,
  file_name text not null,
  file_size bigint,
  mime_type text,
  version_number integer not null,
  uploaded_by uuid references public.users(id) on delete set null,
  uploaded_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table public.load_documents
  add column if not exists organization_id uuid references public.organizations(id) on delete cascade,
  add column if not exists load_id uuid references public.loads(id) on delete cascade,
  add column if not exists carrier_id uuid references public.carriers(id) on delete cascade,
  add column if not exists document_type public.load_document_type,
  add column if not exists storage_path text,
  add column if not exists file_name text,
  add column if not exists file_size bigint,
  add column if not exists mime_type text,
  add column if not exists version_number integer,
  add column if not exists uploaded_by uuid references public.users(id) on delete set null,
  add column if not exists uploaded_at timestamptz not null default now(),
  add column if not exists created_at timestamptz not null default now();

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'loads_organization_load_number_key'
  ) then
    alter table public.loads
      add constraint loads_organization_load_number_key unique (organization_id, load_number);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'loads_organization_id_id_unique'
  ) then
    alter table public.loads
      add constraint loads_organization_id_id_unique unique (organization_id, id);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'load_documents_organization_load_type_version_key'
  ) then
    alter table public.load_documents
      add constraint load_documents_organization_load_type_version_key unique (
        organization_id,
        load_id,
        document_type,
        version_number
      );
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'loads_organization_carrier_fkey'
  ) then
    alter table public.loads
      add constraint loads_organization_carrier_fkey
      foreign key (organization_id, carrier_id)
      references public.carriers(organization_id, id);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'loads_organization_created_by_fkey'
  ) then
    alter table public.loads
      add constraint loads_organization_created_by_fkey
      foreign key (organization_id, created_by)
      references public.users(organization_id, id);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'loads_organization_pod_sent_by_fkey'
  ) then
    alter table public.loads
      add constraint loads_organization_pod_sent_by_fkey
      foreign key (organization_id, pod_sent_by)
      references public.users(organization_id, id);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'load_documents_organization_load_fkey'
  ) then
    alter table public.load_documents
      add constraint load_documents_organization_load_fkey
      foreign key (organization_id, load_id)
      references public.loads(organization_id, id)
      on delete cascade;
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'load_documents_organization_carrier_fkey'
  ) then
    alter table public.load_documents
      add constraint load_documents_organization_carrier_fkey
      foreign key (organization_id, carrier_id)
      references public.carriers(organization_id, id)
      on delete cascade;
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'load_documents_organization_uploaded_by_fkey'
  ) then
    alter table public.load_documents
      add constraint load_documents_organization_uploaded_by_fkey
      foreign key (organization_id, uploaded_by)
      references public.users(organization_id, id);
  end if;
end $$;

create index if not exists loads_organization_id_idx on public.loads(organization_id);
create index if not exists loads_carrier_id_idx on public.loads(carrier_id);
create index if not exists loads_status_idx on public.loads(status);
create index if not exists loads_pickup_date_idx on public.loads(pickup_date);
create index if not exists loads_created_at_idx on public.loads(created_at desc);
create index if not exists load_documents_organization_id_idx on public.load_documents(organization_id);
create index if not exists load_documents_load_id_idx on public.load_documents(load_id);
create index if not exists load_documents_carrier_id_idx on public.load_documents(carrier_id);
create index if not exists load_documents_type_idx on public.load_documents(document_type);
create index if not exists load_documents_uploaded_at_idx on public.load_documents(uploaded_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_loads_updated_at on public.loads;
create trigger set_loads_updated_at before update on public.loads
for each row execute function public.set_updated_at();

alter table public.loads enable row level security;
alter table public.load_documents enable row level security;

drop policy if exists "Authorized users can read loads" on public.loads;
create policy "Authorized users can read loads"
on public.loads for select
to authenticated
using (
  public.is_platform_super_admin()
  or (public.can_manage_compliance() and public.can_access_organization(organization_id))
  or (
    public.current_user_role() = 'carrier'::public.app_role
    and public.current_user_carrier_id() = carrier_id
    and public.can_access_organization(organization_id)
  )
);

drop policy if exists "Staff can insert loads" on public.loads;
create policy "Staff can insert loads"
on public.loads for insert
to authenticated
with check (
  (
    public.can_manage_compliance()
    and public.can_access_organization(organization_id)
  )
  or (
    public.current_user_role() = 'carrier'::public.app_role
    and public.current_user_carrier_id() = carrier_id
    and public.can_access_organization(organization_id)
  )
);

drop policy if exists "Staff can update loads" on public.loads;
create policy "Staff can update loads"
on public.loads for update
to authenticated
using (
  public.can_manage_compliance()
  and public.can_access_organization(organization_id)
)
with check (
  public.can_manage_compliance()
  and public.can_access_organization(organization_id)
);

drop policy if exists "Admins can delete loads" on public.loads;
create policy "Admins can delete loads"
on public.loads for delete
to authenticated
using (
  public.is_admin()
  and public.can_access_organization(organization_id)
);

drop policy if exists "Authorized users can read load documents" on public.load_documents;
create policy "Authorized users can read load documents"
on public.load_documents for select
to authenticated
using (
  public.is_platform_super_admin()
  or (public.can_manage_compliance() and public.can_access_organization(organization_id))
  or (
    public.current_user_role() = 'carrier'::public.app_role
    and public.current_user_carrier_id() = carrier_id
    and public.can_access_organization(organization_id)
  )
);

drop policy if exists "Authorized users can insert load documents" on public.load_documents;
create policy "Authorized users can insert load documents"
on public.load_documents for insert
to authenticated
with check (
  public.is_platform_super_admin()
  or
  (
    public.can_manage_compliance()
    and public.can_access_organization(organization_id)
    and exists (
      select 1
      from public.loads
      where loads.id = load_documents.load_id
        and loads.organization_id = load_documents.organization_id
        and loads.carrier_id = load_documents.carrier_id
    )
  )
  or (
    document_type in ('pod'::public.load_document_type, 'rate_confirmation'::public.load_document_type)
    and public.current_user_role() = 'carrier'::public.app_role
    and public.current_user_carrier_id() = carrier_id
    and public.can_access_organization(organization_id)
    and exists (
      select 1
      from public.loads
      where loads.id = load_documents.load_id
        and loads.organization_id = load_documents.organization_id
        and loads.carrier_id = public.current_user_carrier_id()
    )
  )
);

drop policy if exists "Authorized users can update load documents" on public.load_documents;
create policy "Authorized users can update load documents"
on public.load_documents for update
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
    and exists (
      select 1
      from public.loads
      where loads.id = load_documents.load_id
        and loads.organization_id = load_documents.organization_id
        and loads.carrier_id = public.current_user_carrier_id()
    )
  )
)
with check (
  public.is_platform_super_admin()
  or (
    public.can_manage_compliance()
    and public.can_access_organization(organization_id)
    and exists (
      select 1
      from public.loads
      where loads.id = load_documents.load_id
        and loads.organization_id = load_documents.organization_id
        and loads.carrier_id = load_documents.carrier_id
    )
  )
  or (
    document_type in ('pod'::public.load_document_type, 'rate_confirmation'::public.load_document_type)
    and public.current_user_role() = 'carrier'::public.app_role
    and public.current_user_carrier_id() = carrier_id
    and public.can_access_organization(organization_id)
    and exists (
      select 1
      from public.loads
      where loads.id = load_documents.load_id
        and loads.organization_id = load_documents.organization_id
        and loads.carrier_id = public.current_user_carrier_id()
    )
  )
);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'carrier-documents',
  'carrier-documents',
  false,
  26214400,
  array[
    'application/pdf',
    'image/jpeg',
    'image/png',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Authorized users can upload load document files" on storage.objects;
create policy "Authorized users can upload load document files"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'carrier-documents'
  and (storage.foldername(name))[1] = 'organizations'
  and (storage.foldername(name))[2] ~* '^[0-9a-f-]{36}$'
  and public.can_access_organization(((storage.foldername(name))[2])::uuid)
  and (storage.foldername(name))[3] = 'loads'
  and (storage.foldername(name))[4] ~* '^[0-9a-f-]{36}$'
  and (storage.foldername(name))[5] in ('rate-confirmation', 'pod')
  and (storage.foldername(name))[6] ~ '^v[0-9]+$'
  and exists (
    select 1
    from public.loads
    where loads.organization_id = ((storage.foldername(name))[2])::uuid
      and loads.id = ((storage.foldername(name))[4])::uuid
      and (
        public.can_manage_compliance()
        or (
          public.current_user_role() = 'carrier'::public.app_role
          and public.current_user_carrier_id() = loads.carrier_id
        )
      )
  )
);

drop policy if exists "Authorized users can read load document files" on storage.objects;
create policy "Authorized users can read load document files"
on storage.objects for select
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
      and (
        public.can_manage_compliance()
        or (
          public.current_user_role() = 'carrier'::public.app_role
          and public.current_user_carrier_id() = loads.carrier_id
        )
      )
  )
);
