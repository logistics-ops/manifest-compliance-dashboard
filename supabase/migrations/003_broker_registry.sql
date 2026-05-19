-- Broker Registry / Broker Check module.
-- Safe to run on an existing ManifestOS Supabase database.

do $$
begin
  if exists (select 1 from pg_type where typname = 'notification_category') then
    alter type public.notification_category add value if not exists 'broker_operation';
    alter type public.notification_category add value if not exists 'user_operation';
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'broker_approved_status') then
    create type public.broker_approved_status as enum ('approved', 'review_required', 'blocked');
  end if;
  if not exists (select 1 from pg_type where typname = 'broker_risk_level') then
    create type public.broker_risk_level as enum ('low', 'medium', 'high');
  end if;
  if not exists (select 1 from pg_type where typname = 'broker_check_request_status') then
    create type public.broker_check_request_status as enum ('open', 'reviewing', 'resolved');
  end if;
end $$;

create table if not exists public.brokers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  broker_name text not null,
  mc_number text,
  dot_number text,
  contact_name text,
  contact_email text,
  contact_phone text,
  authority_status text,
  safety_rating text,
  approved_status public.broker_approved_status not null default 'review_required',
  risk_level public.broker_risk_level not null default 'medium',
  notes text,
  notes_private boolean not null default false,
  blocked_reason text,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, mc_number)
);

create table if not exists public.broker_check_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  requested_by uuid references public.users(id) on delete set null,
  carrier_id uuid references public.carriers(id) on delete set null,
  broker_name text,
  mc_number text,
  notes text,
  status public.broker_check_request_status not null default 'open',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.loads add column if not exists broker_id uuid references public.brokers(id) on delete set null;
alter table public.loads add column if not exists broker_mc_number text;

create index if not exists brokers_organization_id_idx on public.brokers(organization_id);
create index if not exists brokers_mc_number_idx on public.brokers(organization_id, mc_number);
create index if not exists brokers_name_idx on public.brokers using gin (to_tsvector('simple', broker_name));
create index if not exists broker_check_requests_organization_id_idx on public.broker_check_requests(organization_id);
create index if not exists broker_check_requests_carrier_id_idx on public.broker_check_requests(carrier_id);
create index if not exists loads_broker_id_idx on public.loads(broker_id);

alter table public.brokers enable row level security;
alter table public.broker_check_requests enable row level security;

drop policy if exists "Authorized users can read brokers" on public.brokers;
create policy "Authorized users can read brokers"
on public.brokers for select
to authenticated
using (
  public.is_platform_super_admin()
  or (public.can_access_organization(organization_id) and public.can_manage_compliance())
  or (
    public.current_user_role() = 'carrier'::public.app_role
    and public.can_access_organization(organization_id)
  )
);

drop policy if exists "Staff can manage brokers" on public.brokers;
create policy "Staff can manage brokers"
on public.brokers for all
to authenticated
using (public.is_platform_super_admin() or (public.can_manage_compliance() and public.can_access_organization(organization_id)))
with check (public.is_platform_super_admin() or (public.can_manage_compliance() and public.can_access_organization(organization_id)));

drop policy if exists "Authorized users can read broker check requests" on public.broker_check_requests;
create policy "Authorized users can read broker check requests"
on public.broker_check_requests for select
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

drop policy if exists "Authorized users can create broker check requests" on public.broker_check_requests;
create policy "Authorized users can create broker check requests"
on public.broker_check_requests for insert
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

drop policy if exists "Staff can update broker check requests" on public.broker_check_requests;
create policy "Staff can update broker check requests"
on public.broker_check_requests for update
to authenticated
using (public.is_platform_super_admin() or (public.can_manage_compliance() and public.can_access_organization(organization_id)))
with check (public.is_platform_super_admin() or (public.can_manage_compliance() and public.can_access_organization(organization_id)));
