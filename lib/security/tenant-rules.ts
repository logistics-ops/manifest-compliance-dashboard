import type { AuthSession, UserRole } from "@/types/carrier";

export type TenantRecord = {
  organizationId: string | null;
};

export type CarrierAccessRecord = TenantRecord & {
  carrierId: string;
};

export type DriverAccessRecord = CarrierAccessRecord & {
  driverId: string;
};

export type EquipmentAccessRecord = CarrierAccessRecord & {
  equipmentId: string;
};

export type NotificationAccessRecord = TenantRecord & {
  carrierId: string | null;
  assignedTo: string | null;
  userId?: string | null;
};

export type ComplianceTaskAccessRecord = TenantRecord & {
  relatedCarrierId: string | null;
  assignedTo: string | null;
};

export type UploadLinkAccessRecord = TenantRecord & {
  carrierId: string;
};

export type InspectionAccessRecord = TenantRecord & {
  carrierId: string;
};

export type LoadAccessRecord = TenantRecord & {
  carrierId: string;
};

export type InvoiceAccessRecord = LoadAccessRecord;

export type BrokerAccessRecord = TenantRecord & {
  linkedCarrierIds?: string[];
  requestedByCarrierId?: string | null;
};

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
  "driver_document.uploaded",
  "driver_document.replaced",
  "driver_document.expiration_changed",
  "vehicle_document.uploaded",
  "vehicle_document.replaced",
  "vehicle_document.expiration_changed",
  "compliance_task.created",
  "compliance_task.updated",
  "compliance_task.completed",
  "upload_link.created",
  "upload_link.revoked",
  "upload_link.used",
  "public_document.uploaded",
  "inspection.created",
  "inspection.updated",
  "inspection.document_uploaded",
  "inspection.task_linked",
  "inspection.alert_created",
  "compliance_note.added",
  "notification.read",
  "notification.read_all",
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
  "broker.created",
  "broker.updated",
  "broker.approved",
  "broker.blocked",
  "broker.review_required",
  "broker_check.requested",
  "broker.selected_on_load",
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

export function canManageDriverDocumentRecord(
  session: AuthSession | null,
  driver: DriverAccessRecord,
  organizationIsActive = true,
) {
  if (!session) return false;
  if (session.platformSuperAdmin) return true;
  if (!canAccessOrganizationRecord(session, driver.organizationId, organizationIsActive)) return false;
  if (canRoleManageCompliance(session.role)) return true;
  return session.role === "carrier" && session.carrierId === driver.carrierId;
}

