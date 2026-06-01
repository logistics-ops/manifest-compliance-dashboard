# Phase 1.7 Manual QA: Vehicle Document Upload

Use this checklist to verify Vehicle Compliance Files in a QA/staging environment or against approved test records only.

Do not add credentials to the repo. Do not disable RLS. Do not change production data. Use read-only SQL for inspection unless a test explicitly requires browser upload through the application.

## QA Inputs

Capture these values before testing:

- Admin or staff test user: `<admin_or_staff_email>`
- Carrier test user: `<carrier_email>`
- Organization ID: `<organization_id>`
- Carrier ID linked to carrier user: `<carrier_id>`
- Equipment ID linked to carrier user: `<equipment_id>`
- Equipment ID linked to another carrier: `<other_equipment_id>`
- Document slug: `<document_slug>`
- Document name: `<document_name>`
- Test file name: `<test_file_name>`

Recommended URLs:

- Vehicle list: `/vehicles`
- Own vehicle detail: `/vehicles/<equipment_id>`
- Cross-carrier vehicle denial: `/vehicles/<other_equipment_id>`
- Deep link to document row: `/vehicles/<equipment_id>?document=<document_slug>`

Required storage path format:

```text
organizations/{organizationId}/equipment/{equipmentId}/{documentSlug}/v{version}/{timestamp}-{fileName}
```

## 1. Admin/Staff Vehicle Upload

1. Sign in as an admin or staff user for `<organization_id>`.
2. Open `/vehicles`.
3. Expand a vehicle row.
4. Click `Open vehicle compliance file`.
5. Confirm `/vehicles/<equipment_id>` loads.
6. Find a vehicle checklist item such as:
   - Registration
   - Insurance
   - Annual Inspection
   - Preventive Maintenance
7. Confirm the row shows upload controls:
   - Expiration date input
   - Upload/dropzone control
   - Notes field
   - Current file panel
8. Upload a test file.
9. Confirm success UI appears.
10. Refresh the page.
11. Confirm the current file panel shows the uploaded file.
12. Confirm preview/download controls render.

Expected result:

- Admin/staff can upload vehicle documents for equipment in their organization.
- No RLS error appears.
- Upload controls are readable and usable.

## 2. Carrier Vehicle Upload For Own Linked Equipment

1. Sign in as the carrier user linked to `<carrier_id>`.
2. Open `/vehicles/<equipment_id>` where `equipment.carrier_id = <carrier_id>`.
3. Confirm the vehicle page loads.
4. Upload a document to a missing, expired, or expiring checklist row.
5. Add an expiration date.
6. Save/upload the file.
7. Refresh the page.
8. Confirm the file appears in the current file panel.

Expected result:

- Carrier user can upload and replace vehicle documents only for equipment linked to their carrier profile.
- Carrier user cannot see or manage another carrier's vehicle documents.

## 3. Carrier Denial For Another Carrier's Equipment

1. Stay signed in as the carrier user linked to `<carrier_id>`.
2. Open `/vehicles/<other_equipment_id>`.
3. Confirm the route does not expose another carrier's equipment file.
4. If the page redirects, returns unauthorized, or returns not found, record the result.
5. If a page loads unexpectedly, confirm upload controls are not available.
6. In a safe QA environment only, attempt a direct upload action and confirm it fails.

Expected result:

- Carrier users cannot view or manage vehicle documents for equipment belonging to another carrier.
- No `equipment_documents` row or storage object is created by an unauthorized attempt.

## 4. Vehicle Document Replace

1. Open `/vehicles/<equipment_id>` as an authorized admin/staff or linked carrier user.
2. Select a checklist item that already has a file.
3. Upload a second test file for the same document.
4. Confirm the UI reports a replacement or new version.
5. Refresh the page.
6. Confirm the current file panel shows the newer file.

Expected result:

- Replacement creates a new storage version path, such as `v2`.
- `equipment_documents.storage_path` points to the newest file.
- Previous storage objects are not automatically deleted.

## 5. Expiration Date Save/Update

1. Open `/vehicles/<equipment_id>`.
2. Choose a checklist item.
3. Upload or replace a file with an expiration date.
4. Refresh and confirm the expiration date persists.
5. Replace the same document with a different expiration date.
6. Refresh and confirm the updated expiration date persists.

Expected result:

- `equipment_documents.expiration_date` matches the browser value.
- `equipment_documents.status` recalculates as:
  - `valid`
  - `expiring_soon`
  - `expired`

## 6. Vehicle Readiness Score Update

1. Record the vehicle readiness percentage before upload.
2. Upload a missing required document.
3. Refresh `/vehicles/<equipment_id>`.
4. Confirm readiness percentage updates.
5. Confirm missing/expired/expiring counts update.
6. Confirm critical blockers clear when required documents become valid.

