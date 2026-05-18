import type { AuthSession } from "@/types/carrier";

export function canManageCarriers(session: AuthSession | null) {
  return session?.role === "admin";
}

export function canManageCompliance(session: AuthSession | null) {
  return session?.role === "admin" || session?.role === "staff";
}

export function canAccessDashboard(session: AuthSession | null) {
  return session?.role === "admin" || session?.role === "staff";
}

export function canViewCarrier(session: AuthSession | null, carrierId: string) {
  if (!session) return false;
  if (canAccessDashboard(session)) return true;
  return session.role === "carrier" && session.carrierId === carrierId;
}
