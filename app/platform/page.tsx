import Link from "next/link";
import type { ReactNode } from "react";
import {
  Building2,
  Eye,
  Flag,
  LayoutDashboard,
  MailPlus,
  Palette,
  Power,
  RotateCcw,
  Search,
  ShieldCheck,
  Users,
} from "lucide-react";
import {
  createOrganizationAction,
  inviteOrganizationAdminAction,
  resetOrganizationBrandingAction,
  updateOrganizationBrandingAction,
  updateOrganizationStatusAction,
  updatePlatformUserAction,
} from "@/app/actions/platform";
import { logoutAction } from "@/app/login/actions";
import { AuditLogViewer } from "@/components/audit-log-viewer";
import { getPlatformAuditLogs } from "@/lib/audit";
import { getPlatformDashboardData, type PlatformOrganization, type PlatformUser } from "@/lib/data/platform";

type PlatformDashboardPageProps = {
  searchParams?: Promise<{
    organizationQuery?: string;
    userQuery?: string;
  }>;
};

export default async function PlatformDashboardPage({ searchParams }: PlatformDashboardPageProps) {
  const { organizations, users, metrics } = await getPlatformDashboardData();
  const auditLogs = await getPlatformAuditLogs(80);
  const params = await searchParams;
  const organizationQuery = params?.organizationQuery?.trim().toLowerCase() ?? "";
  const userQuery = params?.userQuery?.trim().toLowerCase() ?? "";
  const filteredOrganizations = organizations.filter((organization) =>
    [organization.name, organization.slug, organization.subdomain]
      .join(" ")
      .toLowerCase()
      .includes(organizationQuery),
  );
  const filteredUsers = users.filter((user) =>
    [user.email, user.fullName, user.organizationName, user.role]
      .join(" ")
      .toLowerCase()
      .includes(userQuery),
  );

  return (
    <main className="min-h-screen p-8 max-md:p-4">
      <div className="mx-auto max-w-[1600px]">
        <header className="mb-6 flex items-start justify-between gap-6 border-b border-white/10 pb-6 max-lg:flex-col">
          <div>
            <p className="eyebrow">Platform Super Admin</p>
            <h1 className="max-w-5xl text-5xl font-extrabold leading-[0.95] tracking-normal text-white max-md:text-3xl">
              White-label tenant command center
            </h1>
            <p className="mt-4 max-w-3xl text-sm leading-6 text-manifest-muted">
              Manage organizations, branding, subdomains, usage, tenant health, and cross-organization operators without changing tenant isolation boundaries.
            </p>
          </div>
          <form action={logoutAction}>
            <button className="inline-flex min-h-11 items-center rounded-md border border-white/10 bg-black/30 px-4 text-sm font-extrabold text-manifest-muted transition hover:border-manifest-red/50 hover:bg-manifest-red/10 hover:text-white">
              Sign out
            </button>
          </form>
          <Link href="/platform/onboarding" className="form-button min-h-11 px-4 text-sm">
            <Flag className="h-4 w-4" />
            Onboard tenant
          </Link>
        </header>

        <section className="mb-5 grid grid-cols-4 gap-4 max-xl:grid-cols-2 max-md:grid-cols-1">
          <MetricCard label="Organizations" value={metrics.totalOrganizations} detail={`${metrics.activeOrganizations} active`} icon={<Building2 className="h-4 w-4" />} />
          <MetricCard label="Suspended" value={metrics.suspendedOrganizations} detail="Tenant access paused" icon={<Power className="h-4 w-4" />} />
          <MetricCard label="Users" value={metrics.totalUsers} detail="Across all organizations" icon={<Users className="h-4 w-4" />} />
          <MetricCard label="Carrier profiles" value={metrics.totalCarriers} detail={`${metrics.totalDocuments} document records`} icon={<LayoutDashboard className="h-4 w-4" />} />
        </section>

        <section className="mb-5 grid grid-cols-[minmax(320px,0.7fr)_minmax(0,1.3fr)] gap-5 max-xl:grid-cols-1">
          <CreateOrganizationPanel />
          <OrganizationsPanel organizations={filteredOrganizations} query={params?.organizationQuery ?? ""} />
        </section>

        <section className="grid grid-cols-[minmax(320px,0.8fr)_minmax(0,1.2fr)] gap-5 max-xl:grid-cols-1">
          <InviteAdminPanel organizations={organizations} />
          <UsersPanel users={filteredUsers} organizations={organizations} query={params?.userQuery ?? ""} />
        </section>

        <div className="mt-5">
          <AuditLogViewer
            logs={auditLogs}
            title="Platform audit log"
            description="Cross-tenant administrative activity and tenant-scoped events."
          />
        </div>
      </div>
    </main>
  );
}

