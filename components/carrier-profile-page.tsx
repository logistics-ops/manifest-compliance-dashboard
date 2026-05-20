import Link from "next/link";
import type { ReactNode } from "react";
import {
  ArrowLeft,
  Bell,
  ClipboardCheck,
  FileArchive,
  FileCheck2,
  FileText,
  LayoutDashboard,
  Mail,
  Phone,
  Route,
  ShieldAlert,
  Truck,
} from "lucide-react";
import {
  addComplianceNoteAction,
  updateCarrierAction,
  updateCarrierStatusAction,
} from "@/app/actions/carriers";
import {
  getActionItems,
  getCarrierAlerts,
  getCarrierDocuments,
  getComplianceScoreBreakdown,
  getScoreSummary,
} from "@/lib/compliance";
import type { Carrier, EnrichedDocument } from "@/types/carrier";
import type { Load } from "@/types/load";
import { StatusChip } from "@/components/status-chip";
import { logoutAction } from "@/app/login/actions";
import { canManageCarriers, canManageCompliance, canUploadCarrierDocuments } from "@/lib/auth/permissions";
import type { AuthSession } from "@/types/carrier";
import { CarrierDocumentUploader } from "@/components/carrier-document-uploader";
import { CarrierAssignedLoads } from "@/components/carrier-assigned-loads";

