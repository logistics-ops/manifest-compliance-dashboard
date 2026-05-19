import type { AuthSession, UserRole } from "@/types/carrier";

export type TenantRecord = {
  organizationId: string | null;
};

export type CarrierAccessRecord = TenantRecord & {
  carrierId: string;
};

export type NotificationAccessRecord = TenantRecord & {
  carrierId: string | null;
  assignedTo: string | null;
};

export type LoadAccessRecord = TenantRecord & {
  carrierId: string;
};

export type InvoiceAccessRecord = LoadAccessRecord;

export type AuditLogAccessRecord = TenantRecord & {
  action: string;
};

export const staffAuditActions = new Set([
  "carrier.created",
  "carrier.updated",
  "carrier.status_changed",
  "document.metadata_updated",
  "document.uploaded",
  "document.replaced",
  "document.expiration_changed",
  "compliance_note.added",
  "notification.read",
  "notification.dismissed",
  "notification.assigned",
  "notification.synced",
  "email.weekly_summary_requested",
  "onboarding.carrier_created",
  "onboarding.carrier_user_invited",
  "load.created",
  "load.updated",
  "load.status_changed",
  "load.rate_confirmation_uploaded",
  "load.pod_uploaded",
  "load.pod_sent",
  "load.archive_exported",
  "load.archive_downloaded",
  "load.archive_status_changed",
  "load.archive_files_deleted",
  "invoice.generated",
  "invoice.sent",
  "invoice.resent",
  "invoice.paid",
  "invoice.voided",
  "invoice.downloaded",
]);

export function canRoleAccessDashboard(role: UserRole, platformSuperAdmin = false) {
  return platformSuperAdmin || role === "admin" || role === "staff";
}

export function canRoleManageCarriers(role: UserRole, platformSuperAdmin = false) {
  return platformSuperAdmin || role === "admin";
}

export function canRoleManageCompliance(role: UserRole, platformSuperAdmin = false) {
  return platformSuperAdmin || role === "admin" || role === "staff";
}

export function canAccessOrganizationRecord(
  session: AuthSession | null,
  organizationId: string | null,
  organizationIsActive = true,
) {
  if (!session || !organizationId) return false;
  if (session.platformSuperAdmin) return true;
  return organizationIsActive && session.organizationId === organizationId;
}

export function canAccessCarrierRecord(
  session: AuthSession | null,
  carrier: CarrierAccessRecord,
  organizationIsActive = true,
) {
  if (!session) return false;
  if (session.platformSuperAdmin) return true;
  if (!canAccessOrganizationRecord(session, carrier.organizationId, organizationIsActive)) return false;
  if (canRoleAccessDashboard(session.role)) return true;
  return session.role === "carrier" && session.carrierId === carrier.carrierId;
}

export function canUploadCarrierDocument(
  session: AuthSession | null,
  carrier: CarrierAccessRecord,
  organizationIsActive = true,
) {
  if (!session) return false;
  if (session.platformSuperAdmin) return true;
  if (!canAccessOrganizationRecord(session, carrier.organizationId, organizationIsActive)) return false;
  if (canRoleManageCompliance(session.role)) return true;
  return session.role === "carrier" && session.carrierId === carrier.carrierId;
}

export function canAccessLoadRecord(
  session: AuthSession | null,
  load: LoadAccessRecord,
  organizationIsActive = true,
) {
  if (!session) return false;
  if (session.platformSuperAdmin) return true;
  if (!canAccessOrganizationRecord(session, load.organizationId, organizationIsActive)) return false;
  if (canRoleManageCompliance(session.role)) return true;
  return session.role === "carrier" && session.carrierId === load.carrierId;
}

export function canManageLoadRecord(
  session: AuthSession | null,
  load: LoadAccessRecord,
  organizationIsActive = true,
) {
  if (!session) return false;
  if (session.platformSuperAdmin) return true;
  return canRoleManageCompliance(session.role) && canAccessOrganizationRecord(session, load.organizationId, organizationIsActive);
}

export function canCreateLoadRecord(
  session: AuthSession | null,
  load: LoadAccessRecord,
  organizationIsActive = true,
) {
  if (!session) return false;
  if (session.platformSuperAdmin) return true;
  if (!canAccessOrganizationRecord(session, load.organizationId, organizationIsActive)) return false;
  if (canRoleManageCompliance(session.role)) return true;
  return session.role === "carrier" && session.carrierId === load.carrierId;
}

export function canUploadLoadDocument(
  session: AuthSession | null,
  load: LoadAccessRecord,
  organizationIsActive = true,
) {
  return canAccessLoadRecord(session, load, organizationIsActive);
}

export function canUploadLoadDocumentType(
  session: AuthSession | null,
  load: LoadAccessRecord,
  documentType: "rate_confirmation" | "pod",
  organizationIsActive = true,
) {
  if (documentType === "rate_confirmation") {
    return canCreateLoadRecord(session, load, organizationIsActive);
  }

  return canUploadLoadDocument(session, load, organizationIsActive);
}

export function canManageLoadDocumentRecord(
  session: AuthSession | null,
  load: LoadAccessRecord,
  organizationIsActive = true,
) {
  return canCreateLoadRecord(session, load, organizationIsActive);
}

export function canExportLoadArchive(
  session: AuthSession | null,
  load: LoadAccessRecord,
  organizationIsActive = true,
) {
  return canAccessLoadRecord(session, load, organizationIsActive);
}

export function canAccessLoadTimeline(
  session: AuthSession | null,
  load: LoadAccessRecord,
  organizationIsActive = true,
) {
  return canAccessLoadRecord(session, load, organizationIsActive);
}

