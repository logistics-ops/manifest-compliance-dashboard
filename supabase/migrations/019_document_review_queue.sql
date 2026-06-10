-- Phase 2.5: Document Review Queue metadata.
-- Adds review workflow state to existing document tables without changing upload security or RLS.

alter table public.carrier_documents
add column if not exists review_status text not null default 'pending_review',
add column if not exists review_note text,
add column if not exists internal_review_note text,
add column if not exists reviewed_by uuid references public.users(id) on delete set null,
add column if not exists reviewed_at timestamptz,
add column if not exists replacement_requested_at timestamptz;

alter table public.driver_documents
add column if not exists review_status text not null default 'pending_review',
add column if not exists review_note text,
add column if not exists internal_review_note text,
add column if not exists reviewed_by uuid references public.users(id) on delete set null,
add column if not exists reviewed_at timestamptz,
add column if not exists replacement_requested_at timestamptz;

alter table public.equipment_documents
add column if not exists review_status text not null default 'pending_review',
add column if not exists review_note text,
add column if not exists internal_review_note text,
add column if not exists reviewed_by uuid references public.users(id) on delete set null,
add column if not exists reviewed_at timestamptz,
add column if not exists replacement_requested_at timestamptz;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'carrier_documents_review_status_check'
      and conrelid = 'public.carrier_documents'::regclass
  ) then
    alter table public.carrier_documents
    add constraint carrier_documents_review_status_check
    check (review_status in ('pending_review', 'approved', 'rejected', 'replacement_requested'));
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'driver_documents_review_status_check'
      and conrelid = 'public.driver_documents'::regclass
  ) then
    alter table public.driver_documents
    add constraint driver_documents_review_status_check
    check (review_status in ('pending_review', 'approved', 'rejected', 'replacement_requested'));
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'equipment_documents_review_status_check'
      and conrelid = 'public.equipment_documents'::regclass
  ) then
    alter table public.equipment_documents
    add constraint equipment_documents_review_status_check
    check (review_status in ('pending_review', 'approved', 'rejected', 'replacement_requested'));
  end if;
end $$;

create index if not exists carrier_documents_review_status_idx on public.carrier_documents(review_status);
create index if not exists driver_documents_review_status_idx on public.driver_documents(review_status);
create index if not exists equipment_documents_review_status_idx on public.equipment_documents(review_status);
create index if not exists carrier_documents_uploaded_at_idx on public.carrier_documents(uploaded_at desc);
create index if not exists driver_documents_uploaded_at_idx on public.driver_documents(uploaded_at desc);
create index if not exists equipment_documents_uploaded_at_idx on public.equipment_documents(uploaded_at desc);
