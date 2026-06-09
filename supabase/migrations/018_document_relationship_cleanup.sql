-- Production relationship cleanup for PostgREST schema cache.
-- Keep document ownership enforced through organization_id columns, RLS, and app validation,
-- while exposing one unambiguous simple FK for embedding/query relationships.

do $$
declare
  constraint_record record;
begin
  for constraint_record in
    select c.conname
    from pg_constraint c
    join pg_class child on child.oid = c.conrelid
    join pg_namespace child_ns on child_ns.oid = child.relnamespace
    join pg_class parent on parent.oid = c.confrelid
    join pg_namespace parent_ns on parent_ns.oid = parent.relnamespace
    where c.contype = 'f'
      and child_ns.nspname = 'public'
      and child.relname = 'equipment_documents'
      and parent_ns.nspname = 'public'
      and parent.relname = 'equipment'
  loop
    execute format(
      'alter table public.equipment_documents drop constraint if exists %I',
      constraint_record.conname
    );
  end loop;
end $$;

alter table public.equipment_documents
add constraint equipment_documents_equipment_id_fkey
foreign key (equipment_id)
references public.equipment(id)
on delete cascade
not valid;

do $$
declare
  constraint_record record;
begin
  for constraint_record in
    select c.conname
    from pg_constraint c
    join pg_class child on child.oid = c.conrelid
    join pg_namespace child_ns on child_ns.oid = child.relnamespace
    join pg_class parent on parent.oid = c.confrelid
    join pg_namespace parent_ns on parent_ns.oid = parent.relnamespace
    where c.contype = 'f'
      and child_ns.nspname = 'public'
      and child.relname = 'driver_documents'
      and parent_ns.nspname = 'public'
      and parent.relname = 'drivers'
  loop
    execute format(
      'alter table public.driver_documents drop constraint if exists %I',
      constraint_record.conname
    );
  end loop;
end $$;

alter table public.driver_documents
add constraint driver_documents_driver_id_fkey
foreign key (driver_id)
references public.drivers(id)
on delete cascade
not valid;