export function CarrierProfilePage({ carrier, session, loads = [] }: { carrier: Carrier; session: AuthSession; loads?: Load[] }) {
  const documents = getCarrierDocuments(carrier);
  const actions = getActionItems(carrier);
  const alerts = getCarrierAlerts(carrier);
  const scoreBreakdown = getComplianceScoreBreakdown(carrier);
  const mayManageCarriers = canManageCarriers(session);
  const mayManageCompliance = canManageCompliance(session);
  const mayUploadDocuments = canUploadCarrierDocuments(session, carrier);

  return (
    <div className="grid min-h-screen grid-cols-[260px_minmax(0,1fr)] max-xl:grid-cols-1">
      {!mayManageCompliance ? <CarrierPortalSidebar carrierId={carrier.id} /> : null}
      <main className="min-h-screen p-8 max-md:p-4">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          {mayManageCompliance ? (
            <Link
              href="/"
              className="inline-flex min-h-10 items-center gap-2 rounded-md border border-white/10 bg-black/30 px-3 text-sm font-bold text-manifest-muted transition hover:border-manifest-red/50 hover:bg-manifest-red/10 hover:text-white"
            >
              <ArrowLeft className="h-4 w-4" />
              Compliance dashboard
            </Link>
          ) : (
            <div className="flex flex-wrap gap-2">
              <span className="inline-flex min-h-10 items-center gap-2 rounded-md border border-white/10 bg-black/30 px-3 text-sm font-bold text-manifest-muted">
                <Truck className="h-4 w-4" />
                Carrier portal
              </span>
              <Link
                href="/loads"
                className="inline-flex min-h-10 items-center gap-2 rounded-md border border-white/10 bg-black/30 px-3 text-sm font-bold text-manifest-muted transition hover:border-manifest-red/50 hover:bg-manifest-red/10 hover:text-white"
              >
                <Route className="h-4 w-4" />
                Loads
              </Link>
              <Link
                href="/invoices"
                className="inline-flex min-h-10 items-center gap-2 rounded-md border border-white/10 bg-black/30 px-3 text-sm font-bold text-manifest-muted transition hover:border-manifest-red/50 hover:bg-manifest-red/10 hover:text-white"
              >
                <FileText className="h-4 w-4" />
                Invoices
              </Link>
            </div>
          )}
          <form action={logoutAction}>
            <button className="inline-flex min-h-10 items-center rounded-md border border-white/10 bg-black/30 px-3 text-sm font-bold text-manifest-muted transition hover:border-manifest-red/50 hover:bg-manifest-red/10 hover:text-white">
              Sign out
            </button>
          </form>
        </div>

        <section className="section-panel mb-5 overflow-hidden border-manifest-red/30 bg-[linear-gradient(110deg,rgba(227,25,55,0.24),rgba(17,17,20,0.88)_42%,rgba(255,255,255,0.045)),repeating-linear-gradient(135deg,rgba(255,255,255,0.06)_0_1px,transparent_1px_18px)] p-7 max-md:p-5">
          <div className="flex items-start justify-between gap-8 max-lg:flex-col">
            <div>
              <p className="eyebrow">Carrier Compliance Profile</p>
              <span className="mb-2 block text-sm font-bold text-manifest-muted">{session.organizationName}</span>
              <h1 className="text-5xl font-extrabold leading-[0.95] tracking-normal text-white max-md:text-3xl">
                {carrier.companyName}
              </h1>
              <div className="mt-5 flex flex-wrap gap-2">
                <StatusChip value={carrier.status} type="carrier" />
                <StatusChip value={scoreBreakdown.tier} type="risk" />
                {alerts.map((alert) => (
                  <StatusChip key={alert} value={alert} />
                ))}
              </div>
            </div>

            <div className="grid min-h-40 min-w-44 place-items-center rounded-md border border-manifest-red/55 bg-black/45 p-4 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
              <span className="text-xs font-bold uppercase tracking-[0.18em] text-manifest-muted">Risk Level</span>
              <strong className="text-5xl leading-none text-white">{scoreBreakdown.finalScore}</strong>
              <span className="text-xs font-bold text-manifest-red">{scoreBreakdown.tier}</span>
            </div>
          </div>
        </section>

        <section className="mb-5 grid grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)] gap-5 max-xl:grid-cols-1">
          <div className="section-panel p-6 max-md:p-4">
            <div className="mb-5 flex items-center justify-between gap-3 max-md:flex-col max-md:items-stretch">
              <div>
                <p className="eyebrow">Carrier Information</p>
                <h2 className="text-2xl font-extrabold tracking-normal">Operating profile</h2>
              </div>
              <Truck className="h-5 w-5 text-manifest-red" />
            </div>

            <div className="grid grid-cols-3 gap-3 max-lg:grid-cols-2 max-md:grid-cols-1">
              <InfoTile label="MC Number" value={carrier.mcNumber} />
              <InfoTile label="DOT Number" value={carrier.dotNumber} />
              <InfoTile label="Contact" value={carrier.contactName} />
              <InfoTile label="Phone" value={carrier.phone} icon={<Phone className="h-3.5 w-3.5" />} />
              <InfoTile label="Email" value={carrier.email} icon={<Mail className="h-3.5 w-3.5" />} />
              <InfoTile label="Status" value={carrier.status} />
            </div>

            <div className="mt-5 rounded-md border border-white/10 bg-black/30 p-4">
              <span className="panel-label">Notes</span>
              <p className="text-sm leading-6 text-manifest-muted">{carrier.notes}</p>
            </div>

            {mayManageCarriers ? (
              <form action={updateCarrierAction} className="mt-5 grid gap-4 rounded-md border border-white/10 bg-black/30 p-4">
                <input type="hidden" name="carrierId" value={carrier.id} />
                <span className="panel-label">Edit Carrier Information</span>
                <div className="grid grid-cols-2 gap-3 max-md:grid-cols-1">
                  <ProfileField label="Company" name="companyName" defaultValue={carrier.companyName} required />
                  <ProfileField label="MC Number" name="mcNumber" defaultValue={carrier.mcNumber} required />
                  <ProfileField label="DOT Number" name="dotNumber" defaultValue={carrier.dotNumber} required />
                  <ProfileField label="Contact" name="contactName" defaultValue={carrier.contactName} />
                  <ProfileField label="Phone" name="phone" defaultValue={carrier.phone} />
                  <ProfileField label="Email" name="email" defaultValue={carrier.email} type="email" />
                </div>
                <label className="grid gap-2 text-xs font-bold uppercase tracking-[0.18em] text-manifest-quiet">
                  Notes
                  <textarea name="notes" defaultValue={carrier.notes} className="form-control min-h-24 resize-y" />
                </label>
                <button className="form-button w-fit">Save carrier information</button>
              </form>
            ) : null}
          </div>

          <div className="section-panel p-6 max-md:p-4">
            <div className="mb-5 flex items-center justify-between gap-3">
              <div>
                <p className="eyebrow">Risk & Actions</p>
                <h2 className="text-2xl font-extrabold tracking-normal">Compliance score</h2>
              </div>
              <ShieldAlert className="h-5 w-5 text-manifest-red" />
            </div>

            <div className="grid justify-items-center text-center">
              <div
                className="mb-4 grid h-44 w-44 place-items-center rounded-full"
                style={{
                  background: `radial-gradient(circle at center, #111114 0 58%, transparent 59%), conic-gradient(#e31937 ${scoreBreakdown.finalScore}%, #2c2c32 0)`,
                }}
              >
                <div>
                  <strong className="block text-5xl leading-none">{scoreBreakdown.finalScore}</strong>
                  <span className="text-manifest-muted">/100</span>
                </div>
              </div>
              <StatusChip value={scoreBreakdown.tier} type="risk" />
              <p className="mt-3 text-sm leading-6 text-manifest-muted">{getScoreSummary(carrier)}</p>
            </div>

            <div className="mt-5 border-t border-white/10 pt-5">
              <span className="panel-label">Action Items</span>
              <ul className="grid gap-2 pl-5 text-sm leading-6 text-manifest-muted">
                {actions.map((action) => (
                  <li key={action}>{action}</li>
                ))}
              </ul>
            </div>

            {mayManageCarriers ? (
              <form action={updateCarrierStatusAction} className="mt-5 grid gap-3 border-t border-white/10 pt-5">
                <input type="hidden" name="carrierId" value={carrier.id} />
                <label className="grid gap-2 text-xs font-bold uppercase tracking-[0.18em] text-manifest-quiet">
                  Update Status
                  <select name="status" defaultValue={carrier.status} className="form-control">
                    <option>Active</option>
                    <option>Pending</option>
                    <option>Suspended</option>
                    <option>Inactive</option>
                  </select>
                </label>
                <button className="form-button">Save status</button>
              </form>
            ) : null}

            {mayManageCompliance ? (
              <form action={addComplianceNoteAction} className="mt-5 grid gap-3 border-t border-white/10 pt-5">
                <input type="hidden" name="carrierId" value={carrier.id} />
                <label className="grid gap-2 text-xs font-bold uppercase tracking-[0.18em] text-manifest-quiet">
                  Add Compliance Note
                  <textarea
                    name="note"
                    required
                    placeholder="Add internal compliance note."
                    className="form-control min-h-24 resize-y"
                  />
                </label>
                <button className="form-button">Add note</button>
              </form>
            ) : null}
          </div>
        </section>

        <section id="documents" className="section-panel p-6 max-md:p-4">
          <div className="mb-5 flex items-center justify-between gap-3 max-md:flex-col max-md:items-stretch">
            <div>
              <p className="eyebrow">Compliance Checklist</p>
              <h2 className="text-2xl font-extrabold tracking-normal">Document status and expirations</h2>
            </div>
            <div className="flex flex-wrap gap-2">
              <StatusChip value={`${documents.length} required documents`} />
              <FileCheck2 className="h-5 w-5 text-manifest-red" />
            </div>
          </div>

          <div className="grid gap-3">
            {documents.map((doc) => (
              <DocumentUploadRow key={doc.name} carrier={carrier} document={doc} canEdit={mayUploadDocuments} />
            ))}
          </div>
        </section>

        <CarrierAssignedLoads carrierId={carrier.id} loads={loads} session={session} />
      </div>
      </main>
    </div>
  );
}

