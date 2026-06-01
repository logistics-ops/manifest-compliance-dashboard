-- Phase 2.0: compatibility fields and policies for tenant-scoped compliance reminders.

alter table public.notifications
add column if not exists user_id uuid references public.users(id) on delete set null,
add column if not exists type text,
add column if not exists severity text,
add column if not exists related_entity_type text,
add column if not exists related_entity_id text,
add column if not exists related_url text;

create index if not exists notifications_user_id_idx on public.notifications(user_id);
create index if not exists notifications_type_idx on public.notifications(type);
create index if not exists notifications_severity_idx on public.notifications(severity);
create index if not exists notifications_related_entity_idx on public.notifications(related_entity_type, related_entity_id);

alter table public.notifications
drop constraint if exists notifications_organization_user_id_fkey;

alter table public.notifications
add constraint notifications_organization_user_id_fkey
foreign key (organization_id, user_id)
references public.users(organization_id, id)
on delete set null;

drop policy if exists "Authorized users can read notifications" on public.notifications;
create policy "Authorized users can read notifications"
on public.notifications for select
to authenticated
using (
  public.is_platform_super_admin()
  or (public.can_manage_compliance() and public.can_access_organization(organization_id))
  or (carrier_id is not null and public.can_view_carrier(carrier_id))
  or (assigned_to = auth.uid() and public.can_access_organization(organization_id))
  or (user_id = auth.uid() and public.can_access_organization(organization_id))
);

drop policy if exists "Staff can create notifications" on public.notifications;
create policy "Staff can create notifications"
on public.notifications for insert
to authenticated
with check (
  public.is_platform_super_admin()
  or (public.can_manage_compliance() and public.can_access_organization(organization_id))
);

drop policy if exists "Staff can update notifications" on public.notifications;
create policy "Authorized users can update visible notifications"
on public.notifications for update
to authenticated
using (
  public.is_platform_super_admin()
  or (public.can_manage_compliance() and public.can_access_organization(organization_id))
  or (carrier_id is not null and public.can_view_carrier(carrier_id))
  or (assigned_to = auth.uid() and public.can_access_organization(organization_id))
  or (user_id = auth.uid() and public.can_access_organization(organization_id))
)
with check (
  public.is_platform_super_admin()
  or (public.can_manage_compliance() and public.can_access_organization(organization_id))
  or (carrier_id is not null and public.can_view_carrier(carrier_id))
  or (assigned_to = auth.uid() and public.can_access_organization(organization_id))
  or (user_id = auth.uid() and public.can_access_organization(organization_id))
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
    'compliance_task.completed'
  )
);
