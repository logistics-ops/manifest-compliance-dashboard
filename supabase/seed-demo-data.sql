-- Demo seed data for manual QA.
-- This file uses example.test emails and fixed placeholder UUIDs only.
-- It does not create real Supabase Auth credentials, real keys, or sensitive data.
--
-- Before running:
-- 1. Run supabase/schema.sql.
-- 2. Create matching Supabase Auth users manually, then replace the user UUIDs below
--    with the real auth.users.id values, or create matching placeholder auth users
--    in a disposable local QA database.
-- 3. Do not run this file against production unless a production seed exercise has
--    been explicitly approved.

begin;

-- Placeholder user ids. Replace these with real auth.users.id values in QA.
-- platform-super-admin@example.test
-- 00000000-0000-0000-0000-000000000101
--
-- admin@atlas-demo.example.test
-- 00000000-0000-0000-0000-000000000201
--
-- staff@atlas-demo.example.test
-- 00000000-0000-0000-0000-000000000202
--
-- carrier@atlas-demo.example.test
-- 00000000-0000-0000-0000-000000000203
--
-- admin@harbor-demo.example.test
-- 00000000-0000-0000-0000-000000000301
--
-- staff@harbor-demo.example.test
-- 00000000-0000-0000-0000-000000000302
--
-- carrier@harbor-demo.example.test
-- 00000000-0000-0000-0000-000000000303

insert into public.organizations (
  id,
  name,
  slug,
  subdomain,
  logo_url,
  primary_color,
  secondary_color,
  accent_color,
  is_active
)
values
  (
    '10000000-0000-0000-0000-000000000001',
    'Atlas Demo Logistics',
    'atlas-demo-logistics',
    'atlas',
    null,
    '#e31937',
    '#8d1022',
    '#ff4d5d',
    true
  ),
  (
    '10000000-0000-0000-0000-000000000002',
    'Harbor Demo Freight',
    'harbor-demo-freight',
    'harbor',
    null,
    '#1ec27f',
    '#0f766e',
    '#f4b740',
    true
  )
on conflict (id) do update
set
  name = excluded.name,
  slug = excluded.slug,
  subdomain = excluded.subdomain,
  logo_url = excluded.logo_url,
  primary_color = excluded.primary_color,
  secondary_color = excluded.secondary_color,
  accent_color = excluded.accent_color,
  is_active = excluded.is_active;

-- User profile placeholders. These ids must exist in auth.users before insert.
insert into public.users (
  id,
  organization_id,
  email,
  full_name,
  role,
  platform_super_admin,
  carrier_id,
  is_active
)
values
  (
    '00000000-0000-0000-0000-000000000101',
    null,
    'platform-super-admin@example.test',
    'Demo Platform Super Admin',
    'admin',
    true,
    null,
    true
  ),
  (
    '00000000-0000-0000-0000-000000000201',
    '10000000-0000-0000-0000-000000000001',
    'admin@atlas-demo.example.test',
    'Atlas Demo Admin',
    'admin',
    false,
    null,
    true
  ),
  (
    '00000000-0000-0000-0000-000000000202',
    '10000000-0000-0000-0000-000000000001',
    'staff@atlas-demo.example.test',
    'Atlas Demo Staff',
    'staff',
    false,
    null,
    true
  ),
  (
    '00000000-0000-0000-0000-000000000301',
    '10000000-0000-0000-0000-000000000002',
    'admin@harbor-demo.example.test',
    'Harbor Demo Admin',
    'admin',
    false,
    null,
    true
  ),
  (
    '00000000-0000-0000-0000-000000000302',
    '10000000-0000-0000-0000-000000000002',
    'staff@harbor-demo.example.test',
    'Harbor Demo Staff',
    'staff',
    false,
    null,
    true
  )
on conflict (id) do update
set
  organization_id = excluded.organization_id,
  email = excluded.email,
  full_name = excluded.full_name,
  role = excluded.role,
  platform_super_admin = excluded.platform_super_admin,
  is_active = excluded.is_active;

