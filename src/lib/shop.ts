import { distanceKm } from "./geo";

/** Delivery fee in USD: $1.50 minimum plus $0.40 per km, rounded to cents. */
export function deliveryFeeUsd(km: number): number {
  return Math.round(Math.max(1.5, 1.5 + 0.4 * km) * 100) / 100;
}

export function toSspAmount(usd: number, sspPerUsd: number): number {
  return Math.round(usd * sspPerUsd * 100) / 100;
}

export { distanceKm };

/** Allowed status moves. Key = current status, value = statuses the shop or driver may move to. */
export const SHOP_TRANSITIONS: Record<string, string[]> = {
  pending: ["confirmed", "cancelled"],
  confirmed: ["preparing", "cancelled"],
  preparing: ["ready_for_pickup", "cancelled"],
  ready_for_pickup: ["out_for_delivery", "cancelled"],
  out_for_delivery: ["delivered"],
};
