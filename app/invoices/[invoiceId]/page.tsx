import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CheckCircle2, Download, Mail, RotateCw, XCircle } from "lucide-react";
import { markInvoicePaidAction, sendInvoiceAction, voidInvoiceAction } from "@/app/actions/invoices";
import { StatusChip } from "@/components/status-chip";
import { getLoadActivityTimeline } from "@/lib/data/load-activity";
import { getInvoice } from "@/lib/data/invoices";
import { getLoad } from "@/lib/data/loads";

type InvoicePageProps = {
  params: Promise<{ invoiceId: string }>;
  searchParams?: Promise<{ success?: string; error?: string }>;
};

export default async function InvoiceDetailPage({ params, searchParams }: InvoicePageProps) {
  const { invoiceId } = await params;
  const messages = await searchParams;
  const invoice = await getInvoice(invoiceId);
  if (!invoice) notFound();
  const load = await getLoad(invoice.loadId);
  const timeline = load ? (await getLoadActivityTimeline(load)).filter((event) => event.action.startsWith("invoice.")) : [];

  return (
    <main className="min-h-screen p-8 max-md:p-4">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex items-center justify-between gap-3 max-md:flex-col max-md:items-stretch">
          <Link href="/invoices" className="inline-flex min-h-10 items-center gap-2 rounded-md border border-white/10 bg-black/30 px-3 text-sm font-bold text-manifest-muted transition hover:border-manifest-red/50 hover:bg-manifest-red/10 hover:text-white">
            <ArrowLeft className="h-4 w-4" />
            Invoices
          </Link>
          <StatusChip value={formatStatus(invoice.status)} />
        </div>

        {messages?.success ? <Notice tone="success" message={decodeURIComponent(messages.success)} /> : null}
        {messages?.error ? <Notice tone="error" message={decodeURIComponent(messages.error)} /> : null}

        <section className="section-panel mb-5 p-7 max-md:p-5">
          <p className="eyebrow">Invoice Detail</p>
          <h1 className="text-5xl font-extrabold leading-[0.95] tracking-normal text-white max-md:text-3xl">{invoice.invoiceNumber}</h1>
          <p className="mt-4 text-sm leading-6 text-manifest-muted">Load {invoice.loadNumber} · {invoice.carrierName} · {invoice.brokerName || "Broker"}</p>
          <div className="mt-5 grid grid-cols-4 gap-3 max-lg:grid-cols-2 max-md:grid-cols-1">
            <Tile label="Total" value={formatMoney(invoice.totalAmount)} />
            <Tile label="Invoice date" value={invoice.invoiceDate} />
            <Tile label="Due date" value={invoice.dueDate ?? "Not set"} />
            <Tile label="Sent" value={invoice.sentAt ? formatDate(invoice.sentAt) : "Not sent"} />
          </div>
        </section>

        <section className="grid grid-cols-[minmax(0,1fr)_minmax(320px,0.6fr)] gap-5 max-lg:grid-cols-1">
          <div className="section-panel p-6">
            <p className="eyebrow">Invoice PDF</p>
            <h2 className="mb-4 text-2xl font-extrabold tracking-normal text-white">Preview and delivery</h2>
            <div className="rounded-md border border-white/10 bg-black/25 p-4 text-sm leading-6 text-manifest-muted">
              Generated invoice file: <strong className="text-white">{invoice.fileName ?? "No PDF generated"}</strong>
            </div>
            <div className="mt-4 flex flex-wrap gap-3">
              {invoice.storagePath ? (
                <a href={`/invoices/${invoice.id}/download`} className="form-button">
                  <Download className="h-4 w-4" />
                  Download PDF
                </a>
              ) : null}
              <form action={sendInvoiceAction}>
                <input type="hidden" name="invoiceId" value={invoice.id} />
                <button className="form-button" disabled={!invoice.storagePath || !invoice.brokerEmail}>
                  {invoice.sentAt ? <RotateCw className="h-4 w-4" /> : <Mail className="h-4 w-4" />}
                  {invoice.sentAt ? "Resend invoice" : "Send invoice"}
                </button>
              </form>
            </div>
          </div>

          <div className="section-panel p-6">
            <p className="eyebrow">Payment</p>
            <h2 className="mb-4 text-2xl font-extrabold tracking-normal text-white">Status controls</h2>
            <div className="grid gap-3">
              <form action={markInvoicePaidAction}>
                <input type="hidden" name="invoiceId" value={invoice.id} />
                <button className="form-button w-full justify-center" disabled={invoice.status === "paid" || invoice.status === "void"}>
                  <CheckCircle2 className="h-4 w-4" />
                  Mark paid
                </button>
              </form>
              <form action={voidInvoiceAction}>
                <input type="hidden" name="invoiceId" value={invoice.id} />
                <button className="form-button w-full justify-center" disabled={invoice.status === "void"}>
                  <XCircle className="h-4 w-4" />
                  Mark void
                </button>
              </form>
            </div>
          </div>
        </section>

        <section className="section-panel mt-5 p-6">
          <p className="eyebrow">Status History</p>
          <h2 className="mb-4 text-2xl font-extrabold tracking-normal text-white">Invoice timeline</h2>
          {timeline.length ? (
            <div className="grid gap-3">
              {timeline.map((event) => (
                <div key={event.id} className="rounded-md border border-white/10 bg-black/25 p-4">
                  <strong className="block text-white">{event.title}</strong>
                  <span className="mt-1 block text-xs text-manifest-muted">{formatDate(event.timestamp)} · {event.actor}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state">No invoice status history recorded yet.</div>
          )}
        </section>
      </div>
    </main>
  );
}

function Tile({ label, value }: { label: string; value: string }) {
  return <div className="rounded-md border border-white/10 bg-black/25 p-3"><span className="panel-label">{label}</span><strong className="mt-2 block text-sm text-white">{value}</strong></div>;
}

function Notice({ tone, message }: { tone: "success" | "error"; message: string }) {
  const classes = tone === "success" ? "border-manifest-green/35 bg-manifest-green/10 text-manifest-green" : "border-manifest-danger/40 bg-manifest-danger/10 text-manifest-danger";
  return <div className={`mb-5 rounded-md border px-4 py-3 text-sm font-bold ${classes}`}>{message}</div>;
}

function formatStatus(value: string) {
  return value.split("_").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(value));
}
