import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ClipboardCheck } from "lucide-react";
import { DriverDocumentUploader } from "@/components/driver-document-uploader";
import { documentSlug } from "@/lib/action-center";
import { getDQFiles, type DQChecklistItem } from "@/lib/data/dq-files";
import { requireSession } from "@/lib/integrations/auth";
import { canManageDriverDocumentRecord } from "@/lib/security/tenant-rules";

type PageProps = {
  params: Promise<{ driverId: string }>;
  searchParams?: Promise<{ document?: string }>;
};

export default async function DQFileDetailPage({ params, searchParams }: PageProps) {
  const session = await requireSession();
  const { driverId } = await params;
  const query = await searchParams;
  const files = await getDQFiles();
  const file = files.find((item) => item.id === driverId);

  if (!file) notFound();
  const canEdit = canManageDriverDocumentRecord(session, {
    organizationId: file.organizationId,
    carrierId: file.carrierId,
    driverId: file.id,
  });

  return (
    <main className="min-h-screen p-8 max-md:p-4">
      <div className="mx-auto max-w-5xl">
        <header className="mb-6 flex items-start justify-between gap-4 border-b border-white/10 pb-6 max-lg:flex-col">
          <div>
            <Link href="/dq-files" className="mb-4 inline-flex min-h-10 items-center gap-2 rounded-md border border-white/10 bg-black/30 px-3 text-sm font-bold text-manifest-muted transition hover:border-manifest-red/50 hover:bg-manifest-red/10 hover:text-white">
              <ArrowLeft className="h-4 w-4" />
              DQ Files
            </Link>
            <p className="eyebrow">DQ Correction Target</p>
            <h1 className="text-5xl font-extrabold leading-[0.95] tracking-normal text-white max-md:text-3xl">{file.driverName || "Unnamed driver"}</h1>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-manifest-muted">
              Upload and replace missing, expired, or expiring DQ documents for this driver.
            </p>
          </div>
          <div className="grid min-h-32 min-w-40 place-items-center rounded-md border border-manifest-red/45 bg-manifest-red/10 p-4 text-center">
            <ClipboardCheck className="h-7 w-7 text-manifest-red" />
            <strong className="mt-3 text-3xl text-white">{file.readinessPercentage}%</strong>
            <span className="text-xs font-bold text-manifest-muted">{file.readinessBand}</span>
          </div>
        </header>

        <section className="section-panel p-6 max-md:p-4">
          <div className="mb-5 grid grid-cols-4 gap-3 max-lg:grid-cols-2 max-md:grid-cols-1">
            <Summary label="Carrier" value={file.carrierName} />
            <Summary label="Missing" value={file.missingCount} />
            <Summary label="Expired" value={file.expiredCount} />
            <Summary label="Expiring Soon" value={file.expiringSoonCount} />
          </div>

          <div className="grid gap-3">
            {file.checklist.map((item) => (
              <ChecklistRow key={item.name} item={item} highlight={query?.document === documentSlug(item.name)} canEdit={canEdit} />
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}

function ChecklistRow({ item, highlight, canEdit }: { item: DQChecklistItem; highlight: boolean; canEdit: boolean }) {
  const needsCorrection = item.missing || item.expired || item.expiringSoon;

  return (
    <article id={`document-${documentSlug(item.name)}`} className={`scroll-mt-6 rounded-md border p-4 ${highlight ? "border-manifest-red/60 bg-manifest-red/10" : "border-white/10 bg-black/25"}`}>
      <div className="mb-4 flex items-start justify-between gap-4 max-md:flex-col">
        <div>
          <strong className="block text-sm text-white">{item.name}</strong>
          <p className="mt-1 text-sm text-manifest-muted">{item.documentName ?? (item.notApplicable ? "Not applicable" : "No matching document")}</p>
        </div>
        <span className="rounded-full border border-white/10 bg-white/[0.035] px-2.5 py-1 text-[11px] font-extrabold uppercase text-manifest-muted">
          {item.status.replace(/_/g, " ")}
        </span>
      </div>
      <p className="mt-3 text-xs font-bold text-manifest-muted">Expiration: {item.expirationDate ?? "No expiration date"}</p>
      {needsCorrection && !item.notApplicable ? (
        <div className="mt-4">
          <DriverDocumentUploader item={item} canEdit={canEdit} />
        </div>
      ) : null}
    </article>
  );
}

function Summary({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-md border border-white/10 bg-black/25 p-3">
      <span className="panel-label">{label}</span>
      <strong className="mt-1 block text-sm text-white">{value}</strong>
    </div>
  );
}
