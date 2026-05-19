import Link from "next/link";
import { ArrowLeft, Route } from "lucide-react";
import { createLoadAction } from "@/app/actions/loads";
import { getCarriers } from "@/lib/data/carriers";
import { requireSession } from "@/lib/integrations/auth";
import { canManageCompliance } from "@/lib/auth/permissions";

type NewLoadPageProps = {
  searchParams?: Promise<{ error?: string }>;
};

export default async function NewLoadPage({ searchParams }: NewLoadPageProps) {
  const session = await requireSession();
  const maySelectCarrier = canManageCompliance(session);
  const carriers = maySelectCarrier ? await getCarriers() : [];
  const params = await searchParams;
  const error = params?.error ? decodeURIComponent(params.error) : "";
  const cannotCreate = maySelectCarrier ? !carriers.length : session.role === "carrier" && !session.carrierId;

  return (
    <main className="min-h-screen p-8 max-md:p-4">
      <div className="mx-auto max-w-5xl">
        <Link href="/loads" className="mb-6 inline-flex min-h-10 items-center gap-2 rounded-md border border-white/10 bg-black/30 px-3 text-sm font-bold text-manifest-muted transition hover:border-manifest-red/50 hover:bg-manifest-red/10 hover:text-white">
          <ArrowLeft className="h-4 w-4" />
          Loads
        </Link>

        <section className="section-panel p-6 max-md:p-4">
          <div className="mb-6 flex items-center justify-between gap-3">
            <div>
              <p className="eyebrow">Load Management</p>
              <h1 className="text-3xl font-extrabold tracking-normal text-white">Create new load</h1>
            </div>
            <Route className="h-5 w-5 text-manifest-red" />
          </div>

          {error ? (
            <div className="mb-5 rounded-md border border-manifest-danger/40 bg-manifest-danger/10 px-4 py-3 text-sm font-bold text-manifest-danger">
              {error}
            </div>
          ) : null}

          {maySelectCarrier && !carriers.length ? (
            <div className="mb-5 rounded-md border border-manifest-amber/40 bg-manifest-amber/10 px-4 py-3 text-sm font-bold text-manifest-amber">
              Create a carrier in this organization before creating a load.
            </div>
          ) : null}

          {!maySelectCarrier && session.role === "carrier" && !session.carrierId ? (
            <div className="mb-5 rounded-md border border-manifest-danger/40 bg-manifest-danger/10 px-4 py-3 text-sm font-bold text-manifest-danger">
              Your user account must be linked to a carrier profile before creating loads.
            </div>
          ) : null}

          <form action={createLoadAction} className="grid gap-4">
            <div className="grid grid-cols-2 gap-4 max-md:grid-cols-1">
              <Field label="Load Number" name="loadNumber" required />
              {maySelectCarrier ? (
                <label className="grid gap-2 text-xs font-bold uppercase tracking-[0.18em] text-manifest-quiet">
                  Carrier
                  <select name="carrierId" className="form-control" required>
                    {carriers.map((carrier) => (
                      <option key={carrier.id} value={carrier.id}>{carrier.companyName}</option>
                    ))}
                  </select>
                </label>
              ) : (
                <div className="rounded-md border border-white/10 bg-black/30 p-3">
                  <span className="mb-2 block text-[11px] font-extrabold uppercase tracking-[0.18em] text-manifest-quiet">
                    Carrier
                  </span>
                  <strong className="text-sm text-white">Your linked carrier profile</strong>
                  <p className="mt-1 text-xs leading-5 text-manifest-muted">
                    ManifestOS will assign this load to your signed-in carrier account.
                  </p>
                </div>
              )}
              <Field label="Driver Name" name="driverName" />
              <Field label="Broker Name" name="brokerName" />
              <Field label="Broker Email" name="brokerEmail" type="email" />
              <Field label="Rate Amount" name="rateAmount" type="number" />
              <Field label="Origin City" name="originCity" required />
              <Field label="Origin State" name="originState" required />
              <Field label="Destination City" name="destinationCity" required />
              <Field label="Destination State" name="destinationState" required />
              <Field label="Pickup Date" name="pickupDate" type="date" />
              <Field label="Delivery Date" name="deliveryDate" type="date" />
              <label className="grid gap-2 text-xs font-bold uppercase tracking-[0.18em] text-manifest-quiet">
                Status
                <select name="status" className="form-control">
                  <option value="booked">Booked</option>
                  <option value="in_transit">In Transit</option>
                  <option value="delivered">Delivered</option>
                  <option value="pod_uploaded">POD Uploaded</option>
                  <option value="pod_sent">POD Sent</option>
                  <option value="invoiced">Invoiced</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </label>
            </div>

            <label className="grid gap-2 text-xs font-bold uppercase tracking-[0.18em] text-manifest-quiet">
              Notes
              <textarea name="notes" className="form-control min-h-28 resize-y" />
            </label>

            <button className="form-button min-h-11 w-fit px-4 text-sm" disabled={cannotCreate}>Create load</button>
          </form>
        </section>
      </div>
    </main>
  );
}

function Field({
  label,
  name,
  type = "text",
  required = false,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
}) {
  return (
    <label className="grid gap-2 text-xs font-bold uppercase tracking-[0.18em] text-manifest-quiet">
      {label}
      <input name={name} type={type} required={required} className="form-control" />
    </label>
  );
}
