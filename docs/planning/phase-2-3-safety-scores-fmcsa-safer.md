# Phase 2.3 Planning: Safety Scores & FMCSA / SAFER Monitoring

## Goal

Build a future Safety Scores module that helps Manifest monitor carrier safety posture, inspection trends, violations, out-of-service events, and improvement opportunities.

The module should give operators a clear compliance-focused view of safety risk without replacing official FMCSA records. Scores, trends, and recommendations should be labeled by source and date so Manifest can distinguish official data, manual entry, uploaded inspection evidence, and internal coaching notes.

## Stakeholder Direction

- Inspection Reports should come before Safety Scores.
- Safety Scores should eventually use SAFER/FMCSA data where possible.
- The system should support charts, trends, coaching, and improvement tracking.
- Safety Scores should remain compliance-focused and should not crowd the current dashboard until the inspection workflow is stable.
- Any future automation should preserve tenant isolation, carrier scoping, and the existing compliance document architecture.

## Data Sources To Research

- FMCSA SAFER
- FMCSA SMS / BASICs
- FMCSA public datasets
- Manual inspection reports already entered into the system
- Uploaded inspection documents

## Data Points To Track

- DOT number
- MC number
- Power units
- Drivers
- Inspection count
- Violation count
- Out-of-service events
- Crash indicators, if available
- BASIC categories, if available
- Safety trend over time
- Corrective actions
- Coaching notes

## Proposed Future Pages

- Safety Scores dashboard
- Carrier safety profile
- Inspection trends
- Violation trends
- Coaching/action plan
- Safety score history

## Risks And Limitations

- SAFER may not provide all score data directly.
- Some FMCSA data may require manual updates.
- Scraping may be unreliable, restricted, or brittle.
- Data freshness matters because stale safety information can mislead operators.
- Safety scores must be clearly labeled as sourced or manually entered.
- Public FMCSA data availability, formats, rate limits, and terms may change.
- Official safety data should not be presented as real-time unless the integration can prove freshness.
- Coaching recommendations should be treated as operational guidance, not official legal or regulatory determinations.

## Recommended Phased Approach

### Phase A: Manual Safety Score Entry And Tracking

- Add manual fields for safety score snapshots only after schema planning is approved.
- Track source, date collected, score category, notes, and entered-by user.
- Allow Manifest staff to record safety observations and corrective action notes.
- Keep this separate from official FMCSA integration until source behavior is confirmed.

Complexity: Medium

### Phase B: Charts From Existing Inspection Reports

- Reuse inspection reports already entered into ManifestOS.
- Chart inspection count, violation count, and out-of-service events over time.
- Add carrier-level trend summaries based on existing inspection records.
- Surface carriers with repeated violations or unresolved inspection tasks.

Complexity: Medium

### Phase C: FMCSA/SAFER Lookup Research And Integration

- Research official FMCSA/SAFER data access options, public datasets, terms, and update cadence.
- Prefer stable public datasets or official API-like access where available.
- Avoid brittle scraping unless explicitly approved and legally reviewed.
- Store source metadata, lookup timestamp, and freshness indicators.

Complexity: High

### Phase D: Coaching Recommendations And Improvement Analytics

- Use inspection trends, violation patterns, and corrective actions to produce coaching prompts.
- Track improvement plans and follow-up tasks.
- Connect safety coaching to Compliance Tasks once the data model is stable.
- Add history views to show whether safety posture is improving.

Complexity: High

## Non-Scope For This Planning Phase

- Do not create tables.
- Do not create routes.
- Do not change dashboard logic.
- Do not change RLS.
- Do not add external integrations.
- Do not scrape FMCSA/SAFER.
- Do not change inspection report behavior.