export function canExportOrganizationLoadArchive(session: AuthSession | null, organizationId: string | null) {
  if (!session) return false;
  if (session.platformSuperAdmin) return true;
  return canRoleManageCompliance(session.role) && canAccessOrganizationRecord(session, organizationId);
}

export function canDeleteArchivedLoadFiles(
  session: AuthSession | null,
  load: LoadAccessRecord,
  organizationIsActive = true,
) {
  return canManageLoadRecord(session, load, organizationIsActive);
}

export function canAccessInvoiceRecord(
  session: AuthSession | null,
  invoice: InvoiceAccessRecord,
  organizationIsActive = true,
) {
  return canAccessLoadRecord(session, invoice, organizationIsActive);
}

export function canGenerateInvoiceRecord(
  session: AuthSession | null,
  invoice: InvoiceAccessRecord,
  organizationIsActive = true,
) {
  return canCreateLoadRecord(session, invoice, organizationIsActive);
}

export function canSendInvoiceRecord(
  session: AuthSession | null,
  invoice: InvoiceAccessRecord,
  organizationIsActive = true,
) {
  return canCreateLoadRecord(session, invoice, organizationIsActive);
}

export function canUpdateInvoiceStatusRecord(
  session: AuthSession | null,
  invoice: InvoiceAccessRecord,
  organizationIsActive = true,
) {
  return canCreateLoadRecord(session, invoice, organizationIsActive);
}

export function getInvoiceStoragePrefix(organizationId: string, loadId: string) {
  return `${getLoadStoragePrefix(organizationId, loadId)}invoices/`;
}

export function isInvoiceStoragePath(storagePath: string, organizationId: string, loadId: string) {
  return storagePath.startsWith(getInvoiceStoragePrefix(organizationId, loadId));
}

export function assertInvoiceStoragePath(storagePath: string, organizationId: string, loadId: string) {
  if (!isInvoiceStoragePath(storagePath, organizationId, loadId)) {
    throw new Error("Invoice PDF path does not match the current organization and load.");
  }
}

export function canMutateTenantRecord(
  session: AuthSession | null,
  organizationId: string | null,
  allowedRoles: UserRole[],
  organizationIsActive = true,
) {
  if (!session) return false;
  if (session.platformSuperAdmin) return true;
  return allowedRoles.includes(session.role) && canAccessOrganizationRecord(session, organizationId, organizationIsActive);
}

export function canAccessNotificationRecord(
  session: AuthSession | null,
  notification: NotificationAccessRecord,
  organizationIsActive = true,
) {
  if (!session) return false;
  if (session.platformSuperAdmin) return true;
  if (!canAccessOrganizationRecord(session, notification.organizationId, organizationIsActive)) return false;
  if (canRoleManageCompliance(session.role)) return true;
  if (notification.assignedTo === session.userId) return true;
  return Boolean(notification.carrierId && session.role === "carrier" && session.carrierId === notification.carrierId);
}

export function canAccessAuditLogRecord(
  session: AuthSession | null,
  auditLog: AuditLogAccessRecord,
  organizationIsActive = true,
) {
  if (!session) return false;
  if (session.platformSuperAdmin) return true;
  if (!canAccessOrganizationRecord(session, auditLog.organizationId, organizationIsActive)) return false;
  if (session.role === "admin") return true;
  if (session.role === "staff") return staffAuditActions.has(auditLog.action);
  return false;
}

export function getTenantStoragePrefix(organizationId: string, carrierId: string) {
  return `organizations/${organizationId}/carriers/${carrierId}/`;
}

export function isTenantStoragePath(storagePath: string, organizationId: string, carrierId: string) {
  return storagePath.startsWith(getTenantStoragePrefix(organizationId, carrierId));
}

export function assertTenantStoragePath(storagePath: string, organizationId: string, carrierId: string) {
  if (!isTenantStoragePath(storagePath, organizationId, carrierId)) {
    throw new Error("Uploaded document path does not match the current organization.");
  }
}

export function getLoadStoragePrefix(organizationId: string, loadId: string) {
  return `organizations/${organizationId}/loads/${loadId}/`;
}

export function getLoadDocumentStoragePrefix(organizationId: string, loadId: string, documentType: string) {
  const folder = documentType === "rate_confirmation" ? "rate-confirmation" : documentType;
  return `${getLoadStoragePrefix(organizationId, loadId)}${folder}/`;
}

export function getLoadDocumentStorageFolder(documentType: "rate_confirmation" | "pod") {
  return documentType === "rate_confirmation" ? "rate-confirmation" : "pod";
}

export function isLoadStoragePath(storagePath: string, organizationId: string, loadId: string) {
  return storagePath.startsWith(getLoadStoragePrefix(organizationId, loadId));
}

export function isLoadDocumentStoragePath(
  storagePath: string,
  organizationId: string,
  loadId: string,
  documentType: string,
) {
  return storagePath.startsWith(getLoadDocumentStoragePrefix(organizationId, loadId, documentType));
}

export function assertLoadStoragePath(storagePath: string, organizationId: string, loadId: string) {
  if (!isLoadStoragePath(storagePath, organizationId, loadId)) {
    throw new Error("Uploaded load document path does not match the current organization and load.");
  }
}

export function assertLoadDocumentStoragePath(
  storagePath: string,
  organizationId: string,
  loadId: string,
  documentType: string,
) {
  if (!isLoadDocumentStoragePath(storagePath, organizationId, loadId, documentType)) {
    throw new Error("Uploaded load document path does not match the requested document type.");
  }
}
