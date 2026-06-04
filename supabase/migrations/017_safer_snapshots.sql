-- Phase 2.3D: manual SAFER lookup snapshots.

create table if not exists public.safer_snapshots (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  carrier_id uuid references public.carriers(id) on delete set null,
  legal_name text,
  dba_name text,
  dot_number text not null,
  mc_number text,
  operating_status text,
  power_units integer check (power_units is null or power_units >= 0),
  drivers integer check (drivers is null or drivers >= 0),
  safety_rating text,
  inspection_summary text,
  out_of_service_summary text,
  crash_summary text,
  snapshot_date timestamptz not null default now(),
  source_label text not null default 'Manual SAFER review',
  notes text,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id)
);

alter table public.safer_snapshots drop constraint if exists safer_snapshots_organization_carrier_fkey;
alter table public.safer_snapshots
add constraint safer_snapshots_organization_carrier_fkey
foreign key (organization_id, carrier_id)
references public.carriers(organization_id, id)
on delete set null;

create index if not exists safer_snapshots_organization_id_idx on public.safer_snapshots(organization_id);
create index if not exists safer_snapshots_carrier_id_idx on public.safer_snapshots(carrier_id);
create index if not exists safer_snapshots_dot_number_idx on public.safer_snapshots(dot_number);
create index if not exists safer_snapshots_mc_number_idx on public.safer_snapshots(mc_number);
create index if not exists safer_snapshots_snapshot_date_idx on public.safer_snapshots(snapshot_date desc);

drop trigger if exists set_safer_snapshots_updated_at on public.safer_snapshots;
create trigger set_safer_snapshots_updated_at before update on public.safer_snapshots
for each row execute function public.set_updated_at();

alter table public.safer_snapshots enable row level security;

drop policy if exists "Authorized users can read SAFER snapshots" on public.safer_snapshots;
create policy "Authorized users can read SAFER snapshots"
on public.safer_snapshots for select
to authenticated
using (
  public.is_platform_super_admin()
  or (public.can_manage_compliance() and public.can_access_organization(organization_id))
  or (
    public.current_user_role() = 'carrier'::public.app_role
    and carrier_id is not null
    and public.current_user_carrier_id() = carrier_id
    and public.can_access_organization(organization_id)
  )
);

drop policy if exists "Staff can create SAFER snapshots" on public.safer_snapshots;
create policy "Staff can create SAFER snapshots"
on public.safer_snapshots for insert
to authenticated
with check (
  public.is_platform_super_admin()
  or (public.can_manage_compliance() and public.can_access_organization(organization_id))
);

drop policy if exists "Staff can update SAFER snapshots" on public.safer_snapshots;
create policy "Staff can update SAFER snapshots"
on public.safer_snapshots for update
to authenticated
using (
  public.is_platform_super_admin()
  or (public.can_manage_compliance() and public.can_access_organization(organization_id))
)
with check (
  public.is_platform_super_admin()
  or (public.can_manage_compliance() and public.can_access_organization(organization_id))
);

drop policy if exists "Staff can read SAFER audit logs" on public.audit_logs;
create policy "Staff can read SAFER audit logs"
on public.audit_logs for select
to authenticated
using (
  public.current_user_role() = 'staff'::public.app_role
  and organization_id is not null
  and public.can_access_organization(organization_id)
  and action in ('safer_lookup.performed', 'safer_snapshot.saved')
);
