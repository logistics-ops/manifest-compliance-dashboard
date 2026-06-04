import { documentSlug } from "@/lib/action-center";
import { getCarrierDocuments } from "@/lib/compliance";
import type { DQFileRecord } from "@/lib/data/dq-files";
import type { VehicleRecord } from "@/lib/data/vehicles";
import type { Carrier } from "@/types/carrier";

export type OnboardingProgressStatus = "Not Started" | "In Progress" | "Near Complete" | "Complete";
export type OnboardingProgressCategoryName =
  | "Company Documents"
  | "Driver Files"
  | "Vehicle Files"
  | "Vehicle Maintenance"
  | "Required Compliance Documents";

export type OnboardingProgressItem = {
  id: string;
  label: string;
  status: "complete" | "missing" | "expired" | "expiring";
  correctionHref: string;
};

export type OnboardingProgressCategory = {
  name: OnboardingProgressCategoryName;
  percentage: number;
  completedItems: OnboardingProgressItem[];
  missingItems: OnboardingProgressItem[];
  expiringItems: OnboardingProgressItem[];
  expiredItems: OnboardingProgressItem[];
  totalItems: number;
};

export type CarrierOnboardingProgress = {
  carrierId: string;
  carrierName: string;
  percentage: number;
  status: OnboardingProgressStatus;
  completedCount: number;
  missingCount: number;
  expiringCount: number;
  expiredCount: number;
  criticalMissingCount: number;
  categories: OnboardingProgressCategory[];
};

export type OnboardingProgressDashboardSummary = {
  complete: number;
  inProgress: number;
  missingCriticalDocuments: number;
};

const companyDocumentNames = new Set(["Certificate of Insurance", "W-9", "Operating Authority", "Drug & Alcohol Consortium"]);
const vehicleMaintenanceNames = new Set(["Annual Inspection", "Preventive Maintenance", "Insurance", "Registration", "Vehicle Registration"]);
const criticalDocumentNames = new Set(["Certificate of Insurance", "W-9", "Operating Authority", "Annual Inspection", "Vehicle Registration"]);

export function buildCarrierOnboardingProgress(input: {
  carrier: Carrier;
  drivers?: DQFileRecord[];
  vehicles?: VehicleRecord[];
}): CarrierOnboardingProgress {
  const carrierDocuments = getCarrierDocuments(input.carrier);
  const drivers = input.drivers ?? [];
  const vehicles = input.vehicles ?? [];
  const categories: OnboardingProgressCategory[] = [
    buildCategory(
      "Company Documents",
      carrierDocuments
        .filter((document) => companyDocumentNames.has(document.name))
        .map((document) => ({
          id: `company:${documentSlug(document.name)}`,
          label: document.name,
          status: itemStatus(document.status),
          correctionHref: `/carriers/${input.carrier.id}#document-${documentSlug(document.name)}`,
        })),
    ),
    buildCategory(
      "Driver Files",
      drivers.flatMap((driver) =>
        driver.checklist
          .filter((item) => !item.notApplicable)
          .map((item) => ({
            id: `driver:${driver.id}:${documentSlug(item.name)}`,
            label: `${driver.driverName || "Unnamed driver"} - ${item.name}`,
            status: checklistStatus(item.missing, item.expired, item.expiringSoon),
            correctionHref: `/dq-files/${driver.id}?document=${documentSlug(item.name)}`,
          })),
      ),
    ),
    buildCategory(
      "Vehicle Files",
      vehicles.flatMap((vehicle) =>
        vehicle.checklist
          .filter((item) => !item.notApplicable && !vehicleMaintenanceNames.has(item.name))
          .map((item) => ({
            id: `vehicle:${vehicle.id}:${documentSlug(item.name)}`,
            label: `Unit ${vehicle.unitNumber} - ${item.name}`,
            status: checklistStatus(item.missing, item.expired, item.expiringSoon),
            correctionHref: `/vehicles/${vehicle.id}?document=${documentSlug(item.name)}`,
          })),
      ),
    ),
    buildCategory(
      "Vehicle Maintenance",
      vehicles.flatMap((vehicle) =>
        vehicle.checklist
          .filter((item) => !item.notApplicable && vehicleMaintenanceNames.has(item.name))
          .map((item) => ({
            id: `vehicle-maintenance:${vehicle.id}:${documentSlug(item.name)}`,
            label: `Unit ${vehicle.unitNumber} - ${item.name}`,
            status: checklistStatus(item.missing, item.expired, item.expiringSoon),
            correctionHref: `/vehicles/${vehicle.id}?document=${documentSlug(item.name)}`,
          })),
      ),
    ),
    buildCategory(
      "Required Compliance Documents",
      carrierDocuments.map((document) => ({
        id: `required:${documentSlug(document.name)}`,
        label: document.name,
        status: itemStatus(document.status),
        correctionHref: `/carriers/${input.carrier.id}#document-${documentSlug(document.name)}`,
      })),
    ),
  ];

  const totals = summarizeCategories(categories);
  const percentage = totals.totalItems ? Math.round((totals.completedCount / totals.totalItems) * 100) : 0;
  const criticalMissingCount = carrierDocuments.filter(
    (document) => criticalDocumentNames.has(document.name) && ["Missing", "Expired"].includes(document.status),
  ).length;

  return {
    carrierId: input.carrier.id,
    carrierName: input.carrier.companyName,
    percentage,
    status: onboardingStatus(percentage, totals.completedCount, totals.totalItems),
    completedCount: totals.completedCount,
    missingCount: totals.missingCount,
    expiringCount: totals.expiringCount,
    expiredCount: totals.expiredCount,
    criticalMissingCount,
    categories,
  };
}

