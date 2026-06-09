-- Phase 2.3C: safety coaching and corrective action tracking.

do $$
begin
  if not exists (select 1 from pg_type where typnamespace = 'public'::regnamespace and typname = 'compliance_task_status') then
    create type public.compliance_task_status as enum ('open', 'in_progress', 'waiting', 'completed');
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_type where typnamespace = 'public'::regnamespace and typname = 'compliance_task_priority') then
    create type public.compliance_task_priority as enum ('critical', 'high', 'medium', 'low');
  end if;
end $$;

create table if not exists public.safety_coaching (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  carrier_id uuid not null references public.carriers(id) on delete cascade,
  safety_score_id uuid references public.safety_scores(id) on delete set null,
  inspection_report_id uuid references public.inspection_reports(id) on delete set null,
  compliance_task_id uuid,
  issue text not null,
  recommendation text not null,
  priority public.compliance_task_priority not null default 'medium',
  target_completion_date date,
  status public.compliance_task_status not null default 'open',
  notes text,
  created_by uuid references public.users(id) on delete set null,
  updated_by uuid references public.users(id) on delete set null,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id)
);

alter table public.safety_coaching
drop constraint if exists safety_coaching_organization_carrier_fkey;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'safety_coaching_carrier_id_fkey'
      and conrelid = 'public.safety_coaching'::regclass
  ) then
    alter table public.safety_coaching
    add constraint safety_coaching_carrier_id_fkey
    foreign key (carrier_id)
    references public.carriers(id)
    on delete cascade;
  end if;
end $$;

alter table public.safety_coaching
drop constraint if exists safety_coaching_organization_safety_score_fkey;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'safety_coaching_safety_score_id_fkey'
      and conrelid = 'public.safety_coaching'::regclass
  ) then
    alter table public.safety_coaching
    add constraint safety_coaching_safety_score_id_fkey
    foreign key (safety_score_id)
    references public.safety_scores(id)
    on delete set null;
  end if;
end $$;

alter table public.safety_coaching
drop constraint if exists safety_coaching_organization_inspection_fkey;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'safety_coaching_inspection_report_id_fkey'
      and conrelid = 'public.safety_coaching'::regclass
  ) then
    alter table public.safety_coaching
    add constraint safety_coaching_inspection_report_id_fkey
    foreign key (inspection_report_id)
    references public.inspection_reports(id)
    on delete set null;
  end if;
end $$;

do $$
begin
  if to_regclass('public.compliance_tasks') is not null
    and not exists (
      select 1 from pg_constraint
      where conname = 'safety_coaching_compliance_task_id_fkey'
        and conrelid = 'public.safety_coaching'::regclass
    )
  then
    alter table public.safety_coaching
    add constraint safety_coaching_compliance_task_id_fkey
    foreign key (compliance_task_id)
    references public.compliance_tasks(id)
    on delete set null;
  end if;
end $$;

create index if not exists safety_coaching_organization_id_idx on public.safety_coaching(organization_id);
create index if not exists safety_coaching_carrier_id_idx on public.safety_coaching(carrier_id);
create index if not exists safety_coaching_status_idx on public.safety_coaching(status);
create index if not exists safety_coaching_priority_idx on public.safety_coaching(priority);
create index if not exists safety_coaching_target_completion_date_idx on public.safety_coaching(target_completion_date);
create index if not exists safety_coaching_safety_score_id_idx on public.safety_coaching(safety_score_id);
create index if not exists safety_coaching_inspection_report_id_idx on public.safety_coaching(inspection_report_id);
create index if not exists safety_coaching_compliance_task_id_idx on public.safety_coaching(compliance_task_id);

drop trigger if exists set_safety_coaching_updated_at on public.safety_coaching;
create trigger set_safety_coaching_updated_at before update on public.safety_coaching
for each row execute function public.set_updated_at();

alter table public.safety_coaching enable row level security;

drop policy if exists "Authorized users can read safety coaching" on public.safety_coaching;
create policy "Authorized users can read safety coaching"
on public.safety_coaching for select
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
);

drop policy if exists "Staff can create safety coaching" on public.safety_coaching;
create policy "Staff can create safety coaching"
on public.safety_coaching for insert
to authenticated
with check (
  public.is_platform_super_admin()
  or (
    public.can_manage_compliance()
    and public.can_access_organization(organization_id)
  )
);

drop policy if exists "Staff can update safety coaching" on public.safety_coaching;
create policy "Staff can update safety coaching"
on public.safety_coaching for update
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

drop policy if exists "Staff can read safety coaching audit logs" on public.audit_logs;
create policy "Staff can read safety coaching audit logs"
on public.audit_logs for select
to authenticated
using (
  public.current_user_role() = 'staff'::public.app_role
  and organization_id is not null
  and public.can_access_organization(organization_id)
  and action in ('safety_coaching.created', 'safety_coaching.updated', 'safety_coaching.completed')
);
