import { createZipBuffer } from "@/lib/archives/zip";

export type ArchiveSummaryRow = {
  loadNumber: string;
  carrier: string;
  driverName: string;
  brokerName: string;
  brokerEmail: string;
  origin: string;
  destination: string;
  pickupDate: string;
  deliveryDate: string;
  rateAmount: number;
  status: string;
  podSentStatus: string;
  createdAt: string;
  updatedAt: string;
  archivedAt: string;
  documentMetadata: string;
  documentFileNames: string;
};

const columns: Array<keyof ArchiveSummaryRow> = [
  "loadNumber",
  "carrier",
  "driverName",
  "brokerName",
  "brokerEmail",
  "origin",
  "destination",
  "pickupDate",
  "deliveryDate",
  "rateAmount",
  "status",
  "podSentStatus",
  "createdAt",
  "updatedAt",
  "archivedAt",
  "documentMetadata",
  "documentFileNames",
];

const labels: Record<keyof ArchiveSummaryRow, string> = {
  loadNumber: "Load Number",
  carrier: "Carrier",
  driverName: "Driver Name",
  brokerName: "Broker Name",
  brokerEmail: "Broker Email",
  origin: "Origin",
  destination: "Destination",
  pickupDate: "Pickup Date",
  deliveryDate: "Delivery Date",
  rateAmount: "Rate Amount",
  status: "Status",
  podSentStatus: "POD Sent Status",
  createdAt: "Created At",
  updatedAt: "Updated At",
  archivedAt: "Archived At",
  documentMetadata: "Document Metadata",
  documentFileNames: "Document File Names",
};

const encoder = new TextEncoder();

export async function createLoadsSummaryXlsx(rows: ArchiveSummaryRow[]) {
  return createZipBuffer([
    { name: "[Content_Types].xml", data: xml(contentTypes()) },
    { name: "_rels/.rels", data: xml(rootRelationships()) },
    { name: "xl/workbook.xml", data: xml(workbook()) },
    { name: "xl/_rels/workbook.xml.rels", data: xml(workbookRelationships()) },
    { name: "xl/worksheets/sheet1.xml", data: xml(worksheet(rows)) },
    { name: "xl/styles.xml", data: xml(styles()) },
  ]);
}

function worksheet(rows: ArchiveSummaryRow[]) {
  const header = columns.map((column, index) => cell(1, index, labels[column], "str")).join("");
  const body = rows.map((row, rowIndex) => {
    const excelRow = rowIndex + 2;
    return `<row r="${excelRow}">${columns.map((column, columnIndex) => {
      const value = row[column];
      return cell(excelRow, columnIndex, value, typeof value === "number" ? "n" : "str");
    }).join("")}</row>`;
  }).join("");

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetViews><sheetView workbookViewId="0"/></sheetViews>
  <sheetFormatPr defaultRowHeight="15"/>
  <sheetData><row r="1">${header}</row>${body}</sheetData>
  <autoFilter ref="A1:Q${Math.max(rows.length + 1, 1)}"/>
</worksheet>`;
}

function cell(row: number, columnIndex: number, value: string | number, type: "str" | "n") {
  const reference = `${columnName(columnIndex)}${row}`;
  if (type === "n") return `<c r="${reference}"><v>${Number(value || 0)}</v></c>`;
  return `<c r="${reference}" t="inlineStr"><is><t>${escapeXml(String(value ?? ""))}</t></is></c>`;
}

function columnName(index: number) {
  let name = "";
  let current = index + 1;
  while (current > 0) {
    const modulo = (current - 1) % 26;
    name = String.fromCharCode(65 + modulo) + name;
    current = Math.floor((current - modulo) / 26);
  }
  return name;
}

function contentTypes() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
</Types>`;
}

function rootRelationships() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`;
}

function workbook() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets><sheet name="Loads Summary" sheetId="1" r:id="rId1"/></sheets>
</workbook>`;
}

function workbookRelationships() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;
}

function styles() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="1"><font><sz val="11"/><name val="Calibri"/></font></fonts>
  <fills count="1"><fill><patternFill patternType="none"/></fill></fills>
  <borders count="1"><border/></borders>
  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
  <cellXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/></cellXfs>
</styleSheet>`;
}

function xml(value: string) {
  return encoder.encode(value);
}

function escapeXml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