function DocumentUploadRow({
  carrier,
  document,
  canEdit,
}: {
  carrier: Carrier;
  document: EnrichedDocument;
  canEdit: boolean;
}) {
  return (
    <article className={`section-panel p-3.5 ${documentBorder(document.status)}`}>
      <div className="grid grid-cols-[minmax(260px,0.7fr)_minmax(0,1.7fr)] gap-3 max-xl:grid-cols-1">
        <div className="min-w-0 rounded-md border border-white/10 bg-black/20 p-3">
          <div className="flex items-start gap-3">
          <span className="mt-1 grid h-9 w-9 shrink-0 place-items-center rounded-md border border-white/10 bg-black/30">
            <ClipboardCheck className="h-4 w-4 text-manifest-red" />
          </span>
          <div className="min-w-0">
            <h3 className="mb-1 truncate text-base font-bold leading-tight text-white">{document.name}</h3>
            <div className="flex flex-wrap gap-2">
              <StatusChip value={document.uploaded ? "Uploaded" : "Not uploaded"} />
              <StatusChip value={document.status} type="document" />
            </div>
          </div>
        </div>

          <dl className="mt-3 grid grid-cols-3 gap-2 max-sm:grid-cols-1">
          <ChecklistTerm label="Expiration" value={document.expirationDate ?? "No expiration"} />
          <ChecklistTerm label="Days" value={document.daysUntilExpiration ?? "N/A"} />
          <ChecklistTerm label="File" value={document.fileName ?? "No file uploaded"} />
        </dl>
        </div>

        <CarrierDocumentUploader carrierId={carrier.id} document={document} canEdit={canEdit} />
      </div>
    </article>
  );
}

