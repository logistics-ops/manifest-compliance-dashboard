import Link from "next/link";
import { Building2, CheckCircle2, Circle, MailPlus, Plus } from "lucide-react";
import { createOrganizationAction, inviteOrganizationAdminAction } from "@/app/actions/platform";
import { getPlatformDashboardData } from "@/lib/data/platform";

export default async function PlatformOnboardingPage() {
  const { organizations } = await getPlatformDashboardData();
  const newestOrganization = organizations[0] ?? null;
  const steps = [
    { label: "Create organization", complete: organizations.length > 0 },
    { label: "Invite first organization admin", complete: organizations.some((organization) => organization.userCount > 0) },
    { label: "Organization admin completes setup", complete: organizations.some((organization) => organization.carrierCount > 0) },
  ];
  const completed = steps.filter((step) => step.complete).length;

  return (
    <main className="min-h-screen p-8 max-md:p-4">
      <div className="mx-auto max-w-7xl">
        <header className="mb-6 flex items-start justify-between gap-6 border-b border-white/10 pb-6 max-lg:flex-col">
          <div>
            <p className="eyebrow">Platform Onboarding</p>
            <h1 className="max-w-4xl text-5xl font-extrabold leading-[0.95] tracking-normal text-white max-md:text-3xl">
              Launch a new white-label tenant
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-manifest-muted">
              Create the organization, invite its first admin, and hand off a guided setup checklist without weakening tenant isolation.
            </p>
          </div>
          <Link href="/platform" className="form-button min-h-11 px-4 text-sm">Platform console</Link>
        </header>

        <section className="section-panel mb-5 p-6">
          <div className="mb-4 flex items-center justify-between gap-4 max-md:flex-col max-md:items-stretch">
            <div>
              <p className="eyebrow">Launch Progress</p>
              <h2 className="text-2xl font-extrabold text-white">{completed}/{steps.length} platform handoff steps</h2>
            </div>
            <strong className="text-4xl text-white">{Math.round((completed / steps.length) * 100)}%</strong>
          </div>
          <div className="grid grid-cols-3 gap-3 max-md:grid-cols-1">
            {steps.map((step) => (
              <div key={step.label} className="flex min-h-14 items-center gap-3 rounded-md border border-white/10 bg-black/25 px-3">
                {step.complete ? <CheckCircle2 className="h-4 w-4 text-manifest-green" /> : <Circle className="h-4 w-4 text-manifest-muted" />}
                <span className={`text-sm font-bold ${step.complete ? "text-white" : "text-manifest-muted"}`}>{step.label}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="grid grid-cols-[minmax(0,1fr)_minmax(320px,0.8fr)] gap-5 max-xl:grid-cols-1">
          <section className="section-panel p-6">
            <div className="mb-5 flex items-center justify-between gap-3">
              <div>
                <p className="eyebrow">Step 1</p>
                <h2 className="text-2xl font-extrabold text-white">Create organization</h2>
              </div>
              <Building2 className="h-5 w-5 text-manifest-red" />
            </div>
            <form action={createOrganizationAction} className="grid gap-4">
              <div className="grid grid-cols-2 gap-4 max-md:grid-cols-1">
                <Field label="Organization name" name="name" required />
                <Field label="Slug" name="slug" required />
                <Field label="Subdomain" name="subdomain" required />
                <Field label="Logo URL" name="logoUrl" type="url" />
                <Field label="Primary color" name="primaryColor" type="color" defaultValue="#e31937" />
                <Field label="Secondary color" name="secondaryColor" type="color" defaultValue="#8d1022" />
                <Field label="Accent color" name="accentColor" type="color" defaultValue="#ff4d5d" />
              </div>
              <button className="form-button min-h-11 w-fit px-4 text-sm">
                <Plus className="h-4 w-4" />
                Create organization
              </button>
            </form>
          </section>

          <section className="section-panel p-6">
            <div className="mb-5 flex items-center justify-between gap-3">
              <div>
                <p className="eyebrow">Step 2</p>
                <h2 className="text-2xl font-extrabold text-white">Invite first admin</h2>
              </div>
              <MailPlus className="h-5 w-5 text-manifest-red" />
            </div>
            {organizations.length ? (
              <form action={inviteOrganizationAdminAction} className="grid gap-3">
                <label className="grid gap-2 text-xs font-bold uppercase tracking-[0.18em] text-manifest-quiet">
                  Organization
                  <select name="organizationId" defaultValue={newestOrganization?.id} className="form-control" required>
                    {organizations.map((organization) => (
                      <option key={organization.id} value={organization.id}>
                        {organization.name}
                      </option>
                    ))}
                  </select>
                </label>
                <Field label="Admin email" name="email" type="email" required />
                <Field label="Full name" name="fullName" />
                <Field label="Invite redirect URL" name="redirectTo" type="url" />
                <p className="text-xs leading-5 text-manifest-muted">
                  The admin lands in the tenant setup checklist at `/onboarding` after sign-in.
                </p>
                <button className="form-button min-h-11 w-fit px-4 text-sm">Send admin invite</button>
              </form>
            ) : (
              <div className="empty-state">Create an organization before inviting its first admin.</div>
            )}
          </section>
        </section>

        <section className="section-panel mt-5 p-6">
          <p className="eyebrow">Step 3</p>
          <h2 className="mb-3 text-2xl font-extrabold text-white">Admin handoff</h2>
          <p className="max-w-3xl text-sm leading-6 text-manifest-muted">
            After the organization admin accepts the invite, ask them to open `/onboarding` to upload a logo, choose colors,
            confirm subdomain, create the first carrier, and invite the first carrier portal user.
          </p>
        </section>
      </div>
    </main>
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
