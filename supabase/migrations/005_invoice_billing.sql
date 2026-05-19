-- ManifestOS Invoice Generation + Broker Billing
-- Safe additive migration. Does not drop existing operational data.

do $$
begin
  if not exists (select 1 from pg_type where typnamespace = 'public'::regnamespace and typname = 'invoice_status') then
    create type public.invoice_status as enum ('draft', 'sent', 'paid', 'overdue', 'void');
  end if;
end $$;

alter type public.notification_category add value if not exists 'invoice_operation';

create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  carrier_id uuid not null references public.carriers(id) on delete cascade,
  load_id uuid not null references public.loads(id) on delete cascade,
  invoice_number text not null,
  broker_name text,
  broker_email text,
  invoice_date date not null default current_date,
  due_date date,
  subtotal numeric(12, 2) not null default 0,
  total_amount numeric(12, 2) not null default 0,
  notes text,
  status public.invoice_status not null default 'draft',
  storage_path text,
  file_name text,
  version_number integer not null default 1,
  sent_at timestamptz,
  paid_at timestamptz,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.invoice_documents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  load_id uuid not null references public.loads(id) on delete cascade,
  carrier_id uuid not null references public.carriers(id) on delete cascade,
  storage_path text not null,
  file_name text not null,
  file_size bigint,
  mime_type text,
  version_number integer not null default 1,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.invoices
  add column if not exists organization_id uuid references public.organizations(id) on delete cascade,
  add column if not exists carrier_id uuid references public.carriers(id) on delete cascade,
  add column if not exists load_id uuid references public.loads(id) on delete cascade,
  add column if not exists invoice_number text,
  add column if not exists broker_name text,
  add column if not exists broker_email text,
  add column if not exists invoice_date date not null default current_date,
  add column if not exists due_date date,
  add column if not exists subtotal numeric(12, 2) not null default 0,
  add column if not exists total_amount numeric(12, 2) not null default 0,
  add column if not exists notes text,
  add column if not exists status public.invoice_status not null default 'draft',
  add column if not exists storage_path text,
  add column if not exists file_name text,
  add column if not exists version_number integer not null default 1,
  add column if not exists sent_at timestamptz,
  add column if not exists paid_at timestamptz,
  add column if not exists created_by uuid references public.users(id) on delete set null,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'invoices_organization_invoice_number_key') then
    alter table public.invoices add constraint invoices_organization_invoice_number_key unique (organization_id, invoice_number);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'invoices_organization_id_id_unique') then
    alter table public.invoices add constraint invoices_organization_id_id_unique unique (organization_id, id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'invoices_organization_load_fkey') then
    alter table public.invoices add constraint invoices_organization_load_fkey foreign key (organization_id, load_id) references public.loads(organization_id, id) on delete cascade;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'invoices_organization_carrier_fkey') then
    alter table public.invoices add constraint invoices_organization_carrier_fkey foreign key (organization_id, carrier_id) references public.carriers(organization_id, id) on delete cascade;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'invoices_organization_created_by_fkey') then
    alter table public.invoices add constraint invoices_organization_created_by_fkey foreign key (organization_id, created_by) references public.users(organization_id, id);
  end if;
end $$;

create index if not exists invoices_organization_id_idx on public.invoices(organization_id);
create index if not exists invoices_carrier_id_idx on public.invoices(carrier_id);
create index if not exists invoices_load_id_idx on public.invoices(load_id);
create index if not exists invoices_status_idx on public.invoices(status);
create index if not exists invoices_due_date_idx on public.invoices(due_date);
create index if not exists invoice_documents_invoice_id_idx on public.invoice_documents(invoice_id);
create index if not exists invoice_documents_organization_id_idx on public.invoice_documents(organization_id);

drop trigger if exists set_invoices_updated_at on public.invoices;
create trigger set_invoices_updated_at before update on public.invoices
for each row execute function public.set_updated_at();

alter table public.invoices enable row level security;
alter table public.invoice_documents enable row level security;

drop policy if exists "Authorized users can read invoices" on public.invoices;
create policy "Authorized users can read invoices"
on public.invoices for select
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

drop policy if exists "Authorized users can insert invoices" on public.invoices;
create policy "Authorized users can insert invoices"
on public.invoices for insert
to authenticated
with check (
  public.is_platform_super_admin()
  or (public.can_manage_compliance() and public.can_access_organization(organization_id))
  or (
    public.current_user_role() = 'carrier'::public.app_role
    and public.current_user_carrier_id() = carrier_id
    and public.can_access_organization(organization_id)
  )
);

drop policy if exists "Authorized users can update invoices" on public.invoices;
create policy "Authorized users can update invoices"
on public.invoices for update
to authenticated
using (
  public.is_platform_super_admin()
  or (public.can_manage_compliance() and public.can_access_organization(organization_id))
  or (
    public.current_user_role() = 'carrier'::public.app_role
    and public.current_user_carrier_id() = carrier_id
    and public.can_access_organization(organization_id)
  )
)
with check (
  public.is_platform_super_admin()
  or (public.can_manage_compliance() and public.can_access_organization(organization_id))
  or (
    public.current_user_role() = 'carrier'::public.app_role
    and public.current_user_carrier_id() = carrier_id
    and public.can_access_organization(organization_id)
  )
);

drop policy if exists "Authorized users can read invoice documents" on public.invoice_documents;
create policy "Authorized users can read invoice documents"
on public.invoice_documents for select
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

drop policy if exists "Authorized users can upload invoice files" on storage.objects;
create policy "Authorized users can upload invoice files"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'carrier-documents'
  and (storage.foldername(name))[1] = 'organizations'
  and (storage.foldername(name))[2] ~* '^[0-9a-f-]{36}$'
  and public.can_access_organization(((storage.foldername(name))[2])::uuid)
  and (storage.foldername(name))[3] = 'loads'
  and (storage.foldername(name))[4] ~* '^[0-9a-f-]{36}$'
  and (storage.foldername(name))[5] = 'invoices'
  and (storage.foldername(name))[6] ~ '^v[0-9]+$'
  and exists (
    select 1 from public.loads
    where loads.organization_id = ((storage.foldername(name))[2])::uuid
      and loads.id = ((storage.foldername(name))[4])::uuid
      and (
        public.can_manage_compliance()
        or (public.current_user_role() = 'carrier'::public.app_role and public.current_user_carrier_id() = loads.carrier_id)
      )
  )
);

drop policy if exists "Authorized users can read invoice files" on storage.objects;
create policy "Authorized users can read invoice files"
on storage.objects for select
to authenticated
using (
  bucket_id = 'carrier-documents'
  and (storage.foldername(name))[1] = 'organizations'
  and (storage.foldername(name))[2] ~* '^[0-9a-f-]{36}$'
  and public.can_access_organization(((storage.foldername(name))[2])::uuid)
  and (storage.foldername(name))[3] = 'loads'
  and (storage.foldername(name))[4] ~* '^[0-9a-f-]{36}$'
  and (storage.foldername(name))[5] = 'invoices'
  and exists (
    select 1 from public.loads
    where loads.organization_id = ((storage.foldername(name))[2])::uuid
      and loads.id = ((storage.foldername(name))[4])::uuid
      and (
        public.can_manage_compliance()
        or (public.current_user_role() = 'carrier'::public.app_role and public.current_user_carrier_id() = loads.carrier_id)
      )
  )
);
