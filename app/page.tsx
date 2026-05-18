import { ComplianceDashboard } from "@/components/compliance-dashboard";
import { AuditLogViewer } from "@/components/audit-log-viewer";
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

  return (
    <>
      <ComplianceDashboard carriers={carriers} notifications={notifications} session={session} branding={branding} />
      <div className="px-8 pb-8 max-md:px-4">
        <AuditLogViewer
          logs={auditLogs}
          title="Organization audit log"
          description="Recent tenant activity visible to your role."
        />
      </div>
    </>
  );
}