export function canManageEquipmentDocumentRecord(
  session: AuthSession | null,
  equipment: EquipmentAccessRecord,
  organizationIsActive = true,
) {
  if (!session) return false;
  if (session.platformSuperAdmin) return true;
  if (!canAccessOrganizationRecord(session, equipment.organizationId, organizationIsActive)) return false;
  if (canRoleManageCompliance(session.role)) return true;
  return session.role === "carrier" && session.carrierId === equipment.carrierId;
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

export function getLoadQueryScope(session: AuthSession | null) {
  if (!session || session.platformSuperAdmin) {
    return { organizationId: null, carrierId: null };
  }

  return {
    organizationId: session.organizationId,
    carrierId: session.role === "carrier" ? session.carrierId : null,
  };
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

export function canAccessBrokerRecord(
  session: AuthSession | null,
  broker: BrokerAccessRecord,
  organizationIsActive = true,
) {
  if (!session) return false;
  if (session.platformSuperAdmin) return true;
  if (!canAccessOrganizationRecord(session, broker.organizationId, organizationIsActive)) return false;
  if (canRoleManageCompliance(session.role)) return true;
  if (session.role !== "carrier" || !session.carrierId) return false;
  if (broker.linkedCarrierIds) return broker.linkedCarrierIds.includes(session.carrierId);
  if (broker.requestedByCarrierId) return broker.requestedByCarrierId === session.carrierId;
  return true;
}

export function canManageBrokerRecord(session: AuthSession | null, organizationId: string | null, organizationIsActive = true) {
  if (!session) return false;
  if (session.platformSuperAdmin) return true;
  return canRoleManageCompliance(session.role) && canAccessOrganizationRecord(session, organizationId, organizationIsActive);
}

export function canCreateBrokerCheckRequest(
  session: AuthSession | null,
  organizationId: string | null,
  carrierId: string | null,
  organizationIsActive = true,
) {
  if (!session) return false;
  if (session.platformSuperAdmin) return true;
  if (!canAccessOrganizationRecord(session, organizationId, organizationIsActive)) return false;
  if (canRoleManageCompliance(session.role)) return true;
  return session.role === "carrier" && Boolean(session.carrierId) && session.carrierId === carrierId;
}

export function canViewOrganizationUsers(session: AuthSession | null, organizationId: string | null, organizationIsActive = true) {
  if (!session) return false;
  if (session.platformSuperAdmin) return true;
  return canRoleManageCompliance(session.role) && canAccessOrganizationRecord(session, organizationId, organizationIsActive);
}

export function canInviteOrganizationUsers(session: AuthSession | null, organizationId: string | null, organizationIsActive = true) {
  if (!session) return false;
  if (session.platformSuperAdmin) return true;
  return (session.role === "admin" || session.role === "staff") && canAccessOrganizationRecord(session, organizationId, organizationIsActive);
}

export function canManageOrganizationUsers(session: AuthSession | null, organizationId: string | null, organizationIsActive = true) {
  if (!session) return false;
  if (session.platformSuperAdmin) return true;
  return session.role === "admin" && canAccessOrganizationRecord(session, organizationId, organizationIsActive);
}

export function canAssignCarrierToUser(
  session: AuthSession | null,
  userOrganizationId: string | null,
  carrierOrganizationId: string | null,
  organizationIsActive = true,
) {
  if (!canManageOrganizationUsers(session, userOrganizationId, organizationIsActive) && !canInviteOrganizationUsers(session, userOrganizationId, organizationIsActive)) {
    return false;
  }
  if (!userOrganizationId || !carrierOrganizationId) return false;
  if (session?.platformSuperAdmin) return userOrganizationId === carrierOrganizationId;
  return session?.organizationId === userOrganizationId && userOrganizationId === carrierOrganizationId;
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
  if (notification.userId === session.userId) return true;
  return Boolean(notification.carrierId && session.role === "carrier" && session.carrierId === notification.carrierId);
}

export function canAccessComplianceTaskRecord(
  session: AuthSession | null,
  task: ComplianceTaskAccessRecord,
  organizationIsActive = true,
) {
  if (!session) return false;
  if (session.platformSuperAdmin) return true;
  if (!canAccessOrganizationRecord(session, task.organizationId, organizationIsActive)) return false;
  if (canRoleManageCompliance(session.role)) return true;
  return Boolean(
    session.role === "carrier" &&
      (session.userId === task.assignedTo || (session.carrierId !== null && session.carrierId === task.relatedCarrierId)),
  );
}

export function canManageComplianceTaskRecord(
  session: AuthSession | null,
  organizationId: string | null,
  organizationIsActive = true,
) {
  if (!session) return false;
  if (session.platformSuperAdmin) return true;
  return canRoleManageCompliance(session.role) && canAccessOrganizationRecord(session, organizationId, organizationIsActive);
}

export function canAccessInspectionRecord(
  session: AuthSession | null,
  inspection: InspectionAccessRecord,
  organizationIsActive = true,
) {
  if (!session) return false;
  if (session.platformSuperAdmin) return true;
  if (!canAccessOrganizationRecord(session, inspection.organizationId, organizationIsActive)) return false;
  if (canRoleManageCompliance(session.role)) return true;
  return session.role === "carrier" && session.carrierId === inspection.carrierId;
}

export function canManageInspectionRecord(
  session: AuthSession | null,
  inspection: InspectionAccessRecord,
  organizationIsActive = true,
) {
  if (!session) return false;
  if (session.platformSuperAdmin) return true;
  return canRoleManageCompliance(session.role) && canAccessOrganizationRecord(session, inspection.organizationId, organizationIsActive);
}

export function canUploadInspectionDocumentRecord(
  session: AuthSession | null,
  inspection: InspectionAccessRecord,
  organizationIsActive = true,
) {
  if (!session) return false;
  if (session.platformSuperAdmin) return true;
  if (!canAccessOrganizationRecord(session, inspection.organizationId, organizationIsActive)) return false;
  if (canRoleManageCompliance(session.role)) return true;
  return session.role === "carrier" && session.carrierId === inspection.carrierId;
}

export function canAccessUploadLinkRecord(
  session: AuthSession | null,
  uploadLink: UploadLinkAccessRecord,
  organizationIsActive = true,
) {
  if (!session) return false;
  if (session.platformSuperAdmin) return true;
  return canRoleManageCompliance(session.role) && canAccessOrganizationRecord(session, uploadLink.organizationId, organizationIsActive);
}

export function canManageUploadLinkRecord(
  session: AuthSession | null,
  uploadLink: UploadLinkAccessRecord,
  organizationIsActive = true,
) {
  return canAccessUploadLinkRecord(session, uploadLink, organizationIsActive);
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

export function getDriverDocumentStoragePrefix(organizationId: string, driverId: string) {
  return `organizations/${organizationId}/drivers/${driverId}/`;
}

export function isDriverDocumentStoragePath(storagePath: string, organizationId: string, driverId: string) {
  return storagePath.startsWith(getDriverDocumentStoragePrefix(organizationId, driverId));
}

export function assertDriverDocumentStoragePath(storagePath: string, organizationId: string, driverId: string) {
  if (!isDriverDocumentStoragePath(storagePath, organizationId, driverId)) {
    throw new Error("Uploaded driver document path does not match the current organization and driver.");
  }
}

export function getEquipmentDocumentStoragePrefix(organizationId: string, equipmentId: string) {
  return `organizations/${organizationId}/equipment/${equipmentId}/`;
}

export function isEquipmentDocumentStoragePath(storagePath: string, organizationId: string, equipmentId: string) {
  return storagePath.startsWith(getEquipmentDocumentStoragePrefix(organizationId, equipmentId));
}

export function assertEquipmentDocumentStoragePath(storagePath: string, organizationId: string, equipmentId: string) {
  if (!isEquipmentDocumentStoragePath(storagePath, organizationId, equipmentId)) {
    throw new Error("Uploaded vehicle document path does not match the current organization and equipment.");
  }
}

export function getInspectionStoragePrefix(organizationId: string, inspectionId: string) {
  return `organizations/${organizationId}/inspections/${inspectionId}/`;
}

export function isInspectionStoragePath(storagePath: string, organizationId: string, inspectionId: string) {
  return storagePath.startsWith(getInspectionStoragePrefix(organizationId, inspectionId));
}

export function assertInspectionStoragePath(storagePath: string, organizationId: string, inspectionId: string) {
  if (!isInspectionStoragePath(storagePath, organizationId, inspectionId)) {
    throw new Error("Uploaded inspection document path does not match the current organization and inspection.");
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