function CarrierPortalSidebar({ carrierId }: { carrierId: string }) {
  const items = [
    { label: "Dashboard", href: `/carriers/${carrierId}`, icon: LayoutDashboard },
    { label: "Loads", href: "/loads", icon: Route },
    { label: "Documents", href: "#documents", icon: FileCheck2 },
    { label: "Invoices", href: "/invoices", icon: FileText },
    { label: "Archives", href: "/archives", icon: FileArchive },
    { label: "Notifications", href: "#notifications", icon: Bell },
  ];

  return (
    <aside className="sticky top-0 flex h-screen flex-col border-r border-white/10 bg-black/75 p-6 backdrop-blur-2xl max-xl:static max-xl:h-auto max-xl:border-b max-xl:border-r-0">
      <div className="border-b border-white/10 pb-5">
        <p className="eyebrow">Carrier Portal</p>
        <h2 className="text-xl font-extrabold tracking-normal text-white">ManifestOS</h2>
      </div>
      <nav className="mt-5 grid gap-2 max-xl:grid-cols-3 max-md:grid-cols-1" aria-label="Carrier portal">
        {items.map(({ label, href, icon: Icon }) => (
          <Link
            key={label}
            href={href}
            className="flex min-h-10 items-center gap-3 rounded-md border border-transparent px-3 text-sm font-semibold text-manifest-muted transition hover:border-manifest-red/50 hover:bg-manifest-red/10 hover:text-white"
          >
            <Icon className="h-4 w-4 shrink-0" />
            <span className="truncate">{label}</span>
          </Link>
        ))}
      </nav>
    </aside>
  );
}

function ProfileField({
  label,
  name,
  defaultValue,
  type = "text",
  required = false,
}: {
  label: string;
  name: string;
  defaultValue: string;
  type?: string;
  required?: boolean;
}) {
  return (
    <label className="grid gap-2 text-xs font-bold uppercase tracking-[0.18em] text-manifest-quiet">
      {label}
      <input name={name} type={type} defaultValue={defaultValue} required={required} className="form-control" />
    </label>
  );
}

function InfoTile({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon?: ReactNode;
}) {
  return (
    <div className="min-h-20 rounded-md border border-white/10 bg-white/[0.025] p-3">
      <span className="mb-2 flex items-center gap-2 text-[11px] font-extrabold uppercase text-manifest-quiet">
        {icon}
        {label}
      </span>
      <strong className="text-sm text-white">{value}</strong>
    </div>
  );
}

function ChecklistTerm({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="min-w-0 rounded-md border border-white/10 bg-white/[0.025] px-2.5 py-2">
      <dt className="text-[10px] font-extrabold uppercase text-manifest-quiet">{label}</dt>
      <dd className="mt-1 truncate text-sm font-semibold text-white" title={String(value)}>
        {value}
      </dd>
    </div>
  );
}

function documentBorder(status: string) {
  if (status === "Valid") return "border-manifest-green/30";
  if (status === "Expiring Soon") return "border-manifest-amber/55";
  return "border-manifest-danger/60";
}
