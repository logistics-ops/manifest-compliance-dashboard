import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Manifest Global Logistics | Carrier Compliance",
  description: "Carrier compliance tracking dashboard for Manifest Global Logistics.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
