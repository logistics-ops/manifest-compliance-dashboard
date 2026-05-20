export type FuelExtractionStatus = "pending" | "extracted" | "needs_review" | "failed" | "approved";

export type FuelReceipt = {
  id: string;
  organizationId: string;
  carrierId: string;
  carrierName: string;
  loadId: string | null;
  loadNumber: string | null;
  driverId: string | null;
  vehicleId: string | null;
  receiptFilePath: string;
  fileName: string;
  vendorName: string;
  transactionDate: string | null;
  transactionTime: string | null;
  fuelType: string;
  gallons: number;
  pricePerGallon: number;
  totalAmount: number;
  city: string;
  state: string;
  odometer: number | null;
  paymentMethod: string;
  cardLast4: string;
  extractionStatus: FuelExtractionStatus;
  extractionConfidence: number;
  rawExtraction: Record<string, unknown>;
  notes: string;
  uploadedBy: string | null;
  uploadedByName: string | null;
  approvedBy: string | null;
  approvedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type FuelReceiptFilters = {
  q?: string;
  dateFrom?: string;
  dateTo?: string;
  carrierId?: string;
  state?: string;
  fuelType?: string;
  status?: string;
};

export type FuelReceiptMetrics = {
  totalGallons: number;
  totalSpend: number;
  missingReviewCount: number;
  spendByState: Array<{ state: string; value: number }>;
  gallonsByState: Array<{ state: string; value: number }>;
  countByState: Array<{ state: string; value: number }>;
};
