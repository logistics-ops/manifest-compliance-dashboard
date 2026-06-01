import { ComplianceDashboard, type ExecutiveOverviewData } from "@/components/compliance-dashboard";
import { getOrganizationAuditLogs } from "@/lib/audit";
import { getCarrierDocuments, isHighRisk } from "@/lib/compliance";
import { getAuditReadinessDashboardData } from "@/lib/data/audit-readiness";
import { getCarriers } from "@/lib/data/carriers";
import { getDQFiles } from "@/lib/data/dq-files";
import { getInvoices } from "@/lib/data/invoices";
import { getLoads } from "@/lib/data/loads";
import { getNotifications } from "@/lib/data/notifications";
import { getCurrentOrganizationBranding } from "@/lib/data/organizations";
import { getVehicles } from "@/lib/data/vehicles";
import { requireStaffAccess } from "@/lib/integrations/auth";
import type { ComplianceNotification, Carrier } from "@/types/carrier";
import type { Invoice } from "@/types/invoice";
import type { Load } from "@/types/load";
import type { AuditReadinessDashboardData } from "@/lib/data/audit-readiness";
import type { DQFileRecord } from "@/lib/data/dq-files";
import type { VehicleRecord } from "@/lib/data/vehicles";

export default async function Home() {
  const session = await requireStaffAccess();
  const [carriers, auditReadiness, dqFiles, vehicles, loads, invoices, branding, auditLogs] = await Promise.all([
    getCarriers(),
    getAuditReadinessDashboardData(),
    getDQFiles(),
    getVehicles(),
    getLoads(),
    getInvoices(),
    getCurrentOrganizationBranding(),
    getOrganizationAuditLogs(40),
  ]);
  const notifications = await getNotifications(carriers);
  const executiveOverview = buildExecutiveOverview({
    carriers,
    auditReadiness,
    dqFiles,
    vehicles,
    loads,
    invoices,
    notifications,
  });

  return (
    <ComplianceDashboard
      carriers={carriers}
      notifications={notifications}
      auditLogs={auditLogs}
      session={session}
      branding={branding}
      executiveOverview={executiveOverview}
    />
  );
}

