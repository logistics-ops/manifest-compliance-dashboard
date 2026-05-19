import { ComplianceDashboard } from "@/components/compliance-dashboard";
import { getOrganizationAuditLogs } from "@/lib/audit";
import { getCarriers } from "@/lib/data/carriers";
import { getNotifications } from "@/lib/data/notifications";
import { getCurrentOrganizationBranding } from "@/lib/data/organizations";
import { requireStaffAccess } from "@/lib/integrations/auth";

export default async function Home() {
  const session = await requireStaffAccess();
  const carriers = await getCarriers();
  const notifications = await getNotifications(carriers);
  const branding = await getCurrentOrganizationBranding();
  const auditLogs = await getOrganizationAuditLogs(40);

  return <ComplianceDashboard carriers={carriers} notifications={notifications} auditLogs={auditLogs} session={session} branding={branding} />;
}
