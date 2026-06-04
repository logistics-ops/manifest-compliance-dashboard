-- Phase 2.3A: manual, tenant-scoped carrier safety score tracking.

create table if not exists public.safety_scores (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  carrier_id uuid not null references public.carriers(id) on delete cascade,
  dot_number text,
  mc_number text,
  score_label text not null,
  safety_status text not null default 'missing_data' check (safety_status in ('good', 'needs_review', 'high_risk', 'missing_data')),
  inspection_count integer not null default 0 check (inspection_count >= 0),
  violation_count integer not null default 0 check (violation_count >= 0),
  out_of_service_count integer not null default 0 check (out_of_service_count >= 0),
  notes text,
  recorded_at timestamptz not null default now(),
  created_by uuid references public.users(id) on delete set null,
  updated_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id)
);

alter table public.safety_scores
drop constraint if exists safety_scores_organization_carrier_fkey;

alter table public.safety_scores
add constraint safety_scores_organization_carrier_fkey
foreign key (organization_id, carrier_id)
references public.carriers(organization_id, id)
on delete cascade;

create index if not exists safety_scores_organization_id_idx on public.safety_scores(organization_id);
create index if not exists safety_scores_carrier_id_idx on public.safety_scores(carrier_id);
create index if not exists safety_scores_recorded_at_idx on public.safety_scores(recorded_at desc);
create index if not exists safety_scores_safety_status_idx on public.safety_scores(safety_status);

drop trigger if exists set_safety_scores_updated_at on public.safety_scores;
create trigger set_safety_scores_updated_at before update on public.safety_scores
for each row execute function public.set_updated_at();

alter table public.safety_scores enable row level security;

drop policy if exists "Authorized users can read safety scores" on public.safety_scores;
create policy "Authorized users can read safety scores"
on public.safety_scores for select
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

drop policy if exists "Staff can create safety scores" on public.safety_scores;
create policy "Staff can create safety scores"
on public.safety_scores for insert
to authenticated
with check (
  public.is_platform_super_admin()
  or (
    public.can_manage_compliance()
    and public.can_access_organization(organization_id)
  )
);

drop policy if exists "Staff can update safety scores" on public.safety_scores;
create policy "Staff can update safety scores"
on public.safety_scores for update
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

drop policy if exists "Staff can read safety score audit logs" on public.audit_logs;
create policy "Staff can read safety score audit logs"
on public.audit_logs for select
to authenticated
using (
  public.current_user_role() = 'staff'::public.app_role
  and organization_id is not null
  and public.can_access_organization(organization_id)
  and action in ('safety_score.created', 'safety_score.updated')
);
