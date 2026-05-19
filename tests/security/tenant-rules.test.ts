import test from "node:test";
import assert from "node:assert/strict";
import type { AuthSession } from "../../types/carrier";
import {
  assertTenantStoragePath,
  canAccessAuditLogRecord,
  canAccessBrokerRecord,
  canAccessCarrierRecord,
  canAccessInvoiceRecord,
  canAccessLoadRecord,
  canAccessLoadTimeline,
  canDeleteArchivedLoadFiles,
  canExportLoadArchive,
  canExportOrganizationLoadArchive,
  canGenerateInvoiceRecord,
  canAccessNotificationRecord,
  canAccessOrganizationRecord,
  canCreateLoadRecord,
  canCreateBrokerCheckRequest,
  canManageBrokerRecord,
  canManageLoadDocumentRecord,
  canManageLoadRecord,
  canUploadCarrierDocument,
  canUploadLoadDocument,
  canUploadLoadDocumentType,
  canMutateTenantRecord,
  canRoleAccessDashboard,
  canRoleManageCarriers,
  canRoleManageCompliance,
  canSendInvoiceRecord,
  canUpdateInvoiceStatusRecord,
  getLoadQueryScope,
  isTenantStoragePath,
  isLoadStoragePath,
  isLoadDocumentStoragePath,
  isInvoiceStoragePath,
} from "../../lib/security/tenant-rules";

const orgA = "org-a";
const orgB = "org-b";
const carrierA = "carrier-a";
const carrierB = "carrier-b";

function session(overrides: Partial<AuthSession>): AuthSession {
  return {
    userId: "user-1",
    email: "user@example.test",
    fullName: "Test User",
    role: "carrier",
    organizationId: orgA,
    organizationName: "Org A",
    organizationSlug: "org-a",
    platformSuperAdmin: false,
    carrierId: null,
    ...overrides,
  };
}

test("organization access allows own active org and blocks other or suspended orgs", () => {
  const admin = session({ role: "admin" });

  assert.equal(canAccessOrganizationRecord(admin, orgA, true), true);
  assert.equal(canAccessOrganizationRecord(admin, orgB, true), false);
  assert.equal(canAccessOrganizationRecord(admin, orgA, false), false);
  assert.equal(canAccessOrganizationRecord(null, orgA, true), false);
});

test("platform super admin can access all organizations including suspended organizations", () => {
  const platform = session({ role: "admin", organizationId: null, platformSuperAdmin: true });

  assert.equal(canAccessOrganizationRecord(platform, orgA, true), true);
  assert.equal(canAccessOrganizationRecord(platform, orgB, false), true);
});

test("role permission checks match dashboard, carrier management, and compliance rules", () => {
  assert.equal(canRoleAccessDashboard("admin"), true);
  assert.equal(canRoleAccessDashboard("staff"), true);
  assert.equal(canRoleAccessDashboard("carrier"), false);
  assert.equal(canRoleAccessDashboard("carrier", true), true);

  assert.equal(canRoleManageCarriers("admin"), true);
  assert.equal(canRoleManageCarriers("staff"), false);
  assert.equal(canRoleManageCarriers("carrier"), false);
  assert.equal(canRoleManageCarriers("carrier", true), true);

  assert.equal(canRoleManageCompliance("admin"), true);
  assert.equal(canRoleManageCompliance("staff"), true);
  assert.equal(canRoleManageCompliance("carrier"), false);
});

test("carrier user can only access linked carrier in their active organization", () => {
  const carrierUser = session({ role: "carrier", carrierId: carrierA });

  assert.equal(canAccessCarrierRecord(carrierUser, { organizationId: orgA, carrierId: carrierA }, true), true);
  assert.equal(canAccessCarrierRecord(carrierUser, { organizationId: orgA, carrierId: carrierB }, true), false);
  assert.equal(canAccessCarrierRecord(carrierUser, { organizationId: orgB, carrierId: carrierA }, true), false);
  assert.equal(canAccessCarrierRecord(carrierUser, { organizationId: orgA, carrierId: carrierA }, false), false);
});

