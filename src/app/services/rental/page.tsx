import type { Metadata } from "next";
import { ServicePage } from "@/components/ServicePage";
import { SERVICES } from "@/lib/services";

export const metadata: Metadata = { title: SERVICES.rental.title };

export default function Page() {
  return <ServicePage service={SERVICES.rental} />;
}
