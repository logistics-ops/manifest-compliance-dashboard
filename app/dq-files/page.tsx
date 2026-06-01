import Link from "next/link";
import { ArrowLeft, ClipboardCheck, FileWarning, Plus } from "lucide-react";
import { createDriverAction } from "@/app/actions/compliance-records";
import { StatusChip } from "@/components/status-chip";
import { getCarriers } from "@/lib/data/carriers";
import { getDQFiles, type DQChecklistItem, type DQReadinessBand } from "@/lib/data/dq-files";
import { requireStaffAccess } from "@/lib/integrations/auth";

type PageProps = {
  searchParams?: Promise<{ success?: string; error?: string }>;
};

export default async function DQFilesPage({ searchParams }: PageProps) {
  const session = await requireStaffAccess();
  const params = await searchParams;
  const [files, carriers] = await Promise.all([getDQFiles(), getCarriers()]);
  const canCreateDrivers = session.platformSuperAdmin || session.role === "admin";
  const averageReadiness = files.length
    ? Math.round(files.reduce((total, file) => total + file.readinessPercentage, 0) / files.length)
    : 0;
  const missing = files.reduce((total, file) => total + file.missingCount, 0);
  const expired = files.reduce((total, file) => total + file.expiredCount, 0);
  const expiring = files.reduce((total, file) => total + file.expiringSoonCount, 0);

  return (
    <main className="min-h-screen p-8 max-md:p-4">
      <div className="mx-auto max-w-7xl">
        <header className="mb-6 flex items-start justify-between gap-4 border-b border-white/10 pb-6 max-lg:flex-col">
          <div>
            <BackLink />
            <p className="eyebrow">Audit & Compliance</p>
            <h1 className="text-5xl font-extrabold leading-[0.95] tracking-normal text-white max-md:text-3xl">
              DQ Files
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-manifest-muted">
              Driver qualification visibility using the existing drivers and driver document records. Create a driver record, then open the DQ file to upload missing or expiring documents.
            </p>
          </div>
          <div className="grid min-h-32 min-w-40 place-items-center rounded-md border border-manifest-red/45 bg-manifest-red/10 p-4 text-center">
            <ClipboardCheck className="h-7 w-7 text-manifest-red" />
            <strong className="mt-3 text-3xl text-white">{files.length}</strong>
            <span className="text-xs font-bold text-manifest-muted">drivers</span>
          </div>
        </header>

        {params?.success ? <Notice tone="success" message={params.success} /> : null}
        {params?.error ? <Notice tone="error" message={params.error} /> : null}

        <section className="mb-5 grid grid-cols-4 gap-4 max-lg:grid-cols-2 max-md:grid-cols-1">
          <Metric label="Average readiness" value={`${averageReadiness}%`} />
          <Metric label="Missing DQ items" value={missing} tone="warn" />
          <Metric label="Expired DQ items" value={expired} tone="danger" />
          <Metric label="Expiring soon" value={expiring} tone="warn" />
        </section>

        {canCreateDrivers ? (
          <section className="section-panel mb-5 p-6 max-md:p-4">
            <div className="mb-5 flex items-center justify-between gap-3 max-md:flex-col max-md:items-start">
              <div>
                <p className="eyebrow">Add Driver</p>
                <h2 className="text-2xl font-extrabold tracking-normal text-white">Create DQ file starter record</h2>
                <p className="mt-2 text-sm text-manifest-muted">This uses the existing drivers table and opens the upload workflow after creation.</p>
              </div>
              <Plus className="h-5 w-5 text-manifest-red" />
            </div>
            {carriers.length ? (
              <form action={createDriverAction} className="grid gap-4">
                <div className="grid grid-cols-3 gap-3 max-lg:grid-cols-2 max-md:grid-cols-1">
                  <label className="grid gap-2 text-xs font-bold uppercase tracking-[0.18em] text-manifest-quiet">
                    Carrier
                    <select name="carrierId" required className="form-control">
                      <option value="">Select carrier</option>
                      {carriers.map((carrier) => <option key={carrier.id} value={carrier.id}>{carrier.companyName}</option>)}
                    </select>
                  </label>
                  <Field label="First Name" name="firstName" required />
                  <Field label="Last Name" name="lastName" required />
                  <Field label="CDL Number" name="cdlNumber" />
                  <Field label="CDL State" name="cdlState" />
                  <Field label="Email" name="email" type="email" />
                  <Field label="Phone" name="phone" />
                  <label className="grid gap-2 text-xs font-bold uppercase tracking-[0.18em] text-manifest-quiet">
                    Status
                    <select name="status" defaultValue="active" className="form-control">
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                    </select>
                  </label>
                </div>
                <label className="grid gap-2 text-xs font-bold uppercase tracking-[0.18em] text-manifest-quiet">
                  Notes
                  <textarea name="notes" className="form-control min-h-20 resize-y" />
                </label>
                <button className="form-button min-h-11 w-fit px-4 text-sm">Create driver</button>
              </form>
            ) : (
              <div className="empty-state">Create a carrier before adding driver DQ records.</div>
            )}
          </section>
        ) : null}

        <section className="section-panel p-6 max-md:p-4">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div>
              <p className="eyebrow">Driver Qualification File Queue</p>
              <h2 className="text-2xl font-extrabold tracking-normal text-white">Driver document readiness</h2>
            </div>
            <FileWarning className="h-5 w-5 text-manifest-red" />
          </div>

          {files.length ? (
            <div className="space-y-3">
              {files.map((file) => (
                <details key={file.id} className="group rounded-md border border-white/10 bg-white/[0.025] transition open:border-manifest-red/35 open:bg-manifest-red/5">
                  <summary className="grid cursor-pointer list-none grid-cols-[minmax(220px,1.5fr)_minmax(170px,1fr)_120px_minmax(280px,1.5fr)] gap-4 p-4 marker:content-none max-xl:grid-cols-2 max-md:grid-cols-1">
                    <div>
                      <strong className="block text-sm text-white">{file.driverName || "Unnamed driver"}</strong>
                      <span className="mt-1 block text-xs text-manifest-muted">
                        {file.carrierName} · {file.cdlNumber || "No CDL"} {file.cdlState ? `· ${file.cdlState}` : ""}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusChip value={formatStatus(file.status)} />
                      <span className={`rounded-full border px-2.5 py-1 text-[11px] font-extrabold uppercase ${bandClass(file.readinessBand)}`}>
                        {file.readinessBand}
                      </span>
                    </div>
                    <div>
                      <span className="panel-label">Readiness</span>
                      <strong className="block text-2xl text-white">{file.readinessPercentage}%</strong>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-center text-xs font-bold">
                      <CountPill label="Missing" value={file.missingCount} tone="warn" />
                      <CountPill label="Expired" value={file.expiredCount} tone="danger" />
                      <CountPill label="Soon" value={file.expiringSoonCount} tone="warn" />
                    </div>
                  </summary>

                  <div className="border-t border-white/10 p-4 pt-0">
                    <div className="mb-3 grid grid-cols-4 gap-3 rounded-md border border-white/10 bg-black/20 p-3 text-xs text-manifest-muted max-lg:grid-cols-2 max-md:grid-cols-1">
                      <SummaryItem label="Checklist items" value={file.totalChecklistItems} />
                      <SummaryItem label="Present" value={file.presentCount} />
                      <SummaryItem label="Next expiration" value={file.nextExpiration ?? "No dated documents"} />
                      <SummaryItem label="Source" value="drivers + driver_documents" />
                    </div>
                    <Link href={`/dq-files/${file.id}`} className="form-button mb-3 min-h-10 w-fit px-4 text-sm">
                      Open DQ upload file
                    </Link>
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[860px] border-collapse">
                        <thead>
                          <tr className="text-left text-[11px] uppercase tracking-[0.14em] text-manifest-quiet">
                            <th className="border-b border-white/10 px-3 py-3">DQ Checklist Item</th>
                            <th className="border-b border-white/10 px-3 py-3">Status</th>
                            <th className="border-b border-white/10 px-3 py-3">Matched Document</th>
                            <th className="border-b border-white/10 px-3 py-3">Expiration</th>
                          </tr>
                        </thead>
                        <tbody>
                          {file.checklist.map((item) => (
                            <tr key={item.name} className="hover:bg-white/[0.025]">
                              <td className="border-b border-white/10 px-3 py-3">
                                <strong className="block text-sm text-white">{item.name}</strong>
                                {item.conditional ? <span className="text-xs text-manifest-muted">Conditional item</span> : null}
                              </td>
                              <td className="border-b border-white/10 px-3 py-3">
                                <span className={`rounded-full border px-2.5 py-1 text-[11px] font-extrabold uppercase ${checklistStatusClass(item)}`}>
                                  {formatChecklistStatus(item.status)}
                                </span>
                              </td>
                              <td className="border-b border-white/10 px-3 py-3 text-sm text-manifest-muted">
                                {item.documentName ?? (item.notApplicable ? "Not applicable" : "No matching document")}
                              </td>
                              <td className="border-b border-white/10 px-3 py-3 text-sm text-manifest-muted">
                                {item.expirationDate ?? "No expiration date"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </details>
              ))}
            </div>
          ) : (
            <div className="empty-state">No driver qualification records exist yet. Existing `drivers` and `driver_documents` tables are ready for Phase 1 data.</div>
          )}
        </section>
      </div>
    </main>
  );
}

function Notice({ tone, message }: { tone: "success" | "error"; message: string }) {
  const classes = tone === "success" ? "border-manifest-green/35 bg-manifest-green/10 text-manifest-green" : "border-manifest-danger/40 bg-manifest-danger/10 text-manifest-danger";
  return <div className={`mb-5 rounded-md border p-3 text-sm font-bold ${classes}`}>{message}</div>;
}

function Field({ label, name, type = "text", required = false }: { label: string; name: string; type?: string; required?: boolean }) {
  return (
    <label className="grid gap-2 text-xs font-bold uppercase tracking-[0.18em] text-manifest-quiet">
      {label}
      <input name={name} type={type} required={required} className="form-control" />
    </label>
  );
}

function BackLink() {
  return (
    <Link href="/" className="mb-4 inline-flex min-h-10 items-center gap-2 rounded-md border border-white/10 bg-black/30 px-3 text-sm font-bold text-manifest-muted transition hover:border-manifest-red/50 hover:bg-manifest-red/10 hover:text-white">
      <ArrowLeft className="h-4 w-4" />
      Operations Center
    </Link>
  );
}

function Metric({ label, value, tone = "neutral" }: { label: string; value: number | string; tone?: "neutral" | "warn" | "danger" }) {
  const text = tone === "danger" ? "text-manifest-danger" : tone === "warn" ? "text-manifest-amber" : "text-white";
  return (
    <article className="rounded-md border border-white/10 bg-black/30 p-4">
      <span className="panel-label">{label}</span>
      <strong className={`mt-3 block text-3xl ${text}`}>{value}</strong>
    </article>
  );
}

function formatStatus(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function CountPill({ label, value, tone }: { label: string; value: number; tone: "warn" | "danger" }) {
  const text = tone === "danger" ? "text-manifest-danger" : "text-manifest-amber";
  return (
    <span className="rounded-md border border-white/10 bg-black/25 p-2">
      <strong className={`block text-lg ${text}`}>{value}</strong>
      <span className="text-[10px] uppercase tracking-[0.12em] text-manifest-muted">{label}</span>
    </span>
  );
}

function SummaryItem({ label, value }: { label: string; value: number | string }) {
  return (
    <div>
      <span className="panel-label">{label}</span>
      <strong className="mt-1 block text-sm text-white">{value}</strong>
    </div>
  );
}

function bandClass(band: DQReadinessBand) {
  if (band === "Ready" || band === "Strong") return "border-manifest-success/40 bg-manifest-success/10 text-manifest-success";
  if (band === "Needs Review") return "border-manifest-amber/40 bg-manifest-amber/10 text-manifest-amber";
  return "border-manifest-danger/40 bg-manifest-danger/10 text-manifest-danger";
}

function checklistStatusClass(item: DQChecklistItem) {
  if (item.notApplicable) return "border-white/10 bg-white/[0.04] text-manifest-muted";
  if (item.expired || item.missing) return "border-manifest-danger/40 bg-manifest-danger/10 text-manifest-danger";
  if (item.expiringSoon) return "border-manifest-amber/40 bg-manifest-amber/10 text-manifest-amber";
  return "border-manifest-success/40 bg-manifest-success/10 text-manifest-success";
}

function formatChecklistStatus(status: DQChecklistItem["status"]) {
  return status.replace(/_/g, " ");
}
