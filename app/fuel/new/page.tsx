import Link from "next/link";
import { ArrowLeft, UploadCloud } from "lucide-react";
import { createFuelReceiptAction } from "@/app/actions/fuel";
import { getCarriers } from "@/lib/data/carriers";
import { getLoads } from "@/lib/data/loads";
import { requireSession } from "@/lib/integrations/auth";

type NewFuelPageProps = {
  searchParams?: Promise<{ success?: string; error?: string }>;
};

export default async function NewFuelReceiptPage({ searchParams }: NewFuelPageProps) {
  const params = await searchParams;
  const session = await requireSession();
  const isCarrier = session.role === "carrier" && !session.platformSuperAdmin;
  const carriers = isCarrier ? [] : await getCarriers();
  const loads = await getLoads();

  return (
    <main className="min-h-screen p-8 max-md:p-4">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex items-center justify-between gap-3 max-md:flex-col max-md:items-stretch">
          <Link href="/fuel" className="inline-flex min-h-10 items-center gap-2 rounded-md border border-white/10 bg-black/30 px-3 text-sm font-bold text-manifest-muted transition hover:border-manifest-red/50 hover:bg-manifest-red/10 hover:text-white">
            <ArrowLeft className="h-4 w-4" />
            Fuel receipts
          </Link>
        </div>

        {params?.success ? <Notice tone="success" message={decodeURIComponent(params.success)} /> : null}
        {params?.error ? <Notice tone="error" message={decodeURIComponent(params.error)} /> : null}

        <section className="section-panel mb-5 overflow-hidden border-manifest-red/30 bg-[linear-gradient(110deg,rgba(227,25,55,0.18),rgba(17,17,20,0.9)_48%,rgba(255,255,255,0.04))] p-7 max-md:p-5">
          <p className="eyebrow">AI-assisted Capture</p>
          <h1 className="text-5xl font-extrabold leading-[0.95] tracking-normal text-white max-md:text-3xl">Upload fuel receipt</h1>
          <p className="mt-4 max-w-2xl text-sm leading-6 text-manifest-muted">
            Upload a receipt image or PDF. ManifestOS will prefill fields server-side, then send you to a review screen before approval.
          </p>
        </section>

        <form action={createFuelReceiptAction} encType="multipart/form-data" className="section-panel p-6 max-md:p-4">
          <div className="grid grid-cols-[minmax(0,1fr)_minmax(260px,0.42fr)] gap-5 max-lg:grid-cols-1">
            <div className="grid gap-4">
              {!isCarrier ? (
                <label className="grid gap-2 text-xs font-bold uppercase tracking-[0.18em] text-manifest-quiet">
                  Carrier
                  <select name="carrierId" required className="form-control">
                    <option value="">Select carrier</option>
                    {carriers.map((carrier) => <option key={carrier.id} value={carrier.id}>{carrier.companyName}</option>)}
                  </select>
                </label>
              ) : (
                <div className="rounded-md border border-manifest-red/30 bg-manifest-red/10 p-4 text-sm font-bold text-white">
                  Receipt will be assigned to your linked carrier profile.
                </div>
              )}

              <label className="grid gap-2 text-xs font-bold uppercase tracking-[0.18em] text-manifest-quiet">
                Optional Load
                <select name="loadId" className="form-control">
                  <option value="">No load assignment</option>
                  {loads.map((load) => <option key={load.id} value={load.id}>{load.loadNumber} · {load.carrierName}</option>)}
                </select>
              </label>

              <div className="grid grid-cols-2 gap-4 max-sm:grid-cols-1">
                <Field label="Driver ID placeholder" name="driverId" />
                <Field label="Vehicle ID placeholder" name="vehicleId" />
              </div>

              <label className="grid gap-2 text-xs font-bold uppercase tracking-[0.18em] text-manifest-quiet">
                Notes
                <textarea name="notes" className="form-control min-h-28 resize-y" placeholder="Add route, card, or reporting context." />
              </label>
            </div>

            <div className="rounded-md border border-dashed border-manifest-red/35 bg-black/30 p-5">
              <UploadCloud className="mb-4 h-9 w-9 text-manifest-red" />
              <label className="grid gap-2 text-xs font-bold uppercase tracking-[0.18em] text-manifest-quiet">
                Receipt file
                <input name="receiptFile" type="file" accept="image/png,image/jpeg,image/webp,application/pdf" required className="form-control file:mr-3 file:rounded-md file:border-0 file:bg-manifest-red/20 file:px-3 file:py-2 file:text-xs file:font-extrabold file:text-white" />
              </label>
              <p className="mt-4 text-sm leading-6 text-manifest-muted">
                Supported files: JPG, PNG, WebP, PDF. Max file size: 12MB. AI/OCR runs after upload and never exposes provider secrets in the browser.
              </p>
              <button className="form-button mt-5 min-h-11 w-full px-4 text-sm">Upload and extract</button>
            </div>
          </div>
        </form>
      </div>
    </main>
  );
}

function Field({ label, name }: { label: string; name: string }) {
  return <label className="grid gap-2 text-xs font-bold uppercase tracking-[0.18em] text-manifest-quiet">{label}<input name={name} className="form-control" /></label>;
}

function Notice({ tone, message }: { tone: "success" | "error"; message: string }) {
  const classes = tone === "success" ? "border-manifest-green/35 bg-manifest-green/10 text-manifest-green" : "border-manifest-danger/40 bg-manifest-danger/10 text-manifest-danger";
  return <div className={`mb-5 rounded-md border px-4 py-3 text-sm font-bold ${classes}`}>{message}</div>;
}
