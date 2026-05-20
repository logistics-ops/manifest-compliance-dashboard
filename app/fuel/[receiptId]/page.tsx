import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, CheckCircle2, Download, FileText, ShieldCheck } from "lucide-react";
import { updateFuelReceiptAction } from "@/app/actions/fuel";
import { StatusChip } from "@/components/status-chip";
import { getFuelReceipt } from "@/lib/data/fuel";
import { getLoads } from "@/lib/data/loads";
import { requireSession } from "@/lib/integrations/auth";
import { canApproveFuelReceiptRecord, canManageFuelReceiptRecord } from "@/lib/security/tenant-rules";
import { createClient } from "@/lib/supabase/server";
import type { FuelReceipt } from "@/types/fuel";

const STORAGE_BUCKET = process.env.NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET || "carrier-documents";

type FuelReceiptPageProps = {
  params: Promise<{ receiptId: string }>;
  searchParams?: Promise<{ success?: string; error?: string }>;
};

export default async function FuelReceiptPage({ params, searchParams }: FuelReceiptPageProps) {
  const { receiptId } = await params;
  const query = await searchParams;
  const session = await requireSession();
  const receipt = await getFuelReceipt(receiptId);

  if (!receipt) redirect("/unauthorized");
  if (!canManageFuelReceiptRecord(session, { organizationId: receipt.organizationId, carrierId: receipt.carrierId })) {
    redirect("/unauthorized");
  }

  const canApprove = canApproveFuelReceiptRecord(session, { organizationId: receipt.organizationId, carrierId: receipt.carrierId });
  const loads = (await getLoads()).filter((load) => load.carrierId === receipt.carrierId);
  const signedUrl = await getSignedReceiptUrl(receipt.receiptFilePath);
  const missingFields = getMissingFields(receipt);

  return (
    <main className="min-h-screen p-8 max-md:p-4">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex items-center justify-between gap-3 max-md:flex-col max-md:items-stretch">
          <Link href="/fuel" className="inline-flex min-h-10 items-center gap-2 rounded-md border border-white/10 bg-black/30 px-3 text-sm font-bold text-manifest-muted transition hover:border-manifest-red/50 hover:bg-manifest-red/10 hover:text-white">
            <ArrowLeft className="h-4 w-4" />
            Fuel receipts
          </Link>
          {signedUrl ? (
            <a href={signedUrl} target="_blank" rel="noreferrer" className="form-button min-h-10 px-3 text-sm">
              <Download className="h-4 w-4" />
              Preview / download
            </a>
          ) : null}
        </div>

        {query?.success ? <Notice tone="success" message={decodeURIComponent(query.success)} /> : null}
        {query?.error ? <Notice tone="error" message={decodeURIComponent(query.error)} /> : null}

        <section className="section-panel mb-5 overflow-hidden border-manifest-red/30 bg-[linear-gradient(110deg,rgba(227,25,55,0.18),rgba(17,17,20,0.9)_48%,rgba(255,255,255,0.04))] p-7 max-md:p-5">
          <div className="flex items-start justify-between gap-6 max-lg:flex-col">
            <div>
              <p className="eyebrow">Manual Review</p>
              <h1 className="text-5xl font-extrabold leading-[0.95] tracking-normal text-white max-md:text-3xl">{receipt.vendorName || "Fuel Receipt"}</h1>
              <p className="mt-4 max-w-2xl text-sm leading-6 text-manifest-muted">
                AI extracted these fields. Please review before approving.
              </p>
            </div>
            <div className="grid gap-2 rounded-md border border-white/10 bg-black/45 p-4">
              <StatusChip value={receipt.extractionStatus.replace("_", " ")} />
              <strong className="text-3xl text-white">{Math.round(receipt.extractionConfidence * 100)}%</strong>
              <span className="text-xs font-bold text-manifest-muted">extraction confidence</span>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-[minmax(0,1fr)_minmax(280px,0.36fr)] gap-5 max-xl:grid-cols-1">
          <form action={updateFuelReceiptAction} className="section-panel p-6 max-md:p-4">
            <input type="hidden" name="receiptId" value={receipt.id} />
            <input type="hidden" name="extractionStatus" value={receipt.extractionStatus} />
            <div className="mb-5 flex items-center justify-between gap-3 max-md:flex-col max-md:items-stretch">
              <div>
                <p className="eyebrow">Receipt Fields</p>
                <h2 className="text-2xl font-extrabold text-white">Review and save</h2>
              </div>
              <div className="flex flex-wrap gap-2">
                <button name="intent" value="save" className="form-button min-h-10 px-4 text-sm">Save review</button>
                {canApprove ? (
                  <button name="intent" value="approve" className="form-button min-h-10 px-4 text-sm">
                    <CheckCircle2 className="h-4 w-4" />
                    Approve
                  </button>
                ) : null}
              </div>
            </div>

            {missingFields.length ? (
              <div className="mb-5 rounded-md border border-manifest-amber/35 bg-manifest-amber/10 p-4 text-sm font-bold text-manifest-amber">
                Missing required fields: {missingFields.join(", ")}.
              </div>
            ) : null}

            <div className="grid grid-cols-3 gap-4 max-lg:grid-cols-2 max-sm:grid-cols-1">
              <Field label="Vendor Name" name="vendorName" defaultValue={receipt.vendorName} />
              <Field label="Transaction Date" name="transactionDate" type="date" defaultValue={receipt.transactionDate ?? ""} />
              <Field label="Transaction Time" name="transactionTime" type="time" defaultValue={receipt.transactionTime ?? ""} />
              <Field label="Fuel Type" name="fuelType" defaultValue={receipt.fuelType} />
              <Field label="Gallons" name="gallons" type="number" step="0.001" defaultValue={String(receipt.gallons || "")} />
              <Field label="Price Per Gallon" name="pricePerGallon" type="number" step="0.001" defaultValue={String(receipt.pricePerGallon || "")} />
              <Field label="Total Amount" name="totalAmount" type="number" step="0.01" defaultValue={String(receipt.totalAmount || "")} />
              <Field label="City" name="city" defaultValue={receipt.city} />
              <Field label="State" name="state" defaultValue={receipt.state} maxLength={2} />
              <Field label="Odometer" name="odometer" type="number" defaultValue={receipt.odometer ? String(receipt.odometer) : ""} />
              <Field label="Payment Method" name="paymentMethod" defaultValue={receipt.paymentMethod} />
              <Field label="Card Last 4" name="cardLast4" defaultValue={receipt.cardLast4} maxLength={4} />
            </div>

            <div className="mt-4 grid grid-cols-2 gap-4 max-lg:grid-cols-1">
              <label className="grid gap-2 text-xs font-bold uppercase tracking-[0.18em] text-manifest-quiet">
                Load Assignment
                <select name="loadId" defaultValue={receipt.loadId ?? ""} className="form-control">
                  <option value="">No load assignment</option>
                  {loads.map((load) => <option key={load.id} value={load.id}>{load.loadNumber} · {load.brokerName || "No broker"}</option>)}
                </select>
              </label>
              <div className="grid grid-cols-2 gap-4 max-sm:grid-cols-1">
                <Field label="Driver ID placeholder" name="driverId" defaultValue={receipt.driverId ?? ""} />
                <Field label="Vehicle ID placeholder" name="vehicleId" defaultValue={receipt.vehicleId ?? ""} />
              </div>
            </div>

            <label className="mt-4 grid gap-2 text-xs font-bold uppercase tracking-[0.18em] text-manifest-quiet">
              Notes
              <textarea name="notes" defaultValue={receipt.notes} className="form-control min-h-28 resize-y" />
            </label>
          </form>

          <aside className="grid gap-5">
            <section className="section-panel p-5">
              <p className="eyebrow">Receipt File</p>
              <div className="flex items-start gap-3">
                <FileText className="mt-1 h-5 w-5 text-manifest-red" />
                <div className="min-w-0">
                  <strong className="block break-words text-white">{receipt.fileName}</strong>
                  <span className="text-xs font-bold text-manifest-muted">{receipt.carrierName}</span>
                </div>
              </div>
              {signedUrl ? (
                <a href={signedUrl} target="_blank" rel="noreferrer" className="form-button mt-4 min-h-10 w-full px-3 text-sm">Open signed file</a>
              ) : (
                <p className="mt-4 text-sm text-manifest-muted">Signed preview is unavailable.</p>
              )}
            </section>

            <section className="section-panel p-5">
              <p className="eyebrow">Approval</p>
              <div className="flex items-start gap-3">
                <ShieldCheck className="mt-1 h-5 w-5 text-manifest-red" />
                <div>
                  <strong className="block text-white">{receipt.approvedAt ? "Approved" : "Awaiting approval"}</strong>
                  <span className="text-sm text-manifest-muted">{receipt.approvedAt ? formatDateTime(receipt.approvedAt) : "Admins and staff can approve after review."}</span>
                </div>
              </div>
            </section>

            <section className="section-panel p-5">
              <p className="eyebrow">Raw Extraction</p>
              <pre className="max-h-72 overflow-auto rounded-md border border-white/10 bg-black/35 p-3 text-xs leading-5 text-manifest-muted">{JSON.stringify(receipt.rawExtraction, null, 2)}</pre>
            </section>
          </aside>
        </section>
      </div>
    </main>
  );
}

