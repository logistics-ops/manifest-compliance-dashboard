# QA Testing Checklist

Use this checklist for manual QA before launch, after tenancy-related changes, and after production deployments. The seed script at `supabase/seed-demo-data.sql` creates safe demo tenants and records, but it does not create real Auth credentials.

## Test Accounts

Create Supabase Auth users manually for each role, then link their `auth.users.id` values to the placeholder rows from the seed script or replace the seed UUIDs before running it.

Recommended non-real test identities:

- Platform super admin: `platform-super-admin@example.test`
- Org A admin: `admin@atlas-demo.example.test`
- Org A staff: `staff@atlas-demo.example.test`
- Org A carrier: `carrier@atlas-demo.example.test`
- Org B admin: `admin@harbor-demo.example.test`
- Org B staff: `staff@harbor-demo.example.test`
- Org B carrier: `carrier@harbor-demo.example.test`

## Platform Super Admin Tests

- Sign in as the platform super admin.
- Open `/platform`.
- Confirm all demo organizations are visible.
- Confirm organization analytics show total organizations, users, carriers, documents, and storage usage.
- Create a new organization with a unique slug and subdomain.
- Edit an organization name, slug, subdomain, logo URL, and brand colors.
- Reset organization branding and confirm default Manifest colors return.
- Suspend an organization and confirm its status changes.
- Reactivate the organization and confirm its status changes.
- Invite an organization admin from the platform dashboard.
- Confirm the invite creates or updates a user with `role = admin`, the selected `organization_id`, and `platform_super_admin = false`.
- Open the safe organization preview from `/platform/organizations/{organizationId}/dashboard`.
- Confirm the preview is read-only and does not change the platform super admin session tenant.

## Organization Admin Tests

- Sign in as Org A admin.
- Confirm Org A dashboard only shows Org A carriers.
- Create a carrier under Org A.
- Edit an Org A carrier profile.
- Change an Org A carrier status.
- Upload or update document metadata for an Org A carrier.
- Add a compliance note to an Org A carrier.
- Try opening an Org B carrier URL directly. Expected: not found, unauthorized, or redirect away.
- Sign out and repeat as Org B admin.
- Confirm Org B admin cannot see or mutate Org A records.

## Staff User Tests

- Sign in as Org A staff.
- Confirm the dashboard loads for Org A.
- Confirm staff can update compliance document metadata.
- Confirm staff can upload carrier documents for Org A.
- Confirm staff cannot create a new carrier.
- Confirm staff cannot edit carrier company details or carrier status if the UI hides those admin controls.
- Try to submit a crafted request for an Org B carrier document update. Expected: no mutation or server error.
- Repeat as Org B staff.

## Carrier User Tests

- Sign in as the Org A carrier user linked to one carrier.
- Confirm the user is redirected to their linked carrier profile if they visit `/`.
- Confirm the user can view only their linked carrier profile.
- Confirm document rows are visible for the linked carrier.
- Confirm edit/upload controls are disabled or unavailable.
- Try opening another Org A carrier profile by URL. Expected: redirect to linked carrier or unauthorized.
- Try opening an Org B carrier profile by URL. Expected: redirect to linked carrier or unauthorized.
- Repeat as Org B carrier user.

## Tenant Isolation Tests

- Confirm Org A admin sees only Org A carriers, documents, notifications, notes, and alerts.
- Confirm Org B admin sees only Org B carriers, documents, notifications, notes, and alerts.
- Confirm dashboard metrics differ correctly between Org A and Org B based on seeded data.
- Confirm Org A users cannot query Org B rows through normal app routes.
- Confirm direct URLs do not expose another organization’s carrier data.
- Confirm server actions that receive foreign IDs do not mutate another organization.
- Confirm ordinary org admins cannot set `platform_super_admin = true`.
- Confirm ordinary org admins cannot move a user to another organization.

## Suspended Organization Tests

- As platform super admin, suspend Org A from `/platform`.
- Sign in as Org A admin. Expected: dashboard access is blocked or organization data is unavailable.
- Sign in as Org A staff. Expected: dashboard access is blocked or organization data is unavailable.
- Sign in as Org A carrier. Expected: carrier data access is blocked or unavailable.
- Confirm platform super admin can still view and reactivate Org A.
- Reactivate Org A.
- Confirm Org A admin, staff, and carrier access returns.
- Confirm Org B access was unaffected during Org A suspension.

## Upload Permission Tests

- Sign in as Org A staff.
- Upload a valid PDF for an Org A carrier.
- Confirm the stored path starts with `organizations/{orgAId}/carriers/{carrierAId}/`.
- Confirm file metadata appears in `public.carrier_documents`.
- Confirm a version row appears in `public.carrier_document_versions`.
- Try uploading a disallowed file type. Expected: validation error.
- Try finalizing an upload with a path for another organization. Expected: rejection.
- Sign in as Org B staff and try to access the Org A file signed URL. Expected: denied.
- Sign in as the linked carrier user and preview/download only their linked carrier’s file.

## Notification Permission Tests

- Sign in as Org A admin or staff.
- Confirm only Org A notifications appear.
- Mark an Org A notification as read.
- Dismiss an Org A notification.
- Assign an Org A notification to yourself.
- Try to mutate an Org B notification id through a crafted form/request. Expected: no mutation.
- Sign in as Org B admin or staff and repeat the same checks for Org B.
- Confirm platform super admin can see aggregate notification counts in `/platform`.

## Subdomain Branding Tests

- Configure `NEXT_PUBLIC_ROOT_DOMAIN` for the test domain.
- Set Org A subdomain to `atlas`.
- Set Org B subdomain to `harbor`.
- Visit `https://atlas.{rootDomain}`.
- Confirm Org A name, logo, and brand colors render.
- Visit `https://harbor.{rootDomain}`.
- Confirm Org B name, logo, and brand colors render.
- Change Org A colors from `/platform`.
- Reload `https://atlas.{rootDomain}` and confirm the new colors apply.
- Visit an unknown subdomain. Expected: default branding or controlled fallback.
- Confirm changing Org A branding does not affect Org B branding.

## Platform Dashboard Tests

- Confirm `/platform` is inaccessible when signed out.
- Confirm `/platform` is inaccessible to org admins, staff, and carrier users.
- Confirm `/platform` loads for platform super admin.
- Confirm all organization lifecycle actions revalidate the dashboard.
- Confirm organization usage metrics update after adding carriers, users, documents, and notifications.
- Confirm safe tenant preview does not expose write controls.

## Production Deployment Verification

Before deploy:

- `npm run build` passes.
- Supabase schema is applied.
- Seed data is not run against production unless explicitly approved.
- RLS policies are enabled.
- Storage bucket is private.
- Vercel production env vars are set.
- `SUPABASE_SERVICE_ROLE_KEY` is set only as a server-side secret.
- Root domain and wildcard tenant domain are configured.
- Supabase Auth redirect URLs include root and wildcard tenant domains.

After deploy:

- Visit root domain and confirm unauthenticated users redirect to login.
- Visit a tenant subdomain and confirm tenant branding.
- Sign in as platform super admin and open `/platform`.
- Sign in as org admin and confirm only that tenant’s data appears.
- Sign in as staff and upload a test document.
- Sign in as carrier user and confirm only linked profile access.
- Suspend and reactivate a non-production test organization.
- Confirm production logs show no secret values.
- Confirm backups and point-in-time recovery are enabled.