test("linked carrier upload permission allows only own carrier document uploads", () => {
  const admin = session({ role: "admin" });
  const staff = session({ role: "staff" });
  const carrierUser = session({ role: "carrier", carrierId: carrierA });
  const otherCarrierUser = session({ role: "carrier", carrierId: carrierB });

  assert.equal(canUploadCarrierDocument(admin, { organizationId: orgA, carrierId: carrierA }, true), true);
  assert.equal(canUploadCarrierDocument(staff, { organizationId: orgA, carrierId: carrierA }, true), true);
  assert.equal(canUploadCarrierDocument(admin, { organizationId: orgB, carrierId: carrierB }, true), false);
  assert.equal(canUploadCarrierDocument(staff, { organizationId: orgA, carrierId: carrierA }, false), false);
  assert.equal(canUploadCarrierDocument(carrierUser, { organizationId: orgA, carrierId: carrierA }, true), true);
  assert.equal(canUploadCarrierDocument(carrierUser, { organizationId: orgA, carrierId: carrierB }, true), false);
  assert.equal(canUploadCarrierDocument(otherCarrierUser, { organizationId: orgB, carrierId: carrierB }, true), false);
});

test("admin and staff can only access carriers in their own active organization", () => {
  const admin = session({ role: "admin" });
  const staff = session({ role: "staff" });

  assert.equal(canAccessCarrierRecord(admin, { organizationId: orgA, carrierId: carrierA }, true), true);
  assert.equal(canAccessCarrierRecord(staff, { organizationId: orgA, carrierId: carrierA }, true), true);
  assert.equal(canAccessCarrierRecord(admin, { organizationId: orgB, carrierId: carrierB }, true), false);
  assert.equal(canAccessCarrierRecord(staff, { organizationId: orgB, carrierId: carrierB }, true), false);
  assert.equal(canMutateTenantRecord(admin, orgA, ["admin"], true), true);
  assert.equal(canMutateTenantRecord(staff, orgA, ["admin"], true), false);
  assert.equal(canMutateTenantRecord(staff, orgA, ["admin", "staff"], true), true);
  assert.equal(canMutateTenantRecord(staff, orgA, ["admin", "staff"], false), false);
});

test("platform super admin can access carriers and mutate tenant records across organizations", () => {
  const platform = session({ role: "admin", organizationId: null, platformSuperAdmin: true });

  assert.equal(canAccessCarrierRecord(platform, { organizationId: orgB, carrierId: carrierB }, false), true);
  assert.equal(canMutateTenantRecord(platform, orgB, ["admin"], false), true);
});

test("upload path validation accepts only the expected organization and carrier prefix", () => {
  const validPath = `organizations/${orgA}/carriers/${carrierA}/certificate-of-insurance/v1/file.pdf`;
  const wrongOrgPath = `organizations/${orgB}/carriers/${carrierA}/certificate-of-insurance/v1/file.pdf`;
  const wrongCarrierPath = `organizations/${orgA}/carriers/${carrierB}/certificate-of-insurance/v1/file.pdf`;
  const legacyPath = `carriers/${carrierA}/certificate-of-insurance/v1/file.pdf`;

  assert.equal(isTenantStoragePath(validPath, orgA, carrierA), true);
  assert.equal(isTenantStoragePath(wrongOrgPath, orgA, carrierA), false);
  assert.equal(isTenantStoragePath(wrongCarrierPath, orgA, carrierA), false);
  assert.equal(isTenantStoragePath(legacyPath, orgA, carrierA), false);
  assert.doesNotThrow(() => assertTenantStoragePath(validPath, orgA, carrierA));
  assert.throws(() => assertTenantStoragePath(wrongOrgPath, orgA, carrierA), /current organization/);
});

