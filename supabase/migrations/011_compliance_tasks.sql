-- Phase 1.9: tenant-scoped compliance task management.

do $$
begin
  create type public.compliance_task_status as enum ('open', 'in_progress', 'waiting', 'completed');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.compliance_task_priority as enum ('critical', 'high', 'medium', 'low');
exception
  when duplicate_object then null;
end $$;

create table if not exists public.compliance_tasks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  title text not null,
  description text,
  priority public.compliance_task_priority not null default 'medium',
  due_date date,
  status public.compliance_task_status not null default 'open',
  assigned_to uuid references public.users(id) on delete set null,
  related_entity_type text not null default 'manual',
  related_entity_id text,
  related_carrier_id uuid references public.carriers(id) on delete set null,
  source_alert_id text,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists compliance_tasks_organization_id_idx on public.compliance_tasks(organization_id);
create index if not exists compliance_tasks_status_idx on public.compliance_tasks(status);
create index if not exists compliance_tasks_priority_idx on public.compliance_tasks(priority);
create index if not exists compliance_tasks_due_date_idx on public.compliance_tasks(due_date);
create index if not exists compliance_tasks_assigned_to_idx on public.compliance_tasks(assigned_to);
create index if not exists compliance_tasks_related_carrier_id_idx on public.compliance_tasks(related_carrier_id);

drop trigger if exists set_compliance_tasks_updated_at on public.compliance_tasks;
create trigger set_compliance_tasks_updated_at before update on public.compliance_tasks
for each row execute function public.set_updated_at();

alter table public.compliance_tasks enable row level security;

drop policy if exists "Authorized users can read compliance tasks" on public.compliance_tasks;
create policy "Authorized users can read compliance tasks"
on public.compliance_tasks for select
to authenticated
using (
  public.is_platform_super_admin()
  or (
    public.can_manage_compliance()
    and public.can_access_organization(organization_id)
  )
  or (
    public.current_user_role() = 'carrier'::public.app_role
    and public.can_access_organization(organization_id)
    and (
      assigned_to = auth.uid()
      or related_carrier_id = public.current_user_carrier_id()
    )
  )
);

drop policy if exists "Staff can create compliance tasks" on public.compliance_tasks;
create policy "Staff can create compliance tasks"
on public.compliance_tasks for insert
to authenticated
with check (
  public.is_platform_super_admin()
  or (
    public.can_manage_compliance()
    and public.can_access_organization(organization_id)
  )
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
    'compliance_task.completed'
  )
);

drop policy if exists "Staff can update compliance tasks" on public.compliance_tasks;
create policy "Staff can update compliance tasks"
on public.compliance_tasks for update
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
