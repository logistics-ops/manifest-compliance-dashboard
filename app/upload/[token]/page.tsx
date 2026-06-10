import Link from "next/link";
import type { ReactNode } from "react";
import { ShieldCheck, UploadCloud } from "lucide-react";
import { publicUploadDocumentAction } from "@/app/actions/upload-links";
import { PublicUploadFilePicker } from "@/app/upload/[token]/public-upload-file-picker";
import {
  getPublicUploadDocumentStatuses,
  getPublicUploadLinkLookup,
  type PublicUploadDocumentStatus,
  type UploadDocumentCategory,
} from "@/lib/data/upload-links";

type PageProps = {
  params: Promise<{ token: string }>;
  searchParams?: Promise<{ success?: string; error?: string; document?: string; debug?: string }>;
};

const carrierDocumentOptions = [
  "W-9",
  "Certificate of Insurance",
  "MC Authority",
  "BOC-3",
  "Drug & Alcohol Consortium",
  "Notice of Assignment / Factoring",
  "Other supporting document",
];

const driverDocumentOptions = [
  "Employment Application",
  "Initial MVR / 3-Year Driving Record",
  "Annual MVR Inquiry",
  "Medical Examiner Certificate / CDLIS Med Cert",
  "Road Test Certificate or CDL Equivalent",
  "Pre-Employment Drug/Alcohol Inquiry",
  "Other DQ Document",
];

const vehicleDocumentOptions = [
  "Registration",
  "Insurance",
  "Annual Inspection",
  "Preventive Maintenance",
  "IRP",
  "IFTA",
  "Permits",
  "Other Custom Vehicle Documents",
];

