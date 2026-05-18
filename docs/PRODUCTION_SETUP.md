# Production Setup

This checklist prepares the white-label multi-tenant carrier compliance platform for production. It assumes Supabase Auth, Supabase Postgres, Supabase Storage, and Vercel hosting.

## Required Environment Variables

### Supabase

Set these in local `.env.local` and in Vercel:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET=carrier-documents
NEXT_PUBLIC_ROOT_DOMAIN=your-production-domain.com
SUPABASE_SERVICE_ROLE_KEY=your-server-only-service-role-key
EMAIL_ALERT_WEBHOOK_URL=https://optional-email-provider-or-workflow-endpoint
```

Notes:

- `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are required for Auth, database reads/writes, and uploads.
- `NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET` should match the private bucket created by `supabase/schema.sql`.
- `NEXT_PUBLIC_ROOT_DOMAIN` is used for tenant subdomain lookup. Example: with `example.com`, `acme.example.com` resolves to `public.organizations.subdomain = 'acme'`.
- `SUPABASE_SERVICE_ROLE_KEY` is server-only and required for platform super admin invite flows. Never expose it to the browser.
- `EMAIL_ALERT_WEBHOOK_URL` is optional unless email dispatch is part of launch.

### Vercel

Configure the same variables in Vercel Project Settings -> Environment Variables for Production, Preview, and Development as appropriate.

Also configure:

- Production domain: `your-production-domain.com`
- Tenant wildcard domain: `*.your-production-domain.com`
- HTTPS enabled for root and wildcard domains
- Supabase Auth redirect URLs for root and tenant subdomains

Recommended Supabase Auth URLs:

```txt
https://your-production-domain.com/**
https://*.your-production-domain.com/**
```

## Database Setup

1. Create the Supabase project.
2. Enable Supabase Auth email/password sign-in.
3. Run the full contents of `supabase/schema.sql` in the Supabase SQL editor.
4. Confirm RLS is enabled for:

- `public.organizations`
- `public.users`
- `public.carriers`
- `public.carrier_documents`
- `public.carrier_document_versions`
- `public.drivers`
- `public.driver_documents`
- `public.equipment`
- `public.equipment_documents`
- `public.compliance_notes`
- `public.compliance_alerts`
- `public.notifications`

5. Confirm the storage bucket and policies exist for `carrier-documents`.

## Platform Super Admin Setup

A platform super admin can access and manage all organizations. Keep this role limited to trusted internal operators.

1. Create the first Supabase Auth user from the Supabase dashboard.
2. Promote that user in SQL:

```sql
update public.users
set
  role = 'admin',
  platform_super_admin = true,
  is_active = true
where email = 'platform-admin@example.com';
```

3. Verify the user record:

```sql
select id, email, role, organization_id, platform_super_admin, is_active
from public.users
where email = 'platform-admin@example.com';
```

Expected result:

- `role = admin`
- `platform_super_admin = true`
- `is_active = true`
- `organization_id` may be `null` for a platform-only operator

## First Organization Setup

Create each tenant in `public.organizations`.

```sql
insert into public.organizations (
  name,
  slug,
  subdomain,
  logo_url,
  primary_color,
  secondary_color,
  accent_color
)
values (
  'Acme Logistics',
  'acme-logistics',
  'acme',
  null,
  '#e31937',
  '#8d1022',
  '#ff4d5d'
)
returning id, name, slug, subdomain;
```

Operator checks:

- `slug` is unique and stable.
- `subdomain` matches the DNS subdomain.
- colors are valid 6-digit hex values.
- `logo_url`, if set, points to an HTTPS image URL.
- `is_active = true`.

## First Organization Admin Setup

1. Create the admin in Supabase Auth.
2. Find the organization id:

```sql
select id, name, subdomain
from public.organizations
where subdomain = 'acme';
```

3. Assign the user to the organization:

```sql
update public.users
set
  organization_id = '<organization_uuid>',
  role = 'admin',
  platform_super_admin = false,
  is_active = true
where email = 'admin@acme.example';
```

4. Verify:

```sql
select id, email, organization_id, role, platform_super_admin, carrier_id, is_active
from public.users
where email = 'admin@acme.example';
```

Expected result:

- `organization_id` is the Acme organization id.
- `role = admin`
- `platform_super_admin = false`
- `carrier_id is null`

## Carrier User Invite And Linking

Carrier users must be linked to exactly one carrier profile in their organization.

1. Create or verify the carrier profile:

```sql
insert into public.carriers (
  organization_id,
  company_name,
  mc_number,
  dot_number,
  contact_name,
  email,
  status
)
values (
  '<organization_uuid>',
  'Acme Carrier LLC',
  'MC-123456',
  'DOT-1234567',
  'Carrier Contact',
  'carrier@example.com',
  'pending'
)
returning id, organization_id, company_name;
```

2. Create the carrier user in Supabase Auth.
3. Link the user to the carrier:

