import type { UploadDocumentCategory } from "@/lib/data/upload-links";
import type { PublicUploadDocumentStatus } from "@/lib/data/upload-links";

export type UploadPacketSection = {
  category: UploadDocumentCategory;
  eyebrow: string;
  title: string;
  description: string;
  documents: string[];
};

export const carrierDocumentOptions = [
  "W-9",
  "Certificate of Insurance",
  "MC Authority",
  "BOC-3",
  "Drug & Alcohol Consortium",
  "Notice of Assignment / Factoring",
  "Other supporting document",
];

export const driverDocumentOptions = [
  "Employment Application",
  "Initial MVR / 3-Year Driving Record",
  "Annual MVR Inquiry",
  "Medical Examiner Certificate / CDLIS Med Cert",
  "Road Test Certificate or CDL Equivalent",
  "Pre-Employment Drug/Alcohol Inquiry",
  "Other DQ Document",
];

export const vehicleDocumentOptions = [
  "Registration",
  "Insurance",
  "Annual Inspection",
  "Preventive Maintenance",
  "IRP",
  "IFTA",
  "Permits",
  "Other Custom Vehicle Documents",
];

export function getUploadPacketSections(categories: UploadDocumentCategory[], driverName: string | null, equipmentName: string | null): UploadPacketSection[] {
  return categories.map((category) => {
    if (category === "carrier") {
      return {
        category,
        eyebrow: "Company / Carrier Documents",
        title: "Company compliance files",
        description: "Upload the core company packet requested by Manifest.",
        documents: carrierDocumentOptions,
      };
    }

    if (category === "driver") {
      return {
        category,
        eyebrow: "Driver / DQ Documents",
        title: driverName ? `Driver packet - ${driverName}` : "Driver packet",
        description: "Upload the requested driver qualification files for this link.",
        documents: driverDocumentOptions,
      };
    }

    return {
      category,
      eyebrow: "Vehicle / Maintenance Documents",
      title: equipmentName ? `Vehicle packet - ${equipmentName}` : "Vehicle packet",
      description: "Upload the requested vehicle and maintenance records for this link.",
      documents: vehicleDocumentOptions,
    };
  });
}

export function uploadPacketStatusKey(category: UploadDocumentCategory, documentName: string) {
  return `${category}:${documentSlug(documentName)}`;
}

export function documentSlug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

export function isCompletedUploadStatus(status: PublicUploadDocumentStatus) {
  return Boolean(status.uploaded && status.reviewStatus !== "rejected" && status.reviewStatus !== "replacement_requested");
}