export function buildOnboardingProgressByCarrier(input: {
  carriers: Carrier[];
  drivers?: DQFileRecord[];
  vehicles?: VehicleRecord[];
}) {
  const driversByCarrier = groupByCarrier(input.drivers ?? []);
  const vehiclesByCarrier = groupByCarrier(input.vehicles ?? []);

  return new Map(
    input.carriers.map((carrier) => [
      carrier.id,
      buildCarrierOnboardingProgress({
        carrier,
        drivers: driversByCarrier.get(carrier.id) ?? [],
        vehicles: vehiclesByCarrier.get(carrier.id) ?? [],
      }),
    ]),
  );
}

export function summarizeOnboardingProgress(progress: CarrierOnboardingProgress[]): OnboardingProgressDashboardSummary {
  return {
    complete: progress.filter((item) => item.status === "Complete").length,
    inProgress: progress.filter((item) => item.status === "In Progress" || item.status === "Near Complete").length,
    missingCriticalDocuments: progress.filter((item) => item.criticalMissingCount > 0 || item.expiredCount > 0).length,
  };
}

function buildCategory(name: OnboardingProgressCategoryName, items: OnboardingProgressItem[]): OnboardingProgressCategory {
  const completedItems = items.filter((item) => item.status === "complete");
  const missingItems = items.filter((item) => item.status === "missing");
  const expiringItems = items.filter((item) => item.status === "expiring");
  const expiredItems = items.filter((item) => item.status === "expired");

  return {
    name,
    percentage: items.length ? Math.round((completedItems.length / items.length) * 100) : 0,
    completedItems,
    missingItems,
    expiringItems,
    expiredItems,
    totalItems: items.length,
  };
}

function summarizeCategories(categories: OnboardingProgressCategory[]) {
  return categories.reduce(
    (summary, category) => ({
      totalItems: summary.totalItems + category.totalItems,
      completedCount: summary.completedCount + category.completedItems.length,
      missingCount: summary.missingCount + category.missingItems.length,
      expiringCount: summary.expiringCount + category.expiringItems.length,
      expiredCount: summary.expiredCount + category.expiredItems.length,
    }),
    { totalItems: 0, completedCount: 0, missingCount: 0, expiringCount: 0, expiredCount: 0 },
  );
}

function itemStatus(status: string): OnboardingProgressItem["status"] {
  if (status === "Expired") return "expired";
  if (status === "Expiring Soon") return "expiring";
  if (status === "Missing") return "missing";
  return "complete";
}

function checklistStatus(missing: boolean, expired: boolean, expiringSoon: boolean): OnboardingProgressItem["status"] {
  if (expired) return "expired";
  if (missing) return "missing";
  if (expiringSoon) return "expiring";
  return "complete";
}

function onboardingStatus(percentage: number, completedCount: number, totalItems: number): OnboardingProgressStatus {
  if (!totalItems || completedCount === 0) return "Not Started";
  if (percentage >= 100) return "Complete";
  if (percentage >= 85) return "Near Complete";
  return "In Progress";
}

function groupByCarrier<T extends { carrierId: string }>(records: T[]) {
  return records.reduce((map, record) => {
    const items = map.get(record.carrierId) ?? [];
    items.push(record);
    map.set(record.carrierId, items);
    return map;
  }, new Map<string, T[]>());
}
