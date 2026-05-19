import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { CarrierProfilePage } from "@/components/carrier-profile-page";
import { getCarriers } from "@/lib/data/carriers";
import { getLoads } from "@/lib/data/loads";
import { canViewCarrier, requireSession } from "@/lib/integrations/auth";
import { mockCarriers } from "@/lib/mock-data";

type CarrierPageProps = {
  params: Promise<{
    carrierId: string;
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

export default async function CarrierPage({ params }: CarrierPageProps) {
  const { carrierId } = await params;
  const session = await requireSession();
  const carriers = await getCarriers();
  const loads = await getLoads();
  const carrier = carriers.find((item) => item.id === carrierId);

  if (!carrier) {
    notFound();
  }

  if (!canViewCarrier(session, carrier.id)) {
    redirect(session.carrierId ? `/carriers/${session.carrierId}` : "/unauthorized");
  }

  return <CarrierProfilePage carrier={carrier} session={session} loads={loads.filter((load) => load.carrierId === carrier.id)} />;
}
