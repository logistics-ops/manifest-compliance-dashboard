-- Manifest Global Logistics carrier compliance schema
-- Run this in the Supabase SQL editor after enabling Supabase Auth.

create extension if not exists pgcrypto;

create type public.app_role as enum ('admin', 'staff', 'carrier');
create type public.carrier_status as enum ('active', 'pending', 'suspended', 'inactive');
create type public.document_status as enum ('valid', 'expiring_soon', 'expired', 'missing');
create type public.alert_status as enum ('open', 'acknowledged', 'resolved');
create type public.alert_type as enum (
  'missing_document',
  'expiring_30_days',
  'expired',
  'needs_review',
  'audit_ready'
);
create type public.equipment_status as enum ('active', 'maintenance', 'inactive');
create type public.notification_status as enum ('unread', 'read', 'dismissed');
create type public.notification_priority as enum ('low', 'medium', 'high', 'critical');
create type public.notification_category as enum (
  'document_expiration',
  'missing_document',
  'expired_document',
  'expired_insurance',
  'high_risk_carrier',
  'weekly_summary'
);
create type public.load_status as enum (
  'booked',
  'in_transit',
  'delivered',
  'pod_uploaded',
  'pod_sent',
  'invoiced',
  'cancelled'
);
create type public.load_document_type as enum ('rate_confirmation', 'pod');

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  subdomain text not null unique,
  logo_url text,
  primary_color text not null default '#e31937',
  secondary_color text not null default '#8d1022',
  accent_color text not null default '#ff4d5d',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (slug ~ '^[a-z0-9]([a-z0-9-]*[a-z0-9])?$'),
  check (subdomain ~ '^[a-z0-9]([a-z0-9-]*[a-z0-9])?$'),
  check (primary_color ~ '^#[0-9a-fA-F]{6}$'),
  check (secondary_color ~ '^#[0-9a-fA-F]{6}$'),
  check (accent_color ~ '^#[0-9a-fA-F]{6}$')
);

create table public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  organization_id uuid references public.organizations(id) on delete restrict,
  email text not null unique,
  full_name text,
  role public.app_role not null default 'carrier',
  platform_super_admin boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.carriers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  company_name text not null,
  mc_number text not null,
  dot_number text not null,
  contact_name text,
  phone text,
  email text,
  status public.carrier_status not null default 'pending',
  compliance_score integer not null default 100 check (compliance_score between 0 and 100),
  risk_level text not null default 'Audit Ready',
  notes text,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, mc_number),
  unique (organization_id, dot_number)
);

alter table public.users
add column carrier_id uuid references public.carriers(id) on delete set null;

create table public.carrier_documents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  carrier_id uuid not null references public.carriers(id) on delete cascade,
  document_name text not null,
  storage_path text,
  file_name text,
  file_size bigint,
  mime_type text,
  uploaded boolean not null default false,
  expiration_date date,
  status public.document_status not null default 'missing',
  notes text,
  uploaded_by uuid references public.users(id) on delete set null,
  uploaded_at timestamptz,
  version_number integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, carrier_id, document_name)
);

create table public.carrier_document_versions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  carrier_document_id uuid references public.carrier_documents(id) on delete cascade,
  carrier_id uuid not null references public.carriers(id) on delete cascade,
  document_name text not null,
  storage_path text not null,
  file_name text not null,
  file_size bigint,
  mime_type text,
  version_number integer not null,
  uploaded_by uuid references public.users(id) on delete set null,
  uploaded_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (organization_id, carrier_id, document_name, version_number)
);

create table public.drivers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  carrier_id uuid not null references public.carriers(id) on delete cascade,
  first_name text not null,
  last_name text not null,
  phone text,
  email text,
  cdl_number text,
  cdl_state text,
  status text not null default 'active',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.driver_documents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  driver_id uuid not null references public.drivers(id) on delete cascade,
  document_name text not null,
  storage_path text,
  uploaded boolean not null default false,
  expiration_date date,
  status public.document_status not null default 'missing',
  notes text,
  uploaded_by uuid references public.users(id) on delete set null,
  uploaded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (driver_id, document_name)
);

