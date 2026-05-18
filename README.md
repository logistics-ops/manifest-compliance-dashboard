# Manifest Global Logistics Carrier Compliance Dashboard

Next.js + Tailwind CSS dashboard for trucking carrier compliance tracking.

## Run Locally

```bash
npm install
npm run dev
```

## Environment Variables

Copy `.env.example` to `.env.local` and add your Supabase project values:

```bash
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET=carrier-documents
EMAIL_ALERT_WEBHOOK_URL=optional_email_provider_webhook
```

The Supabase clients live in `lib/supabase/client.ts` and `lib/supabase/server.ts`. If either value is missing, the clients return `null` and the app can continue using `mockCarriers` as a fallback.

## Authentication And Roles

Supabase Auth is wired through:

- `app/login/page.tsx` for the premium login screen.
- `app/login/actions.ts` for email/password sign-in and sign-out.
- `middleware.ts` for protected route session refresh and redirects.
- `lib/integrations/auth.ts` for server-side session loading.
- `lib/auth/permissions.ts` for shared role checks.

Roles:

- `admin`: manage carriers, users, documents, notes, alerts, drivers, and equipment.
- `staff`: update compliance documents, alerts, and notes.
- `carrier`: view only their linked carrier profile, documents, alerts, and compliance score.

Carrier portal users must have `public.users.carrier_id` set to the carrier profile they are allowed to view. The schema includes bootstrap SQL comments for promoting the first admin and linking a carrier user.

## Structure

- `app/` contains the Next.js App Router entrypoints and global Tailwind styles.
- `components/` contains the dashboard UI and shared status chip.
- `app/carriers/[carrierId]/page.tsx` contains dedicated carrier compliance profile pages.
- `app/carriers/new/page.tsx` contains the create-carrier form.
- `app/actions/carriers.ts` contains Supabase-backed carrier management server actions with mock/demo no-op fallback.
- `lib/mock-data.ts` contains sample carriers and required document definitions.
- `lib/compliance.ts` contains derived compliance rules, metrics, alerts, action items, and the 90-day expiration timeline.
- `lib/integrations/` contains Supabase upload helpers plus integration points for auth, Supabase, and email alerts.
- `lib/supabase/` contains browser/server Supabase client helpers.
- `lib/data/carriers.ts` contains a Supabase-first carrier loader that falls back to mock data.
- `types/carrier.ts` contains the carrier, document, and alert types.
- `supabase/schema.sql` contains the database tables, relationships, indexes, triggers, and RLS policies.

## Dashboard Analytics

The executive analytics section includes:

- Total, active, high-risk, and audit-ready carriers
- Documents expiring within 7 and 30 days
- Missing document count
- Average compliance score
- Compliance trend chart
- Carrier risk distribution chart
- Document expiration exposure chart

## Future Integrations

- Login: extend the Supabase Auth screen with password reset and invite flows.
- Supabase database: replace `mockCarriers` with server/client data loading.
- File uploads: Supabase Storage uploads are wired for carrier documents. Add virus scanning or approval workflow before production use.
- Email alerts: trigger from the alert labels generated in `lib/compliance.ts`.

## Supabase Storage Uploads

Carrier document uploads use the private `carrier-documents` bucket and organized paths:

```txt
carriers/{carrierId}/{document-name}/v{version}/{timestamp}-{fileName}
```

Supported upload types:

- PDF
- JPG/JPEG
- PNG
- DOC/DOCX

The profile page includes drag-and-drop uploads, progress, preview/download signed links, file name display, upload timestamp, uploaded-by tracking, and versioned replacement handling through `carrier_document_versions`.

## Automated Alerts And Emails

The dashboard includes a notification center backed by the `notifications` table when Supabase is connected, with mock/generated fallback alerts otherwise.

Automation rules:

- 30-day expiration warning
- 14-day expiration warning
- 7-day expiration warning
- Expired document critical alert
- Expired insurance critical alert
- Missing document alert
- High-risk carrier alert

Notifications include unread/read/dismissed status, priority, category, timestamps, carrier/document context, user assignment, and alert dismissal. `lib/integrations/email-alerts.ts` includes document alert and weekly compliance summary email templates. Set `EMAIL_ALERT_WEBHOOK_URL` to dispatch email payloads to an email provider or internal workflow endpoint.

## Carrier Management Actions

The app includes server actions for:

- Creating a carrier
- Editing carrier information
- Updating carrier status
- Adding compliance notes
- Saving document expiration dates
- Updating document upload status and notes

When Supabase environment variables are configured, these actions write to Supabase. When Supabase is not configured, actions revalidate/redirect as mock-demo behavior while the UI continues to use sample data.

## Compliance Score Logic

Scores start at 100 and apply automatic deductions from `lib/compliance.ts`:

- Missing required document: -10
- Expired document: -15
- Expiring within 30 days: -5
- Missing driver file item: -10
- Outdated annual inspection: -10
- Missing drug consortium enrollment: -15
- Expired insurance: automatic High Risk tier

Score tiers:

- 100: Audit Ready
- 90-99: Strong Compliance
- 80-89: Mostly Compliant
- 70-79: Needs Attention
- 60-69: Moderate Risk
- Below 60: High Risk

`getComplianceScoreBreakdown(carrier)` returns the final score, tier, automatic High Risk flag, and every deduction reason so the UI, future email alerts, and audit reports can all use the same scoring source.

Risk indicators:

- Green: Audit Ready
- Yellow: Needs Attention
- Orange: Moderate Risk
- Red: High Risk

`getComplianceTimeline(carriers, 90)` returns upcoming document expirations over the next 90 days, sorted by soonest expiration.

## Supabase Handoff

The app currently reads from `mockCarriers` in `lib/mock-data.ts`. To connect Supabase later, map carrier rows into this shape:

```js
{
  id,
  companyName,
  mcNumber,
  dotNumber,
  contactName,
  phone,
  email,
  status,
  notes,
  documents: {
    "Certificate of Insurance": { uploaded, expirationDate },
    "W-9": { uploaded, expirationDate },
    "Operating Authority": { uploaded, expirationDate }
  }
}
```

The calculated document statuses, alert labels, metrics, action items, and carrier detail helpers live in `lib/compliance.ts`, so the UI should not need structural changes when the data source changes.
