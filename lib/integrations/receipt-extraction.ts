import type { FuelExtractionStatus } from "@/types/fuel";

export type ReceiptExtractionResult = {
  vendorName: string | null;
  transactionDate: string | null;
  transactionTime: string | null;
  fuelType: string | null;
  gallons: number | null;
  pricePerGallon: number | null;
  totalAmount: number | null;
  city: string | null;
  state: string | null;
  odometer: number | null;
  cardLast4: string | null;
  confidence: number;
  status: FuelExtractionStatus;
  raw: Record<string, unknown>;
};

export type ReceiptExtractionInput = {
  fileName: string;
  mimeType: string;
  fileSize: number;
  storagePath: string;
};

const statePattern = /\b(AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|IA|ID|IL|IN|KS|KY|LA|MA|MD|ME|MI|MN|MO|MS|MT|NC|ND|NE|NH|NJ|NM|NV|NY|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VA|VT|WA|WI|WV|WY)\b/i;

export async function extractFuelReceipt(input: ReceiptExtractionInput): Promise<ReceiptExtractionResult> {
  const normalizedName = input.fileName.replace(/\.[a-z0-9]+$/i, "").replace(/[_-]+/g, " ");
  const state = normalizedName.match(statePattern)?.[1]?.toUpperCase() ?? null;
  const date = normalizedName.match(/\b(20\d{2})[ .-]?([01]\d)[ .-]?([0-3]\d)\b/) ?? normalizedName.match(/\b([01]\d)[ .-]?([0-3]\d)[ .-]?(20\d{2})\b/);
  const transactionDate = date
    ? date[1].startsWith("20")
      ? `${date[1]}-${date[2]}-${date[3]}`
      : `${date[3]}-${date[1]}-${date[2]}`
    : null;
  const vendorName = guessVendorName(normalizedName);
  const totalAmount = parseNumberMatch(normalizedName.match(/(?:total|amount|paid)\s?\$?(\d+(?:\.\d{2})?)/i));
  const gallons = parseNumberMatch(normalizedName.match(/(\d+(?:\.\d+)?)\s?(?:gal|gallons)/i));
  const pricePerGallon = parseNumberMatch(normalizedName.match(/\$?(\d\.\d{2,3})\s?(?:ppg|per-gallon|per gallon)/i));
  const confidence = [vendorName, transactionDate, state, totalAmount, gallons, pricePerGallon].filter(Boolean).length / 8;
  const status: FuelExtractionStatus = confidence >= 0.55 ? "extracted" : "needs_review";

  return {
    vendorName,
    transactionDate,
    transactionTime: normalizedName.match(/\b([0-2]\d[:.][0-5]\d)\b/)?.[1]?.replace(".", ":") ?? null,
    fuelType: normalizeFuelType(normalizedName.match(/\b(diesel|reefer|def|gasoline|unleaded)\b/i)?.[1] ?? null),
    gallons,
    pricePerGallon,
    totalAmount,
    city: null,
    state,
    odometer: parseNumberMatch(normalizedName.match(/(?:odo|odometer)\s?(\d{3,8})/i)),
    cardLast4: normalizedName.match(/(?:card|last4|last)\s?(\d{4})/i)?.[1] ?? null,
    confidence: Math.round(confidence * 100) / 100,
    status,
    raw: {
      provider: "fallback_filename_parser",
      message: "Receipt OCR provider is not configured yet. Filename hints were used where possible.",
      fileName: input.fileName,
      mimeType: input.mimeType,
      fileSize: input.fileSize,
      storagePath: input.storagePath,
    },
  };
}

export function getMissingFuelReceiptFields(result: ReceiptExtractionResult) {
  const requiredFields: Array<keyof ReceiptExtractionResult> = [
    "vendorName",
    "transactionDate",
    "fuelType",
    "gallons",
    "pricePerGallon",
    "totalAmount",
    "state",
  ];

  return requiredFields.filter((field) => {
    const value = result[field];
    return value === null || value === "" || value === 0;
  });
}

function guessVendorName(value: string) {
  const vendors = ["Pilot", "Flying J", "Love's", "TA", "Petro", "Speedway", "Shell", "BP", "Chevron"];
  const match = vendors.find((vendor) => value.toLowerCase().includes(vendor.toLowerCase().replace("'s", "")));
  return match ?? null;
}

function parseNumberMatch(match: RegExpMatchArray | null) {
  if (!match?.[1]) return null;
  const value = Number(match[1].replace(/,/g, ""));
  return Number.isFinite(value) ? value : null;
}

function normalizeFuelType(value: string | null) {
  if (!value) return null;
  const normalized = value.toLowerCase();
  if (normalized === "def") return "DEF";
  if (normalized === "unleaded") return "Gasoline";
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}