create table public.equipment (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  carrier_id uuid not null references public.carriers(id) on delete cascade,
  unit_number text not null,
  equipment_type text not null,
  vin text unique,
  plate_number text,
  plate_state text,
  status public.equipment_status not null default 'active',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (carrier_id, unit_number)
);

create table public.equipment_documents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  equipment_id uuid not null references public.equipment(id) on delete cascade,
  document_name text not null,
  storage_path text,
  uploaded boolean not null default false,
  expiration_date date,
  status public.document_status not null default 'missing',
  notes text,
  uploaded_by uuid references public.users(id) on delete set null,
  uploaded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (equipment_id, document_name)
);

create table public.compliance_notes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  carrier_id uuid references public.carriers(id) on delete cascade,
  driver_id uuid references public.drivers(id) on delete cascade,
  equipment_id uuid references public.equipment(id) on delete cascade,
  document_table text,
  document_id uuid,
  note text not null,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    document_table is null
    or document_table in ('carrier_documents', 'driver_documents', 'equipment_documents')
  ),
  check (
    carrier_id is not null
    or driver_id is not null
    or equipment_id is not null
    or document_id is not null
  )
);

create table public.compliance_alerts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  carrier_id uuid references public.carriers(id) on delete cascade,
  driver_id uuid references public.drivers(id) on delete cascade,
  equipment_id uuid references public.equipment(id) on delete cascade,
  document_table text,
  document_id uuid,
  alert_type public.alert_type not null,
  title text not null,
  message text,
  status public.alert_status not null default 'open',
  severity text not null default 'medium',
  due_date date,
  assigned_to uuid references public.users(id) on delete set null,
  resolved_by uuid references public.users(id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    document_table is null
    or document_table in ('carrier_documents', 'driver_documents', 'equipment_documents')
  )
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  carrier_id uuid references public.carriers(id) on delete cascade,
  document_name text,
  title text not null,
  message text not null,
  category public.notification_category not null,
  priority public.notification_priority not null default 'medium',
  status public.notification_status not null default 'unread',
  assigned_to uuid references public.users(id) on delete set null,
  read_at timestamptz,
  dismissed_by uuid references public.users(id) on delete set null,
  dismissed_at timestamptz,
  due_date date,
  rule_key text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, rule_key)
);

create table public.loads (
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
  updated_at timestamptz not null default now(),
  unique (organization_id, load_number)
);