function MetricCard({ label, value, detail, icon }: { label: string; value: number; detail: string; icon: ReactNode }) {
  return (
    <article className="section-panel min-h-32 p-4">
      <div className="mb-5 flex items-center justify-between gap-3">
        <span className="text-sm font-bold text-manifest-muted">{label}</span>
        <span className="grid h-9 w-9 place-items-center rounded-md border border-manifest-red/45 bg-manifest-red/10 text-manifest-red">
          {icon}
        </span>
      </div>
      <strong className="block text-5xl leading-none tracking-normal text-white">{value}</strong>
      <span className="mt-3 block text-xs font-bold text-manifest-muted">{detail}</span>
    </article>
  );
}

function CreateOrganizationPanel() {
  return (
    <section className="section-panel p-6">
      <div className="mb-5 flex items-center justify-between gap-3">
        <div>
          <p className="eyebrow">Create Organization</p>
          <h2 className="text-2xl font-extrabold tracking-normal text-white">New tenant</h2>
        </div>
        <Building2 className="h-5 w-5 text-manifest-red" />
      </div>
      <form action={createOrganizationAction} className="grid gap-3">
        <Field label="Organization name" name="name" required />
        <Field label="Slug" name="slug" required />
        <Field label="Subdomain" name="subdomain" required />
        <Field label="Logo URL" name="logoUrl" type="url" />
        <div className="grid grid-cols-3 gap-3 max-md:grid-cols-1">
          <Field label="Primary" name="primaryColor" type="color" defaultValue="#e31937" />
          <Field label="Secondary" name="secondaryColor" type="color" defaultValue="#8d1022" />
          <Field label="Accent" name="accentColor" type="color" defaultValue="#ff4d5d" />
        </div>
        <button className="form-button mt-2 min-h-11 w-fit px-4 text-sm">Create organization</button>
      </form>
    </section>
  );
}