function buildExecutiveOverview({
  carriers,
  auditReadiness,
  dqFiles,
  vehicles,
  loads,
  invoices,
  notifications,
}: {
  carriers: Carrier[];
  auditReadiness: AuditReadinessDashboardData;
  dqFiles: DQFileRecord[];
  vehicles: VehicleRecord[];
  loads: Load[];
  invoices: Invoice[];
  notifications: ComplianceNotification[];
}): ExecutiveOverviewData {
  const dqReadinessAverage = average(dqFiles.map((file) => file.readinessPercentage));
  const vehicleReadinessAverage = average(vehicles.map((vehicle) => vehicle.readinessPercentage));
  const driversNeedingAttention = dqFiles.filter((file) => file.missingCount || file.expiredCount || file.expiringSoonCount).length;
  const vehiclesNeedingAttention = vehicles.filter(
    (vehicle) => vehicle.missingCount || vehicle.expiredCount || vehicle.expiringSoonCount || vehicle.criticalBlockers.length,
  ).length;
  const openComplianceAlerts = notifications.filter(
    (notification) =>
      notification.status !== "dismissed" &&
      ["document_expiration", "missing_document", "expired_document", "expired_insurance", "high_risk_carrier"].includes(notification.category),
  ).length;
  const carrierDocuments = carriers.flatMap((carrier) =>
    getCarrierDocuments(carrier).map((document) => ({
      carrierName: carrier.companyName,
      documentName: document.name,
      status: document.status,
      daysUntilExpiration: document.daysUntilExpiration,
    })),
  );
  const expiringCarrierDocuments = carrierDocuments.filter(
    (document) => document.daysUntilExpiration !== null && document.daysUntilExpiration >= 0 && document.daysUntilExpiration <= 30,
  ).length;
  const expiringDocuments =
    expiringCarrierDocuments +
    dqFiles.reduce((total, file) => total + file.expiringSoonCount, 0) +
    vehicles.reduce((total, vehicle) => total + vehicle.expiringSoonCount, 0);
  const totalCriticalBlockers =
    auditReadiness.totalCriticalBlockers +
    vehicles.reduce((total, vehicle) => total + vehicle.criticalBlockers.length, 0);

  return {
    organizationAuditReadinessAverage: auditReadiness.organizationScore,
    dqReadinessAverage,
    vehicleReadinessAverage,
    totalCriticalBlockers,
    driversNeedingAttention,
    vehiclesNeedingAttention,
    expiringDocuments,
    openComplianceAlerts,
    loadCount: loads.length,
    invoiceTotals: {
      count: invoices.length,
      totalAmount: invoices.reduce((total, invoice) => total + invoice.totalAmount, 0),
      outstandingAmount: invoices
        .filter((invoice) => !["paid", "void"].includes(invoice.status))
        .reduce((total, invoice) => total + invoice.totalAmount, 0),
      paidAmount: invoices.filter((invoice) => invoice.status === "paid").reduce((total, invoice) => total + invoice.totalAmount, 0),
      overdueCount: invoices.filter((invoice) => invoice.status === "overdue").length,
    },
    needsAttention: {
      carriers: auditReadiness.results
        .filter((result) => result.criticalBlockers.length || result.score < 80 || carriers.some((carrier) => carrier.id === result.carrierId && isHighRisk(carrier)))
        .slice(0, 6)
        .map((result) => `${result.carrierName}: ${result.score}% ${result.band}${result.criticalBlockers.length ? ` · ${result.criticalBlockers[0]}` : ""}`),
      drivers: dqFiles
        .filter((file) => file.missingCount || file.expiredCount || file.expiringSoonCount)
        .sort((a, b) => b.expiredCount - a.expiredCount || b.missingCount - a.missingCount || a.readinessPercentage - b.readinessPercentage)
        .slice(0, 6)
        .map((file) => `${file.driverName || "Unnamed driver"}: ${file.readinessPercentage}% · ${file.missingCount} missing, ${file.expiredCount} expired`),
      vehicles: vehicles
        .filter((vehicle) => vehicle.missingCount || vehicle.expiredCount || vehicle.expiringSoonCount || vehicle.criticalBlockers.length)
        .sort((a, b) => b.criticalBlockers.length - a.criticalBlockers.length || b.expiredCount - a.expiredCount || a.readinessPercentage - b.readinessPercentage)
        .slice(0, 6)
        .map((vehicle) => `Unit ${vehicle.unitNumber}: ${vehicle.readinessPercentage}% · ${vehicle.criticalBlockers[0] ?? `${vehicle.missingCount} missing, ${vehicle.expiredCount} expired`}`),
      documents: [
        ...carrierDocuments
          .filter((document) => ["Missing", "Expired", "Expiring Soon"].includes(document.status))
          .slice(0, 4)
          .map((document) => `${document.carrierName}: ${document.documentName} is ${document.status.toLowerCase()}`),
        ...dqFiles
          .flatMap((file) =>
            file.checklist
              .filter((item) => item.missing || item.expired || item.expiringSoon)
              .map((item) => `${file.driverName || "Unnamed driver"}: ${item.name} is ${item.status.replace(/_/g, " ")}`),
          )
          .slice(0, 2),
        ...vehicles
          .flatMap((vehicle) =>
            vehicle.checklist
              .filter((item) => item.missing || item.expired || item.expiringSoon)
              .map((item) => `Unit ${vehicle.unitNumber}: ${item.name} is ${item.status.replace(/_/g, " ")}`),
          )
          .slice(0, 2),
      ].slice(0, 6),
      alerts: notifications
        .filter((notification) => notification.status !== "dismissed")
        .sort((a, b) => priorityRank(b.priority) - priorityRank(a.priority))
        .slice(0, 6)
        .map((notification) => `${notification.title}: ${notification.message}`),
    },
  };
}

function average(values: number[]) {
  return values.length ? Math.round(values.reduce((total, value) => total + value, 0) / values.length) : 0;
}

function priorityRank(priority: ComplianceNotification["priority"]) {
  return { low: 1, medium: 2, high: 3, critical: 4 }[priority];
}