test("notification access is scoped by organization, assignment, and linked carrier", () => {
  const staff = session({ role: "staff", userId: "staff-a" });
  const carrierUser = session({ role: "carrier", userId: "carrier-user-a", carrierId: carrierA });
  const otherCarrierUser = session({ role: "carrier", userId: "carrier-user-b", carrierId: carrierB });

  assert.equal(
    canAccessNotificationRecord(staff, { organizationId: orgA, carrierId: carrierA, assignedTo: null }, true),
    true,
  );
  assert.equal(
    canAccessNotificationRecord(staff, { organizationId: orgB, carrierId: carrierB, assignedTo: "staff-a" }, true),
    false,
  );
  assert.equal(
    canAccessNotificationRecord(carrierUser, { organizationId: orgA, carrierId: carrierA, assignedTo: null }, true),
    true,
  );
  assert.equal(
    canAccessNotificationRecord(otherCarrierUser, { organizationId: orgA, carrierId: carrierA, assignedTo: null }, true),
    false,
  );
  assert.equal(
    canAccessNotificationRecord(carrierUser, { organizationId: orgA, carrierId: null, assignedTo: "carrier-user-a" }, true),
    true,
  );
  assert.equal(
    canAccessNotificationRecord(carrierUser, { organizationId: orgA, carrierId: carrierA, assignedTo: null }, false),
    false,
  );
});

test("load access is scoped by organization, role, and linked carrier", () => {
  const platform = session({ role: "admin", organizationId: null, platformSuperAdmin: true });
  const admin = session({ role: "admin" });
  const staff = session({ role: "staff" });
  const carrierUser = session({ role: "carrier", carrierId: carrierA });
  const otherCarrierUser = session({ role: "carrier", carrierId: carrierB });
  const loadA = { organizationId: orgA, carrierId: carrierA };
  const loadB = { organizationId: orgB, carrierId: carrierB };

  assert.equal(canAccessLoadRecord(platform, loadB, false), true);
  assert.equal(canAccessLoadRecord(admin, loadA, true), true);
  assert.equal(canAccessLoadRecord(staff, loadA, true), true);
  assert.equal(canAccessLoadRecord(admin, loadB, true), false);
  assert.equal(canAccessLoadRecord(carrierUser, loadA, true), true);
  assert.equal(canAccessLoadRecord(carrierUser, { organizationId: orgA, carrierId: carrierB }, true), false);
  assert.equal(canAccessLoadRecord(otherCarrierUser, loadA, true), false);
  assert.equal(canAccessLoadRecord(carrierUser, loadA, false), false);
  assert.equal(canAccessLoadTimeline(carrierUser, loadA, true), true);
  assert.equal(canAccessLoadTimeline(carrierUser, { organizationId: orgA, carrierId: carrierB }, true), false);
  assert.equal(canAccessLoadTimeline(admin, loadA, true), true);
  assert.equal(canAccessLoadTimeline(platform, loadB, false), true);

  assert.equal(canManageLoadRecord(admin, loadA, true), true);
  assert.equal(canManageLoadRecord(staff, loadA, true), true);
  assert.equal(canManageLoadRecord(carrierUser, loadA, true), false);
  assert.equal(canCreateLoadRecord(admin, loadA, true), true);
  assert.equal(canCreateLoadRecord(staff, loadA, true), true);
  assert.equal(canCreateLoadRecord(carrierUser, loadA, true), true);
  assert.equal(canCreateLoadRecord(carrierUser, { organizationId: orgA, carrierId: carrierB }, true), false);
  assert.equal(canCreateLoadRecord(carrierUser, { organizationId: orgB, carrierId: carrierA }, true), false);
  assert.equal(canManageLoadDocumentRecord(carrierUser, loadA, true), true);
  assert.equal(canManageLoadDocumentRecord(carrierUser, { organizationId: orgA, carrierId: carrierB }, true), false);
  assert.equal(canManageLoadDocumentRecord(carrierUser, { organizationId: orgB, carrierId: carrierA }, true), false);
  assert.equal(canUploadLoadDocument(carrierUser, loadA, true), true);
  assert.equal(canUploadLoadDocument(otherCarrierUser, loadA, true), false);
  assert.equal(canUploadLoadDocumentType(admin, loadA, "rate_confirmation", true), true);
  assert.equal(canUploadLoadDocumentType(staff, loadA, "rate_confirmation", true), true);
  assert.equal(canUploadLoadDocumentType(carrierUser, loadA, "rate_confirmation", true), true);
  assert.equal(canUploadLoadDocumentType(carrierUser, loadA, "pod", true), true);
  assert.equal(canExportLoadArchive(carrierUser, loadA, true), true);
  assert.equal(canExportLoadArchive(carrierUser, { organizationId: orgA, carrierId: carrierB }, true), false);
  assert.equal(canExportOrganizationLoadArchive(carrierUser, orgA), false);
  assert.equal(canExportOrganizationLoadArchive(staff, orgA), true);
  assert.equal(canExportOrganizationLoadArchive(admin, orgA), true);
  assert.equal(canExportOrganizationLoadArchive(platform, orgB), true);
  assert.equal(canDeleteArchivedLoadFiles(admin, loadA, true), true);
  assert.equal(canDeleteArchivedLoadFiles(staff, loadA, true), true);
  assert.equal(canDeleteArchivedLoadFiles(carrierUser, loadA, true), false);
});

