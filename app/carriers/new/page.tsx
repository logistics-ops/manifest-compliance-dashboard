import Link from "next/link";
import { ArrowLeft, Plus } from "lucide-react";
import { createCarrierAction } from "@/app/actions/carriers";
import { requireAdmin } from "@/lib/integrations/auth";

export default async function NewCarrierPage() {
  await requireAdmin();

  return (
    <main className="min-h-screen p-8 max-md:p-4">
      <div className="mx-auto max-w-4xl">
        <Link
          href="/"
          className="mb-6 inline-flex min-h-10 items-center gap-2 rounded-md border border-white/10 bg-black/30 px-3 text-sm font-bold text-manifest-muted transition hover:border-manifest-red/50 hover:bg-manifest-red/10 hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          Compliance dashboard
        </Link>

        <section className="section-panel p-6 max-md:p-4">
          <div className="mb-6 flex items-center justify-between gap-3">
            <div>
              <p className="eyebrow">Carrier Management</p>
              <h1 className="text-3xl font-extrabold tracking-normal text-white">Create new carrier</h1>
            </div>
            <Plus className="h-5 w-5 text-manifest-red" />
          </div>

          <form action={createCarrierAction} className="grid gap-4">
            <div className="grid grid-cols-2 gap-4 max-md:grid-cols-1">
              <Field label="Company Name" name="companyName" required />
              <Field label="MC Number" name="mcNumber" required />
              <Field label="DOT Number" name="dotNumber" required />
              <Field label="Contact Name" name="contactName" />
              <Field label="Phone" name="phone" />
              <Field label="Email" name="email" type="email" />
              <label className="grid gap-2 text-xs font-bold uppercase tracking-[0.18em] text-manifest-quiet">
                Status
                <select name="status" className="form-control">
                  <option>Pending</option>
                  <option>Active</option>
                  <option>Suspended</option>
                  <option>Inactive</option>
                </select>
              </label>
            </div>

            <label className="grid gap-2 text-xs font-bold uppercase tracking-[0.18em] text-manifest-quiet">
              Notes
              <textarea name="notes" className="form-control min-h-28 resize-y" />
            </label>

            <button className="inline-flex min-h-11 w-fit items-center rounded-md border border-manifest-red/50 bg-manifest-red/15 px-4 text-sm font-extrabold text-white transition hover:bg-manifest-red/25">
              Create carrier
            </button>
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
