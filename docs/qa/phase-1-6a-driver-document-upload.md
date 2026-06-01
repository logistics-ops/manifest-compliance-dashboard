# Phase 1.6A Manual QA: Driver DQ Document Upload

Use this checklist to complete browser verification once test credentials are available.

Do not add service role keys to the repo. Do not commit credentials. Do not disable RLS. Do not change production data. Run this only in a QA/staging Supabase project, or against dedicated test records in production with approval.

## QA Inputs

Capture these values before testing:

- Admin or staff test user: `<admin_or_staff_email>`
- Carrier test user: `<carrier_email>`
- Organization ID: `<organization_id>`
- Carrier ID linked to carrier user: `<carrier_id>`
- Own driver ID linked to that carrier: `<own_driver_id>`
- Cross-driver ID linked to a different carrier: `<other_driver_id>`
- Missing/expired/expiring document slug: `<document_slug>`
- Test file name: `<test_file_name>`

Recommended test URLs:

- Admin/staff own-org driver: `/dq-files/<own_driver_id>`
- Carrier own driver: `/dq-files/<own_driver_id>`
- Carrier cross-driver denial: `/dq-files/<other_driver_id>`
- Deep link: `/dq-files/<own_driver_id>?document=<document_slug>`

## 1. Admin/Staff Upload Test

1. Sign in as an admin or staff user for `<organization_id>`.
2. Open `/dq-files/<own_driver_id>`.
3. Confirm the page loads and shows the selected driver.
4. Find a checklist row with status `missing`, `expired`, or `expiring soon`.
5. Confirm the row shows:
   - Expiration Date input
   - Dropzone or browse/select upload control
   - Current File panel
6. Select a test file.
7. Enter an expiration date if the document type requires one.
8. Upload the file.
9. Confirm success UI appears.
10. Refresh the page.
11. Confirm the document now shows as uploaded and the current file appears.
12. Upload a second file for the same checklist item.
13. Confirm the UI treats it as a replacement and shows the newer file.

Expected result:

- Admin/staff can upload, replace, preview, and download DQ documents for drivers in their organization.
- No RLS error appears.
- The user cannot manage drivers outside their organization.

## 2. Carrier Own-Driver Upload Test

1. Sign in as the carrier user linked to `<carrier_id>`.
2. Open `/dq-files/<own_driver_id>`.
3. Confirm the page loads for a driver where `drivers.carrier_id = <carrier_id>`.
4. Find a `missing`, `expired`, or `expiring soon` checklist row.
5. Upload a test file.
6. Add or update the expiration date.
7. Confirm success UI appears.
8. Refresh the page.
9. Confirm preview/download controls work for the uploaded file.
10. Replace the uploaded file.

Expected result:

- Carrier user can upload, replace, preview, and download documents only for drivers linked to their carrier profile.
- File replacement increments the storage version path.
- No documents from another carrier are visible.

## 3. Carrier Cross-Driver Denial Test

1. Stay signed in as the carrier user linked to `<carrier_id>`.
2. Open `/dq-files/<other_driver_id>` where the driver belongs to a different carrier or organization.
3. Confirm the page does not expose another carrier's driver file.
4. If the page returns 404, unauthorized, or redirects away, record the result.
5. If a page loads, confirm upload controls are not available.
6. Attempt a direct upload action only in a safe QA environment.

Expected result:

- Carrier users cannot view or manage another carrier's driver documents.
- Cross-carrier access should fail through route loading and server action authorization.
- No storage object or `driver_documents` row is created for the unauthorized attempt.

## 4. Storage Path Verification

After a successful upload, verify the stored object path follows:

```text
organizations/{organizationId}/drivers/{driverId}/{documentSlug}/v{version}/{timestamp}-{fileName}
```

Read-only SQL:

```sql
select
  bucket_id,
  name,
  created_at,
  updated_at,
  metadata
from storage.objects
where bucket_id = 'carrier-documents'
  and name like 'organizations/<organization_id>/drivers/<driver_id>/<document_slug>/%'
order by created_at desc
limit 20;
```

Expected result:

- `bucket_id = carrier-documents`
- `name` starts with `organizations/<organization_id>/drivers/<driver_id>/<document_slug>/`
- First upload uses `v1`.
- Replacement uses the next version, such as `v2`.
- No object is stored under another organization, carrier, or driver path.

