import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { getCurrentOrganizationBranding } from "@/lib/data/organizations";
import { getOrganizationBrandStyle } from "@/lib/tenancy";

export const metadata: Metadata = {
  title: "Manifest Operations Center",
  description: "Owner operations, audit readiness, carrier compliance, loads, and billing for ManifestOS.",
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