insert into public.carriers (
  id,
  organization_id,
  company_name,
  mc_number,
  dot_number,
  contact_name,
  phone,
  email,
  status,
  notes,
  created_by
)
values
  (
    '20000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000001',
    'Atlas Redline Transport',
    'MC-ATLAS-001',
    'DOT-ATLAS-001',
    'Avery Lane',
    '(555) 010-0101',
    'dispatch@atlas-redline.example.test',
    'active',
    'Demo Atlas carrier with mostly complete compliance records.',
    '00000000-0000-0000-0000-000000000201'
  ),
  (
    '20000000-0000-0000-0000-000000000002',
    '10000000-0000-0000-0000-000000000001',
    'Atlas Summit Carriers',
    'MC-ATLAS-002',
    'DOT-ATLAS-002',
    'Jordan Miles',
    '(555) 010-0102',
    'compliance@atlas-summit.example.test',
    'pending',
    'Demo Atlas carrier with missing onboarding documents.',
    '00000000-0000-0000-0000-000000000201'
  ),
  (
    '20000000-0000-0000-0000-000000000101',
    '10000000-0000-0000-0000-000000000002',
    'Harbor Northline Freight',
    'MC-HARBOR-001',
    'DOT-HARBOR-001',
    'Morgan Reed',
    '(555) 020-0101',
    'ops@harbor-northline.example.test',
    'active',
    'Demo Harbor carrier with renewal activity.',
    '00000000-0000-0000-0000-000000000301'
  ),
  (
    '20000000-0000-0000-0000-000000000102',
    '10000000-0000-0000-0000-000000000002',
    'Harbor Keystone Express',
    'MC-HARBOR-002',
    'DOT-HARBOR-002',
    'Taylor Quinn',
    '(555) 020-0102',
    'safety@harbor-keystone.example.test',
    'suspended',
    'Demo Harbor carrier with expired insurance.',
    '00000000-0000-0000-0000-000000000301'
  )
on conflict (organization_id, mc_number) do update
set
  company_name = excluded.company_name,
  dot_number = excluded.dot_number,
  contact_name = excluded.contact_name,
  phone = excluded.phone,
  email = excluded.email,
  status = excluded.status,
  notes = excluded.notes,
  created_by = excluded.created_by;

insert into public.users (
  id,
  organization_id,
  email,
  full_name,
  role,
  platform_super_admin,
  carrier_id,
  is_active
)
values
  (
    '00000000-0000-0000-0000-000000000203',
    '10000000-0000-0000-0000-000000000001',
    'carrier@atlas-demo.example.test',
    'Atlas Demo Carrier User',
    'carrier',
    false,
    '20000000-0000-0000-0000-000000000001',
    true
  ),
  (
    '00000000-0000-0000-0000-000000000303',
    '10000000-0000-0000-0000-000000000002',
    'carrier@harbor-demo.example.test',
    'Harbor Demo Carrier User',
    'carrier',
    false,
    '20000000-0000-0000-0000-000000000101',
    true
  )
on conflict (id) do update
set
  organization_id = excluded.organization_id,
  email = excluded.email,
  full_name = excluded.full_name,
  role = excluded.role,
  platform_super_admin = excluded.platform_super_admin,
  carrier_id = excluded.carrier_id,
  is_active = excluded.is_active;

insert into public.carrier_documents (
  id,
  organization_id,
  carrier_id,
  document_name,
  storage_path,
  file_name,
  file_size,
  mime_type,
  uploaded,
  expiration_date,
  status,
  notes,
  uploaded_by,
  uploaded_at,
  version_number
)
values
  (
    '30000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000001',
    '20000000-0000-0000-0000-000000000001',
    'Certificate of Insurance',
    'organizations/10000000-0000-0000-0000-000000000001/carriers/20000000-0000-0000-0000-000000000001/certificate-of-insurance/v1/demo-coi.pdf',
    'demo-coi.pdf',
    245760,
    'application/pdf',
    true,
    current_date + 45,
    'valid',
    'Demo uploaded COI.',
    '00000000-0000-0000-0000-000000000202',
    now(),
    1
  ),
  (
    '30000000-0000-0000-0000-000000000002',
    '10000000-0000-0000-0000-000000000001',
    '20000000-0000-0000-0000-000000000001',
    'W-9',
    'organizations/10000000-0000-0000-0000-000000000001/carriers/20000000-0000-0000-0000-000000000001/w-9/v1/demo-w9.pdf',
    'demo-w9.pdf',
    120240,
    'application/pdf',
    true,
    null,
    'valid',
    'Demo W-9.',
    '00000000-0000-0000-0000-000000000202',
    now(),
    1
  ),
  (
    '30000000-0000-0000-0000-000000000003',
    '10000000-0000-0000-0000-000000000001',
    '20000000-0000-0000-0000-000000000002',
    'Lease Agreement',
    null,
    null,
    null,
    null,
    false,
    null,
    'missing',
    'Missing for onboarding QA.',
    null,
    null,
    0
  ),
  (
    '30000000-0000-0000-0000-000000000101',
    '10000000-0000-0000-0000-000000000002',
    '20000000-0000-0000-0000-000000000101',
    'Certificate of Insurance',
    'organizations/10000000-0000-0000-0000-000000000002/carriers/20000000-0000-0000-0000-000000000101/certificate-of-insurance/v1/demo-coi.pdf',
    'demo-coi.pdf',
    230400,
    'application/pdf',
    true,
    current_date + 12,
    'expiring_soon',
    'Demo Harbor COI inside renewal window.',
    '00000000-0000-0000-0000-000000000302',
    now(),
    1
  ),
  (
    '30000000-0000-0000-0000-000000000102',
    '10000000-0000-0000-0000-000000000002',
    '20000000-0000-0000-0000-000000000102',
    'Certificate of Insurance',
    'organizations/10000000-0000-0000-0000-000000000002/carriers/20000000-0000-0000-0000-000000000102/certificate-of-insurance/v1/expired-demo-coi.pdf',
    'expired-demo-coi.pdf',
    240128,
    'application/pdf',
    true,
    current_date - 10,
    'expired',
    'Expired insurance for suspension QA.',
    '00000000-0000-0000-0000-000000000302',
    now(),
    1
  )
