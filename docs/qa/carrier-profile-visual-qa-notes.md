# Carrier Profile Visual QA Notes

Date: 2026-06-01

Status: blocked pending authenticated browser access.

## Scope

Visual QA requested for:

- Admin dashboard layout
- Admin carrier profile layout
- Carrier portal layout
- DQ document upload page
- Mobile responsive layout

Target viewports:

- Desktop: 1440px
- Tablet: 768px
- Mobile: 390px

Screenshot destination:

- `docs/qa/screenshots/`

## Findings

The QA screenshots could not be captured yet because the available browser MCP bridge failed before attaching to the in-app browser session. Temporary test credentials were also not present in this thread, so authenticated admin/carrier pages could not be opened safely.

No backend, RLS, auth, database policy, calculation, or data-source changes were made.

## Pending Visual Checks

Complete these once Playwright MCP and test credentials are available:

1. Admin dashboard layout
   - Confirm header actions are left-aligned and not crowded.
   - Confirm sticky Action Center does not cover content.
   - Confirm no horizontal overflow at 1440px, 768px, or 390px.

2. Admin carrier profile layout
   - Confirm the profile uses the full available content width.
   - Confirm carrier summary, compliance score, action items, documents, and assigned loads stack cleanly.
   - Confirm document rows are not squeezed into a narrow column.

3. Carrier portal layout
   - Confirm carrier sidebar remains intact on desktop.
   - Confirm portal navigation stacks or wraps cleanly on tablet/mobile.
   - Confirm assigned loads remain readable.

4. DQ document upload page
   - Confirm missing, expired, and expiring DQ rows render upload/replace controls.
   - Confirm valid and not-applicable rows remain read-only.
   - Confirm deep links with `?document={documentSlug}` highlight the target row.

5. Upload controls
   - Confirm upload/replace buttons render correctly.
   - Confirm expiration fields, current file panels, notes/actions, preview, and download controls are readable.
   - Confirm no broken or clipped buttons.

## Expected Screenshot Names

Use these names when screenshots are captured:

- `admin-dashboard-1440.png`
- `admin-dashboard-768.png`
- `admin-dashboard-390.png`
- `admin-carrier-profile-1440.png`
- `admin-carrier-profile-768.png`
- `admin-carrier-profile-390.png`
- `carrier-portal-1440.png`
- `carrier-portal-768.png`
- `carrier-portal-390.png`
- `dq-upload-page-1440.png`
- `dq-upload-page-768.png`
- `dq-upload-page-390.png`

## Verification Commands

Run after visual QA:

```bash
npm exec tsc -- --noEmit
npm test
npm run build
```