test("carrier direct load route attempts are blocked across carriers and organizations", () => {
  const carrierUser = session({ role: "carrier", carrierId: carrierA, organizationId: orgA });
  const sameOrgOtherCarrierLoad = { organizationId: orgA, carrierId: carrierB };
  const otherOrgSameCarrierIdLoad = { organizationId: orgB, carrierId: carrierA };
  const otherOrgOtherCarrierLoad = { organizationId: orgB, carrierId: carrierB };

  assert.equal(canAccessLoadRecord(carrierUser, sameOrgOtherCarrierLoad, true), false);
  assert.equal(canAccessLoadRecord(carrierUser, otherOrgSameCarrierIdLoad, true), false);
  assert.equal(canAccessLoadRecord(carrierUser, otherOrgOtherCarrierLoad, true), false);
  assert.equal(canUploadLoadDocument(carrierUser, sameOrgOtherCarrierLoad, true), false);
  assert.equal(canUploadLoadDocumentType(carrierUser, sameOrgOtherCarrierLoad, "pod", true), false);
  assert.equal(canAccessLoadTimeline(carrierUser, sameOrgOtherCarrierLoad, true), false);
  assert.equal(canAccessLoadTimeline(carrierUser, otherOrgSameCarrierIdLoad, true), false);
});

test("carrier-created load remains fetchable by linked carrier query scope", () => {
  const carrierUser = session({ role: "carrier", carrierId: carrierA, organizationId: orgA });
  const createdLoad = { organizationId: orgA, carrierId: carrierA };
  const scope = getLoadQueryScope(carrierUser);

  assert.equal(canCreateLoadRecord(carrierUser, createdLoad, true), true);
  assert.equal(canAccessLoadRecord(carrierUser, createdLoad, true), true);
  assert.deepEqual(scope, { organizationId: orgA, carrierId: carrierA });
});

