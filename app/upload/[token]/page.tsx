import { ShieldCheck, UploadCloud } from "lucide-react";
import { publicUploadDocumentAction } from "@/app/actions/upload-links";
import { getPublicUploadLinkLookup, type UploadDocumentCategory } from "@/lib/data/upload-links";

type PageProps = {
  params: Promise<{ token: string }>;
  searchParams?: Promise<{ success?: string; error?: string }>;
};

const carrierDocumentOptions = [
  "Certificate of Insurance",
  "W-9",
  "Operating Authority",
  "Safety Rating",
  "Signed Carrier Agreement",
  "Other Carrier Document",
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

  return (
    <main className="min-h-screen p-8 max-md:p-4">
      <div className="mx-auto max-w-3xl">
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
            </div>
          </div>
        </header>

        {messages?.success ? <Notice tone="success" message={messages.success} /> : null}
        {messages?.error ? <Notice tone="error" message={messages.error} /> : null}

        <section className="section-panel p-6 max-md:p-4">
          <div className="mb-5">
            <p className="eyebrow">Document Intake</p>
            <h2 className="text-2xl font-extrabold tracking-normal text-white">Upload compliance file</h2>
            <p className="mt-2 text-sm text-manifest-muted">
              Accepted file types: PDF, JPG, PNG, DOC, DOCX. Maximum file size: 10 MB.
            </p>
          </div>

          {categories.length ? (
            <form action={publicUploadDocumentAction} className="grid gap-4">
              <input type="hidden" name="token" value={token} />
              <label className="grid gap-2 text-xs font-bold uppercase tracking-[0.18em] text-manifest-quiet">
                Document category
                <select name="category" className="form-control" required>
                  {categories.map((category) => (
                    <option key={category} value={category}>{categoryLabel(category, link.driverName, link.equipmentName)}</option>
                  ))}
                </select>
              </label>

              <label className="grid gap-2 text-xs font-bold uppercase tracking-[0.18em] text-manifest-quiet">
                Document name
                <input name="documentName" className="form-control" list="document-options" placeholder="Select or type document name" required />
                <datalist id="document-options">
                  {[...carrierDocumentOptions, ...driverDocumentOptions, ...vehicleDocumentOptions].map((option) => (
                    <option key={option} value={option} />
                  ))}
                </datalist>
              </label>

              <label className="grid gap-2 text-xs font-bold uppercase tracking-[0.18em] text-manifest-quiet">
                Expiration date
                <input name="expirationDate" type="date" className="form-control" />
              </label>

              <label className="grid gap-2 text-xs font-bold uppercase tracking-[0.18em] text-manifest-quiet">
                File
                <input name="file" type="file" className="form-control" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,application/pdf,image/jpeg,image/png,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" required />
              </label>

              <label className="grid gap-2 text-xs font-bold uppercase tracking-[0.18em] text-manifest-quiet">
                Notes
                <textarea name="notes" className="form-control min-h-24 resize-y" placeholder="Optional note for Manifest" />
              </label>

              <button className="form-button min-h-11 w-fit px-4 text-sm max-sm:w-full">
                <UploadCloud className="h-4 w-4" />
                Upload document
              </button>
            </form>
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

function categoryLabel(category: UploadDocumentCategory, driverName: string | null, equipmentName: string | null) {
  if (category === "carrier") return "Company / carrier document";
  if (category === "driver") return `Driver / DQ document${driverName ? ` - ${driverName}` : ""}`;
  return `Vehicle / maintenance document${equipmentName ? ` - ${equipmentName}` : ""}`;
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(value));
}
