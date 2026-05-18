import { headers } from "next/headers";
import type { CSSProperties } from "react";
import type { OrganizationBranding } from "@/types/carrier";

export const DEFAULT_ORGANIZATION_BRANDING: OrganizationBranding = {
  name: "Manifest Global Logistics",
  slug: "manifest",
  logoUrl: null,
  primaryColor: "#e31937",
  secondaryColor: "#8d1022",
  accentColor: "#ff4d5d",
};

const ROOT_DOMAIN = (process.env.NEXT_PUBLIC_ROOT_DOMAIN || "manifest.local").toLowerCase();

export async function getRequestSubdomain() {
  const headerStore = await headers();
  return getSubdomainFromHost(headerStore.get("x-forwarded-host") || headerStore.get("host") || "");
}

export function getSubdomainFromHost(host: string) {
  return getSubdomainFromHostForRoot(host, ROOT_DOMAIN);
}

export function getSubdomainFromHostForRoot(host: string, rootDomain: string) {
  const hostname = host.split(",")[0].trim().split(":")[0].toLowerCase();
  const normalizedRootDomain = rootDomain.toLowerCase();

  if (!hostname || hostname === "localhost" || hostname === "127.0.0.1") {
    return null;
  }

  if (hostname.endsWith(`.${normalizedRootDomain}`)) {
    const subdomain = hostname.slice(0, -normalizedRootDomain.length - 1);
    return subdomain && subdomain !== "www" ? subdomain : null;
  }

  const parts = hostname.split(".");
  if (parts.length > 2 && parts[0] !== "www") {
    return parts[0];
  }

  return null;
}

export function getOrganizationBrandStyle(branding: OrganizationBranding) {
  return {
    "--brand-primary": branding.primaryColor,
    "--brand-secondary": branding.secondaryColor,
    "--brand-accent": branding.accentColor,
    "--brand-primary-rgb": hexToRgbChannel(branding.primaryColor),
    "--brand-secondary-rgb": hexToRgbChannel(branding.secondaryColor),
    "--brand-accent-rgb": hexToRgbChannel(branding.accentColor),
  } as CSSProperties;
}

function hexToRgbChannel(hex: string) {
  const normalized = hex.replace("#", "");
  const value = normalized.length === 6 ? normalized : "e31937";
  const red = Number.parseInt(value.slice(0, 2), 16);
  const green = Number.parseInt(value.slice(2, 4), 16);
  const blue = Number.parseInt(value.slice(4, 6), 16);

  return `${red} ${green} ${blue}`;
}
