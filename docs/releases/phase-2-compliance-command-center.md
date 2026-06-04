# Phase 2 Compliance Command Center Release Summary

## Completed Modules

Phase 2 expands Manifest Operations Center from compliance visibility into a working compliance command center. The release keeps the existing tenant, role, storage, and Supabase foundation intact while adding operational workflows for document intake, onboarding progress, alerts, tasks, inspections, safety posture, coaching, and SAFER snapshot review.

Completed Phase 2 areas:

- Secure carrier intake upload links
- Carrier onboarding progress tracking
- Compliance alerts center
- Compliance task management
- In-app compliance notifications and reminders
- Inspection reports
- Manual safety score tracking
- Safety score trends
- Safety coaching and corrective actions
- Manual SAFER lookup and snapshot history
- Dashboard and carrier profile integrations for the new compliance workflows

## Carrier Intake Upload Link Workflow

Manifest admins can create a secure no-login carrier intake upload link for a carrier. The link opens a public upload page at `/upload/[token]` and allows the carrier to submit requested compliance documents without signing in.

The workflow supports a multi-document intake packet instead of a single upload. Public upload progress is backed by saved document records, so refreshing the browser preserves uploaded/completed status.

Supported intake areas:

- Company/carrier compliance documents
- Driver/DQ documents when the token allows driver scope
- Vehicle/maintenance documents when the token allows equipment scope

Security behavior:

- Raw tokens are never stored.
- Token lookup uses a hashed token.
- Expired or revoked links cannot upload.
- Link scope controls the carrier, optional driver, optional equipment, and allowed document categories.
- Public upload finalization uses server-only privileged Supabase access.
- Existing authenticated upload workflows remain unchanged.

Files continue to save under the existing tenant-safe storage patterns, such as:

- `organizations/{organizationId}/carriers/{carrierId}/...`
- `organizations/{organizationId}/drivers/{driverId}/...`
- `organizations/{organizationId}/equipment/{equipmentId}/...`

## Onboarding Progress Workflow

Carrier onboarding progress is calculated from existing carrier, driver, vehicle, and compliance document data. No separate onboarding document architecture was introduced.

Progress categories:

- Company Documents
- Driver Files
- Vehicle Files
- Vehicle Maintenance
- Required Compliance Documents

The UI surfaces:

- Percentage complete
- Completed items
- Missing items
- Expiring items
- Status badges: Not Started, In Progress, Near Complete, Complete

Progress appears on carrier profiles, carrier roster/list views, dashboard summaries, and compliance alert flows. Public upload packet submissions update onboarding progress automatically because progress is calculated from the saved document records.

## Compliance Alerts, Tasks, And Notifications Workflow

The Compliance Alerts Center aggregates issues from existing readiness, expiration, and status data.

Alert sources:

- Carrier documents
- Driver/DQ documents
- Vehicle documents
- Onboarding progress gaps

Alert types:

- Missing
- Expired
- Expiring Soon
- Needs Review
- Readiness Risk

Compliance Tasks turn alerts into assignable work. Tasks can be created from carrier, driver, or vehicle alerts, or entered manually.

Task fields:

- Title
- Description
- Priority
- Due date
- Status
- Assigned user
- Related entity

Supported statuses:

- Open
- In Progress
- Waiting
- Completed

In-app notifications support compliance reminders and user-facing follow-up without adding SMS, email, or background jobs yet. Notifications are tenant-scoped and can be marked read individually or in bulk.

## Inspection Reports Workflow

Inspection Reports provide a compliance-focused inspection management workflow before future automated FMCSA/SAFER integrations.

Supported inspection data:

- Inspection date
- Inspection type
- Location
- Violations
- Out-of-service status
- Notes
- Linked carrier
- Linked driver or vehicle where applicable

Inspection evidence can be uploaded as documents, photos, or PDFs. Findings can be connected to compliance tasks so inspection issues become actionable follow-up work.

Inspection-related activity is also available for dashboard summaries, alerts, and audit logging.

## Safety Score, Trend, And Coaching Workflow

Manual Safety Score Tracking allows Manifest staff to record safety posture before adding FMCSA/SAFER automation.

Tracked safety score fields:

- DOT number
- MC number
- Score/source label
- Safety status
- Inspection count
- Violation count
- Out-of-service count
- Notes
- Recorded date

Safety Score Trends compare the latest score record against previous history and classify carriers as:

- Improving
- Declining
- Stable
- Missing history

Safety Coaching turns inspection and safety score findings into corrective action plans.

Coaching fields:

- Carrier
- Related safety score
- Related inspection report
- Issue
- Recommendation
- Priority
- Target completion date
- Status
- Notes

Coaching items can link back to compliance tasks to keep corrective actions visible in the main work queue.

## SAFER Lookup Workflow

The SAFER Lookup module is intentionally manual in this phase. It gives staff a structured place to perform and store review snapshots without scraping, background jobs, or paid services.

Search inputs:

- DOT number
- MC number, optional

Snapshot fields:

- Legal name
- DBA name
- DOT number
- MC number
- Operating status
- Power units
- Drivers
- Safety rating
- Inspection summary
- Out-of-service summary
- Crash summary

Staff can save a snapshot and attach it to a carrier. Carrier profiles show the latest SAFER snapshot and snapshot date. The dashboard can identify carriers with missing or outdated SAFER snapshots.

## Security And RLS Protections

Phase 2 preserves the existing multi-tenant security model.

Core protections:

