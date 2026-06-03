import Link from "next/link";
import { ArrowLeft, ClipboardCheck, Plus, ShieldAlert } from "lucide-react";
import { createInspectionAction } from "@/app/actions/inspections";
import { StatusChip } from "@/components/status-chip";
import { getCarriers } from "@/lib/data/carriers";
import { getDQFiles } from "@/lib/data/dq-files";
import { getInspectionReports, getInspectionSummary, type InspectionReport } from "@/lib/data/inspections";
import { getVehicles } from "@/lib/data/vehicles";
import { requireSession } from "@/lib/integrations/auth";
import { canRoleManageCompliance } from "@/lib/security/tenant-rules";

type PageProps = {
  searchParams?: Promise<{ success?: string; error?: string }>;
};

export default async function InspectionsPage({ searchParams }: PageProps) {
  const session = await requireSession();
  const params = await searchParams;
  const [inspections, carriers, dqFiles, vehicles] = await Promise.all([
    getInspectionReports(),
    getCarriers(),
    getDQFiles(),
    getVehicles(),
  ]);
  const summary = getInspectionSummary(inspections);
  const canCreate = session.platformSuperAdmin || canRoleManageCompliance(session.role);

  return (
    <main className="min-h-screen p-8 max-md:p-4">
      <div className="mx-auto max-w-7xl">
        <header className="mb-6 flex items-start justify-between gap-4 border-b border-white/10 pb-6 max-lg:flex-col">
          <div>
            <BackLink />
            <p className="eyebrow">Audit & Compliance</p>
            <h1 className="text-5xl font-extrabold leading-[0.95] tracking-normal text-white max-md:text-3xl">
              Inspection Reports
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-manifest-muted">
              Track inspection evidence, violations, out-of-service findings, and task follow-up without enabling SAFER or safety score calculations yet.
            </p>
          </div>
          <div className="grid min-h-32 min-w-40 place-items-center rounded-md border border-manifest-red/45 bg-manifest-red/10 p-4 text-center">
            <ClipboardCheck className="h-7 w-7 text-manifest-red" />
            <strong className="mt-3 text-3xl text-white">{summary.total}</strong>
            <span className="text-xs font-bold text-manifest-muted">reports</span>
          </div>
        </header>

        {params?.success ? <Notice tone="success" message={params.success} /> : null}
        {params?.error ? <Notice tone="error" message={params.error} /> : null}

        <section className="mb-5 grid grid-cols-5 gap-4 max-xl:grid-cols-3 max-md:grid-cols-1">
          <Metric label="Total Reports" value={summary.total} />
          <Metric label="Open Reports" value={summary.open} tone={summary.open ? "warn" : "good"} />
          <Metric label="With Violations" value={summary.withViolations} tone={summary.withViolations ? "danger" : "good"} />
          <Metric label="Out Of Service" value={summary.outOfService} tone={summary.outOfService ? "danger" : "good"} />
          <Metric label="Evidence Files" value={summary.documentCount} />
        </section>

        {canCreate ? (
          <section className="section-panel mb-5 p-6 max-md:p-4">
            <div className="mb-5 flex items-center justify-between gap-3 max-md:flex-col max-md:items-start">
              <div>
                <p className="eyebrow">Create Inspection Record</p>
                <h2 className="text-2xl font-extrabold tracking-normal text-white">Record inspection findings</h2>
                <p className="mt-2 text-sm text-manifest-muted">Create the report first, then attach inspection photos, reports, or supporting PDFs on the detail page.</p>
              </div>
              <Plus className="h-5 w-5 text-manifest-red" />
            </div>
            {carriers.length ? (
              <form action={createInspectionAction} className="grid gap-4">
                <div className="grid grid-cols-3 gap-3 max-lg:grid-cols-2 max-md:grid-cols-1">
                  <label className="grid gap-2 text-xs font-bold uppercase tracking-[0.18em] text-manifest-quiet">
                    Carrier
                    <select name="carrierId" required className="form-control">
                      <option value="">Select carrier</option>
                      {carriers.map((carrier) => <option key={carrier.id} value={carrier.id}>{carrier.companyName}</option>)}
                    </select>
                  </label>
                  <Field label="Inspection Date" name="inspectionDate" type="date" required />
                  <label className="grid gap-2 text-xs font-bold uppercase tracking-[0.18em] text-manifest-quiet">
                    Inspection Type
                    <select name="inspectionType" required className="form-control">
                      <option value="">Select type</option>
                      <option value="Roadside">Roadside</option>
                      <option value="DOT Audit">DOT Audit</option>
                      <option value="Terminal">Terminal</option>
                      <option value="Post-Accident">Post-Accident</option>
                      <option value="Other">Other</option>
                    </select>
                  </label>
                  <Field label="Location" name="location" />
                  <label className="grid gap-2 text-xs font-bold uppercase tracking-[0.18em] text-manifest-quiet">
                    Driver
                    <select name="driverId" className="form-control">
                      <option value="">Optional driver</option>
                      {dqFiles.map((driver) => <option key={driver.id} value={driver.id}>{driver.driverName || "Unnamed driver"} · {driver.carrierName}</option>)}
                    </select>
                  </label>
                  <label className="grid gap-2 text-xs font-bold uppercase tracking-[0.18em] text-manifest-quiet">
                    Vehicle
                    <select name="equipmentId" className="form-control">
                      <option value="">Optional vehicle</option>
                      {vehicles.map((vehicle) => <option key={vehicle.id} value={vehicle.id}>Unit {vehicle.unitNumber} · {vehicle.carrierName}</option>)}
                    </select>
                  </label>
                </div>
                <label className="flex min-h-11 items-center gap-3 rounded-md border border-white/10 bg-black/25 px-3 text-sm font-bold text-manifest-muted">
                  <input name="outOfService" type="checkbox" className="h-4 w-4 accent-manifest-red" />
                  Out-of-service finding
                </label>
                <label className="grid gap-2 text-xs font-bold uppercase tracking-[0.18em] text-manifest-quiet">
                  Violations
                  <textarea name="violations" className="form-control min-h-24 resize-y" placeholder="List violations, citations, or findings." />
                </label>
                <label className="grid gap-2 text-xs font-bold uppercase tracking-[0.18em] text-manifest-quiet">
                  Notes
                  <textarea name="notes" className="form-control min-h-20 resize-y" placeholder="Internal compliance notes." />
                </label>
                <button className="form-button min-h-11 w-fit px-4 text-sm">Create inspection</button>
              </form>
            ) : (
              <div className="empty-state">Create a carrier before adding inspection records.</div>
            )}
          </section>
        ) : null}

        <section className="section-panel p-6 max-md:p-4">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div>
              <p className="eyebrow">Inspection Queue</p>
              <h2 className="text-2xl font-extrabold tracking-normal text-white">Reports and findings</h2>
            </div>
            <ShieldAlert className="h-5 w-5 text-manifest-red" />
          </div>
          {inspections.length ? (
            <div className="grid gap-3">
              {inspections.map((inspection) => <InspectionRow key={inspection.id} inspection={inspection} />)}
            </div>
          ) : (
            <div className="empty-state">No inspection reports yet.</div>
          )}
        </section>
      </div>
    </main>
  );
}

