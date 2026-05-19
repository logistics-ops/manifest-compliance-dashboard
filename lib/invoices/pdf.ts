import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { Load } from "@/types/load";

type PdfImage = {
  width: number;
  height: number;
  colorSpace: string;
  bitsPerComponent: number;
  data: Buffer;
};

const encoder = new TextEncoder();
const pageWidth = 612;
const pageHeight = 792;
const margin = 44;
const red = [0.89, 0.10, 0.22] as const;
const black = [0.05, 0.05, 0.06] as const;
const charcoal = [0.10, 0.10, 0.12] as const;
const gray = [0.43, 0.44, 0.49] as const;

export function createInvoicePdf(input: {
  organizationName: string;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string | null;
  load: Load;
  notes: string;
}) {
  const logo = readLogo();
  const canvas = new PdfCanvas();
  const hasPod = input.load.documents.some((document) => document.documentType === "pod");
  const invoiceTitle = input.organizationName || "Manifest Global Logistics";

  drawHeader(canvas, input, invoiceTitle, logo);
  drawMetadata(canvas, input);

  const top = 565;
  drawPartyCard(canvas, margin, top, "Bill To", [
    input.load.brokerName || "Broker",
    input.load.brokerEmail || "No broker email on file",
    "Billing recipient: Accounts Payable",
    "Billing address: To be provided",
  ]);
  drawPartyCard(canvas, 326, top, "Carrier", [
    input.load.carrierName,
    input.load.driverName ? `Driver: ${input.load.driverName}` : "Driver: Not assigned",
    `Load: ${input.load.loadNumber}`,
    `Status: ${formatStatus(input.load.status)}`,
  ]);

  drawLoadTable(canvas, 412, input.load);
  drawBilling(canvas, 254, input);
  drawPaymentAndPod(canvas, 148, input, hasPod);
  drawFooter(canvas);

  return buildPdf(canvas.output(), logo);
}

function drawHeader(canvas: PdfCanvas, input: Parameters<typeof createInvoicePdf>[0], companyName: string, logo: PdfImage | null) {
  canvas.fillRect(0, pageHeight - 132, pageWidth, 132, black);
  canvas.fillRect(0, pageHeight - 136, pageWidth, 4, red);
  canvas.fillRect(margin, pageHeight - 104, 58, 58, red);

  if (logo) {
    canvas.raw(`q 50 0 0 50 ${margin + 4} ${pageHeight - 100} cm /Logo Do Q`);
  } else {
    canvas.text("M", margin + 18, pageHeight - 84, 26, "bold", "white");
  }

  canvas.text(companyName, margin + 76, pageHeight - 66, 18, "bold", "white");
  canvas.text("ManifestOS broker billing", margin + 76, pageHeight - 86, 9, "regular", "muted");
  canvas.text("INVOICE", 420, pageHeight - 66, 30, "bold", "white");
  canvas.text(input.invoiceNumber, 422, pageHeight - 88, 11, "regular", "muted");
}

function drawMetadata(canvas: PdfCanvas, input: Parameters<typeof createInvoicePdf>[0]) {
  const y = 612;
  drawMetric(canvas, margin, y, "Invoice number", input.invoiceNumber);
  drawMetric(canvas, 210, y, "Invoice date", input.invoiceDate);
  drawMetric(canvas, 376, y, "Due date", input.dueDate ?? "Net terms pending");
}

function drawPartyCard(canvas: PdfCanvas, x: number, y: number, title: string, lines: string[]) {
  canvas.card(x, y, 242, 112);
  canvas.text(title.toUpperCase(), x + 16, y + 84, 8, "bold", "red");
  lines.slice(0, 4).forEach((line, index) => {
    canvas.text(line, x + 16, y + 62 - index * 17, index === 0 ? 11 : 9, index === 0 ? "bold" : "regular", index === 0 ? "dark" : "gray", 205);
  });
}

function drawLoadTable(canvas: PdfCanvas, y: number, load: Load) {
  canvas.text("LOAD INFORMATION", margin, y + 86, 9, "bold", "red");
  canvas.line(margin, y + 74, pageWidth - margin, y + 74, [0.86, 0.86, 0.88]);
  const rows = [
    ["Load number", load.loadNumber, "Origin", `${load.originCity}, ${load.originState}`],
    ["Destination", `${load.destinationCity}, ${load.destinationState}`, "Pickup date", load.pickupDate ?? "Not set"],
    ["Delivery date", load.deliveryDate ?? "Not set", "Driver", load.driverName || "Not assigned"],
    ["Carrier", load.carrierName, "Status", formatStatus(load.status)],
  ];

  rows.forEach((row, index) => {
    const rowY = y + 46 - index * 26;
    if (index % 2 === 0) canvas.fillRect(margin, rowY - 8, pageWidth - margin * 2, 24, [0.97, 0.97, 0.98]);
    drawTablePair(canvas, margin + 12, rowY, row[0], row[1], 138);
    drawTablePair(canvas, 326, rowY, row[2], row[3], 130);
  });
}

