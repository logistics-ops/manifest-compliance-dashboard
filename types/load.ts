export type LoadStatus =
  | "booked"
  | "in_transit"
  | "delivered"
  | "pod_uploaded"
  | "pod_sent"
  | "invoiced"
  | "cancelled";

export type LoadDocumentType = "rate_confirmation" | "pod";

export type LoadDocument = {
  id: string;
  documentType: LoadDocumentType;
  storagePath: string;
  fileName: string;
  fileSize: number | null;
  mimeType: string | null;
  versionNumber: number;
  uploadedBy: string | null;
  uploadedAt: string;
};

export type Load = {
  id: string;
  organizationId: string;
  loadNumber: string;
  carrierId: string;
  carrierName: string;
  driverName: string;
  brokerName: string;
  brokerEmail: string;
  originCity: string;
  originState: string;
  destinationCity: string;
  destinationState: string;
  pickupDate: string | null;
  deliveryDate: string | null;
  rateAmount: number;
  status: LoadStatus;
  notes: string;
  podSentAt: string | null;
  documents: LoadDocument[];
  createdAt: string;
};