function InspectionRow({ inspection }: { inspection: InspectionReport }) {
  return (
    <article className="grid grid-cols-[minmax(220px,1fr)_minmax(220px,1fr)_160px_140px_auto] items-center gap-4 rounded-md border border-white/10 bg-black/25 p-4 max-xl:grid-cols-2 max-md:grid-cols-1">
      <div>
        <strong className="block text-sm text-white">{inspection.inspectionType}</strong>
        <span className="mt-1 block text-xs text-manifest-muted">{inspection.carrierName}</span>
      </div>
      <div className="text-sm text-manifest-muted">
        <span className="block">{inspection.location || "No location"}</span>
        <span className="mt-1 block text-xs text-manifest-quiet">{inspection.driverName ?? "No driver"} · {inspection.equipmentLabel ?? "No vehicle"}</span>
      </div>
      <div>
        <span className="panel-label">Date</span>
        <strong className="block text-sm text-white">{inspection.inspectionDate}</strong>
      </div>
      <div className="flex flex-wrap gap-2">
        <StatusChip value={inspection.outOfService ? "Out of Service" : inspection.status.replace(/_/g, " ")} />
        {inspection.violations ? <StatusChip value="Violations" /> : null}
      </div>
      <Link href={`/inspections/${inspection.id}`} className="form-button justify-self-end max-xl:justify-self-start">
        Open report
      </Link>
    </article>
  );
}

function Metric({ label, value, tone = "neutral" }: { label: string; value: string | number; tone?: "neutral" | "good" | "warn" | "danger" }) {
  const toneClass = tone === "danger" ? "text-manifest-danger" : tone === "warn" ? "text-manifest-gold" : tone === "good" ? "text-manifest-green" : "text-white";
  return (
    <div className="rounded-md border border-white/10 bg-black/30 p-4">
      <span className="panel-label">{label}</span>
      <strong className={`mt-2 block text-3xl ${toneClass}`}>{value}</strong>
    </div>
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
