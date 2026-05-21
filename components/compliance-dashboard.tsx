"use client";

import Link from "next/link";
import {
  Activity,
  BarChart3,
  ClipboardCheck,
  ClipboardList,
  CloudSun,
  FileCheck2,
  FileArchive,
  FileText,
  LayoutDashboard,
  Palette,
  Plus,
  Route,
  type LucideIcon,
  Search,
  Settings,
  ShieldAlert,
  Truck,
  Bell,
  Building2,
  DollarSign,
  Flag,
  PanelLeftClose,
  PanelLeftOpen,
  Receipt,
  Users,
  Wrench,
} from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import {
  getActionItems,
  getCarrierAlerts,
  getCarrierDocuments,
  getComplianceTimeline,
  getComplianceScore,
  getComplianceScoreBreakdown,
  getComplianceTier,
  getOverviewMetrics,
  getScoreSummary,
  isAuditReady,
  isHighRisk,
} from "@/lib/compliance";
import { mockCarriers } from "@/lib/mock-data";
import type { AlertLabel, Carrier, CarrierStatus, ComplianceTimelineEvent, OrganizationBranding } from "@/types/carrier";
import { StatusChip } from "@/components/status-chip";
import type { AuthSession, ComplianceNotification } from "@/types/carrier";
import { logoutAction } from "@/app/login/actions";
import { canManageCarriers } from "@/lib/auth/permissions";
import { NotificationCenter } from "@/components/notification-center";
import { AuditLogViewer } from "@/components/audit-log-viewer";
import type { AuditLog } from "@/lib/audit";

const statusOptions: Array<CarrierStatus | "All"> = ["All", "Active", "Pending", "Suspended", "Inactive"];
const alertLabels: AlertLabel[] = [
  "Missing Document",
  "Expiring in 30 Days",
  "Expired",
  "Needs Review",
  "Audit Ready",
];
const dashboardTabs = ["overview", "compliance", "operations", "documents", "activity"] as const;
type DashboardTab = (typeof dashboardTabs)[number];

type NavItem = { label: string; href: string; icon: LucideIcon; placeholder?: boolean; platformOnly?: boolean };
type NavGroup = { title: string; items: NavItem[] };

const organizationNavGroups: NavGroup[] = [
  {
    title: "Command Center",
    items: [
      { label: "Overview", href: "#overview", icon: LayoutDashboard },
      { label: "Analytics", href: "#analytics", icon: BarChart3 },
      { label: "Notifications", href: "#notifications", icon: Bell },
      { label: "Audit Logs", href: "#audit-logs", icon: ClipboardList },
      { label: "Broker Check", href: "#broker-check", icon: Building2, placeholder: true },
    ],
  },
  {
    title: "Compliance",
    items: [
      { label: "Carrier Profiles", href: "#carriers", icon: Truck },
      { label: "Required Documents", href: "#documents", icon: FileCheck2 },
      { label: "Driver Qualification Files", href: "#driver-qualification-files", icon: ClipboardCheck, placeholder: true },
      { label: "Safety / Audit Prep", href: "#safety-audit-prep", icon: ShieldAlert, placeholder: true },
    ],
  },
  {
    title: "Operations",
    items: [
      { label: "Loads", href: "/loads", icon: Route },
      { label: "Weather Checker", href: "/weather", icon: CloudSun },
      { label: "Broker Check", href: "#broker-check", icon: Building2, placeholder: true },
      { label: "POD Workflow", href: "/loads", icon: FileCheck2 },
      { label: "Rate Confirmations", href: "/loads", icon: ClipboardCheck },
      { label: "Activity Timeline", href: "#timeline", icon: Activity },
    ],
  },
  {
    title: "Billing",
    items: [
      { label: "Invoices", href: "/invoices", icon: FileText },
      { label: "Payment Status", href: "/invoices", icon: DollarSign },
      { label: "Archive Exports", href: "/loads", icon: FileArchive },
    ],
  },
  {
    title: "Fleet / Maintenance",
    items: [
      { label: "Vehicles", href: "#vehicles", icon: Truck, placeholder: true },
      { label: "Maintenance", href: "#maintenance", icon: Wrench, placeholder: true },
      { label: "Pre-Trip / Post-Trip", href: "#trip-inspections", icon: ClipboardList, placeholder: true },
    ],
  },
  {
    title: "Company",
    items: [
      { label: "Onboarding", href: "/onboarding", icon: Flag },
      { label: "Users", href: "/users", icon: Users },
      { label: "Organization Settings", href: "#organization-settings", icon: Settings, placeholder: true },
      { label: "Branding", href: "#branding", icon: Palette, placeholder: true },
      { label: "Platform Admin", href: "/platform", icon: Building2, platformOnly: true },
    ],
  },
];

const carrierNavGroups: NavGroup[] = [
  {
    title: "Carrier Portal",
    items: [
      { label: "Dashboard", href: "#overview", icon: LayoutDashboard },
      { label: "Loads", href: "/loads", icon: Route },
      { label: "Weather", href: "/weather", icon: CloudSun },
      { label: "Documents", href: "#documents", icon: FileCheck2 },
      { label: "Invoices", href: "/invoices", icon: Receipt },
      { label: "Archives", href: "/archives", icon: FileArchive },
      { label: "Notifications", href: "#notifications", icon: Bell },
    ],
  },
];

