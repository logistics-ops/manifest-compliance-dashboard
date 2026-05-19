export type InvoiceStatus = "draft" | "sent" | "paid" | "overdue" | "void";

export type Invoice = {
  id: string;
  organizationId: string;
  carrierId: string;
  loadId: string;
  invoiceNumber: string;
  loadNumber: string;
  carrierName: string;
  brokerName: string;
  brokerEmail: string;
  invoiceDate: string;
  dueDate: string | null;
  subtotal: number;
  totalAmount: number;
  notes: string;
  status: InvoiceStatus;
  storagePath: string | null;
  fileName: string | null;
  versionNumber: number;
  sentAt: string | null;
  paidAt: string | null;
  createdAt: string;
  updatedAt: string;
};
