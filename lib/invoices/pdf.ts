import type { Load } from "@/types/load";

const encoder = new TextEncoder();

export function createInvoicePdf(input: {
  organizationName: string;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string | null;
  load: Load;
  notes: string;
}) {
  const lines = [
    input.organizationName,
    "ManifestOS Invoice",
    "",
    `Invoice #: ${input.invoiceNumber}`,
    `Invoice date: ${input.invoiceDate}`,
    `Due date: ${input.dueDate ?? "Net terms pending"}`,
    "",
    `Load #: ${input.load.loadNumber}`,
    `Broker: ${input.load.brokerName || "Broker"} <${input.load.brokerEmail || "No email"}>`,
    `Carrier: ${input.load.carrierName}`,
    `Lane: ${input.load.originCity}, ${input.load.originState} to ${input.load.destinationCity}, ${input.load.destinationState}`,
    `Pickup: ${input.load.pickupDate ?? "Not set"}`,
    `Delivery: ${input.load.deliveryDate ?? "Not set"}`,
    "",
    `Line item: Freight transportation for load ${input.load.loadNumber}`,
    `Amount due: ${formatMoney(input.load.rateAmount)}`,
    "",
    "Payment instructions:",
    "Please remit payment according to the broker-carrier agreement on file.",
    "",
    "POD reference:",
    input.load.documents.some((document) => document.documentType === "pod")
      ? "Proof of delivery is attached or linked in the invoice delivery email."
      : "No POD was available when this invoice was generated.",
    "",
    input.notes ? `Notes: ${input.notes}` : "",
  ].filter((line) => line !== "");

  const text = lines.map(escapePdfText).join("\\n");
  const content = `BT /F1 10 Tf 54 760 Td 14 TL (${text}) Tj ET`;
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
  ];

  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(pdf.length);
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.slice(1).forEach((offset) => {
    pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;

  return encoder.encode(pdf);
}

function escapePdfText(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
}