test("load notification scoping blocks organization-wide and cross-carrier load alerts for carriers", () => {
  const admin = session({ role: "admin" });
  const platform = session({ role: "admin", organizationId: null, platformSuperAdmin: true });
  const carrierUser = session({ role: "carrier", userId: "carrier-user-a", carrierId: carrierA });

  assert.equal(
    canAccessNotificationRecord(carrierUser, { organizationId: orgA, carrierId: carrierA, assignedTo: null }, true),
    true,
  );
  assert.equal(
    canAccessNotificationRecord(carrierUser, { organizationId: orgA, carrierId: carrierB, assignedTo: null }, true),
    false,
  );
  assert.equal(
    canAccessNotificationRecord(carrierUser, { organizationId: orgA, carrierId: null, assignedTo: null }, true),
    false,
  );
  assert.equal(
    canAccessNotificationRecord(admin, { organizationId: orgA, carrierId: null, assignedTo: null }, true),
    true,
  );
  assert.equal(
    canAccessNotificationRecord(platform, { organizationId: orgB, carrierId: null, assignedTo: null }, false),
    true,
  );
});

test("load document storage paths are scoped under organization and load", () => {
  const validPath = `organizations/${orgA}/loads/load-a/pod/v1/file.pdf`;
  const rateConPath = `organizations/${orgA}/loads/load-a/rate-confirmation/v1/file.pdf`;
  const wrongOrgPath = `organizations/${orgB}/loads/load-a/pod/v1/file.pdf`;
  const wrongLoadPath = `organizations/${orgA}/loads/load-b/pod/v1/file.pdf`;

  assert.equal(isLoadStoragePath(validPath, orgA, "load-a"), true);
  assert.equal(isLoadStoragePath(wrongOrgPath, orgA, "load-a"), false);
  assert.equal(isLoadStoragePath(wrongLoadPath, orgA, "load-a"), false);
  assert.equal(isLoadDocumentStoragePath(validPath, orgA, "load-a", "pod"), true);
  assert.equal(isLoadDocumentStoragePath(rateConPath, orgA, "load-a", "rate_confirmation"), true);
  assert.equal(isLoadDocumentStoragePath(validPath, orgA, "load-a", "rate_confirmation"), false);
});

test("invoice permissions preserve carrier and organization isolation", () => {
  const platform = session({ role: "admin", organizationId: null, platformSuperAdmin: true });
  const admin = session({ role: "admin" });
  const staff = session({ role: "staff" });
  const carrierUser = session({ role: "carrier", carrierId: carrierA });
  const otherCarrierUser = session({ role: "carrier", carrierId: carrierB });
  const invoiceA = { organizationId: orgA, carrierId: carrierA };
  const invoiceB = { organizationId: orgB, carrierId: carrierB };

  assert.equal(canAccessInvoiceRecord(platform, invoiceB, false), true);
  assert.equal(canAccessInvoiceRecord(admin, invoiceA, true), true);
  assert.equal(canAccessInvoiceRecord(staff, invoiceA, true), true);
  assert.equal(canAccessInvoiceRecord(carrierUser, invoiceA, true), true);
  assert.equal(canAccessInvoiceRecord(carrierUser, { organizationId: orgA, carrierId: carrierB }, true), false);
  assert.equal(canAccessInvoiceRecord(otherCarrierUser, invoiceA, true), false);
  assert.equal(canGenerateInvoiceRecord(carrierUser, invoiceA, true), true);
  assert.equal(canGenerateInvoiceRecord(carrierUser, { organizationId: orgA, carrierId: carrierB }, true), false);
  assert.equal(canSendInvoiceRecord(admin, invoiceA, true), true);
  assert.equal(canSendInvoiceRecord(carrierUser, invoiceA, true), true);
  assert.equal(canSendInvoiceRecord(otherCarrierUser, invoiceA, true), false);
  assert.equal(canUpdateInvoiceStatusRecord(staff, invoiceA, true), true);
  assert.equal(canUpdateInvoiceStatusRecord(carrierUser, invoiceA, true), true);
  assert.equal(canUpdateInvoiceStatusRecord(carrierUser, invoiceA, false), false);
  assert.equal(isInvoiceStoragePath(`organizations/${orgA}/loads/load-a/invoices/v1/invoice.pdf`, orgA, "load-a"), true);
  assert.equal(isInvoiceStoragePath(`organizations/${orgB}/loads/load-a/invoices/v1/invoice.pdf`, orgA, "load-a"), false);
});

