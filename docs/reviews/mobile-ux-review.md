# Phase 2.4 Mobile UX Review

## UX Issues Found

- Admin dashboard had too many secondary metrics visible at once, which made the first screen feel like a report instead of a command center.
- The most important admin actions were spread across sidebar routes instead of being available as a fast action row.
- Carrier users landed in the same dense dashboard structure as admins, making upload and compliance follow-up harder to find.
- Carrier roster relied on a wide desktop table, which is hard to scan on mobile.
- Carrier onboarding category detail was always expanded, adding vertical weight to the carrier profile.
- Public carrier intake packet had saved upload status, but the completion state and mobile upload controls needed stronger visual hierarchy.

## Mobile Issues Found

- Wide roster tables required horizontal scrolling on small screens.
- Public upload rows had multiple controls in a dense grid that could feel cramped on 390px screens.
- Top dashboard metrics were too tall and too numerous for mobile scanning.
- Carrier workflow actions were not visually prioritized enough after login.
- Some secondary dashboard information competed with urgent compliance issues and task counts.

## Improvements Made

- Added a compact Quick Actions row on the dashboard for:
  - Add Carrier
  - Create Upload Link
  - Add Driver
  - Add Vehicle
  - Create Task
  - Add Inspection
  - Add Safety Score
  - Add Coaching Record
- Added a carrier-first priority panel on the dashboard with:
  - Onboarding percentage
  - Missing document count
  - Expiring document count
  - Alert count
  - Large Upload Documents action
- Reduced visible dashboard metric density by keeping primary compliance metrics visible and moving secondary metrics into a collapsed "More compliance metrics" section.
- Made KPI cards shorter and easier to scan.
- Kept the sticky Action Center but reduced height and spacing.
- Added mobile carrier roster cards while preserving the desktop table.
- Simplified carrier sidebar priorities to:
  - Dashboard
  - Upload Documents
  - My Compliance
  - Compliance Alerts
  - Compliance Tasks
  - Notifications
- Converted carrier onboarding progress category details into expandable sections.
- Improved public upload packet progress with a completion bar and clearer uploaded/needed row styling.
- Improved public upload packet mobile layout by stacking upload controls cleanly and increasing touch target height.

## Remaining Recommendations

- Add visual loading skeletons to dashboard cards and upload-heavy pages once async loading boundaries are standardized.
- Continue converting large history tables into mobile cards on detail-heavy pages such as Safety Scores history and inspection detail records.
- Add per-page success/error toast consistency after a shared toast system is selected.
- Consider a dedicated carrier home route in a later phase if carrier workflows continue to diverge from admin workflows.
- Add manual browser screenshots after test credentials are available because automated Playwright QA is currently blocked by the local Windows sandbox issue.

## Screenshot Checklist For Manual QA

Capture each view at:

- Desktop: 1440px
- Tablet: 768px
- Mobile: 390px

Views to capture:

- Dashboard overview
- Dashboard lower tabs
- Carrier dashboard state
- Carrier profile
- Carrier compliance document section
- Public upload link page
- Driver Files / DQ Files
- Vehicle Files / Vehicle Maintenance
- Compliance Alerts
- Compliance Tasks
- Notifications
- Inspection Reports
- Safety Scores
- Safety Coaching
- SAFER Lookup

Check each screenshot for:

- Horizontal overflow
- Cramped or clipped buttons
- Sticky Action Center covering content
- Tables that should become mobile cards
- Upload controls that are too small for touch
- Empty states that do not explain the next action
- Error or success states that are hard to see
- Onboarding progress badges and percentages
- Uploaded public intake items still visible after refresh