function OrganizationsPanel({ organizations, query }: { organizations: PlatformOrganization[]; query: string }) {
  return (
    <section className="section-panel p-6">
      <div className="mb-5 flex items-center justify-between gap-3">
        <div>
          <p className="eyebrow">Organizations</p>
          <h2 className="text-2xl font-extrabold tracking-normal text-white">Tenant operations</h2>
        </div>
        <span className="rounded-md border border-white/10 bg-black/30 px-3 py-2 text-xs font-bold text-manifest-muted">
          {organizations.length} tenants
        </span>
      </div>
      <form className="mb-5">
        <label className="grid gap-2 text-xs font-bold uppercase tracking-[0.18em] text-manifest-quiet">
          Search organizations
          <span className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-manifest-quiet" />
            <input
              name="organizationQuery"
              defaultValue={query}
              className="form-control w-full pl-9"
              placeholder="Name, slug, subdomain..."
              type="search"
            />
          </span>
        </label>
      </form>
      <div className="grid gap-4">
        {organizations.length ? organizations.map((organization) => (
          <article key={organization.id} className="rounded-md border border-white/10 bg-black/25 p-4">
            <div className="mb-4 flex items-start justify-between gap-4 max-lg:flex-col">
              <div className="flex items-center gap-3">
                <BrandMark organization={organization} />
                <div>
                  <h3 className="text-lg font-extrabold text-white">{organization.name}</h3>
                  <p className="text-xs font-bold text-manifest-muted">
                    {organization.subdomain} · {organization.slug} · {organization.isActive ? "active" : "suspended"}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link href={`/platform/organizations/${organization.id}/dashboard`} className="form-button">
                  <Eye className="mr-1.5 h-3.5 w-3.5" />
                  View safely
                </Link>
                <form action={updateOrganizationStatusAction}>
                  <input type="hidden" name="organizationId" value={organization.id} />
                  <input type="hidden" name="status" value={organization.isActive ? "suspended" : "active"} />
                  <button className="form-button">
                    <Power className="mr-1.5 h-3.5 w-3.5" />
                    {organization.isActive ? "Suspend" : "Reactivate"}
                  </button>
                </form>
                <form action={resetOrganizationBrandingAction}>
                  <input type="hidden" name="organizationId" value={organization.id} />
                  <button className="form-button">
                    <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                    Reset brand
                  </button>
                </form>
              </div>
            </div>

            <div className="mb-4 grid grid-cols-5 gap-3 max-2xl:grid-cols-3 max-md:grid-cols-1">
              <UsageTile label="Users" value={organization.userCount} />
              <UsageTile label="Carriers" value={organization.carrierCount} />
              <UsageTile label="Documents" value={organization.documentCount} />
              <UsageTile label="Notifications" value={organization.notificationCount} />
              <UsageTile label="Storage" value={formatBytes(organization.storageBytes)} />
            </div>

            <form action={updateOrganizationBrandingAction} className="grid grid-cols-6 gap-3 max-xl:grid-cols-2 max-md:grid-cols-1">
              <input type="hidden" name="organizationId" value={organization.id} />
              <Field label="Name" name="name" defaultValue={organization.name} required />
              <Field label="Slug" name="slug" defaultValue={organization.slug} required />
              <Field label="Subdomain" name="subdomain" defaultValue={organization.subdomain} required />
              <Field label="Logo URL" name="logoUrl" type="url" defaultValue={organization.logoUrl ?? ""} />
              <Field label="Primary" name="primaryColor" type="color" defaultValue={organization.primaryColor} />
              <Field label="Accent" name="accentColor" type="color" defaultValue={organization.accentColor} />
              <input type="hidden" name="secondaryColor" value={organization.secondaryColor} />
              <button className="form-button min-h-11 w-fit px-4 text-sm max-xl:col-span-2 max-md:col-span-1">
                <Palette className="mr-1.5 h-4 w-4" />
                Save settings
              </button>
            </form>
          </article>
        )) : (
          <div className="empty-state">No organizations match that search.</div>
        )}
      </div>
    </section>
  );
}

function InviteAdminPanel({ organizations }: { organizations: PlatformOrganization[] }) {
  return (
    <section className="section-panel p-6">
      <div className="mb-5 flex items-center justify-between gap-3">
        <div>
          <p className="eyebrow">Invite Admin</p>
          <h2 className="text-2xl font-extrabold tracking-normal text-white">Organization operator</h2>
        </div>
        <MailPlus className="h-5 w-5 text-manifest-red" />
      </div>
      <form action={inviteOrganizationAdminAction} className="grid gap-3">
        <label className="grid gap-2 text-xs font-bold uppercase tracking-[0.18em] text-manifest-quiet">
          Organization
          <select name="organizationId" className="form-control" required>
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
          Requires server-only `SUPABASE_SERVICE_ROLE_KEY`. The invited user is created as an organization admin with no platform privileges.
        </p>
        <button className="form-button min-h-11 w-fit px-4 text-sm">Send admin invite</button>
      </form>
    </section>
  );
}

