import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { getCurrentOrganizationBranding } from "@/lib/data/organizations";
import { getOrganizationBrandStyle } from "@/lib/tenancy";

export const metadata: Metadata = {
  title: "Manifest Operations Center",
  description: "Audit readiness, carrier compliance, required documents, vehicle maintenance, and compliance tasks for ManifestOS.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  const branding = await getCurrentOrganizationBranding();

  return (
    <html lang="en">
      <body style={getOrganizationBrandStyle(branding)}>{children}</body>
    </html>
  );
}
