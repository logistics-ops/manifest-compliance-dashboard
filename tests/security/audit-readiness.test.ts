import assert from "node:assert/strict";
import test from "node:test";
import { calculateCarrierAuditReadiness } from "../../lib/audit-readiness";
import type { Carrier } from "../../types/carrier";

const baseCarrier: Carrier = {
  id: "carrier-1",
  organizationId: "org-1",
  companyName: "Audit Ready Carrier",
  mcNumber: "MC-1",
  dotNumber: "DOT-1",
  contactName: "Ops",
  phone: "",
  email: "",
  status: "Active",
  notes: "",
  documents: {
    "Certificate of Insurance": { uploaded: true, expirationDate: "2027-01-01" },
    "W-9": { uploaded: true, expirationDate: null },
    "Operating Authority": { uploaded: true, expirationDate: null },
    "Drug & Alcohol Consortium": { uploaded: true, expirationDate: "2027-01-01" },
    "Driver Qualification File": { uploaded: true, expirationDate: "2027-01-01" },
    MVR: { uploaded: true, expirationDate: "2027-01-01" },
    "Medical Card": { uploaded: true, expirationDate: "2027-01-01" },
    CDL: { uploaded: true, expirationDate: "2028-01-01" },
    "Annual Inspection": { uploaded: true, expirationDate: "2027-01-01" },
    "Vehicle Registration": { uploaded: true, expirationDate: "2027-01-01" },
    "Lease Agreement": { uploaded: true, expirationDate: "2027-01-01" },
    "ELD setup confirmation": { uploaded: true, expirationDate: null },
  },
};

test("audit readiness returns audit-ready score for clean records", () => {
  const result = calculateCarrierAuditReadiness({
    carrier: baseCarrier,
    driverDocuments: [
      { name: "CDL", uploaded: true, status: "valid", expirationDate: "2028-01-01", scope: "driver", ownerName: "Driver One" },
      { name: "Medical Card", uploaded: true, status: "valid", expirationDate: "2027-01-01", scope: "driver", ownerName: "Driver One" },
    ],
    equipmentDocuments: [
      { name: "Annual Inspection", uploaded: true, status: "valid", expirationDate: "2027-01-01", scope: "equipment", ownerName: "Unit 100" },
    ],
    complianceAlerts: [],
  });

  assert.equal(result.score, 100);
  assert.equal(result.band, "Audit Ready");
  assert.deepEqual(result.criticalBlockers, []);
});

test("audit readiness applies category caps and critical blocker penalty", () => {
  const result = calculateCarrierAuditReadiness({
    carrier: {
      ...baseCarrier,
      documents: {
        ...baseCarrier.documents,
        "Certificate of Insurance": { uploaded: false, expirationDate: null },
      },
    },
    driverDocuments: [
      { name: "CDL", uploaded: false, status: "missing", expirationDate: null, scope: "driver", ownerName: "Driver One" },
      { name: "Medical Card", uploaded: true, status: "expired", expirationDate: "2026-01-01", scope: "driver", ownerName: "Driver One" },
    ],
    equipmentDocuments: [
      { name: "Annual Inspection", uploaded: false, status: "missing", expirationDate: null, scope: "equipment", ownerName: "Unit 100" },
      { name: "Vehicle Registration", uploaded: true, status: "expired", expirationDate: "2026-01-01", scope: "equipment", ownerName: "Unit 100" },
    ],
    complianceAlerts: [
      { title: "Critical alert", severity: "critical", status: "open" },
      { title: "High alert", severity: "high", status: "acknowledged" },
    ],
  });

  assert.equal(result.categoryBreakdown.criticalBlocker, 5);
  assert.ok(result.categoryBreakdown.carrierDocuments <= 35);
  assert.ok(result.categoryBreakdown.driverDocuments <= 25);
  assert.ok(result.categoryBreakdown.equipmentDocuments <= 20);
  assert.ok(result.categoryBreakdown.complianceAlerts <= 15);
  assert.ok(result.criticalBlockers.length >= 3);
  assert.equal(result.band, "Audit Blocked");
});
