import Link from "next/link";
import { ArrowLeft, FileWarning, Plus, Truck } from "lucide-react";
import { createVehicleAction } from "@/app/actions/compliance-records";
import { StatusChip } from "@/components/status-chip";
import { getCarriers } from "@/lib/data/carriers";
import { getVehicles, type VehicleChecklistItem, type VehicleReadinessBand } from "@/lib/data/vehicles";
import { requireStaffAccess } from "@/lib/integrations/auth";

type PageProps = {
  searchParams?: Promise<{ success?: string; error?: string }>;
};

export default async function VehiclesPage({ searchParams }: PageProps) {
  const session = await requireStaffAccess();
  const params = await searchParams;
  const [vehicles, carriers] = await Promise.all([getVehicles(), getCarriers()]);
  const canCreateVehicles = session.platformSuperAdmin || session.role === "admin";
  const averageReadiness = vehicles.length
    ? Math.round(vehicles.reduce((total, vehicle) => total + vehicle.readinessPercentage, 0) / vehicles.length)
    : 0;
  const missing = vehicles.reduce((total, vehicle) => total + vehicle.missingCount, 0);
  const expired = vehicles.reduce((total, vehicle) => total + vehicle.expiredCount, 0);
  const expiring = vehicles.reduce((total, vehicle) => total + vehicle.expiringSoonCount, 0);
  const active = vehicles.filter((vehicle) => vehicle.status === "active").length;

  return (
    <main className="min-h-screen p-8 max-md:p-4">
      <div className="mx-auto max-w-7xl">
        <header className="mb-6 flex items-start justify-between gap-4 border-b border-white/10 pb-6 max-lg:flex-col">
          <div>
            <BackLink />
            <p className="eyebrow">Audit & Compliance</p>
            <h1 className="text-5xl font-extrabold leading-[0.95] tracking-normal text-white max-md:text-3xl">
              Vehicles
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-manifest-muted">
              Vehicle and equipment readiness using the existing equipment and equipment document records. Maintenance remains parked for a later phase.
            </p>
          </div>
          <div className="grid min-h-32 min-w-40 place-items-center rounded-md border border-manifest-red/45 bg-manifest-red/10 p-4 text-center">
            <Truck className="h-7 w-7 text-manifest-red" />
            <strong className="mt-3 text-3xl text-white">{vehicles.length}</strong>
            <span className="text-xs font-bold text-manifest-muted">units</span>
          </div>
        </header>

        {params?.success ? <Notice tone="success" message={params.success} /> : null}
        {params?.error ? <Notice tone="error" message={params.error} /> : null}

        <section className="mb-5 grid grid-cols-5 gap-4 max-xl:grid-cols-3 max-md:grid-cols-1">
          <Metric label="Average readiness" value={`${averageReadiness}%`} />
          <Metric label="Active units" value={active} tone="good" />
          <Metric label="Missing docs" value={missing} tone="warn" />
          <Metric label="Expired docs" value={expired} tone="danger" />
          <Metric label="Expiring soon" value={expiring} tone="warn" />
        </section>

        {canCreateVehicles ? (
          <section className="section-panel mb-5 p-6 max-md:p-4">
            <div className="mb-5 flex items-center justify-between gap-3 max-md:flex-col max-md:items-start">
              <div>
                <p className="eyebrow">Add Vehicle</p>
                <h2 className="text-2xl font-extrabold tracking-normal text-white">Create vehicle compliance record</h2>
                <p className="mt-2 text-sm text-manifest-muted">This uses the existing equipment table and opens the vehicle document upload workflow after creation.</p>
              </div>
              <Plus className="h-5 w-5 text-manifest-red" />
            </div>
            {carriers.length ? (
              <form action={createVehicleAction} className="grid gap-4">
                <div className="grid grid-cols-3 gap-3 max-lg:grid-cols-2 max-md:grid-cols-1">
                  <label className="grid gap-2 text-xs font-bold uppercase tracking-[0.18em] text-manifest-quiet">
                    Carrier
                    <select name="carrierId" required className="form-control">
                      <option value="">Select carrier</option>
                      {carriers.map((carrier) => <option key={carrier.id} value={carrier.id}>{carrier.companyName}</option>)}
                    </select>
                  </label>
                  <Field label="Unit Number" name="unitNumber" required />
                  <Field label="Equipment Type" name="equipmentType" required />
                  <Field label="VIN" name="vin" />
                  <Field label="Plate Number" name="plateNumber" />
                  <Field label="Plate State" name="plateState" />
                  <label className="grid gap-2 text-xs font-bold uppercase tracking-[0.18em] text-manifest-quiet">
                    Status
                    <select name="status" defaultValue="active" className="form-control">
                      <option value="active">Active</option>
                      <option value="maintenance">Maintenance</option>
                      <option value="inactive">Inactive</option>
                    </select>
                  </label>
                </div>
                <label className="grid gap-2 text-xs font-bold uppercase tracking-[0.18em] text-manifest-quiet">
                  Notes
                  <textarea name="notes" className="form-control min-h-20 resize-y" />
                </label>
                <button className="form-button min-h-11 w-fit px-4 text-sm">Create vehicle</button>
              </form>
            ) : (
              <div className="empty-state">Create a carrier before adding vehicle records.</div>
            )}
          </section>
        ) : null}

        <section className="section-panel p-6 max-md:p-4">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div>
              <p className="eyebrow">Vehicle Maintenance</p>
              <h2 className="text-2xl font-extrabold tracking-normal text-white">Equipment compliance posture</h2>
            </div>
            <FileWarning className="h-5 w-5 text-manifest-red" />
          </div>

          {vehicles.length ? (
            <div className="space-y-3">
              {vehicles.map((vehicle) => (
                <details key={vehicle.id} className="group rounded-md border border-white/10 bg-white/[0.025] transition open:border-manifest-red/35 open:bg-manifest-red/5">
                  <summary className="grid cursor-pointer list-none grid-cols-[minmax(220px,1.4fr)_minmax(220px,1.2fr)_120px_minmax(280px,1.5fr)] gap-4 p-4 marker:content-none max-xl:grid-cols-2 max-md:grid-cols-1">
                    <div>
                      <strong className="block text-sm text-white">Unit {vehicle.unitNumber}</strong>
                      <span className="mt-1 block text-xs text-manifest-muted">{vehicle.carrierName} · {vehicle.equipmentType}</span>
                      <span className="mt-1 block text-xs text-manifest-quiet">
                        {vehicle.plateNumber || "No plate"} {vehicle.plateState ? `· ${vehicle.plateState}` : ""} · {vehicle.vin || "No VIN"}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusChip value={formatStatus(vehicle.status)} />
                      <span className={`rounded-full border px-2.5 py-1 text-[11px] font-extrabold uppercase ${bandClass(vehicle.readinessBand)}`}>
                        {vehicle.readinessBand}
                      </span>
                    </div>
                    <div>
                      <span className="panel-label">Readiness</span>
                      <strong className="block text-2xl text-white">{vehicle.readinessPercentage}%</strong>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-center text-xs font-bold">
                      <CountPill label="Missing" value={vehicle.missingCount} tone="warn" />
                      <CountPill label="Expired" value={vehicle.expiredCount} tone="danger" />
                      <CountPill label="Soon" value={vehicle.expiringSoonCount} tone="warn" />
                    </div>
                  </summary>

                  <div className="border-t border-white/10 p-4 pt-0">
                    <div className="mb-3 grid grid-cols-4 gap-3 rounded-md border border-white/10 bg-black/20 p-3 text-xs text-manifest-muted max-lg:grid-cols-2 max-md:grid-cols-1">
                      <SummaryItem label="Checklist items" value={vehicle.totalChecklistItems} />
                      <SummaryItem label="Present" value={vehicle.presentCount} />
                      <SummaryItem label="Next expiration" value={vehicle.nextExpiration ?? "No dated documents"} />
                      <SummaryItem
                        label="Critical compliance issues"
                        value={vehicle.criticalBlockers.length ? vehicle.criticalBlockers.join(", ") : "None"}
                      />
                    </div>
                    <Link href={`/vehicles/${vehicle.id}`} className="form-button mb-3 min-h-10 w-fit px-4 text-sm">
                      Open vehicle compliance file
                    </Link>
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[860px] border-collapse">
                        <thead>
                          <tr className="text-left text-[11px] uppercase tracking-[0.14em] text-manifest-quiet">
                            <th className="border-b border-white/10 px-3 py-3">Vehicle Checklist Item</th>
                            <th className="border-b border-white/10 px-3 py-3">Status</th>
                            <th className="border-b border-white/10 px-3 py-3">Matched Document</th>
                            <th className="border-b border-white/10 px-3 py-3">Expiration</th>
                          </tr>
                        </thead>
                        <tbody>
                          {vehicle.checklist.map((item) => (
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
            <div className="empty-state">No vehicle records exist yet. Existing `equipment` and `equipment_documents` tables are ready for Phase 1 data.</div>
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

function Metric({ label, value, tone = "neutral" }: { label: string; value: number | string; tone?: "neutral" | "good" | "warn" | "danger" }) {
  const text = tone === "good" ? "text-manifest-green" : tone === "danger" ? "text-manifest-danger" : tone === "warn" ? "text-manifest-amber" : "text-white";
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

function bandClass(band: VehicleReadinessBand) {
  if (band === "Ready" || band === "Good") return "border-manifest-success/40 bg-manifest-success/10 text-manifest-success";
  if (band === "Needs Review") return "border-manifest-amber/40 bg-manifest-amber/10 text-manifest-amber";
  return "border-manifest-danger/40 bg-manifest-danger/10 text-manifest-danger";
}

function checklistStatusClass(item: VehicleChecklistItem) {
  if (item.notApplicable) return "border-white/10 bg-white/[0.04] text-manifest-muted";
  if (item.expired || item.missing) return "border-manifest-danger/40 bg-manifest-danger/10 text-manifest-danger";
  if (item.expiringSoon) return "border-manifest-amber/40 bg-manifest-amber/10 text-manifest-amber";
  return "border-manifest-success/40 bg-manifest-success/10 text-manifest-success";
}

function formatChecklistStatus(status: VehicleChecklistItem["status"]) {
  return status.replace(/_/g, " ");
}
