import Link from "next/link";
import type { ReactNode } from "react";
import {
  ArrowLeft,
  Bell,
  ClipboardCheck,
  Copy,
  FileCheck2,
  Link2,
  LayoutDashboard,
  ListChecks,
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
import { createUploadLinkAction, revokeUploadLinkAction } from "@/app/actions/upload-links";
import {
  getActionItems,
  getCarrierAlerts,
  getCarrierDocuments,
  getComplianceScoreBreakdown,
  getScoreSummary,
} from "@/lib/compliance";
import type { Carrier, EnrichedDocument } from "@/types/carrier";
import type { Load } from "@/types/load";
import type { DQFileRecord } from "@/lib/data/dq-files";
import type { UploadLinkRecord } from "@/lib/data/upload-links";
import type { VehicleRecord } from "@/lib/data/vehicles";
import type { CarrierOnboardingProgress } from "@/lib/onboarding-progress";
import { StatusChip } from "@/components/status-chip";
import { logoutAction } from "@/app/login/actions";
import { canManageCarriers, canManageCompliance, canUploadCarrierDocuments } from "@/lib/auth/permissions";
import type { AuthSession } from "@/types/carrier";
import { CarrierDocumentUploader } from "@/components/carrier-document-uploader";
import { CarrierAssignedLoads } from "@/components/carrier-assigned-loads";
import { documentSlug } from "@/lib/action-center";

export function CarrierProfilePage({
  carrier,
  session,
  loads = [],
  drivers = [],
  vehicles = [],
  uploadLinks = [],
  onboardingProgress,
  generatedUploadLink = null,
  message = null,
}: {
  carrier: Carrier;
  session: AuthSession;
  loads?: Load[];
  drivers?: DQFileRecord[];
  vehicles?: VehicleRecord[];
  uploadLinks?: UploadLinkRecord[];
  onboardingProgress: CarrierOnboardingProgress;
  generatedUploadLink?: string | null;
  message?: { type: "success" | "error"; text: string } | null;
}) {
  const documents = getCarrierDocuments(carrier);
  const actions = getActionItems(carrier);
  const alerts = getCarrierAlerts(carrier);
  const scoreBreakdown = getComplianceScoreBreakdown(carrier);
  const mayManageCarriers = canManageCarriers(session);
  const mayManageCompliance = canManageCompliance(session);
  const mayUploadDocuments = canUploadCarrierDocuments(session, carrier);
  const pageShellClass = mayManageCompliance
    ? "min-h-screen"
    : "grid min-h-screen grid-cols-[260px_minmax(0,1fr)] max-xl:grid-cols-1";

  return (
    <div className={pageShellClass}>
      {!mayManageCompliance ? <CarrierPortalSidebar carrierId={carrier.id} /> : null}
      <main className="min-h-screen p-8 max-md:p-4">
      <div className="w-full">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          {mayManageCompliance ? (
            <Link
              href="/"
              className="inline-flex min-h-10 items-center gap-2 rounded-md border border-white/10 bg-black/30 px-3 text-sm font-bold text-manifest-muted transition hover:border-manifest-red/50 hover:bg-manifest-red/10 hover:text-white"
            >
              <ArrowLeft className="h-4 w-4" />
                Operations Center
            </Link>
          ) : (
            <div className="flex flex-wrap gap-2">
              <span className="inline-flex min-h-10 items-center gap-2 rounded-md border border-white/10 bg-black/30 px-3 text-sm font-bold text-manifest-muted">
                <Truck className="h-4 w-4" />
                Carrier portal
              </span>
              <button
                type="button"
                className="inline-flex min-h-10 cursor-not-allowed items-center gap-2 rounded-md border border-white/5 bg-black/20 px-3 text-sm font-bold text-manifest-quiet opacity-80"
                disabled
                title="Loads module coming soon"
              >
                <Route className="h-4 w-4" />
                Loads (Coming Soon)
              </button>
            </div>
          )}
          <form action={logoutAction}>
            <button className="inline-flex min-h-10 items-center rounded-md border border-white/10 bg-black/30 px-3 text-sm font-bold text-manifest-muted transition hover:border-manifest-red/50 hover:bg-manifest-red/10 hover:text-white">
              Sign out
            </button>
          </form>
        </div>

        {message ? <Notice tone={message.type} message={message.text} /> : null}

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

        <OnboardingProgressCard progress={onboardingProgress} />

        {mayManageCompliance ? (
          <UploadLinkPanel
            carrierId={carrier.id}
            drivers={drivers}
            vehicles={vehicles}
            uploadLinks={uploadLinks}
            generatedUploadLink={generatedUploadLink}
          />
        ) : null}

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

function OnboardingProgressCard({ progress }: { progress: CarrierOnboardingProgress }) {
  return (
    <section className="section-panel mb-5 p-6 max-md:p-4">
      <div className="mb-5 flex items-start justify-between gap-4 max-lg:flex-col">
        <div>
          <p className="eyebrow">Carrier Onboarding Progress</p>
          <h2 className="text-2xl font-extrabold tracking-normal text-white">Intake completion</h2>
          <p className="mt-2 text-sm leading-6 text-manifest-muted">
            Real-time completion from company documents, driver files, vehicle files, maintenance records, and required compliance documents.
          </p>
        </div>
        <div className="grid min-w-48 gap-2 rounded-md border border-white/10 bg-black/30 p-4">
          <span className={`w-fit rounded-full border px-2.5 py-1 text-[11px] font-extrabold uppercase ${onboardingBadgeClass(progress.status)}`}>
            {progress.status}
          </span>
          <strong className="text-4xl leading-none text-white">{progress.percentage}%</strong>
          <div className="h-2 overflow-hidden rounded-full bg-white/10">
            <div className="h-full rounded-full bg-manifest-red" style={{ width: `${progress.percentage}%` }} />
          </div>
        </div>
      </div>

      <div className="mb-5 grid grid-cols-4 gap-3 max-lg:grid-cols-2 max-sm:grid-cols-1">
        <ProgressMetric label="Completed" value={progress.completedCount} tone="good" />
        <ProgressMetric label="Missing" value={progress.missingCount} tone="warn" />
        <ProgressMetric label="Expiring" value={progress.expiringCount} tone="warn" />
        <ProgressMetric label="Expired" value={progress.expiredCount} tone="danger" />
      </div>

      <div className="grid gap-3">
        {progress.categories.map((category) => {
          const issueItems = [...category.expiredItems, ...category.missingItems, ...category.expiringItems].slice(0, 4);
          return (
            <article key={category.name} className="rounded-md border border-white/10 bg-black/25 p-4">
              <div className="mb-3 flex items-center justify-between gap-3 max-md:flex-col max-md:items-stretch">
                <div>
                  <h3 className="text-base font-extrabold text-white">{category.name}</h3>
                  <p className="mt-1 text-xs font-bold text-manifest-muted">
                    {category.completedItems.length}/{category.totalItems} complete · {category.missingItems.length} missing · {category.expiringItems.length} expiring
                  </p>
                </div>
                <strong className="text-lg text-white">{category.percentage}%</strong>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-white/10">
                <div className="h-full rounded-full bg-manifest-red" style={{ width: `${category.percentage}%` }} />
              </div>
              {issueItems.length ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {issueItems.map((item) => (
                    <Link
                      key={item.id}
                      href={item.correctionHref}
                      className="inline-flex min-h-8 items-center rounded-md border border-white/10 bg-white/[0.035] px-2.5 text-xs font-bold text-manifest-muted transition hover:border-manifest-red/50 hover:bg-manifest-red/10 hover:text-white"
                    >
                      {item.label}
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="mt-3 text-xs font-bold text-manifest-green">No missing or expiring items in this category.</p>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}

function ProgressMetric({ label, value, tone }: { label: string; value: number; tone: "good" | "warn" | "danger" }) {
  const toneClass = tone === "good" ? "text-manifest-green" : tone === "warn" ? "text-manifest-amber" : "text-manifest-danger";
  return (
    <div className="rounded-md border border-white/10 bg-black/30 p-3">
      <span className="panel-label">{label}</span>
      <strong className={`mt-1 block text-2xl ${toneClass}`}>{value}</strong>
    </div>
  );
}

function onboardingBadgeClass(status: CarrierOnboardingProgress["status"]) {
  if (status === "Complete") return "border-manifest-green/35 bg-manifest-green/10 text-manifest-green";
  if (status === "Near Complete") return "border-manifest-amber/45 bg-manifest-amber/10 text-manifest-amber";
  if (status === "In Progress") return "border-manifest-red/45 bg-manifest-red/10 text-white";
  return "border-white/10 bg-white/[0.035] text-manifest-muted";
}

function UploadLinkPanel({
  carrierId,
  drivers,
  vehicles,
  uploadLinks,
  generatedUploadLink,
}: {
  carrierId: string;
  drivers: DQFileRecord[];
  vehicles: VehicleRecord[];
  uploadLinks: UploadLinkRecord[];
  generatedUploadLink: string | null;
}) {
  return (
    <section className="section-panel mb-5 p-6 max-md:p-4">
      <div className="mb-5 flex items-start justify-between gap-3 max-md:flex-col">
        <div>
          <p className="eyebrow">Carrier Intake Upload Link</p>
          <h2 className="text-2xl font-extrabold tracking-normal text-white">Secure carrier document packet</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-manifest-muted">
            Allows the carrier to upload multiple requested documents until the link expires or is revoked.
          </p>
        </div>
        <Link2 className="h-5 w-5 text-manifest-red" />
      </div>

      {generatedUploadLink ? (
        <div className="mb-5 rounded-md border border-manifest-green/35 bg-manifest-green/10 p-4">
          <div className="mb-2 flex items-center gap-2 text-sm font-extrabold text-manifest-green">
            <Copy className="h-4 w-4" />
            Copy this upload link now
          </div>
          <input readOnly value={generatedUploadLink} className="form-control w-full font-mono text-xs" />
          <p className="mt-2 text-xs font-bold text-manifest-muted">For security, the raw token is shown only after creation.</p>
        </div>
      ) : null}

      <form action={createUploadLinkAction} className="mb-5 grid gap-4 rounded-md border border-white/10 bg-black/25 p-4">
        <input type="hidden" name="carrierId" value={carrierId} />
        <div className="grid grid-cols-3 gap-3 max-lg:grid-cols-1">
          <label className="grid gap-2 text-xs font-bold uppercase tracking-[0.18em] text-manifest-quiet">
            Expires In
            <select name="expiresInDays" defaultValue="14" className="form-control">
              <option value="3">3 days</option>
              <option value="7">7 days</option>
              <option value="14">14 days</option>
              <option value="30">30 days</option>
              <option value="60">60 days</option>
            </select>
          </label>
          <label className="grid gap-2 text-xs font-bold uppercase tracking-[0.18em] text-manifest-quiet">
            DQ Driver
            <select name="driverId" className="form-control">
              <option value="">No DQ scope</option>
              {drivers.map((driver) => (
                <option key={driver.id} value={driver.id}>{driver.driverName || "Unnamed driver"}</option>
              ))}
            </select>
          </label>
          <label className="grid gap-2 text-xs font-bold uppercase tracking-[0.18em] text-manifest-quiet">
            Vehicle
            <select name="equipmentId" className="form-control">
              <option value="">No vehicle scope</option>
              {vehicles.map((vehicle) => (
                <option key={vehicle.id} value={vehicle.id}>Unit {vehicle.unitNumber}</option>
              ))}
            </select>
          </label>
        </div>

        <fieldset className="grid gap-2">
          <legend className="text-xs font-bold uppercase tracking-[0.18em] text-manifest-quiet">Allowed Categories</legend>
          <div className="flex flex-wrap gap-3 text-sm font-bold text-manifest-muted">
            <label className="inline-flex items-center gap-2 rounded-md border border-white/10 bg-black/25 px-3 py-2">
              <input type="checkbox" name="allowedCategories" value="carrier" defaultChecked />
              Company/carrier documents
            </label>
            <label className="inline-flex items-center gap-2 rounded-md border border-white/10 bg-black/25 px-3 py-2">
              <input type="checkbox" name="allowedCategories" value="driver" />
              Driver/DQ documents
            </label>
            <label className="inline-flex items-center gap-2 rounded-md border border-white/10 bg-black/25 px-3 py-2">
              <input type="checkbox" name="allowedCategories" value="vehicle" />
              Vehicle/maintenance documents
            </label>
          </div>
        </fieldset>

        <button className="form-button min-h-11 w-fit px-4 text-sm">Create upload link</button>
      </form>

      <div>
        <p className="panel-label mb-3">Recent links</p>
        {uploadLinks.length ? (
          <div className="grid gap-2">
            {uploadLinks.map((link) => (
              <div key={link.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-md border border-white/10 bg-black/25 p-3 max-md:grid-cols-1">
                <div className="min-w-0">
                  <div className="flex flex-wrap gap-2">
                    <StatusChip value={uploadLinkStatus(link)} />
                    <StatusChip value={link.allowedDocumentCategories.join(", ")} />
                  </div>
                  <p className="mt-2 text-xs font-bold text-manifest-muted">
                    Expires {formatDateTime(link.expiresAt)} · Used {link.useCount} time{link.useCount === 1 ? "" : "s"}
                    {link.lastUsedAt ? ` · Last used ${formatDateTime(link.lastUsedAt)}` : ""}
                  </p>
                </div>
                {!link.revokedAt ? (
                  <form action={revokeUploadLinkAction}>
                    <input type="hidden" name="carrierId" value={carrierId} />
                    <input type="hidden" name="uploadLinkId" value={link.id} />
                    <button className="form-button min-h-10 px-3 text-sm">Revoke</button>
                  </form>
                ) : null}
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-state">No public upload links have been created for this carrier.</div>
        )}
      </div>
    </section>
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
    <article id={`document-${documentSlug(document.name)}`} className={`scroll-mt-6 section-panel p-3.5 ${documentBorder(document.status)}`}>
      <div className="grid grid-cols-[minmax(320px,0.7fr)_minmax(680px,1.7fr)] gap-4 max-2xl:grid-cols-[minmax(300px,0.8fr)_minmax(520px,1.5fr)] max-xl:grid-cols-1">
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
    { label: "Action Center", href: "/actions", icon: ListChecks },
    { label: "Loads (Coming Soon)", href: "#loads-coming-soon", icon: Route, disabled: true },
    { label: "Documents", href: "#documents", icon: FileCheck2 },
    { label: "Documents To Fix", href: "/documents-to-fix", icon: FileCheck2 },
    { label: "Notifications", href: "#notifications", icon: Bell },
  ];

  return (
    <aside className="sticky top-0 flex h-screen flex-col border-r border-white/10 bg-black/75 p-6 backdrop-blur-2xl max-xl:static max-xl:h-auto max-xl:border-b max-xl:border-r-0">
      <div className="border-b border-white/10 pb-5">
        <p className="eyebrow">Carrier Portal</p>
        <h2 className="text-xl font-extrabold tracking-normal text-white">ManifestOS</h2>
      </div>
      <nav className="mt-5 grid gap-2 max-xl:grid-cols-3 max-md:grid-cols-1" aria-label="Carrier portal">
        {items.map(({ label, href, icon: Icon, disabled }) => (
          disabled ? (
            <button
              key={label}
              type="button"
              disabled
              className="flex min-h-10 cursor-not-allowed items-center gap-3 rounded-md border border-white/5 px-3 text-left text-sm font-semibold text-manifest-quiet opacity-80"
              title="Coming soon"
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="truncate">{label}</span>
            </button>
          ) : (
            <Link
              key={label}
              href={href}
              className="flex min-h-10 items-center gap-3 rounded-md border border-transparent px-3 text-sm font-semibold text-manifest-muted transition hover:border-manifest-red/50 hover:bg-manifest-red/10 hover:text-white"
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="truncate">{label}</span>
            </Link>
          )
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

function Notice({ tone, message }: { tone: "success" | "error"; message: string }) {
  const classes = tone === "success" ? "border-manifest-green/35 bg-manifest-green/10 text-manifest-green" : "border-manifest-danger/40 bg-manifest-danger/10 text-manifest-danger";
  return <div className={`mb-5 rounded-md border p-3 text-sm font-bold ${classes}`}>{message}</div>;
}

function uploadLinkStatus(link: UploadLinkRecord) {
  if (link.revokedAt) return "Revoked";
  if (new Date(link.expiresAt).getTime() <= Date.now()) return "Expired";
  return "Active";
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(value));
}

function documentBorder(status: string) {
  if (status === "Valid") return "border-manifest-green/30";
  if (status === "Expiring Soon") return "border-manifest-amber/55";
  return "border-manifest-danger/60";
}
