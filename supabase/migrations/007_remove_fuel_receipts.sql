-- Remove ManifestOS Fuel Receipts.
-- This cleanup is intentionally conservative: it removes app-facing RLS/storage
-- policies and drops the table/type only when no receipt rows remain.

do $$
begin
  if to_regclass('public.fuel_receipts') is not null then
    if exists (select 1 from public.fuel_receipts limit 1) then
      raise exception 'fuel_receipts contains data. Export or intentionally archive/delete those rows before running 007_remove_fuel_receipts.sql.';
    end if;
  end if;
end $$;

drop policy if exists "Authorized users can upload fuel receipt files" on storage.objects;
drop policy if exists "Authorized users can read fuel receipt files" on storage.objects;

drop policy if exists "Authorized users can read fuel receipts" on public.fuel_receipts;
drop policy if exists "Authorized users can insert fuel receipts" on public.fuel_receipts;
drop policy if exists "Authorized users can update fuel receipts" on public.fuel_receipts;
drop policy if exists "Admins can delete fuel receipts" on public.fuel_receipts;

drop trigger if exists set_fuel_receipts_updated_at on public.fuel_receipts;
drop table if exists public.fuel_receipts;
drop type if exists public.fuel_extraction_status;

-- PostgreSQL does not support dropping a single enum value from notification_category.
-- Keep any previously applied fuel_operation enum label dormant; application code no
-- longer emits or displays it.