test("broker registry permissions preserve tenant and carrier request scope", () => {
  const platform = session({ role: "admin", organizationId: null, platformSuperAdmin: true });
  const admin = session({ role: "admin" });
  const staff = session({ role: "staff" });
  const carrierUser = session({ role: "carrier", carrierId: carrierA });
  const otherCarrierUser = session({ role: "carrier", carrierId: carrierB });

  assert.equal(canAccessBrokerRecord(platform, { organizationId: orgB }, false), true);
  assert.equal(canAccessBrokerRecord(admin, { organizationId: orgA }, true), true);
  assert.equal(canAccessBrokerRecord(staff, { organizationId: orgA }, true), true);
  assert.equal(canAccessBrokerRecord(admin, { organizationId: orgB }, true), false);
  assert.equal(canAccessBrokerRecord(carrierUser, { organizationId: orgA }, true), true);
  assert.equal(canAccessBrokerRecord(carrierUser, { organizationId: orgB }, true), false);
  assert.equal(canAccessBrokerRecord(carrierUser, { organizationId: orgA, linkedCarrierIds: [carrierA] }, true), true);
  assert.equal(canAccessBrokerRecord(otherCarrierUser, { organizationId: orgA, linkedCarrierIds: [carrierA] }, true), false);
  assert.equal(canAccessBrokerRecord(carrierUser, { organizationId: orgA, requestedByCarrierId: carrierA }, true), true);
  assert.equal(canAccessBrokerRecord(otherCarrierUser, { organizationId: orgA, requestedByCarrierId: carrierA }, true), false);

  assert.equal(canManageBrokerRecord(admin, orgA, true), true);
  assert.equal(canManageBrokerRecord(staff, orgA, true), true);
  assert.equal(canManageBrokerRecord(carrierUser, orgA, true), false);
  assert.equal(canManageBrokerRecord(platform, orgB, false), true);

  assert.equal(canCreateBrokerCheckRequest(admin, orgA, null, true), true);
  assert.equal(canCreateBrokerCheckRequest(staff, orgA, null, true), true);
  assert.equal(canCreateBrokerCheckRequest(carrierUser, orgA, carrierA, true), true);
  assert.equal(canCreateBrokerCheckRequest(carrierUser, orgA, carrierB, true), false);
  assert.equal(canCreateBrokerCheckRequest(carrierUser, orgB, carrierA, true), false);
});

test("audit log access is scoped by platform, organization, and role sensitivity", () => {
  const platform = session({ role: "admin", organizationId: null, platformSuperAdmin: true });
  const admin = session({ role: "admin" });
  const staff = session({ role: "staff" });
  const carrierUser = session({ role: "carrier", carrierId: carrierA });

  assert.equal(
    canAccessAuditLogRecord(platform, { organizationId: orgB, action: "organization.suspended" }, false),
    true,
  );
  assert.equal(
    canAccessAuditLogRecord(admin, { organizationId: orgA, action: "user.role_changed" }, true),
    true,
  );
  assert.equal(
    canAccessAuditLogRecord(admin, { organizationId: orgB, action: "carrier.created" }, true),
    false,
  );
  assert.equal(
    canAccessAuditLogRecord(staff, { organizationId: orgA, action: "carrier.status_changed" }, true),
    true,
  );
  assert.equal(
    canAccessAuditLogRecord(staff, { organizationId: orgA, action: "user.role_changed" }, true),
    false,
  );
  assert.equal(
    canAccessAuditLogRecord(staff, { organizationId: orgA, action: "carrier.created" }, false),
    false,
  );
  assert.equal(
    canAccessAuditLogRecord(carrierUser, { organizationId: orgA, action: "carrier.created" }, true),
    false,
  );
});
