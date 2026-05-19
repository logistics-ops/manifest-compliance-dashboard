import type { UserRole } from "@/types/carrier";

export type OrganizationUser = {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  organizationId: string | null;
  carrierId: string | null;
  carrierName: string;
  platformSuperAdmin: boolean;
  isActive: boolean;
  createdAt: string;
  lastLoginAt: string | null;
};
