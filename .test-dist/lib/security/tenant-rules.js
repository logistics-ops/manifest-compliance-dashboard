"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.staffAuditActions = void 0;
exports.canRoleAccessDashboard = canRoleAccessDashboard;
exports.canRoleManageCarriers = canRoleManageCarriers;
exports.canRoleManageCompliance = canRoleManageCompliance;
exports.canAccessOrganizationRecord = canAccessOrganizationRecord;
exports.canAccessCarrierRecord = canAccessCarrierRecord;
exports.canUploadCarrierDocument = canUploadCarrierDocument;
exports.canManageDriverDocumentRecord = canManageDriverDocumentRecord;
exports.canManageEquipmentDocumentRecord = canManageEquipmentDocumentRecord;
exports.canAccessLoadRecord = canAccessLoadRecord;
exports.getLoadQueryScope = getLoadQueryScope;
exports.canManageLoadRecord = canManageLoadRecord;
exports.canCreateLoadRecord = canCreateLoadRecord;
exports.canUploadLoadDocument = canUploadLoadDocument;
exports.canUploadLoadDocumentType = canUploadLoadDocumentType;
exports.canManageLoadDocumentRecord = canManageLoadDocumentRecord;
exports.canExportLoadArchive = canExportLoadArchive;
exports.canAccessLoadTimeline = canAccessLoadTimeline;
exports.canExportOrganizationLoadArchive = canExportOrganizationLoadArchive;
exports.canDeleteArchivedLoadFiles = canDeleteArchivedLoadFiles;
exports.canAccessInvoiceRecord = canAccessInvoiceRecord;
exports.canAccessBrokerRecord = canAccessBrokerRecord;
exports.canManageBrokerRecord = canManageBrokerRecord;
exports.canCreateBrokerCheckRequest = canCreateBrokerCheckRequest;
exports.canViewOrganizationUsers = canViewOrganizationUsers;
exports.canInviteOrganizationUsers = canInviteOrganizationUsers;
exports.canManageOrganizationUsers = canManageOrganizationUsers;
exports.canAssignCarrierToUser = canAssignCarrierToUser;
exports.canGenerateInvoiceRecord = canGenerateInvoiceRecord;
exports.canSendInvoiceRecord = canSendInvoiceRecord;
exports.canUpdateInvoiceStatusRecord = canUpdateInvoiceStatusRecord;
exports.getInvoiceStoragePrefix = getInvoiceStoragePrefix;
exports.isInvoiceStoragePath = isInvoiceStoragePath;
exports.assertInvoiceStoragePath = assertInvoiceStoragePath;
exports.canMutateTenantRecord = canMutateTenantRecord;
exports.canAccessNotificationRecord = canAccessNotificationRecord;
exports.canAccessComplianceTaskRecord = canAccessComplianceTaskRecord;
exports.canManageComplianceTaskRecord = canManageComplianceTaskRecord;
exports.canAccessInspectionRecord = canAccessInspectionRecord;
exports.canManageInspectionRecord = canManageInspectionRecord;
exports.canUploadInspectionDocumentRecord = canUploadInspectionDocumentRecord;
exports.canAccessUploadLinkRecord = canAccessUploadLinkRecord;
exports.canManageUploadLinkRecord = canManageUploadLinkRecord;
exports.canAccessAuditLogRecord = canAccessAuditLogRecord;
exports.getTenantStoragePrefix = getTenantStoragePrefix;
exports.isTenantStoragePath = isTenantStoragePath;
exports.assertTenantStoragePath = assertTenantStoragePath;
exports.getDriverDocumentStoragePrefix = getDriverDocumentStoragePrefix;
exports.isDriverDocumentStoragePath = isDriverDocumentStoragePath;
exports.assertDriverDocumentStoragePath = assertDriverDocumentStoragePath;
exports.getEquipmentDocumentStoragePrefix = getEquipmentDocumentStoragePrefix;
exports.isEquipmentDocumentStoragePath = isEquipmentDocumentStoragePath;
exports.assertEquipmentDocumentStoragePath = assertEquipmentDocumentStoragePath;
exports.getInspectionStoragePrefix = getInspectionStoragePrefix;
exports.isInspectionStoragePath = isInspectionStoragePath;
exports.assertInspectionStoragePath = assertInspectionStoragePath;
exports.getLoadStoragePrefix = getLoadStoragePrefix;
exports.getLoadDocumentStoragePrefix = getLoadDocumentStoragePrefix;
exports.getLoadDocumentStorageFolder = getLoadDocumentStorageFolder;
exports.isLoadStoragePath = isLoadStoragePath;
exports.isLoadDocumentStoragePath = isLoadDocumentStoragePath;
exports.assertLoadStoragePath = assertLoadStoragePath;
exports.assertLoadDocumentStoragePath = assertLoadDocumentStoragePath;
exports.staffAuditActions = new Set([
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
function canRoleAccessDashboard(role, platformSuperAdmin = false) {
    return platformSuperAdmin || role === "admin" || role === "staff";
}
function canRoleManageCarriers(role, platformSuperAdmin = false) {
    return platformSuperAdmin || role === "admin";
}
function canRoleManageCompliance(role, platformSuperAdmin = false) {
    return platformSuperAdmin || role === "admin" || role === "staff";
}
function canAccessOrganizationRecord(session, organizationId, organizationIsActive = true) {
    if (!session || !organizationId)
        return false;
    if (session.platformSuperAdmin)
        return true;
    return organizationIsActive && session.organizationId === organizationId;
}
function canAccessCarrierRecord(session, carrier, organizationIsActive = true) {
    if (!session)
        return false;
    if (session.platformSuperAdmin)
        return true;
    if (!canAccessOrganizationRecord(session, carrier.organizationId, organizationIsActive))
        return false;
    if (canRoleAccessDashboard(session.role))
        return true;
    return session.role === "carrier" && session.carrierId === carrier.carrierId;
}
function canUploadCarrierDocument(session, carrier, organizationIsActive = true) {
    if (!session)
        return false;
    if (session.platformSuperAdmin)
        return true;
    if (!canAccessOrganizationRecord(session, carrier.organizationId, organizationIsActive))
        return false;
    if (canRoleManageCompliance(session.role))
        return true;
    return session.role === "carrier" && session.carrierId === carrier.carrierId;
}
function canManageDriverDocumentRecord(session, driver, organizationIsActive = true) {
    if (!session)
        return false;
    if (session.platformSuperAdmin)
        return true;
    if (!canAccessOrganizationRecord(session, driver.organizationId, organizationIsActive))
        return false;
    if (canRoleManageCompliance(session.role))
        return true;
    return session.role === "carrier" && session.carrierId === driver.carrierId;
}
function canManageEquipmentDocumentRecord(session, equipment, organizationIsActive = true) {
    if (!session)
        return false;
    if (session.platformSuperAdmin)
        return true;
    if (!canAccessOrganizationRecord(session, equipment.organizationId, organizationIsActive))
        return false;
    if (canRoleManageCompliance(session.role))
        return true;
    return session.role === "carrier" && session.carrierId === equipment.carrierId;
}
function canAccessLoadRecord(session, load, organizationIsActive = true) {
    if (!session)
        return false;
    if (session.platformSuperAdmin)
        return true;
    if (!canAccessOrganizationRecord(session, load.organizationId, organizationIsActive))
        return false;
    if (canRoleManageCompliance(session.role))
        return true;
    return session.role === "carrier" && session.carrierId === load.carrierId;
}
function getLoadQueryScope(session) {
    if (!session || session.platformSuperAdmin) {
        return { organizationId: null, carrierId: null };
    }
    return {
        organizationId: session.organizationId,
        carrierId: session.role === "carrier" ? session.carrierId : null,
    };
}
function canManageLoadRecord(session, load, organizationIsActive = true) {
    if (!session)
        return false;
    if (session.platformSuperAdmin)
        return true;
    return canRoleManageCompliance(session.role) && canAccessOrganizationRecord(session, load.organizationId, organizationIsActive);
}
function canCreateLoadRecord(session, load, organizationIsActive = true) {
    if (!session)
        return false;
    if (session.platformSuperAdmin)
        return true;
    if (!canAccessOrganizationRecord(session, load.organizationId, organizationIsActive))
        return false;
    if (canRoleManageCompliance(session.role))
        return true;
    return session.role === "carrier" && session.carrierId === load.carrierId;
}
function canUploadLoadDocument(session, load, organizationIsActive = true) {
    return canAccessLoadRecord(session, load, organizationIsActive);
}
function canUploadLoadDocumentType(session, load, documentType, organizationIsActive = true) {
    if (documentType === "rate_confirmation") {
        return canCreateLoadRecord(session, load, organizationIsActive);
    }
    return canUploadLoadDocument(session, load, organizationIsActive);
}
function canManageLoadDocumentRecord(session, load, organizationIsActive = true) {
    return canCreateLoadRecord(session, load, organizationIsActive);
}
function canExportLoadArchive(session, load, organizationIsActive = true) {
    return canAccessLoadRecord(session, load, organizationIsActive);
}
function canAccessLoadTimeline(session, load, organizationIsActive = true) {
    return canAccessLoadRecord(session, load, organizationIsActive);
}
function canExportOrganizationLoadArchive(session, organizationId) {
    if (!session)
        return false;
    if (session.platformSuperAdmin)
        return true;
    return canRoleManageCompliance(session.role) && canAccessOrganizationRecord(session, organizationId);
}
function canDeleteArchivedLoadFiles(session, load, organizationIsActive = true) {
    return canManageLoadRecord(session, load, organizationIsActive);
}
function canAccessInvoiceRecord(session, invoice, organizationIsActive = true) {
    return canAccessLoadRecord(session, invoice, organizationIsActive);
}
function canAccessBrokerRecord(session, broker, organizationIsActive = true) {
    if (!session)
        return false;
    if (session.platformSuperAdmin)
        return true;
    if (!canAccessOrganizationRecord(session, broker.organizationId, organizationIsActive))
        return false;
    if (canRoleManageCompliance(session.role))
        return true;
    if (session.role !== "carrier" || !session.carrierId)
        return false;
    if (broker.linkedCarrierIds)
        return broker.linkedCarrierIds.includes(session.carrierId);
    if (broker.requestedByCarrierId)
        return broker.requestedByCarrierId === session.carrierId;
    return true;
}
function canManageBrokerRecord(session, organizationId, organizationIsActive = true) {
    if (!session)
        return false;
    if (session.platformSuperAdmin)
        return true;
    return canRoleManageCompliance(session.role) && canAccessOrganizationRecord(session, organizationId, organizationIsActive);
}
function canCreateBrokerCheckRequest(session, organizationId, carrierId, organizationIsActive = true) {
    if (!session)
        return false;
    if (session.platformSuperAdmin)
        return true;
    if (!canAccessOrganizationRecord(session, organizationId, organizationIsActive))
        return false;
    if (canRoleManageCompliance(session.role))
        return true;
    return session.role === "carrier" && Boolean(session.carrierId) && session.carrierId === carrierId;
}
function canViewOrganizationUsers(session, organizationId, organizationIsActive = true) {
    if (!session)
        return false;
    if (session.platformSuperAdmin)
        return true;
    return canRoleManageCompliance(session.role) && canAccessOrganizationRecord(session, organizationId, organizationIsActive);
}
function canInviteOrganizationUsers(session, organizationId, organizationIsActive = true) {
    if (!session)
        return false;
    if (session.platformSuperAdmin)
        return true;
    return (session.role === "admin" || session.role === "staff") && canAccessOrganizationRecord(session, organizationId, organizationIsActive);
}
function canManageOrganizationUsers(session, organizationId, organizationIsActive = true) {
    if (!session)
        return false;
    if (session.platformSuperAdmin)
        return true;
    return session.role === "admin" && canAccessOrganizationRecord(session, organizationId, organizationIsActive);
}
function canAssignCarrierToUser(session, userOrganizationId, carrierOrganizationId, organizationIsActive = true) {
    if (!canManageOrganizationUsers(session, userOrganizationId, organizationIsActive) && !canInviteOrganizationUsers(session, userOrganizationId, organizationIsActive)) {
        return false;
    }
    if (!userOrganizationId || !carrierOrganizationId)
        return false;
    if (session === null || session === void 0 ? void 0 : session.platformSuperAdmin)
        return userOrganizationId === carrierOrganizationId;
    return (session === null || session === void 0 ? void 0 : session.organizationId) === userOrganizationId && userOrganizationId === carrierOrganizationId;
}
function canGenerateInvoiceRecord(session, invoice, organizationIsActive = true) {
    return canCreateLoadRecord(session, invoice, organizationIsActive);
}
function canSendInvoiceRecord(session, invoice, organizationIsActive = true) {
    return canCreateLoadRecord(session, invoice, organizationIsActive);
}
function canUpdateInvoiceStatusRecord(session, invoice, organizationIsActive = true) {
    return canCreateLoadRecord(session, invoice, organizationIsActive);
}
function getInvoiceStoragePrefix(organizationId, loadId) {
    return `${getLoadStoragePrefix(organizationId, loadId)}invoices/`;
}
function isInvoiceStoragePath(storagePath, organizationId, loadId) {
    return storagePath.startsWith(getInvoiceStoragePrefix(organizationId, loadId));
}
function assertInvoiceStoragePath(storagePath, organizationId, loadId) {
    if (!isInvoiceStoragePath(storagePath, organizationId, loadId)) {
        throw new Error("Invoice PDF path does not match the current organization and load.");
    }
}
function canMutateTenantRecord(session, organizationId, allowedRoles, organizationIsActive = true) {
    if (!session)
        return false;
    if (session.platformSuperAdmin)
        return true;
    return allowedRoles.includes(session.role) && canAccessOrganizationRecord(session, organizationId, organizationIsActive);
}
function canAccessNotificationRecord(session, notification, organizationIsActive = true) {
    if (!session)
        return false;
    if (session.platformSuperAdmin)
        return true;
    if (!canAccessOrganizationRecord(session, notification.organizationId, organizationIsActive))
        return false;
    if (canRoleManageCompliance(session.role))
        return true;
    if (notification.assignedTo === session.userId)
        return true;
    if (notification.userId === session.userId)
        return true;
    return Boolean(notification.carrierId && session.role === "carrier" && session.carrierId === notification.carrierId);
}
function canAccessComplianceTaskRecord(session, task, organizationIsActive = true) {
    if (!session)
        return false;
    if (session.platformSuperAdmin)
        return true;
    if (!canAccessOrganizationRecord(session, task.organizationId, organizationIsActive))
        return false;
    if (canRoleManageCompliance(session.role))
        return true;
    return Boolean(session.role === "carrier" &&
        (session.userId === task.assignedTo || (session.carrierId !== null && session.carrierId === task.relatedCarrierId)));
}
function canManageComplianceTaskRecord(session, organizationId, organizationIsActive = true) {
    if (!session)
        return false;
    if (session.platformSuperAdmin)
        return true;
    return canRoleManageCompliance(session.role) && canAccessOrganizationRecord(session, organizationId, organizationIsActive);
}
function canAccessInspectionRecord(session, inspection, organizationIsActive = true) {
    if (!session)
        return false;
    if (session.platformSuperAdmin)
        return true;
    if (!canAccessOrganizationRecord(session, inspection.organizationId, organizationIsActive))
        return false;
    if (canRoleManageCompliance(session.role))
        return true;
    return session.role === "carrier" && session.carrierId === inspection.carrierId;
}
function canManageInspectionRecord(session, inspection, organizationIsActive = true) {
    if (!session)
        return false;
    if (session.platformSuperAdmin)
        return true;
    return canRoleManageCompliance(session.role) && canAccessOrganizationRecord(session, inspection.organizationId, organizationIsActive);
}
function canUploadInspectionDocumentRecord(session, inspection, organizationIsActive = true) {
    if (!session)
        return false;
    if (session.platformSuperAdmin)
        return true;
    if (!canAccessOrganizationRecord(session, inspection.organizationId, organizationIsActive))
        return false;
    if (canRoleManageCompliance(session.role))
        return true;
    return session.role === "carrier" && session.carrierId === inspection.carrierId;
}
function canAccessUploadLinkRecord(session, uploadLink, organizationIsActive = true) {
    if (!session)
        return false;
    if (session.platformSuperAdmin)
        return true;
    return canRoleManageCompliance(session.role) && canAccessOrganizationRecord(session, uploadLink.organizationId, organizationIsActive);
}
function canManageUploadLinkRecord(session, uploadLink, organizationIsActive = true) {
    return canAccessUploadLinkRecord(session, uploadLink, organizationIsActive);
}
function canAccessAuditLogRecord(session, auditLog, organizationIsActive = true) {
    if (!session)
        return false;
    if (session.platformSuperAdmin)
        return true;
    if (!canAccessOrganizationRecord(session, auditLog.organizationId, organizationIsActive))
        return false;
    if (session.role === "admin")
        return true;
    if (session.role === "staff")
        return exports.staffAuditActions.has(auditLog.action);
    return false;
}
function getTenantStoragePrefix(organizationId, carrierId) {
    return `organizations/${organizationId}/carriers/${carrierId}/`;
}
function isTenantStoragePath(storagePath, organizationId, carrierId) {
    return storagePath.startsWith(getTenantStoragePrefix(organizationId, carrierId));
}
function assertTenantStoragePath(storagePath, organizationId, carrierId) {
    if (!isTenantStoragePath(storagePath, organizationId, carrierId)) {
        throw new Error("Uploaded document path does not match the current organization.");
    }
}
function getDriverDocumentStoragePrefix(organizationId, driverId) {
    return `organizations/${organizationId}/drivers/${driverId}/`;
}
function isDriverDocumentStoragePath(storagePath, organizationId, driverId) {
    return storagePath.startsWith(getDriverDocumentStoragePrefix(organizationId, driverId));
}
function assertDriverDocumentStoragePath(storagePath, organizationId, driverId) {
    if (!isDriverDocumentStoragePath(storagePath, organizationId, driverId)) {
        throw new Error("Uploaded driver document path does not match the current organization and driver.");
    }
}
function getEquipmentDocumentStoragePrefix(organizationId, equipmentId) {
    return `organizations/${organizationId}/equipment/${equipmentId}/`;
}
function isEquipmentDocumentStoragePath(storagePath, organizationId, equipmentId) {
    return storagePath.startsWith(getEquipmentDocumentStoragePrefix(organizationId, equipmentId));
}
function assertEquipmentDocumentStoragePath(storagePath, organizationId, equipmentId) {
    if (!isEquipmentDocumentStoragePath(storagePath, organizationId, equipmentId)) {
        throw new Error("Uploaded vehicle document path does not match the current organization and equipment.");
    }
}
function getInspectionStoragePrefix(organizationId, inspectionId) {
    return `organizations/${organizationId}/inspections/${inspectionId}/`;
}
function isInspectionStoragePath(storagePath, organizationId, inspectionId) {
    return storagePath.startsWith(getInspectionStoragePrefix(organizationId, inspectionId));
}
function assertInspectionStoragePath(storagePath, organizationId, inspectionId) {
    if (!isInspectionStoragePath(storagePath, organizationId, inspectionId)) {
        throw new Error("Uploaded inspection document path does not match the current organization and inspection.");
    }
}
function getLoadStoragePrefix(organizationId, loadId) {
    return `organizations/${organizationId}/loads/${loadId}/`;
}
function getLoadDocumentStoragePrefix(organizationId, loadId, documentType) {
    const folder = documentType === "rate_confirmation" ? "rate-confirmation" : documentType;
    return `${getLoadStoragePrefix(organizationId, loadId)}${folder}/`;
}
function getLoadDocumentStorageFolder(documentType) {
    return documentType === "rate_confirmation" ? "rate-confirmation" : "pod";
}
function isLoadStoragePath(storagePath, organizationId, loadId) {
    return storagePath.startsWith(getLoadStoragePrefix(organizationId, loadId));
}
function isLoadDocumentStoragePath(storagePath, organizationId, loadId, documentType) {
    return storagePath.startsWith(getLoadDocumentStoragePrefix(organizationId, loadId, documentType));
}
function assertLoadStoragePath(storagePath, organizationId, loadId) {
    if (!isLoadStoragePath(storagePath, organizationId, loadId)) {
        throw new Error("Uploaded load document path does not match the current organization and load.");
    }
}
function assertLoadDocumentStoragePath(storagePath, organizationId, loadId, documentType) {
    if (!isLoadDocumentStoragePath(storagePath, organizationId, loadId, documentType)) {
        throw new Error("Uploaded load document path does not match the requested document type.");
    }
}
