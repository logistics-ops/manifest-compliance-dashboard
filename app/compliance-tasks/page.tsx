import Link from "next/link";
import { ArrowLeft, ClipboardCheck, Clock, ListChecks } from "lucide-react";
import { createComplianceTaskAction, updateComplianceTaskAction } from "@/app/actions/compliance-tasks";
import { getComplianceTasks, type ComplianceTask, type ComplianceTaskPriority, type ComplianceTaskStatus } from "@/lib/data/compliance-tasks";
import { getOrganizationUsers } from "@/lib/data/users";
import { requireSession } from "@/lib/integrations/auth";
import { canManageComplianceTaskRecord } from "@/lib/security/tenant-rules";

type PageProps = {
  searchParams?: Promise<{ success?: string; error?: string }>;
};

const priorities: ComplianceTaskPriority[] = ["critical", "high", "medium", "low"];
const statuses: ComplianceTaskStatus[] = ["open", "in_progress", "waiting", "completed"];

export default async function ComplianceTasksPage({ searchParams }: PageProps) {
  const session = await requireSession();
  const params = await searchParams;
  const [tasks, users] = await Promise.all([getComplianceTasks(), getOrganizationUsers()]);
  const canManage = canManageComplianceTaskRecord(session, session.organizationId);
  const openTasks = tasks.filter((task) => task.status !== "completed");
  const overdueTasks = openTasks.filter((task) => isOverdue(task.dueDate));
  const dueThisWeek = openTasks.filter((task) => isDueThisWeek(task.dueDate));

  return (
    <main className="min-h-screen p-8 max-md:p-4">
      <div className="mx-auto max-w-7xl">
        <header className="mb-6 flex items-start justify-between gap-4 border-b border-white/10 pb-6 max-lg:flex-col">
          <div>
            <BackLink />
            <p className="eyebrow">Audit & Compliance</p>
            <h1 className="text-5xl font-extrabold leading-[0.95] tracking-normal text-white max-md:text-3xl">
              Compliance Tasks
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-manifest-muted">
              Assign, reassign, and close follow-up work created from carrier, driver, vehicle, and manual compliance items.
            </p>
          </div>
          <div className="grid min-h-32 min-w-40 place-items-center rounded-md border border-manifest-red/45 bg-manifest-red/10 p-4 text-center">
            <ListChecks className="h-7 w-7 text-manifest-red" />
            <strong className="mt-3 text-3xl text-white">{openTasks.length}</strong>
            <span className="text-xs font-bold text-manifest-muted">open tasks</span>
          </div>
        </header>

        {params?.success ? <div className="mb-5 rounded-md border border-manifest-green/30 bg-manifest-green/10 p-3 text-sm font-bold text-manifest-green">{params.success}</div> : null}
        {params?.error ? <div className="mb-5 rounded-md border border-manifest-danger/35 bg-manifest-danger/10 p-3 text-sm font-bold text-manifest-danger">{params.error}</div> : null}

        <section className="mb-5 grid grid-cols-3 gap-4 max-md:grid-cols-1">
          <Metric label="Open Tasks" value={openTasks.length} />
          <Metric label="Overdue Tasks" value={overdueTasks.length} tone="danger" />
          <Metric label="Due This Week" value={dueThisWeek.length} tone="warn" />
        </section>

        {canManage ? (
          <section className="section-panel mb-5 p-6 max-md:p-4">
            <div className="mb-5">
              <p className="eyebrow">Manual Task</p>
              <h2 className="text-2xl font-extrabold tracking-normal text-white">Create compliance task</h2>
            </div>
            <form action={createComplianceTaskAction} className="grid gap-4">
              <input type="hidden" name="relatedEntityType" value="manual" />
              <div className="grid grid-cols-2 gap-3 max-md:grid-cols-1">
                <Field label="Title" name="title" required />
                <label className="grid gap-2 text-xs font-bold uppercase tracking-[0.18em] text-manifest-quiet">
                  Priority
                  <select name="priority" defaultValue="medium" className="form-control">
                    {priorities.map((priority) => <option key={priority} value={priority}>{formatLabel(priority)}</option>)}
                  </select>
                </label>
                <label className="grid gap-2 text-xs font-bold uppercase tracking-[0.18em] text-manifest-quiet">
                  Due Date
                  <input name="dueDate" type="date" className="form-control" />
                </label>
                <UserSelect users={users} />
              </div>
              <label className="grid gap-2 text-xs font-bold uppercase tracking-[0.18em] text-manifest-quiet">
                Description
                <textarea name="description" className="form-control min-h-24 resize-y" />
              </label>
              <button className="form-button w-fit">Create task</button>
            </form>
          </section>
        ) : null}

        <section className="section-panel p-6 max-md:p-4">
          <div className="mb-5 flex items-center justify-between gap-3 max-md:flex-col max-md:items-stretch">
            <div>
              <p className="eyebrow">Task Queue</p>
              <h2 className="text-2xl font-extrabold tracking-normal text-white">{tasks.length} task{tasks.length === 1 ? "" : "s"}</h2>
            </div>
            <ClipboardCheck className="h-5 w-5 text-manifest-red" />
          </div>

          {tasks.length ? (
            <div className="grid gap-3">
              {tasks.map((task) => <TaskRow key={task.id} task={task} users={users} canManage={canManage} />)}
            </div>
          ) : (
            <div className="empty-state">No compliance tasks yet.</div>
          )}
        </section>
      </div>
    </main>
  );
}

