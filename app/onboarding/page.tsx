import Link from "next/link";
import { CheckCircle2, Circle, Flag, MailPlus, Palette, Plus, Truck } from "lucide-react";
import { notFound } from "next/navigation";
import {
  createOnboardingCarrierAction,
  inviteCarrierUserAction,
  updateOnboardingBrandingAction,
} from "@/app/actions/onboarding";
import { LogoUploadField } from "@/components/logo-upload-field";
import { getOrganizationOnboardingData } from "@/lib/data/onboarding";

export default async function OrganizationOnboardingPage() {
  const data = await getOrganizationOnboardingData();

  if (!data) {
    notFound();
  }

  const completed = data.progress.filter((item) => item.complete).length;
  const percent = Math.round((completed / data.progress.length) * 100);

  return (
    <main className="min-h-screen p-8 max-md:p-4">
      <div className="mx-auto max-w-7xl">
        <header className="mb-6 flex items-start justify-between gap-6 border-b border-white/10 pb-6 max-lg:flex-col">
          <div>
            <p className="eyebrow">Organization Onboarding</p>
            <h1 className="max-w-4xl text-5xl font-extrabold leading-[0.95] tracking-normal text-white max-md:text-3xl">
              Launch {data.organization.name}
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-manifest-muted">
              Finish the essential brand, subdomain, carrier, and portal-user setup steps for this tenant.
            </p>
          </div>
          <Link href="/" className="form-button min-h-11 px-4 text-sm">Open dashboard</Link>
        </header>

        <section className="section-panel mb-5 overflow-hidden border-manifest-red/30 p-6">
          <div className="mb-4 flex items-center justify-between gap-4 max-md:flex-col max-md:items-stretch">
            <div>
              <p className="eyebrow">Launch Progress</p>
              <h2 className="text-2xl font-extrabold text-white">{completed}/{data.progress.length} steps complete</h2>
            </div>
            <strong className="text-4xl text-white">{percent}%</strong>
          </div>
          <div className="mb-5 h-2 overflow-hidden rounded-full bg-white/10">
            <div className="h-full rounded-full bg-gradient-to-r from-manifest-red to-manifest-danger" style={{ width: `${percent}%` }} />
          </div>
          <div className="grid grid-cols-3 gap-3 max-lg:grid-cols-2 max-md:grid-cols-1">
            {data.progress.map((item) => (
              <div key={item.key} className="flex min-h-14 items-center gap-3 rounded-md border border-white/10 bg-black/25 px-3">
                {item.complete ? <CheckCircle2 className="h-4 w-4 text-manifest-green" /> : <Circle className="h-4 w-4 text-manifest-muted" />}
                <span className={`text-sm font-bold ${item.complete ? "text-white" : "text-manifest-muted"}`}>{item.label}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="grid grid-cols-[minmax(0,1fr)_minmax(320px,0.8fr)] gap-5 max-xl:grid-cols-1">
          <BrandingSetup organization={data.organization} />
          <CarrierInvite carriers={data.carriers} organization={data.organization} />
        </section>

        <section className="section-panel mt-5 p-6">
          <div className="mb-5 flex items-center justify-between gap-3 max-md:flex-col max-md:items-stretch">
            <div>
              <p className="eyebrow">First Carrier</p>
              <h2 className="text-2xl font-extrabold text-white">Create a carrier profile</h2>
            </div>
            <Truck className="h-5 w-5 text-manifest-red" />
          </div>
          <form action={createOnboardingCarrierAction} className="grid gap-4">
            <div className="grid grid-cols-3 gap-4 max-lg:grid-cols-2 max-md:grid-cols-1">
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
              <textarea name="notes" className="form-control min-h-24 resize-y" placeholder="Add onboarding context or requirements." />
            </label>
            <button className="form-button min-h-11 w-fit px-4 text-sm">
              <Plus className="h-4 w-4" />
              Create first carrier
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}

function BrandingSetup({
  organization,
}: {
  organization: NonNullable<Awaited<ReturnType<typeof getOrganizationOnboardingData>>>["organization"];
}) {
  return (
    <section className="section-panel p-6">
      <div className="mb-5 flex items-center justify-between gap-3">
        <div>
          <p className="eyebrow">Brand Setup</p>
          <h2 className="text-2xl font-extrabold text-white">Logo, colors, and subdomain</h2>
        </div>
        <Palette className="h-5 w-5 text-manifest-red" />
      </div>
      <form action={updateOnboardingBrandingAction} className="grid gap-4">
        <LogoUploadField defaultValue={organization.logoUrl ?? ""} organizationName={organization.name} />
        <div className="grid grid-cols-2 gap-4 max-md:grid-cols-1">
          <Field label="Organization name" name="name" defaultValue={organization.name} required />
          <Field label="Slug" name="slug" defaultValue={organization.slug} required />
          <Field label="Subdomain" name="subdomain" defaultValue={organization.subdomain} required />
          <Field label="Primary color" name="primaryColor" type="color" defaultValue={organization.primaryColor} />
          <Field label="Secondary color" name="secondaryColor" type="color" defaultValue={organization.secondaryColor} />
          <Field label="Accent color" name="accentColor" type="color" defaultValue={organization.accentColor} />
        </div>
        <div className="rounded-md border border-white/10 bg-black/25 p-3 text-sm text-manifest-muted">
          <Flag className="mr-2 inline h-4 w-4 text-manifest-red" />
          Confirm this subdomain matches DNS before inviting carriers.
        </div>
        <button className="form-button min-h-11 w-fit px-4 text-sm">Save brand setup</button>
      </form>
    </section>
  );
}

function CarrierInvite({
  carriers,
  organization,
}: {
  carriers: NonNullable<Awaited<ReturnType<typeof getOrganizationOnboardingData>>>["carriers"];
  organization: NonNullable<Awaited<ReturnType<typeof getOrganizationOnboardingData>>>["organization"];
}) {
  return (
    <section className="section-panel p-6">
      <div className="mb-5 flex items-center justify-between gap-3">
        <div>
          <p className="eyebrow">Carrier Portal</p>
          <h2 className="text-2xl font-extrabold text-white">Invite first carrier user</h2>
        </div>
        <MailPlus className="h-5 w-5 text-manifest-red" />
      </div>
      {carriers.length ? (
        <form action={inviteCarrierUserAction} className="grid gap-3">
          <label className="grid gap-2 text-xs font-bold uppercase tracking-[0.18em] text-manifest-quiet">
            Carrier
            <select name="carrierId" className="form-control" required>
              {carriers.map((carrier) => (
                <option key={carrier.id} value={carrier.id}>
                  {carrier.companyName}
                </option>
              ))}
            </select>
          </label>
          <Field label="Carrier user email" name="email" type="email" required />
          <Field label="Full name" name="fullName" />
          <Field label="Invite redirect URL" name="redirectTo" type="url" defaultValue={`https://${organization.subdomain}.your-domain.com`} />
          <p className="text-xs leading-5 text-manifest-muted">
            Requires server-only `SUPABASE_SERVICE_ROLE_KEY`. The user is linked to the selected carrier and cannot view other carrier profiles.
          </p>
          <button className="form-button min-h-11 w-fit px-4 text-sm">Send carrier invite</button>
        </form>
      ) : (
        <div className="empty-state">Create the first carrier profile before inviting a carrier portal user.</div>
      )}
    </section>
  );
}

function Field({
  label,
  name,
  type = "text",
  defaultValue = "",
  required = false,
}: {
  label: string;
  name: string;
  type?: string;
  defaultValue?: string;
  required?: boolean;
}) {
  return (
    <label className="grid gap-2 text-xs font-bold uppercase tracking-[0.18em] text-manifest-quiet">
      {label}
      <input name={name} type={type} defaultValue={defaultValue} required={required} className="form-control" />
    </label>
  );
}