- All tenant-owned records remain scoped by `organization_id`.
- Admin and staff users are scoped to their organization.
- Carrier users remain scoped to their linked `carrier_id`.
- Platform super admins retain cross-organization access where existing policy allows.
- Public upload links are token-scoped, expiring, revocable, and hash-based.
- Raw upload tokens are not stored.
- Service role access is server-only and is not exposed to clients.
- Storage paths remain organization-scoped.
- Public upload links do not expose unrelated carrier, driver, equipment, or organization data.
- Existing authenticated carrier, driver, and vehicle upload workflows are preserved.
- Audit logs are written for important compliance, upload, task, safety, coaching, and SAFER actions where implemented.

## Known Limitations

- SAFER lookup is manual only; there is no FMCSA API integration, scraping automation, or background refresh.
- Safety scores are manually entered and should be treated as internal tracking unless a source label is provided.
- In-app notifications exist, but SMS and email reminder delivery are not implemented yet.
- Background jobs for expiring document reminders are not implemented yet.
- Compliance task assignment depends on existing users and does not yet include advanced workload routing.
- Inspection reports do not yet calculate CSA or BASIC impacts.
- Safety coaching recommendations are manually written; no automated coaching engine is included.
- Public upload links require the production environment to include the server-only Supabase service role key.
- Migrations must be applied in Supabase before production use of each new module.
- Browser visual QA may still require manual screenshots where automated browser tooling is unavailable.

## Manual QA Checklist

Admin/staff setup:

- Sign in as an organization admin or staff user.
- Open a carrier profile.
- Create a Carrier Intake Upload Link.
- Confirm the link label and helper text indicate that multiple requested documents can be uploaded until expiration or revocation.
- Copy the link.

Public carrier intake:

- Open the link in a logged-out or separate browser session.
- Confirm the page does not redirect to `/login`.
- Upload a carrier/company document.
- Refresh the public upload page and confirm the uploaded status remains visible.
- Upload a second carrier/company document using the same link.
- If driver or vehicle scope is enabled, upload one DQ document and one vehicle document.
- Confirm expired or revoked links show a clear access error.

Database and storage checks:

- Confirm document rows are saved in the expected existing document tables.
- Confirm storage paths start with the correct `organizations/{organizationId}/...` prefix.
- Confirm upload link status updates without blocking additional uploads.
- Confirm audit logs include `public_document.uploaded` and upload link activity.

Onboarding progress:

- Return to the carrier profile.
- Confirm onboarding progress reflects newly uploaded documents.
- Confirm missing and expiring items are still visible.
- Confirm carrier roster/list progress badges update.
- Confirm dashboard onboarding counts update.

Compliance alerts and tasks:

- Open Compliance Alerts.
- Confirm missing, expired, expiring, and readiness risk alerts appear.
- Use alert filters for carrier, driver, vehicle, critical only, and expiring within 30 days.
- Create a task from an alert.
- Open Compliance Tasks and confirm the task appears.
- Mark a task complete and confirm dashboard task metrics update.

Notifications:

- Open Notifications.
- Confirm compliance-related notifications are scoped to the organization.
- Mark one notification read.
- Mark all notifications read.
- Confirm unread counts update.

Inspection reports:

- Create an inspection report.
- Add violations, out-of-service status, location, and notes.
- Upload inspection evidence.
- Link an inspection finding to a compliance task.
- Confirm the inspection appears in dashboard/profile summaries where applicable.

Safety scores, trends, and coaching:

- Create a manual safety score for a carrier.
- Add a second score with changed inspection, violation, or out-of-service counts.
- Confirm the trend classification updates.
- Create a safety coaching item linked to the carrier and safety score.
- Link the coaching item to a compliance task.
- Mark the coaching item completed and confirm dashboard counts update.

SAFER lookup:

- Open SAFER Lookup.
- Enter a DOT number and optional MC number.
- Fill the manual snapshot fields.
- Save the snapshot.
- Attach it to a carrier.
- Confirm the carrier profile shows the latest snapshot and date.
- Confirm dashboard missing/outdated SAFER snapshot counts update.

Access control:

- Sign in as a carrier user.
- Confirm the carrier only sees their allowed carrier, documents, inspections, tasks, and notifications.
- Attempt to open another carrier record by direct URL and confirm access is denied or not found.
- Confirm public upload tokens do not expose unrelated carrier, driver, equipment, or organization data.

Responsive layout:

- Check dashboard, carrier profile, public upload page, alerts, tasks, inspections, safety scores, coaching, and SAFER lookup on desktop.
- Repeat a spot check on tablet and mobile widths.
- Confirm forms, tables, upload controls, and action buttons remain usable.

## Future Roadmap

Recommended next work:

- Research FMCSA/SAFER public data options and usage limits.
- Add automated SAFER snapshot refresh if a reliable compliant data source is selected.
- Add inspection trend charts from stored inspection reports.
- Add CSA/BASIC-style monitoring where reliable data is available.
- Add safety coaching templates and improvement playbooks.
- Add email and SMS reminder delivery for expiring documents and overdue tasks.
- Add scheduled reminder generation/background jobs.
- Add no-login upload link enhancements, including requested-document templates and admin resend flows.
- Add driver logs/HOS module.
- Add pre-trip and post-trip inspection workflows.
- Add inspection reports enhancements for photos, signatures, and corrective action evidence.
- Add Safety Score Tracking dashboards with richer historical charts.
- Add Safety Coaching progress analytics.
- Add DataQs planning and workflows after inspection and safety score foundations are stable.
