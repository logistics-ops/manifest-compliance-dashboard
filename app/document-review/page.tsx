import Link from "next/link";
import { FileCheck2, Search } from "lucide-react";
import { updateDocumentReviewAction } from "@/app/actions/document-review";
import {
  getDocumentReviewItems,
  summarizeDocumentReviews,
  type DocumentReviewCategory,
  type DocumentReviewItem,
  type DocumentReviewStatus,
} from "@/lib/data/document-review";

type PageProps = {
  searchParams?: Promise<{
    status?: string;
    category?: string;
    q?: string;
    success?: string;
    error?: string;
  }>;
};

const statusOptions: Array<{ value: DocumentReviewStatus; label: string }> = [
  { value: "pending_review", label: "Pending Review" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "replacement_requested", label: "Replacement Requested" },
];

const categoryOptions: Array<{ value: "all" | DocumentReviewCategory; label: string }> = [
  { value: "all", label: "All documents" },
  { value: "carrier", label: "Carrier" },
  { value: "driver", label: "Driver/DQ" },
  { value: "vehicle", label: "Vehicle" },
];

export default async function DocumentReviewPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const items = await getDocumentReviewItems();
  const selectedStatus = statusOptions.some((option) => option.value === params?.status) ? (params?.status as DocumentReviewStatus) : "pending_review";
  const selectedCategory = categoryOptions.some((option) => option.value === params?.category) ? params?.category ?? "all" : "all";
  const query = String(params?.q ?? "").trim().toLowerCase();
  const filtered = items.filter((item) => {
    const matchesStatus = selectedStatus ? item.reviewStatus === selectedStatus : true;
    const matchesCategory = selectedCategory === "all" || item.category === selectedCategory;
    const searchText = `${item.carrierName} ${item.ownerName} ${item.documentName}`.toLowerCase();
    return matchesStatus && matchesCategory && (!query || searchText.includes(query));
  });
  const summary = summarizeDocumentReviews(items);

  return (
    <main className="min-h-screen p-6 max-md:p-3">
      <div className="mx-auto grid w-full max-w-7xl gap-5">
        <header className="section-panel p-5">
          <div className="flex items-start justify-between gap-4 max-lg:flex-col">
            <div>
              <p className="eyebrow">Compliance Review</p>
              <h1 className="text-3xl font-extrabold tracking-normal text-white max-md:text-2xl">Document Review Queue</h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-manifest-muted">
                Review newly uploaded carrier, DQ, and vehicle compliance files. Rejected or replacement-requested files return to the carrier intake packet as needing action.
              </p>
            </div>
            <Link href="/" className="btn-secondary shrink-0">Back to dashboard</Link>
          </div>
          {(params?.success || params?.error) ? (
            <div className={`mt-4 rounded-md border p-3 text-sm ${params?.error ? "border-manifest-danger/35 bg-manifest-danger/10 text-manifest-danger" : "border-manifest-success/35 bg-manifest-success/10 text-manifest-success"}`}>
              {params.error ?? params.success}
            </div>
          ) : null}
        </header>

        <section className="grid grid-cols-4 gap-3 max-lg:grid-cols-2 max-sm:grid-cols-1">
          <ReviewMetric label="Pending Review" value={summary.pending} href="/document-review?status=pending_review" tone={summary.pending ? "warn" : "neutral"} />
          <ReviewMetric label="Rejected" value={summary.rejected} href="/document-review?status=rejected" tone={summary.rejected ? "danger" : "neutral"} />
          <ReviewMetric label="Replacement Requested" value={summary.replacementRequested} href="/document-review?status=replacement_requested" tone={summary.replacementRequested ? "danger" : "neutral"} />
          <ReviewMetric label="Approved" value={summary.approved} href="/document-review?status=approved" tone="good" />
        </section>

        <section className="section-panel p-4">
          <form className="grid grid-cols-[minmax(0,1fr)_180px_210px_auto] gap-3 max-lg:grid-cols-1">
            <label className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-manifest-quiet" />
              <input
                name="q"
                defaultValue={params?.q ?? ""}
                placeholder="Search carrier, owner, or document..."
                className="form-input min-h-11 pl-9"
              />
            </label>
            <select name="status" defaultValue={selectedStatus} className="form-input min-h-11">
              {statusOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
            <select name="category" defaultValue={selectedCategory} className="form-input min-h-11">
              {categoryOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
            <button className="btn-primary min-h-11" type="submit">Filter</button>
          </form>
        </section>

        <section className="grid gap-3">
          {filtered.length ? filtered.map((item) => <ReviewQueueCard key={`${item.category}:${item.id}`} item={item} />) : (
            <div className="empty-state">
              <FileCheck2 className="mx-auto mb-3 h-8 w-8 text-manifest-muted" />
              No documents match this review queue.
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function ReviewMetric({ label, value, href, tone }: { label: string; value: number; href: string; tone: "danger" | "warn" | "good" | "neutral" }) {
  const toneClass = tone === "danger" ? "text-manifest-danger" : tone === "warn" ? "text-manifest-amber" : tone === "good" ? "text-manifest-success" : "text-white";
  return (
    <Link href={href} className="rounded-md border border-white/10 bg-black/30 p-4 transition hover:border-manifest-red/45 hover:bg-manifest-red/10">
      <span className="text-xs font-extrabold uppercase tracking-[0.14em] text-manifest-quiet">{label}</span>
      <strong className={`mt-2 block text-3xl leading-none ${toneClass}`}>{value}</strong>
    </Link>
  );
}

function ReviewQueueCard({ item }: { item: DocumentReviewItem }) {
  return (
    <article className="rounded-md border border-white/10 bg-black/25 p-4">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-4 max-lg:grid-cols-1">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={item.reviewStatus} />
            <span className="rounded-full border border-white/10 bg-white/[0.035] px-2.5 py-1 text-[11px] font-bold uppercase text-manifest-muted">{categoryLabel(item.category)}</span>
            <span className="text-xs text-manifest-quiet">{item.fileCount} {item.fileCount === 1 ? "file" : "files"}</span>
          </div>
          <h2 className="mt-3 truncate text-xl font-extrabold tracking-normal text-white">{item.documentName}</h2>
          <p className="mt-1 text-sm text-manifest-muted">
            <Link href={item.ownerHref} className="text-white underline decoration-white/20 underline-offset-4 hover:text-manifest-red">{item.ownerName}</Link>
            <span className="px-2 text-manifest-quiet">/</span>
            {item.carrierName}
          </p>
          <p className="mt-2 text-xs text-manifest-quiet">
            Uploaded {item.uploadedAt ? formatDateTime(item.uploadedAt) : "recently"}
            {item.reviewedAt ? ` · Reviewed ${formatDateTime(item.reviewedAt)}` : ""}
          </p>
          {(item.reviewNote || item.internalReviewNote) ? (
            <div className="mt-3 grid gap-2 text-sm">
              {item.reviewNote ? <p className="rounded-md border border-manifest-red/20 bg-manifest-red/10 p-3 text-manifest-danger">Carrier note: {item.reviewNote}</p> : null}
              {item.internalReviewNote ? <p className="rounded-md border border-white/10 bg-white/[0.035] p-3 text-manifest-muted">Internal note: {item.internalReviewNote}</p> : null}
            </div>
          ) : null}
        </div>
        <div className="flex items-start justify-end max-lg:justify-start">
          <Link href={`/document-review/${item.category}/${item.id}/view`} target="_blank" className="btn-secondary whitespace-nowrap">View files</Link>
        </div>
      </div>

      <form action={updateDocumentReviewAction} className="mt-4 grid grid-cols-[180px_minmax(0,1fr)_minmax(0,1fr)_auto] items-end gap-3 border-t border-white/10 pt-4 max-xl:grid-cols-2 max-md:grid-cols-1">
        <input type="hidden" name="category" value={item.category} />
        <input type="hidden" name="documentId" value={item.id} />
        <label className="grid gap-1">
          <span className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-manifest-quiet">Status</span>
          <select name="reviewStatus" defaultValue={item.reviewStatus} className="form-input min-h-11">
            {statusOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </label>
        <label className="grid gap-1">
          <span className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-manifest-quiet">Carrier-facing reason</span>
          <input name="reviewNote" defaultValue={item.reviewNote ?? ""} placeholder="Reason shown when rejected or replacement requested" className="form-input min-h-11" />
        </label>
        <label className="grid gap-1">
          <span className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-manifest-quiet">Internal note</span>
          <input name="internalReviewNote" defaultValue={item.internalReviewNote ?? ""} placeholder="Staff-only note" className="form-input min-h-11" />
        </label>
        <button type="submit" className="btn-primary min-h-11 whitespace-nowrap">Save review</button>
      </form>
    </article>
  );
}

function StatusBadge({ status }: { status: DocumentReviewStatus }) {
  const label = statusOptions.find((option) => option.value === status)?.label ?? status;
  const classes = status === "approved"
    ? "border-manifest-success/35 bg-manifest-success/10 text-manifest-success"
    : status === "pending_review"
      ? "border-manifest-amber/35 bg-manifest-amber/10 text-manifest-amber"
      : "border-manifest-danger/35 bg-manifest-danger/10 text-manifest-danger";
  return <span className={`rounded-full border px-2.5 py-1 text-[11px] font-extrabold uppercase ${classes}`}>{label}</span>;
}

function categoryLabel(category: DocumentReviewCategory) {
  if (category === "driver") return "Driver/DQ";
  if (category === "vehicle") return "Vehicle";
  return "Carrier";
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(value));
}
