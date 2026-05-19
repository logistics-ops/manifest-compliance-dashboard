-- ManifestOS Load Activity Timeline + Operational Notifications
-- Safe additive migration for load/archive notification categories and staff audit visibility.

alter type public.notification_category add value if not exists 'load_operation';
alter type public.notification_category add value if not exists 'archive_operation';

drop policy if exists "Staff can read limited organization audit logs" on public.audit_logs;
create policy "Staff can read limited organization audit logs"
on public.audit_logs for select
to authenticated
using (
  public.current_user_role() = 'staff'::public.app_role
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
    'load.updated',
    'load.status_changed',
    'load.rate_confirmation_uploaded',
    'load.pod_uploaded',
    'load.pod_sent',
    'load.archive_exported',
    'load.archive_downloaded',
    'load.archive_status_changed',
    'load.archive_files_deleted'
  )
);