function TaskRow({ task, users, canManage }: { task: ComplianceTask; users: Awaited<ReturnType<typeof getOrganizationUsers>>; canManage: boolean }) {
  return (
    <article className="grid grid-cols-[minmax(0,1fr)_220px] gap-4 rounded-md border border-white/10 bg-black/25 p-4 max-xl:grid-cols-1">
      <div className="min-w-0">
        <div className="mb-2 flex flex-wrap gap-2">
          <Badge label={task.priority} priority={task.priority} />
          <span className="rounded-full border border-white/10 bg-white/[0.035] px-2.5 py-1 text-[11px] font-extrabold uppercase text-manifest-muted">
            {formatLabel(task.status)}
          </span>
          <span className="rounded-full border border-white/10 bg-white/[0.035] px-2.5 py-1 text-[11px] font-extrabold uppercase text-manifest-muted">
            {task.relatedEntityType}
          </span>
        </div>
        <strong className="block text-base text-white">{task.title}</strong>
        <p className="mt-1 text-sm leading-6 text-manifest-muted">{task.description || "No description."}</p>
        <div className="mt-3 flex flex-wrap gap-3 text-xs font-bold text-manifest-muted">
          <span>Assigned: {task.assignedToName}</span>
          <span>Due: {task.dueDate ?? "No due date"}</span>
          <span>Updated: {formatDate(task.updatedAt)}</span>
        </div>
      </div>
      {canManage ? (
        <form action={updateComplianceTaskAction} className="grid gap-2">
          <input type="hidden" name="taskId" value={task.id} />
          <label className="grid gap-1 text-[11px] font-bold uppercase tracking-[0.14em] text-manifest-quiet">
            Status
            <select name="status" defaultValue={task.status} className="form-control">
              {statuses.map((status) => <option key={status} value={status}>{formatLabel(status)}</option>)}
            </select>
          </label>
          <label className="grid gap-1 text-[11px] font-bold uppercase tracking-[0.14em] text-manifest-quiet">
            Priority
            <select name="priority" defaultValue={task.priority} className="form-control">
              {priorities.map((priority) => <option key={priority} value={priority}>{formatLabel(priority)}</option>)}
            </select>
          </label>
          <label className="grid gap-1 text-[11px] font-bold uppercase tracking-[0.14em] text-manifest-quiet">
            Due
            <input name="dueDate" type="date" defaultValue={task.dueDate ?? ""} className="form-control" />
          </label>
          <UserSelect users={users} defaultValue={task.assignedTo ?? ""} compact />
          <button className="form-button min-h-10 justify-center">Save</button>
        </form>
      ) : null}
    </article>
  );
}

function UserSelect({ users, defaultValue = "", compact = false }: { users: Awaited<ReturnType<typeof getOrganizationUsers>>; defaultValue?: string; compact?: boolean }) {
  return (
    <label className={`grid gap-2 ${compact ? "text-[11px] tracking-[0.14em]" : "text-xs tracking-[0.18em]"} font-bold uppercase text-manifest-quiet`}>
      Assigned To
      <select name="assignedTo" defaultValue={defaultValue} className="form-control">
        <option value="">Unassigned</option>
        {users.filter((user) => user.isActive).map((user) => (
          <option key={user.id} value={user.id}>
            {user.fullName || user.email}
          </option>
        ))}
      </select>
    </label>
  );
}

function BackLink() {
  return (
    <Link href="/" className="mb-4 inline-flex min-h-10 items-center gap-2 rounded-md border border-white/10 bg-black/30 px-3 text-sm font-bold text-manifest-muted transition hover:border-manifest-red/50 hover:bg-manifest-red/10 hover:text-white">
      <ArrowLeft className="h-4 w-4" />
      Operations Center
    </Link>
  );
}

function Metric({ label, value, tone = "neutral" }: { label: string; value: number; tone?: "neutral" | "warn" | "danger" }) {
  const text = tone === "danger" ? "text-manifest-danger" : tone === "warn" ? "text-manifest-amber" : "text-white";
  return (
    <article className="rounded-md border border-white/10 bg-black/30 p-4">
      <span className="panel-label">{label}</span>
      <strong className={`mt-3 block text-3xl ${text}`}>{value}</strong>
    </article>
  );
}

function Field({ label, name, required = false }: { label: string; name: string; required?: boolean }) {
  return (
    <label className="grid gap-2 text-xs font-bold uppercase tracking-[0.18em] text-manifest-quiet">
      {label}
      <input name={name} required={required} className="form-control" />
    </label>
  );
}

function Badge({ label, priority }: { label: string; priority: ComplianceTaskPriority }) {
  const tone = priority === "critical"
    ? "border-manifest-danger/40 bg-manifest-danger/10 text-manifest-danger"
    : priority === "high"
      ? "border-manifest-amber/40 bg-manifest-amber/10 text-manifest-amber"
      : priority === "medium"
        ? "border-manifest-red/40 bg-manifest-red/10 text-manifest-red"
        : "border-white/10 bg-white/[0.035] text-manifest-muted";

  return <span className={`rounded-full border px-2.5 py-1 text-[11px] font-extrabold uppercase ${tone}`}>{formatLabel(label)}</span>;
}

function isOverdue(value: string | null) {
  return Boolean(value && value < todayKey());
}

function isDueThisWeek(value: string | null) {
  if (!value) return false;
  const today = todayKey();
  const end = new Date(`${today}T12:00:00`);
  end.setDate(end.getDate() + 7);
  return value >= today && value <= end.toISOString().slice(0, 10);
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(value));
}

function formatLabel(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}