function UsersPanel({ users, organizations, query }: { users: PlatformUser[]; organizations: PlatformOrganization[]; query: string }) {
  return (
    <section className="section-panel p-6">
      <div className="mb-5 flex items-center justify-between gap-3">
        <div>
          <p className="eyebrow">Users</p>
          <h2 className="text-2xl font-extrabold tracking-normal text-white">Cross-organization access</h2>
        </div>
        <ShieldCheck className="h-5 w-5 text-manifest-red" />
      </div>
      <form className="mb-5">
        <label className="grid gap-2 text-xs font-bold uppercase tracking-[0.18em] text-manifest-quiet">
          Search users
          <span className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-manifest-quiet" />
            <input
              name="userQuery"
              defaultValue={query}
              className="form-control w-full pl-9"
              placeholder="Email, name, organization, role..."
              type="search"
            />
          </span>
        </label>
      </form>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[980px] border-collapse">
          <thead>
            <tr className="bg-white/[0.025] text-left text-[11px] uppercase tracking-[0.14em] text-manifest-quiet">
              <th className="border-b border-white/10 px-4 py-4">User</th>
              <th className="border-b border-white/10 px-4 py-4">Organization</th>
              <th className="border-b border-white/10 px-4 py-4">Role</th>
              <th className="border-b border-white/10 px-4 py-4">Status</th>
              <th className="border-b border-white/10 px-4 py-4">Platform</th>
              <th className="border-b border-white/10 px-4 py-4">Action</th>
            </tr>
          </thead>
          <tbody>
            {users.length ? users.map((user) => (
              <tr key={user.id}>
                <td className="border-b border-white/10 px-4 py-4">
                  <strong className="block text-sm text-white">{user.email}</strong>
                  <span className="text-xs text-manifest-muted">{user.fullName || "No name"}</span>
                </td>
                <td className="border-b border-white/10 px-4 py-4">
                  <form id={`user-${user.id}`} action={updatePlatformUserAction} className="contents">
                    <input type="hidden" name="userId" value={user.id} />
                    <input type="hidden" name="carrierId" value={user.carrierId ?? ""} />
                    <select name="organizationId" defaultValue={user.organizationId ?? ""} className="form-control min-w-52">
                      <option value="">Platform</option>
                      {organizations.map((organization) => (
                        <option key={organization.id} value={organization.id}>
                          {organization.name}
                        </option>
                      ))}
                    </select>
                  </form>
                </td>
                <td className="border-b border-white/10 px-4 py-4">
                  <select name="role" form={`user-${user.id}`} defaultValue={user.role} className="form-control min-w-32">
                    <option value="admin">admin</option>
                    <option value="staff">staff</option>
                    <option value="carrier">carrier</option>
                  </select>
                </td>
                <td className="border-b border-white/10 px-4 py-4">
                  <select name="status" form={`user-${user.id}`} defaultValue={user.isActive ? "active" : "inactive"} className="form-control min-w-32">
                    <option value="active">active</option>
                    <option value="inactive">inactive</option>
                  </select>
                </td>
                <td className="border-b border-white/10 px-4 py-4">
                  <label className="inline-flex items-center gap-2 text-xs font-bold text-manifest-muted">
                    <input
                      form={`user-${user.id}`}
                      name="platformSuperAdmin"
                      type="checkbox"
                      defaultChecked={user.platformSuperAdmin}
                      className="h-4 w-4 accent-manifest-red"
                    />
                    Super admin
                  </label>
                </td>
                <td className="border-b border-white/10 px-4 py-4">
                  <button form={`user-${user.id}`} className="form-button">Save user</button>
                </td>
              </tr>
            )) : (
              <tr>
                <td colSpan={6} className="border-b border-white/10 px-4 py-8">
                  <div className="empty-state">No users match that search.</div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function BrandMark({ organization }: { organization: PlatformOrganization }) {
  if (organization.logoUrl) {
    return (
      <img src={organization.logoUrl} alt={`${organization.name} logo`} className="h-12 w-12 rounded-md border border-white/10 bg-black/30 object-contain p-1" />
    );
  }

  return (
    <span
      className="grid h-12 w-12 place-items-center rounded-md border border-white/10 text-sm font-extrabold text-white"
      style={{ background: `linear-gradient(135deg, ${organization.primaryColor}, ${organization.secondaryColor})` }}
    >
      {organization.name.charAt(0)}
    </span>
  );
}

function UsageTile({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-md border border-white/10 bg-white/[0.025] p-3">
      <span className="text-[11px] font-extrabold uppercase text-manifest-quiet">{label}</span>
      <strong className="mt-2 block text-lg text-white">{value}</strong>
    </div>
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

function formatBytes(value: number) {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${Math.round(value / 1024)} KB`;
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}
