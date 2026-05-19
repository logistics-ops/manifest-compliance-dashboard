export type BrokerApprovedStatus = "approved" | "review_required" | "blocked";

export type BrokerRiskLevel = "low" | "medium" | "high";

export type Broker = {
  id: string;
  organizationId: string;
  brokerName: string;
  mcNumber: string;
  dotNumber: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  authorityStatus: string;
  safetyRating: string;
  approvedStatus: BrokerApprovedStatus;
  riskLevel: BrokerRiskLevel;
  notes: string;
  notesPrivate: boolean;
  blockedReason: string;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
};

export type BrokerCheckRequestStatus = "open" | "reviewing" | "resolved";

export type BrokerCheckRequest = {
  id: string;
  organizationId: string;
  requestedBy: string | null;
  carrierId: string | null;
  brokerName: string;
  mcNumber: string;
  notes: string;
  status: BrokerCheckRequestStatus;
  createdAt: string;
  updatedAt: string;
};