export function ComplianceDashboard({
  carriers = mockCarriers,
  notifications = [],
  auditLogs = [],
  session,
  branding,
}: {
  carriers?: Carrier[];
  notifications?: ComplianceNotification[];
  auditLogs?: AuditLog[];
  session: AuthSession;
  branding: OrganizationBranding;
}) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<DashboardTab>(() => getInitialDashboardTab());
  const activeCarriers = carriers;
  const [selectedCarrierId, setSelectedCarrierId] = useState(activeCarriers[0]?.id ?? "");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<CarrierStatus | "All">("All");

  const selectedCarrier = activeCarriers.find((carrier) => carrier.id === selectedCarrierId) ?? activeCarriers[0] ?? null;
  const selectedDocuments = selectedCarrier ? getCarrierDocuments(selectedCarrier) : [];
  const overviewMetrics = getOverviewMetrics(activeCarriers);
  const timelineEvents = getComplianceTimeline(activeCarriers, 90);
  const activeNotifications = notifications.length ? notifications : [];

  useEffect(() => {
    function handlePopState() {
      setActiveTab(getInitialDashboardTab());
    }

    setActiveTab(getInitialDashboardTab());
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  useEffect(() => {
    const section = new URLSearchParams(window.location.search).get("section");
    if (!section) return;

    window.setTimeout(() => {
      document.getElementById(section)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);
  }, [activeTab]);

  function handleTabChange(tab: DashboardTab, targetId?: string) {
    setActiveTab(tab);
    if (typeof window === "undefined") return;

    const url = new URL(window.location.href);
    url.searchParams.set("tab", tab);
    if (targetId) {
      url.searchParams.set("section", targetId);
    } else {
      url.searchParams.delete("section");
    }
    window.history.pushState(null, "", `${url.pathname}?${url.searchParams.toString()}${url.hash}`);
  }

  function handleSidebarNavigate(tab: DashboardTab, targetId?: string) {
    handleTabChange(tab, targetId);
    setIsSidebarOpen(false);

    if (!targetId || typeof window === "undefined") return;
    window.setTimeout(() => {
      document.getElementById(targetId)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);
  }

  const filteredCarriers = useMemo(() => {
    const needle = query.trim().toLowerCase();

    return activeCarriers.filter((carrier) => {
      const matchesStatus = statusFilter === "All" || carrier.status === statusFilter;
      const haystack = [
        carrier.companyName,
        carrier.mcNumber,
        carrier.dotNumber,
        carrier.contactName,
        carrier.phone,
        carrier.email,
      ]
        .join(" ")
        .toLowerCase();

      return matchesStatus && haystack.includes(needle);
    });
  }, [activeCarriers, query, statusFilter]);

  return (
    <div className="grid min-h-screen grid-cols-[312px_minmax(0,1fr)] max-xl:grid-cols-1">
      <Sidebar
        carriers={activeCarriers}
        branding={branding}
        session={session}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        activeTab={activeTab}
        onNavigate={handleSidebarNavigate}
      />

      <main className="p-8 max-md:p-4">
        <button
          type="button"
          onClick={() => setIsSidebarOpen(true)}
          className="form-button mb-4 hidden min-h-10 max-xl:inline-flex"
          aria-label="Open navigation"
        >
          <PanelLeftOpen className="h-4 w-4" />
          Navigation
        </button>
        <header className="mb-6 flex items-start justify-between gap-6 border-b border-white/10 pb-6 max-lg:flex-col">
          <div>
            <p className="eyebrow">{branding.name}</p>
            <h1 className="max-w-4xl text-5xl font-extrabold leading-[0.95] tracking-normal text-white max-md:text-3xl">
              Carrier Compliance Command Center
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-manifest-muted">
              Executive visibility into carrier readiness, document exposure, and renewal risk across your active tenant network.
            </p>
          </div>

          <div className="flex items-end gap-3 max-md:w-full max-md:flex-col max-md:items-stretch">
            {canManageCarriers(session) ? (
              <Link
                href="/carriers/new"
                className="inline-flex min-h-11 items-center gap-2 rounded-md border border-manifest-red/50 bg-manifest-red/15 px-4 text-sm font-extrabold text-white transition hover:bg-manifest-red/25 max-md:justify-center"
              >
                <Plus className="h-4 w-4" />
                New carrier
              </Link>
            ) : null}
            <Link
              href="/loads"
              className="inline-flex min-h-11 items-center gap-2 rounded-md border border-white/10 bg-black/30 px-4 text-sm font-extrabold text-manifest-muted transition hover:border-manifest-red/50 hover:bg-manifest-red/10 hover:text-white max-md:justify-center"
            >
              <Route className="h-4 w-4" />
              Loads
            </Link>
            {canManageCarriers(session) && !session.platformSuperAdmin ? (
              <Link
                href="/onboarding"
                className="inline-flex min-h-11 items-center gap-2 rounded-md border border-white/10 bg-black/30 px-4 text-sm font-extrabold text-manifest-muted transition hover:border-manifest-red/50 hover:bg-manifest-red/10 hover:text-white max-md:justify-center"
              >
                <Flag className="h-4 w-4" />
                Onboarding
              </Link>
            ) : null}
            {session.platformSuperAdmin ? (
              <Link
                href="/platform"
                className="inline-flex min-h-11 items-center gap-2 rounded-md border border-white/10 bg-black/30 px-4 text-sm font-extrabold text-manifest-muted transition hover:border-manifest-red/50 hover:bg-manifest-red/10 hover:text-white max-md:justify-center"
              >
                <Building2 className="h-4 w-4" />
                Platform
              </Link>
            ) : null}
            <form action={logoutAction}>
              <button className="inline-flex min-h-11 items-center rounded-md border border-white/10 bg-black/30 px-4 text-sm font-extrabold text-manifest-muted transition hover:border-manifest-red/50 hover:bg-manifest-red/10 hover:text-white max-md:w-full max-md:justify-center">
                Sign out
              </button>
            </form>
            <label className="grid gap-2 text-xs font-bold text-manifest-muted max-md:w-full">
              Search
              <span className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-manifest-quiet" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  className="focus-ring h-11 w-72 rounded-md border border-white/10 bg-black/40 py-0 pl-9 pr-3 text-sm text-white shadow-inner shadow-black/40 max-md:w-full"
                  placeholder="Search company, MC, DOT..."
                  type="search"
                />
              </span>
            </label>

            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as CarrierStatus | "All")}
              className="focus-ring h-11 rounded-md border border-white/10 bg-black/40 px-3 text-sm text-white shadow-inner shadow-black/40 max-md:w-full"
              aria-label="Filter carriers by status"
            >
              {statusOptions.map((status) => (
                <option key={status} value={status}>
                  {status === "All" ? "All Statuses" : status}
                </option>
              ))}
            </select>
          </div>
        </header>

        <DashboardTabs activeTab={activeTab} onChange={handleTabChange} />

        {activeTab === "overview" ? (
          <div className="grid gap-5">
            <section
              id="overview"
              className="section-panel overflow-hidden border-manifest-red/30 bg-[linear-gradient(110deg,rgba(227,25,55,0.24),rgba(17,17,20,0.88)_42%,rgba(255,255,255,0.045)),repeating-linear-gradient(135deg,rgba(255,255,255,0.06)_0_1px,transparent_1px_18px)] p-7 max-md:p-5"
            >
              <div className="flex items-center justify-between gap-8 max-lg:flex-col max-lg:items-stretch">
                <div>
                  <p className="eyebrow">Executive Overview</p>
                  <h2 className="max-w-3xl text-4xl font-extrabold leading-tight tracking-normal text-white max-md:text-2xl">
                    Fleet-ready visibility for renewals, audit exposure, and operational risk.
                  </h2>
                  <div className="mt-6 flex flex-wrap gap-3 text-xs font-bold text-manifest-muted">
                    <span className="rounded-md border border-white/10 bg-black/30 px-3 py-2">{branding.slug}</span>
                    <span className="rounded-md border border-white/10 bg-black/30 px-3 py-2">Tenant-scoped data</span>
                    <span className="rounded-md border border-white/10 bg-black/30 px-3 py-2">90-day expiration view</span>
                  </div>
                </div>
                <div className="grid min-h-36 min-w-44 place-items-center rounded-md border border-manifest-red/55 bg-black/45 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
                  <span className="text-xs font-bold uppercase tracking-[0.18em] text-manifest-muted">Risk Watch</span>
                  <strong className="text-6xl leading-none text-white">{activeCarriers.filter(isHighRisk).length}</strong>
                  <span className="text-xs font-bold text-manifest-red">high-risk carriers</span>
                </div>
              </div>
            </section>

            <section className="grid grid-cols-6 gap-4 max-2xl:grid-cols-3 max-md:grid-cols-1" aria-label="Dashboard overview metrics">
              {overviewMetrics.map((metric) => (
                <MetricCard key={metric.label} metric={metric} />
              ))}
            </section>

            <section className="grid grid-cols-[minmax(0,1fr)_minmax(320px,0.55fr)] gap-5 max-xl:grid-cols-1">
              <ExecutiveSummary carriers={activeCarriers} notifications={activeNotifications} events={timelineEvents} />
              <AlertPanel carriers={activeCarriers} />
            </section>
          </div>
        ) : null}

        {activeTab === "compliance" ? (
          <div className="grid gap-5">
            <section className="grid grid-cols-[minmax(0,1.8fr)_minmax(320px,0.8fr)] gap-5 max-xl:grid-cols-1">
              <CarrierRoster carriers={filteredCarriers} selectedCarrierId={selectedCarrierId} onSelectCarrier={setSelectedCarrierId} />
              <AlertPanel carriers={activeCarriers} />
            </section>
            <ExecutiveAnalytics carriers={activeCarriers} />
            <UpcomingModules />
          </div>
        ) : null}

        {activeTab === "operations" ? (
          <div className="grid gap-5">
            <OperationalWorkspace carriers={activeCarriers} notifications={activeNotifications} />
            <NotificationCenter notifications={activeNotifications} />
          </div>
        ) : null}

        {activeTab === "documents" ? (
          <div className="grid gap-5">
            <DocumentChecklist documents={selectedDocuments} selectedCarrier={selectedCarrier} />
            <ComplianceTimeline events={timelineEvents} onSelectCarrier={setSelectedCarrierId} />
          </div>
        ) : null}

        {activeTab === "activity" ? (
          <div className="grid gap-5">
            <ActivityOverview logs={auditLogs} />
            <AuditLogViewer
              logs={auditLogs}
              title="Organization audit log"
              description="Recent tenant activity visible to your role."
            />
          </div>
        ) : null}
      </main>
    </div>
  );
}

function DashboardTabs({
  activeTab,
  onChange,
}: {
  activeTab: DashboardTab;
  onChange: (tab: DashboardTab) => void;
}) {
  return (
    <nav className="mb-5 overflow-x-auto rounded-md border border-white/10 bg-black/35 p-1.5" aria-label="Dashboard sections">
      <div className="flex min-w-max gap-1">
        {dashboardTabs.map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => onChange(tab)}
            className={`inline-flex min-h-11 items-center rounded-md px-4 text-sm font-extrabold capitalize transition ${
              activeTab === tab
                ? "border border-manifest-red/50 bg-manifest-red/15 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
                : "border border-transparent text-manifest-muted hover:border-white/10 hover:bg-white/[0.035] hover:text-white"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>
    </nav>
  );
}

function ExecutiveSummary({
  carriers,
  notifications,
  events,
}: {
  carriers: Carrier[];
  notifications: ComplianceNotification[];
  events: ComplianceTimelineEvent[];
}) {
  const analytics = getDashboardAnalytics(carriers);
  const highPriority = notifications.filter((notification) => ["critical", "high"].includes(notification.priority)).slice(0, 4);
  const upcomingExpirations = events.slice(0, 4);

  return (
    <section className="section-panel p-6 max-md:p-4">
      <div className="mb-5 flex items-center justify-between gap-3 max-md:flex-col max-md:items-stretch">
        <div>
          <p className="eyebrow">Operating Picture</p>
          <h2 className="text-2xl font-extrabold tracking-normal">Executive summary</h2>
        </div>
        <StatusChip value={`${analytics.averageScore} avg score`} />
      </div>
      <div className="grid grid-cols-3 gap-3 max-lg:grid-cols-1">
        <SummaryPanel title="Compliance Score Summary" value={`${analytics.averageScore}/100`} detail={`${carriers.filter(isAuditReady).length} audit-ready carriers`} />
        <SummaryPanel title="High Priority Alerts" value={highPriority.length} detail="Critical and high priority notifications" />
        <SummaryPanel title="Upcoming Expirations" value={upcomingExpirations.length} detail="Next renewal events in queue" />
      </div>
      <div className="mt-5 grid grid-cols-2 gap-4 max-lg:grid-cols-1">
        <ExecutiveList title="Risk watch" items={carriers.filter(isHighRisk).slice(0, 5).map((carrier) => carrier.companyName)} empty="No high-risk carriers." />
        <ExecutiveList
          title="Upcoming expirations"
          items={upcomingExpirations.map((event) => `${event.carrierName}: ${event.documentName} in ${event.daysUntilExpiration} days`)}
          empty="No upcoming expirations."
        />
      </div>
    </section>
  );
}

function OperationalWorkspace({
  carriers,
  notifications,
}: {
  carriers: Carrier[];
  notifications: ComplianceNotification[];
}) {
  const missingDocuments = carriers.flatMap((carrier) =>
    getCarrierDocuments(carrier)
      .filter((document) => document.status === "Missing")
      .map((document) => `${carrier.companyName}: ${document.name}`),
  );
  const loadNotifications = notifications.filter((notification) => notification.category === "load_operation" || notification.category === "archive_operation");
  const invoiceNotifications = notifications.filter((notification) => notification.category === "invoice_operation");

  return (
    <section className="section-panel p-6 max-md:p-4">
      <div className="mb-5 flex items-center justify-between gap-3 max-md:flex-col max-md:items-stretch">
        <div>
          <p className="eyebrow">Operations</p>
          <h2 className="text-2xl font-extrabold tracking-normal">Operational alert queue</h2>
        </div>
        <div className="flex flex-wrap gap-2">
          <StatusChip value={`${loadNotifications.length} load alerts`} />
          <StatusChip value={`${invoiceNotifications.length} invoice alerts`} />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 max-xl:grid-cols-1">
        <ExecutiveList title="POD issues" items={loadNotifications.filter((item) => item.message.toLowerCase().includes("pod")).slice(0, 6).map((item) => item.message)} empty="No POD issues queued." />
        <ExecutiveList title="Missing rate confirmations" items={loadNotifications.filter((item) => item.message.toLowerCase().includes("rate")).slice(0, 6).map((item) => item.message)} empty="No rate confirmation gaps." />
        <ExecutiveList title="Delivered not invoiced" items={invoiceNotifications.slice(0, 6).map((item) => item.message)} empty="No invoice follow-up alerts." />
      </div>
      <div className="mt-4">
        <ExecutiveList title="Assignment actions" items={missingDocuments.slice(0, 8)} empty="No document assignments need attention." />
      </div>
    </section>
  );
}

function DocumentChecklist({
  documents,
  selectedCarrier,
}: {
  documents: ReturnType<typeof getCarrierDocuments>;
  selectedCarrier: Carrier | null;
}) {
  return (
    <section id="documents" className="section-panel p-6 max-md:p-4">
      <div className="mb-5 flex items-center justify-between gap-3 max-md:flex-col max-md:items-stretch">
        <div>
          <p className="eyebrow">Required Documents</p>
          <h2 className="text-2xl font-extrabold tracking-normal">Document checklist</h2>
          <p className="mt-2 text-sm text-manifest-muted">
            {selectedCarrier ? `${selectedCarrier.companyName} document status. Open the profile to upload or manage files.` : "Select a carrier to review document status."}
          </p>
        </div>
        <StatusChip value="12 required items" />
      </div>

      <div className="grid grid-cols-4 gap-3 max-2xl:grid-cols-3 max-lg:grid-cols-2 max-md:grid-cols-1">
        {documents.length ? documents.map((doc) => (
          <article key={doc.name} className={`section-panel min-h-40 p-4 ${documentBorder(doc.status)}`}>
            <div>
              <h3 className="mb-1.5 text-base font-bold leading-tight">{doc.name}</h3>
              <span className="text-xs font-bold text-manifest-muted">
                {doc.uploaded ? "Uploaded" : "Not uploaded"}
              </span>
            </div>

            <dl className="mt-4 grid gap-2.5">
              <DocumentTerm label="Expiration" value={doc.expirationDate ?? "No expiration"} />
              <DocumentTerm label="Days" value={doc.daysUntilExpiration ?? "N/A"} />
              <div className="flex items-center justify-between gap-2 border-t border-manifest-line pt-2.5">
                <dt className="text-[11px] font-extrabold uppercase text-manifest-quiet">Status</dt>
                <dd>
                  <StatusChip value={doc.status} type="document" />
                </dd>
              </div>
            </dl>
          </article>
        )) : (
          <div className="empty-state col-span-full">
            No carrier is selected yet. Add or select a carrier to review required documents.
          </div>
        )}
      </div>
    </section>
  );
}

function ActivityOverview({ logs }: { logs: AuditLog[] }) {
  const loadEvents = logs.filter((log) => log.entityType === "load").length;
  const invoiceEvents = logs.filter((log) => log.entityType === "invoice").length;
  const archiveEvents = logs.filter((log) => log.action.includes("archive")).length;
  const notificationSyncs = logs.filter((log) => log.action.includes("notification")).length;

  return (
    <section id="activity-summary" className="grid grid-cols-4 gap-4 max-xl:grid-cols-2 max-md:grid-cols-1">
      <SummaryPanel title="User Actions" value={logs.length} detail="Visible audit events" />
      <SummaryPanel title="Load Events" value={loadEvents} detail="Load workflow changes" />
      <SummaryPanel title="Invoice Events" value={invoiceEvents} detail="Billing workflow changes" />
      <SummaryPanel title="Archive Downloads" value={archiveEvents + notificationSyncs} detail="Archive and notification activity" />
    </section>
  );
}

function UpcomingModules() {
  return (
    <details className="section-panel p-5">
      <summary className="cursor-pointer text-sm font-extrabold uppercase tracking-[0.18em] text-manifest-muted">
        Upcoming Modules
      </summary>
      <div className="mt-5 grid grid-cols-2 gap-5 max-xl:grid-cols-1">
        <ModulePlaceholder id="driver-qualification-files" eyebrow="Compliance" title="Driver Qualification Files" detail="Placeholder for DQF packets, CDL/medical card review, MVR evidence, and driver audit readiness." />
        <ModulePlaceholder id="safety-audit-prep" eyebrow="Compliance" title="Safety / Audit Prep" detail="Placeholder for safety scorecards, audit packages, corrective action tracking, and review queues." />
        <ModulePlaceholder id="vehicles" eyebrow="Fleet / Maintenance" title="Vehicles" detail="Placeholder for vehicle roster, VIN/unit tracking, registration, and equipment compliance." />
        <ModulePlaceholder id="maintenance" eyebrow="Fleet / Maintenance" title="Maintenance" detail="Placeholder for maintenance events, service intervals, inspection records, and repair follow-up." />
        <ModulePlaceholder id="trip-inspections" eyebrow="Fleet / Maintenance" title="Pre-Trip / Post-Trip" detail="Placeholder for inspection submissions, defects, sign-off workflow, and fleet safety evidence." />
        <ModulePlaceholder id="users" eyebrow="Company" title="Users" detail="Placeholder for organization user management, role assignments, invitations, and access reviews." />
        <ModulePlaceholder id="organization-settings" eyebrow="Company" title="Organization Settings" detail="Placeholder for tenant profile settings, operational defaults, billing configuration, and controls." />
        <ModulePlaceholder id="branding" eyebrow="Company" title="Branding" detail="Placeholder for logo, colors, subdomain, and white-label presentation settings." />
      </div>
    </details>
  );
}

function SummaryPanel({ title, value, detail }: { title: string; value: string | number; detail: string }) {
  return (
    <article className="rounded-md border border-white/10 bg-black/30 p-4">
      <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-manifest-quiet">{title}</p>
      <strong className="mt-3 block text-3xl leading-none text-white">{value}</strong>
      <span className="mt-2 block text-xs font-bold text-manifest-muted">{detail}</span>
    </article>
  );
}

function ExecutiveList({ title, items, empty }: { title: string; items: string[]; empty: string }) {
  return (
    <div className="rounded-md border border-white/10 bg-black/25 p-4">
      <h3 className="mb-3 text-sm font-extrabold uppercase tracking-[0.16em] text-manifest-red">{title}</h3>
      {items.length ? (
        <ul className="grid gap-2 text-sm text-manifest-muted">
          {items.map((item) => (
            <li key={item} className="rounded-md border border-white/10 bg-white/[0.025] px-3 py-2">
              {item}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-manifest-muted">{empty}</p>
      )}
    </div>
  );
}

function Sidebar({
  carriers,
  branding,
  session,
  isOpen,
  onClose,
  activeTab,
  onNavigate,
}: {
  carriers: Carrier[];
  branding: OrganizationBranding;
  session: AuthSession;
  isOpen: boolean;
  onClose: () => void;
  activeTab: DashboardTab;
  onNavigate: (tab: DashboardTab, targetId?: string) => void;
}) {
  const auditReady = carriers.filter(isAuditReady).length;

  return (
    <aside
      className={`sticky top-0 z-40 flex h-screen flex-col overflow-hidden border-r border-white/10 bg-black/75 p-7 backdrop-blur-2xl transition-transform max-xl:fixed max-xl:inset-y-0 max-xl:left-0 max-xl:w-[min(340px,calc(100vw-2rem))] max-xl:shadow-premium ${
        isOpen ? "max-xl:translate-x-0" : "max-xl:-translate-x-full"
      } xl:translate-x-0`}
    >
      <button type="button" onClick={onClose} className="form-button mb-5 hidden max-xl:inline-flex" aria-label="Close navigation">
        <PanelLeftClose className="h-4 w-4" />
        Close
      </button>
      <div className="flex shrink-0 items-center gap-3.5 border-b border-white/10 pb-7">
        {branding.logoUrl ? (
          <img
            src={branding.logoUrl}
            alt={`${branding.name} logo`}
            className="h-12 w-12 rounded-md border border-manifest-red/65 object-contain bg-black/30 p-1"
          />
        ) : (
          <div className="grid h-12 w-12 place-items-center rounded-md border border-manifest-red/65 bg-gradient-to-br from-manifest-red to-manifest-redDark font-extrabold shadow-[0_14px_38px_rgba(227,25,55,0.28)]">
            {branding.name.charAt(0)}
          </div>
        )}
        <div className="min-w-0">
          <p className="eyebrow">{branding.slug}</p>
          <h2 className="break-words text-lg font-extrabold leading-tight tracking-normal">{branding.name}</h2>
        </div>
      </div>

      <nav className="mt-7 grid min-h-0 flex-1 content-start gap-2 overflow-y-auto pr-1 max-xl:flex max-xl:flex-wrap max-xl:content-start" aria-label="Primary">
        {(session.role === "carrier" && !session.platformSuperAdmin ? carrierNavGroups : organizationNavGroups).map((group) => (
          <div key={group.title} className="grid gap-1.5">
            <span className="px-3.5 pt-2 text-[10px] font-extrabold uppercase tracking-[0.18em] text-manifest-quiet">
              {group.title}
            </span>
            {group.items
              .filter((item) => !item.platformOnly || session.platformSuperAdmin)
              .map((item) => (
                <SidebarNavItem
                  key={`${group.title}-${item.label}`}
                  item={item}
                  activeTab={activeTab}
                  onNavigate={onNavigate}
                />
              ))}
          </div>
        ))}
      </nav>

      <div className="mt-6 shrink-0 overflow-hidden rounded-md border border-white/10 bg-white/[0.035] p-4 shadow-premium">
        <span className="panel-label">Audit Posture</span>
        <strong className="mb-2 block break-words text-2xl leading-tight">{auditReady}/{carriers.length} audit ready</strong>
        <p className="break-words text-sm leading-relaxed text-manifest-muted">
          Live tenant data is filtered by organization before it reaches this dashboard.
        </p>
      </div>
    </aside>
  );
}

function EmptyDashboardState({ session }: { session: AuthSession }) {
  return (
    <section id="detail" className="empty-state">
      <div className="flex items-start gap-3 max-md:flex-col">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-md border border-manifest-red/35 bg-manifest-red/10 text-manifest-red">
          <Truck className="h-5 w-5" />
        </span>
        <div>
          <h2 className="text-xl font-extrabold text-white">No carriers in this organization yet</h2>
          <p className="mt-2 max-w-2xl">
            Create the first carrier profile to start tracking compliance, required documents, renewal windows, and alerts for this tenant.
          </p>
          {canManageCarriers(session) ? (
            <Link href="/carriers/new" className="form-button mt-4 min-h-10 px-4 text-sm">
              <Plus className="h-4 w-4" />
              Add carrier
            </Link>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function SidebarNavItem({
  item,
  activeTab,
  onNavigate,
}: {
  item: NavItem;
  activeTab: DashboardTab;
  onNavigate: (tab: DashboardTab, targetId?: string) => void;
}) {
  const Icon = item.icon;
  const target = getSidebarTabTarget(item);
  const isActive = Boolean(target && target.tab === activeTab);
  const className = `flex min-h-10 min-w-0 items-center gap-3 rounded-md border px-3.5 text-sm font-semibold transition ${
    item.placeholder
      ? "border-white/5 text-manifest-quiet opacity-80"
      : isActive
        ? "border-manifest-red/50 bg-manifest-red/15 text-white"
        : "border-transparent text-manifest-muted hover:border-manifest-red/50 hover:bg-manifest-red/10 hover:text-white"
  }`;
  const content = (
    <>
      <Icon className="h-4 w-4 shrink-0" />
      <span className="truncate">{item.label}</span>
      {item.placeholder ? <span className="ml-auto text-[10px] font-extrabold uppercase tracking-[0.12em]">Soon</span> : null}
    </>
  );

  if (item.placeholder) {
    return (
      <button type="button" className={`${className} cursor-not-allowed text-left`} disabled title="Coming soon">
        {content}
      </button>
    );
  }

  if (target) {
    return (
      <button
        type="button"
        onClick={() => onNavigate(target.tab, target.targetId)}
        className={`${className} text-left`}
        aria-current={isActive ? "page" : undefined}
      >
        {content}
      </button>
    );
  }

  return item.href.startsWith("/") ? (
    <Link href={item.href} className={className}>
      {content}
    </Link>
  ) : (
    <a href={item.href} className={className}>
      {content}
    </a>
  );
}

function getSidebarTabTarget(item: NavItem): { tab: DashboardTab; targetId?: string } | null {
  if (item.href.startsWith("/")) return null;

  switch (item.label) {
    case "Overview":
    case "Dashboard":
    case "Analytics":
      return { tab: "overview", targetId: "overview" };
    case "Notifications":
      return { tab: "operations", targetId: "notifications" };
    case "Audit Logs":
      return { tab: "activity" };
    case "Carrier Profiles":
      return { tab: "compliance", targetId: "carriers" };
    case "Required Documents":
    case "Documents":
      return { tab: "documents", targetId: "documents" };
    case "Activity Timeline":
      return { tab: "activity", targetId: "activity-summary" };
    default:
      return null;
  }
}

function ModulePlaceholder({
  id,
  eyebrow,
  title,
  detail,
}: {
  id: string;
  eyebrow: string;
  title: string;
  detail: string;
}) {
  return (
    <section id={id} className="section-panel p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h2 className="text-xl font-extrabold tracking-normal text-white">{title}</h2>
          <p className="mt-2 text-sm leading-6 text-manifest-muted">{detail}</p>
        </div>
        <span className="rounded-md border border-white/10 bg-white/[0.035] px-2 py-1 text-[10px] font-extrabold uppercase tracking-[0.14em] text-manifest-muted">
          Soon
        </span>
      </div>
    </section>
  );
}

function MetricCard({
  metric,
}: {
  metric: ReturnType<typeof getOverviewMetrics>[number];
}) {
  const tone = {
    neutral: "border-white/10 text-white",
    good: "border-manifest-green/35 text-manifest-green",
    warn: "border-manifest-amber/35 text-manifest-amber",
    danger: "border-manifest-danger/45 text-manifest-danger",
  }[metric.tone];

  return (
    <article className={`section-panel min-h-36 overflow-hidden p-4 ${tone}`}>
      <div className="mb-5 flex items-center justify-between gap-3">
        <span className="block min-h-10 text-sm font-bold leading-5 text-manifest-muted">{metric.label}</span>
        <span className="grid h-9 w-9 place-items-center rounded-md border border-white/10 bg-black/30">
          {metric.tone === "neutral" ? <BarChart3 className="h-4 w-4" /> : <Activity className="h-4 w-4" />}
        </span>
      </div>
      <strong className="block text-5xl leading-none tracking-normal">{metric.value}</strong>
      <div className="mt-4 h-1 rounded-full bg-white/10">
        <div className={`h-full rounded-full ${metric.tone === "danger" ? "bg-manifest-danger" : metric.tone === "warn" ? "bg-manifest-amber" : metric.tone === "good" ? "bg-manifest-green" : "bg-manifest-red"}`} />
      </div>
    </article>
  );
}

function CarrierRoster({
  carriers,
  selectedCarrierId,
  onSelectCarrier,
}: {
  carriers: Carrier[];
  selectedCarrierId: string;
  onSelectCarrier: (carrierId: string) => void;
}) {
  return (
    <section id="carriers" className="section-panel p-6 max-md:p-4">
      <div className="mb-5 flex items-center justify-between gap-3 max-md:flex-col max-md:items-stretch">
        <div>
          <p className="eyebrow">Carrier Profiles</p>
          <h2 className="text-2xl font-extrabold tracking-normal">Carrier roster</h2>
        </div>
        <StatusChip value={`${carriers.length} carrier${carriers.length === 1 ? "" : "s"}`} />
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] border-collapse">
          <thead>
            <tr className="bg-white/[0.025] text-left text-[11px] uppercase tracking-[0.14em] text-manifest-quiet">
              <th className="border-b border-white/10 px-4 py-4">Company</th>
              <th className="border-b border-white/10 px-4 py-4">MC / DOT</th>
              <th className="border-b border-white/10 px-4 py-4">Contact</th>
              <th className="border-b border-white/10 px-4 py-4">Status</th>
              <th className="border-b border-white/10 px-4 py-4">Score</th>
              <th className="border-b border-white/10 px-4 py-4">Alerts</th>
            </tr>
          </thead>
          <tbody>
            {carriers.length ? carriers.map((carrier) => (
              <CarrierRow
                key={carrier.id}
                carrier={carrier}
                isSelected={carrier.id === selectedCarrierId}
                onSelectCarrier={onSelectCarrier}
              />
            )) : (
              <tr>
                <td colSpan={6} className="border-b border-white/10 px-4 py-8">
                  <div className="empty-state">
                    No carriers match the current search and status filters.
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function AlertPanel({ carriers }: { carriers: Carrier[] }) {
  return (
    <section id="alerts" className="section-panel p-6 max-md:p-4">
      <div className="mb-5">
        <p className="eyebrow">Alerts</p>
        <h2 className="text-2xl font-extrabold tracking-normal">Automatic labels</h2>
      </div>

      <div className="grid gap-2.5">
        {alertLabels.map((alert) => {
          const count = carriers.filter((carrier) => getCarrierAlerts(carrier).includes(alert)).length;

          return (
            <div
              key={alert}
              className="flex min-h-14 items-center justify-between rounded-md border border-white/10 bg-black/30 px-3.5"
            >
              <span className="font-bold text-manifest-muted">{alert}</span>
              <strong className="text-2xl text-manifest-red">{count}</strong>
            </div>
          );
        })}
      </div>

      <div className="mt-5 border-t border-white/10 pt-4">
        <span className="panel-label">Risk Indicators</span>
        <div className="grid gap-2 text-xs font-bold text-manifest-muted">
          <RiskLegendItem colorClass="bg-manifest-green" label="Green" value="Audit Ready" />
          <RiskLegendItem colorClass="bg-manifest-amber" label="Yellow" value="Needs Attention" />
          <RiskLegendItem colorClass="bg-manifest-orange" label="Orange" value="Moderate Risk" />
          <RiskLegendItem colorClass="bg-manifest-danger" label="Red" value="High Risk" />
        </div>
      </div>
    </section>
  );
}

function ExecutiveAnalytics({ carriers }: { carriers: Carrier[] }) {
  const analytics = getDashboardAnalytics(carriers);

  return (
    <section id="analytics" className="section-panel mb-5 p-6 max-md:p-4">
      <div className="mb-5 flex items-center justify-between gap-3 max-md:flex-col max-md:items-stretch">
        <div>
          <p className="eyebrow">Executive Analytics</p>
          <h2 className="text-2xl font-extrabold tracking-normal">Compliance performance</h2>
        </div>
        <StatusChip value={`${analytics.averageScore}% average compliance`} />
      </div>

      <div className="mb-5 grid grid-cols-4 gap-3 max-2xl:grid-cols-2 max-md:grid-cols-1">
        {analytics.kpis.map((kpi) => (
          <article key={kpi.label} className={`rounded-md border bg-black/30 p-4 ${kpi.border}`}>
            <span className="block text-xs font-bold uppercase tracking-[0.14em] text-manifest-quiet">
              {kpi.label}
            </span>
            <strong className={`mt-3 block text-4xl leading-none ${kpi.text}`}>{kpi.value}</strong>
            <span className="mt-2 block text-xs font-bold text-manifest-muted">{kpi.detail}</span>
          </article>
        ))}
      </div>

      <div className="grid grid-cols-[minmax(0,1.2fr)_minmax(280px,0.8fr)_minmax(280px,0.8fr)] gap-4 max-2xl:grid-cols-1">
        <ChartPanel title="Compliance Trend" label="Average score by month">
          <div className="flex h-64 items-end gap-3 border-b border-white/10 pb-4">
            {analytics.trend.map((point) => (
              <div key={point.label} className="grid h-full flex-1 content-end gap-2">
                <div className="flex h-48 items-end rounded-md bg-black/25 p-1">
                  <div
                    className="w-full rounded-sm bg-gradient-to-t from-manifest-red to-white"
                    style={{ height: `${point.score}%` }}
                  />
                </div>
                <div className="text-center">
                  <strong className="block text-xs text-white">{point.score}</strong>
                  <span className="text-[11px] font-bold text-manifest-muted">{point.label}</span>
                </div>
              </div>
            ))}
          </div>
        </ChartPanel>

        <ChartPanel title="Carrier Risk Distribution" label="Current carrier risk tiers">
          <div className="grid gap-3">
            {analytics.riskDistribution.map((risk) => (
              <div key={risk.label} className="grid gap-2">
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className={`font-bold ${risk.text}`}>{risk.label}</span>
                  <strong className="text-white">{risk.count}</strong>
                </div>
                <div className="h-3 overflow-hidden rounded-full bg-white/10">
                  <div
                    className={`h-full rounded-full ${risk.bar}`}
                    style={{ width: `${risk.percent}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </ChartPanel>

        <ChartPanel title="Document Expiration Chart" label="Upcoming document exposure">
          <div className="grid gap-3">
            {analytics.expirationBuckets.map((bucket) => (
              <div key={bucket.label} className="rounded-md border border-white/10 bg-black/25 p-3">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <span className="text-sm font-bold text-manifest-muted">{bucket.label}</span>
                  <strong className={bucket.text}>{bucket.count}</strong>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-white/10">
                  <div
                    className={`h-full rounded-full ${bucket.bar}`}
                    style={{ width: `${bucket.percent}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </ChartPanel>
      </div>
    </section>
  );
}

function ChartPanel({
  title,
  label,
  children,
}: {
  title: string;
  label: string;
  children: ReactNode;
}) {
  return (
    <article className="rounded-md border border-white/10 bg-black/30 p-4">
      <div className="mb-4">
        <span className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-manifest-red">
          {title}
        </span>
        <h3 className="mt-1 text-sm font-bold text-manifest-muted">{label}</h3>
      </div>
      {children}
    </article>
  );
}

function getDashboardAnalytics(carriers: Carrier[]) {
  const documents = carriers.flatMap(getCarrierDocuments);
  const expiringIn7 = documents.filter(
    (doc) =>
      doc.daysUntilExpiration !== null &&
      doc.daysUntilExpiration >= 0 &&
      doc.daysUntilExpiration <= 7,
  ).length;
  const expiringIn30 = documents.filter(
    (doc) =>
      doc.daysUntilExpiration !== null &&
      doc.daysUntilExpiration >= 0 &&
      doc.daysUntilExpiration <= 30,
  ).length;
  const missingDocuments = documents.filter((doc) => doc.status === "Missing").length;
  const scores = carriers.map(getComplianceScore);
  const averageScore = scores.length
    ? Math.round(scores.reduce((total, score) => total + score, 0) / scores.length)
    : 0;
  const highRisk = carriers.filter(isHighRisk).length;
  const auditReady = carriers.filter(isAuditReady).length;
  const active = carriers.filter((carrier) => carrier.status === "Active").length;

  const kpis = [
    {
      label: "Total carriers",
      value: carriers.length,
      detail: "All onboarded carrier profiles",
      border: "border-white/10",
      text: "text-white",
    },
    {
      label: "Active carriers",
      value: active,
      detail: "Available for dispatch review",
      border: "border-manifest-green/35",
      text: "text-manifest-green",
    },
    {
      label: "High-risk carriers",
      value: highRisk,
      detail: "Requires immediate compliance review",
      border: "border-manifest-danger/45",
      text: "text-manifest-danger",
    },
    {
      label: "Audit-ready carriers",
      value: auditReady,
      detail: "No blocking checklist issues",
      border: "border-manifest-green/35",
      text: "text-manifest-green",
    },
    {
      label: "Expiring in 7 days",
      value: expiringIn7,
      detail: "Critical document renewals",
      border: "border-manifest-danger/45",
      text: "text-manifest-danger",
    },
    {
      label: "Expiring in 30 days",
      value: expiringIn30,
      detail: "Renewal queue",
      border: "border-manifest-amber/45",
      text: "text-manifest-amber",
    },
    {
      label: "Missing documents",
      value: missingDocuments,
      detail: "Required items not uploaded",
      border: "border-manifest-orange/45",
      text: "text-manifest-orange",
    },
    {
      label: "Avg. compliance score",
      value: averageScore,
      detail: "Across active mock carrier set",
      border: "border-manifest-red/45",
      text: "text-white",
    },
  ];

  const riskDistribution = buildRiskDistribution(carriers);
  const expirationBuckets = buildExpirationBuckets(documents);

  return {
    averageScore,
    kpis,
    riskDistribution,
    expirationBuckets,
    trend: buildComplianceTrend(averageScore),
  };
}

function buildRiskDistribution(carriers: Carrier[]) {
  const tiers = [
    {
      label: "Audit Ready",
      match: (carrier: Carrier) => getComplianceTier(carrier) === "Audit Ready",
      bar: "bg-manifest-green",
      text: "text-manifest-green",
    },
    {
      label: "Strong Compliance",
      match: (carrier: Carrier) => getComplianceTier(carrier) === "Strong Compliance",
      bar: "bg-manifest-green",
      text: "text-manifest-green",
    },
    {
      label: "Mostly Compliant",
      match: (carrier: Carrier) => getComplianceTier(carrier) === "Mostly Compliant",
      bar: "bg-manifest-green",
      text: "text-manifest-green",
    },
    {
      label: "Needs Attention",
      match: (carrier: Carrier) => getComplianceTier(carrier) === "Needs Attention",
      bar: "bg-manifest-amber",
      text: "text-manifest-amber",
    },
    {
      label: "Moderate Risk",
      match: (carrier: Carrier) => getComplianceTier(carrier) === "Moderate Risk",
      bar: "bg-manifest-orange",
      text: "text-manifest-orange",
    },
    {
      label: "High Risk",
      match: (carrier: Carrier) => getComplianceTier(carrier) === "High Risk",
      bar: "bg-manifest-danger",
      text: "text-manifest-danger",
    },
  ];

  return tiers.map((tier) => {
    const count = carriers.filter(tier.match).length;
    return {
      ...tier,
      count,
      percent: count > 0 && carriers.length ? Math.max(4, Math.round((count / carriers.length) * 100)) : 0,
    };
  });
}

function buildExpirationBuckets(documents: ReturnType<typeof getCarrierDocuments>) {
  const buckets = [
    {
      label: "0-7 days",
      count: documents.filter((doc) => isWithinDays(doc.daysUntilExpiration, 0, 7)).length,
      bar: "bg-manifest-danger",
      text: "text-manifest-danger",
    },
    {
      label: "8-30 days",
      count: documents.filter((doc) => isWithinDays(doc.daysUntilExpiration, 8, 30)).length,
      bar: "bg-manifest-amber",
      text: "text-manifest-amber",
    },
    {
      label: "31-60 days",
      count: documents.filter((doc) => isWithinDays(doc.daysUntilExpiration, 31, 60)).length,
      bar: "bg-manifest-orange",
      text: "text-manifest-orange",
    },
    {
      label: "61-90 days",
      count: documents.filter((doc) => isWithinDays(doc.daysUntilExpiration, 61, 90)).length,
      bar: "bg-manifest-green",
      text: "text-manifest-green",
    },
  ];
  const max = Math.max(...buckets.map((bucket) => bucket.count), 1);

  return buckets.map((bucket) => ({
    ...bucket,
    percent: bucket.count > 0 ? Math.max(4, Math.round((bucket.count / max) * 100)) : 0,
  }));
}

function buildComplianceTrend(averageScore: number) {
  return [
    { label: "Jan", score: Math.max(0, averageScore - 8) },
    { label: "Feb", score: Math.max(0, averageScore - 5) },
    { label: "Mar", score: Math.max(0, averageScore - 3) },
    { label: "Apr", score: Math.max(0, averageScore - 1) },
    { label: "May", score: averageScore },
    { label: "Jun", score: Math.min(100, averageScore + 2) },
  ];
}

function isWithinDays(days: number | null, min: number, max: number) {
  return days !== null && days >= min && days <= max;
}

function ComplianceTimeline({
  events,
  onSelectCarrier,
}: {
  events: ComplianceTimelineEvent[];
  onSelectCarrier: (carrierId: string) => void;
}) {
  const firstThirty = events.filter((event) => event.daysUntilExpiration <= 30).length;

  return (
    <section id="timeline" className="section-panel mb-5 p-6 max-md:p-4">
      <div className="mb-5 flex items-center justify-between gap-3 max-md:flex-col max-md:items-stretch">
        <div>
          <p className="eyebrow">Compliance Timeline</p>
          <h2 className="text-2xl font-extrabold tracking-normal">Upcoming expirations</h2>
        </div>
        <div className="flex flex-wrap gap-2">
          <StatusChip value={`${events.length} in next 90 days`} />
          <StatusChip value={`${firstThirty} in next 30 days`} />
        </div>
      </div>

      {events.length ? (
        <div className="grid gap-3">
          {events.map((event) => (
            <button
              key={event.id}
              type="button"
              onClick={() => onSelectCarrier(event.carrierId)}
              className="focus-ring grid grid-cols-[150px_minmax(0,1fr)_auto] items-center gap-4 rounded-md border border-white/10 bg-black/30 p-4 text-left transition hover:border-manifest-red/50 hover:bg-manifest-red/10 max-lg:grid-cols-1"
            >
              <div className="flex items-center gap-3">
                <span className={`h-3 w-3 ${timelineDotColor(event)}`} />
                <div>
                  <strong className={`block text-sm ${timelineTextColor(event)}`}>
                    {event.daysUntilExpiration} days
                  </strong>
                  <span className="text-xs text-manifest-muted">{event.expirationDate}</span>
                </div>
              </div>

              <div>
                <strong className="block text-sm text-white">{event.carrierName}</strong>
                <span className="text-xs text-manifest-muted">{event.documentName}</span>
              </div>

              <StatusChip value={event.status} type="document" />
            </button>
          ))}
        </div>
      ) : (
        <div className="rounded-md border border-white/10 bg-black/30 p-4 text-sm text-manifest-muted">
          No document expirations are scheduled in the next 90 days.
        </div>
      )}
    </section>
  );
}

function RiskLegendItem({
  colorClass,
  label,
  value,
}: {
  colorClass: string;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="flex items-center gap-2">
        <i className={`h-2.5 w-2.5 ${colorClass}`} />
        {label}
      </span>
      <span>{value}</span>
    </div>
  );
}

function CarrierDetail({ carrier }: { carrier: Carrier }) {
  const actions = getActionItems(carrier);
  const scoreBreakdown = getComplianceScoreBreakdown(carrier);
  const score = scoreBreakdown.finalScore;
  const tier = scoreBreakdown.tier;

  return (
    <section id="detail" className="section-panel p-6 max-md:p-4">
      <div className="mb-5 flex items-center justify-between gap-3 max-md:flex-col max-md:items-stretch">
        <div>
          <p className="eyebrow">Carrier Detail Page</p>
          <h2 className="text-2xl font-extrabold tracking-normal">{carrier.companyName}</h2>
        </div>
        <div className="flex flex-wrap gap-2">
          <StatusChip value={carrier.status} type="carrier" />
          <Link
            href={`/carriers/${carrier.id}`}
            className="inline-flex min-h-7 items-center rounded-md border border-manifest-red/50 bg-manifest-red/10 px-2.5 text-xs font-extrabold text-white transition hover:bg-manifest-red/20"
          >
            Open profile
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-[minmax(0,1.5fr)_minmax(260px,0.5fr)] gap-4 max-xl:grid-cols-1">
        <div className="rounded-md border border-white/10 bg-black/30 p-5">
          <div className="mb-5 grid grid-cols-3 gap-3 max-lg:grid-cols-2 max-md:grid-cols-1">
            {[
              ["MC Number", carrier.mcNumber],
              ["DOT Number", carrier.dotNumber],
              ["Contact", carrier.contactName],
              ["Phone", carrier.phone],
              ["Email", carrier.email],
              ["Score Tier", tier],
            ].map(([label, value]) => (
              <div key={label} className="min-h-20 rounded-md border border-white/10 bg-white/[0.025] p-3">
                <span className="mb-2 block text-[11px] font-extrabold uppercase text-manifest-quiet">
                  {label}
                </span>
                <strong className="text-sm">{value}</strong>
              </div>
            ))}
          </div>

          <div className="mb-5 border-b border-white/10 pb-5">
            <span className="panel-label">Notes</span>
            <p className="text-sm leading-relaxed text-manifest-muted">{carrier.notes}</p>
          </div>

          <div>
            <span className="panel-label">Action Items</span>
            <ul className="mt-2 grid gap-2 pl-5 text-sm leading-relaxed text-manifest-muted">
              {actions.map((action) => (
                <li key={action}>{action}</li>
              ))}
            </ul>
          </div>
        </div>

        <div className="grid justify-items-center rounded-md border border-white/10 bg-black/30 p-5 text-center">
          <span className="panel-label">Compliance Score</span>
          <div
            className="my-4 grid h-44 w-44 place-items-center rounded-full"
            style={{
              background: `radial-gradient(circle at center, #111114 0 58%, transparent 59%), conic-gradient(#e31937 ${score}%, #2c2c32 0)`,
            }}
          >
            <div>
              <strong className="block text-5xl leading-none">{score}</strong>
              <span className="text-manifest-muted">/100</span>
            </div>
          </div>
          <StatusChip value={tier} type="risk" />
          <p className="text-sm leading-relaxed text-manifest-muted">{getScoreSummary(carrier)}</p>
          <div className="mt-4 w-full border-t border-white/10 pt-4 text-left">
            <span className="panel-label">Score Deductions</span>
            <ul className="grid gap-2 text-xs text-manifest-muted">
              {scoreBreakdown.deductions.length ? (
                scoreBreakdown.deductions.map((deduction) => (
                  <li key={`${deduction.documentName}-${deduction.reason}`} className="flex justify-between gap-3">
                    <span>
                      {deduction.documentName}: {deduction.reason}
                    </span>
                    <strong className="text-manifest-danger">-{deduction.points}</strong>
                  </li>
                ))
              ) : (
                <li>No deductions applied.</li>
              )}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}

function CarrierRow({
  carrier,
  isSelected,
  onSelectCarrier,
}: {
  carrier: Carrier;
  isSelected: boolean;
  onSelectCarrier: (carrierId: string) => void;
}) {
  const score = getComplianceScore(carrier);
  const tier = getComplianceTier(carrier);

  return (
    <tr
      tabIndex={0}
      onClick={() => {
        onSelectCarrier(carrier.id);
        window.location.assign(`/carriers/${carrier.id}`);
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelectCarrier(carrier.id);
          window.location.assign(`/carriers/${carrier.id}`);
        }
      }}
      className={`focus-ring cursor-pointer transition hover:bg-manifest-red/10 ${
        isSelected ? "bg-manifest-red/10" : ""
      }`}
    >
      <td className="border-b border-white/10 px-4 py-4">
        <strong className="mb-1 block text-sm">{carrier.companyName}</strong>
        <span className="text-xs text-manifest-muted">{carrier.email}</span>
      </td>
      <td className="border-b border-white/10 px-4 py-4">
        <strong className="mb-1 block text-sm">{carrier.mcNumber}</strong>
        <span className="text-xs text-manifest-muted">{carrier.dotNumber}</span>
      </td>
      <td className="border-b border-white/10 px-4 py-4">
        <strong className="mb-1 block text-sm">{carrier.contactName}</strong>
        <span className="text-xs text-manifest-muted">{carrier.phone}</span>
      </td>
      <td className="border-b border-white/10 px-4 py-4">
        <StatusChip value={carrier.status} type="carrier" />
      </td>
      <td className="border-b border-white/10 px-4 py-4">
        <div className="grid min-w-28 gap-2">
          <span className={`text-xs font-bold ${riskTextColor(tier)}`}>{score} - {tier}</span>
          <div className="h-2 overflow-hidden bg-[#2a2a30]">
            <div
              className={`h-full ${riskBarColor(tier)}`}
              style={{ width: `${score}%` }}
            />
          </div>
        </div>
      </td>
      <td className="border-b border-white/10 px-4 py-4">
        <div className="flex max-w-72 flex-wrap gap-1.5">
          {getCarrierAlerts(carrier).map((alert) => (
            <StatusChip key={alert} value={alert} />
          ))}
          <Link
            href={`/carriers/${carrier.id}`}
            onClick={(event) => event.stopPropagation()}
            className="inline-flex min-h-7 items-center rounded-md border border-manifest-red/50 bg-manifest-red/10 px-2.5 text-xs font-extrabold text-white transition hover:bg-manifest-red/20"
          >
            View profile
          </Link>
        </div>
      </td>
    </tr>
  );
}

function DocumentTerm({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-center justify-between gap-2 border-t border-white/10 pt-2.5">
      <dt className="text-[11px] font-extrabold uppercase text-manifest-quiet">{label}</dt>
      <dd className="text-sm text-white">{value}</dd>
    </div>
  );
}

function documentBorder(status: string) {
  if (status === "Valid") return "border-manifest-green/30";
  if (status === "Expiring Soon") return "border-manifest-amber/55";
  return "border-manifest-danger/60";
}

function riskTextColor(tier: string) {
  if (["Audit Ready", "Strong Compliance", "Mostly Compliant"].includes(tier)) return "text-manifest-green";
  if (tier === "Needs Attention") return "text-manifest-amber";
  if (tier === "Moderate Risk") return "text-manifest-orange";
  return "text-manifest-danger";
}

function riskBarColor(tier: string) {
  if (["Audit Ready", "Strong Compliance", "Mostly Compliant"].includes(tier)) return "bg-manifest-green";
  if (tier === "Needs Attention") return "bg-manifest-amber";
  if (tier === "Moderate Risk") return "bg-manifest-orange";
  return "bg-manifest-danger";
}

function timelineDotColor(event: ComplianceTimelineEvent) {
  if (event.daysUntilExpiration <= 15) return "bg-manifest-danger";
  if (event.daysUntilExpiration <= 30) return "bg-manifest-amber";
  return "bg-manifest-green";
}

function timelineTextColor(event: ComplianceTimelineEvent) {
  if (event.daysUntilExpiration <= 15) return "text-manifest-danger";
  if (event.daysUntilExpiration <= 30) return "text-manifest-amber";
  return "text-manifest-green";
}

function getInitialDashboardTab(): DashboardTab {
  if (typeof window === "undefined") return "overview";
  const tab = new URLSearchParams(window.location.search).get("tab");
  return dashboardTabs.includes(tab as DashboardTab) ? (tab as DashboardTab) : "overview";
}