Expected result:

- Vehicle readiness score reflects the updated checklist state.
- Required documents affect readiness.
- Optional documents are `not applicable` until a matching document exists.

## 7. Dashboard Vehicle Readiness Update

1. Open `/`.
2. Record the Vehicle readiness KPI and Vehicles needing attention count.
3. Upload or replace a vehicle document.
4. Return to `/`.
5. Refresh the dashboard.
6. Confirm the Vehicle readiness KPI and Needs Attention sections reflect the updated vehicle state.

Expected result:

- Dashboard values update from the same vehicle readiness data source.
- No mock/demo fallback appears when Supabase is connected.

## 8. Expired/Expiring Vehicle Document Alerts

1. Upload a vehicle document with an expiration date in the past.
2. Confirm the vehicle checklist row shows `expired`.
3. Upload or update a vehicle document with an expiration date within 30 days.
4. Confirm the row shows `expiring soon`.
5. Open `/documents-to-fix`.
6. Confirm expired/expiring vehicle document actions appear.
7. Open `/actions`.
8. Confirm vehicle document issues appear in the action queue where applicable.

Expected result:

- Expired and expiring vehicle documents surface in correction workflows.
- Carrier users only see actions for their linked carrier/equipment.

## 9. Storage Path Verification

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
  and name like 'organizations/<organization_id>/equipment/<equipment_id>/<document_slug>/%'
order by created_at desc
limit 20;
```

Expected result:

- `bucket_id = carrier-documents`
- `name` starts with `organizations/<organization_id>/equipment/<equipment_id>/<document_slug>/`
- First upload uses `v1`
- Replacement uses the next version, such as `v2`
- No file is stored under another organization or equipment path

## 10. Audit Log Verification

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
  and entity_type = 'vehicle_document'
  and metadata ->> 'equipment_id' = '<equipment_id>'
order by created_at desc
limit 25;
```

Action-specific query:

```sql
select
  action,
  actor_user_id,
  metadata ->> 'equipment_id' as equipment_id,
  metadata ->> 'carrier_id' as carrier_id,
  metadata ->> 'document_name' as document_name,
  metadata ->> 'file_name' as file_name,
  metadata ->> 'storage_path' as storage_path,
  metadata ->> 'expiration_date' as expiration_date,
  created_at
from public.audit_logs
where organization_id = '<organization_id>'
  and action in (
    'vehicle_document.uploaded',
    'vehicle_document.replaced',
    'vehicle_document.expiration_changed'
  )
order by created_at desc
limit 25;
```

Expected result:

- First upload writes `vehicle_document.uploaded`
- Replacement writes `vehicle_document.replaced`
- Expiration date change writes `vehicle_document.expiration_changed`
- Metadata includes:
  - `equipment_id`
  - `carrier_id`
  - `document_name`
  - `file_name`
  - `storage_path`
- `actor_user_id` equals the signed-in test user's `auth.users.id`

## Read-Only equipment_documents Queries

Document row by equipment and document:

```sql
select
  id,
  organization_id,
  equipment_id,
  document_name,
  uploaded,
  status,
  expiration_date,
  storage_path,
  notes,
  uploaded_by,
  uploaded_at,
  updated_at
from public.equipment_documents
where organization_id = '<organization_id>'
  and equipment_id = '<equipment_id>'
  and lower(regexp_replace(document_name, '[^a-z0-9]+', '-', 'g')) like '<document_slug>%'
order by updated_at desc
limit 10;
```

All vehicle documents for one equipment record:

```sql
select
  id,
  organization_id,
  equipment_id,
  document_name,
  uploaded,
  status,
  expiration_date,
  storage_path,
  notes,
  uploaded_by,
  uploaded_at,
  updated_at
from public.equipment_documents
where organization_id = '<organization_id>'
  and equipment_id = '<equipment_id>'
order by updated_at desc
limit 50;
```

Equipment ownership check:

```sql
select
  id,
  organization_id,
  carrier_id,
  unit_number,
  equipment_type,
  status,
  updated_at
from public.equipment
where id in ('<equipment_id>', '<other_equipment_id>')
order by unit_number;
```

## Completion Criteria

Mark Phase 1.7 manually verified only after all are true:

- Admin/staff upload passes.
- Carrier own-equipment upload passes.
- Carrier cross-equipment denial passes.
- Replacement increments storage version.
- Expiration date saves and updates.
- Vehicle readiness updates.
- Dashboard Vehicle readiness updates.
- Expired/expiring vehicle document issues surface.
- Storage path matches the tenant-safe pattern.
- Audit logs are written for upload, replacement, and expiration change.

