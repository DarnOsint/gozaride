import type { ServiceType } from "./validation";

// Base fare and per-km rate in USD, per service. These are platform defaults.
// They can move into platform_settings once the admin panel manages them.
const TARIFF: Record<ServiceType, { base: number; perKm: number; minimum: number }> = {
  taxi: { base: 2.0, perKm: 0.9, minimum: 3.0 },
  motorcycle: { base: 1.5, perKm: 0.6, minimum: 2.0 },
  package: { base: 3.0, perKm: 0.8, minimum: 4.0 },
  food: { base: 2.5, perKm: 0.7, minimum: 3.0 },
  rental: { base: 15.0, perKm: 0.25, minimum: 15.0 },
  bus: { base: 0.5, perKm: 0.1, minimum: 0.5 },
};

export const COMMISSION_RATE = 0.2;

export function fareUsd(service: ServiceType, km: number): number {
  const t = TARIFF[service];
  const raw = t.base + t.perKm * km;
  return Math.round(Math.max(t.minimum, raw) * 100) / 100;
}

export function toSsp(usd: number, sspPerUsd: number): number {
  return Math.round(usd * sspPerUsd * 100) / 100;
}