on conflict (organization_id, carrier_id, document_name) do update
set
  storage_path = excluded.storage_path,
  file_name = excluded.file_name,
  file_size = excluded.file_size,
  mime_type = excluded.mime_type,
  uploaded = excluded.uploaded,
  expiration_date = excluded.expiration_date,
  status = excluded.status,
  notes = excluded.notes,
  uploaded_by = excluded.uploaded_by,
  uploaded_at = excluded.uploaded_at,
  version_number = excluded.version_number;

insert into public.carrier_document_versions (
  id,
  organization_id,
  carrier_document_id,
  carrier_id,
  document_name,
  storage_path,
  file_name,
  file_size,
  mime_type,
  version_number,
  uploaded_by,
  uploaded_at
)
select
  gen_random_uuid(),
  organization_id,
  id,
  carrier_id,
  document_name,
  storage_path,
  file_name,
  coalesce(file_size, 0),
  mime_type,
  version_number,
  uploaded_by,
  coalesce(uploaded_at, now())
from public.carrier_documents
where uploaded = true
  and storage_path is not null
on conflict (organization_id, carrier_id, document_name, version_number) do nothing;

insert into public.notifications (
  id,
  organization_id,
  carrier_id,
  document_name,
  title,
  message,
  category,
  priority,
  status,
  assigned_to,
  due_date,
  rule_key,
  metadata
)
values
  (
    '40000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000001',
    '20000000-0000-0000-0000-000000000002',
    'Lease Agreement',
    'Atlas carrier missing lease agreement',
    'Atlas Summit Carriers is missing a required lease agreement.',
    'missing_document',
    'high',
    'unread',
    '00000000-0000-0000-0000-000000000202',
    current_date + 7,
    'demo-atlas-missing-lease',
    '{"seed":"demo"}'::jsonb
  ),
  (
    '40000000-0000-0000-0000-000000000002',
    '10000000-0000-0000-0000-000000000001',
    '20000000-0000-0000-0000-000000000001',
    'Certificate of Insurance',
    'Atlas COI renewal upcoming',
    'Atlas Redline Transport has a COI renewal approaching.',
    'document_expiration',
    'medium',
    'unread',
    null,
    current_date + 45,
    'demo-atlas-coi-renewal',
    '{"seed":"demo"}'::jsonb
  ),
  (
    '40000000-0000-0000-0000-000000000101',
    '10000000-0000-0000-0000-000000000002',
    '20000000-0000-0000-0000-000000000101',
    'Certificate of Insurance',
    'Harbor COI expires soon',
    'Harbor Northline Freight has a COI expiring inside the renewal window.',
    'document_expiration',
    'high',
    'unread',
    '00000000-0000-0000-0000-000000000302',
    current_date + 12,
    'demo-harbor-coi-expiring',
    '{"seed":"demo"}'::jsonb
  ),
  (
    '40000000-0000-0000-0000-000000000102',
    '10000000-0000-0000-0000-000000000002',
    '20000000-0000-0000-0000-000000000102',
    'Certificate of Insurance',
    'Harbor insurance expired',
    'Harbor Keystone Express has expired insurance and should remain suspended.',
    'expired_insurance',
    'critical',
    'unread',
    null,
    current_date - 10,
    'demo-harbor-expired-insurance',
    '{"seed":"demo"}'::jsonb
  )
on conflict (organization_id, rule_key) do update
set
  carrier_id = excluded.carrier_id,
  document_name = excluded.document_name,
  title = excluded.title,
  message = excluded.message,
  category = excluded.category,
  priority = excluded.priority,
  status = excluded.status,
  assigned_to = excluded.assigned_to,
  due_date = excluded.due_date,
  metadata = excluded.metadata;

commit;
