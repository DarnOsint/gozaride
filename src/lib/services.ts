import type { ServiceInfo } from "@/components/ServicePage";

export const SERVICES: Record<string, ServiceInfo> = {
  taxi: {
    slug: "taxi",
    title: "Taxi rides",
    icon: "🚕",
    summary: "Book a ride to anywhere in town. Your driver sees your pickup and destination before accepting.",
    bullets: [
      "Fare shown before you confirm, in USD and SSP",
      "Live driver location while your ride is in progress",
      "Rate your driver after every trip",
    ],
  },
  motorcycle: {
    slug: "motorcycle",
    title: "Motorcycle delivery",
    icon: "🛵",
    summary: "Fast delivery of documents and small parcels by verified motorcycle riders.",
    bullets: ["Pickup and drop-off addresses on the map", "Estimated arrival before pickup", "Proof of delivery in the app"],
  },
  package: {
    slug: "package",
    title: "Package delivery",
    icon: "📦",
    summary: "Send parcels across town with tracking from pickup to drop-off.",
    bullets: ["Weight and size options", "Tracking history for every parcel", "Cash-on-delivery in SSP or USD"],
  },
  food: {
    slug: "food",
    title: "Food delivery",
    icon: "🍔",
    summary: "Order from local restaurants and have it delivered hot.",
    bullets: ["Restaurants managed by their own owners", "Live order status", "Pay in SSP or USD"],
  },
  rental: {
    slug: "rental",
    title: "Car rental",
    icon: "🚗",
    summary: "Rent a vehicle for a few hours or several days, with or without a driver.",
    bullets: ["Daily and hourly rates", "Pickup and return locations", "Deposit handled through the app"],
  },
  bus: {
    slug: "bus",
    title: "Transport",
    icon: "🚌",
    summary: "Shared transport on fixed city routes.",
    bullets: ["Route and stop map", "Seat availability", "Fares in SSP or USD"],
  },
};
