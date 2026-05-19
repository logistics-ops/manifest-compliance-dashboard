import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Mail, Search, Users } from "lucide-react";
import { inviteUserAction, resendInviteAction, updateOrganizationUserAction } from "@/app/actions/users";
import { StatusChip } from "@/components/status-chip";
import { getCarriers } from "@/lib/data/carriers";
import { getOrganizationUsers } from "@/lib/data/users";
import { requireSession } from "@/lib/integrations/auth";
import { canInviteOrganizationUsers, canManageOrganizationUsers, canViewOrganizationUsers } from "@/lib/security/tenant-rules";
import type { UserRole } from "@/types/carrier";
import type { OrganizationUser } from "@/types/user";

type UsersPageProps = {
  searchParams?: Promise<{ q?: string; role?: string; status?: string; success?: string; error?: string }>;
};

export default async function UsersPage({ searchParams }: UsersPageProps) {
  const session = await requireSession();
  if (!canViewOrganizationUsers(session, session.organizationId)) redirect("/unauthorized");

  const params = await searchParams;
  const users = await getOrganizationUsers();
  const carriers = await getCarriers();
  const canInvite = canInviteOrganizationUsers(session, session.organizationId);
  const canManage = canManageOrganizationUsers(session, session.organizationId);
  const query = params?.q?.trim().toLowerCase() ?? "";
  const roleFilter = params?.role ?? "all";
  const statusFilter = params?.status ?? "all";
  const filteredUsers = users
    .filter((user) => roleFilter === "all" || user.role === roleFilter)
    .filter((user) => statusFilter === "all" || (statusFilter === "active" ? user.isActive : !user.isActive))
    .filter((user) => {
      if (!query) return true;
      return [user.fullName, user.email, user.role, user.carrierName].join(" ").toLowerCase().includes(query);
    });

  return (
    <main className="min-h-screen p-8 max-md:p-4">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex items-center justify-between gap-3 max-md:flex-col max-md:items-stretch">
          <Link href="/" className="inline-flex min-h-10 items-center gap-2 rounded-md border border-white/10 bg-black/30 px-3 text-sm font-bold text-manifest-muted transition hover:border-manifest-red/50 hover:bg-manifest-red/10 hover:text-white">
            <ArrowLeft className="h-4 w-4" />
            Dashboard
          </Link>
        </div>

        {params?.success ? <Notice tone="success" message={decodeURIComponent(params.success)} /> : null}
        {params?.error ? <Notice tone="error" message={decodeURIComponent(params.error)} /> : null}

        <section className="section-panel mb-5 overflow-hidden border-manifest-red/30 bg-[linear-gradient(110deg,rgba(227,25,55,0.18),rgba(17,17,20,0.9)_48%,rgba(255,255,255,0.04))] p-7 max-md:p-5">
          <div className="flex items-start justify-between gap-6 max-lg:flex-col">
            <div>
              <p className="eyebrow">Company</p>
              <h1 className="text-5xl font-extrabold leading-[0.95] tracking-normal text-white max-md:text-3xl">Users</h1>
              <p className="mt-4 max-w-2xl text-sm leading-6 text-manifest-muted">
                Manage organization admins, staff, and carrier users without crossing tenant boundaries.
              </p>
            </div>
            <div className="grid min-h-32 min-w-48 place-items-center rounded-md border border-manifest-red/45 bg-black/45 p-4 text-center">
              <Users className="h-7 w-7 text-manifest-red" />
              <strong className="mt-3 text-2xl text-white">{filteredUsers.length}</strong>
              <span className="text-xs font-bold text-manifest-muted">visible users</span>
            </div>
          </div>
        </section>

        <section className="mb-5 grid grid-cols-[minmax(0,1fr)_minmax(320px,0.42fr)] gap-5 max-xl:grid-cols-1">
          <div className="section-panel p-5">
            <form className="mb-5 grid grid-cols-[minmax(0,1fr)_170px_170px_auto] gap-3 max-lg:grid-cols-1">
              <label className="grid gap-2 text-xs font-bold uppercase tracking-[0.18em] text-manifest-quiet">
                Search users
                <span className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-manifest-quiet" />
                  <input name="q" defaultValue={params?.q ?? ""} className="form-control pl-9" placeholder="Name, email, carrier..." />
                </span>
              </label>
              <FilterSelect name="role" label="Role" value={roleFilter} options={["all", "admin", "staff", "carrier"]} />
              <FilterSelect name="status" label="Status" value={statusFilter} options={["all", "active", "inactive"]} />
              <button className="form-button min-h-11 self-end px-4 text-sm">Filter</button>
            </form>

            {filteredUsers.length ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[920px] border-collapse">
                  <thead>
                    <tr className="bg-white/[0.025] text-left text-[11px] uppercase tracking-[0.14em] text-manifest-quiet">
                      <th className="border-b border-white/10 px-4 py-4">User</th>
                      <th className="border-b border-white/10 px-4 py-4">Role</th>
                      <th className="border-b border-white/10 px-4 py-4">Carrier</th>
                      <th className="border-b border-white/10 px-4 py-4">Status</th>
                      <th className="border-b border-white/10 px-4 py-4">Created</th>
                      <th className="border-b border-white/10 px-4 py-4">Last Login</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.map((user) => <UserRow key={user.id} user={user} />)}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="empty-state">No users match the current filters.</div>
            )}
          </div>

          <div className="grid gap-5">
            {canInvite ? <InviteUserForm carriers={carriers} /> : null}
          </div>
        </section>

        {canManage ? (
          <section className="section-panel p-5">
            <p className="eyebrow">Admin Controls</p>
            <h2 className="mb-4 text-2xl font-extrabold text-white">Edit users</h2>
            <div className="grid gap-3">
              {filteredUsers.map((user) => (
                <EditUserForm key={user.id} user={user} carriers={carriers} />
              ))}
            </div>
          </section>
        ) : (
          <section className="section-panel p-5">
            <p className="eyebrow">Staff View</p>
            <h2 className="text-xl font-extrabold text-white">User management is read-only for staff.</h2>
            <p className="mt-2 text-sm text-manifest-muted">Admins can change roles, status, and carrier assignments.</p>
          </section>
        )}
      </div>
    </main>
  );
}