function drawBilling(canvas: PdfCanvas, y: number, input: Parameters<typeof createInvoicePdf>[0]) {
  canvas.card(margin, y - 6, pageWidth - margin * 2, 104);
  canvas.text("BILLING BREAKDOWN", margin + 16, y + 72, 9, "bold", "red");
  canvas.line(margin + 16, y + 58, pageWidth - margin - 16, y + 58, [0.86, 0.86, 0.88]);
  canvas.text("Line item", margin + 16, y + 39, 8, "bold", "gray");
  canvas.text("Amount", pageWidth - margin - 94, y + 39, 8, "bold", "gray");
  canvas.text(`Freight transportation for load ${input.load.loadNumber}`, margin + 16, y + 18, 10, "regular", "dark", 330);
  canvas.text(formatMoney(input.load.rateAmount), pageWidth - margin - 104, y + 18, 11, "bold", "dark");
  canvas.line(pageWidth - margin - 160, y - 4, pageWidth - margin - 16, y - 4, [0.86, 0.86, 0.88]);
  canvas.text("Subtotal", pageWidth - margin - 160, y - 24, 9, "regular", "gray");
  canvas.text(formatMoney(input.load.rateAmount), pageWidth - margin - 104, y - 24, 10, "bold", "dark");
  canvas.text("TOTAL AMOUNT DUE", pageWidth - margin - 160, y - 48, 9, "bold", "red");
  canvas.text(formatMoney(input.load.rateAmount), pageWidth - margin - 104, y - 49, 14, "bold", "dark");
}

function drawPaymentAndPod(canvas: PdfCanvas, y: number, input: Parameters<typeof createInvoicePdf>[0], hasPod: boolean) {
  drawPartyCard(canvas, margin, y, "Payment", [
    "Terms: Net 30 unless otherwise agreed",
    "Payment instructions: Placeholder",
    "Remit details provided by operations",
    input.notes ? `Notes: ${input.notes}` : "Notes: None",
  ]);
  drawPartyCard(canvas, 326, y, "POD Reference", [
    hasPod ? "POD available for broker review" : "POD not attached at generation",
    "Signed POD link included when emailed",
    `Load ${input.load.loadNumber}`,
    "Keep with invoice records",
  ]);
}

function drawFooter(canvas: PdfCanvas) {
  canvas.line(margin, 72, pageWidth - margin, 72, [0.86, 0.86, 0.88]);
  canvas.text("Thank you for working with Manifest Global Logistics.", margin, 50, 10, "bold", "dark");
  canvas.text("Generated by ManifestOS - operational records, POD workflow, and broker billing.", margin, 34, 8, "regular", "gray");
  canvas.text("manifestgl.com", pageWidth - margin - 74, 34, 8, "regular", "gray");
}

function drawMetric(canvas: PdfCanvas, x: number, y: number, label: string, value: string) {
  canvas.card(x, y, 150, 58);
  canvas.text(label.toUpperCase(), x + 12, y + 34, 7, "bold", "red");
  canvas.text(value, x + 12, y + 16, 10, "bold", "dark", 124);
}

function drawTablePair(canvas: PdfCanvas, x: number, y: number, label: string, value: string, valueWidth: number) {
  canvas.text(label.toUpperCase(), x, y, 7, "bold", "gray");
  canvas.text(value, x + 94, y, 9, "bold", "dark", valueWidth);
}

class PdfCanvas {
  private commands: string[] = [];

  output() {
    return this.commands.join("\n");
  }

  raw(command: string) {
    this.commands.push(command);
  }

  text(value: string, x: number, y: number, size: number, font: "regular" | "bold", color: "dark" | "gray" | "red" | "white" | "muted", maxWidth = 220) {
    const lines = wrapText(value, maxWidth, size);
    lines.forEach((line, index) => {
      this.commands.push(`${colorCommand(color)} BT /${font === "bold" ? "F2" : "F1"} ${size} Tf ${x} ${y - index * (size + 4)} Td (${escapePdfText(line)}) Tj ET`);
    });
  }

  fillRect(x: number, y: number, width: number, height: number, color: readonly number[]) {
    this.commands.push(`${rgb(color)} ${x} ${y} ${width} ${height} re f`);
  }

  line(x1: number, y1: number, x2: number, y2: number, color: readonly number[]) {
    this.commands.push(`${rgbStroke(color)} 1 w ${x1} ${y1} m ${x2} ${y2} l S`);
  }