```sql
update public.users
set
  organization_id = '<organization_uuid>',
  role = 'carrier',
  carrier_id = '<carrier_uuid>',
  platform_super_admin = false,
  is_active = true
where email = 'carrier@example.com';
```

4. Verify the user and carrier belong to the same organization:

```sql
select
  users.email,
  users.organization_id as user_organization_id,
  users.role,
  users.carrier_id,
  carriers.organization_id as carrier_organization_id,
  carriers.company_name
from public.users
join public.carriers on carriers.id = users.carrier_id
where users.email = 'carrier@example.com';
```

Expected result:

- `role = carrier`
- `user_organization_id = carrier_organization_id`
- `carrier_id` is not null
- `platform_super_admin = false`

## Storage Bucket Setup

The schema creates and configures a private bucket named `carrier-documents`.

Confirm in Supabase Storage:

- bucket id: `carrier-documents`
- public access: disabled
- file size limit: `26214400` bytes
- allowed MIME types:
  - `application/pdf`
  - `image/jpeg`
  - `image/png`
  - `application/msword`
  - `application/vnd.openxmlformats-officedocument.wordprocessingml.document`

Uploaded carrier files must use this path format:

```txt
organizations/{organizationId}/carriers/{carrierId}/{document-name}/v{version}/{timestamp}-{fileName}
```

Storage policy checks:

- staff/admin uploads require access to the organization id in the path.
- staff/admin reads require access to the organization id in the path.
- carrier reads require the carrier id in the path to match the linked `carrier_id`.
- deletes require admin access to the organization id in the path.

## Tenant Isolation Test Checklist

Run these checks before production launch and after any tenancy-related schema change.

### Organization Data

- Create Organization A and Organization B.
- Create one admin in each organization.
- Sign in as Organization A admin.
- Confirm only Organization A carriers appear in the dashboard.
- Confirm dashboard metrics count only Organization A carriers/documents.
- Try to open an Organization B carrier URL directly. Expected: not found or unauthorized.
- Repeat the same checks as Organization B admin.

### Staff Scope

- Create staff users in Organization A and Organization B.
- Confirm Organization A staff can update Organization A carrier documents.
- Confirm Organization A staff cannot update Organization B carriers or documents.
- Confirm Organization A staff cannot read Organization B storage objects.

### Carrier Scope

- Create two carriers in the same organization.
- Link a carrier user to Carrier 1.
- Sign in as that carrier user.
- Confirm the user can open only Carrier 1.
- Try to open Carrier 2 directly by URL. Expected: redirect to linked carrier profile or unauthorized.
- Try to open a carrier from another organization directly by URL. Expected: redirect or unauthorized.

### Notifications

- Generate notifications for Organization A and Organization B.
- Confirm Organization A dashboard only shows Organization A notifications.
- Mark/dismiss an Organization A notification as Organization A staff.
- Try to mutate an Organization B notification id as Organization A staff. Expected: no mutation.

### Uploads

- Upload a document as Organization A staff.
- Confirm the saved storage path starts with `organizations/{organizationAId}/carriers/{carrierAId}/`.
- Confirm Organization B staff cannot generate a signed URL for the Organization A object.
- Confirm the linked carrier user can preview/download only files for their linked carrier.

### Platform Super Admin

- Sign in as the platform super admin.
- Confirm all organizations are visible through direct database access and organization management workflows.
- Confirm platform super admin can manage organization records.
- Confirm ordinary org admins cannot set `platform_super_admin = true`.
- Confirm ordinary org admins cannot move users to another organization.

### Subdomain Branding

- Set Organization A subdomain to `acme`.
- Visit `https://acme.your-production-domain.com`.
- Confirm Organization A name, logo, and brand colors render.
- Visit another tenant subdomain.
- Confirm the branding changes to that tenant.
- Visit an unknown subdomain. Expected: default branding or controlled fallback.

## Deployment Checklist

Before first production deploy:

- Supabase schema applied successfully.
- RLS policies enabled and reviewed.
- Storage bucket exists and is private.
- Platform super admin account created and verified.
- First organization created.
- First organization admin created and verified.
- Supabase Auth redirect URLs include root and wildcard tenant domains.
- Vercel root domain and wildcard subdomain configured.
- Vercel environment variables configured for Production.
- `NEXT_PUBLIC_ROOT_DOMAIN` matches the production root domain exactly.
- Production build passes:

```bash
npm run build
```

- Tenant isolation checklist passes.
- Upload preview/download tested through signed URLs.
- Email webhook tested if `EMAIL_ALERT_WEBHOOK_URL` is configured.
- Backups and point-in-time recovery are enabled in Supabase for production.
- A rollback plan exists for schema and Vercel deployments.

After deploy:

- Visit root domain and at least one tenant subdomain.
- Sign in as platform super admin.
- Sign in as organization admin.
- Sign in as staff.
- Sign in as linked carrier user.
- Upload and preview one test document.
- Sync or view notifications for the tenant.
- Confirm no demo/mock data appears when Supabase is configured.