function UserRow({ user }: { user: OrganizationUser }) {
  return (
    <tr className="transition hover:bg-manifest-red/10">
      <td className="border-b border-white/10 px-4 py-4">
        <strong className="block text-sm text-white">{user.fullName || "Unnamed user"}</strong>
        <span className="text-xs text-manifest-muted">{user.email}</span>
      </td>
      <td className="border-b border-white/10 px-4 py-4"><StatusChip value={user.role} /></td>
      <td className="border-b border-white/10 px-4 py-4 text-sm text-manifest-muted">{user.carrierName || "Not linked"}</td>
      <td className="border-b border-white/10 px-4 py-4"><StatusChip value={user.isActive ? "active" : "inactive"} /></td>
      <td className="border-b border-white/10 px-4 py-4 text-xs font-bold text-manifest-muted">{formatDate(user.createdAt)}</td>
      <td className="border-b border-white/10 px-4 py-4 text-xs font-bold text-manifest-muted">{user.lastLoginAt ? formatDate(user.lastLoginAt) : "Not available"}</td>
    </tr>
  );
}

function InviteUserForm({ carriers }: { carriers: Array<{ id: string; companyName: string }> }) {
  return (
    <form action={inviteUserAction} className="section-panel p-5">
      <p className="eyebrow">Invite User</p>
      <h2 className="mb-4 text-xl font-extrabold text-white">Send invite</h2>
      <div className="grid gap-3">
        <Field label="Email" name="email" type="email" required />
        <Field label="Name" name="fullName" />
        <RoleSelect />
        <CarrierSelect carriers={carriers} required={false} />
        <label className="grid gap-2 text-xs font-bold uppercase tracking-[0.18em] text-manifest-quiet">
          Optional Message
          <textarea name="message" className="form-control min-h-20 resize-y" />
        </label>
        <button className="form-button min-h-10 px-3 text-sm">
          <Mail className="h-4 w-4" />
          Invite user
        </button>
      </div>
    </form>
  );
}