  card(x: number, y: number, width: number, height: number) {
    this.fillRect(x, y, width, height, [1, 1, 1]);
    this.commands.push(`${rgbStroke([0.86, 0.86, 0.88])} 1 w ${x} ${y} ${width} ${height} re S`);
    this.fillRect(x, y + height - 4, width, 4, red);
  }
}

function buildPdf(content: string, logo: PdfImage | null) {
  const objects: Array<string | Buffer> = [];
  const logoObjectId = logo ? 8 : null;
  const xObject = logoObjectId ? `/XObject << /Logo ${logoObjectId} 0 R >>` : "";
  objects.push("<< /Type /Catalog /Pages 2 0 R >>");
  objects.push("<< /Type /Pages /Kids [3 0 R] /Count 1 >>");
  objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /Font << /F1 4 0 R /F2 5 0 R /F3 6 0 R >> ${xObject} >> /Contents 7 0 R >>`);
  objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>");
  objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Oblique >>");
  objects.push(streamObject(encoder.encode(content)));
  if (logo) {
    objects.push(streamObject(logo.data, `<< /Type /XObject /Subtype /Image /Width ${logo.width} /Height ${logo.height} /ColorSpace ${logo.colorSpace} /BitsPerComponent ${logo.bitsPerComponent} /Filter /FlateDecode /DecodeParms << /Predictor 15 /Colors ${logo.colorSpace === "/DeviceRGB" ? 3 : 1} /BitsPerComponent ${logo.bitsPerComponent} /Columns ${logo.width} >> >>`));
  }

  const chunks: Buffer[] = [Buffer.from("%PDF-1.4\n", "binary")];
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(totalLength(chunks));
    chunks.push(Buffer.from(`${index + 1} 0 obj\n`, "binary"));
    chunks.push(typeof object === "string" ? Buffer.from(object, "binary") : object);
    chunks.push(Buffer.from("\nendobj\n", "binary"));
  });
  const xref = totalLength(chunks);
  chunks.push(Buffer.from(`xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`, "binary"));
  offsets.slice(1).forEach((offset) => chunks.push(Buffer.from(`${String(offset).padStart(10, "0")} 00000 n \n`, "binary")));
  chunks.push(Buffer.from(`trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`, "binary"));
  return new Uint8Array(Buffer.concat(chunks));
}

function streamObject(data: Uint8Array | Buffer, dictionary = "<< >>") {
  return Buffer.concat([
    Buffer.from(dictionary.replace(">>", `/Length ${data.length} >>`) + "\nstream\n", "binary"),
    Buffer.from(data),
    Buffer.from("\nendstream", "binary"),
  ]);
}

function readLogo(): PdfImage | null {
  const path = join(process.cwd(), "public", "logo.png");
  if (!existsSync(path)) return null;
  const buffer = readFileSync(path);
  if (buffer.toString("binary", 1, 4) !== "PNG") return null;
  let offset = 8;
  let width = 0;
  let height = 0;
  let bitsPerComponent = 8;
  let colorType = -1;
  const idat: Buffer[] = [];

  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString("ascii", offset + 4, offset + 8);
    const data = buffer.subarray(offset + 8, offset + 8 + length);
    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitsPerComponent = data[8];
      colorType = data[9];
    }
    if (type === "IDAT") idat.push(data);
    offset += length + 12;
  }

  if (!width || !height || bitsPerComponent !== 8 || ![0, 2].includes(colorType) || !idat.length) return null;
  return {
    width,
    height,
    bitsPerComponent,
    colorSpace: colorType === 2 ? "/DeviceRGB" : "/DeviceGray",
    data: Buffer.concat(idat),
  };
}

function wrapText(value: string, maxWidth: number, size: number) {
  const maxChars = Math.max(12, Math.floor(maxWidth / (size * 0.52)));
  const words = String(value || "").split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (next.length > maxChars && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines.slice(0, 3);
}

function totalLength(chunks: Buffer[]) {
  return chunks.reduce((total, chunk) => total + chunk.length, 0);
}

function colorCommand(color: "dark" | "gray" | "red" | "white" | "muted") {
  if (color === "red") return rgb(red);
  if (color === "white") return "1 1 1 rg";
  if (color === "muted") return "0.75 0.75 0.78 rg";
  if (color === "gray") return rgb(gray);
  return rgb(charcoal);
}

function rgb(color: readonly number[]) {
  return `${color[0]} ${color[1]} ${color[2]} rg`;
}

function rgbStroke(color: readonly number[]) {
  return `${color[0]} ${color[1]} ${color[2]} RG`;
}

function escapePdfText(value: string) {
  return value.replace(/[^\x20-\x7E]/g, " ").replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function formatStatus(value: string) {
  return value.split("_").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
}