## 5. driver_documents Row Verification

Read-only SQL:

```sql
select
  id,
  organization_id,
  driver_id,
  document_name,
  uploaded,
  status,
  expiration_date,
  storage_path,
  uploaded_by,
  uploaded_at,
  updated_at
from public.driver_documents
where organization_id = '<organization_id>'
  and driver_id = '<driver_id>'
  and lower(regexp_replace(document_name, '[^a-z0-9]+', '-', 'g')) like '<document_slug>%'
order by updated_at desc
limit 10;
```

If the slug match is too strict for the document name, use:

```sql
select
  id,
  organization_id,
  driver_id,
  document_name,
  uploaded,
  status,
  expiration_date,
  storage_path,
  uploaded_by,
  uploaded_at,
  updated_at
from public.driver_documents
where organization_id = '<organization_id>'
  and driver_id = '<driver_id>'
order by updated_at desc
limit 25;
```

Expected result:

- `organization_id = <organization_id>`
- `driver_id = <driver_id>`
- `uploaded = true`
- `status = valid`, `expiring_soon`, or `expired` based on the saved expiration date
- `expiration_date` matches the browser input, or is null when omitted
- `storage_path` matches the storage object path
- `uploaded_by` equals the authenticated test user's `auth.users.id`
- `uploaded_at` is populated and updated after replacement

## 6. audit_logs Verification

Read-only SQL:

```sql
select
  id,
  organization_id,
  actor_user_id,
  action,
  entity_type,
  entity_id,
  metadata,
  created_at
from public.audit_logs
where organization_id = '<organization_id>'
  and entity_type = 'driver_document'
  and metadata ->> 'driver_id' = '<driver_id>'
order by created_at desc
limit 25;
```

Action-specific check:

```sql
select
  action,
  actor_user_id,
  metadata ->> 'driver_id' as driver_id,
  metadata ->> 'carrier_id' as carrier_id,
  metadata ->> 'document_name' as document_name,
  metadata ->> 'file_name' as file_name,
  metadata ->> 'storage_path' as storage_path,
  metadata ->> 'expiration_date' as expiration_date,
  created_at
from public.audit_logs
where organization_id = '<organization_id>'
  and action in (
    'driver_document.uploaded',
    'driver_document.replaced',
    'driver_document.expiration_changed'
  )
order by created_at desc
limit 25;
```

Expected result:

- First upload writes `driver_document.uploaded`.
- Replacement writes `driver_document.replaced`.
- Changing the expiration date writes `driver_document.expiration_changed`.
- Metadata includes:
  - `driver_id`
  - `carrier_id`
  - `document_name`
  - `file_name`
  - `storage_path`
- `actor_user_id` is the signed-in test user.
- Carrier user actions are scoped to that carrier's driver only.

## 7. Regression Checks: Valid/Not-Applicable Rows

1. Open `/dq-files/<own_driver_id>` as admin/staff.
2. Find a checklist row with status `valid`.
3. Confirm it shows document metadata but no upload/replace controls.
4. Find a conditional row marked `not applicable`.
5. Confirm it stays read-only.
6. Repeat as carrier user.

Expected result:

- `valid` rows remain readable but do not show upload controls.
- `not applicable` rows remain readable and do not show upload controls.
- Missing, expired, and expiring rows are the only rows with correction controls.

## 8. Deep-Link Check

1. Open `/dq-files/<own_driver_id>?document=<document_slug>`.
2. Confirm the page loads the driver detail view.
3. Confirm the target checklist item is visually highlighted.
4. Confirm the browser can refresh the URL and preserve the highlighted row.
5. If the item is missing, expired, or expiring, confirm upload controls remain available.

Expected result:

- Deep links route to the correct driver detail page.
- The row with `id="document-<document_slug>"` is highlighted.
- No unrelated rows are highlighted.
- Role restrictions still apply when opening the deep link directly.

## Completion Criteria

Mark Phase 1.6A manually verified only after all are true:

- Admin/staff upload, replace, preview, and download pass.
- Carrier own-driver upload, replace, preview, and download pass.
- Carrier cross-driver direct access is denied.
- Storage path matches the required tenant-safe pattern.
- `driver_documents` row updates correctly.
- Audit logs are written for upload, replacement, and expiration change.
- Valid and not-applicable rows remain read-only.
- Deep link with `?document={documentSlug}` works.