create table public.load_documents (
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
  created_at timestamptz not null default now(),
  unique (organization_id, load_id, document_type, version_number)
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete set null,
  actor_user_id uuid references public.users(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists organizations_subdomain_idx on public.organizations(subdomain);
create index if not exists users_organization_id_idx on public.users(organization_id);
create index if not exists carriers_organization_id_idx on public.carriers(organization_id);
create index if not exists carriers_status_idx on public.carriers(status);
create index if not exists carriers_compliance_score_idx on public.carriers(compliance_score);
create index if not exists users_role_idx on public.users(role);
create index if not exists users_carrier_id_idx on public.users(carrier_id);
create index if not exists carrier_documents_carrier_id_idx on public.carrier_documents(carrier_id);
create index if not exists carrier_documents_organization_id_idx on public.carrier_documents(organization_id);
create index if not exists carrier_documents_status_idx on public.carrier_documents(status);
create index if not exists carrier_documents_expiration_date_idx on public.carrier_documents(expiration_date);
create index if not exists carrier_document_versions_carrier_document_id_idx on public.carrier_document_versions(carrier_document_id);
create index if not exists carrier_document_versions_carrier_id_idx on public.carrier_document_versions(carrier_id);
create index if not exists carrier_document_versions_organization_id_idx on public.carrier_document_versions(organization_id);
create index if not exists drivers_carrier_id_idx on public.drivers(carrier_id);
create index if not exists drivers_organization_id_idx on public.drivers(organization_id);
create index if not exists driver_documents_driver_id_idx on public.driver_documents(driver_id);
create index if not exists driver_documents_status_idx on public.driver_documents(status);
create index if not exists driver_documents_expiration_date_idx on public.driver_documents(expiration_date);
create index if not exists equipment_carrier_id_idx on public.equipment(carrier_id);
create index if not exists equipment_organization_id_idx on public.equipment(organization_id);
create index if not exists equipment_documents_equipment_id_idx on public.equipment_documents(equipment_id);
create index if not exists equipment_documents_status_idx on public.equipment_documents(status);
create index if not exists equipment_documents_expiration_date_idx on public.equipment_documents(expiration_date);
create index if not exists compliance_notes_carrier_id_idx on public.compliance_notes(carrier_id);
create index if not exists compliance_notes_document_ref_idx on public.compliance_notes(document_table, document_id);
create index if not exists compliance_notes_created_at_idx on public.compliance_notes(created_at desc);
create index if not exists compliance_alerts_carrier_id_idx on public.compliance_alerts(carrier_id);
create index if not exists compliance_alerts_document_ref_idx on public.compliance_alerts(document_table, document_id);
create index if not exists compliance_alerts_status_idx on public.compliance_alerts(status);
create index if not exists compliance_alerts_due_date_idx on public.compliance_alerts(due_date);
create index if not exists notifications_status_idx on public.notifications(status);
create index if not exists notifications_organization_id_idx on public.notifications(organization_id);
create index if not exists notifications_priority_idx on public.notifications(priority);
create index if not exists notifications_category_idx on public.notifications(category);
create index if not exists notifications_carrier_id_idx on public.notifications(carrier_id);
create index if not exists notifications_assigned_to_idx on public.notifications(assigned_to);
create index if not exists notifications_created_at_idx on public.notifications(created_at desc);
create index if not exists loads_organization_id_idx on public.loads(organization_id);
create index if not exists loads_carrier_id_idx on public.loads(carrier_id);
create index if not exists loads_status_idx on public.loads(status);
create index if not exists loads_pickup_date_idx on public.loads(pickup_date);
create index if not exists load_documents_organization_id_idx on public.load_documents(organization_id);
create index if not exists load_documents_load_id_idx on public.load_documents(load_id);
create index if not exists load_documents_carrier_id_idx on public.load_documents(carrier_id);
create index if not exists load_documents_type_idx on public.load_documents(document_type);
create index if not exists audit_logs_organization_id_idx on public.audit_logs(organization_id);
create index if not exists audit_logs_actor_user_id_idx on public.audit_logs(actor_user_id);
create index if not exists audit_logs_action_idx on public.audit_logs(action);
create index if not exists audit_logs_entity_idx on public.audit_logs(entity_type, entity_id);
create index if not exists audit_logs_created_at_idx on public.audit_logs(created_at desc);

alter table public.carriers
add constraint carriers_organization_id_id_unique unique (organization_id, id);

alter table public.carrier_documents
add constraint carrier_documents_organization_carrier_fkey
foreign key (organization_id, carrier_id)
references public.carriers(organization_id, id)
on delete cascade,
add constraint carrier_documents_organization_id_id_unique unique (organization_id, id);

alter table public.carrier_document_versions
add constraint carrier_document_versions_organization_carrier_fkey
foreign key (organization_id, carrier_id)
references public.carriers(organization_id, id)
on delete cascade,
add constraint carrier_document_versions_organization_document_fkey
foreign key (organization_id, carrier_document_id)
references public.carrier_documents(organization_id, id)
on delete cascade;

alter table public.drivers
add constraint drivers_organization_carrier_fkey
foreign key (organization_id, carrier_id)
references public.carriers(organization_id, id)
on delete cascade,
add constraint drivers_organization_id_id_unique unique (organization_id, id);

alter table public.driver_documents
add constraint driver_documents_organization_driver_fkey
foreign key (organization_id, driver_id)
references public.drivers(organization_id, id)
on delete cascade;

alter table public.equipment
add constraint equipment_organization_carrier_fkey
foreign key (organization_id, carrier_id)
references public.carriers(organization_id, id)
on delete cascade,
add constraint equipment_organization_id_id_unique unique (organization_id, id);

alter table public.equipment_documents
add constraint equipment_documents_organization_equipment_fkey
foreign key (organization_id, equipment_id)
references public.equipment(organization_id, id)
on delete cascade;

alter table public.users
add constraint users_organization_id_id_unique unique (organization_id, id),
add constraint users_organization_carrier_fkey
foreign key (organization_id, carrier_id)
references public.carriers(organization_id, id);

alter table public.carriers
add constraint carriers_organization_created_by_fkey
foreign key (organization_id, created_by)
references public.users(organization_id, id);

alter table public.carrier_documents
add constraint carrier_documents_organization_uploaded_by_fkey
foreign key (organization_id, uploaded_by)
references public.users(organization_id, id);

alter table public.carrier_document_versions
add constraint carrier_document_versions_organization_uploaded_by_fkey
foreign key (organization_id, uploaded_by)
references public.users(organization_id, id);

alter table public.driver_documents
add constraint driver_documents_organization_uploaded_by_fkey
foreign key (organization_id, uploaded_by)
references public.users(organization_id, id);

alter table public.equipment_documents
add constraint equipment_documents_organization_uploaded_by_fkey
foreign key (organization_id, uploaded_by)
references public.users(organization_id, id);

alter table public.compliance_notes
add constraint compliance_notes_organization_carrier_fkey
foreign key (organization_id, carrier_id)
references public.carriers(organization_id, id),
add constraint compliance_notes_organization_driver_fkey
foreign key (organization_id, driver_id)
references public.drivers(organization_id, id),
add constraint compliance_notes_organization_equipment_fkey
foreign key (organization_id, equipment_id)
references public.equipment(organization_id, id),
add constraint compliance_notes_organization_created_by_fkey
foreign key (organization_id, created_by)
references public.users(organization_id, id);

alter table public.compliance_alerts
add constraint compliance_alerts_organization_carrier_fkey
foreign key (organization_id, carrier_id)
references public.carriers(organization_id, id),
add constraint compliance_alerts_organization_driver_fkey
foreign key (organization_id, driver_id)
references public.drivers(organization_id, id),
add constraint compliance_alerts_organization_equipment_fkey
foreign key (organization_id, equipment_id)
references public.equipment(organization_id, id),
add constraint compliance_alerts_organization_assigned_to_fkey
foreign key (organization_id, assigned_to)
references public.users(organization_id, id),
add constraint compliance_alerts_organization_resolved_by_fkey
foreign key (organization_id, resolved_by)
references public.users(organization_id, id);

alter table public.notifications
add constraint notifications_organization_carrier_fkey
foreign key (organization_id, carrier_id)
references public.carriers(organization_id, id),
add constraint notifications_organization_assigned_to_fkey
foreign key (organization_id, assigned_to)
references public.users(organization_id, id),
add constraint notifications_organization_dismissed_by_fkey
foreign key (organization_id, dismissed_by)
references public.users(organization_id, id);

alter table public.loads
add constraint loads_organization_carrier_fkey
foreign key (organization_id, carrier_id)
references public.carriers(organization_id, id),
add constraint loads_organization_created_by_fkey
foreign key (organization_id, created_by)
references public.users(organization_id, id),
add constraint loads_organization_pod_sent_by_fkey
foreign key (organization_id, pod_sent_by)
references public.users(organization_id, id),
add constraint loads_organization_id_id_unique unique (organization_id, id);

alter table public.load_documents
add constraint load_documents_organization_load_fkey
foreign key (organization_id, load_id)
references public.loads(organization_id, id)
on delete cascade,
add constraint load_documents_organization_carrier_fkey
foreign key (organization_id, carrier_id)
references public.carriers(organization_id, id)
on delete cascade,
add constraint load_documents_organization_uploaded_by_fkey
foreign key (organization_id, uploaded_by)
references public.users(organization_id, id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.prevent_user_tenant_privilege_escalation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return new;
  end if;

  if public.is_platform_super_admin() then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.platform_super_admin = true
      or new.organization_id is distinct from public.current_user_organization_id() then
      raise exception 'Only platform super admins can create users outside their tenant or grant platform privileges.';
    end if;

    return new;
  end if;

  if old.platform_super_admin is distinct from new.platform_super_admin
    or old.organization_id is distinct from new.organization_id
    or old.platform_super_admin = true then
    raise exception 'Only platform super admins can change user tenant or platform privileges.';
  end if;

  return new;
end;
$$;

create trigger set_users_updated_at before update on public.users
for each row execute function public.set_updated_at();
create trigger prevent_user_tenant_privilege_escalation before insert or update on public.users
for each row execute function public.prevent_user_tenant_privilege_escalation();
create trigger set_organizations_updated_at before update on public.organizations
for each row execute function public.set_updated_at();
create trigger set_carriers_updated_at before update on public.carriers
for each row execute function public.set_updated_at();
create trigger set_carrier_documents_updated_at before update on public.carrier_documents
for each row execute function public.set_updated_at();
create trigger set_drivers_updated_at before update on public.drivers
for each row execute function public.set_updated_at();
create trigger set_driver_documents_updated_at before update on public.driver_documents
for each row execute function public.set_updated_at();
create trigger set_equipment_updated_at before update on public.equipment
for each row execute function public.set_updated_at();
create trigger set_equipment_documents_updated_at before update on public.equipment_documents
for each row execute function public.set_updated_at();
create trigger set_compliance_notes_updated_at before update on public.compliance_notes
for each row execute function public.set_updated_at();
create trigger set_compliance_alerts_updated_at before update on public.compliance_alerts
for each row execute function public.set_updated_at();
create trigger set_notifications_updated_at before update on public.notifications
for each row execute function public.set_updated_at();
create trigger set_loads_updated_at before update on public.loads
for each row execute function public.set_updated_at();

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, email, full_name, role, organization_id, platform_super_admin)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    coalesce((new.raw_user_meta_data ->> 'role')::public.app_role, 'carrier'),
    nullif(new.raw_user_meta_data ->> 'organization_id', '')::uuid,
    coalesce((new.raw_user_meta_data ->> 'platform_super_admin')::boolean, false)
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_auth_user();

create or replace function public.current_user_role()
returns public.app_role
language sql
stable
security definer
set search_path = public
as $$
  select role
  from public.users
  where id = auth.uid()
    and is_active = true
  limit 1
$$;

create or replace function public.current_user_organization_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select organization_id
  from public.users
  where id = auth.uid()
    and is_active = true
  limit 1
$$;

create or replace function public.is_platform_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(platform_super_admin, false)
  from public.users
  where id = auth.uid()
    and is_active = true
  limit 1
$$;

create or replace function public.can_access_organization(target_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_platform_super_admin()
    or (
      public.current_user_organization_id() = target_organization_id
      and exists (
        select 1
        from public.organizations
        where organizations.id = target_organization_id
          and organizations.is_active = true
      )
    )
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_platform_super_admin() or public.current_user_role() = 'admin'::public.app_role
$$;

create or replace function public.can_manage_compliance()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_platform_super_admin() or public.current_user_role() in ('admin', 'staff')
$$;

create or replace function public.current_user_carrier_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select carrier_id
  from public.users
  where id = auth.uid()
    and is_active = true
  limit 1
$$;

create or replace function public.can_view_carrier(target_carrier_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_platform_super_admin()
    or exists (
      select 1
      from public.carriers
      where carriers.id = target_carrier_id
        and public.can_access_organization(carriers.organization_id)
        and public.can_manage_compliance()
    )
    or (
      public.current_user_role() = 'carrier'::public.app_role
      and public.current_user_carrier_id() = target_carrier_id
      and exists (
        select 1
        from public.carriers
        where carriers.id = target_carrier_id
          and public.can_access_organization(carriers.organization_id)
      )
    )
$$;

alter table public.organizations enable row level security;
alter table public.users enable row level security;
alter table public.carriers enable row level security;
alter table public.carrier_documents enable row level security;
alter table public.carrier_document_versions enable row level security;
alter table public.drivers enable row level security;
alter table public.driver_documents enable row level security;
alter table public.equipment enable row level security;
alter table public.equipment_documents enable row level security;
alter table public.compliance_notes enable row level security;
alter table public.compliance_alerts enable row level security;
alter table public.notifications enable row level security;
alter table public.loads enable row level security;
alter table public.load_documents enable row level security;
alter table public.audit_logs enable row level security;

create policy "Active organizations are discoverable by subdomain"
on public.organizations for select
to anon, authenticated
using (is_active = true);

create policy "Platform super admins can manage organizations"
on public.organizations for all
to authenticated
using (public.is_platform_super_admin())
with check (public.is_platform_super_admin());

create policy "Users can read own profile"
on public.users for select
to authenticated
using (id = auth.uid() or public.is_platform_super_admin() or public.can_access_organization(organization_id));

create policy "Admins can manage users"
on public.users for all
to authenticated
using (public.is_platform_super_admin() or (public.is_admin() and public.can_access_organization(organization_id)))
with check (public.is_platform_super_admin() or (public.is_admin() and public.can_access_organization(organization_id)));

create policy "Authorized users can read carriers"
on public.carriers for select
to authenticated
using (public.can_view_carrier(id));

create policy "Admins can insert carriers"
on public.carriers for insert
to authenticated
with check (public.is_admin() and public.can_access_organization(organization_id));

create policy "Admins can update carriers"
on public.carriers for update
to authenticated
using (public.is_admin() and public.can_access_organization(organization_id))
with check (public.is_admin() and public.can_access_organization(organization_id));

create policy "Admins can delete carriers"
on public.carriers for delete
to authenticated
using (public.is_admin() and public.can_access_organization(organization_id));

create policy "Authorized users can read carrier documents"
on public.carrier_documents for select
to authenticated
using (public.can_view_carrier(carrier_id));

create policy "Authorized users can insert carrier documents"
on public.carrier_documents for insert
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

create policy "Authorized users can update carrier documents"
on public.carrier_documents for update
to authenticated
using (
  (
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
    public.can_manage_compliance()
    and public.can_access_organization(organization_id)
  )
  or (
    public.current_user_role() = 'carrier'::public.app_role
    and public.current_user_carrier_id() = carrier_id
    and public.can_access_organization(organization_id)
  )
);

create policy "Authorized users can read carrier document versions"
on public.carrier_document_versions for select
to authenticated
using (public.can_view_carrier(carrier_id));

create policy "Authorized users can create carrier document versions"
on public.carrier_document_versions for insert
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

create policy "Admins can delete carrier document versions"
on public.carrier_document_versions for delete
to authenticated
using (public.is_admin() and public.can_access_organization(organization_id));

create policy "Authorized users can read drivers"
on public.drivers for select
to authenticated
using (public.can_view_carrier(carrier_id));

create policy "Admins can manage drivers"
on public.drivers for all
to authenticated
using (public.is_admin() and public.can_access_organization(organization_id))
with check (public.is_admin() and public.can_access_organization(organization_id));

create policy "Authorized users can read driver documents"
on public.driver_documents for select
to authenticated
using (
  exists (
    select 1
    from public.drivers
    where drivers.id = driver_documents.driver_id
      and public.can_view_carrier(drivers.carrier_id)
  )
);

create policy "Staff can manage driver documents"
on public.driver_documents for all
to authenticated
using (public.can_manage_compliance() and public.can_access_organization(organization_id))
with check (public.can_manage_compliance() and public.can_access_organization(organization_id));

create policy "Authorized users can read equipment"
on public.equipment for select
to authenticated
using (public.can_view_carrier(carrier_id));

create policy "Admins can manage equipment"
on public.equipment for all
to authenticated
using (public.is_admin() and public.can_access_organization(organization_id))
with check (public.is_admin() and public.can_access_organization(organization_id));

create policy "Authorized users can read equipment documents"
on public.equipment_documents for select
to authenticated
using (
  exists (
    select 1
    from public.equipment
    where equipment.id = equipment_documents.equipment_id
      and public.can_view_carrier(equipment.carrier_id)
  )
);

create policy "Staff can manage equipment documents"
on public.equipment_documents for all
to authenticated
using (public.can_manage_compliance() and public.can_access_organization(organization_id))
with check (public.can_manage_compliance() and public.can_access_organization(organization_id));

create policy "Authorized users can read compliance notes"
on public.compliance_notes for select
to authenticated
using (
  (public.can_manage_compliance() and public.can_access_organization(organization_id))
  or (carrier_id is not null and public.can_view_carrier(carrier_id))
  or exists (
    select 1
    from public.drivers
    where drivers.id = compliance_notes.driver_id
      and public.can_view_carrier(drivers.carrier_id)
  )
  or exists (
    select 1
    from public.equipment
    where equipment.id = compliance_notes.equipment_id
      and public.can_view_carrier(equipment.carrier_id)
  )
);

create policy "Staff can create compliance notes"
on public.compliance_notes for insert
to authenticated
with check (public.can_manage_compliance() and public.can_access_organization(organization_id));

create policy "Staff can update compliance notes"
on public.compliance_notes for update
to authenticated
using (public.can_manage_compliance() and public.can_access_organization(organization_id))
with check (public.can_manage_compliance() and public.can_access_organization(organization_id));

create policy "Admins can delete compliance notes"
on public.compliance_notes for delete
to authenticated
using (public.is_admin() and public.can_access_organization(organization_id));

create policy "Authorized users can read compliance alerts"
on public.compliance_alerts for select
to authenticated
using (
  (public.can_manage_compliance() and public.can_access_organization(organization_id))
  or (carrier_id is not null and public.can_view_carrier(carrier_id))
  or exists (
    select 1
    from public.drivers
    where drivers.id = compliance_alerts.driver_id
      and public.can_view_carrier(drivers.carrier_id)
  )
  or exists (
    select 1
    from public.equipment
    where equipment.id = compliance_alerts.equipment_id
      and public.can_view_carrier(equipment.carrier_id)
  )
);

create policy "Staff can manage compliance alerts"
on public.compliance_alerts for all
to authenticated
using (public.can_manage_compliance() and public.can_access_organization(organization_id))
with check (public.can_manage_compliance() and public.can_access_organization(organization_id));

create policy "Authorized users can read notifications"
on public.notifications for select
to authenticated
using (
  (public.can_manage_compliance() and public.can_access_organization(organization_id))
  or (carrier_id is not null and public.can_view_carrier(carrier_id))
  or (assigned_to = auth.uid() and public.can_access_organization(organization_id))
);

create policy "Staff can create notifications"
on public.notifications for insert
to authenticated
with check (public.can_manage_compliance() and public.can_access_organization(organization_id));

create policy "Staff can update notifications"
on public.notifications for update
to authenticated
using (
  (public.can_manage_compliance() and public.can_access_organization(organization_id))
  or (assigned_to = auth.uid() and public.can_access_organization(organization_id))
)
with check (
  (public.can_manage_compliance() and public.can_access_organization(organization_id))
  or (assigned_to = auth.uid() and public.can_access_organization(organization_id))
);

create policy "Admins can delete notifications"
on public.notifications for delete
to authenticated
using (public.is_admin() and public.can_access_organization(organization_id));

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

create policy "Staff can insert loads"
on public.loads for insert
to authenticated
with check (public.can_manage_compliance() and public.can_access_organization(organization_id));

create policy "Staff can update loads"
on public.loads for update
to authenticated
using (public.can_manage_compliance() and public.can_access_organization(organization_id))
with check (public.can_manage_compliance() and public.can_access_organization(organization_id));

create policy "Admins can delete loads"
on public.loads for delete
to authenticated
using (public.is_admin() and public.can_access_organization(organization_id));

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

create policy "Authorized users can insert load documents"
on public.load_documents for insert
to authenticated
with check (
  (public.can_manage_compliance() and public.can_access_organization(organization_id))
  or (
    document_type = 'pod'::public.load_document_type
    and
    public.current_user_role() = 'carrier'::public.app_role
    and public.current_user_carrier_id() = carrier_id
    and public.can_access_organization(organization_id)
  )
);

create policy "Platform super admins can read all audit logs"
on public.audit_logs for select
to authenticated
using (public.is_platform_super_admin());

create policy "Organization admins can read organization audit logs"
on public.audit_logs for select
to authenticated
using (
  public.current_user_role() = 'admin'::public.app_role
  and organization_id is not null
  and public.can_access_organization(organization_id)
);

create policy "Staff can read limited organization audit logs"
on public.audit_logs for select
to authenticated
using (
  public.current_user_role() = 'staff'::public.app_role
  and organization_id is not null
  and public.can_access_organization(organization_id)
  and action in (
    'carrier.created',
    'carrier.updated',
    'carrier.status_changed',
    'document.metadata_updated',
    'document.uploaded',
    'document.replaced',
    'document.expiration_changed',
    'compliance_note.added',
    'notification.read',
    'notification.dismissed',
    'notification.assigned',
    'notification.synced',
    'email.weekly_summary_requested',
    'onboarding.carrier_created',
    'onboarding.carrier_user_invited',
    'load.created',
    'load.status_changed',
    'load.rate_confirmation_uploaded',
    'load.pod_uploaded',
    'load.pod_sent'
  )
);

create policy "Authenticated users can append audit logs"
on public.audit_logs for insert
to authenticated
with check (
  actor_user_id = auth.uid()
  and (
    public.is_platform_super_admin()
    or (
      organization_id is not null
      and public.can_access_organization(organization_id)
    )
  )
);

-- Optional first-admin bootstrap after creating your first Auth user:
-- update public.users
-- set role = 'admin'
-- where email = 'admin@manifestgloballogistics.com';
--
-- Link a carrier portal user to a carrier profile:
-- update public.users
-- set role = 'carrier', carrier_id = '<carrier_uuid>'
-- where email = 'carrier@example.com';

-- Supabase Storage bucket and policies for uploaded compliance documents.
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

create policy "Staff can upload carrier document files"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'carrier-documents'
  and (storage.foldername(name))[1] = 'organizations'
  and (storage.foldername(name))[2] ~* '^[0-9a-f-]{36}$'
  and public.can_access_organization(((storage.foldername(name))[2])::uuid)
  and (storage.foldername(name))[3] = 'carriers'
  and (storage.foldername(name))[4] ~* '^[0-9a-f-]{36}$'
  and public.can_view_carrier(((storage.foldername(name))[4])::uuid)
);

create policy "Authorized users can read carrier document files"
on storage.objects for select
to authenticated
using (
  bucket_id = 'carrier-documents'
  and (
    (
      public.can_manage_compliance()
      and (storage.foldername(name))[1] = 'organizations'
      and (storage.foldername(name))[2] ~* '^[0-9a-f-]{36}$'
      and public.can_access_organization(((storage.foldername(name))[2])::uuid)
    )
    or (
      (storage.foldername(name))[1] = 'organizations'
      and (storage.foldername(name))[2] ~* '^[0-9a-f-]{36}$'
      and public.can_access_organization(((storage.foldername(name))[2])::uuid)
      and (storage.foldername(name))[3] = 'carriers'
      and (storage.foldername(name))[4] ~* '^[0-9a-f-]{36}$'
      and public.can_view_carrier(((storage.foldername(name))[4])::uuid)
    )
  )
);

create policy "Staff can replace carrier document files"
on storage.objects for update
to authenticated
using (
  bucket_id = 'carrier-documents'
  and (storage.foldername(name))[1] = 'organizations'
  and (storage.foldername(name))[2] ~* '^[0-9a-f-]{36}$'
  and public.can_access_organization(((storage.foldername(name))[2])::uuid)
  and (storage.foldername(name))[3] = 'carriers'
  and (storage.foldername(name))[4] ~* '^[0-9a-f-]{36}$'
  and public.can_view_carrier(((storage.foldername(name))[4])::uuid)
)
with check (
  bucket_id = 'carrier-documents'
  and (storage.foldername(name))[1] = 'organizations'
  and (storage.foldername(name))[2] ~* '^[0-9a-f-]{36}$'
  and public.can_access_organization(((storage.foldername(name))[2])::uuid)
  and (storage.foldername(name))[3] = 'carriers'
  and (storage.foldername(name))[4] ~* '^[0-9a-f-]{36}$'
  and public.can_view_carrier(((storage.foldername(name))[4])::uuid)
);

create policy "Admins can delete carrier document files"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'carrier-documents'
  and public.is_admin()
  and (storage.foldername(name))[1] = 'organizations'
  and (storage.foldername(name))[2] ~* '^[0-9a-f-]{36}$'
  and public.can_access_organization(((storage.foldername(name))[2])::uuid)
);

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
  and exists (
    select 1
    from public.loads
    where loads.organization_id = ((storage.foldername(name))[2])::uuid
      and loads.id = ((storage.foldername(name))[4])::uuid
      and (
        (
          (storage.foldername(name))[5] = 'rate-confirmation'
          and public.can_manage_compliance()
        )
        or (
          (storage.foldername(name))[5] = 'pod'
          and public.can_manage_compliance()
        )
        or (
          (storage.foldername(name))[5] = 'pod'
          and
          public.current_user_role() = 'carrier'::public.app_role
          and public.current_user_carrier_id() = loads.carrier_id
        )
      )
  )
);

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