export default async function PublicUploadPage({ params, searchParams }: PageProps) {
  const { token } = await params;
  const messages = await searchParams;
  const lookup = await getPublicUploadLinkLookup(token);
  const link = lookup.link;
  const showDebugPanel = messages?.debug === "1";

  if (!link) {
    if (lookup.status === "configuration_error") {
      logUploadLookupUnavailableRender(lookup);
      return (
        <Unavailable
          title="Upload lookup unavailable"
          message="This secure upload page is missing required server configuration. Ask Manifest to verify the deployment settings."
          debugPanel={showDebugPanel ? <UploadLookupDebugPanel lookup={lookup} /> : null}
        />
      );
    }

    if (lookup.status === "lookup_error") {
      logUploadLookupUnavailableRender(lookup);
      return (
        <Unavailable
          title="Upload lookup unavailable"
          message="The secure upload page could not validate this link right now. Ask Manifest to verify the deployment and try again."
          debugPanel={showDebugPanel ? <UploadLookupDebugPanel lookup={lookup} /> : null}
        />
      );
    }

    return (
      <Unavailable
        title="Upload link not found"
        message="Ask Manifest for a new secure upload link."
        debugPanel={showDebugPanel ? <UploadLookupDebugPanel lookup={lookup} /> : null}
      />
    );
  }

  if (!link.isUsable) {
    return (
      <Unavailable
        title={link.isRevoked ? "Upload link revoked" : "Upload link expired"}
        message="This secure upload link is no longer active. Ask Manifest for a new link."
        debugPanel={showDebugPanel ? <UploadLookupDebugPanel lookup={lookup} /> : null}
      />
    );
  }

  const categories = visibleCategories(link.allowedDocumentCategories, Boolean(link.driverId), Boolean(link.equipmentId));
  const statuses = await getPublicUploadDocumentStatuses(link);
  const statusByKey = new Map(statuses.map((status) => [statusKey(status.category, status.documentName), status]));
  const selectedDocumentSlug = messages?.document ?? null;
  const completedCount = statuses.filter((status) => status.uploaded && categories.includes(status.category)).length;
  const requestedCount = intakeSections(categories, link.driverName, link.equipmentName).reduce((total, section) => total + section.documents.length, 0);
  const remainingCount = Math.max(requestedCount - completedCount, 0);
  const percentComplete = requestedCount ? Math.round((completedCount / requestedCount) * 100) : 0;

  return (
    <main className="min-h-screen p-6 max-md:p-3">
      <div className="mx-auto max-w-5xl">
        <header className="mb-4 rounded-md border border-manifest-red/35 bg-black/35 p-4 shadow-premium">
          <div className="grid grid-cols-[auto_minmax(0,1fr)_minmax(240px,0.55fr)] items-center gap-4 max-lg:grid-cols-1">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-md border border-manifest-red/45 bg-manifest-red/10 text-manifest-red max-lg:hidden">
              <ShieldCheck className="h-6 w-6" />
            </span>
              <div>
                <p className="eyebrow">{link.organizationName}</p>
                <h1 className="text-3xl font-extrabold leading-tight tracking-normal text-white max-md:text-2xl">Secure document upload</h1>
              <p className="mt-2 text-sm leading-6 text-manifest-muted">
                Submit compliance documents for {link.carrierName}. This link expires {formatDateTime(link.expiresAt)}.
              </p>
            </div>
            <div className="rounded-md border border-white/10 bg-black/25 p-3">
              <div className="flex items-end justify-between gap-3">
                <span className="text-xs font-extrabold uppercase tracking-[0.14em] text-manifest-quiet">Progress</span>
                <strong className="text-3xl leading-none text-white">{percentComplete}%</strong>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10">
                <div className="h-full rounded-full bg-manifest-red" style={{ width: `${percentComplete}%` }} />
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-center">
                <ProgressPill label="Uploaded" value={completedCount} />
                <ProgressPill label="Remaining" value={remainingCount} />
              </div>
            </div>
          </div>
        </header>

        {showDebugPanel ? <UploadLookupDebugPanel lookup={lookup} /> : null}

        <section className="section-panel p-4 max-md:p-3">
          <div className="mb-4">
            <p className="eyebrow">Document Intake</p>
            <h2 className="text-2xl font-extrabold tracking-normal text-white">Carrier intake packet</h2>
            <p className="mt-1 text-sm text-manifest-muted">
              Upload each requested document before the link expires. Completed rows are saved and will stay checked if you refresh this page.
            </p>
          </div>

          {categories.length ? (
            <div className="grid gap-4">
              {intakeSections(categories, link.driverName, link.equipmentName).map((section) => (
                <section key={section.category} className="rounded-md border border-white/10 bg-black/20 p-3">
                  <div className="mb-3 flex items-start justify-between gap-3 max-md:flex-col">
                    <div>
                      <p className="eyebrow">{section.eyebrow}</p>
                      <h3 className="text-xl font-extrabold tracking-normal text-white">{section.title}</h3>
                    </div>
                    <span className="rounded-full border border-white/10 bg-white/[0.035] px-3 py-1 text-[11px] font-extrabold uppercase text-manifest-muted max-md:w-full max-md:text-center">
                      {section.documents.filter((documentName) => statusByKey.get(statusKey(section.category, documentName))?.uploaded).length}/{section.documents.length} uploaded
                    </span>
                  </div>
                  <div className="grid gap-2">
                    {sortDocumentsByMissing(section.documents, section.category, statusByKey).map((documentName) => (
                      <DocumentUploadRow
                        key={`${section.category}:${documentName}`}
                        token={token}
                        category={section.category}
                        documentName={documentName}
                        status={statusByKey.get(statusKey(section.category, documentName)) ?? null}
                        successMessage={selectedDocumentSlug === documentSlug(documentName) ? messages?.success ?? null : null}
                        errorMessage={selectedDocumentSlug === documentSlug(documentName) ? messages?.error ?? null : null}
                      />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          ) : (
            <div className="empty-state">This upload link does not have any active document categories.</div>
          )}
        </section>
      </div>
    </main>
  );
}

function logUploadLookupUnavailableRender(lookup: Awaited<ReturnType<typeof getPublicUploadLinkLookup>>) {
  console.warn("[upload-link] rendering Upload lookup unavailable", {
    lookupStatus: lookup.status,
    hasAdminClient: lookup.hasAdminClient,
    safeTokenHashPrefix: lookup.safeTokenHashPrefix,
    queryErrorCode: lookup.queryErrorCode,
    queryErrorMessage: lookup.queryErrorMessage,
    uploadLinksRowFound: lookup.uploadLinkRowFound,
    isExpired: lookup.isExpired,
    isRevoked: lookup.isRevoked,
  });
}

function Unavailable({ title, message, debugPanel = null }: { title: string; message: string; debugPanel?: ReactNode }) {
  return (
    <main className="grid min-h-screen place-items-center p-8 max-md:p-4">
      <section className="section-panel max-w-xl p-6 text-center">
        <ShieldCheck className="mx-auto h-9 w-9 text-manifest-red" />
        <h1 className="mt-4 text-3xl font-extrabold tracking-normal text-white">{title}</h1>
        <p className="mt-3 text-sm leading-6 text-manifest-muted">{message}</p>
        {debugPanel}
      </section>
    </main>
  );
}

function UploadLookupDebugPanel({ lookup }: { lookup: Awaited<ReturnType<typeof getPublicUploadLinkLookup>> }) {
  const rows = [
    ["lookupStatus", lookup.status],
    ["hasAdminClient", lookup.hasAdminClient],
    ["safeTokenHashPrefix", lookup.safeTokenHashPrefix ?? "null"],
    ["queryErrorCode", lookup.queryErrorCode ?? "null"],
    ["queryErrorMessage", lookup.queryErrorMessage ?? "null"],
    ["uploadLinksRowFound", lookup.uploadLinkRowFound],
    ["isExpired", lookup.isExpired ?? "null"],
    ["isRevoked", lookup.isRevoked ?? "null"],
    ["effectiveBucketName", lookup.effectiveBucketName],
  ] as const;

  return (
    <div className="mt-5 rounded-md border border-manifest-gold/30 bg-manifest-gold/10 p-3 text-left">
      <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-manifest-gold">Temporary upload debug</p>
      <dl className="mt-3 grid gap-2 text-xs">
        {rows.map(([label, value]) => (
          <div key={label} className="grid grid-cols-[150px_minmax(0,1fr)] gap-3 rounded border border-white/10 bg-black/25 p-2 max-sm:grid-cols-1">
            <dt className="font-extrabold text-manifest-quiet">{label}</dt>
            <dd className="break-words font-mono text-manifest-muted">{String(value)}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function Notice({ tone, message }: { tone: "success" | "error"; message: string }) {
  const classes = tone === "success" ? "border-manifest-green/35 bg-manifest-green/10 text-manifest-green" : "border-manifest-danger/40 bg-manifest-danger/10 text-manifest-danger";
  return <div className={`mt-3 rounded-md border p-3 text-sm font-bold ${classes}`}>{message}</div>;
}

function ProgressPill({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-white/10 bg-black/30 px-3 py-2">
      <strong className="block text-lg leading-none text-white">{value}</strong>
      <span className="mt-1 block text-[10px] font-extrabold uppercase tracking-[0.12em] text-manifest-quiet">{label}</span>
    </div>
  );
}

function visibleCategories(categories: UploadDocumentCategory[], hasDriver: boolean, hasEquipment: boolean) {
  return categories.filter((category) => category === "carrier" || (category === "driver" && hasDriver) || (category === "vehicle" && hasEquipment));
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(value));
}

function intakeSections(categories: UploadDocumentCategory[], driverName: string | null, equipmentName: string | null) {
  return categories.map((category) => {
    if (category === "carrier") {
      return {
        category,
        eyebrow: "Company / Carrier Documents",
        title: "Company compliance files",
        description: "Upload the core company packet requested by Manifest.",
        documents: carrierDocumentOptions,
      };
    }

    if (category === "driver") {
      return {
        category,
        eyebrow: "Driver / DQ Documents",
        title: driverName ? `Driver packet - ${driverName}` : "Driver packet",
        description: "Upload the requested driver qualification files for this link.",
        documents: driverDocumentOptions,
      };
    }

    return {
      category,
      eyebrow: "Vehicle / Maintenance Documents",
      title: equipmentName ? `Vehicle packet - ${equipmentName}` : "Vehicle packet",
      description: "Upload the requested vehicle and maintenance records for this link.",
      documents: vehicleDocumentOptions,
    };
  });
}

function sortDocumentsByMissing(
  documents: string[],
  category: UploadDocumentCategory,
  statusByKey: Map<string, PublicUploadDocumentStatus>,
) {
  return [...documents].sort((left, right) => {
    const leftUploaded = Boolean(statusByKey.get(statusKey(category, left))?.uploaded);
    const rightUploaded = Boolean(statusByKey.get(statusKey(category, right))?.uploaded);
    if (leftUploaded === rightUploaded) return 0;
    return leftUploaded ? 1 : -1;
  });
}

function DocumentUploadRow({
  token,
  category,
  documentName,
  status,
  successMessage,
  errorMessage,
}: {
  token: string;
  category: UploadDocumentCategory;
  documentName: string;
  status: PublicUploadDocumentStatus | null;
  successMessage: string | null;
  errorMessage: string | null;
}) {
  const uploaded = Boolean(status?.uploaded);
  const viewHref = uploaded ? `/upload/${encodeURIComponent(token)}/view?category=${encodeURIComponent(category)}&document=${encodeURIComponent(documentName)}` : null;
  const fileCount = status?.fileCount ?? (uploaded ? 1 : 0);
  const latestUploadedAt = status?.uploadedAt ? formatDateTime(status.uploadedAt) : null;

  return (
    <details
      id={`document-${documentSlug(documentName)}`}
      className={`rounded-md border p-3 ${uploaded ? "border-manifest-green/30 bg-manifest-green/5" : "border-white/10 bg-black/25"}`}
    >
      <summary className="cursor-pointer list-none">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 max-sm:grid-cols-1">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`rounded-full border px-2.5 py-1 text-[11px] font-extrabold uppercase ${uploaded ? "border-manifest-green/35 bg-manifest-green/10 text-manifest-green" : "border-manifest-gold/35 bg-manifest-gold/10 text-manifest-gold"}`}>
                {uploaded ? "Uploaded" : "Needed"}
              </span>
              <strong className="truncate text-sm text-white">{documentName}</strong>
            </div>
            <p className="mt-1 truncate text-xs leading-5 text-manifest-muted">
              {uploaded
                ? `${fileCount} file${fileCount === 1 ? "" : "s"} uploaded${latestUploadedAt ? ` · Latest ${latestUploadedAt}` : ""}`
                : "Open row to select files and submit."}
            </p>
          </div>
          <div className="flex items-center justify-end gap-2 max-sm:grid max-sm:grid-cols-2">
            {uploaded && viewHref ? (
              <Link href={viewHref} target="_blank" className="inline-flex min-h-10 items-center justify-center rounded-md border border-white/10 bg-black/30 px-3 text-xs font-extrabold text-manifest-muted transition hover:border-manifest-red/50 hover:bg-manifest-red/10 hover:text-white">
                View files
              </Link>
            ) : null}
            <span className="inline-flex min-h-10 items-center justify-center rounded-md border border-manifest-red/40 bg-manifest-red/10 px-3 text-xs font-extrabold text-white">
              {uploaded ? "Add more / Replace" : "Upload files"} ▾
            </span>
          </div>
        </div>
        {successMessage ? <Notice tone="success" message={successMessage} /> : null}
        {errorMessage ? <Notice tone="error" message={errorMessage} /> : null}
      </summary>

      <form action={publicUploadDocumentAction} className="mt-3 grid gap-3 rounded-md border border-white/10 bg-black/20 p-3">
        <input type="hidden" name="token" value={token} />
        <input type="hidden" name="category" value={category} />
        <input type="hidden" name="documentName" value={documentName} />
        <div className="grid grid-cols-[minmax(0,0.75fr)_minmax(0,1.25fr)] gap-3 max-md:grid-cols-1">
          <label className="grid gap-2 text-xs font-bold uppercase tracking-[0.18em] text-manifest-quiet">
            Expiration date
            <input name="expirationDate" type="date" defaultValue={status?.expirationDate ?? ""} className="form-control min-h-12" />
          </label>
          <label className="grid gap-2 text-xs font-bold uppercase tracking-[0.18em] text-manifest-quiet">
            File
            <PublicUploadFilePicker uploaded={uploaded} />
          </label>
        </div>
        <label className="grid gap-2 text-xs font-bold uppercase tracking-[0.18em] text-manifest-quiet">
          Notes
          <textarea name="notes" className="form-control min-h-16 resize-y" placeholder="Optional note" />
        </label>
        <button className="form-button min-h-12 w-fit px-4 text-sm max-sm:w-full">
          <UploadCloud className="h-4 w-4" />
          {uploaded ? "Replace / Add Files" : `Submit ${documentName}`}
        </button>
      </form>
    </details>
  );
}

function statusKey(category: UploadDocumentCategory, documentName: string) {
  return `${category}:${documentName.toLowerCase()}`;
}

function documentSlug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}
