import Link from "next/link";
import { ArrowLeft, FileText, Search } from "lucide-react";
import { getInvoices } from "@/lib/data/invoices";
import type { InvoiceStatus } from "@/types/invoice";

const statuses: Array<InvoiceStatus | "all"> = ["all", "draft", "sent", "paid", "overdue", "void"];

type InvoicesPageProps = {
  searchParams?: Promise<{ query?: string; status?: string }>;
};

export default async function InvoicesPage({ searchParams }: InvoicesPageProps) {
  const invoices = await getInvoices();
  const params = await searchParams;
  const query = params?.query?.trim().toLowerCase() ?? "";
  const status = statuses.includes(params?.status as InvoiceStatus | "all") ? params?.status ?? "all" : "all";
  const visible = invoices.filter((invoice) => {
    const haystack = [invoice.invoiceNumber, invoice.loadNumber, invoice.brokerName, invoice.brokerEmail, invoice.carrierName].join(" ").toLowerCase();
    return haystack.includes(query) && (status === "all" || invoice.status === status);
  });

  return (
    <main className="min-h-screen p-8 max-md:p-4">
      <div className="mx-auto max-w-7xl">
        <header className="mb-6 flex items-start justify-between gap-4 border-b border-white/10 pb-6 max-lg:flex-col">
          <div>
            <Link href="/" className="mb-4 inline-flex min-h-10 items-center gap-2 rounded-md border border-white/10 bg-black/30 px-3 text-sm font-bold text-manifest-muted transition hover:border-manifest-red/50 hover:bg-manifest-red/10 hover:text-white">
              <ArrowLeft className="h-4 w-4" />
              Dashboard
            </Link>
            <p className="eyebrow">Broker Billing</p>
            <h1 className="text-5xl font-extrabold leading-[0.95] tracking-normal text-white max-md:text-3xl">Invoices</h1>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-manifest-muted">
              Tenant-scoped invoice generation, delivery, and payment tracking.
            </p>
          </div>
          <FileText className="h-8 w-8 text-manifest-red" />
        </header>

        <section className="section-panel p-6 max-md:p-4">
          <div className="mb-5 flex items-end justify-between gap-4 max-lg:flex-col max-lg:items-stretch">
            <div>
              <p className="eyebrow">Invoice Register</p>
              <h2 className="text-2xl font-extrabold tracking-normal text-white">Broker billing queue</h2>
            </div>
            <form className="flex gap-3 max-md:flex-col">
              <label className="grid gap-2 text-xs font-bold uppercase tracking-[0.18em] text-manifest-quiet">
                Search
                <span className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-manifest-quiet" />
                  <input name="query" defaultValue={params?.query ?? ""} className="form-control w-80 pl-9 max-md:w-full" placeholder="Invoice, load, broker, carrier..." />
                </span>
              </label>
              <label className="grid gap-2 text-xs font-bold uppercase tracking-[0.18em] text-manifest-quiet">
                Status
                <select name="status" defaultValue={status} className="form-control">
                  {statuses.map((option) => <option key={option} value={option}>{formatStatus(option)}</option>)}
                </select>
              </label>
              <button className="form-button mb-0.5 self-end">Filter</button>
            </form>
          </div>

          <div className="grid gap-3">
            {visible.length ? visible.map((invoice) => (
              <Link key={invoice.id} href={`/invoices/${invoice.id}`} className="surface-hover rounded-md border border-white/10 bg-black/25 p-4">
                <div className="grid grid-cols-[minmax(0,1fr)_140px_140px] items-center gap-4 max-lg:grid-cols-1">
                  <div>
                    <strong className="block text-lg text-white">{invoice.invoiceNumber}</strong>
                    <span className="mt-1 block text-sm text-manifest-muted">Load {invoice.loadNumber} · {invoice.carrierName} · {invoice.brokerName || "Broker"}</span>
                  </div>
                  <span className="text-sm font-extrabold text-white">{formatMoney(invoice.totalAmount)}</span>
                  <span className="rounded-md border border-white/10 bg-white/[0.035] px-2 py-1 text-center text-xs font-extrabold uppercase text-manifest-muted">{formatStatus(invoice.status)}</span>
                </div>
              </Link>
            )) : (
              <div className="empty-state">No invoices match the current filters.</div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

function formatStatus(value: string) {
  if (value === "all") return "All statuses";
  return value.split("_").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
}
