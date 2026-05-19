"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import { CalendarDays, Download, Mail, Route } from "lucide-react";
import { LoadDocumentUploader } from "@/components/load-document-uploader";
import { StatusChip } from "@/components/status-chip";
import { canUploadLoadDocumentType } from "@/lib/security/tenant-rules";
import type { AuthSession } from "@/types/carrier";
import type { Load, LoadDocument, LoadDocumentType } from "@/types/load";

type LoadFilter = "date" | "week" | "month" | "all";

export function CarrierAssignedLoads({
  carrierId,
  loads,
  session,
}: {
  carrierId: string;
  loads: Load[];
  session: AuthSession;
}) {
  const [selectedDate, setSelectedDate] = useState(todayKey());
  const [filter, setFilter] = useState<LoadFilter>("date");
  const filteredLoads = useMemo(
    () => filterLoads(loads, selectedDate, filter),
    [filter, loads, selectedDate],
  );

  return (
    <section className="section-panel mt-5 p-6 max-md:p-4">
      <div className="mb-5 flex items-start justify-between gap-4 max-lg:flex-col">
        <div>
          <p className="eyebrow">Loads</p>
          <h2 className="text-2xl font-extrabold tracking-normal">Assigned loads</h2>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <a href={`/loads/archive?carrierId=${carrierId}&month=${selectedDate.slice(0, 7)}`} className="form-button min-h-10 px-3 text-sm">
            <Download className="h-4 w-4" />
            Download Monthly Archive
          </a>
          <StatusChip value={`${filteredLoads.length} shown`} />
          <StatusChip value={`${loads.length} assigned`} />
          <Route className="h-5 w-5 text-manifest-red" />
        </div>
      </div>

      <div className="mb-5 rounded-md border border-white/10 bg-black/25 p-3">
        <div className="flex flex-wrap items-end gap-3">
          <label className="grid min-w-52 flex-1 gap-2 text-xs font-bold uppercase tracking-[0.18em] text-manifest-quiet">
            Scheduled Date
            <input
              type="date"
              value={selectedDate}
              onChange={(event) => {
                setSelectedDate(event.target.value);
                setFilter("date");
              }}
              className="form-control"
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <FilterButton active={filter === "date" && selectedDate === todayKey()} onClick={() => {
              setSelectedDate(todayKey());
              setFilter("date");
            }}>
              Today
            </FilterButton>
            <FilterButton active={filter === "week"} onClick={() => setFilter("week")}>This Week</FilterButton>
            <FilterButton active={filter === "month"} onClick={() => setFilter("month")}>This Month</FilterButton>
            <FilterButton active={filter === "all"} onClick={() => setFilter("all")}>All</FilterButton>
          </div>
        </div>
      </div>

      {filteredLoads.length ? (
        <div className="grid gap-4">
          {filteredLoads.map((load) => {
            const pod = latestLoadDocument(load.documents, "pod");
            const rateConfirmation = latestLoadDocument(load.documents, "rate_confirmation");
            const canUploadPod = canUploadLoadDocumentType(
              session,
              { organizationId: load.organizationId, carrierId: load.carrierId },
              "pod",
            );
            const canUploadRateConfirmation = canUploadLoadDocumentType(
              session,
              { organizationId: load.organizationId, carrierId: load.carrierId },
              "rate_confirmation",
            );

            return (
              <article key={load.id} className="rounded-md border border-white/10 bg-black/25 p-4">
                <div className="mb-4 flex items-start justify-between gap-3 max-lg:flex-col">
                  <div>
                    <Link href={`/loads/${load.id}`} className="text-lg font-extrabold text-white hover:text-manifest-red">
                      Load {load.loadNumber}
                    </Link>
                    <p className="mt-1 text-sm leading-6 text-manifest-muted">
                      {load.originCity}, {load.originState} to {load.destinationCity}, {load.destinationState}
                    </p>
                  </div>
                  <StatusChip value={formatLoadStatus(load.status)} />
                </div>

                <div className="mb-4 grid grid-cols-4 gap-3 max-xl:grid-cols-2 max-md:grid-cols-1">
                  <InfoTile label="Broker" value={load.brokerName || "Broker"} icon={<Mail className="h-3.5 w-3.5" />} />
                  <InfoTile label="Pickup" value={load.pickupDate ?? "No pickup date"} icon={<CalendarDays className="h-3.5 w-3.5" />} />
                  <InfoTile label="Delivery" value={load.deliveryDate ?? "No delivery date"} icon={<CalendarDays className="h-3.5 w-3.5" />} />
                  <InfoTile label="Rate" value={formatMoney(load.rateAmount)} />
                </div>

                <div className="grid grid-cols-2 gap-4 max-lg:grid-cols-1">
                  <LoadDocumentUploader
                    loadId={load.id}
                    documentType="pod"
                    label="Upload Load Document: POD"
                    document={pod}
                    canUpload={canUploadPod}
                    fileDeleted={Boolean(load.filesDeletedAt)}
                  />
                  <LoadDocumentUploader
                    loadId={load.id}
                    documentType="rate_confirmation"
                    label="Rate Confirmation"
                    document={rateConfirmation}
                    canUpload={canUploadRateConfirmation}
                    fileDeleted={Boolean(load.filesDeletedAt)}
                  />
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="empty-state">No loads scheduled for this date.</div>
      )}
    </section>
  );
}

function FilterButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex min-h-10 items-center rounded-md border px-3 text-sm font-bold transition ${
        active
          ? "border-manifest-red bg-manifest-red/15 text-white"
          : "border-white/10 bg-black/30 text-manifest-muted hover:border-manifest-red/50 hover:bg-manifest-red/10 hover:text-white"
      }`}
    >
      {children}
    </button>
  );
}

function InfoTile({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon?: ReactNode;
}) {
  return (
    <div className="min-h-20 rounded-md border border-white/10 bg-white/[0.025] p-3">
      <span className="mb-2 flex items-center gap-2 text-[11px] font-extrabold uppercase text-manifest-quiet">
        {icon}
        {label}
      </span>
      <strong className="text-sm text-white">{value}</strong>
    </div>
  );
}

function filterLoads(loads: Load[], selectedDate: string, filter: LoadFilter) {
  if (filter === "all") return loads;

  const today = todayKey();
  const range =
    filter === "week"
      ? getWeekRange(today)
      : filter === "month"
        ? getMonthRange(today)
        : { start: selectedDate, end: selectedDate };

  return loads.filter((load) => {
    const pickupDate = dateKey(load.pickupDate);
    const deliveryDate = dateKey(load.deliveryDate);
    return isWithinRange(pickupDate, range.start, range.end) || isWithinRange(deliveryDate, range.start, range.end);
  });
}

function isWithinRange(value: string | null, start: string, end: string) {
  return Boolean(value && value >= start && value <= end);
}

function getWeekRange(value: string) {
  const date = parseDateKey(value);
  const day = date.getDay();
  const start = new Date(date);
  start.setDate(date.getDate() - day);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return { start: toDateKey(start), end: toDateKey(end) };
}

function getMonthRange(value: string) {
  const date = parseDateKey(value);
  const start = new Date(date.getFullYear(), date.getMonth(), 1);
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  return { start: toDateKey(start), end: toDateKey(end) };
}

function parseDateKey(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function dateKey(value: string | null) {
  return value ? value.slice(0, 10) : null;
}

function todayKey() {
  return toDateKey(new Date());
}

function toDateKey(value: Date) {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
}

function latestLoadDocument(documents: LoadDocument[], documentType: LoadDocumentType) {
  return documents.filter((document) => document.documentType === documentType).sort((a, b) => b.versionNumber - a.versionNumber)[0] ?? null;
}

function formatLoadStatus(value: string) {
  return value.split("_").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
}
