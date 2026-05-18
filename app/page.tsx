import { ComplianceDashboard } from "@/components/compliance-dashboard";
import { getCarriers } from "@/lib/data/carriers";
import { getNotifications } from "@/lib/data/notifications";
import { requireStaffAccess } from "@/lib/integrations/auth";

export default async function Home() {
  const session = await requireStaffAccess();
  const carriers = await getCarriers();
  const notifications = await getNotifications(carriers);

  return <ComplianceDashboard carriers={carriers} notifications={notifications} session={session} />;
}
