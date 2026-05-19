import type { AuthSession } from "@/types/carrier";
import {
  canAccessOrganizationRecord,
  canUploadCarrierDocument,
  canRoleAccessDashboard,
  canRoleManageCarriers,
  canRoleManageCompliance,
} from "@/lib/security/tenant-rules";

export function canManageCarriers(session: AuthSession | null) {
  return session ? canRoleManageCarriers(session.role, session.platformSuperAdmin) : false;
}

export function canManageCompliance(session: AuthSession | null) {
  return session ? canRoleManageCompliance(session.role, session.platformSuperAdmin) : false;
}

export function canAccessDashboard(session: AuthSession | null) {
  return session ? canRoleAccessDashboard(session.role, session.platformSuperAdmin) : false;
}

export function canViewCarrier(session: AuthSession | null, carrierId: string) {
  if (!session) return false;
  if (canAccessDashboard(session)) return true;
  return session.role === "carrier" && session.carrierId === carrierId;
}

export function canUploadCarrierDocuments(
  session: AuthSession | null,
  carrier: { id: string; organizationId: string | null },
) {
  return canUploadCarrierDocument(session, {
    organizationId: carrier.organizationId,
    carrierId: carrier.id,
  });
}

export function canAccessOrganization(session: AuthSession | null, organizationId: string | null) {
  return canAccessOrganizationRecord(session, organizationId);
}
