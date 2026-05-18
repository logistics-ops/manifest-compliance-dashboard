import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowLeft, Building2, FileCheck2, ShieldAlert, Truck } from "lucide-react";
import { notFound } from "next/navigation";
import { AuditLogViewer } from "@/components/audit-log-viewer";
import { getPlatformOrganizationAuditLogs } from "@/lib/audit";
import { getCarrierDocuments, getComplianceScore, getComplianceTier, isHighRisk } from "@/lib/compliance";
import { getPlatformOrganizationDashboard } from "@/lib/data/platform";
import { StatusChip } from "@/components/status-chip";

type PageProps = {
  params: Promise<{
    organizationId: string;
  }>;
};

export default async function PlatformOrganizationDashboardPage({ params }: PageProps) {
  const { organizationId } = await params;
  const data = await getPlatformOrganizationDashboard(organizationId);
  const auditLogs = await getPlatformOrganizationAuditLogs(organizationId, 50);

  if (!data) {
    notFound();
  }

  const { organization, carriers, metrics } = data;

  return (
    <main className="min-h-screen p-8 max-md:p-4">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex items-center justify-between gap-3 max-md:flex-col max-md:items-stretch">
          <Link href="/platform" className="inline-flex min-h-10 items-center gap-2 rounded-md border border-white/10 bg-black/30 px-3 text-sm font-bold text-manifest-muted transition hover:border-manifest-red/50 hover:bg-manifest-red/10 hover:text-white">
            <ArrowLeft className="h-4 w-4" />
            Platform console
          </Link>
          <span className="rounded-md border border-manifest-amber/40 bg-manifest-amber/10 px-3 py-2 text-xs font-bold text-manifest-amber">
            Read-only platform view
          </span>
        </div>

        <section className="section-panel mb-5 overflow-hidden border-manifest-red/30 p-7 max-md:p-5">
          <div className="flex items-start justify-between gap-8 max-lg:flex-col">
            <div>
              <p className="eyebrow">Tenant Dashboard Preview</p>
              <h1 className="text-5xl font-extrabold leading-[0.95] tracking-normal text-white max-md:text-3xl">
                {organization.name}
              </h1>
              <p className="mt-4 max-w-2xl text-sm leading-6 text-manifest-muted">
                Safe platform-super-admin view of this organization’s compliance posture. This page does not change your session tenant or bypass tenant-scoped write paths.
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                <StatusChip value={organization.isActive ? "Active" : "Suspended"} />
                <StatusChip value={organization.subdomain} />
                <StatusChip value={organization.slug} />
              </div>
            </div>
            <div
              className="grid min-h-36 min-w-44 place-items-center rounded-md border border-white/10 bg-black/45 p-4 text-center"
              style={{ borderColor: organization.primaryColor }}
            >
              <Building2 className="h-8 w-8" style={{ color: organization.primaryColor }} />
              <strong className="mt-3 text-2xl text-white">{metrics.averageScore}%</strong>
              <span className="text-xs font-bold text-manifest-muted">avg compliance</span>
            </div>
          </div>
        </section>

        <section className="mb-5 grid grid-cols-5 gap-4 max-xl:grid-cols-2 max-md:grid-cols-1">
          <Metric label="Carriers" value={metrics.totalCarriers} icon={<Truck className="h-4 w-4" />} />
          <Metric label="Active carriers" value={metrics.activeCarriers} icon={<Truck className="h-4 w-4" />} />
          <Metric label="High risk" value={metrics.highRiskCarriers} icon={<ShieldAlert className="h-4 w-4" />} />
          <Metric label="Uploaded docs" value={metrics.uploadedDocuments} icon={<FileCheck2 className="h-4 w-4" />} />
          <Metric label="Missing docs" value={metrics.missingDocuments} icon={<FileCheck2 className="h-4 w-4" />} />
        </section>

        <section className="section-panel p-6">
          <div className="mb-5">
            <p className="eyebrow">Carrier Profiles</p>
            <h2 className="text-2xl font-extrabold tracking-normal text-white">Read-only tenant roster</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[880px] border-collapse">
              <thead>
                <tr className="bg-white/[0.025] text-left text-[11px] uppercase tracking-[0.14em] text-manifest-quiet">
                  <th className="border-b border-white/10 px-4 py-4">Company</th>
                  <th className="border-b border-white/10 px-4 py-4">MC / DOT</th>
                  <th className="border-b border-white/10 px-4 py-4">Status</th>
                  <th className="border-b border-white/10 px-4 py-4">Score</th>
                  <th className="border-b border-white/10 px-4 py-4">Documents</th>
                </tr>
              </thead>
              <tbody>
                {carriers.map((carrier) => {
                  const documents = getCarrierDocuments(carrier);
                  return (
                    <tr key={carrier.id}>
                      <td className="border-b border-white/10 px-4 py-4">
                        <strong className="block text-sm text-white">{carrier.companyName}</strong>
                        <span className="text-xs text-manifest-muted">{carrier.email}</span>
                      </td>
                      <td className="border-b border-white/10 px-4 py-4">
                        <strong className="block text-sm text-white">{carrier.mcNumber}</strong>
                        <span className="text-xs text-manifest-muted">{carrier.dotNumber}</span>
                      </td>
                      <td className="border-b border-white/10 px-4 py-4">
                        <StatusChip value={carrier.status} type="carrier" />
                      </td>
                      <td className="border-b border-white/10 px-4 py-4">
                        <span className="text-sm font-bold text-white">
                          {getComplianceScore(carrier)} - {getComplianceTier(carrier)}
                        </span>
                      </td>
                      <td className="border-b border-white/10 px-4 py-4">
                        <span className="text-sm text-manifest-muted">
                          {documents.filter((document) => document.uploaded).length}/{documents.length} uploaded
                        </span>
                        {isHighRisk(carrier) ? <span className="ml-2 text-xs font-bold text-manifest-danger">High risk</span> : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        <div className="mt-5">
          <AuditLogViewer
            logs={auditLogs}
            title="Tenant audit log"
            description="Read-only platform view of this organization's recent security and operational events."
          />
        </div>
      </div>
    </main>
  );
}

function Metric({ label, value, icon }: { label: string; value: number; icon: ReactNode }) {
  return (
    <article className="section-panel min-h-28 p-4">
      <div className="mb-4 flex items-center justify-between gap-3">
        <span className="text-sm font-bold text-manifest-muted">{label}</span>
        <span className="grid h-8 w-8 place-items-center rounded-md border border-manifest-red/45 bg-manifest-red/10 text-manifest-red">
          {icon}
        </span>
      </div>
      <strong className="text-4xl leading-none text-white">{value}</strong>
    </article>
  );
}
