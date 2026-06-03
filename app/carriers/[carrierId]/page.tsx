import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { CarrierProfilePage } from "@/components/carrier-profile-page";
import { getCarriers } from "@/lib/data/carriers";
import { getDQFiles } from "@/lib/data/dq-files";
import { getLoads } from "@/lib/data/loads";
import { getUploadLinksForCarrier } from "@/lib/data/upload-links";
import { getVehicles } from "@/lib/data/vehicles";
import { canViewCarrier, requireSession } from "@/lib/integrations/auth";
import { mockCarriers } from "@/lib/mock-data";

type CarrierPageProps = {
  params: Promise<{
    carrierId: string;
  }>;
  searchParams?: Promise<{
    uploadLink?: string;
    success?: string;
    error?: string;
  }>;
};

export function generateStaticParams() {
  return mockCarriers.map((carrier) => ({
    carrierId: carrier.id,
  }));
}

export async function generateMetadata({ params }: CarrierPageProps): Promise<Metadata> {
  const { carrierId } = await params;
  const carriers = await getCarriers();
  const carrier = carriers.find((item) => item.id === carrierId);

  return {
    title: carrier
      ? `${carrier.companyName} | Manifest Carrier Compliance`
      : "Carrier Profile | Manifest Carrier Compliance",
  };
}

export default async function CarrierPage({ params, searchParams }: CarrierPageProps) {
  const { carrierId } = await params;
  const query = await searchParams;
  const session = await requireSession();
  const carriers = await getCarriers();
  const [loads, dqFiles, vehicles, uploadLinks] = await Promise.all([
    getLoads(),
    getDQFiles(),
    getVehicles(),
    getUploadLinksForCarrier(carrierId),
  ]);
  const carrier = carriers.find((item) => item.id === carrierId);

  if (!carrier) {
    notFound();
  }

  if (!canViewCarrier(session, carrier.id)) {
    redirect(session.carrierId ? `/carriers/${session.carrierId}` : "/unauthorized");
  }

  return (
    <CarrierProfilePage
      carrier={carrier}
      session={session}
      loads={loads.filter((load) => load.carrierId === carrier.id)}
      drivers={dqFiles.filter((file) => file.carrierId === carrier.id)}
      vehicles={vehicles.filter((vehicle) => vehicle.carrierId === carrier.id)}
      uploadLinks={uploadLinks}
      generatedUploadLink={query?.uploadLink ? decodeURIComponent(query.uploadLink) : null}
      message={query?.success ? { type: "success", text: decodeURIComponent(query.success) } : query?.error ? { type: "error", text: decodeURIComponent(query.error) } : null}
    />
  );
}
