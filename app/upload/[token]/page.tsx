import { ShieldCheck, UploadCloud } from "lucide-react";
import { publicUploadDocumentAction } from "@/app/actions/upload-links";
import {
  getPublicUploadDocumentStatuses,
  getPublicUploadLinkLookup,
  type PublicUploadDocumentStatus,
  type UploadDocumentCategory,
} from "@/lib/data/upload-links";

type PageProps = {
  params: Promise<{ token: string }>;
  searchParams?: Promise<{ success?: string; error?: string; document?: string }>;
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

  if (!link) {
    if (lookup.status === "configuration_error") {
      return <Unavailable title="Upload lookup unavailable" message="This secure upload page is missing required server configuration. Ask Manifest to verify the deployment settings." />;
    }

    if (lookup.status === "lookup_error") {
      return <Unavailable title="Upload lookup unavailable" message="The secure upload page could not validate this link right now. Ask Manifest to verify the deployment and try again." />;
    }

    return <Unavailable title="Upload link not found" message="Ask Manifest for a new secure upload link." />;
  }

  if (!link.isUsable) {
    return (
      <Unavailable
        title={link.isRevoked ? "Upload link revoked" : "Upload link expired"}
        message="This secure upload link is no longer active. Ask Manifest for a new link."
      />
    );
  }

  const categories = visibleCategories(link.allowedDocumentCategories, Boolean(link.driverId), Boolean(link.equipmentId));
  const statuses = await getPublicUploadDocumentStatuses(link);
  const statusByKey = new Map(statuses.map((status) => [statusKey(status.category, status.documentName), status]));
  const selectedDocumentSlug = messages?.document ?? null;
  const completedCount = statuses.filter((status) => status.uploaded && categories.includes(status.category)).length;
  const requestedCount = intakeSections(categories, link.driverName, link.equipmentName).reduce((total, section) => total + section.documents.length, 0);

  return (
    <main className="min-h-screen p-8 max-md:p-4">
      <div className="mx-auto max-w-5xl">
        <header className="mb-6 rounded-md border border-manifest-red/35 bg-black/35 p-6 shadow-premium">
          <div className="flex items-start gap-4 max-sm:flex-col">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-md border border-manifest-red/45 bg-manifest-red/10 text-manifest-red">
              <ShieldCheck className="h-6 w-6" />
            </span>
            <div>
              <p className="eyebrow">{link.organizationName}</p>
              <h1 className="text-4xl font-extrabold leading-tight tracking-normal text-white max-md:text-3xl">Secure document upload</h1>
              <p className="mt-3 text-sm leading-6 text-manifest-muted">
                Submit compliance documents for {link.carrierName}. This link expires {formatDateTime(link.expiresAt)}.
              </p>
              <div className="mt-4 inline-flex rounded-md border border-white/10 bg-black/25 px-3 py-2 text-xs font-extrabold uppercase tracking-[0.14em] text-manifest-muted">
                {completedCount} of {requestedCount} requested documents uploaded
              </div>
            </div>
          </div>
        </header>

        <section className="section-panel p-6 max-md:p-4">
          <div className="mb-5">
            <p className="eyebrow">Document Intake</p>
            <h2 className="text-2xl font-extrabold tracking-normal text-white">Carrier intake packet</h2>
            <p className="mt-2 text-sm text-manifest-muted">
              Upload each requested document before the link expires. Completed rows are saved and will stay checked if you refresh this page.
            </p>
          </div>

          {categories.length ? (
            <div className="grid gap-5">
              {intakeSections(categories, link.driverName, link.equipmentName).map((section) => (
                <section key={section.category} className="rounded-md border border-white/10 bg-black/20 p-4">
                  <div className="mb-4 flex items-start justify-between gap-3 max-md:flex-col">
                    <div>
                      <p className="eyebrow">{section.eyebrow}</p>
                      <h3 className="text-xl font-extrabold tracking-normal text-white">{section.title}</h3>
                      <p className="mt-1 text-sm text-manifest-muted">{section.description}</p>
                    </div>
                    <span className="rounded-full border border-white/10 bg-white/[0.035] px-3 py-1 text-[11px] font-extrabold uppercase text-manifest-muted">
                      {section.documents.filter((documentName) => statusByKey.get(statusKey(section.category, documentName))?.uploaded).length}/{section.documents.length} uploaded
                    </span>
                  </div>
                  <div className="grid gap-3">
                    {section.documents.map((documentName) => (
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

function Unavailable({ title, message }: { title: string; message: string }) {
  return (
    <main className="grid min-h-screen place-items-center p-8 max-md:p-4">
      <section className="section-panel max-w-xl p-6 text-center">
        <ShieldCheck className="mx-auto h-9 w-9 text-manifest-red" />
        <h1 className="mt-4 text-3xl font-extrabold tracking-normal text-white">{title}</h1>
        <p className="mt-3 text-sm leading-6 text-manifest-muted">{message}</p>
      </section>
    </main>
  );
}

function Notice({ tone, message }: { tone: "success" | "error"; message: string }) {
  const classes = tone === "success" ? "border-manifest-green/35 bg-manifest-green/10 text-manifest-green" : "border-manifest-danger/40 bg-manifest-danger/10 text-manifest-danger";
  return <div className={`mb-5 rounded-md border p-3 text-sm font-bold ${classes}`}>{message}</div>;
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
  return (
    <article id={`document-${documentSlug(documentName)}`} className="grid grid-cols-[minmax(220px,0.9fr)_minmax(260px,1fr)] gap-4 rounded-md border border-white/10 bg-black/25 p-4 max-lg:grid-cols-1">
      <div className="min-w-0">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <strong className="text-sm text-white">{documentName}</strong>
          <span className={`rounded-full border px-2.5 py-1 text-[11px] font-extrabold uppercase ${uploaded ? "border-manifest-green/35 bg-manifest-green/10 text-manifest-green" : "border-manifest-gold/35 bg-manifest-gold/10 text-manifest-gold"}`}>
            {uploaded ? "Uploaded" : "Needed"}
          </span>
        </div>
        {uploaded ? (
          <p className="text-xs leading-5 text-manifest-muted">
            {status?.fileName ? `File: ${status.fileName}` : "File saved"}
            {status?.uploadedAt ? ` · ${formatDateTime(status.uploadedAt)}` : ""}
            {status?.expirationDate ? ` · Expires ${status.expirationDate}` : ""}
          </p>
        ) : (
          <p className="text-xs leading-5 text-manifest-muted">Upload this document or use Replace later if Manifest needs an updated copy.</p>
        )}
        {successMessage ? <Notice tone="success" message={successMessage} /> : null}
        {errorMessage ? <Notice tone="error" message={errorMessage} /> : null}
      </div>

      <form action={publicUploadDocumentAction} className="grid gap-3">
        <input type="hidden" name="token" value={token} />
        <input type="hidden" name="category" value={category} />
        <input type="hidden" name="documentName" value={documentName} />
        <label className="grid gap-2 text-xs font-bold uppercase tracking-[0.18em] text-manifest-quiet">
          Expiration date
          <input name="expirationDate" type="date" defaultValue={status?.expirationDate ?? ""} className="form-control" />
        </label>
        <label className="grid gap-2 text-xs font-bold uppercase tracking-[0.18em] text-manifest-quiet">
          File
          <input name="file" type="file" className="form-control" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,application/pdf,image/jpeg,image/png,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" required />
        </label>
        <label className="grid gap-2 text-xs font-bold uppercase tracking-[0.18em] text-manifest-quiet">
          Notes
          <textarea name="notes" className="form-control min-h-16 resize-y" placeholder="Optional note" />
        </label>
        <button className="form-button min-h-11 w-fit px-4 text-sm max-sm:w-full">
          <UploadCloud className="h-4 w-4" />
          {uploaded ? "Replace document" : "Upload document"}
        </button>
      </form>
    </article>
  );
}

function statusKey(category: UploadDocumentCategory, documentName: string) {
  return `${category}:${documentName.toLowerCase()}`;
}

function documentSlug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}
