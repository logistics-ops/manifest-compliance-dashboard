-- Phase 2.1: secure no-login carrier document upload links.

create table if not exists public.upload_links (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  carrier_id uuid not null references public.carriers(id) on delete cascade,
  driver_id uuid references public.drivers(id) on delete cascade,
  equipment_id uuid references public.equipment(id) on delete cascade,
  token_hash text not null unique,
  allowed_document_categories text[] not null default array['carrier']::text[],
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_by uuid references public.users(id) on delete set null,
  last_used_at timestamptz,
  use_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (array_length(allowed_document_categories, 1) > 0),
  check (allowed_document_categories <@ array['carrier', 'driver', 'vehicle']::text[])
);

create index if not exists upload_links_organization_id_idx on public.upload_links(organization_id);
create index if not exists upload_links_carrier_id_idx on public.upload_links(carrier_id);
create index if not exists upload_links_driver_id_idx on public.upload_links(driver_id);
create index if not exists upload_links_equipment_id_idx on public.upload_links(equipment_id);
create index if not exists upload_links_expires_at_idx on public.upload_links(expires_at);
create index if not exists upload_links_revoked_at_idx on public.upload_links(revoked_at);

alter table public.upload_links
drop constraint if exists upload_links_organization_carrier_fkey,
add constraint upload_links_organization_carrier_fkey
foreign key (organization_id, carrier_id)
references public.carriers(organization_id, id)
on delete cascade;

alter table public.upload_links
drop constraint if exists upload_links_organization_driver_fkey,
drop constraint if exists upload_links_driver_id_fkey;

alter table public.upload_links
drop constraint if exists upload_links_organization_equipment_fkey,
drop constraint if exists upload_links_equipment_id_fkey;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'upload_links_driver_id_fkey'
      and conrelid = 'public.upload_links'::regclass
  ) then
    alter table public.upload_links
    add constraint upload_links_driver_id_fkey
    foreign key (driver_id)
    references public.drivers(id)
    on delete cascade;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'upload_links_equipment_id_fkey'
      and conrelid = 'public.upload_links'::regclass
  ) then
    alter table public.upload_links
    add constraint upload_links_equipment_id_fkey
    foreign key (equipment_id)
    references public.equipment(id)
    on delete cascade;
  end if;
end $$;

drop trigger if exists set_upload_links_updated_at on public.upload_links;
create trigger set_upload_links_updated_at before update on public.upload_links
for each row execute function public.set_updated_at();

alter table public.upload_links enable row level security;

drop policy if exists "Staff can read upload links" on public.upload_links;
create policy "Staff can read upload links"
on public.upload_links for select
to authenticated
using (
  public.is_platform_super_admin()
  or (public.can_manage_compliance() and public.can_access_organization(organization_id))
);

drop policy if exists "Staff can create upload links" on public.upload_links;
create policy "Staff can create upload links"
on public.upload_links for insert
to authenticated
with check (
  public.is_platform_super_admin()
  or (public.can_manage_compliance() and public.can_access_organization(organization_id))
);

drop policy if exists "Staff can revoke upload links" on public.upload_links;
create policy "Staff can revoke upload links"
on public.upload_links for update
to authenticated
using (
  public.is_platform_super_admin()
  or (public.can_manage_compliance() and public.can_access_organization(organization_id))
)
with check (
  public.is_platform_super_admin()
  or (public.can_manage_compliance() and public.can_access_organization(organization_id))
);

drop policy if exists "Staff can read limited organization audit logs" on public.audit_logs;
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
    'driver_document.uploaded',
    'driver_document.replaced',
    'driver_document.expiration_changed',
    'vehicle_document.uploaded',
    'vehicle_document.replaced',
    'vehicle_document.expiration_changed',
    'compliance_note.added',
    'notification.read',
    'notification.read_all',
    'notification.dismissed',
    'notification.assigned',
    'notification.synced',
    'email.weekly_summary_requested',
    'onboarding.carrier_created',
    'onboarding.carrier_user_invited',
    'load.created',
    'load.updated',
    'load.status_changed',
    'load.rate_confirmation_uploaded',
    'load.pod_uploaded',
    'load.pod_sent',
    'load.archive_exported',
    'load.archive_downloaded',
    'load.archive_status_changed',
    'load.archive_files_deleted',
    'invoice.generated',
    'invoice.sent',
    'invoice.resent',
    'invoice.paid',
    'invoice.voided',
    'invoice.downloaded',
    'broker.created',
    'broker.updated',
    'broker.approved',
    'broker.blocked',
    'broker.review_required',
    'broker_check.requested',
    'broker.selected_on_load',
    'compliance_task.created',
    'compliance_task.updated',
    'compliance_task.completed',
    'upload_link.created',
    'upload_link.revoked',
    'upload_link.used',
    'public_document.uploaded'
  )
);
