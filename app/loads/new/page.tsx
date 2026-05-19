import Link from "next/link";
import { ArrowLeft, Route } from "lucide-react";
import { createLoadAction } from "@/app/actions/loads";
import { getCarriers } from "@/lib/data/carriers";
import { requireStaffAccess } from "@/lib/integrations/auth";

export default async function NewLoadPage() {
  await requireStaffAccess();
  const carriers = await getCarriers();

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

          <form action={createLoadAction} className="grid gap-4">
            <div className="grid grid-cols-2 gap-4 max-md:grid-cols-1">
              <Field label="Load Number" name="loadNumber" required />
              <label className="grid gap-2 text-xs font-bold uppercase tracking-[0.18em] text-manifest-quiet">
                Carrier
                <select name="carrierId" className="form-control" required>
                  {carriers.map((carrier) => (
                    <option key={carrier.id} value={carrier.id}>{carrier.companyName}</option>
                  ))}
                </select>
              </label>
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

            <button className="form-button min-h-11 w-fit px-4 text-sm">Create load</button>
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
