-- ManifestOS Fuel Receipts
-- Safe additive migration for tenant-scoped AI-assisted receipt review.

create extension if not exists pgcrypto;

do $$
begin
  if not exists (select 1 from pg_type where typnamespace = 'public'::regnamespace and typname = 'fuel_extraction_status') then
    create type public.fuel_extraction_status as enum ('pending', 'extracted', 'needs_review', 'failed', 'approved');
  end if;

  if exists (select 1 from pg_type where typnamespace = 'public'::regnamespace and typname = 'notification_category') then
    alter type public.notification_category add value if not exists 'fuel_operation';
  end if;
end $$;

create table if not exists public.fuel_receipts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  carrier_id uuid not null references public.carriers(id) on delete cascade,
  load_id uuid references public.loads(id) on delete set null,
  driver_id uuid,
  vehicle_id uuid references public.equipment(id) on delete set null,
  receipt_file_path text not null,
  file_name text,
  vendor_name text,
  transaction_date date,
  transaction_time time,
  fuel_type text,
  gallons numeric(12, 3),
  price_per_gallon numeric(12, 4),
  total_amount numeric(12, 2),
  city text,
  state text,
  odometer integer,
  payment_method text,
  card_last4 text,
  extraction_status public.fuel_extraction_status not null default 'pending',
  extraction_confidence numeric(5, 4) not null default 0,
  raw_extraction jsonb not null default '{}'::jsonb,
  notes text,
  uploaded_by uuid references public.users(id) on delete set null,
  approved_by uuid references public.users(id) on delete set null,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.fuel_receipts
  add column if not exists organization_id uuid references public.organizations(id) on delete cascade,
  add column if not exists carrier_id uuid references public.carriers(id) on delete cascade,
  add column if not exists load_id uuid references public.loads(id) on delete set null,
  add column if not exists driver_id uuid,
  add column if not exists vehicle_id uuid references public.equipment(id) on delete set null,
  add column if not exists receipt_file_path text,
  add column if not exists file_name text,
  add column if not exists vendor_name text,
  add column if not exists transaction_date date,
  add column if not exists transaction_time time,
  add column if not exists fuel_type text,
  add column if not exists gallons numeric(12, 3),
  add column if not exists price_per_gallon numeric(12, 4),
  add column if not exists total_amount numeric(12, 2),
  add column if not exists city text,
  add column if not exists state text,
  add column if not exists odometer integer,
  add column if not exists payment_method text,
  add column if not exists card_last4 text,
  add column if not exists extraction_status public.fuel_extraction_status not null default 'pending',
  add column if not exists extraction_confidence numeric(5, 4) not null default 0,
  add column if not exists raw_extraction jsonb not null default '{}'::jsonb,
  add column if not exists notes text,
  add column if not exists uploaded_by uuid references public.users(id) on delete set null,
  add column if not exists approved_by uuid references public.users(id) on delete set null,
  add column if not exists approved_at timestamptz,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'fuel_receipts_organization_id_id_unique') then
    alter table public.fuel_receipts
      add constraint fuel_receipts_organization_id_id_unique unique (organization_id, id);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'fuel_receipts_organization_carrier_fkey') then
    alter table public.fuel_receipts
      add constraint fuel_receipts_organization_carrier_fkey
      foreign key (organization_id, carrier_id)
      references public.carriers(organization_id, id)
      on delete cascade;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'fuel_receipts_organization_load_fkey') then
    alter table public.fuel_receipts
      add constraint fuel_receipts_organization_load_fkey
      foreign key (organization_id, load_id)
      references public.loads(organization_id, id)
      on delete set null;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'fuel_receipts_organization_uploaded_by_fkey') then
    alter table public.fuel_receipts
      add constraint fuel_receipts_organization_uploaded_by_fkey
      foreign key (organization_id, uploaded_by)
      references public.users(organization_id, id);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'fuel_receipts_organization_approved_by_fkey') then
    alter table public.fuel_receipts
      add constraint fuel_receipts_organization_approved_by_fkey
      foreign key (organization_id, approved_by)
      references public.users(organization_id, id);
  end if;
end $$;