async function getSignedReceiptUrl(path: string) {
  const supabase = await createClient();
  if (!supabase) return null;
  const { data } = await supabase.storage.from(STORAGE_BUCKET).createSignedUrl(path, 300);
  return data?.signedUrl ?? null;
}

function getMissingFields(receipt: FuelReceipt) {
  const fields = [
    ["vendor name", receipt.vendorName],
    ["transaction date", receipt.transactionDate],
    ["fuel type", receipt.fuelType],
    ["gallons", receipt.gallons],
    ["price per gallon", receipt.pricePerGallon],
    ["total amount", receipt.totalAmount],
    ["state", receipt.state],
  ] as const;
  return fields.filter(([, value]) => !value).map(([label]) => label);
}

function Field({ label, name, type = "text", step, defaultValue = "", maxLength }: { label: string; name: string; type?: string; step?: string; defaultValue?: string; maxLength?: number }) {
  return <label className="grid gap-2 text-xs font-bold uppercase tracking-[0.18em] text-manifest-quiet">{label}<input name={name} type={type} step={step} defaultValue={defaultValue} maxLength={maxLength} className="form-control" /></label>;
}

function Notice({ tone, message }: { tone: "success" | "error"; message: string }) {
  const classes = tone === "success" ? "border-manifest-green/35 bg-manifest-green/10 text-manifest-green" : "border-manifest-danger/40 bg-manifest-danger/10 text-manifest-danger";
  return <div className={`mb-5 rounded-md border px-4 py-3 text-sm font-bold ${classes}`}>{message}</div>;
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(value));
}
