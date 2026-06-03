"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculateCarrierAuditReadiness = calculateCarrierAuditReadiness;
exports.readinessBand = readinessBand;
const CATEGORY_LIMITS = {
    carrierDocuments: 35,
    driverDocuments: 25,
    equipmentDocuments: 20,
    complianceAlerts: 15,
    criticalBlocker: 5,
};
const CRITICAL_CARRIER_DOCUMENTS = new Set([
    "certificate of insurance",
    "operating authority",
    "drug & alcohol consortium",
]);
const CRITICAL_DRIVER_DOCUMENTS = new Set([
    "cdl",
    "medical card",
    "medical examiner certificate",
    "driver qualification file",
]);
const CRITICAL_EQUIPMENT_DOCUMENTS = new Set([
    "annual inspection",
    "vehicle registration",
]);
function calculateCarrierAuditReadiness(input) {
    var _a, _b, _c;
    const carrierDocuments = Object.entries(input.carrier.documents).map(([name, document]) => ({
        name,
        uploaded: document.uploaded,
        status: documentStatus(document.uploaded, document.expirationDate),
        expirationDate: document.expirationDate,
        scope: "carrier",
    }));
    const driverDocuments = (_a = input.driverDocuments) !== null && _a !== void 0 ? _a : [];
    const equipmentDocuments = (_b = input.equipmentDocuments) !== null && _b !== void 0 ? _b : [];
    const complianceAlerts = (_c = input.complianceAlerts) !== null && _c !== void 0 ? _c : [];
    const carrierDeductions = documentDeductions(carrierDocuments, "carrierDocuments");
    const driverDeductions = documentDeductions(driverDocuments, "driverDocuments");
    const equipmentDeductions = documentDeductions(equipmentDocuments, "equipmentDocuments");
    const alertDeductions = complianceAlertDeductions(complianceAlerts);
    const criticalBlockers = findCriticalBlockers(carrierDocuments, driverDocuments, equipmentDocuments, input.carrier.status);
    const criticalDeductions = criticalBlockers.length
        ? [{
                category: "criticalBlocker",
                label: "Critical audit blocker present",
                points: CATEGORY_LIMITS.criticalBlocker,
                severity: "critical",
            }]
        : [];
    const categoryBreakdown = {
        carrierDocuments: cappedPoints(carrierDeductions, CATEGORY_LIMITS.carrierDocuments),
        driverDocuments: cappedPoints(driverDeductions, CATEGORY_LIMITS.driverDocuments),
        equipmentDocuments: cappedPoints(equipmentDeductions, CATEGORY_LIMITS.equipmentDocuments),
        complianceAlerts: cappedPoints(alertDeductions, CATEGORY_LIMITS.complianceAlerts),
        criticalBlocker: cappedPoints(criticalDeductions, CATEGORY_LIMITS.criticalBlocker),
    };
    const totalDeductions = Object.values(categoryBreakdown).reduce((total, value) => total + value, 0);
    const score = Math.max(0, Math.min(100, 100 - totalDeductions));
    return {
        carrierId: input.carrier.id,
        carrierName: input.carrier.companyName,
        score,
        band: readinessBand(score),
        criticalBlockers,
        deductions: [
            ...carrierDeductions,
            ...driverDeductions,
            ...equipmentDeductions,
            ...alertDeductions,
            ...criticalDeductions,
        ],
        nextExpiringDocument: nextExpiringDocument([...carrierDocuments, ...driverDocuments, ...equipmentDocuments]),
        categoryBreakdown,
    };
}
function readinessBand(score) {
    if (score >= 90)
        return "Audit Ready";
    if (score >= 80)
        return "Strong";
    if (score >= 70)
        return "Needs Review";
    if (score >= 50)
        return "High Risk";
    return "Audit Blocked";
}
function documentDeductions(documents, category) {
    return documents.flatMap((document) => {
        const deductions = [];
        const label = document.ownerName ? `${document.ownerName}: ${document.name}` : document.name;
        if (!document.uploaded || document.status === "missing") {
            deductions.push({ category, label: `${label} missing`, points: missingPoints(category, document.name), severity: "high" });
        }
        if (document.status === "expired" || isExpired(document.expirationDate)) {
            deductions.push({ category, label: `${label} expired`, points: expiredPoints(category, document.name), severity: "critical" });
        }
        if (document.status === "expiring_soon" || isExpiringSoon(document.expirationDate)) {
            deductions.push({ category, label: `${label} expiring soon`, points: expiringPoints(category), severity: "medium" });
        }
        return deductions;
    });
}
function complianceAlertDeductions(alerts) {
    return alerts
        .filter((alert) => alert.status !== "resolved")
        .map((alert) => {
        const basePoints = alertPoints(alert.severity);
        const acknowledgedMultiplier = alert.status === "acknowledged" ? 0.5 : 1;
        const points = Math.ceil(basePoints * acknowledgedMultiplier);
        return {
            category: "complianceAlerts",
            label: alert.title,
            points,
            severity: normalizeSeverity(alert.severity),
        };
    });
}
function findCriticalBlockers(carrierDocuments, driverDocuments, equipmentDocuments, carrierStatus) {
    const blockers = [
        ...criticalDocumentBlockers(carrierDocuments, CRITICAL_CARRIER_DOCUMENTS),
        ...criticalDocumentBlockers(driverDocuments, CRITICAL_DRIVER_DOCUMENTS),
        ...criticalDocumentBlockers(equipmentDocuments, CRITICAL_EQUIPMENT_DOCUMENTS),
    ];
    if (carrierStatus === "Suspended") {
        blockers.push("Carrier is suspended");
    }
    return blockers;
}
function criticalDocumentBlockers(documents, criticalNames) {
    return documents
        .filter((document) => criticalNames.has(normalizeName(document.name)) &&
        (!document.uploaded || document.status === "missing" || document.status === "expired" || isExpired(document.expirationDate)))
        .map((document) => document.ownerName ? `${document.ownerName}: ${document.name}` : document.name);
}
function nextExpiringDocument(documents) {
    var _a;
    const upcoming = documents
        .map((document) => {
        var _a;
        const days = daysUntilExpiration(document.expirationDate);
        return document.expirationDate && days !== null && days >= 0
            ? {
                name: document.name,
                scope: document.scope,
                ownerName: (_a = document.ownerName) !== null && _a !== void 0 ? _a : "Carrier",
                expirationDate: document.expirationDate,
                daysUntilExpiration: days,
            }
            : null;
    })
        .filter((document) => Boolean(document))
        .sort((a, b) => a.daysUntilExpiration - b.daysUntilExpiration);
    return (_a = upcoming[0]) !== null && _a !== void 0 ? _a : null;
}
function cappedPoints(deductions, limit) {
    return Math.min(limit, deductions.reduce((total, deduction) => total + deduction.points, 0));
}
function missingPoints(category, documentName) {
    if (category === "carrierDocuments")
        return CRITICAL_CARRIER_DOCUMENTS.has(normalizeName(documentName)) ? 8 : 4;
    if (category === "driverDocuments")
        return CRITICAL_DRIVER_DOCUMENTS.has(normalizeName(documentName)) ? 8 : 4;
    if (category === "equipmentDocuments")
        return CRITICAL_EQUIPMENT_DOCUMENTS.has(normalizeName(documentName)) ? 8 : 4;
    return 0;
}
function expiredPoints(category, documentName) {
    if (category === "carrierDocuments")
        return CRITICAL_CARRIER_DOCUMENTS.has(normalizeName(documentName)) ? 10 : 6;
    if (category === "driverDocuments")
        return CRITICAL_DRIVER_DOCUMENTS.has(normalizeName(documentName)) ? 10 : 6;
    if (category === "equipmentDocuments")
        return CRITICAL_EQUIPMENT_DOCUMENTS.has(normalizeName(documentName)) ? 10 : 8;
    return 0;
}
function expiringPoints(category) {
    if (category === "carrierDocuments")
        return 3;
    if (category === "driverDocuments")
        return 2;
    if (category === "equipmentDocuments")
        return 2;
    return 0;
}
function alertPoints(severity) {
    if (severity === "critical")
        return 8;
    if (severity === "high")
        return 5;
    if (severity === "low")
        return 1;
    return 3;
}
function normalizeSeverity(severity) {
    if (severity === "critical" || severity === "high" || severity === "low")
        return severity;
    return "medium";
}
function isExpired(expirationDate) {
    const days = daysUntilExpiration(expirationDate);
    return days !== null && days < 0;
}
function isExpiringSoon(expirationDate) {
    const days = daysUntilExpiration(expirationDate);
    return days !== null && days >= 0 && days <= 30;
}
function normalizeName(name) {
    return name.trim().toLowerCase();
}
function daysUntilExpiration(dateString) {
    if (!dateString)
        return null;
    const expiration = new Date(`${dateString}T12:00:00`);
    const today = new Date("2026-05-18T12:00:00");
    return Math.ceil((expiration.getTime() - today.getTime()) / 86400000);
}
function documentStatus(uploaded, expirationDate) {
    if (!uploaded)
        return "missing";
    const days = daysUntilExpiration(expirationDate);
    if (days === null)
        return "valid";
    if (days < 0)
        return "expired";
    if (days <= 30)
        return "expiring_soon";
    return "valid";
}
