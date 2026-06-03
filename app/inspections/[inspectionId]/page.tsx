import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, FileText, ListChecks } from "lucide-react";
import { createComplianceTaskAction } from "@/app/actions/compliance-tasks";
import { InspectionDocumentList } from "@/components/inspection-document-list";
import { InspectionDocumentUploader } from "@/components/inspection-document-uploader";
import { StatusChip } from "@/components/status-chip";
import { getInspectionReport } from "@/lib/data/inspections";
import { requireSession } from "@/lib/integrations/auth";
import { canManageComplianceTaskRecord, canUploadInspectionDocumentRecord } from "@/lib/security/tenant-rules";

type PageProps = {
  params: Promise<{ inspectionId: string }>;
  searchParams?: Promise<{ success?: string; error?: string }>;
};

export default async function InspectionDetailPage({ params, searchParams }: PageProps) {
  const session = await requireSession();
  const { inspectionId } = await params;
  const query = await searchParams;
  const inspection = await getInspectionReport(inspectionId);

  if (!inspection) notFound();

  const canUpload = canUploadInspectionDocumentRecord(session, {
    organizationId: inspection.organizationId,
    carrierId: inspection.carrierId,
  });
  const canCreateTask = canManageComplianceTaskRecord(session, inspection.organizationId);

  return (
    <main className="min-h-screen p-8 max-md:p-4">
      <div className="mx-auto max-w-7xl">
        <header className="mb-6 flex items-start justify-between gap-4 border-b border-white/10 pb-6 max-lg:flex-col">
          <div>
            <Link href="/inspections" className="mb-4 inline-flex min-h-10 items-center gap-2 rounded-md border border-white/10 bg-black/30 px-3 text-sm font-bold text-manifest-muted transition hover:border-manifest-red/50 hover:bg-manifest-red/10 hover:text-white">
              <ArrowLeft className="h-4 w-4" />
              Inspection Reports
            </Link>
            <p className="eyebrow">Inspection Record</p>
            <h1 className="text-5xl font-extrabold leading-[0.95] tracking-normal text-white max-md:text-3xl">{inspection.inspectionType}</h1>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-manifest-muted">
              {inspection.carrierName} · {inspection.inspectionDate} · {inspection.location || "No location recorded"}
            </p>
          </div>
          <div className="grid min-h-32 min-w-44 place-items-center rounded-md border border-manifest-red/45 bg-manifest-red/10 p-4 text-center">
            <FileText className="h-7 w-7 text-manifest-red" />
            <strong className="mt-3 text-3xl text-white">{inspection.documents.length}</strong>
            <span className="text-xs font-bold text-manifest-muted">evidence files</span>
          </div>
        </header>

        {query?.success ? <Notice tone="success" message={query.success} /> : null}
        {query?.error ? <Notice tone="error" message={query.error} /> : null}

        <section className="mb-5 grid grid-cols-[1.1fr_0.9fr] gap-5 max-xl:grid-cols-1">
          <div className="section-panel p-6 max-md:p-4">
            <div className="mb-5 flex items-start justify-between gap-3 max-md:flex-col">
              <div>
                <p className="eyebrow">Inspection Details</p>
                <h2 className="text-2xl font-extrabold tracking-normal text-white">Findings and compliance posture</h2>
              </div>
              <div className="flex flex-wrap gap-2">
                <StatusChip value={inspection.outOfService ? "Out of Service" : inspection.status.replace(/_/g, " ")} />
                {inspection.violations ? <StatusChip value="Violations" /> : null}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3 max-lg:grid-cols-2 max-md:grid-cols-1">
              <Summary label="Carrier" value={inspection.carrierName} />
              <Summary label="Inspection Date" value={inspection.inspectionDate} />
              <Summary label="Inspection Type" value={inspection.inspectionType} />
              <Summary label="Location" value={inspection.location || "Not recorded"} />
              <Summary label="Driver" value={inspection.driverName ?? "Not linked"} />
              <Summary label="Vehicle" value={inspection.equipmentLabel ?? "Not linked"} />
            </div>

            <div className="mt-4 grid gap-3">
              <TextPanel label="Violations" value={inspection.violations || "No violations recorded."} tone={inspection.violations ? "danger" : "neutral"} />
              <TextPanel label="Notes" value={inspection.notes || "No notes recorded."} />
            </div>
          </div>

          <div className="section-panel p-6 max-md:p-4">
            <div className="mb-5">
              <p className="eyebrow">Task Follow-Up</p>
              <h2 className="text-2xl font-extrabold tracking-normal text-white">Link finding to task</h2>
              <p className="mt-2 text-sm text-manifest-muted">Create a compliance task from this inspection when violations or follow-up items need an owner.</p>
            </div>
            {canCreateTask ? (
              <form action={createComplianceTaskAction} className="grid gap-3">
                <input type="hidden" name="relatedEntityType" value="inspection" />
                <input type="hidden" name="relatedEntityId" value={inspection.id} />
                <input type="hidden" name="relatedCarrierId" value={inspection.carrierId} />
                <label className="grid gap-2 text-xs font-bold uppercase tracking-[0.18em] text-manifest-quiet">
                  Title
                  <input name="title" required defaultValue={`${inspection.carrierName}: inspection follow-up`} className="form-control" />
                </label>
                <label className="grid gap-2 text-xs font-bold uppercase tracking-[0.18em] text-manifest-quiet">
                  Priority
                  <select name="priority" defaultValue={inspection.outOfService ? "critical" : inspection.violations ? "high" : "medium"} className="form-control">
                    <option value="critical">Critical</option>
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                </label>
                <label className="grid gap-2 text-xs font-bold uppercase tracking-[0.18em] text-manifest-quiet">
                  Due Date
                  <input name="dueDate" type="date" className="form-control" />
                </label>
                <label className="grid gap-2 text-xs font-bold uppercase tracking-[0.18em] text-manifest-quiet">
                  Description
                  <textarea name="description" className="form-control min-h-24 resize-y" defaultValue={inspection.violations || inspection.notes || "Review inspection report and attach correction evidence."} />
                </label>
                <button className="form-button min-h-11 w-fit px-4 text-sm">
                  <ListChecks className="mr-1.5 h-4 w-4" />
                  Create task
                </button>
              </form>
            ) : (
              <div className="empty-state">Task creation requires admin or staff access.</div>
            )}
          </div>
        </section>

        <section className="section-panel p-6 max-md:p-4">
          <div className="mb-5 flex items-center justify-between gap-3 max-md:flex-col max-md:items-start">
            <div>
              <p className="eyebrow">Inspection Evidence</p>
              <h2 className="text-2xl font-extrabold tracking-normal text-white">Documents, photos, and PDFs</h2>
              <p className="mt-2 text-sm text-manifest-muted">Files are stored under the tenant inspection path and visible only to authorized users.</p>
            </div>
          </div>

          <InspectionDocumentUploader inspectionId={inspection.id} canUpload={canUpload} />

          <div className="mt-5">
            <InspectionDocumentList documents={inspection.documents} />
          </div>
        </section>
      </div>
    </main>
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

function TextPanel({ label, value, tone = "neutral" }: { label: string; value: string; tone?: "neutral" | "danger" }) {
  return (
    <div className={`rounded-md border p-4 ${tone === "danger" ? "border-manifest-danger/35 bg-manifest-danger/10" : "border-white/10 bg-black/25"}`}>
      <span className="panel-label">{label}</span>
      <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-manifest-muted">{value}</p>
    </div>
  );
}

function Notice({ tone, message }: { tone: "success" | "error"; message: string }) {
  const classes = tone === "success" ? "border-manifest-green/35 bg-manifest-green/10 text-manifest-green" : "border-manifest-danger/40 bg-manifest-danger/10 text-manifest-danger";
  return <div className={`mb-5 rounded-md border p-3 text-sm font-bold ${classes}`}>{message}</div>;
}
