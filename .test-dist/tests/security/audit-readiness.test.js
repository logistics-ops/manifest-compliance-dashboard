"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const strict_1 = __importDefault(require("node:assert/strict"));
const node_test_1 = __importDefault(require("node:test"));
const audit_readiness_1 = require("../../lib/audit-readiness");
const baseCarrier = {
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
(0, node_test_1.default)("audit readiness returns audit-ready score for clean records", () => {
    const result = (0, audit_readiness_1.calculateCarrierAuditReadiness)({
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
    strict_1.default.equal(result.score, 100);
    strict_1.default.equal(result.band, "Audit Ready");
    strict_1.default.deepEqual(result.criticalBlockers, []);
});
(0, node_test_1.default)("audit readiness applies category caps and critical blocker penalty", () => {
    const result = (0, audit_readiness_1.calculateCarrierAuditReadiness)({
        carrier: Object.assign(Object.assign({}, baseCarrier), { documents: Object.assign(Object.assign({}, baseCarrier.documents), { "Certificate of Insurance": { uploaded: false, expirationDate: null } }) }),
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
    strict_1.default.equal(result.categoryBreakdown.criticalBlocker, 5);
    strict_1.default.ok(result.categoryBreakdown.carrierDocuments <= 35);
    strict_1.default.ok(result.categoryBreakdown.driverDocuments <= 25);
    strict_1.default.ok(result.categoryBreakdown.equipmentDocuments <= 20);
    strict_1.default.ok(result.categoryBreakdown.complianceAlerts <= 15);
    strict_1.default.ok(result.criticalBlockers.length >= 3);
    strict_1.default.equal(result.band, "Audit Blocked");
});