function EditUserForm({ user, carriers }: { user: OrganizationUser; carriers: Array<{ id: string; companyName: string }> }) {
  return (
    <div className="rounded-md border border-white/10 bg-black/25 p-4">
      <form action={updateOrganizationUserAction} className="grid grid-cols-[1fr_150px_180px_220px_auto] gap-3 max-xl:grid-cols-1">
        <input type="hidden" name="userId" value={user.id} />
        <Field label="Name" name="fullName" defaultValue={user.fullName} />
        <RoleSelect defaultValue={user.role} />
        <label className="grid gap-2 text-xs font-bold uppercase tracking-[0.18em] text-manifest-quiet">
          Status
          <select name="status" defaultValue={user.isActive ? "active" : "inactive"} className="form-control">
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </label>
        <CarrierSelect carriers={carriers} defaultValue={user.carrierId ?? ""} required={false} />
        <button className="form-button min-h-11 self-end px-3 text-sm">Save</button>
      </form>
      <form action={resendInviteAction} className="mt-3">
        <input type="hidden" name="userId" value={user.id} />
        <button className="form-button min-h-9 px-3 text-xs">Resend invite</button>
      </form>
    </div>
  );
}

function RoleSelect({ defaultValue = "carrier" }: { defaultValue?: UserRole }) {
  return (
    <label className="grid gap-2 text-xs font-bold uppercase tracking-[0.18em] text-manifest-quiet">
      Role
      <select name="role" defaultValue={defaultValue} className="form-control">
        <option value="admin">Admin</option>
        <option value="staff">Staff</option>
        <option value="carrier">Carrier</option>
      </select>
    </label>
  );
}

function CarrierSelect({ carriers, defaultValue = "", required }: { carriers: Array<{ id: string; companyName: string }>; defaultValue?: string; required: boolean }) {
  return (
    <label className="grid gap-2 text-xs font-bold uppercase tracking-[0.18em] text-manifest-quiet">
      Carrier Assignment
      <select name="carrierId" defaultValue={defaultValue} required={required} className="form-control">
        <option value="">No carrier linked</option>
        {carriers.map((carrier) => <option key={carrier.id} value={carrier.id}>{carrier.companyName}</option>)}
      </select>
    </label>
  );
}

function FilterSelect({ name, label, value, options }: { name: string; label: string; value: string; options: string[] }) {
  return (
    <label className="grid gap-2 text-xs font-bold uppercase tracking-[0.18em] text-manifest-quiet">
      {label}
      <select name={name} defaultValue={value} className="form-control">
        {options.map((option) => <option key={option} value={option}>{option === "all" ? `All ${label.toLowerCase()}s` : option}</option>)}
      </select>
    </label>
  );
}

function Field({ label, name, type = "text", defaultValue = "", required = false }: { label: string; name: string; type?: string; defaultValue?: string; required?: boolean }) {
  return <label className="grid gap-2 text-xs font-bold uppercase tracking-[0.18em] text-manifest-quiet">{label}<input name={name} type={type} defaultValue={defaultValue} required={required} className="form-control" /></label>;
}

function Notice({ tone, message }: { tone: "success" | "error"; message: string }) {
  const classes = tone === "success" ? "border-manifest-green/35 bg-manifest-green/10 text-manifest-green" : "border-manifest-danger/40 bg-manifest-danger/10 text-manifest-danger";
  return <div className={`mb-5 rounded-md border px-4 py-3 text-sm font-bold ${classes}`}>{message}</div>;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(value));
}
