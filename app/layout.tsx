import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { getCurrentOrganizationBranding } from "@/lib/data/organizations";
import { getOrganizationBrandStyle } from "@/lib/tenancy";

export const metadata: Metadata = {
  title: "Manifest Global Logistics | Carrier Compliance",
  description: "Carrier compliance tracking dashboard for Manifest Global Logistics.",
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
