import { getCarrierDocuments, getComplianceScore, isHighRisk } from "@/lib/compliance";
import { getNotificationStats } from "@/lib/notifications";
import type { Carrier, ComplianceNotification, NotificationCategory } from "@/types/carrier";

export type EmailDispatchInput = {
  to: string;
  subject: string;
  html: string;
  text: string;
  category: NotificationCategory | "pod_delivery";
  from?: string;
};

export async function createEmailDispatch(input: EmailDispatchInput): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    throw new Error("RESEND_API_KEY is required before sending emails.");
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: input.from ?? "pod@manifestgl.com",
      to: [input.to],
      subject: input.subject,
      html: input.html,
      text: input.text,
    }),
  });

  if (!response.ok) {
    throw new Error(await parseResendError(response));
  }
}

export function createDocumentAlertEmail(input: {
  notification: ComplianceNotification;
  recipientName: string;
}) {
  const subject = `[${input.notification.priority.toUpperCase()}] ${input.notification.title}`;
  const text = [
    `Hello ${input.recipientName},`,
    "",
    input.notification.message,
    input.notification.documentName ? `Document: ${input.notification.documentName}` : "",
    input.notification.dueDate ? `Due/expiration date: ${input.notification.dueDate}` : "",
    "",
    "Review this alert in the Manifest Global Logistics compliance dashboard.",
  ]
    .filter(Boolean)
    .join("\n");

  return {
    subject,
    text,
    html: baseEmailTemplate({
      eyebrow: "Compliance Alert",
      title: input.notification.title,
      body: input.notification.message,
      details: [
        ["Carrier", input.notification.carrierName],
        ["Document", input.notification.documentName ?? "Carrier-level alert"],
        ["Priority", input.notification.priority],
        ["Due date", input.notification.dueDate ?? "Immediate review"],
      ],
    }),
  };
}

export function createWeeklySummaryEmail(input: {
  carriers: Carrier[];
  notifications: ComplianceNotification[];
  recipientName: string;
}) {
  const stats = getNotificationStats(input.notifications);
  const highRiskCarriers = input.carriers.filter(isHighRisk);
  const missingDocuments = input.carriers.flatMap(getCarrierDocuments).filter((document) => document.status === "Missing");
  const expiringDocuments = input.carriers.flatMap(getCarrierDocuments).filter((document) => document.status === "Expiring Soon");
  const averageScore = input.carriers.length
    ? Math.round(input.carriers.reduce((total, carrier) => total + getComplianceScore(carrier), 0) / input.carriers.length)
    : 0;

  const subject = `Weekly compliance summary: ${stats.critical} critical, ${stats.unread} unread`;
  const text = [
    `Hello ${input.recipientName},`,
    "",
    `Average compliance score: ${averageScore}`,
    `Unread alerts: ${stats.unread}`,
    `Critical alerts: ${stats.critical}`,
    `High-risk carriers: ${highRiskCarriers.length}`,
    `Missing documents: ${missingDocuments.length}`,
    `Expiring documents: ${expiringDocuments.length}`,
    "",
    "Open the Manifest Global Logistics dashboard for the full operational queue.",
  ].join("\n");

  return {
    subject,
    text,
    html: baseEmailTemplate({
      eyebrow: "Weekly Compliance Summary",
      title: "Carrier compliance operating picture",
      body: "A weekly rollup of carrier risk, document exposure, and open compliance work.",
      details: [
        ["Average score", String(averageScore)],
        ["Unread alerts", String(stats.unread)],
        ["Critical alerts", String(stats.critical)],
        ["High-risk carriers", String(highRiskCarriers.length)],
        ["Missing documents", String(missingDocuments.length)],
        ["Expiring documents", String(expiringDocuments.length)],
      ],
    }),
  };
}

export function createPodDeliveryEmail(input: {
  brokerName: string;
  loadNumber: string;
  carrierName: string;
  origin: string;
  destination: string;
  deliveryDate: string | null;
  podUrl: string;
}) {
  const subject = `POD for Load ${input.loadNumber}`;
  const greeting = input.brokerName ? `Hello ${input.brokerName},` : "Hello,";
  const text = [
    greeting,
    "",
    `Proof of delivery is available for load ${input.loadNumber}.`,
    `Carrier: ${input.carrierName}`,
    `Lane: ${input.origin} to ${input.destination}`,
    input.deliveryDate ? `Delivery date: ${input.deliveryDate}` : "",
    `POD link: ${input.podUrl}`,
    "",
    "Thank you for working with Manifest Global Logistics.",
    "ManifestOS",
  ].filter(Boolean).join("\n");

  return {
    subject,
    text,
    html: baseEmailTemplate({
      eyebrow: "Proof of Delivery",
      title: `POD ready for load ${input.loadNumber}`,
      body: "The proof of delivery document is ready for broker review.",
      details: [
        ["Carrier", input.carrierName],
        ["Origin", input.origin],
        ["Destination", input.destination],
        ["Delivery date", input.deliveryDate ?? "Not set"],
        ["POD link", input.podUrl],
      ],
    }),
  };
}

async function parseResendError(response: Response) {
  try {
    const payload = await response.json() as { message?: string; error?: string; name?: string };
    return payload.message || payload.error || payload.name || "Unable to send email with Resend.";
  } catch {
    return "Unable to send email with Resend.";
  }
}

function baseEmailTemplate(input: {
  eyebrow: string;
  title: string;
  body: string;
  details: Array<[string, string]>;
}) {
  const rows = input.details
    .map(
      ([label, value]) => `
        <tr>
          <td style="padding:10px 0;color:#8f9098;font-size:12px;text-transform:uppercase;letter-spacing:.12em;">${escapeHtml(label)}</td>
          <td style="padding:10px 0;color:#ffffff;font-weight:700;text-align:right;">${escapeHtml(value)}</td>
        </tr>
      `,
    )
    .join("");

  return `
    <div style="margin:0;padding:28px;background:#050506;color:#f8f8f8;font-family:Arial,sans-serif;">
      <div style="max-width:680px;margin:0 auto;border:1px solid rgba(255,255,255,.12);border-radius:8px;background:#111114;padding:28px;">
        <div style="color:#e31937;font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.18em;">${escapeHtml(input.eyebrow)}</div>
        <h1 style="margin:8px 0 12px;font-size:30px;line-height:1.05;color:#ffffff;">${escapeHtml(input.title)}</h1>
        <p style="margin:0 0 22px;color:#c9c9d1;line-height:1.6;">${escapeHtml(input.body)}</p>
        <table style="width:100%;border-collapse:collapse;border-top:1px solid rgba(255,255,255,.12);">${rows}</table>
      </div>
    </div>
  `;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
