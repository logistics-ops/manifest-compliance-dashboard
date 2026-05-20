export type CarrierStatus = "Active" | "Pending" | "Suspended" | "Inactive";

export type UserRole = "admin" | "staff" | "carrier";

export type AuthSession = {
  userId: string;
  email: string;
  fullName: string;
  role: UserRole;
  organizationId: string | null;
  organizationName: string;
  organizationSlug: string;
  platformSuperAdmin: boolean;
  carrierId: string | null;
};

export type OrganizationBranding = {
  name: string;
  slug: string;
  logoUrl: string | null;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
};

export type DocumentStatus = "Valid" | "Expiring Soon" | "Expired" | "Missing";

export type ComplianceTier =
  | "Audit Ready"
  | "Strong Compliance"
  | "Mostly Compliant"
  | "Needs Attention"
  | "Moderate Risk"
  | "High Risk";

export type AlertLabel =
  | "Missing Document"
  | "Expiring in 30 Days"
  | "Expired"
  | "Needs Review"
  | "Audit Ready";

export type NotificationPriority = "low" | "medium" | "high" | "critical";

export type NotificationCategory =
  | "document_expiration"
  | "missing_document"
  | "expired_document"
  | "expired_insurance"
  | "high_risk_carrier"
  | "weekly_summary"
  | "load_operation"
  | "archive_operation"
  | "invoice_operation"
  | "broker_operation"
  | "user_operation";

export type NotificationStatus = "unread" | "read" | "dismissed";

export type ComplianceNotification = {
  id: string;
  carrierId: string | null;
  carrierName: string;
  documentName: string | null;
  title: string;
  message: string;
  category: NotificationCategory;
  priority: NotificationPriority;
  status: NotificationStatus;
  assignedTo: string | null;
  createdAt: string;
  readAt: string | null;
  dismissedAt: string | null;
  dueDate: string | null;
  ruleKey: string;
  metadata?: Record<string, unknown>;
};

export type RequiredDocumentName =
  | "Certificate of Insurance"
  | "W-9"
  | "Operating Authority"
  | "Drug & Alcohol Consortium"
  | "Driver Qualification File"
  | "MVR"
  | "Medical Card"
  | "CDL"
  | "Annual Inspection"
  | "Vehicle Registration"
  | "Lease Agreement"
  | "ELD setup confirmation";

export type CarrierDocument = {
  uploaded: boolean;
  expirationDate: string | null;
  notes?: string;
  storagePath?: string | null;
  fileName?: string | null;
  fileSize?: number | null;
  mimeType?: string | null;
  uploadedAt?: string | null;
  uploadedBy?: string | null;
  versionNumber?: number | null;
};

export type Carrier = {
  id: string;
  organizationId: string | null;
  companyName: string;
  mcNumber: string;
  dotNumber: string;
  contactName: string;
  phone: string;
  email: string;
  status: CarrierStatus;
  notes: string;
  documents: Record<RequiredDocumentName, CarrierDocument>;
};

export type EnrichedDocument = CarrierDocument & {
  name: RequiredDocumentName;
  daysUntilExpiration: number | null;
  status: DocumentStatus;
};

export type ComplianceDeduction = {
  documentName: RequiredDocumentName;
  points: number;
  reason: string;
};

export type ComplianceScoreBreakdown = {
  startingScore: 100;
  finalScore: number;
  tier: ComplianceTier;
  automaticHighRisk: boolean;
  deductions: ComplianceDeduction[];
};

export type ComplianceTimelineEvent = {
  id: string;
  carrierId: string;
  carrierName: string;
  documentName: RequiredDocumentName;
  expirationDate: string;
  daysUntilExpiration: number;
  status: DocumentStatus;
};