create index if not exists fuel_receipts_organization_id_idx on public.fuel_receipts(organization_id);
create index if not exists fuel_receipts_carrier_id_idx on public.fuel_receipts(carrier_id);
create index if not exists fuel_receipts_load_id_idx on public.fuel_receipts(load_id);
create index if not exists fuel_receipts_transaction_date_idx on public.fuel_receipts(transaction_date desc);
create index if not exists fuel_receipts_state_idx on public.fuel_receipts(state);
create index if not exists fuel_receipts_fuel_type_idx on public.fuel_receipts(fuel_type);
create index if not exists fuel_receipts_extraction_status_idx on public.fuel_receipts(extraction_status);
create index if not exists fuel_receipts_created_at_idx on public.fuel_receipts(created_at desc);

drop trigger if exists set_fuel_receipts_updated_at on public.fuel_receipts;
create trigger set_fuel_receipts_updated_at before update on public.fuel_receipts
for each row execute function public.set_updated_at();

alter table public.fuel_receipts enable row level security;

drop policy if exists "Authorized users can read fuel receipts" on public.fuel_receipts;
create policy "Authorized users can read fuel receipts"
on public.fuel_receipts for select
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

drop policy if exists "Authorized users can insert fuel receipts" on public.fuel_receipts;
create policy "Authorized users can insert fuel receipts"
on public.fuel_receipts for insert
to authenticated
with check (
  (
    load_id is null
    or exists (
      select 1
      from public.loads
      where loads.id = fuel_receipts.load_id
        and loads.organization_id = fuel_receipts.organization_id
        and loads.carrier_id = fuel_receipts.carrier_id
    )
  )
  and (
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
  )
);

drop policy if exists "Authorized users can update fuel receipts" on public.fuel_receipts;
create policy "Authorized users can update fuel receipts"
on public.fuel_receipts for update
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
)
with check (
  (
    load_id is null
    or exists (
      select 1
      from public.loads
      where loads.id = fuel_receipts.load_id
        and loads.organization_id = fuel_receipts.organization_id
        and loads.carrier_id = fuel_receipts.carrier_id
    )
  )
  and (
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
  )
);

drop policy if exists "Admins can delete fuel receipts" on public.fuel_receipts;
create policy "Admins can delete fuel receipts"
on public.fuel_receipts for delete
to authenticated
using (
  public.is_platform_super_admin()
  or (public.is_admin() and public.can_access_organization(organization_id))
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
    'image/webp',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Authorized users can upload fuel receipt files" on storage.objects;
create policy "Authorized users can upload fuel receipt files"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'carrier-documents'
  and (storage.foldername(name))[1] = 'organizations'
  and (storage.foldername(name))[2] ~* '^[0-9a-f-]{36}$'
  and public.can_access_organization(((storage.foldername(name))[2])::uuid)
  and (storage.foldername(name))[3] = 'fuel-receipts'
  and (storage.foldername(name))[4] ~* '^[0-9a-f-]{36}$'
  and (storage.foldername(name))[5] ~* '^[0-9a-f-]{36}$'
  and (storage.foldername(name))[6] ~ '^v[0-9]+$'
  and exists (
    select 1
    from public.carriers
    where carriers.organization_id = ((storage.foldername(name))[2])::uuid
      and carriers.id = ((storage.foldername(name))[4])::uuid
      and (
        public.can_manage_compliance()
        or (
          public.current_user_role() = 'carrier'::public.app_role
          and public.current_user_carrier_id() = carriers.id
        )
      )
  )
);

drop policy if exists "Authorized users can read fuel receipt files" on storage.objects;
create policy "Authorized users can read fuel receipt files"
on storage.objects for select
to authenticated
using (
  bucket_id = 'carrier-documents'
  and (storage.foldername(name))[1] = 'organizations'
  and (storage.foldername(name))[2] ~* '^[0-9a-f-]{36}$'
  and public.can_access_organization(((storage.foldername(name))[2])::uuid)
  and (storage.foldername(name))[3] = 'fuel-receipts'
  and (storage.foldername(name))[4] ~* '^[0-9a-f-]{36}$'
  and (storage.foldername(name))[5] ~* '^[0-9a-f-]{36}$'
  and exists (
    select 1
    from public.fuel_receipts
    where fuel_receipts.organization_id = ((storage.foldername(name))[2])::uuid
      and fuel_receipts.carrier_id = ((storage.foldername(name))[4])::uuid
      and fuel_receipts.id = ((storage.foldername(name))[5])::uuid
      and (
        public.can_manage_compliance()
        or (
          public.current_user_role() = 'carrier'::public.app_role
          and public.current_user_carrier_id() = fuel_receipts.carrier_id
        )
      )
  )
);
